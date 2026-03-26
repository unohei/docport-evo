// ScanCapture.jsx（改善版 v7）
// 変更点（v7）:
// 1. イベントリスナー（loadedmetadata/canplay/playing/error）を srcObject より前に登録（取りこぼし防止）
// 2. video を先に visible にしてから srcObject をセット（Chrome は hidden video の stream 処理を遅延させる）
// 3. canplay を 4 秒以内に待ってから play() を呼ぶ（readyState=0 で play() するとハングするため）
// 4. play() に 5 秒タイムアウトを追加（resolve/reject しないケースの保護）

import { useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { loadOpenCV } from "../utils/loadOpenCV";

export default function ScanCapture({
  onDone,
  onCancel,
  filenameBase = "scan",
  preferRearCamera = true,
  autoStart = false,
}) {
  const videoRef         = useRef(null);
  const rawCanvasRef     = useRef(null);
  const outCanvasRef     = useRef(null);
  const overlayRef       = useRef(null);
  const streamRef        = useRef(null);
  const fallbackInputRef = useRef(null);

  const rafRef              = useRef(null);
  const lastGuideAtRef      = useRef(0);
  const lastQuadNormRef     = useRef(null);
  const didAutoStartRef     = useRef(false);
  const perfRef             = useRef({});
  const opencvLoadStartedRef = useRef(false); // OpenCV ロードを一度だけ起動するガード
  const cameraStartingRef   = useRef(false);  // stale closure を避けるための ref ガード

  const [camOn,          setCamOn]          = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false); // getUserMedia 呼び出し中
  const [busy,           setBusy]           = useState(false);
  const [err,            setErr]            = useState("");
  const [opencvReady,    setOpenCvReady]    = useState(false);
  const [opencvLoading,  setOpenCvLoading]  = useState(false);
  const [showFallback,   setShowFallback]   = useState(false);

  const [stage,          setStage]          = useState("idle"); // idle | camera | processing | preview
  const [pendingName,    setPendingName]    = useState("");
  const [previewUrl,     setPreviewUrl]     = useState("");
  const [submitting,     setSubmitting]     = useState(false);

  const [devices,        setDevices]        = useState([]);
  const [deviceId,       setDeviceId]       = useState("");

  const SKY_TEXT = "#0369a1";
  const DEEP     = "#0F172A";

  const isIOS = /iPad|iPhone|iPod/.test(
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  );
  const canUseMedia =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  // ---- OpenCV レイジーロード（初回カメラ/ファイル選択時のみ起動）----
  const ensureOpenCV = () => {
    if (opencvLoadStartedRef.current) return;
    opencvLoadStartedRef.current = true;
    setOpenCvLoading(true);
    loadOpenCV()
      .then(() => {
        setOpenCvReady(true);
        setOpenCvLoading(false);
      })
      .catch((e) => {
        setOpenCvLoading(false);
        console.warn("[DocPort] OpenCV load failed:", e?.message);
      });
  };

  // ---- autoStart: マウント直後にカメラを起動 ----
  useEffect(() => {
    if (!autoStart || !canUseMedia || didAutoStartRef.current) return;
    didAutoStartRef.current = true;
    startCamera();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cv = useMemo(
    () => (typeof window !== "undefined" ? window.cv : null),
    [opencvReady]
  );

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- エラー名 → ユーザーフレンドリーメッセージ ----
  function friendlyError(e) {
    const name = e?.name ?? "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return isIOS
        ? "カメラへのアクセスが拒否されました。「設定 → Safari → カメラ」を「許可」に変更してください。"
        : "カメラへのアクセスが拒否されました。ブラウザのアドレスバー付近でカメラを許可してください。";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "カメラが見つかりません。デバイスにカメラが接続されているか確認してください。";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "カメラを起動できません。他のアプリがカメラを使用中の可能性があります。";
    }
    if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
      return "指定のカメラ設定が対応していません。設定を変えて再試行します…";
    }
    if (name === "TypeError") {
      return "カメラの使用にはHTTPS接続が必要です。";
    }
    if (name === "TimeoutError") {
      return e?.message ?? "カメラの起動がタイムアウトしました。再試行してください。";
    }
    return e?.message ?? String(e);
  }

  // ---- デバイス列挙 ----
  const refreshDevices = async () => {
    try {
      if (!navigator?.mediaDevices?.enumerateDevices) return [];
      const list = await navigator.mediaDevices.enumerateDevices();
      const vids = list.filter((d) => d.kind === "videoinput");
      setDevices(vids);
      return vids;
    } catch {
      return [];
    }
  };

  // ---- ガイドループ制御 ----
  const stopGuideLoop = () => {
    try {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    } catch { /* ignore */ }
  };

  // ---- ストリームだけ停止（stage は変えない）----
  const stopStreamOnly = () => {
    stopGuideLoop();
    const s = streamRef.current;
    if (s) s.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
    setCamOn(false);
  };

  const stopCamera = async (opts = {}) => {
    const { preserveStage = false } = opts;
    try {
      stopStreamOnly();
      if (!preserveStage) setStage("idle");
    } catch { /* ignore */ }
  };

  const startGuideLoop = () => {
    stopGuideLoop();
    lastGuideAtRef.current = 0;

    const tick = (t) => {
      rafRef.current = requestAnimationFrame(tick);
      const THROTTLE = 200;
      if (!opencvReady || !cv) return;
      if (t - lastGuideAtRef.current < THROTTLE) {
        drawGuide();
        return;
      }
      lastGuideAtRef.current = t;
      detectQuadForGuide();
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // ---- カメラ起動（state-flip 修正版）----
  const startCamera = async (opts = {}) => {
    const { forceDeviceId, retryWithoutFacingMode = false } = opts;

    // 二重起動ガード（refで判定：stale closure を避けるため）
    if (cameraStartingRef.current) return;

    cameraStartingRef.current = true;
    setErr("");
    setShowFallback(false);
    setCameraStarting(true);

    if (!canUseMedia) {
      cameraStartingRef.current = false;
      setErr("このブラウザではカメラが使えません。");
      setShowFallback(true);
      setCameraStarting(false);
      return;
    }

    // OpenCV をバックグラウンドで読み込み開始（カメラ起動をブロックしない）
    ensureOpenCV();

    // 前のストリームを stage を変えずに停止
    stopStreamOnly();
    await sleep(0);

    const t0 = performance.now();

    try {
      const videoConstraint = (() => {
        if (forceDeviceId || deviceId) {
          return { deviceId: { exact: forceDeviceId || deviceId } };
        }
        if (retryWithoutFacingMode) return true;
        return preferRearCamera
          ? { facingMode: { ideal: "environment" } }
          : { facingMode: { ideal: "user" } };
      })();

      // 10秒タイムアウト：許可ダイアログ放置による無限ハングを防止
      const CAMERA_TIMEOUT_MS = 10000;
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraint }),
        new Promise((_, reject) =>
          setTimeout(() => {
            const e = new Error("カメラの起動がタイムアウトしました。再試行してください。");
            e.name = "TimeoutError";
            reject(e);
          }, CAMERA_TIMEOUT_MS)
        ),
      ]);
      console.log("[Scan] getUserMedia success, stream.active:", stream.active);
      streamRef.current = stream;

      const v = videoRef.current;
      console.log("[Scan] videoRef.current exists:", !!v);
      if (!v) throw new Error("video 要素が見つかりません（描画タイミング）");

      // ── イベントリスナーを srcObject より前にすべて登録（取りこぼし防止）──
      // canplay 待機用 Promise（waiter 登録を最初に）
      const canplayWaiter = new Promise(r => v.addEventListener("canplay", r, { once: true }));

      v.addEventListener("loadedmetadata", () => {
        console.log("[Scan] loadedmetadata fired — videoWidth:", v.videoWidth, "videoHeight:", v.videoHeight);
      }, { once: true });
      v.addEventListener("canplay",  () => console.log("[Scan] canplay fired"),  { once: true });
      v.addEventListener("playing",  () => console.log("[Scan] playing fired"),  { once: true });
      v.addEventListener("error",    () => console.warn("[Scan] video error —", v.error?.message, v.error?.code), { once: true });

      // ── Chrome は display:none の video の MediaStream 処理を遅延させるため
      //    先に video を visible にしてから srcObject をセットする ──
      setStage("camera");
      setCamOn(true);
      cameraStartingRef.current = false;
      setCameraStarting(false);
      await sleep(0);  // React DOM commit（この時点で video は display:block）

      v.srcObject = stream;
      console.log("[Scan] srcObject assigned");

      // canplay を待つ（最大 4 秒）— readyState が上がってから play() を呼ぶ
      await Promise.race([
        canplayWaiter,
        sleep(4000).then(() => console.warn("[Scan] canplay timeout (4s)")),
      ]);

      // play() に 5 秒タイムアウト（resolve/reject しないハング対策）
      console.log("[Scan] play start");
      try {
        await Promise.race([
          v.play(),
          new Promise((_, rej) =>
            setTimeout(() =>
              rej(Object.assign(new Error("play timeout"), { name: "PlayTimeoutError" })), 5000)
          ),
        ]);
        console.log("[Scan] play resolved — videoWidth:", v.videoWidth, "videoHeight:", v.videoHeight);
        console.log("[Scan] current preview mode: video");
      } catch (playErr) {
        console.warn("[Scan] play rejected:", playErr?.name, playErr?.message);
        if (playErr?.name === "AbortError") {
          console.log("[Scan] AbortError ignored");
        } else if (playErr?.name === "PlayTimeoutError") {
          console.warn("[Scan] play timeout — video may still become active");
          // タイムアウトは致命的エラーではない：UI は表示済みなので処理継続
        } else {
          throw playErr;
        }
      }

      const elapsed = Math.round(performance.now() - t0);
      console.log(`[DocPort:Perf] Camera started in ${elapsed}ms`);
      perfRef.current.cameraStartMs = elapsed;

      startGuideLoop();

      const vids = (await refreshDevices()) || [];
      if (!forceDeviceId && !deviceId && vids.length >= 2 && preferRearCamera) {
        const rearLike =
          vids.find((d) => /back|rear|environment/i.test(d.label)) || null;
        if (rearLike?.deviceId) {
          setDeviceId(rearLike.deviceId);
          cameraStartingRef.current = false; // リトライ前にリセット
          stopStreamOnly();
          await sleep(0);
          return startCamera({ forceDeviceId: rearLike.deviceId });
        }
      }

      if (forceDeviceId) setDeviceId(forceDeviceId);
      else if (!deviceId && vids?.[0]?.deviceId) setDeviceId(vids[0].deviceId);

    } catch (e) {
      // OverconstrainedError: facingMode なしで自動リトライ
      if (
        (e?.name === "OverconstrainedError" || e?.name === "ConstraintNotSatisfiedError") &&
        !retryWithoutFacingMode
      ) {
        console.warn("[DocPort] OverconstrainedError → retry without facingMode");
        cameraStartingRef.current = false; // リトライ前にリセット（再帰呼び出しがガードを通れるよう）
        setCameraStarting(false);
        stopStreamOnly();
        return startCamera({ retryWithoutFacingMode: true });
      }

      const msg = friendlyError(e);
      console.warn(`[DocPort] Camera error (${e?.name}): ${msg}`);

      try {
        const prev = JSON.parse(sessionStorage.getItem("dp_cam_errors") || "[]");
        prev.push({ ts: Date.now(), name: e?.name, ios: isIOS });
        sessionStorage.setItem("dp_cam_errors", JSON.stringify(prev.slice(-10)));
      } catch { /* ignore */ }

      // 失敗時は必ず cameraStarting を false に戻す
      cameraStartingRef.current = false;
      setCameraStarting(false);
      setCamOn(false);
      setStage("idle");
      setErr(msg);
      // NotAllowed / NotFound のみ fallback へ（カメラボタンを隠す）
      // それ以外（Timeout, NotReadable, AbortError 等）はカメラボタンを残して再試行可能にする
      const isFatal =
        e?.name === "NotAllowedError" ||
        e?.name === "PermissionDeniedError" ||
        e?.name === "NotFoundError" ||
        e?.name === "DevicesNotFoundError";
      if (isFatal) setShowFallback(true);
      stopStreamOnly();
    }
  };

  // ---- コンソールデバッグ用 window 参照 ----
  useEffect(() => {
    window.__dpScan = {
      getVideo:  () => videoRef.current,
      getStream: () => streamRef.current,
    };
    return () => { delete window.__dpScan; };
  }, []);

  useEffect(() => {
    return () => {
      stopGuideLoop();
      stopStreamOnly();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- ガイド描画 ----
  const drawGrid = (ctx, w, h) => {
    const STEP = 56;
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(2, 132, 199, 0.45)";
    for (let x = 0; x <= w; x += STEP) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += STEP) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
    }
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w / 2, h / 2 - 22); ctx.lineTo(w / 2, h / 2 + 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2 - 22, h / 2); ctx.lineTo(w / 2 + 22, h / 2); ctx.stroke();
    ctx.restore();
  };

  const drawGuide = () => {
    const v = videoRef.current;
    const c = overlayRef.current;
    if (!v || !c) return;
    const rect = v.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(rect.width * dpr);
    const H = Math.round(rect.height * dpr);
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    drawGrid(ctx, W, H);
    const quad = lastQuadNormRef.current;
    if (!quad?.pts?.length) return;
    const pts = quad.pts;
    const ok  = !!quad.ok;
    ctx.save();
    ctx.globalAlpha = ok ? 0.9 : 0.55;
    ctx.lineWidth   = ok ? 4 : 3;
    ctx.strokeStyle = ok ? "rgba(16, 185, 129, 0.95)" : "rgba(14, 165, 233, 0.95)";
    ctx.fillStyle   = ok ? "rgba(16, 185, 129, 0.10)" : "rgba(14, 165, 233, 0.08)";
    ctx.beginPath();
    ctx.moveTo(pts[0].x * W, pts[0].y * H);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * W, pts[i].y * H);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = ok ? "rgba(16, 185, 129, 1)" : "rgba(14, 165, 233, 1)";
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, ok ? 6 : 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  // ---- 四隅検出（共通：Canny 2段階試行）----
  function detectQuad(gray, w, h, minAreaRatio = 0.08) {
    if (!cv) return null;

    const denoise = new cv.Mat();
    cv.bilateralFilter(gray, denoise, 7, 50, 50);

    for (const [lo, hi] of [[50, 150], [30, 100]]) {
      const edges = new cv.Mat();
      cv.Canny(denoise, edges, lo, hi);

      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
      cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
      kernel.delete();

      const contours  = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      edges.delete();
      hierarchy.delete();

      let bestQuad = null;
      let bestArea = 0;

      for (let i = 0; i < contours.size(); i++) {
        const cnt   = contours.get(i);
        const peri  = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

        if (approx.rows === 4) {
          const area   = cv.contourArea(approx);
          const convex = cv.isContourConvex(approx);
          if (convex && area >= w * h * minAreaRatio && area > bestArea) {
            bestArea = area;
            bestQuad?.delete?.();
            bestQuad = approx.clone();
          }
        }
        approx.delete();
        cnt.delete();
      }
      contours.delete();

      if (bestQuad) {
        denoise.delete();
        return bestQuad;
      }
    }

    denoise.delete();
    return null;
  }

  const detectQuadForGuide = () => {
    try {
      const video     = videoRef.current;
      const rawCanvas = rawCanvasRef.current;
      if (!video || !rawCanvas) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) { lastQuadNormRef.current = null; drawGuide(); return; }

      const MAX_W = 720;
      const scale = vw > MAX_W ? MAX_W / vw : 1;
      const cw = Math.round(vw * scale);
      const ch = Math.round(vh * scale);

      rawCanvas.width  = cw;
      rawCanvas.height = ch;
      rawCanvas.getContext("2d").drawImage(video, 0, 0, cw, ch);

      const srcRGBA = cv.imread(rawCanvas);
      const gray    = new cv.Mat();
      cv.cvtColor(srcRGBA, gray, cv.COLOR_RGBA2GRAY);
      srcRGBA.delete();

      const bestQuad = detectQuad(gray, cw, ch, 0.06);
      gray.delete();

      if (!bestQuad) { lastQuadNormRef.current = null; drawGuide(); return; }

      const pts = [];
      for (let r = 0; r < 4; r++) pts.push({ x: bestQuad.intAt(r, 0), y: bestQuad.intAt(r, 1) });
      bestQuad.delete();

      const [tl, tr, br, bl] = orderQuadPoints(pts);
      lastQuadNormRef.current = {
        pts: [tl, tr, br, bl].map((p) => ({ x: p.x / cw, y: p.y / ch })),
        ok:  true,
      };
      drawGuide();
    } catch {
      lastQuadNormRef.current = null;
      drawGuide();
    }
  };

  function orderQuadPoints(pts) {
    const sum  = pts.map((p) => p.x + p.y);
    const diff = pts.map((p) => p.x - p.y);
    const tl = pts[sum.indexOf(Math.min(...sum))];
    const br = pts[sum.indexOf(Math.max(...sum))];
    const tr = pts[diff.indexOf(Math.max(...diff))];
    const bl = pts[diff.indexOf(Math.min(...diff))];
    return [tl, tr, br, bl];
  }

  function dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  async function canvasToPdfFile(canvas, outName) {
    const dataUrl  = canvas.toDataURL("image/png");
    const pngBytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
    const pdf = await PDFDocument.create();
    const img = await pdf.embedPng(pngBytes);
    const page = pdf.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    const pdfBytes = await pdf.save();
    return new File([pdfBytes], outName, { type: "application/pdf" });
  }

  // ---- OpenCV コア処理: rawCanvas → outCanvas ----
  function processRawCanvas(rawCanvas, outCanvas) {
    const t0 = performance.now();
    const cw = rawCanvas.width;
    const ch = rawCanvas.height;

    const srcRGBA = cv.imread(rawCanvas);
    const gray    = new cv.Mat();
    cv.cvtColor(srcRGBA, gray, cv.COLOR_RGBA2GRAY);

    const bestQuad = detectQuad(gray, cw, ch, 0.08);
    gray.delete();

    let tl, tr, br, bl;
    let usedFallback = false;

    if (!bestQuad) {
      usedFallback = true;
      const inset = Math.round(Math.min(cw, ch) * 0.02);
      tl = { x: inset,        y: inset };
      tr = { x: cw - inset,   y: inset };
      br = { x: cw - inset,   y: ch - inset };
      bl = { x: inset,        y: ch - inset };
    } else {
      const pts = [];
      for (let r = 0; r < 4; r++) pts.push({ x: bestQuad.intAt(r, 0), y: bestQuad.intAt(r, 1) });
      bestQuad.delete();
      [tl, tr, br, bl] = orderQuadPoints(pts);
    }

    const widthA = dist(br, bl), widthB = dist(tr, tl);
    const maxW   = Math.max(widthA, widthB);
    const heightA = dist(tr, br), heightB = dist(tl, bl);
    const maxH   = Math.max(heightA, heightB);

    const dstW = Math.max(800, Math.round(maxW));
    const dstH = Math.round(maxW > 0 ? (maxH / maxW) * dstW : maxH);

    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, dstW - 1, 0, dstW - 1, dstH - 1, 0, dstH - 1]);

    const M      = cv.getPerspectiveTransform(srcTri, dstTri);
    const dsize  = new cv.Size(dstW, dstH);

    const warped = new cv.Mat();
    cv.warpPerspective(srcRGBA, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    const enhanced = new cv.Mat();
    warped.convertTo(enhanced, -1, 1.2, 10);

    outCanvas.width  = dstW;
    outCanvas.height = dstH;
    cv.imshow(outCanvas, enhanced);

    enhanced.delete();
    warped.delete();
    M.delete();
    srcTri.delete();
    dstTri.delete();
    srcRGBA.delete();

    const ms = Math.round(performance.now() - t0);
    console.log(`[DocPort:Perf] processRawCanvas: ${ms}ms (fallback=${usedFallback})`);
    perfRef.current.processMs = ms;

    return { usedFallback };
  }

  // ---- 撮影 → OpenCV処理 ----
  const captureAndProcess = async () => {
    setErr("");
    if (!camOn) return setErr("カメラが起動していません");

    // OpenCV がまだロード中なら待機（最大10秒）
    if (!opencvReady) {
      if (opencvLoading) {
        setErr("画像解析を準備中です。もう少し待ってから撮影してください。");
      } else {
        // ロードが開始されていなければここで開始
        ensureOpenCV();
        setErr("画像解析を準備中です。もう少し待ってから撮影してください。");
      }
      return;
    }
    if (!cv) return setErr("OpenCV が見つかりません");

    const video     = videoRef.current;
    const rawCanvas = rawCanvasRef.current;
    const outCanvas = outCanvasRef.current;
    if (!video || !rawCanvas || !outCanvas) return;

    setBusy(true);
    setStage("processing");
    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) {
        throw new Error("カメラ映像の準備ができていません。少し待ってから再試行してください。");
      }

      const MAX_W = 1400;
      const scale = vw > MAX_W ? MAX_W / vw : 1;
      const cw    = Math.round(vw * scale);
      const ch    = Math.round(vh * scale);

      rawCanvas.width  = cw;
      rawCanvas.height = ch;
      rawCanvas.getContext("2d").drawImage(video, 0, 0, cw, ch);

      const { usedFallback } = processRawCanvas(rawCanvas, outCanvas);

      if (usedFallback) {
        setErr("書類の四隅を自動検出できませんでした（全体を使用しています）。必要なら撮り直してください。");
      }

      const outName = buildFilename(filenameBase);
      setPendingName(outName);
      setPreviewUrl(outCanvas.toDataURL("image/jpeg", 0.92));
      setStage("preview");
      await stopCamera({ preserveStage: true });
    } catch (e) {
      setErr(e?.message ?? String(e));
      setStage(camOn ? "camera" : "idle");
    } finally {
      setBusy(false);
    }
  };

  // ---- iOS / フォールバック: file input から取り込み → OpenCV処理 ----
  const handleFallbackFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fallbackInputRef.current) fallbackInputRef.current.value = "";

    // OpenCV ロードをここで開始（まだなら）
    ensureOpenCV();

    if (!opencvReady || !cv) {
      setErr("画像解析を準備中です。しばらく待ってから再試行してください。");
      return;
    }

    setErr("");
    setBusy(true);
    setStage("processing");
    try {
      const rawCanvas = rawCanvasRef.current;
      const outCanvas = outCanvasRef.current;
      if (!rawCanvas || !outCanvas) throw new Error("canvas not found");

      const img = new Image();
      const url = URL.createObjectURL(file);
      img.src   = url;
      await new Promise((resolve, reject) => {
        img.onload  = resolve;
        img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      });
      URL.revokeObjectURL(url);

      rawCanvas.width  = img.naturalWidth;
      rawCanvas.height = img.naturalHeight;
      rawCanvas.getContext("2d").drawImage(img, 0, 0);

      const { usedFallback } = processRawCanvas(rawCanvas, outCanvas);
      if (usedFallback) {
        setErr("四隅を自動検出できませんでした（全体を使用しています）。");
      }

      const outName = buildFilename(filenameBase);
      setPendingName(outName);
      setPreviewUrl(outCanvas.toDataURL("image/jpeg", 0.92));
      setStage("preview");
    } catch (e) {
      setErr(e?.message ?? String(e));
      setStage("idle");
    } finally {
      setBusy(false);
    }
  };

  function buildFilename(base) {
    const d = new Date();
    const stamp =
      `${d.getFullYear()}` +
      `${String(d.getMonth() + 1).padStart(2, "0")}` +
      `${String(d.getDate()).padStart(2, "0")}_` +
      `${String(d.getHours()).padStart(2, "0")}` +
      `${String(d.getMinutes()).padStart(2, "0")}`;
    return `${base}_${stamp}.pdf`;
  }

  const confirmPlace = async () => {
    if (submitting) return;
    const outCanvas = outCanvasRef.current;
    if (!outCanvas || !pendingName) return;
    setSubmitting(true);
    setErr("");
    const t0 = performance.now();
    try {
      const file = await canvasToPdfFile(outCanvas, pendingName);
      const ms = Math.round(performance.now() - t0);
      console.log(`[DocPort:Perf] PDF created in ${ms}ms`);
      perfRef.current.pdfMs = ms;
      onDone?.(file);
    } catch (e) {
      setErr(e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const retake = async () => {
    setErr("");
    setPreviewUrl("");
    setPendingName("");
    lastQuadNormRef.current = null;
    setShowFallback(false);
    await startCamera();
  };

  const canSwitch = devices.length >= 2;

  const switchCamera = async () => {
    setErr("");
    if (!canSwitch) return;
    const idx  = devices.findIndex((d) => d.deviceId === deviceId);
    const next = devices[(idx + 1) % devices.length] || devices[0];
    if (!next?.deviceId) return;
    setDeviceId(next.deviceId);
    await startCamera({ forceDeviceId: next.deviceId });
  };

  // ---- 撮影ボタンのラベル ----
  const captureLabel = (() => {
    if (busy) return "処理中...";
    if (!opencvReady && opencvLoading) return "解析準備中…";
    return "📄 撮ってPDF化";
  })();

  // ---- Render ----
  return (
    <div style={{
      border: "1px solid rgba(15, 23, 42, 0.12)",
      borderRadius: 14,
      padding: 14,
      background: "rgba(255,255,255,0.8)",
    }}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>スキャンして置く</div>

      {/* カメラ映像 + ガイドオーバーレイ */}
      <div style={{ position: "relative" }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            /* autoPlay を除去：srcObject 先セット → 明示的 play() の順で確実に再生する */
            width: "100%",
            borderRadius: 14,
            background: "#0b1220",
            display: camOn && stage === "camera" ? "block" : "none",
          }}
        />
        <canvas
          ref={overlayRef}
          style={{
            position: "absolute",
            inset: 0,
            width:  camOn && stage === "camera" ? "100%" : 0,
            height: camOn && stage === "camera" ? "100%" : 0,
            borderRadius: 14,
            pointerEvents: "none",
            display: camOn && stage === "camera" ? "block" : "none",
          }}
        />
      </div>

      {/* ===== idle / cameraStarting: 起動ボタン + ファイル選択 ===== */}
      {!camOn && stage !== "preview" && (
        <div style={{ display: "grid", gap: 8, marginTop: 4 }}>

          {/* カメラ起動中スピナー */}
          {cameraStarting && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px", borderRadius: 12,
              background: "rgba(14,165,233,0.06)",
              border: "1px solid rgba(14,165,233,0.18)",
              fontSize: 13, fontWeight: 700, color: SKY_TEXT,
            }}>
              <span style={{
                display: "inline-block", width: 16, height: 16,
                border: "2.5px solid rgba(14,165,233,0.25)",
                borderTopColor: "rgba(14,165,233,0.9)",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
                flexShrink: 0,
              }} />
              カメラを起動中…
            </div>
          )}

          {/* カメラ起動ボタン（拒否後は非表示、起動中は disabled） */}
          {!showFallback && (
            <button
              onClick={() => startCamera()}
              disabled={cameraStarting || busy}
              style={{
                padding: "13px 16px",
                borderRadius: 14,
                border: "1px solid rgba(15, 23, 42, 0.16)",
                background: (cameraStarting || busy) ? "rgba(15,23,42,0.08)" : DEEP,
                color: (cameraStarting || busy) ? "rgba(15,23,42,0.45)" : "#fff",
                fontWeight: 900,
                letterSpacing: 0.2,
                cursor: (cameraStarting || busy) ? "not-allowed" : "pointer",
                boxShadow: (cameraStarting || busy) ? "none" : "0 10px 22px rgba(15,23,42,0.18)",
                width: "100%",
                fontSize: 14,
              }}
            >
              📷 カメラを起動
            </button>
          )}

          {/* ファイル選択（常時表示） */}
          <label style={{
            display: "block",
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(14,165,233,0.28)",
            background: "rgba(224,242,254,0.75)",
            color: SKY_TEXT,
            fontWeight: 800,
            cursor: busy ? "not-allowed" : "pointer",
            fontSize: 13,
            textAlign: "center",
          }}>
            {isIOS ? "📷 カメラで撮影 / 写真を選択" : "📁 画像ファイルを選択"}
            <input
              ref={fallbackInputRef}
              type="file"
              accept="image/*"
              capture={isIOS ? "environment" : undefined}
              onChange={handleFallbackFile}
              disabled={busy}
              style={{ display: "none" }}
            />
          </label>

          {/* キャンセル（cameraStarting 中でも押せる：stopCamera してから onCancel） */}
          <button
            onClick={() => { cameraStartingRef.current = false; setCameraStarting(false); stopCamera(); onCancel?.(); }}
            disabled={busy}
            style={{
              padding: "11px 16px",
              borderRadius: 14,
              border: "1px solid rgba(15, 23, 42, 0.12)",
              background: "rgba(255,255,255,0.75)",
              fontWeight: 800,
              cursor: busy ? "not-allowed" : "pointer",
              fontSize: 13,
            }}
          >
            キャンセル
          </button>

          {/* カメラ拒否時の説明（エラーメッセージより先に表示） */}
          {showFallback && !err && (
            <div style={{ fontSize: 12, color: "#b45309", lineHeight: 1.5 }}>
              カメラが使えないため、ファイル選択をご利用ください。
            </div>
          )}
        </div>
      )}

      {/* ===== camera: 撮影ボタン ===== */}
      {stage === "camera" && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
            <button
              onClick={captureAndProcess}
              disabled={busy || (!opencvReady && opencvLoading)}
              style={{
                padding: "14px 18px",
                borderRadius: 16,
                border: `1px solid ${(busy || (!opencvReady && opencvLoading)) ? "rgba(15,23,42,0.12)" : "rgba(14,165,233,0.45)"}`,
                background: (busy || (!opencvReady && opencvLoading)) ? "rgba(15,23,42,0.06)" : "rgba(224,242,254,0.85)",
                color: (busy || (!opencvReady && opencvLoading)) ? "rgba(15,23,42,0.55)" : SKY_TEXT,
                fontWeight: 950,
                fontSize: 15,
                letterSpacing: 0.25,
                cursor: (busy || (!opencvReady && opencvLoading)) ? "not-allowed" : "pointer",
                boxShadow: (busy || (!opencvReady && opencvLoading)) ? "none" : "0 14px 30px rgba(14,165,233,0.22)",
                minWidth: 220,
              }}
            >
              {captureLabel}
            </button>

            {canSwitch && (
              <button
                onClick={switchCamera}
                disabled={busy}
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${busy ? "rgba(15,23,42,0.10)" : "rgba(14,165,233,0.22)"}`,
                  background: busy ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.75)",
                  color: "rgba(15,23,42,0.85)",
                  fontWeight: 800,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                🔁 カメラ切替
              </button>
            )}

            <button
              onClick={stopCamera}
              disabled={busy}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                background: "rgba(255,255,255,0.75)",
                fontWeight: 800,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              カメラ停止
            </button>
          </div>

          {/* OpenCV ロード中の補助表示（カメラ起動後のみ） */}
          {opencvLoading && !opencvReady && (
            <div style={{ fontSize: 11, color: "#0369a1", marginTop: 6, opacity: 0.7 }}>
              画像解析を準備中…撮影ボタンはもうすぐ使えます
            </div>
          )}

          <canvas ref={outCanvasRef} style={{ display: "none" }} />
        </>
      )}

      {/* ===== preview: 確認 + 置く ===== */}
      {stage === "preview" && (
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>
            プレビュー（補正後・コントラスト強化済み）
          </div>

          {previewUrl ? (
            <img
              src={previewUrl}
              alt="scan preview"
              style={{
                width: "100%",
                borderRadius: 14,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                background: "white",
              }}
            />
          ) : (
            <div style={{
              padding: 14, borderRadius: 14,
              border: "1px dashed rgba(15, 23, 42, 0.18)",
              background: "rgba(255,255,255,0.7)",
              fontSize: 13, opacity: 0.75,
            }}>
              プレビュー画像を生成中...
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={confirmPlace}
              disabled={submitting}
              style={{
                padding: "14px 18px",
                borderRadius: 16,
                border: `1px solid ${submitting ? "rgba(15,23,42,0.12)" : "rgba(14,165,233,0.45)"}`,
                background: submitting ? "rgba(15,23,42,0.06)" : "rgba(224,242,254,0.85)",
                color: submitting ? "rgba(15,23,42,0.55)" : SKY_TEXT,
                fontWeight: 950,
                fontSize: 15,
                letterSpacing: 0.25,
                cursor: submitting ? "not-allowed" : "pointer",
                boxShadow: submitting ? "none" : "0 14px 30px rgba(14,165,233,0.22)",
                minWidth: 220,
              }}
            >
              {submitting ? "作成中..." : "✅ この内容で置く"}
            </button>

            <button
              onClick={retake}
              disabled={submitting}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                background: "rgba(255,255,255,0.75)",
                fontWeight: 800,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              🔄 撮り直す
            </button>

            <button
              onClick={() => {
                setPreviewUrl("");
                setPendingName("");
                setStage("idle");
                setShowFallback(false);
                onCancel?.();
              }}
              disabled={submitting}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                background: "transparent",
                fontWeight: 800,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* オフスクリーン canvas（解析・補正用） */}
      <canvas ref={rawCanvasRef} style={{ display: "none" }} />
      {stage !== "camera" && <canvas ref={outCanvasRef} style={{ display: "none" }} />}

      {/* エラーメッセージ */}
      {err && (
        <div style={{
          marginTop: 10,
          fontSize: 13,
          color: err.includes("自動検出") || err.includes("準備中") ? "#b45309" : "#b91c1c",
          lineHeight: 1.5,
        }}>
          {err}
        </div>
      )}

      {/* getUserMedia 非対応環境 */}
      {!canUseMedia && (
        <div style={{ marginTop: 10, fontSize: 13, color: "#b45309" }}>
          この環境ではリアルタイムカメラが利用できません（getUserMedia非対応）。
          ファイルから取り込んでください。
        </div>
      )}
    </div>
  );
}
