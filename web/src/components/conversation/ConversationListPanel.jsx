// ConversationListPanel.jsx
// やりとりグループの一覧パネル
//
// 変更点 (v2):
// - 病院単位 / 患者単位 トグル追加（groupingMode / onGroupingModeChange props）
// - 患者モード時の検索を patientLabel ベースに切替

import { useState, useMemo } from "react";
import { DP } from "../receive/receiveConstants";
import { GROUPING_MODES } from "../../hooks/useConversationGroups";
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
  // グルーピングモード切替
  groupingMode = GROUPING_MODES.HOSPITAL,
  onGroupingModeChange,
}) {
  const [internalQ, setInternalQ] = useState("");
  const isControlled = searchQuery !== undefined;
  const q = isControlled ? searchQuery : internalQ;

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter(g => {
      const fname = (g.latestDoc?.original_filename || "").toLowerCase();
      // 患者モード: patientLabel で検索
      if (g.patientLabel) {
        return g.patientLabel.toLowerCase().includes(query) || fname.includes(query);
      }
      // 病院モード: 病院名で検索
      const name = nameOf(g.peerHospitalId).toLowerCase();
      return name.includes(query) || fname.includes(query);
    });
  }, [groups, q, nameOf]);

  const isPatientMode = groupingMode === GROUPING_MODES.PATIENT;

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
            {isPatientMode ? "患者別連携" : "連携一覧"}
          </span>
          <span style={{ fontSize: 13, color: DP.textSub, fontWeight: 600 }}>
            {filtered.length}件
          </span>
        </div>

        {/* 病院単位 / 患者単位 切替トグル */}
        {onGroupingModeChange && (
          <div style={{ display: "flex", marginBottom: 8 }}>
            {[
              { mode: GROUPING_MODES.HOSPITAL, label: "病院単位" },
              { mode: GROUPING_MODES.PATIENT,  label: "患者単位" },
            ].map(({ mode, label }, i) => (
              <button
                key={mode}
                onClick={() => onGroupingModeChange(mode)}
                style={{
                  flex: 1,
                  padding: "5px 0",
                  fontSize: 11,
                  fontWeight: 700,
                  border: `1px solid ${DP.borderActive}`,
                  borderLeft: i > 0 ? "none" : `1px solid ${DP.borderActive}`,
                  background: groupingMode === mode ? DP.blue : "transparent",
                  color: groupingMode === mode ? "#fff" : DP.textSub,
                  cursor: "pointer",
                  borderRadius: i === 0 ? "6px 0 0 6px" : "0 6px 6px 0",
                  transition: "background 120ms ease, color 120ms ease",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* 検索: 制御外の場合のみ内部UIを表示 */}
        {!isControlled && (
          <div style={{ position: "relative" }}>
            <input
              value={internalQ}
              onChange={e => setInternalQ(e.target.value)}
              placeholder={isPatientMode ? "患者名・書類名で検索" : "病院名・書類名で検索"}
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
            {isPatientMode ? "患者別の連携がありません" : "やりとりがありません"}
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
