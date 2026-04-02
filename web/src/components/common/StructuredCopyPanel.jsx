// StructuredCopyPanel.jsx
// 構造化JSON の表示・コピー用共通パネル。
// DetailPane / SentDetailPane の両方から利用する。
//
// 機能:
// - タブ切り替え: 「カルテ貼り付け」(デフォルト) / 「JSON」
// - 各タブにコピーボタン
// - v1/v2 両対応（normalizeStructuredJson 経由）
// - structured_json が null の場合は何も表示しない

import { useState } from "react";
import { normalizeStructuredJson, toKarteText } from "../../utils/structuredFormat";

const TABS = [
  { id: "karte", label: "カルテ貼り付け" },
  { id: "json",  label: "JSON" },
];

export default function StructuredCopyPanel({ rawSj }) {
  const [tab, setTab]       = useState("karte");
  const [copied, setCopied] = useState(false);

  const sj = normalizeStructuredJson(rawSj);
  if (!sj) return null;

  const content = tab === "karte"
    ? toKarteText(sj)
    : JSON.stringify(sj, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div>
      {/* タブ行 + コピーボタン */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
      }}>
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: "3px 12px",
                borderRadius: 6,
                border: "1px solid",
                borderColor: tab === id ? "rgba(14,165,233,0.5)" : "rgba(15,23,42,0.10)",
                background:   tab === id ? "rgba(14,165,233,0.08)" : "transparent",
                color:        tab === id ? "#0369a1" : "#64748B",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={handleCopy}
          style={{
            padding: "3px 10px",
            borderRadius: 6,
            border: `1px solid ${copied ? "rgba(22,163,74,0.4)" : "rgba(15,23,42,0.10)"}`,
            background: copied ? "rgba(22,163,74,0.08)" : "transparent",
            color:      copied ? "#15803D" : "#64748B",
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {copied ? "コピー完了 ✓" : "コピー"}
        </button>
      </div>

      {/* テキスト表示エリア */}
      <div style={{
        background: "#F8FAFC",
        borderRadius: 10,
        padding: "12px 14px",
        border: "1px solid rgba(15,23,42,0.10)",
        fontSize: 13,
        color: "#0F172A",
        lineHeight: 1.8,
        maxHeight: 260,
        overflow: "auto",
        whiteSpace: "pre-wrap",
        fontFamily: "ui-monospace, 'Courier New', monospace",
      }}>
        {content}
      </div>
    </div>
  );
}
