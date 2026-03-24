// BusinessLanePanel.jsx
// 業務レーン（港）: 新着書類 / 部署別 / 完了 の切替パネル（220px 固定幅）
// 変更点:
//  - 部署を dynamicDepartments（DBから取得）で管理。DEPARTMENTS定数はフォールバック用に残存
//  - ＋部署を追加モーダルを実装
//  - 3ブロック構成（受信ポート / 部署レーン / 完了）で視覚的に分離
//  - 「アーカイブ」文言を一切使用しない

import { useMemo, useState } from "react";
import { DP } from "./receiveConstants";

// ---- LaneItem ----
// variant: "inbox" | "dept" | "done"
function LaneItem({ label, count, active, urgent, variant = "dept", onClick }) {
  const isInbox = variant === "inbox";
  const isDone  = variant === "done";

  const bg = active
    ? DP.skyLight
    : isInbox
      ? "rgba(21,101,192,0.07)"
      : "transparent";

  const borderColor = active
    ? DP.borderActive
    : isInbox
      ? "rgba(21,101,192,0.18)"
      : "transparent";

  const labelColor  = active ? DP.blue : isDone ? DP.textSub : DP.text;
  const labelWeight = active ? 800 : isInbox ? 700 : 600;

  const badgeBg = urgent
    ? "rgba(239,68,68,0.12)"
    : isInbox
      ? "rgba(21,101,192,0.16)"
      : active
        ? "rgba(21,101,192,0.14)"
        : isDone
          ? "rgba(15,23,42,0.06)"
          : "rgba(15,23,42,0.07)";

  const badgeColor = urgent
    ? "#991B1B"
    : (isInbox || active)
      ? DP.blue
      : DP.textSub;

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "10px 12px",
        borderRadius: 9,
        border: `1px solid ${borderColor}`,
        background: bg,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        transition: "all 140ms ease",
      }}
    >
      <span style={{
        fontSize: 15,
        fontWeight: labelWeight,
        color: labelColor,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        opacity: isDone && !active ? 0.7 : 1,
      }}>
        {label}
      </span>
      {count > 0 && (
        <span style={{
          flexShrink: 0,
          padding: "2px 8px",
          borderRadius: 999,
          background: badgeBg,
          color: badgeColor,
          fontSize: 12,
          fontWeight: 800,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ---- BlockHeader ---- セクション見出し
function BlockHeader({ children }) {
  return (
    <div style={{
      padding: "8px 12px 4px",
      fontSize: 11,
      fontWeight: 800,
      color: DP.textSub,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
    }}>
      {children}
    </div>
  );
}

// ---- AddDeptModal ---- 部署追加モーダル
function AddDeptModal({ onAdd, onClose }) {
  const [name,       setName]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err,        setErr]        = useState("");

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setErr("部署名を入力してください");
    setSubmitting(true);
    setErr("");
    try {
      await onAdd(trimmed);
      onClose();
    } catch (e) {
      setErr(e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(14,42,92,0.30)",
        zIndex: 200,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div style={{
        width: "min(340px, 100%)",
        background: DP.white,
        borderRadius: 16,
        padding: 22,
        boxShadow: "0 24px 56px rgba(0,0,0,0.18)",
        display: "grid",
        gap: 14,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: DP.navy }}>部署を追加</div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 800, color: DP.text, display: "block", marginBottom: 6 }}>
            部署名
          </label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            placeholder="例：地域連携室"
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 9,
              border: `1px solid ${DP.border}`,
              fontSize: 14,
              color: DP.text,
              background: DP.white,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>

        {err && (
          <div style={{ fontSize: 12, color: "#B91C1C", fontWeight: 700 }}>{err}</div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 800,
              background: "transparent", color: DP.text, border: `1px solid ${DP.border}`,
              cursor: "pointer",
            }}
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 800,
              background: DP.blue, color: DP.white, border: "none",
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "追加中..." : "追加する"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- BusinessLanePanel ----
export default function BusinessLanePanel({
  docs,
  activeLane,
  onLaneChange,
  myHospitalName,
  departments = [],   // DB から取得した部署一覧 [{id, name, sort_order}]
  addDepartment,      // async (name: string) => void
}) {
  const [addDeptOpen, setAddDeptOpen] = useState(false);

  // 新着: UPLOADED (DocPort) または ARRIVED (FAX) で未担当
  const newCount  = docs.filter(d =>
    !d.owner_user_id && (d.status === "UPLOADED" || d.status === "ARRIVED")
  ).length;

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
          fontSize: 11,
          fontWeight: 800,
          color: DP.textSub,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>
          受信ポート
        </div>
        {myHospitalName && (
          <div style={{
            fontSize: 15,
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

      {/* レーン一覧（3ブロック構成） */}
      <div style={{ flex: 1, overflow: "auto", padding: "10px 8px 8px" }}>

        {/* ── Block 1: 新着書類 ── */}
        <div style={{
          marginBottom: 10,
          paddingBottom: 10,
          borderBottom: `1px solid ${DP.border}`,
        }}>
          <LaneItem
            label="新着書類"
            count={newCount}
            active={activeLane === "new"}
            urgent={newCount > 0}
            variant="inbox"
            onClick={() => onLaneChange("new")}
          />
        </div>

        {/* ── Block 2: 部署レーン ── */}
        <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${DP.border}` }}>
          <BlockHeader>部署レーン</BlockHeader>

          {departments.length === 0 ? (
            <div style={{
              padding: "6px 12px 4px",
              fontSize: 12,
              color: DP.textSub,
              opacity: 0.7,
            }}>
              部署がありません
            </div>
          ) : (
            departments.map(dept => (
              <LaneItem
                key={dept.id}
                label={dept.name}
                count={deptCounts[dept.name] || 0}
                active={activeLane === dept.name}
                onClick={() => onLaneChange(dept.name)}
              />
            ))
          )}

          <button
            onClick={() => setAddDeptOpen(true)}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "8px 12px",
              borderRadius: 9,
              border: `1px dashed ${DP.border}`,
              background: "transparent",
              color: DP.textSub,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              textAlign: "left",
              transition: "all 140ms ease",
            }}
          >
            ＋ 部署を追加
          </button>
        </div>

        {/* ── Block 3: 完了 ── */}
        <div>
          <BlockHeader>完了</BlockHeader>
          <LaneItem
            label="完了した書類"
            count={doneCount}
            active={activeLane === "done"}
            variant="done"
            onClick={() => onLaneChange("done")}
          />
        </div>
      </div>

      {addDeptOpen && (
        <AddDeptModal
          onAdd={addDepartment}
          onClose={() => setAddDeptOpen(false)}
        />
      )}
    </div>
  );
}
