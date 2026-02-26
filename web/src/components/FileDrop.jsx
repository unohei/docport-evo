import React, { useMemo, useState, useId } from "react";
import { THEME, Card } from "./ui/primitives";

// 許可 MIME の簡易ラベル（エラー文言用）
const MIME_LABEL = {
  "application/pdf":                                                            "PDF",
  "image/png":                                                                  "PNG",
  "image/jpeg":                                                                 "JPEG",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":    "DOCX",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":          "XLSX",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":  "PPTX",
};

export default function FileDrop({
  onFile,
  // allowedTypes: 許可する MIME タイプの配列（省略時は PDF のみ）
  allowedTypes = ["application/pdf"],
  disabled = false,
  title = "ここに置く",
  hint = "ドラッグ & タップで選択",
}) {
  // <input accept> 属性文字列を allowedTypes から自動生成
  const accept = allowedTypes.join(",");

  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState("");
  const inputId = useId();

  const accent = "#0ea5e9"; // sky
  const accentText = "#0369a1";

  const pickFirst = (files) => (files && files.length ? files[0] : null);

  const validate = (file) => {
    if (!file) return null;
    if (allowedTypes.includes(file.type)) return null;
    // MIME が空（一部ブラウザ）の場合: 拡張子フォールバック
    const ext = (file.name || "").split(".").pop()?.toLowerCase();
    const extOk = allowedTypes.some((mt) => {
      const label = MIME_LABEL[mt]?.toLowerCase();
      return label && (ext === label || (mt === "image/jpeg" && ext === "jpeg"));
    });
    if (extOk) return null;
    const labels = allowedTypes.map((mt) => MIME_LABEL[mt] || mt).join(" / ");
    return `対応形式: ${labels}`;
  };

  const handleFile = (file) => {
    setErr("");
    const v = validate(file);
    if (v) return setErr(v);
    onFile?.(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setDragOver(false);
    const file = pickFirst(e.dataTransfer.files);
    handleFile(file);
  };

  const onBrowse = (e) => {
    const file = pickFirst(e.target.files);
    handleFile(file);
    e.target.value = "";
  };

  const tone = useMemo(() => {
    if (disabled) {
      return {
        rimBorder: "rgba(148, 163, 184, 0.35)",
        rimBg: "rgba(255,255,255,0.65)",
        wellBg: "rgba(148, 163, 184, 0.10)",
        text: "rgba(15,23,42,0.55)",
        glow: "0 10px 24px rgba(15,23,42,0.05)",
        slot: "rgba(148, 163, 184, 0.55)",
      };
    }
    if (dragOver) {
      return {
        rimBorder: "rgba(14, 165, 233, 0.55)",
        rimBg: "rgba(255,255,255,0.82)",
        wellBg:
          "linear-gradient(180deg, rgba(224,242,254,0.85), rgba(240,249,255,0.75))",
        text: THEME.text,
        glow: "0 22px 44px rgba(14,165,233,0.24)",
        slot: "rgba(14,165,233,0.90)",
      };
    }
    return {
      rimBorder: "rgba(15,23,42,0.10)",
      rimBg: "rgba(255,255,255,0.78)",
      wellBg:
        "linear-gradient(180deg, rgba(255,255,255,0.72), rgba(242,247,251,0.82))",
      text: THEME.text,
      glow: "0 14px 28px rgba(15,23,42,0.08)",
      slot: "rgba(2,132,199,0.60)",
    };
  }, [dragOver, disabled]);

  const openPicker = () => {
    if (disabled) return;
    document.getElementById(`docport-file-input-hidden-${inputId}`)?.click();
  };

  return (
    <Card style={{ padding: 0, border: "none", background: "transparent" }}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled ? "true" : "false"}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") openPicker();
        }}
        onClick={openPicker}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={onDrop}
        style={{
          position: "relative",
          borderRadius: 26,
          padding: 12,
          cursor: disabled ? "not-allowed" : "pointer",
          userSelect: "none",
          transition:
            "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, filter 180ms ease",
          transform: disabled
            ? "none"
            : dragOver
              ? "translateY(-1px) scale(1.005)"
              : "none",
          boxShadow: tone.glow,
          background: tone.rimBg,
          border: `1px solid ${tone.rimBorder}`,
          // ほんの少し“上から”感（やりすぎない）
          perspective: "900px",
        }}
      >
        {/* 上面ライト */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 26,
            pointerEvents: "none",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0))",
            opacity: 0.75,
          }}
        />

        {/* ====== 凹み（well） ====== */}
        <div
          style={{
            position: "relative",
            borderRadius: 18,
            minHeight: 250,
            padding: "66px 20px 34px",
            background: tone.wellBg,
            border: `1px solid ${dragOver ? "rgba(14,165,233,0.30)" : "rgba(15,23,42,0.08)"}`,
            boxShadow: dragOver
              ? "inset 0 18px 30px rgba(14,165,233,0.10), inset 0 -12px 18px rgba(255,255,255,0.88)"
              : "inset 0 18px 30px rgba(15,23,42,0.10), inset 0 -12px 18px rgba(255,255,255,0.88)",
            transition:
              "box-shadow 180ms ease, border-color 180ms ease, transform 180ms ease",
            transform: disabled
              ? "none"
              : dragOver
                ? "translateY(1px) rotateX(0.6deg)"
                : "rotateX(0.4deg)",
            overflow: "hidden",
          }}
        >
          {/* 左右の壁（箱感） */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: 22,
              background:
                "linear-gradient(90deg, rgba(15,23,42,0.10), rgba(15,23,42,0))",
              opacity: 0.55,
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 0,
              width: 22,
              background:
                "linear-gradient(270deg, rgba(15,23,42,0.10), rgba(15,23,42,0))",
              opacity: 0.55,
            }}
          />

          {/* 差し込み口 */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 18,
              left: "50%",
              transform: "translateX(-50%)",
              width: 172,
              height: 12,
              borderRadius: 999,
              background: "rgba(15,23,42,0.12)",
              boxShadow: "inset 0 3px 7px rgba(15,23,42,0.22)",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              width: 166,
              height: 7,
              borderRadius: 999,
              background: tone.slot,
              boxShadow: dragOver
                ? "0 0 0 4px rgba(14,165,233,0.10), 0 12px 18px rgba(14,165,233,0.18)"
                : "0 12px 18px rgba(2,132,199,0.10)",
              transition: "box-shadow 180ms ease, background 180ms ease",
            }}
          />

          {/* 中に刺さってる紙（箱っぽさの決定打） */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 34,
              left: "50%",
              transform: "translateX(-50%)",
              width: 280,
              height: 120,
              pointerEvents: "none",
              opacity: disabled ? 0.4 : 0.9,
            }}
          >
            {/* 3枚くらい重ねる */}
            {[
              { y: 18, s: 0.92, o: 0.45 },
              { y: 10, s: 0.96, o: 0.65 },
              { y: 0, s: 1.0, o: 0.9 },
            ].map((p, idx) => (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: p.y,
                  transform: `translateX(-50%) scale(${p.s})`,
                  width: 230,
                  height: 86,
                  borderRadius: 14,
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.70))",
                  border: "1px solid rgba(15,23,42,0.10)",
                  boxShadow: "0 10px 16px rgba(15,23,42,0.08)",
                  opacity: p.o,
                }}
              >
                {/* 紙の上の薄い線（文字っぽさ） */}
                <div
                  style={{
                    position: "absolute",
                    top: 16,
                    left: 18,
                    right: 18,
                    height: 6,
                    borderRadius: 6,
                    background: "rgba(15,23,42,0.10)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 30,
                    left: 18,
                    right: 60,
                    height: 6,
                    borderRadius: 6,
                    background: "rgba(15,23,42,0.08)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 44,
                    left: 18,
                    right: 90,
                    height: 6,
                    borderRadius: 6,
                    background: "rgba(15,23,42,0.07)",
                  }}
                />
              </div>
            ))}
          </div>

          {/* 手前のフチ（トレイ前面） */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 18,
              right: 18,
              bottom: 10,
              height: 56,
              borderRadius: 18,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.0), rgba(255,255,255,0.85))",
              boxShadow:
                "0 -10px 18px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.85)",
              opacity: 1,
              pointerEvents: "none",
            }}
          />
          {/* 手前フチの影（“箱の奥行き”） */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 34,
              right: 34,
              bottom: 44,
              height: 16,
              borderRadius: 999,
              background: "rgba(15,23,42,0.08)",
              filter: "blur(0.2px)",
              opacity: 0.85,
              pointerEvents: "none",
            }}
          />

          {/* 吸い込みオーラ */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: dragOver
                ? "radial-gradient(circle at 50% 45%, rgba(14,165,233,0.18), rgba(14,165,233,0.00) 60%)"
                : "radial-gradient(circle at 50% 45%, rgba(2,132,199,0.08), rgba(2,132,199,0.00) 60%)",
              opacity: disabled ? 0.2 : 1,
              transition: "background 180ms ease",
            }}
          />

          {/* 中身（テキスト） */}
          <div
            style={{
              display: "grid",
              gap: 12,
              textAlign: "center",
              justifyItems: "center",
              position: "relative",
              zIndex: 2,
              marginTop: 84, // 紙の表現ぶん下げる
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: tone.text,
                letterSpacing: 0.4,
              }}
            >
              {title}
            </div>

            <div style={{ fontSize: 14, opacity: 0.72, color: tone.text }}>
              {hint}
            </div>

            {!disabled && dragOver ? (
              <div
                style={{
                  marginTop: 2,
                  fontSize: 12,
                  fontWeight: 900,
                  color: accentText,
                  opacity: 0.95,
                }}
              >
                そのまま離して “置く”
              </div>
            ) : null}

            {err ? (
              <div style={{ fontSize: 13, color: "#991b1b", fontWeight: 800 }}>
                {err}
              </div>
            ) : null}
          </div>

          {/* hidden input */}
          <input
            id={`docport-file-input-hidden-${inputId}`}
            type="file"
            accept={accept}
            onChange={onBrowse}
            disabled={disabled}
            style={{ display: "none" }}
          />
        </div>
      </div>
    </Card>
  );
}
