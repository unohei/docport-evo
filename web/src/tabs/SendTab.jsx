// SendTab.jsx
// v2.1 変更点（宛先選択を RecipientPicker に変更）:
// 1. toHospitalId / setToHospitalId を廃止し、recipient / setRecipient に統一
// 2. hospitals の <select> を RecipientPicker（DocPort + FAX統合検索）に置き換え
// 3. contacts prop を追加（FAX連絡先一覧）
// 4. AI候補クリックで setRecipient({ type:"hospital", ... }) をセット
// ※ v2.0 以前の変更点はそのまま維持

import { useEffect, useMemo, useState } from "react";
import {
  THEME,
  Card,
  PrimaryButton,
  TextInput,
} from "../components/ui/primitives";
import FileDrop from "../components/FileDrop";
import ClipIcon   from "../assets/logo/clip.svg";
import CameraIcon from "../assets/logo/camera.svg";
import ScanCapture from "../components/ScanCapture";
import { findHospitalCandidates } from "../utils/hospitalMatch";
import RecipientPicker from "../components/send/RecipientPicker";

// 構造化JSONの表示ラベル（v2スキーマ・順序保持のため配列）
const STRUCTURED_LABELS = [
  ["patient_name",        "患者名"],
  ["patient_id",          "患者ID"],
  ["date_of_birth",       "生年月日"],
  ["gender",              "性別"],
  ["referring_hospital",  "紹介元病院"],
  ["referring_doctor",    "紹介元医師"],
  ["department",          "診療科"],
  ["target_hospital",     "紹介先病院"],
  ["referral_date",       "紹介日"],
  ["chief_complaint",     "主訴"],
  ["diagnosis",           "病名・診断"],
  ["purpose_of_referral", "紹介目的"],
  ["allergy",             "アレルギー"],
  ["medication",          "処方薬"],
  ["past_history",        "既往歴"],
  ["notes",               "備考"],
];

const LABEL_MAP = Object.fromEntries(STRUCTURED_LABELS);

function normalizeVal(val) {
  if (val == null) return "";
  return String(val).trim().replace(/\s+/g, " ");
}

function getHighlightBg(severity) {
  if (severity === "high")   return "rgba(239,68,68,0.18)";
  if (severity === "medium") return "rgba(234,179,8,0.28)";
  return "rgba(234,179,8,0.14)";
}

function alertStyle(severity) {
  if (severity === "high")
    return { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.28)", labelColor: "#991b1b", badge: "rgba(239,68,68,0.15)", badgeLabel: "要注意" };
  if (severity === "medium")
    return { bg: "rgba(234,179,8,0.08)", border: "rgba(234,179,8,0.35)", labelColor: "#854d0e", badge: "rgba(234,179,8,0.20)", badgeLabel: "注意" };
  return { bg: "rgba(234,179,8,0.05)", border: "rgba(234,179,8,0.20)", labelColor: "#a16207", badge: "rgba(234,179,8,0.12)", badgeLabel: "参考" };
}

function buildHighlightedSegments(text, alerts) {
  if (!text || !alerts?.length) return [{ text, highlight: false }];

  const ranges = [];
  for (const alert of alerts) {
    for (const ev of alert.evidence || []) {
      const kw = ev.keyword || alert.keyword;
      if (!kw) continue;
      let pos = 0;
      while (pos < text.length) {
        const idx = text.indexOf(kw, pos);
        if (idx < 0) break;
        ranges.push({ start: idx, end: idx + kw.length, severity: alert.severity });
        pos = idx + 1;
      }
    }
  }

  if (!ranges.length) return [{ text, highlight: false }];

  ranges.sort((a, b) => a.start - b.start);
  const priority = { high: 3, medium: 2, low: 1 };
  const merged = [];
  for (const r of ranges) {
    if (merged.length && r.start < merged[merged.length - 1].end) {
      const last = merged[merged.length - 1];
      last.end = Math.max(last.end, r.end);
      if ((priority[r.severity] || 0) > (priority[last.severity] || 0)) last.severity = r.severity;
    } else {
      merged.push({ ...r });
    }
  }

  const segments = [];
  let cursor = 0;
  for (const { start, end, severity } of merged) {
    if (cursor < start) segments.push({ text: text.slice(cursor, start), highlight: false });
    segments.push({ text: text.slice(start, end), highlight: true, severity });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), highlight: false });
  return segments;
}

