import React from "react";

/* ===== Theme ===== */
export const THEME = {
  bg: "#F5F8FC",
  topbar: "rgba(245,248,252,0.9)",
  text: "#0F172A",
  primary: "#0F172A",
  border: "rgba(15,23,42,0.15)",
};

const baseField = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${THEME.border}`,
  outline: "none",
  color: THEME.text,
  background: "#fff",
  boxSizing: "border-box", // ★はみ出し対策の本丸
  minWidth: 0,
};

export function Card({ children, style }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${THEME.border}`,
        borderRadius: 14,
        padding: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Pill：ステータスバッジ用に tone を渡せる
 * tone例: { bg:"#..", text:"#..", border:"#.." }
 */
export function Pill({ children, tone, style }) {
  const bg = tone?.bg ?? "rgba(255,255,255,0.8)";
  const text = tone?.text ?? THEME.text;
  const border = tone?.border ?? THEME.border;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: bg,
        color: text,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PrimaryButton({ children, style, ...props }) {
  return (
    <button
      {...props}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: `1px solid ${THEME.primary}`,
        background: THEME.primary,
        color: "#fff",
        cursor: "pointer",
        fontWeight: 800,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, style, ...props }) {
  return (
    <button
      {...props}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: `1px solid ${THEME.border}`,
        background: "#fff",
        color: THEME.text,
        cursor: "pointer",
        fontWeight: 800,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function SidebarButton({ children, active, badge, style, ...props }) {
  return (
    <button
      {...props}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${THEME.border}`,
        background: active ? THEME.primary : "#fff",
        color: active ? "#fff" : THEME.text,
        cursor: "pointer",
        fontWeight: 800,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
        ...style,
      }}
    >
      <span
        style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
      >
        {children}
      </span>
      {badge ? (
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            padding: "2px 8px",
            borderRadius: 999,
            background: active
              ? "rgba(255,255,255,0.22)"
              : "rgba(15,23,42,0.08)",
            whiteSpace: "nowrap",
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function StepChip({ n, label }) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 8,
        alignItems: "center",
        border: `1px solid ${THEME.border}`,
        borderRadius: 999,
        padding: "6px 10px",
        background: "rgba(255,255,255,0.7)",
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: THEME.primary,
          color: "#fff",
          fontSize: 12,
        }}
      >
        {n}
      </span>
      <span style={{ opacity: 0.85 }}>{label}</span>
    </div>
  );
}

/* ===== Input系 ===== */
export function TextInput({ style, ...props }) {
  return <input {...props} style={{ ...baseField, ...style }} />;
}

export function TextArea({ style, ...props }) {
  return (
    <textarea
      {...props}
      style={{ ...baseField, resize: "vertical", display: "block", ...style }}
    />
  );
}

export function Select({ style, children, ...props }) {
  return (
    <select {...props} style={{ ...baseField, ...style }}>
      {children}
    </select>
  );
}
