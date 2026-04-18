// DetailPane.jsx
// 書類詳細ペイン（flex-1）: OCR情報・コメント・テキスト・プレビュー + AssignModal
//
// 変更点 (v2):
// - myHospitalId 追加（optional）: 送信書類ではアサイン/完了ボタンを非表示
// - assigned_department / assigned_at をヘッダー内に移動（「現在状態の一部」として扱う）
// - 完了操作をモーダル化（ArchiveModal）して「処理した感」を付与

import { useState, useEffect } from "react";
import { DP, senderDisplay, recipientDisplay, senderDocStatus } from "./receiveConstants";
import { getPreviewKey, isPreviewable, getExtFromKey } from "../../utils/preview";
import HospitalAvatar from "../common/HospitalAvatar";
import { normalizeStructuredJson } from "../../utils/structuredFormat";
import StructuredCopyPanel from "../common/StructuredCopyPanel";

// ---- 小コンポーネント ----

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{
        fontSize: 13, fontWeight: 800, color: DP.text,
        minWidth: 80, flexShrink: 0, paddingTop: 1,
      }}>
        {label}
      </span>
      <span style={{ fontSize: 14, color: DP.textSub, fontWeight: 500, lineHeight: 1.65 }}>
        {value}
      </span>
    </div>
  );
}

function OcrStatusBadge({ status }) {
  const states = {
    DONE:    { label: "OCR 完了",   bg: "rgba(22,163,74,0.09)",  color: "#15803D", border: "rgba(22,163,74,0.35)" },
    FAILED:  { label: "OCR 失敗",   bg: "rgba(239,68,68,0.08)",  color: "#B91C1C", border: "rgba(239,68,68,0.30)" },
    RUNNING: { label: "OCR 処理中", bg: "rgba(234,179,8,0.10)",  color: "#854D0E", border: "rgba(234,179,8,0.35)" },
  };
  const s = states[status] || { label: "OCR 未処理", bg: "#F1F5F9", color: "#64748B", border: "#CBD5E1" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 999,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {status === "RUNNING" && <span style={{ fontSize: 10 }}>⏳</span>}
      {status === "DONE"    && <span style={{ fontSize: 10 }}>✓</span>}
      {status === "FAILED"  && <span style={{ fontSize: 10 }}>✗</span>}
      {s.label}
    </span>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 800, color: DP.textSub,
      textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function ActionButton({ children, variant = "ghost", disabled = false, onClick }) {
  const styles = {
    primary:   { background: DP.blue,      color: DP.white, border: "none" },
    success:   { background: "#047857",    color: "#fff",   border: "none" },
    secondary: { background: DP.skyLight,   color: DP.blue,  border: `1px solid ${DP.borderActive}` },
    ghost:     { background: "transparent", color: DP.text,  border: `1px solid ${DP.border}` },
  };
  const s = styles[variant] || styles.ghost;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "all 140ms ease",
        ...s,
      }}
    >
      {children}
    </button>
  );
}

