// ConversationCard.jsx
// 「1つのやりとり（連携）」を1枚で表現するカード
//
// 変更点 (v3):
// - group.currentStatus を使って「現在地」を小さなラベルで表示

import { DP, elapsed, docStatusLabel, docStatusColor } from "../receive/receiveConstants";
import HospitalAvatar from "../common/HospitalAvatar";

// 現在地レベル別カラー（ConversationDetailPane と同一定義）
const STATUS_COLORS = {
  cancel:      { text: "#991B1B", bg: "rgba(239,68,68,0.12)"  },
  complete:    { text: "#047857", bg: "rgba(4,120,87,0.12)"   },
  in_progress: { text: "#B45309", bg: "rgba(180,83,9,0.12)"   },
  waiting:     { text: "#1D4ED8", bg: "rgba(29,78,216,0.10)"  },
  pending:     { text: DP.textSub, bg: "rgba(15,23,42,0.07)" },
};

export default function ConversationCard({
  group,
  nameOf,
  iconOf,
  selected,
  onClick,
  isExpired,
}) {
  const { latestDoc, sentCount, recvCount, hasReply,
          patientLabel, peerHospitalId, peerHospitalIds,
          faxDisplayName, currentStatus } = group;

  const isPatientMode = !!patientLabel;

  // FAXグループは faxDisplayName（FAX番号 or "外部FAX"）、それ以外は病院名
  const mainLabel  = isPatientMode ? patientLabel
    : (faxDisplayName ?? nameOf(peerHospitalId));
  const avatarIcon = isPatientMode || faxDisplayName ? ""
    : (iconOf ? iconOf(peerHospitalId) : "");

  const hospitalSubLabel = isPatientMode && peerHospitalIds?.length
    ? peerHospitalIds.map(id => nameOf(id)).filter(Boolean).join("・")
    : null;

  const sc = latestDoc
    ? docStatusColor(latestDoc, isExpired)
    : { text: DP.textSub, bg: "rgba(15,23,42,0.06)" };
  const sl = latestDoc ? docStatusLabel(latestDoc, isExpired) : "-";

  const stc = currentStatus ? (STATUS_COLORS[currentStatus.level] ?? STATUS_COLORS.pending) : null;

  return (
    <button
      onClick={onClick}
      className="dp-card-hover dp-card-in"
      style={{
        width: "100%",
        textAlign: "left",
        padding: "11px 13px",
        borderRadius: 10,
        border: `1px solid ${selected ? DP.borderActive : DP.border}`,
        ...(hasReply && !selected && { borderLeft: `3px solid ${DP.blue}` }),
        background: selected ? DP.skyLight : DP.white,
        cursor: "pointer",
        display: "grid",
        gap: 5,
        boxShadow: selected
          ? "0 0 0 2px rgba(74,144,226,0.18)"
          : "0 1px 3px rgba(0,0,0,0.05)",
        transition: "all 130ms ease",
      }}
    >
      {/* Row1: アバター + メインラベル + 往復バッジ */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", minWidth: 0 }}>
          <HospitalAvatar name={mainLabel} iconUrl={avatarIcon} size={22} />
          <span style={{
            fontSize: 15, fontWeight: 800, color: DP.navy,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {mainLabel}
          </span>
        </div>
        {hasReply && (
          <span style={{
            fontSize: 10, fontWeight: 800,
            padding: "2px 7px", borderRadius: 999, flexShrink: 0,
            border: `1px solid ${DP.borderActive}`,
            color: DP.blue, background: "rgba(74,144,226,0.09)",
          }}>
            往復あり
          </span>
        )}
      </div>

      {/* 現在地ラベル */}
      {stc && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            display: "inline-block",
            fontSize: 10, fontWeight: 700,
            padding: "1px 7px", borderRadius: 999,
            color: stc.text, background: stc.bg,
          }}>
            現在：{currentStatus.label}
          </span>
        </div>
      )}

      {/* 患者モード: 関連病院名サブ表示 */}
      {hospitalSubLabel && (
        <div style={{
          fontSize: 11, color: DP.textSub, opacity: 0.85,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {hospitalSubLabel}
        </div>
      )}

      {/* 最新書類名 */}
      <div style={{
        fontSize: 13, color: DP.text, opacity: 0.78,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {latestDoc?.original_filename || latestDoc?.document_type || "書類"}
      </div>

      {/* ステータスバッジ + 件数バッジ + 経過時間 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{
            fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
            color: sc.text, background: sc.bg,
          }}>
            {sl}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
            color: DP.textSub, background: "rgba(15,23,42,0.06)",
          }}>
            {recvCount > 0 && `受${recvCount}`}
            {recvCount > 0 && sentCount > 0 && "·"}
            {sentCount > 0 && `置${sentCount}`}
          </span>
        </div>
        <span style={{ fontSize: 12, color: DP.textSub }}>
          {elapsed(latestDoc?.created_at)}
        </span>
      </div>
    </button>
  );
}
