// InboxTab.jsx
// v3.0 変更点（タブUI / 新着書類 / 完了ボタン）:
// 1. TabBar 追加（新着書類 / 担当済み / すべて の3タブ）
//    - 新着書類: owner_user_id IS NULL かつ UPLOADED（未担当）
//    - 担当済み: owner_user_id IS NOT NULL（ARCHIVED=完了 も含み、部署絞り込み可）
//    - すべて:   全件（完了書類もここで確認できる）
// 2. 「港（未担当）」→「新着書類」に名称変更
// 3. Archive ボタン → 「完了」ボタン（status=ARCHIVED を維持、ラベルのみ変更）
//    完了済みは緑系カード背景 + 「完了」バッジで視覚的に区別
// 4. 部署選択リストを8部署に固定
// 5. プレビューは閲覧のみ（App.jsx 側で markDownloaded: false 制御済み）
// ※ DocCard / AssignModal / フィルタUIの基本構造は v2.0 から継承

import { useState } from "react";
import {
  Card,
  Pill,
  PrimaryButton,
  SecondaryButton,
  TextInput,
  THEME,
} from "../components/ui/primitives";
import { buildCardSummary } from "../utils/cardSummary";

// ---- 部署リスト（固定8部署） ----
const DEPARTMENTS = [
  "地域連携室",
  "医事課",
  "健診センター",
  "薬剤科",
  "検査課",
  "総務",
  "病棟看護師",
  "外来看護師",
];

// ---- ヘルパー関数 ----

