// InboxTab.jsx
// v2.0 変更点（港モデル: 港セクション + AssignModal + 部署BOXセクション追加）:
// 1. filteredInboxDocs を 港（owner_user_id IS NULL + UPLOADED）/ 部署BOX（owner IS NOT NULL）に分割
// 2. 港カードに「未担当」バッジ・経過時間を追加し「アサイン」ボタンを表示
// 3. AssignModal: 部署選択（固定リスト）+ 担当者選択（hospitalMembers） → FastAPI /assign 呼び出し
// 4. 部署BOXセクション: dept フィルタ付きで担当済みドキュメントを表示
// 5. 既存のカードレイアウト・ボタン・フィルタ（未読/期限切れ/検索）は変更なし
// ※ v1.x 以前の変更点はそのまま維持

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

// 部署の固定選択リスト（将来: DB管理に移行可）
const DEPARTMENTS = [
  "内科", "外科", "整形外科", "小児科", "産婦人科",
  "眼科", "皮膚科", "耳鼻科", "精神科", "放射線科",
  "リハビリ", "地域連携室", "その他",
];

// 経過時間ラベル（created_at から）
function elapsedLabel(createdAt) {
  if (!createdAt) return "";
  const ms = Date.now() - new Date(createdAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(0, Math.floor(ms / 60_000))}分前`;
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

// 担当者の表示名（display_name があれば使用、なければ ID の先頭8文字）
function memberLabel(member) {
  return member.display_name || `ユーザー ${String(member.id).slice(0, 8)}`;
}

// ---- AssignModal ----
function AssignModal({ doc, hospitalMembers, myUserId, onAssign, onClose }) {
  const [dept, setDept] = useState(DEPARTMENTS[0]);
  const [ownerId, setOwnerId] = useState(myUserId || (hospitalMembers[0]?.id ?? ""));
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

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(15,23,42,0.45)",
        zIndex: 90, display: "grid", placeItems: "center", padding: 12,
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
          display: "grid", gap: 14,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16, color: THEME.text }}>
          担当アサイン
        </div>

        <div style={{ fontSize: 12, opacity: 0.7, color: THEME.text, lineHeight: 1.5 }}>
          {doc.original_filename || doc.file_key || "（ファイル名不明）"}
        </div>

        {/* 部署選択 */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 800, color: THEME.text, display: "block", marginBottom: 6 }}>
            部署
          </label>
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.15)", outline: "none",
              color: THEME.text, background: "#fff", fontSize: 14,
              boxSizing: "border-box",
            }}
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* 担当者選択 */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 800, color: THEME.text, display: "block", marginBottom: 6 }}>
            主担当者
          </label>
          {hospitalMembers.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.6, padding: "8px 0" }}>
              メンバー情報を取得中...（RLS ポリシーの確認が必要な場合があります）
            </div>
          ) : (
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.15)", outline: "none",
                color: THEME.text, background: "#fff", fontSize: 14,
                boxSizing: "border-box",
              }}
            >
              {hospitalMembers.map((m) => (
                <option key={m.id} value={m.id}>{memberLabel(m)}</option>
              ))}
            </select>
          )}
        </div>

        {err && (
          <div style={{ fontSize: 13, color: "#b91c1c", fontWeight: 800 }}>{err}</div>
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

// ---- 汎用カード（港・部署BOX 両セクションで使い回し） ----
function DocCard({
  doc, nameOf, fmt, isExpired, openPreview, archiveDocument,
  statusLabel, isLegacyKey, statusTone,
  onAssignClick,   // 港セクションのみ渡す
  showElapsed,     // 港セクションのみ true
}) {
  const getThumbUrl = (d) => d?.thumb_url || d?.thumbnail_url || d?.thumbUrl || "";
  const expired = isExpired(doc.expires_at);
  const legacy = isLegacyKey(doc.file_key);
  const thumbUrl = getThumbUrl(doc);
  const summary = buildCardSummary(doc);
  const disabledOpen =
    expired || doc.status === "CANCELLED" || doc.status === "ARCHIVED";

  return (
    <div
      style={{
        backgroundColor: "rgba(186, 230, 253, 0.6)",
        border: "1px solid rgba(15,23,42,0.12)",
        borderRadius: 12, padding: 12,
        display: "grid", gap: 10,
        boxShadow: "0 6px 14px rgba(15, 23, 42, 0.08)",
      }}
    >
      {/* ── カード上部：title / subtitle ── */}
      {summary.title && (
        <div
          style={{
            fontSize: 12, lineHeight: 1.4,
            paddingBottom: 6, borderBottom: "1px solid rgba(15,23,42,0.09)",
            display: "flex", gap: 6, flexWrap: "wrap", alignItems: "baseline",
          }}
        >
          <span style={{ fontWeight: 800, color: "#0f172a" }}>{summary.title}</span>
          {summary.subtitle && (
            <span style={{ opacity: 0.6, fontSize: 11 }}>{summary.subtitle}</span>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        {/* 左：サムネ + 情報 */}
        <div style={{ display: "flex", gap: 12, minWidth: 0, alignItems: "flex-start", flex: 1 }}>
          <button
            onClick={() => openPreview(doc)}
            disabled={disabledOpen}
            title={disabledOpen ? "開けません" : "プレビュー"}
            style={{
              width: 86, height: 86, borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.12)",
              background: "rgba(255,255,255,0.75)",
              padding: 0, cursor: disabledOpen ? "not-allowed" : "pointer",
              overflow: "hidden", flex: "0 0 auto",
              opacity: disabledOpen ? 0.6 : 1,
            }}
          >
            {thumbUrl ? (
              <img src={thumbUrl} alt="thumb" loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "grid",
                placeItems: "center", fontSize: 22, opacity: 0.8 }}>
                📄
              </div>
            )}
          </button>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{nameOf(doc.from_hospital_id)}</div>
            <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>
              {fmt(doc.created_at)}
              {doc.expires_at ? ` / 期限: ${fmt(doc.expires_at)}` : ""}
            </div>
            {showElapsed && (
              <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2, color: "#7c3aed", fontWeight: 800 }}>
                ⏱ {elapsedLabel(doc.created_at)}
              </div>
            )}
            {doc.assigned_department && (
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                部署: {doc.assigned_department}
              </div>
            )}
            {doc.comment ? (
              <div style={{ fontSize: 14, opacity: 0.8, marginTop: 6 }}>{doc.comment}</div>
            ) : null}
          </div>
        </div>

        {/* 右：ステータス */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {!doc.owner_user_id && (
            <Pill tone={{ bg: "rgba(239,68,68,0.13)", text: "#b91c1c", border: "rgba(185,28,28,0.25)" }}>
              未担当
            </Pill>
          )}
          <Pill tone={statusTone(doc)}>
            {expired ? "期限切れ" : statusLabel(doc.status)}
          </Pill>
          {legacy ? (
            <Pill tone={{ bg: "rgba(255,226,163,0.6)", text: "#7a4b00", border: "rgba(122,75,0,0.25)" }}>
              旧データ
            </Pill>
          ) : null}
        </div>
      </div>

      {/* ── バッジ行 ── */}
      {summary.badges.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {summary.badges.map((b, i) => (
            <Pill key={i} tone={b.tone} style={{ fontSize: 11, padding: "3px 9px" }}>
              {b.label}
            </Pill>
          ))}
        </div>
      )}

      {/* ── ボタン行 ── */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {onAssignClick && (
          <PrimaryButton
            onClick={() => onAssignClick(doc)}
            style={{ background: "#7c3aed" }}
          >
            アサイン
          </PrimaryButton>
        )}
        <PrimaryButton onClick={() => openPreview(doc)} disabled={disabledOpen}>
          プレビュー
        </PrimaryButton>
        <SecondaryButton onClick={() => archiveDocument(doc)} disabled={doc.status === "ARCHIVED"}>
          Archive
        </SecondaryButton>
      </div>
    </div>
  );
}

// ---- セクションヘッダー ----
function SectionHeader({ label, count, color = THEME.text }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 0 4px", borderBottom: "2px solid rgba(15,23,42,0.08)",
      marginBottom: 4,
    }}>
      <span style={{ fontWeight: 900, fontSize: 14, color }}>{label}</span>
      {count != null && (
        <span style={{
          fontSize: 11, fontWeight: 800, padding: "2px 8px",
          borderRadius: 999, background: "rgba(15,23,42,0.07)", color: THEME.text,
        }}>
          {count}件
        </span>
      )}
    </div>
  );
}

// ---- InboxTab（メイン） ----
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
  // 港モデル用（v2.0 追加）
  assignDocument,
  hospitalMembers,
  myUserId,
}) {
  // AssignModal 状態
  const [assigningDoc, setAssigningDoc] = useState(null);

  // 部署BOX フィルタ
  const [filterDept, setFilterDept] = useState("all");

  // 港: owner_user_id が null かつ UPLOADED（未担当）
  const harbourDocs = filteredInboxDocs.filter(
    (d) => !d.owner_user_id && d.status === "UPLOADED"
  );

  // 部署BOX: owner_user_id が設定済み
  const assignedDocs = filteredInboxDocs.filter((d) => !!d.owner_user_id);

  // 部署BOX のフィルタ済みリスト
  const visibleAssigned =
    filterDept === "all"
      ? assignedDocs
      : assignedDocs.filter((d) => d.assigned_department === filterDept);

  // 部署BOX 内の部署リスト（実際にあるもののみ）
  const deptOptions = Array.from(
    new Set(assignedDocs.map((d) => d.assigned_department).filter(Boolean))
  ).sort();

  // アサイン処理（AssignModal から呼ばれる）
  const handleAssign = async (docId, dept, ownerId) => {
    await assignDocument(docId, dept, ownerId, "IN_PROGRESS");
  };

  // 全体が空（港も部署BOXも空）かどうか
  const totalVisible = harbourDocs.length + assignedDocs.length;

  const cardProps = {
    nameOf, fmt, isExpired, openPreview, archiveDocument,
    statusLabel, isLegacyKey, statusTone,
  };

  return (
    <Card>
      <div style={headerTitle}>受け取る</div>
      <div style={{ ...headerDesc, marginTop: 6 }}>
        プレビューで確認（右上「端末で開く」も可）
      </div>

      {/* フィルタ行 */}
      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
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

      {/* 全体空 */}
      {totalVisible === 0 && (
        <div style={{ fontSize: 13, opacity: 0.7, padding: "16px 8px" }}>
          受け取りBOXは空です。
        </div>
      )}

      {/* ─────────────────────────────────
          港セクション（未担当）
      ───────────────────────────────── */}
      {harbourDocs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <SectionHeader label="🚢 港（未担当）" count={harbourDocs.length} color="#7c3aed" />
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {harbourDocs.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                {...cardProps}
                showElapsed
                onAssignClick={(d) => setAssigningDoc(d)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────
          部署BOXセクション（担当済み）
      ───────────────────────────────── */}
      {assignedDocs.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <SectionHeader label="📂 部署BOX（担当済み）" count={assignedDocs.length} />
            {/* 部署絞り込み */}
            {deptOptions.length > 0 && (
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                style={{
                  fontSize: 12, padding: "4px 10px", borderRadius: 8,
                  border: "1px solid rgba(15,23,42,0.15)", outline: "none",
                  color: THEME.text, background: "#fff",
                }}
              >
                <option value="all">全部署</option>
                {deptOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {visibleAssigned.length === 0 ? (
              <div style={{ fontSize: 13, opacity: 0.7, padding: 8 }}>
                この部署の担当ドキュメントはありません。
              </div>
            ) : (
              visibleAssigned.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  {...cardProps}
                  showElapsed={false}
                  onAssignClick={null}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* AssignModal */}
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