// ---- インラインスピナー ----
function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 14, height: 14,
        border: "2px solid rgba(14,165,233,0.25)",
        borderTopColor: "rgba(14,165,233,0.9)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

// ---- iOS風トグルスイッチ ----
// サイズ: 幅46 × 高さ26。つまみ: 径20px
function IOSToggle({ checked, onChange }) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 46,
        height: 26,
        borderRadius: 13,
        background: checked ? THEME.primary : "rgba(15,23,42,0.20)",
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 180ms ease",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 23 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 5px rgba(0,0,0,0.22)",
          transition: "left 180ms ease",
          display: "block",
        }}
      />
    </div>
  );
}

// ---- AI バッジ（インライン pill）----
function AiBadge({ on }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.3,
        border: `1px solid ${on ? "rgba(14,165,233,0.38)" : "rgba(15,23,42,0.18)"}`,
        background: on ? "rgba(14,165,233,0.11)" : "rgba(15,23,42,0.06)",
        color: on ? "#0369a1" : "rgba(15,23,42,0.42)",
        transition: "all 180ms ease",
        whiteSpace: "nowrap",
      }}
    >
      {on ? "AI ON" : "AI OFF"}
    </span>
  );
}

export default function SendTab({
  headerTitle,
  // headerDesc,
  isMobile,
  myHospitalId,
  hospitals,
  contacts,         // FAX連絡先一覧 [{id, name, fax_number, department_name, is_active, replaced_by_hospital_id}]
  recipient,        // { type:"hospital"|"fax", id, name, sub, faxNumber } | null
  setRecipient,
  comment,
  setComment,
  pdfFile,
  onFileDrop,
  onCancelFile,
  sending,
  uploadStatus,     // 'idle'|'uploading'|'ocr_running'|'ready'|'error'
  ocrResult,
  ocrError,
  checkMode,        // boolean
  setCheckMode,
  // checkIntensity / setCheckIntensity は廃止（常に "full" 固定）
  finalizeDocument, // (structuredPayload: object|null) => void
  userId,           // Supabase auth user id（差分ログ用）
  allowedMimeExt,   // { [mime]: ext } — FileDrop の許可リストに使用
}) {
  const allowedTypes = allowedMimeExt ? Object.keys(allowedMimeExt) : ["application/pdf"];
  // OCR対応MIMEセット（バックエンドの対応拡張子と同期する）
  const OCR_MIME_SET = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]);
  const isOcrFile = OCR_MIME_SET.has(pdfFile?.type);
  const [hoverMode, setHoverMode] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);

  // 抽出テキスト表示切替（raw / normalized）
  const [showNormalized, setShowNormalized] = useState(false);

  // structured 編集state
  const [structuredEdit, setStructuredEdit] = useState(null);
  const [editedAt, setEditedAt] = useState(null);

  useEffect(() => {
    const raw = ocrResult?.structured ?? null;
    setStructuredEdit(raw ? { ...raw } : null);
    setEditedAt(null);
  }, [ocrResult]);

  const structuredRaw = ocrResult?.structured ?? null;

  const changedKeys = useMemo(() => {
    if (!structuredRaw || !structuredEdit) return [];
    return STRUCTURED_LABELS
      .map(([key]) => key)
      .filter((key) => normalizeVal(structuredRaw[key]) !== normalizeVal(structuredEdit[key]));
  }, [structuredRaw, structuredEdit]);

  const handleFieldEdit = (key, value) => {
    setStructuredEdit((prev) => ({ ...prev, [key]: value === "" ? null : value }));
    setEditedAt(Date.now());
  };

  const handleFieldReset = (key) => {
    setStructuredEdit((prev) => ({ ...prev, [key]: structuredRaw?.[key] ?? null }));
  };

  const handleFinalize = () => {
    const structuredPayload = structuredRaw
      ? {
          structured_json: structuredEdit ?? structuredRaw,
          structured_version: "v2",
          structured_updated_at: new Date().toISOString(),
          structured_updated_by: changedKeys.length > 0 ? "human" : "ai",
          structured_source: "openai",
        }
      : null;

    if (structuredRaw && structuredEdit) {
      console.log("[DocPort] structured audit trail:", {
        structured_raw: structuredRaw,
        structured_final: structuredEdit,
        changed_keys: changedKeys,
        edited_by: userId,
        edited_at: editedAt,
      });
    }

    finalizeDocument(structuredPayload);
  };

  const isProcessing = uploadStatus === "uploading" || uploadStatus === "ocr_running";


  const hospitalCandidates = useMemo(() => {
    const targetName = ocrResult?.structured?.target_hospital;
    return findHospitalCandidates(targetName, hospitals, myHospitalId);
  }, [ocrResult, hospitals, myHospitalId]);

  // ---- SegButton（置く方法セレクタ用） ----
  const SegButton = ({ active, hovered, icon, iconSrc, children, ...props }) => {
    const isHot = !!active || !!hovered;
    return (
      <button
        {...props}
        aria-pressed={active ? "true" : "false"}
        style={{
          flex: 1, minWidth: 160,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          padding: isMobile ? "12px 12px" : "14px 14px",
          borderRadius: 14,
          border: `1px solid ${active ? "rgba(14,165,233,0.45)" : isHot ? "rgba(2,132,199,0.28)" : "rgba(15,23,42,0.12)"}`,
          background: active ? "rgba(14,165,233,0.14)" : isHot ? "rgba(2,132,199,0.06)" : "rgba(255,255,255,0.7)",
          color: active ? "#0369a1" : THEME.text,
          fontWeight: 900, letterSpacing: 0.2, cursor: "pointer", userSelect: "none",
          boxShadow: active ? "0 10px 24px rgba(2,132,199,0.18)" : isHot ? "0 8px 18px rgba(15,23,42,0.10)" : "0 2px 8px rgba(15,23,42,0.06)",
          transform: active ? "translateY(-1px)" : isHot ? "translateY(-0.5px)" : "none",
          transition: "background 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease, color 140ms ease",
          position: "relative",
        }}
      >
        {iconSrc
          ? <img src={iconSrc} alt="" style={{ width: 22, height: 22, flexShrink: 0 }} />
          : <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
        }
        <span>{children}</span>
        <span
          aria-hidden="true"
          style={{
            position: "absolute", left: 12, bottom: 8,
            width: 34, height: 4, borderRadius: 999,
            background: active ? "rgba(2,132,199,0.75)" : "transparent",
            transition: "background 140ms ease",
          }}
        />
      </button>
    );
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <div style={headerTitle}>置く</div>
      </div>

      {/* ========== ファイル未選択: チェック設定 + モード選択 ========== */}
      {!pdfFile && (
        <>
          {/* ---- チェックモード（iOS風トグル + AIバッジ + 補足文） ---- */}
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* トグル行 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: THEME.text,
                    minWidth: 100,
                  }}
                >
                  チェックモード
                </span>

                <IOSToggle checked={checkMode} onChange={setCheckMode} />

                <AiBadge on={checkMode} />
              </div>

              {/* 補足文 */}
              <div
                style={{
                  fontSize: 12,
                  color: checkMode ? "rgba(3,105,161,0.75)" : "rgba(15,23,42,0.45)",
                  paddingLeft: 1,
                  lineHeight: 1.5,
                  transition: "color 180ms ease",
                }}
              >
                {checkMode
                  ? "AIを使用します（OCR＋構造化）"
                  : "AIを使用しません（アップロードのみ）"}
              </div>
            </div>
          </Card>

          {/* ---- 置く方法セレクタ + FileDrop ---- */}
          <Card>
            <div style={{
              display: "flex", gap: 10, padding: 10,
              borderRadius: 16, border: "1px solid rgba(15,23,42,0.10)",
              background: "rgba(255,255,255,0.65)",
            }}>
              <SegButton
                active={true} hovered={hoverMode === "drop"}
                onMouseEnter={() => setHoverMode("drop")} onMouseLeave={() => setHoverMode(null)}
                onClick={() => {}} iconSrc={ClipIcon}
              >
                ドラッグで置く
              </SegButton>
              <SegButton
                active={false} hovered={hoverMode === "scan"}
                onMouseEnter={() => setHoverMode("scan")} onMouseLeave={() => setHoverMode(null)}
                onClick={() => setScanOpen(true)} iconSrc={CameraIcon}
              >
                スキャンで置く
              </SegButton>
            </div>
            <div style={{ marginTop: 12 }}>
              <FileDrop
                onFile={(file) => onFileDrop(file)}
                allowedTypes={allowedTypes}
                title="ここに置く"
                hint="PDF / 画像 / Word / Excel / PowerPoint"
              />
            </div>
          </Card>
        </>
      )}

      {/* ========== ファイル選択後: フォーム ========== */}
      {pdfFile && (
        <Card>
          <div style={{ display: "grid", gap: 10 }}>
            {/* チェックモード状態表示（コンパクト） */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 11, opacity: 0.6, color: THEME.text,
            }}>
              <span>チェック:</span>
              {checkMode ? (
                <span style={{ fontWeight: 700, color: "#0369a1" }}>ON（AI使用）</span>
              ) : (
                <span style={{ fontWeight: 700, color: "#b45309" }}>OFF</span>
              )}
            </div>

            <div style={{ fontWeight: 800 }}>置く先（宛先）</div>
            <RecipientPicker
              hospitals={hospitals}
              myHospitalId={myHospitalId}
              contacts={contacts}
              recipient={recipient}
              setRecipient={setRecipient}
              disabled={sending}
            />

            {/* 宛先病院AI候補（OCRから紹介先病院名を読み取れた場合） */}
            {checkMode && ocrResult?.structured?.target_hospital && hospitalCandidates.length > 0 && (
              <div style={{
                padding: "8px 12px", borderRadius: 10,
                background: "rgba(14,165,233,0.06)",
                border: "1px solid rgba(14,165,233,0.18)",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", marginBottom: 6 }}>
                  AI候補（紹介状から読み取った宛先: {ocrResult.structured.target_hospital}）
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {hospitalCandidates.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setRecipient({ type: "hospital", id: h.id, name: h.name, sub: null, faxNumber: null })}
                      style={{
                        padding: "5px 12px", borderRadius: 8,
                        border: recipient?.id === h.id
                          ? "1px solid rgba(14,165,233,0.55)"
                          : "1px solid rgba(14,165,233,0.30)",
                        background: recipient?.id === h.id
                          ? "rgba(14,165,233,0.18)"
                          : "rgba(255,255,255,0.85)",
                        color: "#0369a1", fontWeight: 800, fontSize: 12,
                        cursor: "pointer",
                        transition: "background 120ms, border-color 120ms",
                      }}
                    >
                      {h.name} {recipient?.id === h.id ? "✓" : "適用"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontWeight: 800, marginTop: 6 }}>ひとこと</div>
            <TextInput
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="例）紹介状お送りします。ご確認お願いします。"
              disabled={sending}
            />

            {/* ---- OCR / アップロード 状態エリア ---- */}
            <div style={{ marginTop: 4 }}>

              {uploadStatus === "uploading" && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(14,165,233,0.07)",
                  border: "1px solid rgba(14,165,233,0.20)",
                }}>
                  <Spinner />
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#0369a1" }}>
                    アップロード中...
                  </span>
                </div>
              )}

              {uploadStatus === "ocr_running" && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(14,165,233,0.07)",
                  border: "1px solid rgba(14,165,233,0.20)",
                }}>
                  <Spinner />
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#0369a1" }}>
                    OCRチェック中...
                  </span>
                </div>
              )}

              {uploadStatus === "ready" && !checkMode && (
                <div style={{
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(180,87,9,0.07)",
                  border: "1px solid rgba(180,87,9,0.20)",
                  fontSize: 13, fontWeight: 700, color: "#92400e",
                }}>
                  チェックはスキップ中
                </div>
              )}

              {/* PPTX等OCR非対応ファイル */}
              {uploadStatus === "ready" && !isOcrFile && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(14,165,233,0.05)",
                  border: "1px solid rgba(14,165,233,0.18)",
                  fontSize: 13, fontWeight: 700, color: "#0369a1",
                }}>
                  <span>OCR対象外</span>
                  <span style={{ fontWeight: 400, opacity: 0.75 }}>
                    — このファイル形式はテキスト抽出に対応していません。内容を確認の上「置く」を押してください。
                  </span>
                </div>
              )}

              {uploadStatus === "error" && ocrError && (
                <div style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: 10, padding: "10px 14px",
                }}>
                  <div style={{ fontWeight: 900, color: "#991b1b", marginBottom: 4, fontSize: 13 }}>
                    取得失敗
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{ocrError}</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: THEME.text, opacity: 0.7 }}>
                    内容確認の上そのまま置くこともできます。
                  </div>
                </div>
              )}

              {/* チェックON + PDF / DOCX / XLSX + 抽出結果あり */}
              {uploadStatus === "ready" && checkMode && isOcrFile && ocrResult && (
                <div>
                  {/* 1. warnings */}
                  {ocrResult.warnings?.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      {ocrResult.warnings.map((w, i) => (
                        <div
                          key={i}
                          style={{
                            background: "rgba(239,68,68,0.08)",
                            border: "1px solid rgba(239,68,68,0.25)",
                            borderRadius: 8, padding: "8px 12px",
                            color: "#991b1b", fontSize: 13, fontWeight: 700,
                            marginBottom: 6, lineHeight: 1.5,
                          }}
                        >
                          ⚠️ {w}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 2. meta */}
                  <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 8, color: THEME.text }}>
                    {ocrResult.meta?.page_count != null && `ページ数: ${ocrResult.meta.page_count} ／ `}
                    文字数: {ocrResult.meta?.char_count}
                    {ocrResult.meta?.source_type === "docx" && " ／ DOCX抽出"}
                    {ocrResult.meta?.source_type === "xlsx" && " ／ XLSX抽出"}
                  </div>

                  {/* 3. alerts（要配慮注意喚起） */}
                  {ocrResult.alerts?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6, color: THEME.text }}>
                        要配慮情報の確認
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {ocrResult.alerts.map((alert) => {
                          const s = alertStyle(alert.severity);
                          return (
                            <div
                              key={alert.id}
                              style={{
                                padding: "8px 12px", borderRadius: 8,
                                background: s.bg, border: `1px solid ${s.border}`,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                <span style={{
                                  fontSize: 10, fontWeight: 800, padding: "2px 6px",
                                  borderRadius: 4, background: s.badge, color: s.labelColor,
                                  letterSpacing: 0.4,
                                }}>
                                  {s.badgeLabel}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 800, color: s.labelColor }}>
                                  {alert.label}
                                </span>
                                <span style={{ fontSize: 11, color: s.labelColor, opacity: 0.7 }}>
                                  の可能性があります
                                </span>
                              </div>
                              {alert.evidence?.slice(0, 2).map((ev, i) => (
                                <div
                                  key={i}
                                  style={{
                                    fontSize: 11, color: THEME.text, opacity: 0.75,
                                    fontFamily: "monospace", lineHeight: 1.5,
                                    background: "rgba(255,255,255,0.6)",
                                    borderRadius: 4, padding: "2px 6px",
                                    marginTop: i === 0 ? 0 : 2,
                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                  }}
                                >
                                  {ev.snippet}
                                </div>
                              ))}
                              <div style={{ fontSize: 10, color: s.labelColor, opacity: 0.6, marginTop: 4 }}>
                                ※ 送信前に内容をご確認ください（AIによる検出のため断定できません）
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 4. 抽出テキスト（raw / normalized 切替） */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: THEME.text }}>
                      抽出テキスト
                    </span>
                    {ocrResult.text_normalized != null && (
                      <div style={{ display: "flex", gap: 3 }}>
                        <button
                          onClick={() => setShowNormalized(false)}
                          style={{
                            padding: "2px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                            border: `1px solid ${!showNormalized ? "rgba(14,165,233,0.50)" : "rgba(15,23,42,0.12)"}`,
                            background: !showNormalized ? "rgba(14,165,233,0.12)" : "rgba(255,255,255,0.75)",
                            color: !showNormalized ? "#0369a1" : THEME.text,
                            cursor: "pointer",
                          }}
                        >
                          表示用
                        </button>
                        <button
                          onClick={() => setShowNormalized(true)}
                          style={{
                            padding: "2px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                            border: `1px solid ${showNormalized ? "rgba(14,165,233,0.50)" : "rgba(15,23,42,0.12)"}`,
                            background: showNormalized ? "rgba(14,165,233,0.12)" : "rgba(255,255,255,0.75)",
                            color: showNormalized ? "#0369a1" : THEME.text,
                            cursor: "pointer",
                          }}
                        >
                          AI投入用
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{
                    background: "rgba(248,250,252,0.9)",
                    border: `1px solid ${showNormalized ? "rgba(14,165,233,0.18)" : "rgba(15,23,42,0.10)"}`,
                    borderRadius: 8, padding: "10px 12px",
                    fontSize: 13,
                    overflowY: "auto", maxHeight: 200,
                    lineHeight: 1.65, fontFamily: "monospace", color: THEME.text,
                    whiteSpace: "pre-wrap", wordBreak: "break-all",
                  }}>
                    {(() => {
                      if (showNormalized) {
                        const norm = ocrResult.text_normalized || "";
                        return norm || "（整形済みテキストがありません）";
                      }
                      const text = ocrResult.text || "";
                      if (!text) return "（テキストを抽出できませんでした）";
                      const segments = buildHighlightedSegments(text, ocrResult.alerts || []);
                      const hasHighlight = segments.some((s) => s.highlight);
                      if (!hasHighlight) return text;
                      return segments.map((seg, i) =>
                        seg.highlight ? (
                          <mark
                            key={i}
                            style={{
                              background: getHighlightBg(seg.severity),
                              borderRadius: 3,
                              padding: "0 1px",
                            }}
                          >
                            {seg.text}
                          </mark>
                        ) : (
                          <span key={i}>{seg.text}</span>
                        )
                      );
                    })()}
                  </div>

                  {/* 5. 構造化情報（編集可能フォーム）— structured がある場合に表示 */}
                  {structuredEdit && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, color: THEME.text }}>
                        構造化情報
                      </div>

                      <div style={{
                        fontSize: 11, color: "#6b7280",
                        padding: "7px 10px", marginBottom: 6,
                        borderRadius: 6, lineHeight: 1.6,
                        background: "rgba(15,23,42,0.04)",
                        border: "1px solid rgba(15,23,42,0.08)",
                      }}>
                        AIは抽出・整理の補助です。送信内容の最終確定は担当者が行います。
                        編集した項目は "人が修正" として記録されます。
                      </div>

                      {changedKeys.length > 0 && (
                        <div style={{
                          fontSize: 11, fontWeight: 700,
                          padding: "6px 10px", marginBottom: 6,
                          borderRadius: 6, lineHeight: 1.7,
                          background: "rgba(234,179,8,0.10)",
                          border: "1px solid rgba(234,179,8,0.30)",
                          color: "#854d0e",
                        }}>
                          <div>
                            編集箇所: {changedKeys.length}件（{changedKeys.map((k) => LABEL_MAP[k] || k).join("、")}）
                          </div>
                          {userId && (
                            <div style={{ opacity: 0.8 }}>編集者: {userId}</div>
                          )}
                          {editedAt && (
                            <div style={{ opacity: 0.8 }}>編集日時: {new Date(editedAt).toLocaleString()}</div>
                          )}
                        </div>
                      )}

                      <div style={{
                        border: "1px solid rgba(15,23,42,0.10)",
                        borderRadius: 8, overflow: "hidden", fontSize: 12,
                      }}>
                        {STRUCTURED_LABELS.map(([key, label], i) => {
                          const isChanged = changedKeys.includes(key);
                          const rowBg = isChanged
                            ? "rgba(234,179,8,0.10)"
                            : i % 2 === 0
                              ? "rgba(248,250,252,0.9)"
                              : "rgba(255,255,255,0.9)";
                          return (
                            <div
                              key={key}
                              style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "5px 10px",
                                borderBottom: i < STRUCTURED_LABELS.length - 1
                                  ? "1px solid rgba(15,23,42,0.06)" : "none",
                                background: rowBg,
                                transition: "background 200ms ease",
                              }}
                            >
                              <span style={{
                                width: 88, flexShrink: 0,
                                fontWeight: 700, opacity: 0.55, color: THEME.text,
                              }}>
                                {label}
                              </span>

                              <input
                                type="text"
                                value={structuredEdit[key] ?? ""}
                                onChange={(e) => handleFieldEdit(key, e.target.value)}
                                placeholder="—"
                                style={{
                                  flex: 1,
                                  padding: "3px 7px",
                                  border: isChanged
                                    ? "1px solid rgba(234,179,8,0.50)"
                                    : "1px solid rgba(15,23,42,0.10)",
                                  borderRadius: 5,
                                  background: isChanged
                                    ? "rgba(255,255,255,0.85)"
                                    : "rgba(255,255,255,0.65)",
                                  fontSize: 12,
                                  color: THEME.text,
                                  outline: "none",
                                  minWidth: 0,
                                }}
                              />

                              {isChanged && (
                                <>
                                  <span style={{
                                    fontSize: 9, fontWeight: 800,
                                    padding: "2px 5px", borderRadius: 4,
                                    background: "rgba(234,179,8,0.20)",
                                    color: "#854d0e", whiteSpace: "nowrap", flexShrink: 0,
                                  }}>
                                    人が修正
                                  </span>
                                  <button
                                    onClick={() => handleFieldReset(key)}
                                    title="AI抽出値に戻す"
                                    style={{
                                      padding: "2px 7px", borderRadius: 4, flexShrink: 0,
                                      border: "1px solid rgba(15,23,42,0.15)",
                                      background: "rgba(255,255,255,0.85)",
                                      fontSize: 10, fontWeight: 700,
                                      color: THEME.text, cursor: "pointer",
                                      whiteSpace: "nowrap", opacity: 0.75,
                                    }}
                                  >
                                    元に戻す
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* ---- /OCR状態エリア ---- */}

            {/* ボタン行 */}
            <div style={{
              marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap",
              alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                選択中: <b>{pdfFile?.name}</b>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={onCancelFile}
                  disabled={isProcessing || sending}
                  style={{
                    padding: "10px 14px", borderRadius: 12,
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "transparent", fontWeight: 800,
                    cursor: isProcessing || sending ? "not-allowed" : "pointer",
                    opacity: isProcessing || sending ? 0.5 : 1,
                  }}
                >
                  戻る
                </button>

                <PrimaryButton
                  onClick={handleFinalize}
                  disabled={isProcessing || sending}
                >
                  {sending
                    ? "置いています..."
                    : uploadStatus === "uploading"
                      ? "アップロード中..."
                      : uploadStatus === "ocr_running"
                        ? "チェック中..."
                        : "置く"}
                </PrimaryButton>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ===== スキャンモーダル（全画面オーバーレイ） ===== */}
      {scanOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.88)",
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          overflowY: "auto", padding: "16px",
        }}>
          <div style={{ width: "100%", maxWidth: 600, marginTop: 20 }}>
            <ScanCapture
              filenameBase="紹介状"
              preferRearCamera={true}
              autoStart={true}
              onDone={(file) => { onFileDrop(file); setScanOpen(false); }}
              onCancel={() => setScanOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
