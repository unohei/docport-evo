// ConversationCard.jsx
// 「1つのやりとり（連携）」を1枚で表現するカード
// 表示情報: 相手病院 / 最新ステータス / 最終更新 / 件数 / 返信有無

import { DP, elapsed, docStatusLabel, docStatusColor } from "../receive/receiveConstants";
import HospitalAvatar from "../common/HospitalAvatar";

export default function ConversationCard({
  group,
  nameOf,
  iconOf,
  selected,
  onClick,
  isExpired,
}) {
  const { peerHospitalId, latestDoc, sentCount, recvCount, hasReply } = group;
  const peerName = nameOf(peerHospitalId);

  const sc = latestDoc
    ? docStatusColor(latestDoc, isExpired)
    : { text: DP.textSub, bg: "rgba(15,23,42,0.06)" };
  const sl = latestDoc ? docStatusLabel(latestDoc, isExpired) : "-";

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
        // 往復ありの連携は左辺にブランドアクセントライン
        ...(hasReply && !selected && { borderLeft: `3px solid ${DP.blue}` }),
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
      {/* Row1: 相手病院アイコン + 名前 + 返信バッジ */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", minWidth: 0 }}>
          <HospitalAvatar
            name={peerName}
            iconUrl={iconOf ? iconOf(peerHospitalId) : ""}
            size={22}
          />
          <span style={{
            fontSize: 15, fontWeight: 800, color: DP.navy,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {peerName}
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

      {/* Row2: 最新書類名（ファイル名 or 書類種別） */}
      <div style={{
        fontSize: 13, color: DP.text, opacity: 0.78,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {latestDoc?.original_filename || latestDoc?.document_type || "書類"}
      </div>

      {/* Row3: ステータスバッジ + 件数バッジ + 経過時間 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {/* 最新書類のステータス */}
          <span style={{
            fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
            color: sc.text, background: sc.bg,
          }}>
            {sl}
          </span>
          {/* 送受信件数バッジ */}
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
            color: DP.textSub, background: "rgba(15,23,42,0.06)",
          }}>
            {recvCount > 0 && `受${recvCount}`}
            {recvCount > 0 && sentCount > 0 && "·"}
            {sentCount > 0 && `送${sentCount}`}
          </span>
        </div>
        <span style={{ fontSize: 12, color: DP.textSub }}>
          {elapsed(latestDoc?.created_at)}
        </span>
      </div>
    </button>
  );
}
