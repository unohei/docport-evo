// SentDetailPane.jsx
// 送信済み詳細ペイン（DetailPane の送信方向版）
// - 送信元 → 宛先 の方向表示
// - 取り消しボタン（UPLOADED かつ期限内のみ）
// - インラインプレビュー
// - OCR情報・コメントは受信画面と同構成

import { useState, useEffect } from "react";
import { DP, senderDisplay, recipientDisplay, docStatusLabel, docStatusColor } from "../receive/receiveConstants";
import { getPreviewKey, isPreviewable } from "../../utils/preview";
import HospitalAvatar from "../common/HospitalAvatar";

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{
        fontSize: 12,
        fontWeight: 800,
        color: DP.textSub,
        minWidth: 72,
        flexShrink: 0,
        paddingTop: 1,
      }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: DP.text, fontWeight: 600, lineHeight: 1.5 }}>
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 800,
      color: DP.textSub,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function ActionButton({ children, variant = "ghost", disabled = false, onClick }) {
  const styles = {
    primary:   { background: DP.blue,      color: DP.white, border: "none" },
    danger:    { background: "#FEF2F2",    color: "#B91C1C", border: "1px solid rgba(185,28,28,0.3)" },
    ghost:     { background: "transparent", color: DP.text,  border: `1px solid ${DP.border}` },
  };
  const s = styles[variant] || styles.ghost;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "9px 16px",
        borderRadius: 9,
        fontSize: 13,
        fontWeight: 800,
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

export default function SentDetailPane({ doc, nameOf, iconOf, fmt, isExpired, cancelDocument, fetchPreviewUrl }) {
  const [inlineUrl,     setInlineUrl]     = useState("");
  const [inlineLoading, setInlineLoading] = useState(false);
  const [copied,        setCopied]        = useState(false);

  useEffect(() => {
    if (!doc || !fetchPreviewUrl || doc.status === "CANCELLED") {
      setInlineUrl("");
      return;
    }
    let cancelled = false;
    setInlineUrl("");
    setInlineLoading(true);
    fetchPreviewUrl(doc)
      .then(url  => { if (!cancelled) setInlineUrl(url); })
      .catch(()  => { if (!cancelled) setInlineUrl(""); })
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
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: DP.white,
        color: DP.textSub,
        gap: 12,
        minWidth: 0,
      }}>
        <span style={{ fontSize: 44, opacity: 0.35 }}>📄</span>
        <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>書類を選択してください</p>
      </div>
    );
  }

  const expired    = isExpired(doc.expires_at);
  const canCancel  = doc.status === "UPLOADED" && !expired;
  const sc         = docStatusColor(doc, isExpired);
  const sl         = docStatusLabel(doc, isExpired);

  // OCR情報
  const sj             = doc.structured_json || {};
  const ocrText        = doc.ocr_text || sj.raw_text || sj.full_text || "";
  const docType        = doc.document_type || sj.doc_type || sj.document_type || "";
  const patientName    = sj.patient_name || sj.patient || "";
  const patientId      = sj.patient_id || "";
  const deptInfo       = sj.department || sj.dept || "";
  const referDate      = sj.date || sj.refer_date || "";
  const sensitiveFlags = sj.warnings || sj.sensitive_flags || [];
  const hasOcrInfo     = docType || patientName || patientId || deptInfo || referDate;

  return (
    <div style={{
      flex: 1,
      background: DP.white,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      minWidth: 0,
    }}>
      {/* ---- ヘッダー ---- */}
      <div style={{
        padding: "14px 20px",
        borderBottom: `1px solid ${DP.border}`,
        background: DP.surface,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: DP.navy, marginBottom: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <HospitalAvatar
              name={senderDisplay(doc, nameOf)}
              iconUrl={iconOf ? iconOf(doc.from_hospital_id) : ""}
              size={20}
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: 999,
              color: sc.text,
              background: sc.bg,
            }}>
              {sl}
            </span>
            <span style={{ fontSize: 12, color: DP.textSub }}>
              {fmt(doc.created_at)}
              {doc.expires_at ? ` · 期限: ${fmt(doc.expires_at)}` : ""}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ActionButton
            variant="danger"
            disabled={!canCancel}
            onClick={() => cancelDocument(doc)}
          >
            取り消す
          </ActionButton>
        </div>
      </div>

      {/* ---- 本体 ---- */}
      <div style={{
        flex: 1,
        overflow: "auto",
        padding: "16px 20px",
        display: "grid",
        gap: 18,
        alignContent: "start",
      }}>
        {/* 要配慮情報警告 */}
        {sensitiveFlags.length > 0 && (
          <div style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.22)",
            fontSize: 12,
            color: "#991B1B",
            fontWeight: 600,
            lineHeight: 1.55,
          }}>
            ⚠️ 要配慮情報の可能性：
            {Array.isArray(sensitiveFlags) ? sensitiveFlags.join("、") : sensitiveFlags}
          </div>
        )}

        {/* OCR構造化情報 */}
        {hasOcrInfo && (
          <section>
            <SectionTitle>OCR 取得情報</SectionTitle>
            <div style={{
              background: DP.surface,
              borderRadius: 10,
              padding: "12px 14px",
              border: `1px solid ${DP.border}`,
              display: "grid",
              gap: 9,
            }}>
              <InfoRow label="書類種別" value={docType} />
              <InfoRow label="患者名"   value={patientName} />
              <InfoRow label="患者ID"   value={patientId} />
              <InfoRow label="診療科"   value={deptInfo} />
              <InfoRow label="日付"     value={referDate} />
            </div>
          </section>
        )}

        {/* コメント */}
        {doc.comment && (
          <section>
            <SectionTitle>コメント</SectionTitle>
            <div style={{
              background: "#FFFBEB",
              borderRadius: 10,
              padding: "12px 14px",
              border: "1px solid rgba(217,119,6,0.20)",
              fontSize: 13,
              color: DP.text,
              lineHeight: 1.65,
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
                  padding: "3px 10px",
                  borderRadius: 6,
                  border: `1px solid ${DP.border}`,
                  background: copied ? DP.skyLight : "transparent",
                  color: copied ? DP.blue : DP.textSub,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  marginBottom: 8,
                }}
              >
                {copied ? "コピー完了 ✓" : "コピー"}
              </button>
            </div>
            <div style={{
              background: "#F8FAFC",
              borderRadius: 10,
              padding: "12px 14px",
              border: `1px solid ${DP.border}`,
              fontSize: 11,
              color: DP.text,
              lineHeight: 1.75,
              maxHeight: 200,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              fontFamily: "ui-monospace, 'Courier New', monospace",
            }}>
              {ocrText}
            </div>
          </section>
        )}

        {/* ファイルプレビュー（インライン） */}
        <section>
          <SectionTitle>ファイルプレビュー</SectionTitle>
          {inlineLoading ? (
            <div style={{
              background: "#F1F5F9",
              borderRadius: 10,
              border: `1px solid ${DP.border}`,
              minHeight: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <span style={{ fontSize: 12, color: DP.textSub }}>読み込み中...</span>
            </div>
          ) : inlineUrl && isPreviewable(getPreviewKey(doc)) ? (
            <div style={{
              borderRadius: 10,
              border: `1px solid ${DP.border}`,
              overflow: "hidden",
              height: 420,
            }}>
              <iframe
                src={inlineUrl}
                style={{ width: "100%", height: "100%", border: "none" }}
                title="ファイルプレビュー"
              />
            </div>
          ) : inlineUrl ? (
            <div style={{
              background: "#F1F5F9",
              borderRadius: 10,
              border: `1px solid ${DP.border}`,
              padding: "20px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}>
              <span style={{ fontSize: 34, opacity: 0.5 }}>📄</span>
              <div style={{ fontSize: 11, color: DP.textSub }}>ブラウザではプレビューできません</div>
              <a
                href={inlineUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "8px 14px",
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: 800,
                  background: DP.skyLight,
                  color: DP.blue,
                  border: `1px solid ${DP.borderActive}`,
                  textDecoration: "none",
                }}
              >
                ダウンロードして確認
              </a>
            </div>
          ) : doc.status === "CANCELLED" ? (
            <div style={{
              background: "#FEF2F2",
              borderRadius: 10,
              border: "1px solid rgba(185,28,28,0.15)",
              padding: "20px 16px",
              textAlign: "center",
              fontSize: 12,
              color: "#991B1B",
            }}>
              取り消し済みのため表示できません
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
