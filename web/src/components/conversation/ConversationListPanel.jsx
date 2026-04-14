// ConversationListPanel.jsx
// やりとりグループの一覧パネル
// CardListPanel と同様の searchQuery 制御パターンを踏襲

import { useState, useMemo } from "react";
import { DP } from "../receive/receiveConstants";
import ConversationCard from "./ConversationCard";

export default function ConversationListPanel({
  groups,
  nameOf,
  iconOf,
  selectedGroup,
  onSelect,
  isExpired,
  fullWidth = false,
  // searchQuery が渡された場合はトップバー側の値を使い、内部の検索UIを非表示にする
  searchQuery,
}) {
  const [internalQ, setInternalQ] = useState("");
  const isControlled = searchQuery !== undefined;
  const q = isControlled ? searchQuery : internalQ;

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter(g => {
      const name  = nameOf(g.peerHospitalId).toLowerCase();
      const fname = (g.latestDoc?.original_filename || "").toLowerCase();
      return name.includes(query) || fname.includes(query);
    });
  }, [groups, q, nameOf]);

  return (
    <div style={{
      width: fullWidth ? "100%" : 340,
      flexShrink: 0,
      background: "#F8FAFC",
      borderRight: `1px solid ${DP.border}`,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* ヘッダー */}
      <div style={{
        padding: "14px 14px 10px",
        borderBottom: `1px solid ${DP.border}`,
        background: DP.white,
        flexShrink: 0,
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: DP.navy }}>
            連携一覧
          </span>
          <span style={{ fontSize: 13, color: DP.textSub, fontWeight: 600 }}>
            {filtered.length}件
          </span>
        </div>
        {/* 検索: 制御外の場合のみ内部UIを表示 */}
        {!isControlled && (
          <div style={{ position: "relative" }}>
            <input
              value={internalQ}
              onChange={e => setInternalQ(e.target.value)}
              placeholder="病院名・書類名で検索"
              style={{
                width: "100%",
                padding: "7px 10px 7px 28px",
                borderRadius: 8,
                border: `1px solid ${DP.border}`,
                outline: "none",
                fontSize: 12,
                color: DP.text,
                background: "#F1F5F9",
                boxSizing: "border-box",
              }}
            />
            <span style={{
              position: "absolute", left: 8, top: "50%",
              transform: "translateY(-50%)", fontSize: 12, opacity: 0.4, pointerEvents: "none",
            }}>
              🔍
            </span>
          </div>
        )}
      </div>

      {/* カード一覧 */}
      <div style={{
        flex: 1,
        overflow: "auto",
        padding: "8px 10px",
        display: "grid",
        gap: 6,
        alignContent: "start",
      }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: "32px 0", textAlign: "center",
            color: DP.textSub, fontSize: 13,
          }}>
            やりとりがありません
          </div>
        ) : (
          filtered.map(group => (
            <ConversationCard
              key={group.id}
              group={group}
              nameOf={nameOf}
              iconOf={iconOf}
              selected={selectedGroup?.id === group.id}
              onClick={() => onSelect(group)}
              isExpired={isExpired}
            />
          ))
        )}
      </div>
    </div>
  );
}
