import { useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";

/**
 * ScanCapture.jsx
 * - getUserMedia でカメラ起動
 * - OpenCV.js で書類検出（エッジ→輪郭→四隅推定）
 * - Perspective Transform で台形補正
 * - adaptive threshold で白黒最適化（FAXっぽく）
 * - pdf-lib で 1ページPDF化
 *
 * props:
 * - onDone(file: File): スキャン結果PDFを File として返す（例: setPdfFile(file)）
 * - onCancel(): 閉じるなど
 * - filenameBase?: "紹介状" など（省略可）
 * - preferRearCamera?: boolean（既定 true）
 */
export default function ScanCapture({
  onDone,
  onCancel,
  filenameBase = "scan",
  preferRearCamera = true,
}) {
  const videoRef = useRef(null);
  const rawCanvasRef = useRef(null); // キャプチャ用（元画像）
  const outCanvasRef = useRef(null); // 補正結果（白黒）
  const [camOn, setCamOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [opencvReady, setOpenCvReady] = useState(false);
  const streamRef = useRef(null);

  const canUseMedia =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  // ---- OpenCV.js ready check ----
  useEffect(() => {
    let t = null;
    const check = () => {
      // OpenCV.js は window.cv が生える
      if (typeof window !== "undefined" && window.cv && window.cv.Mat) {
        setOpenCvReady(true);
        return;
      }
      t = setTimeout(check, 200);
    };
    check();
    return () => t && clearTimeout(t);
  }, []);

  // ---- start/stop camera ----
  const stopCamera = async () => {
    try {
      const s = streamRef.current;
      if (s) {
        s.getTracks().forEach((tr) => tr.stop());
      }
      streamRef.current = null;
      setCamOn(false);
    } catch {
      // ignore
    }
  };

  const startCamera = async () => {
    setErr("");
    if (!canUseMedia) {
      setErr("このブラウザではカメラが使えません。");
      return;
    }
    try {
      const constraints = {
        audio: false,
        video: preferRearCamera
          ? { facingMode: { ideal: "environment" } }
          : { facingMode: "user" },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play();
      }
      setCamOn(true);
    } catch (e) {
      setErr(e?.message ?? String(e));
      setCamOn(false);
    }
  };

  useEffect(() => {
    // unmount cleanup
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- helpers (OpenCV) ----
  const cv = useMemo(
    () => (typeof window !== "undefined" ? window.cv : null),
    [],
  );

  function orderQuadPoints(pts) {
    // pts: [{x,y} x4]
    // 返り値: [tl, tr, br, bl]
    const sum = pts.map((p) => p.x + p.y);
    const diff = pts.map((p) => p.x - p.y);
    const tl = pts[sum.indexOf(Math.min(...sum))];
    const br = pts[sum.indexOf(Math.max(...sum))];
    const tr = pts[diff.indexOf(Math.max(...diff))];
    const bl = pts[diff.indexOf(Math.min(...diff))];
    return [tl, tr, br, bl];
  }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  async function canvasToPdfFile(canvas, outName) {
    // canvas を PNG化 → PDFに貼る
    const dataUrl = canvas.toDataURL("image/png");
    const pngBytes = await fetch(dataUrl).then((r) => r.arrayBuffer());

    const pdf = await PDFDocument.create();
    const img = await pdf.embedPng(pngBytes);

    // A4固定じゃなく、画像サイズに合わせる（“そのまま”）
    const w = img.width;
    const h = img.height;

    const page = pdf.addPage([w, h]);
    page.drawImage(img, { x: 0, y: 0, width: w, height: h });

    const pdfBytes = await pdf.save();
    return new File([pdfBytes], outName, { type: "application/pdf" });
  }

  // ---- main scan pipeline ----
  const captureAndProcess = async () => {
    setErr("");
    if (!opencvReady)
      return setErr("OpenCV.js がまだ読み込み中です（少し待ってね）");
    if (!camOn) return setErr("カメラが起動していません");
    if (!cv) return setErr("OpenCVが見つかりません（window.cv）");

    const video = videoRef.current;
    const rawCanvas = rawCanvasRef.current;
    const outCanvas = outCanvasRef.current;
    if (!video || !rawCanvas || !outCanvas) return;

    setBusy(true);
    try {
      // 1) video → rawCanvas に描画（高解像度ほど重いのでほどほどに）
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      // 端末によって巨大になるので上限を設ける（処理速度優先）
      const MAX_W = 1400;
      const scale = vw > MAX_W ? MAX_W / vw : 1;
      const cw = Math.round(vw * scale);
      const ch = Math.round(vh * scale);

      rawCanvas.width = cw;
      rawCanvas.height = ch;
      const ctx = rawCanvas.getContext("2d");
      ctx.drawImage(video, 0, 0, cw, ch);

      // 2) OpenCV: 書類検出（輪郭→四隅）
      const src = cv.imread(rawCanvas); // RGBA
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // ノイズ除去（軽く）
      const blur = new cv.Mat();
      cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);

      // エッジ検出
      const edges = new cv.Mat();
      cv.Canny(blur, edges, 60, 180);

      // 輪郭抽出
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(
        edges,
        contours,
        hierarchy,
        cv.RETR_LIST,
        cv.CHAIN_APPROX_SIMPLE,
      );

      let bestQuad = null;
      let bestArea = 0;

      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);

        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

        if (approx.rows === 4) {
          // 4点ポリゴン
          const area = cv.contourArea(approx);
          if (area > bestArea) {
            bestArea = area;
            bestQuad?.delete?.();
            bestQuad = approx.clone();
          }
        }

        approx.delete();
        cnt.delete();
      }

      // 後処理: contour mats
      contours.delete();
      hierarchy.delete();
      edges.delete();
      blur.delete();

      if (!bestQuad || bestArea < cw * ch * 0.12) {
        // 書類を見つけられなかった（閾値は適当。現場で調整）
        gray.delete();
        src.delete();
        bestQuad?.delete?.();
        throw new Error(
          "書類の四隅を検出できませんでした。紙全体が映るように撮ってみてください。",
        );
      }

      // bestQuad → points
      // approx は (x,y) が 4行
      const pts = [];
      for (let r = 0; r < 4; r++) {
        pts.push({
          x: bestQuad.intAt(r, 0),
          y: bestQuad.intAt(r, 1),
        });
      }
      const [tl, tr, br, bl] = orderQuadPoints(pts);

      // 出力サイズ（補正後の縦横）
      const widthA = dist(br, bl);
      const widthB = dist(tr, tl);
      const maxW = Math.max(widthA, widthB);

      const heightA = dist(tr, br);
      const heightB = dist(tl, bl);
      const maxH = Math.max(heightA, heightB);

      const dstW = Math.max(800, Math.round(maxW)); // 最低幅を確保
      const dstH = Math.round(maxW > 0 ? (maxH / maxW) * dstW : maxH);

      // 3) Perspective Transform
      const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        tl.x,
        tl.y,
        tr.x,
        tr.y,
        br.x,
        br.y,
        bl.x,
        bl.y,
      ]);
      const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0,
        0,
        dstW - 1,
        0,
        dstW - 1,
        dstH - 1,
        0,
        dstH - 1,
      ]);

      const M = cv.getPerspectiveTransform(srcTri, dstTri);
      const warped = new cv.Mat();
      const dsize = new cv.Size(dstW, dstH);
      cv.warpPerspective(
        gray,
        warped,
        M,
        dsize,
        cv.INTER_LINEAR,
        cv.BORDER_CONSTANT,
        new cv.Scalar(),
      );

      // 4) 白黒最適化（FAXっぽく）
      const bw = new cv.Mat();
      // adaptiveThreshold: 255, ADAPTIVE_MEAN or GAUSSIAN
      // blockSize は奇数、C は微調整
      cv.adaptiveThreshold(
        warped,
        bw,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        31,
        10,
      );

      // 5) outCanvasへ描画
      outCanvas.width = dstW;
      outCanvas.height = dstH;
      cv.imshow(outCanvas, bw);

      // cleanup mats
      bw.delete();
      warped.delete();
      M.delete();
      srcTri.delete();
      dstTri.delete();
      bestQuad.delete();
      gray.delete();
      src.delete();

      // 6) PDF化 → File
      const ymd = new Date();
      const stamp =
        `${ymd.getFullYear()}` +
        `${String(ymd.getMonth() + 1).padStart(2, "0")}` +
        `${String(ymd.getDate()).padStart(2, "0")}` +
        `_` +
        `${String(ymd.getHours()).padStart(2, "0")}` +
        `${String(ymd.getMinutes()).padStart(2, "0")}`;

      const outName = `${filenameBase}_${stamp}.pdf`;
      const file = await canvasToPdfFile(outCanvas, outName);

      // スキャン成功したら、カメラ止めてもOK（好み）
      await stopCamera();

      onDone?.(file);
    } catch (e) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid rgba(15, 23, 42, 0.12)",
        borderRadius: 14,
        padding: 14,
        background: "rgba(255,255,255,0.8)",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6 }}>スキャンして置く</div>
      <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 12 }}>
        紙を撮影 → 自動で台形補正 → 白黒最適化 → PDFにして「置く」に渡します
      </div>

      {!camOn ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={startCamera}
            disabled={busy || !opencvReady}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(15, 23, 42, 0.18)",
              background: "white",
              fontWeight: 800,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            📷 カメラを起動
          </button>

          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(15, 23, 42, 0.12)",
              background: "transparent",
              fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            キャンセル
          </button>

          <div style={{ fontSize: 12, opacity: 0.7, alignSelf: "center" }}>
            OpenCV: {opencvReady ? "ready" : "loading..."}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 10 }}>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{
                width: "100%",
                borderRadius: 14,
                background: "#0b1220",
              }}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={captureAndProcess}
                disabled={busy}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(15, 23, 42, 0.18)",
                  background: "white",
                  fontWeight: 800,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {busy ? "処理中..." : "📄 撮ってPDF化"}
              </button>

              <button
                onClick={stopCamera}
                disabled={busy}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(15, 23, 42, 0.12)",
                  background: "transparent",
                  fontWeight: 700,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                カメラ停止
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                プレビュー（補正後の白黒）
              </div>
              <canvas
                ref={outCanvasRef}
                style={{
                  width: "100%",
                  borderRadius: 14,
                  border: "1px dashed rgba(15, 23, 42, 0.18)",
                  background: "white",
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* hidden raw canvas */}
      <canvas ref={rawCanvasRef} style={{ display: "none" }} />

      {err ? (
        <div style={{ marginTop: 10, fontSize: 13, color: "#b91c1c" }}>
          {err}
        </div>
      ) : null}

      {!canUseMedia ? (
        <div style={{ marginTop: 10, fontSize: 13, color: "#b45309" }}>
          この環境ではカメラが利用できません（getUserMedia非対応）。
        </div>
      ) : null}
    </div>
  );
}
