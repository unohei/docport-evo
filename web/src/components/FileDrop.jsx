import React, { useMemo, useState, useId } from "react";
import { THEME, Card, Pill } from "./ui/primitives";

export default function FileDrop({
  onFile,
  accept = "application/pdf",
  disabled = false,
  title = "ここに置く",
  hint = "ドラッグ & タップで選択",
}) {
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState("");
  const inputId = useId();

  const accent = "#0ea5e9"; // sky (統一色)
  const accentText = "#0369a1";

  const pickFirst = (files) => (files && files.length ? files[0] : null);

  const validate = (file) => {
    if (!file) return null;
    const isPdf =
      file.type === "application/pdf" ||
      (file.name || "").toLowerCase().endsWith(".pdf");
    if (!isPdf) return "PDFのみアップロードできます";
    return null;
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
        glow: "none",
        slot: "rgba(148, 163, 184, 0.55)",
      };
    }
    if (dragOver) {
      return {
        rimBorder: "rgba(14, 165, 233, 0.55)",
        rimBg: "rgba(255,255,255,0.78)",
        wellBg:
          "linear-gradient(180deg, rgba(224,242,254,0.75), rgba(240,249,255,0.75))",
        text: THEME.text,
        glow: "0 18px 38px rgba(14,165,233,0.26)",
        slot: "rgba(14,165,233,0.85)",
      };
    }
    return {
      rimBorder: "rgba(15,23,42,0.10)",
      rimBg: "rgba(255,255,255,0.75)",
      wellBg:
        "linear-gradient(180deg, rgba(255,255,255,0.65), rgba(242,247,251,0.75))",
      text: THEME.text,
      glow: "0 12px 26px rgba(15,23,42,0.08)",
      slot: "rgba(2,132,199,0.55)",
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
          borderRadius: 24,
          padding: 12, // 外側リム用
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

          // リムの厚み（上から見た“縁”）
          // ほんのり立体に
          filter: disabled ? "grayscale(0.05)" : "none",
        }}
      >
        {/* 上面のライト */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 24,
            pointerEvents: "none",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0))",
            opacity: 0.7,
          }}
        />

        {/* リム内側の影（縁の立体感） */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 24,
            pointerEvents: "none",
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.85), inset 0 -10px 18px rgba(15,23,42,0.06)",
          }}
        />

        {/* ここから“受け皿（凹み）” */}
        <div
          style={{
            position: "relative",
            borderRadius: 18,
            minHeight: 240,
            padding: "62px 20px 28px",
            background: tone.wellBg,
            border: `1px solid ${dragOver ? "rgba(14,165,233,0.30)" : "rgba(15,23,42,0.08)"}`,
            boxShadow: dragOver
              ? "inset 0 14px 26px rgba(14,165,233,0.10), inset 0 -10px 16px rgba(255,255,255,0.85)"
              : "inset 0 14px 26px rgba(15,23,42,0.10), inset 0 -10px 16px rgba(255,255,255,0.85)",
            transition:
              "box-shadow 180ms ease, border-color 180ms ease, transform 180ms ease",
            transform: disabled
              ? "none"
              : dragOver
                ? "translateY(1px)"
                : "none",
            overflow: "hidden",
          }}
        >
          {/* subtle pattern（トレイの材質感：うっすら） */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: 0.25,
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(2,132,199,0.18) 1px, transparent 0)",
              backgroundSize: "22px 22px",
              maskImage:
                "linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0.1))",
            }}
          />

          {/* 差し込み口（スリット） */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 18,
              left: "50%",
              transform: "translateX(-50%)",
              width: 160,
              height: 10,
              borderRadius: 999,
              background: "rgba(15,23,42,0.10)",
              boxShadow: "inset 0 3px 6px rgba(15,23,42,0.20)",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              width: 156,
              height: 6,
              borderRadius: 999,
              background: tone.slot,
              boxShadow: dragOver
                ? "0 0 0 4px rgba(14,165,233,0.10), 0 10px 18px rgba(14,165,233,0.20)"
                : "0 10px 18px rgba(2,132,199,0.10)",
              transition: "box-shadow 180ms ease, background 180ms ease",
            }}
          />

          {/* ドラッグ時の“吸い込み”オーラ */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: dragOver
                ? "radial-gradient(circle at 50% 35%, rgba(14,165,233,0.18), rgba(14,165,233,0.00) 55%)"
                : "radial-gradient(circle at 50% 35%, rgba(2,132,199,0.08), rgba(2,132,199,0.00) 55%)",
              opacity: disabled ? 0.2 : 1,
              transition: "background 180ms ease",
            }}
          />

          {/* 中身 */}
          <div
            style={{
              display: "grid",
              gap: 14,
              textAlign: "center",
              justifyItems: "center",
              position: "relative",
              zIndex: 1,
            }}
          >
            {/* 紙アイコン（吸い込み表現） */}
            <div
              style={{
                fontSize: 56,
                transition:
                  "transform 180ms ease, filter 180ms ease, opacity 180ms ease",
                transform: disabled
                  ? "none"
                  : dragOver
                    ? "translateY(-10px) scale(1.03)"
                    : "translateY(0) scale(1)",
                filter: dragOver
                  ? "drop-shadow(0 10px 16px rgba(2,132,199,0.18))"
                  : "none",
                opacity: disabled ? 0.75 : 1,
              }}
            >
              📄
            </div>

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

            <div style={{ fontSize: 14, opacity: 0.7, color: tone.text }}>
              {hint}
            </div>

            {/* <Pill
              tone={{
                bg: "rgba(14,165,233,0.12)",
                text: accentText,
                border: "rgba(14,165,233,0.35)",
              }}
              style={{
                boxShadow: dragOver
                  ? "0 10px 18px rgba(14,165,233,0.16)"
                  : "0 8px 16px rgba(15,23,42,0.06)",
                transform: dragOver ? "translateY(-1px)" : "none",
                transition: "box-shadow 180ms ease, transform 180ms ease",
              }}
            >
              送信ではなく「置く」です
            </Pill> */}

            {err ? (
              <div style={{ fontSize: 13, color: "#991b1b", fontWeight: 800 }}>
                {err}
              </div>
            ) : null}

            {/* 補助テキスト（ドラッグ中だけ） */}
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