// ---- AssignModal ----
function AssignModal({ doc, departments, hospitalMembers, myUserId, onAssign, onClose }) {
  const [dept,       setDept]       = useState(departments[0]?.name ?? "");
  const [ownerId,    setOwnerId]    = useState(myUserId || (hospitalMembers[0]?.id ?? ""));
  const [submitting, setSubmitting] = useState(false);
  const [err,        setErr]        = useState("");

  const handleSubmit = async () => {
    if (!dept)    return setErr("部署を選択してください");
    if (!ownerId) return setErr("担当者を選択してください");
    setSubmitting(true);
    setErr("");
    try {
      await onAssign(doc.id, dept, ownerId, "IN_PROGRESS");
      onClose();
    } catch (e) {
      setErr(e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const selectSt = {
    width: "100%", padding: "9px 12px", borderRadius: 9,
    border: `1px solid ${DP.border}`, fontSize: 13,
    color: DP.text, background: DP.white, boxSizing: "border-box", outline: "none",
  };

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(14,42,92,0.32)",
        zIndex: 100, display: "grid", placeItems: "center", padding: 16,
      }}
    >
      <div style={{
        width: "min(400px, 100%)", background: DP.white, borderRadius: 16,
        padding: 22, boxShadow: "0 24px 56px rgba(0,0,0,0.18)", display: "grid", gap: 16,
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: DP.navy }}>担当アサイン</div>
        <div style={{ fontSize: 12, color: DP.textSub }}>
          {doc.original_filename || doc.file_key?.split("/").pop() || "（ファイル名不明）"}
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 800, color: DP.text, display: "block", marginBottom: 6 }}>
            部署
          </label>
          {departments.length === 0 ? (
            <div style={{ fontSize: 12, color: DP.textSub, padding: "8px 0" }}>
              部署がありません。管理者に部署追加を依頼してください。
            </div>
          ) : (
            <select value={dept} onChange={e => setDept(e.target.value)} style={selectSt}>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          )}
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 800, color: DP.text, display: "block", marginBottom: 6 }}>
            主担当者
          </label>
          {hospitalMembers.length === 0 ? (
            <div style={{ fontSize: 12, color: DP.textSub, padding: "8px 0" }}>メンバー情報を取得中...</div>
          ) : (
            <select value={ownerId} onChange={e => setOwnerId(e.target.value)} style={selectSt}>
              {hospitalMembers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.display_name || `ユーザー ${m.id.slice(0, 6)}`}
                </option>
              ))}
            </select>
          )}
        </div>
        {err && <div style={{ fontSize: 12, color: "#B91C1C", fontWeight: 800 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <ActionButton onClick={onClose} disabled={submitting}>キャンセル</ActionButton>
          <ActionButton variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "アサイン中..." : "アサイン確定"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

// ---- ArchiveModal（完了確認モーダル）----
function ArchiveModal({ doc, onArchive, onClose }) {
  const [comment,    setComment]    = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onArchive(doc);
      onClose();
    } catch {
      // エラーハンドリングは既存の onArchive に委任
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(14,42,92,0.32)",
        zIndex: 100, display: "grid", placeItems: "center", padding: 16,
      }}
    >
      <div style={{
        width: "min(400px, 100%)", background: DP.white, borderRadius: 16,
        padding: 24, boxShadow: "0 24px 56px rgba(0,0,0,0.18)", display: "grid", gap: 18,
      }}>
        {/* タイトル */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: DP.navy, marginBottom: 4 }}>
            対応を完了しますか？
          </div>
          <div style={{ fontSize: 12, color: DP.textSub }}>
            {doc.original_filename || doc.file_key?.split("/").pop() || "（ファイル名不明）"}
          </div>
        </div>
        {/* 任意コメント（UIのみ・DB保存なし） */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 800, color: DP.text, display: "block", marginBottom: 6 }}>
            任意コメント
            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 500, color: DP.textSub }}>
              ※記録には保存されません
            </span>
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="対応内容のメモ（任意）"
            rows={3}
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 9,
              border: `1px solid ${DP.border}`, fontSize: 13, color: DP.text,
              resize: "vertical", background: DP.white, boxSizing: "border-box",
              outline: "none", fontFamily: "inherit", lineHeight: 1.5,
            }}
          />
        </div>
        {/* ボタン */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <ActionButton onClick={onClose} disabled={submitting}>キャンセル</ActionButton>
          <ActionButton variant="success" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "処理中..." : "完了する"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

// ---- 送信側ステータスバッジ用カラー ----
const SENDER_STATUS_COLORS = {
  complete:    { text: "#047857", bg: "rgba(4,120,87,0.08)"  },
  in_progress: { text: "#B45309", bg: "rgba(180,83,9,0.08)"  },
  pending:     { text: DP.textSub, bg: "rgba(15,23,42,0.05)" },
};

// ---- DetailPane (main export) ----
export default function DetailPane({
  doc,
  nameOf,
  iconOf,
  fmt,
  onArchive,
  onAssign,
  hospitalMembers,
  myUserId,
  fetchPreviewUrl,
  fetchDownloadUrl,
  departments = [],
  // optional: 省略時は true（ReceiveScreen など既存呼び出し元との後方互換）
  myHospitalId,
}) {
  const [copied,        setCopied]       = useState(false);
  const [assignOpen,    setAssignOpen]   = useState(false);
  const [archiveOpen,   setArchiveOpen]  = useState(false);
  const [inlineUrl,     setInlineUrl]    = useState("");
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineError,   setInlineError]  = useState("");
  const [dlLoading,     setDlLoading]    = useState(false);
  const [dlError,       setDlError]      = useState("");

  useEffect(() => {
    if (!doc || !fetchPreviewUrl || doc.status === "CANCELLED") {
      setInlineUrl(""); setInlineError(""); return;
    }
    let cancelled = false;
    setInlineUrl(""); setInlineError(""); setInlineLoading(true);
    fetchPreviewUrl(doc)
      .then(url => { if (!cancelled) { setInlineUrl(url); setInlineError(""); } })
      .catch(e  => { console.error("[DetailPane] fetchPreviewUrl failed:", e?.message); if (!cancelled) { setInlineUrl(""); setInlineError(e?.message ?? "URLの取得に失敗しました"); } })
      .finally(() => { if (!cancelled) setInlineLoading(false); });
    return () => { cancelled = true; };
  }, [doc?.id, fetchPreviewUrl]);

  const handleCopy = text => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  if (!doc) {
    return (
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: DP.white, color: DP.textSub, gap: 12, minWidth: 0,
      }}>
        <span style={{ fontSize: 44, opacity: 0.35 }}>📄</span>
        <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>書類を選択してください</p>
      </div>
    );
  }

  // 受信書類かどうか（myHospitalId 未指定時は常に true で後方互換）
  const isReceived  = !myHospitalId || doc.to_hospital_id === myHospitalId;
  const isCompleted = doc.status === "ARCHIVED";
  // 送信側視点の現在状態（受信書類には表示しない）
  const senderStatus = !isReceived ? senderDocStatus(doc, nameOf) : null;
  const canAssign   = isReceived && !isCompleted && !doc.owner_user_id;
  const canComplete = isReceived && !isCompleted;

  const sj             = normalizeStructuredJson(doc.structured_json) ?? {};
  const ocrText        = doc.ocr_text || sj.raw_text || sj.full_text || "";
  const sensitiveFlags = sj.warnings || [];

  return (
    <div style={{
      flex: 1, background: DP.white, display: "flex",
      flexDirection: "column", overflow: "hidden", minWidth: 0,
    }}>
      {/* ---- ヘッダー ---- */}
      <div style={{
        padding: "14px 20px", borderBottom: `1px solid ${DP.border}`,
        background: DP.surface, flexShrink: 0,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {/* 送受信者 + ファイル名 */}
        <div>
          <div style={{
            fontSize: 14, fontWeight: 700, color: DP.navy, marginBottom: 3,
            display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
          }}>
            <HospitalAvatar
              name={senderDisplay(doc, nameOf)}
              iconUrl={doc.source === "fax" ? "" : (iconOf ? iconOf(doc.from_hospital_id) : "")}
              isFax={doc.source === "fax"} size={20}
            />
            {senderDisplay(doc, nameOf)}
            <span style={{ color: DP.textSub, fontWeight: 400 }}> → </span>
            <HospitalAvatar
              name={recipientDisplay(doc, nameOf)}
              iconUrl={iconOf ? iconOf(doc.to_hospital_id) : ""}
              size={20}
            />
            {recipientDisplay(doc, nameOf)}
          </div>
          <div style={{ fontSize: 13, color: DP.textSub }}>
            {doc.original_filename || doc.file_key?.split("/").pop() || "（ファイル名不明）"}
            {doc.page_count ? ` · ${doc.page_count}ページ` : ""}
          </div>
          {doc.expires_at && (
            <div style={{ fontSize: 12, color: DP.textSub, marginTop: 1 }}>
              期限: {fmt(doc.expires_at)}
            </div>
          )}
        </div>

        {/* 担当部署（現在状態の一部としてヘッダーに表示） */}
        {doc.assigned_department && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            padding: "6px 10px", background: "rgba(180,83,9,0.07)",
            borderRadius: 8, fontSize: 12, color: "#B45309", fontWeight: 600,
          }}>
            <span>担当部署：{doc.assigned_department}</span>
            {doc.assigned_at && (
              <>
                <span style={{ opacity: 0.4 }}>·</span>
                <span style={{ fontWeight: 500, opacity: 0.85 }}>
                  アサイン日時：{fmt(doc.assigned_at)}
                </span>
              </>
            )}
          </div>
        )}

        {/* 送信側向け: 受信側の現在対応状況（送信書類のみ表示） */}
        {senderStatus && (
          <div style={{
            display: "inline-flex", alignItems: "center",
            padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            alignSelf: "flex-start",
            color: (SENDER_STATUS_COLORS[senderStatus.level] ?? SENDER_STATUS_COLORS.pending).text,
            background: (SENDER_STATUS_COLORS[senderStatus.level] ?? SENDER_STATUS_COLORS.pending).bg,
          }}>
            現在：{senderStatus.label}
          </div>
        )}

        {/* アクションボタン（受信書類のみ表示） */}
        {(canAssign || canComplete) && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canAssign && (
              <ActionButton variant="primary" onClick={() => setAssignOpen(true)}>
                アサイン
              </ActionButton>
            )}
            {canComplete && (
              <ActionButton onClick={() => setArchiveOpen(true)}>完了にする</ActionButton>
            )}
          </div>
        )}
      </div>

      {/* ---- 本体 ---- */}
      <div style={{
        flex: 1, overflow: "auto", padding: "16px 20px",
        display: "grid", gap: 18, alignContent: "start",
      }}>
        {/* FAX書類: OCR処理状態 */}
        {doc.source === "fax" && (
          <section>
            <SectionTitle>OCR 処理状態</SectionTitle>
            <OcrStatusBadge status={doc.ocr_status} />
          </section>
        )}

        {/* 要配慮情報警告 */}
        {sensitiveFlags.length > 0 && (
          <div style={{
            padding: "10px 14px", borderRadius: 10,
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.22)",
            fontSize: 12, color: "#991B1B", fontWeight: 600, lineHeight: 1.55,
          }}>
            ⚠️ 要配慮情報の可能性：
            {Array.isArray(sensitiveFlags) ? sensitiveFlags.join("、") : sensitiveFlags}
          </div>
        )}

        {/* 構造化データ */}
        {doc.structured_json && (
          <section>
            <SectionTitle>構造化データ</SectionTitle>
            <StructuredCopyPanel rawSj={doc.structured_json} />
          </section>
        )}

        {/* 送信者コメント */}
        {doc.comment && (
          <section>
            <SectionTitle>送信者コメント</SectionTitle>
            <div style={{
              background: "#FFFBEB", borderRadius: 10, padding: "12px 14px",
              border: "1px solid rgba(217,119,6,0.20)", fontSize: 13,
              color: DP.text, lineHeight: 1.65,
            }}>
              {doc.comment}
            </div>
          </section>
        )}

        {/* OCR抽出テキスト */}
        {ocrText && (
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <SectionTitle>OCR 抽出テキスト</SectionTitle>
              <button
                onClick={() => handleCopy(ocrText)}
                style={{
                  padding: "3px 10px", borderRadius: 6,
                  border: `1px solid ${DP.border}`,
                  background: copied ? DP.skyLight : "transparent",
                  color: copied ? DP.blue : DP.textSub,
                  fontSize: 11, fontWeight: 800, cursor: "pointer", marginBottom: 8,
                }}
              >
                {copied ? "コピー完了 ✓" : "コピー"}
              </button>
            </div>
            <div style={{
              background: "#F8FAFC", borderRadius: 10, padding: "12px 14px",
              border: `1px solid ${DP.border}`, fontSize: 11, color: DP.text,
              lineHeight: 1.75, maxHeight: 200, overflow: "auto",
              whiteSpace: "pre-wrap", fontFamily: "ui-monospace, 'Courier New', monospace",
            }}>
              {ocrText}
            </div>
          </section>
        )}

        {/* ファイルプレビュー */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <SectionTitle style={{ margin: 0 }}>ファイルプレビュー</SectionTitle>
            {inlineUrl && fetchDownloadUrl && (
              <button
                onClick={async () => {
                  setDlLoading(true); setDlError("");
                  try {
                    const url = await fetchDownloadUrl(doc);
                    window.open(url, "_blank", "noopener,noreferrer");
                  } catch { setDlError("ダウンロードに失敗しました"); }
                  finally { setDlLoading(false); }
                }}
                disabled={dlLoading}
                style={{
                  padding: "6px 12px", borderRadius: 8,
                  border: `1px solid ${DP.borderActive}`, background: DP.skyLight,
                  color: DP.blue, fontSize: 11, fontWeight: 800,
                  cursor: dlLoading ? "not-allowed" : "pointer",
                  opacity: dlLoading ? 0.6 : 1, flexShrink: 0,
                }}
              >
                {dlLoading ? "取得中…" : "↓ ダウンロード"}
              </button>
            )}
          </div>
          {dlError && <div style={{ fontSize: 11, color: "#B91C1C", marginBottom: 6 }}>{dlError}</div>}
          {inlineLoading ? (
            <div style={{
              background: "#F1F5F9", borderRadius: 10, border: `1px solid ${DP.border}`,
              minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 12, color: DP.textSub }}>読み込み中...</span>
            </div>
          ) : inlineUrl && isPreviewable(getPreviewKey(doc)) ? (
            ["png", "jpg", "jpeg", "webp"].includes(getExtFromKey(getPreviewKey(doc))) ? (
              <div style={{
                borderRadius: 10, border: `1px solid ${DP.border}`, overflow: "hidden",
                height: "clamp(300px, 60vh, 800px)", background: "#F8F9FA",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <img src={inlineUrl} alt="ファイルプレビュー"
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
              </div>
            ) : (
              <div style={{
                borderRadius: 10, border: `1px solid ${DP.border}`, overflow: "hidden",
                height: "clamp(300px, 60vh, 800px)",
              }}>
                <iframe src={inlineUrl} style={{ width: "100%", height: "100%", border: "none" }}
                  title="ファイルプレビュー" />
              </div>
            )
          ) : inlineUrl ? (
            <div style={{
              background: "#F1F5F9", borderRadius: 10, border: `1px solid ${DP.border}`,
              padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 34, opacity: 0.5 }}>📄</span>
              <div style={{ fontSize: 11, color: DP.textSub }}>ブラウザではプレビューできません</div>
              <a href={inlineUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  padding: "8px 14px", borderRadius: 9, fontSize: 12, fontWeight: 800,
                  background: DP.skyLight, color: DP.blue, border: `1px solid ${DP.borderActive}`,
                  textDecoration: "none",
                }}
              >
                ダウンロードして確認
              </a>
            </div>
          ) : inlineError ? (
            <div style={{
              background: "#FEF2F2", borderRadius: 10, border: "1px solid #FECACA",
              padding: "14px 16px", fontSize: 11, color: "#B91C1C",
            }}>
              プレビューの読み込みに失敗しました。ネットワークまたは権限をご確認ください。
              <div style={{ marginTop: 4, opacity: 0.7, wordBreak: "break-all" }}>{inlineError}</div>
            </div>
          ) : null}
        </section>
      </div>

      {assignOpen && (
        <AssignModal
          doc={doc} departments={departments}
          hospitalMembers={hospitalMembers} myUserId={myUserId}
          onAssign={onAssign} onClose={() => setAssignOpen(false)}
        />
      )}
      {archiveOpen && (
        <ArchiveModal
          doc={doc} onArchive={onArchive}
          onClose={() => setArchiveOpen(false)}
        />
      )}
    </div>
  );
}
