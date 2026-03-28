// CardListPanel.jsx
// 選択中レーンの書類カード一覧（340px 固定幅 / fullWidth=true で 100% 幅）
// 変更点: fullWidth prop 追加（モバイル時に 100% 幅で表示するため）

import { useState, useMemo } from "react";
import { DP } from "./receiveConstants";
import DocCard from "./DocCard";

export default function CardListPanel({
  docs,
  activeLane,
  nameOf,
  iconOf,
  selectedDoc,
  onSelect,
  isExpired,
  fullWidth = false,
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return docs;
    return docs.filter(d => {
      const from  = nameOf(d.from_hospital_id).toLowerCase();
      const cmt   = (d.comment || "").toLowerCase();
      const fname = (d.original_filename || "").toLowerCase();
      return from.includes(query) || cmt.includes(query) || fname.includes(query);
    });
  }, [docs, q, nameOf]);

  const laneLabel =
    activeLane === "new"  ? "新着書類" :
    activeLane === "done" ? "完了"     :
    activeLane;

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
            {laneLabel}
          </span>
          <span style={{ fontSize: 13, color: DP.textSub, fontWeight: 600 }}>
            {filtered.length}件
          </span>
        </div>
        {/* 検索 */}
        <div style={{ position: "relative" }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
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
            position: "absolute",
            left: 8,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 12,
            opacity: 0.4,
            pointerEvents: "none",
          }}>
            🔍
          </span>
        </div>
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
            padding: "32px 0",
            textAlign: "center",
            color: DP.textSub,
            fontSize: 13,
          }}>
            書類がありません
          </div>
        ) : (
          filtered.map(doc => (
            <DocCard
              key={doc.id}
              doc={doc}
              nameOf={nameOf}
              iconOf={iconOf}
              selected={selectedDoc?.id === doc.id}
              onClick={() => onSelect(doc)}
              isExpired={isExpired}
            />
          ))
        )}
      </div>
    </div>
  );
}
