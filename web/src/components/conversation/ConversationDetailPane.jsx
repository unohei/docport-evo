// ConversationDetailPane.jsx
// 選択されたグループの「連携履歴タイムライン」+ 既存 DetailPane の組み合わせ
//
// 変更点 (v2):
// - buildTimelineEntries() で書類イベント + 擬似アクションイベントを生成
// - アクションエントリ（アサイン・完了・キャンセル等）をインライン表示
// - 病院モード / 患者モード 両対応ヘッダー
//
// PC/タブレット: タイムライン(280px) + DetailPane(flex-1) の横2カラム
// モバイル: タイムライン全画面 → doc選択で DetailPane に切り替え

import { useState } from "react";
import { DP, elapsed, docStatusLabel, docStatusColor } from "../receive/receiveConstants";
import HospitalAvatar from "../common/HospitalAvatar";
import DetailPane from "../receive/DetailPane";

// ---- タイムラインエントリ生成（表示専用・DB変更なし） ----
// docs（created_at 降順）から kind="doc" + kind="action" のエントリ列を生成
function buildTimelineEntries(docs, myHospitalId) {
  const entries = [];
  for (const doc of docs) {
    const isSent = doc.from_hospital_id === myHospitalId;
    // 書類イベント（選択可）
    entries.push({ kind: "doc", doc, isSent });
    // アサイン擬似イベント
    if (doc.assigned_to) {
      entries.push({ kind: "action", subtype: "assign",
                     label: `アサイン：${doc.assigned_to}`, doc });
    }
    // ステータス派生イベント（排他的: 最終状態のみ表示）
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

// アクションタイプ別のカラー定義
const ACTION_COLORS = {
  assign:      { text: "#B45309", dot: "#D97706", bg: "rgba(180,83,9,0.07)"  },
  complete:    { text: "#047857", dot: "#059669", bg: "rgba(4,120,87,0.07)"  },
  in_progress: { text: "#B45309", dot: "#D97706", bg: "rgba(180,83,9,0.07)"  },
  cancel:      { text: "#991B1B", dot: "#EF4444", bg: "rgba(239,68,68,0.07)" },
};

// ---- アクションエントリ（擬似イベント表示用・選択不可） ----
function TimelineActionEntry({ entry }) {
  const c = ACTION_COLORS[entry.subtype] ?? { text: DP.textSub, dot: DP.border, bg: "transparent" };
  return (
    <div style={{
      padding: "5px 14px 5px 50px",
      display: "flex", alignItems: "center", gap: 7,
      borderBottom: `1px solid ${DP.border}`,
      background: c.bg,
    }}>
      {/* コネクタドット */}
      <span style={{
        display: "inline-block",
        width: 7, height: 7, borderRadius: "50%",
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
  const { doc, isSent } = entry;
  const sc = docStatusColor(doc, isExpired);
  const sl = docStatusLabel(doc, isExpired);

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "11px 14px",
        background: selected ? DP.skyLight : "transparent",
        border: "none",
        borderBottom: `1px solid ${DP.border}`,
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        transition: "background 120ms ease",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* 方向アイコン（送信: ↑ブルー / 受信: ↓ネイビー） */}
      <div style={{
        width: 26, height: 26, borderRadius: "50%",
        background: isSent ? DP.blue : DP.navy,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, color: "#fff",
        flexShrink: 0, marginTop: 1,
      }}>
        {isSent ? "↑" : "↓"}
      </div>

      {/* 内容 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 方向ラベル */}
        <div style={{ fontSize: 11, color: DP.textSub, marginBottom: 1 }}>
          {isSent
            ? `送信 → ${nameOf(doc.to_hospital_id)}`
            : `受信 ← ${nameOf(doc.from_hospital_id)}`}
        </div>
        {/* 絶対日時 + 経過時間 */}
        <div style={{ fontSize: 11, color: DP.textSub, marginBottom: 3, opacity: 0.75 }}>
          {fmt(doc.created_at)}
          <span style={{ marginLeft: 5, opacity: 0.7 }}>({elapsed(doc.created_at)})</span>
        </div>
        {/* 書類名 */}
        <div style={{
          fontSize: 13,
          fontWeight: selected ? 800 : 600,
          color: DP.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          marginBottom: 4,
        }}>
          {doc.original_filename || doc.document_type || "書類"}
          {doc.original_filename && doc.document_type && (
            <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.55, fontWeight: 400 }}>
              {doc.document_type}
            </span>
          )}
        </div>
        {/* ステータスバッジ */}
        <span style={{
          display: "inline-block",
          fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 999,
          color: sc.text, background: sc.bg,
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
      width: 280, flexShrink: 0,
      borderRight: `1px solid ${DP.border}`,
      background: "#F8FAFC",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* ヘッダー */}
      <div style={{
        padding: "8px 14px 7px",
        fontSize: 11, fontWeight: 800, color: DP.textSub,
        textTransform: "uppercase", letterSpacing: "0.06em",
        borderBottom: `1px solid ${DP.border}`,
        background: DP.white, flexShrink: 0,
      }}>
        連携履歴 · {group.totalCount}件
      </div>
      {/* エントリ一覧 */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {entries.map((entry, idx) =>
          entry.kind === "action" ? (
            <TimelineActionEntry key={`action-${entry.doc.id}-${entry.subtype}`} entry={entry} />
          ) : (
            <TimelineDocEntry
              key={`doc-${entry.doc.id}`}
              entry={entry}
              nameOf={nameOf}
              fmt={fmt}
              isExpired={isExpired}
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
function groupMainLabel(group, nameOf) {
  return group.patientLabel ?? nameOf(group.peerHospitalId);
}
function groupAvatarIcon(group, iconOf) {
  if (group.patientLabel) return "";  // 患者モード: アイコンなし（イニシャル表示）
  return iconOf ? iconOf(group.peerHospitalId) : "";
}
function groupSubLabel(group, nameOf) {
  if (group.patientLabel && group.peerHospitalIds?.length) {
    return group.peerHospitalIds.map(id => nameOf(id)).filter(Boolean).join("・");
  }
  return null;
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

  // グループ未選択
  if (!group) {
    return (
      <div style={{
        flex: 1,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: DP.white, color: DP.textSub, gap: 12, minWidth: 0,
      }}>
        <span style={{ fontSize: 44, opacity: 0.35 }}>📋</span>
        <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>連携を選択してください</p>
      </div>
    );
  }

  const mainLabel = groupMainLabel(group, nameOf);
  const avatarIcon = groupAvatarIcon(group, iconOf);
  const subLabel = groupSubLabel(group, nameOf);

  // ---- モバイル ----
  if (isMobile) {
    if (selectedDoc) {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          <div style={{
            padding: "8px 14px",
            borderBottom: `1px solid ${DP.border}`,
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
              ← 連携履歴に戻る
            </button>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <DetailPane
              doc={selectedDoc}
              nameOf={nameOf} iconOf={iconOf} fmt={fmt}
              onArchive={onArchive} onAssign={onAssign}
              hospitalMembers={hospitalMembers} myUserId={myUserId}
              fetchPreviewUrl={fetchPreviewUrl} fetchDownloadUrl={fetchDownloadUrl}
              departments={departments}
            />
          </div>
        </div>
      );
    }

    // タイムライン全画面（モバイル）
    const mobileEntries = buildTimelineEntries(group.docs, myHospitalId);
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* グループヘッダー */}
        <div style={{
          padding: "12px 16px", flexShrink: 0,
          borderBottom: `1px solid ${DP.border}`,
          background: DP.surface,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <HospitalAvatar name={mainLabel} iconUrl={avatarIcon} size={26} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: DP.navy }}>
              {mainLabel}
            </div>
            <div style={{ fontSize: 11, color: DP.textSub, marginTop: 1 }}>
              {subLabel && <span>{subLabel} · </span>}
              {group.totalCount}件
              {group.recvCount > 0 && ` · 受信${group.recvCount}`}
              {group.sentCount > 0 && ` · 送信${group.sentCount}`}
              {group.hasReply && " · 往復あり"}
            </div>
          </div>
        </div>
        {/* タイムライン */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {mobileEntries.map((entry) =>
            entry.kind === "action" ? (
              <TimelineActionEntry key={`action-${entry.doc.id}-${entry.subtype}`} entry={entry} />
            ) : (
              <TimelineDocEntry
                key={`doc-${entry.doc.id}`}
                entry={entry}
                nameOf={nameOf} fmt={fmt} isExpired={isExpired}
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
      {/* グループヘッダー */}
      <div style={{
        padding: "14px 20px", flexShrink: 0,
        borderBottom: `1px solid ${DP.border}`,
        background: DP.surface,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <HospitalAvatar name={mainLabel} iconUrl={avatarIcon} size={30} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: DP.navy }}>
            {mainLabel}
          </div>
          <div style={{ fontSize: 12, color: DP.textSub, marginTop: 2 }}>
            {subLabel && <span>{subLabel} · </span>}
            {group.totalCount}件のやりとり
            {group.recvCount > 0 && ` · 受信${group.recvCount}件`}
            {group.sentCount > 0 && ` · 送信${group.sentCount}件`}
            {group.hasReply && " · 往復あり"}
          </div>
        </div>
      </div>

      {/* 本体: タイムライン(左280px) + DetailPane(右flex-1) */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <Timeline
          group={group}
          myHospitalId={myHospitalId}
          nameOf={nameOf}
          fmt={fmt}
          isExpired={isExpired}
          selectedDoc={selectedDoc}
          onDocSelect={setSelectedDoc}
        />
        <DetailPane
          doc={selectedDoc}
          nameOf={nameOf} iconOf={iconOf} fmt={fmt}
          onArchive={onArchive} onAssign={onAssign}
          hospitalMembers={hospitalMembers} myUserId={myUserId}
          fetchPreviewUrl={fetchPreviewUrl} fetchDownloadUrl={fetchDownloadUrl}
          departments={departments}
        />
      </div>
    </div>
  );
}
