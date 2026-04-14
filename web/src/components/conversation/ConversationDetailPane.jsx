// ConversationDetailPane.jsx
// 選択されたグループの「連携履歴タイムライン」+ 既存 DetailPane の組み合わせ
//
// PC/タブレット: タイムライン(280px) + DetailPane(flex-1) の横2カラム
// モバイル: タイムライン全画面 → doc選択で DetailPane に切り替え

import { useState } from "react";
import { DP, elapsed, docStatusLabel, docStatusColor } from "../receive/receiveConstants";
import HospitalAvatar from "../common/HospitalAvatar";
import DetailPane from "../receive/DetailPane";

// ---- タイムラインの1エントリ ----
function TimelineEntry({ doc, myHospitalId, nameOf, fmt, isExpired, selected, onClick }) {
  const isSent = doc.from_hospital_id === myHospitalId;
  const sc     = docStatusColor(doc, isExpired);
  const sl     = docStatusLabel(doc, isExpired);

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
      {/* 方向アイコン（送信: ↑ネイビー / 受信: ↓ブルー） */}
      <div style={{
        width: 26, height: 26, borderRadius: "50%",
        background: isSent ? DP.navy : DP.blue,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, color: "#fff",
        flexShrink: 0, marginTop: 1,
      }}>
        {isSent ? "↑" : "↓"}
      </div>

      {/* 内容 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 方向ラベル（送信先 or 受信元） */}
        <div style={{ fontSize: 11, color: DP.textSub, marginBottom: 1 }}>
          {isSent
            ? `送信 → ${nameOf(doc.to_hospital_id)}`
            : `受信 ← ${nameOf(doc.from_hospital_id)}`}
        </div>
        {/* 絶対日時（誤結合時に別物と識別できるよう必ず表示） */}
        <div style={{ fontSize: 11, color: DP.textSub, marginBottom: 3, opacity: 0.75 }}>
          {fmt(doc.created_at)}
          <span style={{ marginLeft: 5, opacity: 0.7 }}>({elapsed(doc.created_at)})</span>
        </div>
        {/* 書類名（ファイル名 > 書類種別 > "書類" の優先順位） */}
        <div style={{
          fontSize: 13,
          fontWeight: selected ? 800 : 600,
          color: DP.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          marginBottom: 4,
        }}>
          {doc.original_filename || doc.document_type || "書類"}
          {/* 書類種別がファイル名と共存する場合はサブテキストで補足 */}
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
        {group.docs.map(doc => (
          <TimelineEntry
            key={doc.id}
            doc={doc}
            myHospitalId={myHospitalId}
            nameOf={nameOf}
            fmt={fmt}
            isExpired={isExpired}
            selected={selectedDoc?.id === doc.id}
            onClick={() => onDocSelect(selectedDoc?.id === doc.id ? null : doc)}
          />
        ))}
      </div>
    </div>
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
  // ※ グループ切替時の selectedDoc リセットは ConversationScreen 側で
  //   key={selectedGroup?.id} を渡すことで対応（ここでは不要）

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

  // ---- モバイル: タイムライン → 書類詳細の2段階遷移 ----
  if (isMobile) {
    if (selectedDoc) {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          {/* 戻るバー */}
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
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* グループヘッダー */}
        <div style={{
          padding: "12px 16px", flexShrink: 0,
          borderBottom: `1px solid ${DP.border}`,
          background: DP.surface,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <HospitalAvatar
            name={nameOf(group.peerHospitalId)}
            iconUrl={iconOf ? iconOf(group.peerHospitalId) : ""}
            size={26}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: DP.navy }}>
              {nameOf(group.peerHospitalId)}
            </div>
            <div style={{ fontSize: 11, color: DP.textSub, marginTop: 1 }}>
              {group.totalCount}件
              {group.recvCount > 0 && ` · 受信${group.recvCount}`}
              {group.sentCount > 0 && ` · 送信${group.sentCount}`}
              {group.hasReply && " · 往復あり"}
            </div>
          </div>
        </div>
        {/* タイムライン */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {group.docs.map(doc => (
            <TimelineEntry
              key={doc.id}
              doc={doc}
              myHospitalId={myHospitalId}
              nameOf={nameOf} fmt={fmt} isExpired={isExpired}
              selected={selectedDoc?.id === doc.id}
              onClick={() => setSelectedDoc(doc)}
            />
          ))}
        </div>
      </div>
    );
  }

  // ---- PC / タブレット: グループヘッダー + タイムライン(左) + DetailPane(右) ----
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
      {/* グループヘッダー */}
      <div style={{
        padding: "14px 20px", flexShrink: 0,
        borderBottom: `1px solid ${DP.border}`,
        background: DP.surface,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <HospitalAvatar
          name={nameOf(group.peerHospitalId)}
          iconUrl={iconOf ? iconOf(group.peerHospitalId) : ""}
          size={30}
        />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: DP.navy }}>
            {nameOf(group.peerHospitalId)}
          </div>
          <div style={{ fontSize: 12, color: DP.textSub, marginTop: 2 }}>
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
