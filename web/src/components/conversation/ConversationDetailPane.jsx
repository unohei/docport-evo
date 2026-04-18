// ConversationDetailPane.jsx
// 選択されたグループの「連携履歴タイムライン」+ 既存 DetailPane の組み合わせ
//
// 変更点 (v4):
// - DetailPane に myHospitalId を渡す（送信書類のボタン非表示に対応）
// - buildTimelineEntries: assigned_to → assigned_department（正しいDBフィールド名）

import { useState } from "react";
import { DP, elapsed, docStatusLabel, docStatusColor, isDocSent, senderDisplay, senderCurrentLabel } from "../receive/receiveConstants";
import HospitalAvatar from "../common/HospitalAvatar";
import DetailPane from "../receive/DetailPane";

// ---- 現在地レベル別カラー ----
const STATUS_COLORS = {
  cancel:      { text: "#991B1B", bg: "rgba(239,68,68,0.12)"  },
  complete:    { text: "#047857", bg: "rgba(4,120,87,0.12)"   },
  in_progress: { text: "#B45309", bg: "rgba(180,83,9,0.12)"   },
  waiting:     { text: "#1D4ED8", bg: "rgba(29,78,216,0.10)"  },
  pending:     { text: DP.textSub, bg: "rgba(15,23,42,0.07)" },
};

// ---- アクションタイプ別カラー ----
const ACTION_COLORS = {
  assign:      { text: "#B45309", dot: "#D97706", bg: "rgba(180,83,9,0.07)"  },
  complete:    { text: "#047857", dot: "#059669", bg: "rgba(4,120,87,0.07)"  },
  in_progress: { text: "#B45309", dot: "#D97706", bg: "rgba(180,83,9,0.07)"  },
  cancel:      { text: "#991B1B", dot: "#EF4444", bg: "rgba(239,68,68,0.07)" },
};

// ---- タイムラインエントリ生成（表示専用・DB変更なし） ----
function buildTimelineEntries(docs, myHospitalId) {
  // 返信判定: 直前の1件のみを見て「直前が受信 → 現在が送信」の場合のみ返信
  // hasSeenIncoming フラグを持ち回らず、必ず prevDoc との1対1比較で判定する
  const chronological = [...docs].reverse(); // oldest first
  const replyDocIds   = new Set();
  for (let i = 0; i < chronological.length; i++) {
    const doc     = chronological[i];
    const prevDoc = i > 0 ? chronological[i - 1] : null;
    const isSent       = isDocSent(doc, myHospitalId);
    const prevReceived = prevDoc != null && prevDoc.to_hospital_id === myHospitalId;
    if (isSent && prevReceived) replyDocIds.add(doc.id);
  }

  const entries = [];
  for (const doc of docs) {
    const isSent  = isDocSent(doc, myHospitalId);
    const isReply = isSent && replyDocIds.has(doc.id);
    entries.push({ kind: "doc", doc, isSent, isReply });

    // アサイン擬似イベント（assigned_department が正しいフィールド名）
    if (doc.assigned_department) {
      entries.push({ kind: "action", subtype: "assign",
                     label: `アサイン：${doc.assigned_department}`, doc });
    }
    // ステータス派生イベント（排他的・最終状態のみ）
    if (doc.status === "ARCHIVED") {
      entries.push({ kind: "action", subtype: "complete", label: "完了", doc });
    } else if (doc.status === "IN_PROGRESS") {
      entries.push({ kind: "action", subtype: "in_progress", label: "対応中", doc });
    } else if (doc.status === "CANCELLED") {
      entries.push({ kind: "action", subtype: "cancel", label: "キャンセル", doc });
    }
  }
  return entries;
}

// ---- アクションエントリ（擬似イベント・選択不可） ----
function TimelineActionEntry({ entry }) {
  const c = ACTION_COLORS[entry.subtype] ?? { text: DP.textSub, dot: DP.border, bg: "transparent" };
  return (
    <div style={{
      padding: "5px 14px 5px 50px",
      display: "flex", alignItems: "center", gap: 7,
      borderBottom: `1px solid ${DP.border}`,
      background: c.bg,
    }}>
      <span style={{
        display: "inline-block", width: 7, height: 7, borderRadius: "50%",
        background: c.dot, flexShrink: 0,
      }} />
      <span style={{ fontSize: 11, color: c.text, fontWeight: 700 }}>
        {entry.label}
      </span>
    </div>
  );
}

