// SendTab.jsx
// 変更点（hospitalMatch.js 切り出し）:
// 1. normalizeForMatch / findHospitalCandidates を utils/hospitalMatch.js に移動
//    → スコアリング追加（完全一致100 / 短縮名70 / 前方一致50）・上位3件に制限
// ※ 以前の変更点（structured 永続化対応）はそのまま維持

import { useEffect, useMemo, useState } from "react";
import {
  THEME,
  Card,
  PrimaryButton,
  TextInput,
} from "../components/ui/primitives";
import FileDrop from "../components/FileDrop";
import ScanCapture from "../components/ScanCapture";
import { findHospitalCandidates } from "../utils/hospitalMatch";

// 構造化JSONの表示ラベル（順序保持のため配列）
const STRUCTURED_LABELS = [
  ["patient_name",         "患者名"],
  ["patient_id",           "患者ID"],
  ["birth_date",           "生年月日"],
  ["referrer_hospital",    "紹介元病院"],
  ["referrer_doctor",      "紹介元医師"],
  ["referral_to_hospital", "紹介先病院"],
  ["referral_date",        "紹介日"],
  ["chief_complaint",      "主訴"],
  ["suspected_diagnosis",  "疑い病名"],
  ["allergies",            "アレルギー"],
  ["medications",          "処方薬"],
];

// ラベルルックアップ（差分サマリー表示用）
const LABEL_MAP = Object.fromEntries(STRUCTURED_LABELS);

// 差分比較の正規化（trim + 連続スペース圧縮）
function normalizeVal(val) {
  if (val == null) return "";
  return String(val).trim().replace(/\s+/g, " ");
}

// アラートキーワードのハイライト背景色
function getHighlightBg(severity) {
  if (severity === "high")   return "rgba(239,68,68,0.18)";
  if (severity === "medium") return "rgba(234,179,8,0.28)";
  return "rgba(234,179,8,0.14)";
}

// アラートパネルの配色
function alertStyle(severity) {
  if (severity === "high")
    return { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.28)", labelColor: "#991b1b", badge: "rgba(239,68,68,0.15)", badgeLabel: "要注意" };
  if (severity === "medium")
    return { bg: "rgba(234,179,8,0.08)", border: "rgba(234,179,8,0.35)", labelColor: "#854d0e", badge: "rgba(234,179,8,0.20)", badgeLabel: "注意" };
  return { bg: "rgba(234,179,8,0.05)", border: "rgba(234,179,8,0.20)", labelColor: "#a16207", badge: "rgba(234,179,8,0.12)", badgeLabel: "参考" };
}

// OCRテキストをアラートキーワードでハイライトセグメントに分割
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
      if ((priority[r.severity] || 0) > (priority[last.severity] || 0)) {
        last.severity = r.severity;
      }
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

// インラインスピナー
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

