// DocCard.jsx
// カード一覧の個々のカード

import { buildCardSummary } from "../../utils/cardSummary";
import { DP, elapsed, docStatusLabel, docStatusColor, senderDisplay } from "./receiveConstants";
import HospitalAvatar from "../common/HospitalAvatar";

export default function DocCard({ doc, nameOf, iconOf, selected, onClick, isExpired }) {
  const summary     = buildCardSummary(doc);
  const sc          = docStatusColor(doc, isExpired);
  const sl          = docStatusLabel(doc, isExpired);
  const isUnassigned = !doc.owner_user_id && doc.status !== "ARCHIVED";

  return (
    <button
      onClick={onClick}
      className="dp-card-hover"
      style={{
        width: "100%",
        textAlign: "left",
        padding: "11px 13px",
        borderRadius: 10,
        border: `1px solid ${selected ? DP.borderActive : DP.border}`,
        ...(isUnassigned && { borderLeft: "3px solid #EF4444" }),
        background: selected ? DP.skyLight : DP.white,
        cursor: "pointer",
        display: "grid",
        gap: 7,
        boxShadow: selected
          ? "0 0 0 2px rgba(74,144,226,0.18)"
          : "0 1px 3px rgba(0,0,0,0.05)",
        transition: "all 130ms ease",
      }}
    >
      {/* Row 1: 送信元病院名 + ソースバッジ + 書類種別バッジ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 11, color: DP.textSub, fontWeight: 600, marginBottom: 1 }}>送信元</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
            <HospitalAvatar
              name={senderDisplay(doc, nameOf)}
              iconUrl={doc.source === "fax" ? "" : (iconOf ? iconOf(doc.from_hospital_id) : "")}
              isFax={doc.source === "fax"}
              size={22}
            />
            <div style={{
              fontSize: 15,
              fontWeight: 800,
              color: DP.navy,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {senderDisplay(doc, nameOf)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          {doc.source === "fax" ? (
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 7px",
              borderRadius: 999,
              border: "1px solid #CBD5E1",
              color: "#64748B",
              background: "#F1F5F9",
            }}>
              FAX
            </span>
          ) : (
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 7px",
              borderRadius: 999,
              border: `1px solid ${DP.borderActive}`,
              color: DP.blue,
              background: "rgba(21,101,192,0.08)",
            }}>
              DocPort
            </span>
          )}
          {doc.document_type === "紹介状" && (
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 7px",
              borderRadius: 999,
              border: "1px solid rgba(22,163,74,0.35)",
              color: "#15803D",
              background: "rgba(22,163,74,0.09)",
            }}>
              紹介状
            </span>
          )}
        </div>
      </div>

      {/* Row 2: 書類種別 */}
      <div style={{
        fontSize: 14,
        color: DP.text,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        opacity: 0.82,
      }}>
        {summary.title}
        {summary.subtitle && (
          <span style={{ marginLeft: 6, opacity: 0.6, fontSize: 12 }}>
            {summary.subtitle}
          </span>
        )}
      </div>

      {/* Row 3: ステータス + 経過時間 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{
          fontSize: 12,
          fontWeight: 800,
          padding: "2px 8px",
          borderRadius: 999,
          color: sc.text,
          background: sc.bg,
        }}>
          {sl}
        </span>
        <span style={{ fontSize: 12, color: DP.textSub }}>
          {elapsed(doc.created_at)}
        </span>
      </div>

      {/* 未担当インジケーター */}
      {isUnassigned && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{
            width: 7, height: 7,
            borderRadius: 999,
            background: "#EF4444",
            display: "inline-block",
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 11, color: "#991B1B", fontWeight: 800 }}>
            未担当
          </span>
        </div>
      )}
    </button>
  );
}