// ---- 書類エントリ（選択可） ----
function TimelineDocEntry({ entry, nameOf, fmt, isExpired, selected, onClick }) {
  const { doc, isSent, isReply } = entry;
  const sc = docStatusColor(doc, isExpired);
  const sl = docStatusLabel(doc, isExpired);

  const icon     = isReply ? "↩" : (isSent ? "↑" : "↓");
  const iconBg   = isSent ? DP.blue : DP.navy;
  const dirLabel = isSent
    ? `${isReply ? "返信" : "置"} → ${nameOf(doc.to_hospital_id)}`
    : `受 ← ${senderDisplay(doc, nameOf)}`;

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", padding: "11px 14px",
        background: selected ? DP.skyLight : "transparent",
        border: "none", borderBottom: `1px solid ${DP.border}`,
        textAlign: "left", cursor: "pointer",
        display: "flex", gap: 10, alignItems: "flex-start",
        transition: "background 120ms ease", WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{
        width: 26, height: 26, borderRadius: "50%", background: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, color: "#fff", flexShrink: 0, marginTop: 1,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: DP.textSub, marginBottom: 1 }}>{dirLabel}</div>
        <div style={{ fontSize: 11, color: DP.textSub, marginBottom: 3, opacity: 0.75 }}>
          {fmt(doc.created_at)}
          <span style={{ marginLeft: 5, opacity: 0.7 }}>({elapsed(doc.created_at)})</span>
        </div>
        <div style={{
          fontSize: 13, fontWeight: selected ? 800 : 600, color: DP.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4,
        }}>
          {doc.original_filename || doc.document_type || "書類"}
          {doc.original_filename && doc.document_type && (
            <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.55, fontWeight: 400 }}>
              {doc.document_type}
            </span>
          )}
        </div>
        <span style={{
          display: "inline-block", fontSize: 11, fontWeight: 800,
          padding: "2px 7px", borderRadius: 999, color: sc.text, background: sc.bg,
        }}>
          {sl}
        </span>
      </div>
    </button>
  );
}

