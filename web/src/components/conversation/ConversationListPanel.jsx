// ConversationListPanel.jsx
// やりとりグループの一覧パネル
//
// 変更点 (v3):
// - 部署フィルタータブを追加（新着 / 各部署 / 完了 / ＋）
// - 部署タブは横スクロール対応（overflow-x: auto）
// - deptFilter state によるグループ絞り込み

import { useState, useMemo } from "react";
import { DP } from "../receive/receiveConstants";
import { GROUPING_MODES } from "../../hooks/useConversationGroups";
import ConversationCard from "./ConversationCard";

// 部署フィルタータブの特殊キー
const TAB_ALL      = "";
const TAB_COMPLETE = "__complete__";

export default function ConversationListPanel({
  groups,
  nameOf,
  iconOf,
  selectedGroup,
  onSelect,
  isExpired,
  fullWidth = false,
  searchQuery,
  groupingMode = GROUPING_MODES.HOSPITAL,
  onGroupingModeChange,
  // 部署タブ用
  departments = [],
  addDepartment,
}) {
  const [internalQ,   setInternalQ]   = useState("");
  const [deptFilter,  setDeptFilter]  = useState(TAB_ALL);
  // 部署追加インライン
  const [addingDept,  setAddingDept]  = useState(false);
  const [newDeptName, setNewDeptName] = useState("");

  const isControlled = searchQuery !== undefined;
  const q = isControlled ? searchQuery : internalQ;

  // 検索フィルタ
  const searchFiltered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter(g => {
      const fname = (g.latestDoc?.original_filename || "").toLowerCase();
      if (g.patientLabel) return g.patientLabel.toLowerCase().includes(query) || fname.includes(query);
      const name = nameOf(g.peerHospitalId).toLowerCase();
      return name.includes(query) || fname.includes(query);
    });
  }, [groups, q, nameOf]);

  // 部署フィルタ
  const filtered = useMemo(() => {
    if (deptFilter === TAB_ALL) return searchFiltered;
    if (deptFilter === TAB_COMPLETE) {
      return searchFiltered.filter(g => g.currentStatus?.level === "complete");
    }
    // 指定部署に未完了書類があるグループのみ
    return searchFiltered.filter(g =>
      g.docs.some(d =>
        d.assigned_department === deptFilter &&
        d.status !== "ARCHIVED" &&
        d.status !== "CANCELLED",
      )
    );
  }, [searchFiltered, deptFilter]);

  const isPatientMode = groupingMode === GROUPING_MODES.PATIENT;

  // 部署追加ハンドラ
  const handleAddDept = () => {
    const name = newDeptName.trim();
    if (name && addDepartment) {
      addDepartment(name);
      setNewDeptName("");
      setAddingDept(false);
    }
  };

  // タブ定義: 新着 + 各部署 + 完了
  const tabs = [
    { key: TAB_ALL,      label: "新着" },
    ...(departments || []).map(d => ({ key: d.name, label: d.name })),
    { key: TAB_COMPLETE, label: "完了" },
  ];

  return (
    <div style={{
      width: fullWidth ? "100%" : 340,
      flexShrink: 0,
      background: "#F8FAFC",
      borderRight: `1px solid ${DP.border}`,
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* ヘッダー */}
      <div style={{
        padding: "14px 14px 10px", borderBottom: `1px solid ${DP.border}`,
        background: DP.white, flexShrink: 0,
      }}>
        {/* タイトル + 件数 */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 8,
        }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: DP.navy }}>
            {isPatientMode ? "患者別書類" : "書類一覧"}
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
                onClick={() => { onGroupingModeChange(mode); setDeptFilter(TAB_ALL); }}
                style={{
                  flex: 1, padding: "5px 0", fontSize: 11, fontWeight: 700,
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

        {/* 部署フィルタータブ（横スクロール） */}
        <div style={{
          display: "flex", gap: 8, overflowX: "auto",
          paddingBottom: 4, paddingRight: 8,
          marginBottom: isControlled ? 0 : 6,
          scrollbarWidth: "none", msOverflowStyle: "none",
        }}>
          {tabs.map(tab => {
            const active = deptFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setDeptFilter(tab.key)}
                style={{
                  padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                  whiteSpace: "nowrap", flexShrink: 0, cursor: "pointer",
                  border: `1px solid ${active ? DP.borderActive : DP.border}`,
                  background: active ? DP.skyLight : "transparent",
                  color: active ? DP.blue : DP.textSub,
                  transition: "all 120ms ease",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {tab.label}
              </button>
            );
          })}
          {/* ＋ 部署追加ボタン */}
          {addDepartment && (
            addingDept ? (
              <form
                onSubmit={e => { e.preventDefault(); handleAddDept(); }}
                style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}
              >
                <input
                  autoFocus
                  value={newDeptName}
                  onChange={e => setNewDeptName(e.target.value)}
                  placeholder="部署名"
                  style={{
                    minWidth: 120, padding: "3px 7px", borderRadius: 6, fontSize: 11,
                    border: `1px solid ${DP.borderActive}`, outline: "none",
                    color: DP.text, background: DP.white, flexShrink: 0,
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                    background: DP.blue, color: "#fff", border: "none", cursor: "pointer",
                  }}
                >
                  追加
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingDept(false); setNewDeptName(""); }}
                  style={{
                    padding: "3px 6px", borderRadius: 6, fontSize: 11,
                    background: "transparent", color: DP.textSub,
                    border: `1px solid ${DP.border}`, cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </form>
            ) : (
              <button
                onClick={() => setAddingDept(true)}
                style={{
                  padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                  whiteSpace: "nowrap", flexShrink: 0, cursor: "pointer",
                  border: `1px dashed ${DP.border}`, background: "transparent",
                  color: DP.textSub, transition: "all 120ms ease",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                ＋
              </button>
            )
          )}
        </div>

        {/* 内部検索（非制御モードのみ表示） */}
        {!isControlled && (
          <div style={{ position: "relative" }}>
            <input
              value={internalQ}
              onChange={e => setInternalQ(e.target.value)}
              placeholder={isPatientMode ? "患者名・書類名で検索" : "病院名・書類名で検索"}
              style={{
                width: "100%", padding: "7px 10px 7px 28px", borderRadius: 8,
                border: `1px solid ${DP.border}`, outline: "none", fontSize: 12,
                color: DP.text, background: "#F1F5F9", boxSizing: "border-box",
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
        flex: 1, overflow: "auto", padding: "8px 10px",
        display: "grid", gap: 6, alignContent: "start",
      }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: "32px 0", textAlign: "center", color: DP.textSub, fontSize: 13,
          }}>
            {isPatientMode ? "患者別の連携がありません" : "やりとりがありません"}
          </div>
        ) : (
          filtered.map(group => (
            <ConversationCard
              key={group.id}
              group={group} nameOf={nameOf} iconOf={iconOf}
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
