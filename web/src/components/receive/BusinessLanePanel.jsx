// BusinessLanePanel.jsx
// 業務レーン（港）: 新着書類 / 部署別 / 完了 の切替パネル（220px 固定幅）

import { useMemo } from "react";
import { DP, DEPARTMENTS } from "./receiveConstants";

function LaneItem({ label, count, active, urgent, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "9px 12px",
        borderRadius: 9,
        border: `1px solid ${active ? DP.borderActive : "transparent"}`,
        background: active ? DP.skyLight : "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        transition: "all 140ms ease",
      }}
    >
      <span style={{
        fontSize: 13,
        fontWeight: active ? 800 : 600,
        color: active ? DP.blue : DP.text,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {label}
      </span>
      {count > 0 && (
        <span style={{
          flexShrink: 0,
          padding: "1px 8px",
          borderRadius: 999,
          background: urgent
            ? "rgba(239,68,68,0.12)"
            : active
              ? "rgba(21,101,192,0.14)"
              : "rgba(15,23,42,0.07)",
          color: urgent ? "#991B1B" : active ? DP.blue : DP.textSub,
          fontSize: 11,
          fontWeight: 800,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      padding: "10px 12px 4px",
      fontSize: 10,
      fontWeight: 800,
      color: DP.textSub,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
    }}>
      {children}
    </div>
  );
}

export default function BusinessLanePanel({
  docs,
  activeLane,
  onLaneChange,
  myHospitalName,
}) {
  const newCount  = docs.filter(d => !d.owner_user_id && d.status === "UPLOADED").length;
  const doneCount = docs.filter(d => d.status === "ARCHIVED").length;

  const deptCounts = useMemo(() => {
    const counts = {};
    docs.forEach(d => {
      if (d.assigned_department && d.status !== "ARCHIVED") {
        counts[d.assigned_department] = (counts[d.assigned_department] || 0) + 1;
      }
    });
    return counts;
  }, [docs]);

  return (
    <div style={{
      width: 220,
      flexShrink: 0,
      background: DP.surface,
      borderRight: `1px solid ${DP.border}`,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* ヘッダー */}
      <div style={{
        padding: "16px 14px 12px",
        borderBottom: `1px solid ${DP.border}`,
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 800,
          color: DP.textSub,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>
          受信ポート
        </div>
        {myHospitalName && (
          <div style={{
            fontSize: 13,
            fontWeight: 800,
            color: DP.navy,
            marginTop: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {myHospitalName}
          </div>
        )}
      </div>

      {/* レーン一覧 */}
      <div style={{ flex: 1, overflow: "auto", padding: "8px 8px" }}>
        <LaneItem
          label="新着書類"
          count={newCount}
          active={activeLane === "new"}
          urgent={newCount > 0}
          onClick={() => onLaneChange("new")}
        />

        <SectionLabel>部署レーン</SectionLabel>

        {DEPARTMENTS.map(dept => (
          <LaneItem
            key={dept}
            label={dept}
            count={deptCounts[dept] || 0}
            active={activeLane === dept}
            onClick={() => onLaneChange(dept)}
          />
        ))}

        <button style={{
          width: "100%",
          marginTop: 4,
          padding: "8px 12px",
          borderRadius: 9,
          border: `1px dashed ${DP.border}`,
          background: "transparent",
          color: DP.textSub,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          textAlign: "left",
        }}>
          ＋ 部署を追加
        </button>

        <SectionLabel>完了済み</SectionLabel>

        <LaneItem
          label="完了"
          count={doneCount}
          active={activeLane === "done"}
          onClick={() => onLaneChange("done")}
        />
      </div>
    </div>
  );
}