export default function SendTab({
  headerTitle,
  // headerDesc,
  isMobile,
  myHospitalId,
  hospitals,
  toHospitalId,
  setToHospitalId,
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
  checkIntensity,   // 'full' | 'text_only'
  setCheckIntensity,
  finalizeDocument, // (structuredPayload: object|null) => void
  userId,           // Supabase auth user id（差分ログ用）
  allowedMimeExt,   // { [mime]: ext } — FileDrop の許可リストに使用
}) {
  // FileDrop に渡す許可 MIME リスト（allowedMimeExt が未渡しなら PDF のみ）
  const allowedTypes = allowedMimeExt ? Object.keys(allowedMimeExt) : ["application/pdf"];
  const isPdfFile  = pdfFile?.type === "application/pdf";
  const isDocxFile = pdfFile?.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isXlsxFile = pdfFile?.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const [inputMode, setInputMode] = useState("drop");
  const [hoverMode, setHoverMode] = useState(null);

  // ---- structured 編集state ----
  // structured_raw は ocrResult.structured のまま（変更しない）
  // structured_edit は人が編集する確定値（初期値は raw と同じ）
  const [structuredEdit, setStructuredEdit] = useState(null);
  const [editedAt, setEditedAt] = useState(null);

  // ocrResult が変わるたびに編集stateをリセット
  useEffect(() => {
    const raw = ocrResult?.structured ?? null;
    setStructuredEdit(raw ? { ...raw } : null);
    setEditedAt(null);
  }, [ocrResult]);

  const structuredRaw = ocrResult?.structured ?? null;

  // 差分キー（正規化比較）
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

  // ---- 置くボタンのラッパー ----
  // structuredPayload を組み立てて finalizeDocument に渡す
  const handleFinalize = () => {
    // structured があれば payload を作る、なければ null（DB は NULL のまま）
    const structuredPayload = structuredRaw
      ? {
          structured_json: structuredEdit ?? structuredRaw,
          structured_version: "v1",
          structured_updated_at: new Date().toISOString(),
          // 人が編集した項目がある場合は 'human'、AI抽出のみなら 'ai'
          structured_updated_by: changedKeys.length > 0 ? "human" : "ai",
          structured_source: "openai",
        }
      : null;

    // 監査ログ（console）
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

  const hospitalOptions = useMemo(() => {
    return (hospitals || [])
      .filter((h) => h.id !== myHospitalId)
      .map((h) => ({ id: h.id, name: h.name }));
  }, [hospitals, myHospitalId]);

  // 宛先病院AI候補
  const hospitalCandidates = useMemo(() => {
    const targetName = ocrResult?.structured?.referral_to_hospital;
    return findHospitalCandidates(targetName, hospitals, myHospitalId);
  }, [ocrResult, hospitals, myHospitalId]);

  // ---- SegButton ----
  const SegButton = ({ active, hovered, icon, children, ...props }) => {
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
        <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
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

  // ---- ToggleBtn ----
  const ToggleBtn = ({ active, onClick, children, small = false }) => (
    <button
      onClick={onClick}
      style={{
        padding: small ? "5px 12px" : "6px 16px",
        borderRadius: 10,
        border: `1px solid ${active ? "rgba(14,165,233,0.50)" : "rgba(15,23,42,0.12)"}`,
        background: active ? "rgba(14,165,233,0.12)" : "rgba(255,255,255,0.75)",
        color: active ? "#0369a1" : THEME.text,
        fontWeight: 800,
        fontSize: small ? 12 : 13,
        cursor: "pointer",
        transition: "background 120ms, border-color 120ms, color 120ms",
      }}
    >
      {children}
    </button>
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <div style={headerTitle}>置く</div>
      </div>

      {/* ========== ファイル未選択: チェック設定 + モード選択 ========== */}
      {!pdfFile && (
        <>
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: THEME.text, minWidth: 100 }}>
                  チェックモード
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  <ToggleBtn active={checkMode === true}  onClick={() => setCheckMode(true)}>ON</ToggleBtn>
                  <ToggleBtn active={checkMode === false} onClick={() => setCheckMode(false)}>OFF</ToggleBtn>
                </div>
                {!checkMode && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#b45309", opacity: 0.9 }}>
                    ⚠️ OCR・要配慮チェックをスキップします
                  </span>
                )}
              </div>

              {checkMode && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: THEME.text, minWidth: 100 }}>
                    チェック強度
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <ToggleBtn
                      active={checkIntensity === "text_only"}
                      onClick={() => setCheckIntensity("text_only")}
                      small
                    >
                      高速（OCRのみ）
                    </ToggleBtn>
                    <ToggleBtn
                      active={checkIntensity === "full"}
                      onClick={() => setCheckIntensity("full")}
                      small
                    >
                      詳細（構造化あり）
                    </ToggleBtn>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div style={{
              display: "flex", gap: 10, padding: 10,
              borderRadius: 16, border: "1px solid rgba(15,23,42,0.10)",
              background: "rgba(255,255,255,0.65)",
            }}>
              <SegButton
                active={inputMode === "drop"} hovered={hoverMode === "drop"}
                onMouseEnter={() => setHoverMode("drop")} onMouseLeave={() => setHoverMode(null)}
                onClick={() => setInputMode("drop")} icon="📎"
              >
                ドラッグで置く
              </SegButton>
              <SegButton
                active={inputMode === "scan"} hovered={hoverMode === "scan"}
                onMouseEnter={() => setHoverMode("scan")} onMouseLeave={() => setHoverMode(null)}
                onClick={() => setInputMode("scan")} icon="📷"
              >
                スキャンで置く
              </SegButton>
            </div>
            <div style={{ marginTop: 12 }}>
              {inputMode === "drop" ? (
                <FileDrop
                  onFile={(file) => onFileDrop(file)}
                  allowedTypes={allowedTypes}
                  title="ここに置く"
                  hint="PDF / 画像 / Word / Excel / PowerPoint"
                />
              ) : (
                <ScanCapture
                  filenameBase="紹介状" preferRearCamera={true}
                  onDone={(file) => onFileDrop(file)} onCancel={() => {}}
                />
              )}
            </div>
          </Card>
        </>
      )}

      {/* ========== ファイル選択後: フォーム ========== */}
      {pdfFile && (
        <Card>
          <div style={{ display: "grid", gap: 10 }}>
            {/* チェックモード表示 */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 11, opacity: 0.6, color: THEME.text,
            }}>
              <span>チェック:</span>
              {!checkMode ? (
                <span style={{ fontWeight: 700, color: "#b45309" }}>OFF（スキップ）</span>
              ) : checkIntensity === "full" ? (
                <span style={{ fontWeight: 700, color: "#0369a1" }}>ON（詳細）</span>
              ) : (
                <span style={{ fontWeight: 700, color: "#0369a1" }}>ON（高速）</span>
              )}
            </div>

            <div style={{ fontWeight: 800 }}>置く先（宛先）</div>
            <select
              value={toHospitalId}
              onChange={(e) => setToHospitalId(e.target.value)}
              disabled={sending}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "rgba(255,255,255,0.85)", fontWeight: 700, color: THEME.text,
              }}
            >
              <option value="">選択してください</option>
              {hospitalOptions.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>

            {/* 宛先病院AI候補 */}
            {checkMode && ocrResult?.structured?.referral_to_hospital && hospitalCandidates.length > 0 && (
              <div style={{
                padding: "8px 12px", borderRadius: 10,
                background: "rgba(14,165,233,0.06)",
                border: "1px solid rgba(14,165,233,0.18)",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", marginBottom: 6 }}>
                  AI候補（紹介状から読み取った宛先: {ocrResult.structured.referral_to_hospital}）
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {hospitalCandidates.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setToHospitalId(h.id)}
                      style={{
                        padding: "5px 12px", borderRadius: 8,
                        border: toHospitalId === h.id
                          ? "1px solid rgba(14,165,233,0.55)"
                          : "1px solid rgba(14,165,233,0.30)",
                        background: toHospitalId === h.id
                          ? "rgba(14,165,233,0.18)"
                          : "rgba(255,255,255,0.85)",
                        color: "#0369a1", fontWeight: 800, fontSize: 12,
                        cursor: "pointer",
                        transition: "background 120ms, border-color 120ms",
                      }}
                    >
                      {h.name} {toHospitalId === h.id ? "✓" : "適用"}
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

              {/* PDF・DOCX・XLSX 以外のファイル: OCR対象外（チェックモードON/OFF問わず） */}
              {uploadStatus === "ready" && !isPdfFile && !isDocxFile && !isXlsxFile && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(14,165,233,0.05)",
                  border: "1px solid rgba(14,165,233,0.18)",
                  fontSize: 13, fontWeight: 700, color: "#0369a1",
                }}>
                  <span>OCR対象外</span>
                  <span style={{ fontWeight: 400, opacity: 0.75 }}>
                    — PDF以外のファイルはテキスト抽出をスキップします。内容を確認の上「置く」を押してください。
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
              {uploadStatus === "ready" && checkMode && (isPdfFile || isDocxFile || isXlsxFile) && ocrResult && (
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
                              <div style={{
                                display: "flex", alignItems: "center", gap: 6, marginBottom: 4,
                              }}>
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
                              <div style={{
                                fontSize: 10, color: s.labelColor, opacity: 0.6, marginTop: 4,
                              }}>
                                ※ 送信前に内容をご確認ください（AIによる検出のため断定できません）
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 4. 抽出テキスト（ハイライトあり） */}
                  <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, color: THEME.text }}>
                    抽出テキスト
                  </div>
                  <div style={{
                    background: "rgba(248,250,252,0.9)",
                    border: "1px solid rgba(15,23,42,0.10)",
                    borderRadius: 8, padding: "10px 12px",
                    fontSize: 13,
                    overflowY: "auto", maxHeight: 200,
                    lineHeight: 1.65, fontFamily: "monospace", color: THEME.text,
                    whiteSpace: "pre-wrap", wordBreak: "break-all",
                  }}>
                    {(() => {
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

                  {/* 5. 構造化情報（編集可能フォーム）— full モード時のみ */}
                  {structuredEdit && checkIntensity === "full" && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, color: THEME.text }}>
                        構造化情報
                      </div>

                      {/* 注意文言（固定） */}
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

                      {/* 編集サマリー（変更がある場合のみ） */}
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
                            <div style={{ opacity: 0.8 }}>
                              編集者: {userId}
                            </div>
                          )}
                          {editedAt && (
                            <div style={{ opacity: 0.8 }}>
                              編集日時: {new Date(editedAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 各フィールド（入力フォーム） */}
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
                              {/* ラベル */}
                              <span style={{
                                width: 88, flexShrink: 0,
                                fontWeight: 700, opacity: 0.55, color: THEME.text,
                              }}>
                                {label}
                              </span>

                              {/* 入力フィールド */}
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

                              {/* 変更あり: バッジ + 元に戻すボタン */}
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
                                      whiteSpace: "nowrap",
                                      opacity: 0.75,
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
    </div>
  );
}
