import React, { useMemo, useState } from "react";
import { THEME, Card, Pill } from "./ui/primitives";

export default function FileDrop({
  onFile, // (file: File) => void
  accept = "application/pdf",
  disabled = false,
  title = "PDFをここに置く",
  hint = "ドラッグ&ドロップ / クリックで選択",
}) {
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState("");

  const tone = useMemo(() => {
    if (disabled) {
      return {
        bg: "rgba(148, 163, 184, 0.15)",
        border: "rgba(148, 163, 184, 0.35)",
        text: "rgba(15,23,42,0.65)",
      };
    }
    if (dragOver) {
      return {
        bg: "rgba(15, 23, 42, 0.06)",
        border: "rgba(15, 23, 42, 0.35)",
        text: THEME.text,
      };
    }
    return {
      bg: "rgba(255,255,255,0.75)",
      border: THEME.border,
      text: THEME.text,
    };
  }, [dragOver, disabled]);

  const pickFirst = (files) => (files && files.length ? files[0] : null);

  const validate = (file) => {
    if (!file) return null;
    // type が空になる環境もあるので、拡張子も見る
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
    // 同じファイルを再選択できるように
    e.target.value = "";
  };

  return (
    <Card
      style={{
        padding: 16,
        borderStyle: "dashed",
        borderWidth: 2,
        borderColor: tone.border,
        background: tone.bg,
        transition: "120ms ease",
      }}
    >
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          if (disabled) return;
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (disabled) return;
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={onDrop}
        style={{
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: 18,
          borderRadius: 12,
          minHeight: 180,
          cursor: disabled ? "not-allowed" : "pointer",
          userSelect: "none",
        }}
        onClick={() => {
          if (disabled) return;
          const el = document.getElementById("docport-file-input-hidden");
          el?.click();
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: tone.text }}>
            {title}
          </div>
          <div style={{ fontSize: 13, opacity: 0.75, color: tone.text }}>
            {hint}
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <Pill
              tone={{
                bg: "rgba(15,23,42,0.06)",
                text: THEME.text,
                border: "rgba(15,23,42,0.18)",
              }}
            >
              送信ではなく「置く」です
            </Pill>
          </div>

          {err ? (
            <div style={{ fontSize: 12, color: "#991b1b", fontWeight: 800 }}>
              {err}
            </div>
          ) : null}
        </div>

        {/* hidden input */}
        <input
          id="docport-file-input-hidden"
          type="file"
          accept={accept}
          onChange={onBrowse}
          disabled={disabled}
          style={{ display: "none" }}
        />
      </div>
    </Card>
  );
}