function elapsedLabel(createdAt) {
  if (!createdAt) return "";
  const ms = Date.now() - new Date(createdAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(0, Math.floor(ms / 60_000))}分前`;
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

function memberLabel(member) {
  return member.display_name || `ユーザー ${String(member.id).slice(0, 8)}`;
}

// ARCHIVED → 「完了」にローカル上書き（SentTab 等グローバルの statusLabel は変えない）
function inboxStatusLabel(status, globalStatusLabel) {
  if (status === "ARCHIVED") return "完了";
  return globalStatusLabel(status);
}

// ARCHIVED → 緑系トーンにローカル上書き
function inboxStatusTone(doc, globalStatusTone) {
  if (doc.status === "ARCHIVED") {
    return { bg: "rgba(16,185,129,0.14)", text: "#047857", border: "rgba(4,120,87,0.25)" };
  }
  return globalStatusTone(doc);
}

// ---- TabBar ----

function TabBar({ tabs, active, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        borderBottom: "2px solid rgba(15,23,42,0.08)",
        marginBottom: 14,
      }}
    >
      {tabs.map((t) => {
        const isActive = active === t.value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            style={{
              padding: "8px 14px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: isActive ? 900 : 600,
              color: isActive ? THEME.primary : "rgba(15,23,42,0.5)",
              borderBottom: isActive
                ? `2px solid ${THEME.primary}`
                : "2px solid transparent",
              marginBottom: -2,
              whiteSpace: "nowrap",
              transition: "color 0.12s",
            }}
          >
            {t.label}
            {t.count != null && (
              <span
                style={{
                  marginLeft: 5,
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: isActive
                    ? "rgba(14,165,233,0.15)"
                    : "rgba(15,23,42,0.07)",
                  color: isActive ? THEME.primaryText : "rgba(15,23,42,0.45)",
                  fontWeight: 800,
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---- AssignModal ----

function AssignModal({ doc, hospitalMembers, myUserId, onAssign, onClose }) {
  const [dept, setDept] = useState(DEPARTMENTS[0]);
  const [ownerId, setOwnerId] = useState(
    myUserId || (hospitalMembers[0]?.id ?? "")
  );
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async () => {
    if (!dept) return setErr("部署を選択してください");
    if (!ownerId) return setErr("担当者を選択してください");
    setSubmitting(true);
    setErr("");
    try {
      await onAssign(doc.id, dept, ownerId);
      onClose();
    } catch (e) {
      setErr(e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const selectStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(15,23,42,0.15)",
    outline: "none",
    color: THEME.text,
    background: "#fff",
    fontSize: 14,
    boxSizing: "border-box",
  };

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        zIndex: 90,
        display: "grid",
        placeItems: "center",
        padding: 12,
      }}
    >
      <div
        style={{
          width: "min(480px, 100%)",
          background: "#fff",
          border: "1px solid rgba(15,23,42,0.12)",
          borderRadius: 16,
          boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
          padding: 20,
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16, color: THEME.text }}>
          担当アサイン
        </div>

        <div
          style={{
            fontSize: 12,
            opacity: 0.7,
            color: THEME.text,
            lineHeight: 1.5,
          }}
        >
          {doc.original_filename || doc.file_key || "（ファイル名不明）"}
        </div>

        {/* 部署 */}
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: THEME.text,
              display: "block",
              marginBottom: 6,
            }}
          >
            部署
          </label>
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            style={selectStyle}
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* 主担当者 */}
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: THEME.text,
              display: "block",
              marginBottom: 6,
            }}
          >
            主担当者
          </label>
          {hospitalMembers.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.6, padding: "8px 0" }}>
              メンバー情報を取得中...（RLS ポリシー設定が必要な場合があります）
            </div>
          ) : (
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              style={selectStyle}
            >
              {hospitalMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {memberLabel(m)}
                </option>
              ))}
            </select>
          )}
        </div>

        {err && (
          <div style={{ fontSize: 13, color: "#b91c1c", fontWeight: 800 }}>
            {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <SecondaryButton onClick={onClose} disabled={submitting}>
            キャンセル
          </SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={submitting}>
            {submitting ? "アサイン中..." : "アサイン確定"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ---- DocCard ----
// onAssignClick: 新着書類タブのみ渡す（null = ボタン非表示）
// showElapsed: 新着書類タブのみ true（経過時間表示）

function DocCard({
  doc,
  nameOf,
  fmt,
  isExpired,
  openPreview,
  archiveDocument,
  statusLabel,
  isLegacyKey,
  statusTone,
  onAssignClick,
  showElapsed,
}) {
  const thumbUrl = doc?.thumb_url || doc?.thumbnail_url || doc?.thumbUrl || "";
  const expired = isExpired(doc.expires_at);
  const legacy = isLegacyKey(doc.file_key);
  const summary = buildCardSummary(doc);
  const isCompleted = doc.status === "ARCHIVED";

  // プレビューは閲覧のみ: CANCELLED のみ無効化（ARCHIVED でも閲覧可にする）
  const disabledOpen = expired || doc.status === "CANCELLED";

  const localLabel = inboxStatusLabel(doc.status, statusLabel);
  const localTone = inboxStatusTone(doc, statusTone);

  return (
    <div
      style={{
        backgroundColor: isCompleted
          ? "rgba(209,250,229,0.45)"
          : "rgba(186,230,253,0.6)",
        border: `1px solid ${
          isCompleted
            ? "rgba(16,185,129,0.28)"
            : "rgba(15,23,42,0.12)"
        }`,
        borderRadius: 12,
        padding: 12,
        display: "grid",
        gap: 10,
        boxShadow: "0 6px 14px rgba(15,23,42,0.07)",
        opacity: isCompleted ? 0.82 : 1,
      }}
    >
      {/* タイトル行 */}
      {summary.title && (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.4,
            paddingBottom: 6,
            borderBottom: "1px solid rgba(15,23,42,0.09)",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "baseline",
          }}
        >
          <span style={{ fontWeight: 800, color: "#0f172a" }}>
            {summary.title}
          </span>
          {summary.subtitle && (
            <span style={{ opacity: 0.6, fontSize: 11 }}>{summary.subtitle}</span>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {/* 左: サムネ + 情報 */}
        <div
          style={{
            display: "flex",
            gap: 12,
            minWidth: 0,
            alignItems: "flex-start",
            flex: 1,
          }}
        >
          <button
            onClick={() => openPreview(doc)}
            disabled={disabledOpen}
            title={disabledOpen ? "開けません" : "プレビュー（閲覧のみ）"}
            style={{
              width: 86,
              height: 86,
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.12)",
              background: "rgba(255,255,255,0.75)",
              padding: 0,
              cursor: disabledOpen ? "not-allowed" : "pointer",
              overflow: "hidden",
              flex: "0 0 auto",
              opacity: disabledOpen ? 0.5 : 1,
            }}
          >
            {thumbUrl ? (
              <img
                src={thumbUrl}
                alt="thumb"
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 22,
                  opacity: 0.8,
                }}
              >
                📄
              </div>
            )}
          </button>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              {nameOf(doc.from_hospital_id)}
            </div>
            <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>
              {fmt(doc.created_at)}
              {doc.expires_at ? ` / 期限: ${fmt(doc.expires_at)}` : ""}
            </div>
            {showElapsed && (
              <div
                style={{
                  fontSize: 12,
                  color: "#7c3aed",
                  fontWeight: 800,
                  marginTop: 2,
                }}
              >
                ⏱ {elapsedLabel(doc.created_at)}
              </div>
            )}
            {doc.assigned_department && (
              <div style={{ fontSize: 12, opacity: 0.72, marginTop: 2 }}>
                部署: {doc.assigned_department}
              </div>
            )}
            {doc.comment ? (
              <div style={{ fontSize: 14, opacity: 0.8, marginTop: 6 }}>
                {doc.comment}
              </div>
            ) : null}
          </div>
        </div>

        {/* 右: バッジ */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {!doc.owner_user_id && (
            <Pill
              tone={{
                bg: "rgba(239,68,68,0.12)",
                text: "#b91c1c",
                border: "rgba(185,28,28,0.25)",
              }}
            >
              未担当
            </Pill>
          )}
          <Pill tone={localTone}>
            {expired ? "期限切れ" : localLabel}
          </Pill>
          {legacy ? (
            <Pill
              tone={{
                bg: "rgba(255,226,163,0.6)",
                text: "#7a4b00",
                border: "rgba(122,75,0,0.25)",
              }}
            >
              旧データ
            </Pill>
          ) : null}
        </div>
      </div>

      {/* 構造化バッジ */}
      {summary.badges.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {summary.badges.map((b, i) => (
            <Pill key={i} tone={b.tone} style={{ fontSize: 11, padding: "3px 9px" }}>
              {b.label}
            </Pill>
          ))}
        </div>
      )}

      {/* ボタン行 */}
      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}
      >
        {/* アサインボタン: 未担当かつ未完了のみ表示 */}
        {onAssignClick && !isCompleted && (
          <PrimaryButton
            onClick={() => onAssignClick(doc)}
            style={{ background: "#7c3aed" }}
          >
            アサイン
          </PrimaryButton>
        )}

        <PrimaryButton
          onClick={() => openPreview(doc)}
          disabled={disabledOpen}
        >
          プレビュー
        </PrimaryButton>

        {/* 完了ボタン（旧 Archive）*/}
        <SecondaryButton
          onClick={() => archiveDocument(doc)}
          disabled={isCompleted}
        >
          {isCompleted ? "完了済" : "完了"}
        </SecondaryButton>
      </div>
    </div>
  );
}

// ---- InboxTab (main) ----

export default function InboxTab({
  headerTitle,
  headerDesc,
  isMobile,
  showUnreadOnly,
  setShowUnreadOnly,
  showExpired,
  setShowExpired,
  qInbox,
  setQInbox,
  filteredInboxDocs,
  nameOf,
  fmt,
  isExpired,
  openPreview,
  archiveDocument,
  statusLabel,
  isLegacyKey,
  statusTone,
  // 港モデル用（v2.0〜）
  assignDocument,
  hospitalMembers,
  myUserId,
}) {
  const [activeTab, setActiveTab] = useState("new");
  const [assigningDoc, setAssigningDoc] = useState(null);
  const [filterDept, setFilterDept] = useState("all");

  // ---- タブ別ドキュメント分類 ----
  // 新着書類: 未担当（owner_user_id IS NULL）かつ UPLOADED（ARRIVED も念のため含む）
  const newDocs = filteredInboxDocs.filter(
    (d) =>
      !d.owner_user_id &&
      (d.status === "UPLOADED" || d.status === "ARRIVED")
  );

  // 担当済み: owner_user_id が設定済み（完了=ARCHIVED も含め、担当済みタブで確認できる）
  const assignedDocs = filteredInboxDocs.filter((d) => !!d.owner_user_id);

  // すべて: filteredInboxDocs 全件（ARCHIVED 含む）
  const allDocs = filteredInboxDocs;

  // 現在のタブのドキュメント
  const tabDocs =
    activeTab === "new"
      ? newDocs
      : activeTab === "assigned"
      ? assignedDocs
      : allDocs;

  // 担当済みタブの部署絞り込み
  const visibleDocs =
    activeTab === "assigned" && filterDept !== "all"
      ? tabDocs.filter((d) => d.assigned_department === filterDept)
      : tabDocs;

  // 担当済みタブで実際に存在する部署リスト
  const deptOptions =
    activeTab === "assigned"
      ? Array.from(
          new Set(
            assignedDocs.map((d) => d.assigned_department).filter(Boolean)
          )
        ).sort()
      : [];

  const tabs = [
    { value: "new",      label: "新着書類",  count: newDocs.length },
    { value: "assigned", label: "担当済み",  count: assignedDocs.length },
    { value: "all",      label: "すべて",    count: allDocs.length },
  ];

  const handleTabChange = (v) => {
    setActiveTab(v);
    setFilterDept("all");
  };

  const handleAssign = async (docId, dept, ownerId) => {
    await assignDocument(docId, dept, ownerId, "IN_PROGRESS");
  };

  const docCardProps = {
    nameOf,
    fmt,
    isExpired,
    openPreview,
    archiveDocument,
    statusLabel,
    isLegacyKey,
    statusTone,
  };

  return (
    <Card>
      <div style={headerTitle}>受け取る</div>
      <div style={{ ...headerDesc, marginTop: 6 }}>
        プレビューで確認（閲覧のみ）
      </div>

      {/* ---- フィルタ行（共通）---- */}
      <div
        style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}
      >
        <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
          <input
            type="checkbox"
            checked={showUnreadOnly}
            onChange={(e) => setShowUnreadOnly(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          未読のみ
        </label>

        <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
          <input
            type="checkbox"
            checked={showExpired}
            onChange={(e) => setShowExpired(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          期限切れも表示
        </label>

        <div style={{ flex: 1, minWidth: isMobile ? 200 : 260 }}>
          <TextInput
            value={qInbox}
            onChange={(e) => setQInbox(e.target.value)}
            placeholder="検索（病院名 / コメント）"
          />
        </div>
      </div>

      {/* ---- タブ ---- */}
      <div style={{ marginTop: 16 }}>
        <TabBar tabs={tabs} active={activeTab} onChange={handleTabChange} />
      </div>

      {/* ---- 担当済みタブ: 部署絞り込み ---- */}
      {activeTab === "assigned" && deptOptions.length > 0 && (
        <div
          style={{
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>
            部署:
          </span>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.15)",
              outline: "none",
              color: THEME.text,
              background: "#fff",
            }}
          >
            <option value="all">全部署</option>
            {deptOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ---- ドキュメント一覧 ---- */}
      <div style={{ display: "grid", gap: 10 }}>
        {visibleDocs.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.7, padding: "16px 8px" }}>
            {activeTab === "new" && "新着書類はありません。"}
            {activeTab === "assigned" &&
              (filterDept === "all"
                ? "担当済み書類はありません。"
                : `「${filterDept}」の担当済み書類はありません。`)}
            {activeTab === "all" && "書類がありません。"}
          </div>
        ) : (
          visibleDocs.map((doc) => (
            <DocCard
              key={doc.id}
              doc={doc}
              {...docCardProps}
              // 経過時間: 新着書類タブ or すべてタブで未担当書類
              showElapsed={
                activeTab === "new" ||
                (activeTab === "all" && !doc.owner_user_id)
              }
              // アサインボタン: 未担当かつ未完了のみ（担当済み・すべてタブでは非表示）
              onAssignClick={
                !doc.owner_user_id && doc.status !== "ARCHIVED"
                  ? (d) => setAssigningDoc(d)
                  : null
              }
            />
          ))
        )}
      </div>

      {/* ---- AssignModal ---- */}
      {assigningDoc && (
        <AssignModal
          doc={assigningDoc}
          hospitalMembers={hospitalMembers}
          myUserId={myUserId}
          onAssign={handleAssign}
          onClose={() => setAssigningDoc(null)}
        />
      )}
    </Card>
  );
}
