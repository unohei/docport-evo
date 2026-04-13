import React from "react";

/* ===== Theme ===== */
// UI改善: ロゴカラー基準に統一（メインネイビー#1F3A6D、アクセントブルー#4A90E2）
export const THEME = {
  bg: "#F5F9FF",                     // 旧 #F5F8FC - ブランドブルー寄りに
  topbar: "rgba(245,249,255,0.9)",   // 旧 rgba(245,248,252,0.9)
  text: "#0F172A",

  // ロゴアクセントブルーに統一（旧 sky-500 #0ea5e9）
  primary: "#4A90E2",
  primaryText: "#1F3A6D",            // ロゴメインネイビー（旧 #0369a1）
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
  boxSizing: "border-box",
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

/* ===== Pill ===== */
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

/* ===== PrimaryButton ===== */
export function PrimaryButton({ children, style, ...props }) {
  return (
    <button
      {...props}
      style={{
        padding: "10px 16px",
        borderRadius: 12,
        border: `1px solid rgba(74,144,226,0.55)`,
        background: "linear-gradient(135deg, #4A90E2 0%, #2A65C0 100%)",
        color: "#fff",
        cursor: "pointer",
        fontWeight: 900,
        boxShadow: "0 8px 20px rgba(74,144,226,0.28)",
        transition: "all 160ms ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ===== SecondaryButton ===== */
export function SecondaryButton({ children, style, ...props }) {
  return (
    <button
      {...props}
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        border: `1px solid ${THEME.border}`,
        background: "#fff",
        color: THEME.text,
        cursor: "pointer",
        fontWeight: 800,
        transition: "all 160ms ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ===== SidebarButton（SendTabと完全統一） ===== */
export function SidebarButton({ children, active, badge, style, ...props }) {
  const accentBg = "rgba(74,144,226,0.11)";
  const accentBorder = "rgba(74,144,226,0.42)";
  const accentText = "#1F3A6D";

  return (
    <button
      {...props}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        borderRadius: 14,
        border: `1px solid ${active ? accentBorder : THEME.border}`,
        background: active ? accentBg : "#fff",
        color: active ? accentText : THEME.text,
        cursor: "pointer",
        fontWeight: 900,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
        boxShadow: active
          ? "0 10px 24px rgba(74,144,226,0.18)"
          : "0 2px 8px rgba(15,23,42,0.06)",
        transition:
          "background 140ms ease, border-color 140ms ease, box-shadow 140ms ease, color 140ms ease",
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
            background: active ? "rgba(74,144,226,0.75)" : "rgba(15,23,42,0.08)",
            color: active ? "#fff" : THEME.text,
            whiteSpace: "nowrap",
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/* ===== StepChip ===== */
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
