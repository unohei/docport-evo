// v3.0 変更点（チェックモードUI追加）:
// 1. ファイル選択前に「チェックモード ON/OFF」「チェック強度 高速/詳細」トグルを表示
// 2. uploadStatus（uploading/ocr_running/ready/error）に応じた5段階のOCR状態表示
// 3. 構造化情報（structured）をラベル付きテーブルで表示（null値はスキップ）

import { useMemo, useState } from "react";
import {
  THEME,
  Card,
  PrimaryButton,
  TextInput,
} from "../components/ui/primitives";
import FileDrop from "../components/FileDrop";
import ScanCapture from "../components/ScanCapture";

// 構造化JSONの表示ラベル（順序保持のため配列）
const STRUCTURED_LABELS = [
  ["patient_name",       "患者名"],
  ["patient_id",         "患者ID"],
  ["birth_date",         "生年月日"],
  ["referrer_hospital",  "紹介元病院"],
  ["referrer_doctor",    "紹介元医師"],
  ["referral_date",      "紹介日"],
  ["chief_complaint",    "主訴"],
  ["suspected_diagnosis","疑い病名"],
  ["allergies",          "アレルギー"],
  ["medications",        "処方薬"],
];

// インラインスピナー（index.css の @keyframes spin を使用）
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
  finalizeDocument,
}) {
  const [inputMode, setInputMode] = useState("drop"); // "drop" | "scan"
  const [hoverMode, setHoverMode] = useState(null);

  const isProcessing = uploadStatus === "uploading" || uploadStatus === "ocr_running";

  const hospitalOptions = useMemo(() => {
    return (hospitals || [])
      .filter((h) => h.id !== myHospitalId)
      .map((h) => ({ id: h.id, name: h.name }));
  }, [hospitals, myHospitalId]);

  // ---- SegButton（入力モード切替用）----
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

  // ---- トグルボタン（チェックモード・強度共通スタイル）----
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
          {/* チェック設定カード */}
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* チェックモード ON / OFF */}
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

              {/* チェック強度（ON時のみ表示）*/}
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

          {/* 入力モード切替 + FileDrop/ScanCapture */}
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
                <FileDrop onFile={(file) => onFileDrop(file)} accept="application/pdf" />
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
            {/* チェックモード適用中の表示 */}
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

            <div style={{ fontWeight: 800, marginTop: 6 }}>ひとこと</div>
            <TextInput
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="例）紹介状お送りします。ご確認お願いします。"
              disabled={sending}
            />

            {/* ---- OCR / アップロード 状態エリア ---- */}
            <div style={{ marginTop: 4 }}>

              {/* アップロード中 */}
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

              {/* OCRチェック中 */}
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

              {/* チェックOFF で ready: スキップ表示 */}
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

              {/* エラー */}
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

              {/* チェックON で ready + OCR結果あり */}
              {uploadStatus === "ready" && checkMode && ocrResult && (
                <div>
                  {/* warnings */}
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

                  {/* meta */}
                  <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 6, color: THEME.text }}>
                    ページ数: {ocrResult.meta?.page_count} ／ 文字数: {ocrResult.meta?.char_count}
                  </div>

                  {/* 抽出テキスト */}
                  <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, color: THEME.text }}>
                    抽出テキスト
                  </div>
                  <div style={{
                    background: "rgba(248,250,252,0.9)",
                    border: "1px solid rgba(15,23,42,0.10)",
                    borderRadius: 8, padding: "10px 12px",
                    fontSize: 13, whiteSpace: "pre-wrap",
                    overflowY: "auto", maxHeight: 200,
                    lineHeight: 1.65, fontFamily: "monospace", color: THEME.text,
                  }}>
                    {ocrResult.text || "（テキストを抽出できませんでした）"}
                  </div>

                  {/* 構造化情報（structured が null でなく、非null項目があるとき表示）*/}
                  {(() => {
                    if (!ocrResult.structured) return null;
                    const entries = STRUCTURED_LABELS.filter(
                      ([key]) => ocrResult.structured[key] != null
                    );
                    if (entries.length === 0) return null;
                    return (
                      <div style={{ marginTop: 10 }}>
                        <div style={{
                          fontWeight: 800, fontSize: 13, marginBottom: 4, color: THEME.text,
                        }}>
                          構造化情報
                        </div>
                        <div style={{
                          border: "1px solid rgba(15,23,42,0.10)",
                          borderRadius: 8, overflow: "hidden", fontSize: 12,
                        }}>
                          {entries.map(([key, label], i) => (
                            <div
                              key={key}
                              style={{
                                display: "flex", gap: 8,
                                padding: "5px 10px",
                                borderBottom: i < entries.length - 1
                                  ? "1px solid rgba(15,23,42,0.06)" : "none",
                                background: i % 2 === 0
                                  ? "rgba(248,250,252,0.9)" : "rgba(255,255,255,0.9)",
                              }}
                            >
                              <span style={{
                                width: 88, flexShrink: 0,
                                fontWeight: 700, opacity: 0.55, color: THEME.text,
                              }}>
                                {label}
                              </span>
                              <span style={{ flex: 1, color: THEME.text }}>
                                {ocrResult.structured[key]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
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
                  onClick={finalizeDocument}
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
