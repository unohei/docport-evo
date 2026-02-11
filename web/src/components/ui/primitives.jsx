import React from "react";

/* ===== Theme ===== */
export const THEME = {
  bg: "#F5F8FC",
  topbar: "rgba(245,248,252,0.9)",
  text: "#0F172A",
  primary: "#0F172A", // 深いブルー（基準色）
  border: "rgba(15,23,42,0.15)",
};

/* === DocPort Accent Blue（UI統一用） === */
const ACCENT = {
  bg: "rgba(15, 23, 42, 0.08)",
  activeBg: "rgba(15, 23, 42, 0.12)",
  activeBorder: "rgba(15, 23, 42, 0.25)",
  activeText: "#0F172A",
  activeRing: "rgba(15, 23, 42, 0.18)",
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

/* ===== Card ===== */
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

/* ===== Buttons ===== */

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
        transition: "all 160ms ease",
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
        transition: "all 160ms ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ===== SidebarButton（アップグレード版） ===== */

export function SidebarButton({ children, active, badge, style, ...props }) {
  const ACTIVE_BG = "rgba(37, 99, 235, 0.12)"; // 青の薄背景
  const ACTIVE_BORDER = "rgba(37, 99, 235, 0.4)";
  const ACTIVE_TEXT = "#2563EB"; // メインブルー
  const ACTIVE_RING = "rgba(37, 99, 235, 0.18)";

  return (
    <button
      {...props}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "10px 12px",
        borderRadius: 14,
        border: `1px solid ${active ? ACTIVE_BORDER : THEME.border}`,
        background: active ? ACTIVE_BG : "#fff",
        color: active ? ACTIVE_TEXT : THEME.text,
        cursor: "pointer",
        fontWeight: 800,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
        boxShadow: active ? `0 0 0 3px ${ACTIVE_RING}` : "none",
        transition: "all 180ms ease",
        ...style,
      }}
    >
      <span
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
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
            background: active ? "#2563EB" : "rgba(15,23,42,0.08)",
            color: active ? "#fff" : THEME.text,
            whiteSpace: "nowrap",
            transition: "all 160ms ease",
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