// ---- タイムライン列 ----
function Timeline({ group, myHospitalId, nameOf, fmt, isExpired, selectedDoc, onDocSelect }) {
  const entries = buildTimelineEntries(group.docs, myHospitalId);
  return (
    <div style={{
      width: 280, flexShrink: 0, borderRight: `1px solid ${DP.border}`,
      background: "#F8FAFC", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{
        padding: "8px 14px 7px", fontSize: 11, fontWeight: 800, color: DP.textSub,
        textTransform: "uppercase", letterSpacing: "0.06em",
        borderBottom: `1px solid ${DP.border}`, background: DP.white, flexShrink: 0,
      }}>
        書類履歴 · {group.totalCount}件
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {entries.map((entry) =>
          entry.kind === "action" ? (
            <TimelineActionEntry key={`action-${entry.doc.id}-${entry.subtype}`} entry={entry} />
          ) : (
            <TimelineDocEntry
              key={`doc-${entry.doc.id}`}
              entry={entry} nameOf={nameOf} fmt={fmt} isExpired={isExpired}
              selected={selectedDoc?.id === entry.doc.id}
              onClick={() => onDocSelect(selectedDoc?.id === entry.doc.id ? null : entry.doc)}
            />
          )
        )}
      </div>
    </div>
  );
}

// ---- グループヘッダー用ヘルパー ----
function groupMainLabel(group, nameOf) { return group.patientLabel ?? nameOf(group.peerHospitalId); }
function groupAvatarIcon(group, iconOf) {
  if (group.patientLabel) return "";
  return iconOf ? iconOf(group.peerHospitalId) : "";
}
function groupSubLabel(group, nameOf) {
  if (group.patientLabel && group.peerHospitalIds?.length) {
    return group.peerHospitalIds.map(id => nameOf(id)).filter(Boolean).join("・");
  }
  return null;
}

// ---- 現在地バッジ ----
// displayLabel: senderCurrentLabel() で生成した表示用ラベル（省略時は currentStatus.label）
function CurrentStatusBadge({ currentStatus, displayLabel }) {
  if (!currentStatus) return null;
  const c = STATUS_COLORS[currentStatus.level] ?? STATUS_COLORS.pending;
  return (
    <span style={{
      display: "inline-block", fontSize: 11, fontWeight: 700,
      padding: "2px 9px", borderRadius: 999,
      color: c.text, background: c.bg,
      marginLeft: 8, verticalAlign: "middle",
    }}>
      現在：{displayLabel ?? currentStatus.label}
    </span>
  );
}

// ---- メイン export ----
export default function ConversationDetailPane({
  group,
  myHospitalId,
  nameOf,
  iconOf,
  fmt,
  isExpired,
  onArchive,
  onAssign,
  hospitalMembers,
  myUserId,
  fetchPreviewUrl,
  fetchDownloadUrl,
  departments,
  isMobile = false,
}) {
  const [selectedDoc, setSelectedDoc] = useState(null);

  if (!group) {
    return (
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: DP.white, color: DP.textSub, gap: 12, minWidth: 0,
      }}>
        <span style={{ fontSize: 44, opacity: 0.35 }}>📋</span>
        <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>連携を選択してください</p>
      </div>
    );
  }

  const mainLabel  = groupMainLabel(group, nameOf);
  const avatarIcon = groupAvatarIcon(group, iconOf);
  const subLabel   = groupSubLabel(group, nameOf);

  // 送信側向け現在地ラベル（病院名＋部署名を組み合わせ）
  const peerHospitalName = group.peerAssignedHospitalId ? nameOf(group.peerAssignedHospitalId) : null;
  const currentDisplayLabel = senderCurrentLabel(group.currentStatus, group.peerAssignedDept, peerHospitalName);

  // DetailPane に渡す共通 props
  const detailPaneProps = {
    nameOf, iconOf, fmt,
    onArchive, onAssign,
    hospitalMembers, myUserId,
    fetchPreviewUrl, fetchDownloadUrl,
    departments,
    myHospitalId,  // ← 送受信判定のために渡す
  };

  // ---- モバイル ----
  if (isMobile) {
    if (selectedDoc) {
      return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{
            padding: "8px 14px", borderBottom: `1px solid ${DP.border}`,
            background: DP.surface, flexShrink: 0,
          }}>
            <button
              onClick={() => setSelectedDoc(null)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: DP.navy, fontSize: 14, fontWeight: 700,
                padding: "4px 0", display: "flex", alignItems: "center", gap: 6,
              }}
            >
              ← 書類履歴に戻る
            </button>
          </div>
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <DetailPane doc={selectedDoc} {...detailPaneProps} />
          </div>
        </div>
      );
    }

    const mobileEntries = buildTimelineEntries(group.docs, myHospitalId);
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        <div style={{
          padding: "12px 16px", flexShrink: 0, borderBottom: `1px solid ${DP.border}`,
          background: DP.surface, display: "flex", alignItems: "center", gap: 10,
        }}>
          <HospitalAvatar name={mainLabel} iconUrl={avatarIcon} size={26} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: DP.navy }}>{mainLabel}</span>
              <CurrentStatusBadge currentStatus={group.currentStatus} displayLabel={currentDisplayLabel} />
            </div>
            <div style={{ fontSize: 11, color: DP.textSub, marginTop: 2 }}>
              {subLabel && <span>{subLabel} · </span>}
              {group.totalCount}件
              {group.recvCount > 0 && ` · 受${group.recvCount}`}
              {group.sentCount > 0 && ` · 置${group.sentCount}`}
              {group.hasReply && " · 往復あり"}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {mobileEntries.map((entry) =>
            entry.kind === "action" ? (
              <TimelineActionEntry key={`action-${entry.doc.id}-${entry.subtype}`} entry={entry} />
            ) : (
              <TimelineDocEntry
                key={`doc-${entry.doc.id}`}
                entry={entry} nameOf={nameOf} fmt={fmt} isExpired={isExpired}
                selected={selectedDoc?.id === entry.doc.id}
                onClick={() => setSelectedDoc(entry.doc)}
              />
            )
          )}
        </div>
      </div>
    );
  }

  // ---- PC / タブレット ----
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
      <div style={{
        padding: "14px 20px", flexShrink: 0, borderBottom: `1px solid ${DP.border}`,
        background: DP.surface, display: "flex", alignItems: "center", gap: 12,
      }}>
        <HospitalAvatar name={mainLabel} iconUrl={avatarIcon} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: DP.navy }}>{mainLabel}</span>
            <CurrentStatusBadge currentStatus={group.currentStatus} />
          </div>
          <div style={{ fontSize: 12, color: DP.textSub, marginTop: 2 }}>
            {subLabel && <span>{subLabel} · </span>}
            {group.totalCount}件の書類
            {group.recvCount > 0 && ` · 受${group.recvCount}件`}
            {group.sentCount > 0 && ` · 置${group.sentCount}件`}
            {group.hasReply && " · 往復あり"}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <Timeline
          group={group} myHospitalId={myHospitalId}
          nameOf={nameOf} fmt={fmt} isExpired={isExpired}
          selectedDoc={selectedDoc} onDocSelect={setSelectedDoc}
        />
        <DetailPane doc={selectedDoc} {...detailPaneProps} />
      </div>
    </div>
  );
}
