// v2.0 変更点（ドロップ直後OCR自動実行・インライン表示）:
// 1. onFileDrop: drop直後にupload+OCRをApp側で実行（FileDrop/ScanCapture共通）
// 2. OCR結果（loading/result/error）をフォーム内にインライン表示
// 3. 「置く」ボタン: ocrLoading中はdisabled / OCR完了後に有効化
// 4. 「戻る」ボタン: onCancelFile() でApp側のOCR stateをまとめてリセット

import { useMemo, useState } from "react";
import {
  THEME,
  Card,
  PrimaryButton,
  TextInput,
} from "../components/ui/primitives";
import FileDrop from "../components/FileDrop";
import ScanCapture from "../components/ScanCapture";

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
  ocrLoading,
  ocrResult,
  ocrError,
  finalizeDocument,
}) {
  const [inputMode, setInputMode] = useState("drop"); // "drop" | "scan"
  const [hoverMode, setHoverMode] = useState(null); // "drop" | "scan" | null

  const hospitalOptions = useMemo(() => {
    return (hospitals || [])
      .filter((h) => h.id !== myHospitalId)
      .map((h) => ({ id: h.id, name: h.name }));
  }, [hospitals, myHospitalId]);

  const SegButton = ({ active, hovered, icon, children, ...props }) => {
    const isHot = !!active || !!hovered;
    const accentBg = "rgba(14, 165, 233, 0.14)"; // sky
    const accentBorder = "rgba(14, 165, 233, 0.45)";
    const accentText = "#0369a1";

    return (
      <button
        {...props}
        aria-pressed={active ? "true" : "false"}
        style={{
          flex: 1,
          minWidth: 160,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: isMobile ? "12px 12px" : "14px 14px",
          borderRadius: 14,
          border: `1px solid ${
            active
              ? accentBorder
              : isHot
                ? "rgba(2, 132, 199, 0.28)"
                : "rgba(15, 23, 42, 0.12)"
          }`,
          background: active
            ? accentBg
            : isHot
              ? "rgba(2, 132, 199, 0.06)"
              : "rgba(255,255,255,0.7)",
          color: active ? accentText : THEME.text,
          fontWeight: 900,
          letterSpacing: 0.2,
          cursor: "pointer",
          userSelect: "none",
          boxShadow: active
            ? "0 10px 24px rgba(2, 132, 199, 0.18)"
            : isHot
              ? "0 8px 18px rgba(15, 23, 42, 0.10)"
              : "0 2px 8px rgba(15, 23, 42, 0.06)",
          transform: active
            ? "translateY(-1px)"
            : isHot
              ? "translateY(-0.5px)"
              : "none",
          transition:
            "background 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease, color 140ms ease",
          position: "relative",
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
        <span>{children}</span>

        {/* 選択中の"しるし" */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 12,
            bottom: 8,
            width: 34,
            height: 4,
            borderRadius: 999,
            background: active ? "rgba(2, 132, 199, 0.75)" : "transparent",
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

      {/* Mode toggle（PDF未選択時のみ表示） */}
      {!pdfFile ? (
        <Card>
          <div
            style={{
              display: "flex",
              gap: 10,
              padding: 10,
              borderRadius: 16,
              border: "1px solid rgba(15, 23, 42, 0.10)",
              background: "rgba(255,255,255,0.65)",
            }}
          >
            <SegButton
              active={inputMode === "drop"}
              hovered={hoverMode === "drop"}
              onMouseEnter={() => setHoverMode("drop")}
              onMouseLeave={() => setHoverMode(null)}
              onClick={() => setInputMode("drop")}
              icon="📎"
            >
              ドラッグで置く
            </SegButton>

            <SegButton
              active={inputMode === "scan"}
              hovered={hoverMode === "scan"}
              onMouseEnter={() => setHoverMode("scan")}
              onMouseLeave={() => setHoverMode(null)}
              onClick={() => setInputMode("scan")}
              icon="📷"
            >
              スキャンで置く
            </SegButton>
          </div>

          <div style={{ marginTop: 12 }}>
            {inputMode === "drop" ? (
              <FileDrop
                onFile={(file) => onFileDrop(file)}
                accept="application/pdf"
              />
            ) : (
              <ScanCapture
                filenameBase="紹介状"
                preferRearCamera={true}
                onDone={(file) => onFileDrop(file)}
                onCancel={() => {}}
              />
            )}
          </div>
        </Card>
      ) : null}

      {/* フォーム（PDF選択後に表示） */}
      {pdfFile ? (
        <Card>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 800 }}>置く先（宛先）</div>

            <select
              value={toHospitalId}
              onChange={(e) => setToHospitalId(e.target.value)}
              disabled={sending}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                background: "rgba(255,255,255,0.85)",
                fontWeight: 700,
                color: THEME.text,
              }}
            >
              <option value="">選択してください</option>
              {hospitalOptions.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>

            <div style={{ fontWeight: 800, marginTop: 6 }}>ひとこと</div>
            <TextInput
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="例）紹介状お送りします。ご確認お願いします。"
              disabled={sending}
            />

            {/* ---- OCR 解析結果エリア ---- */}
            <div style={{ marginTop: 4 }}>
              {/* ローディング中 */}
              {ocrLoading && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(14,165,233,0.07)",
                    border: "1px solid rgba(14,165,233,0.20)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(14,165,233,0.25)",
                      borderTopColor: "rgba(14,165,233,0.9)",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{ fontSize: 13, fontWeight: 800, color: "#0369a1" }}
                  >
                    OCR解析中...
                  </span>
                </div>
              )}

              {/* OCRエラー */}
              {!ocrLoading && ocrError && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: 10,
                    padding: "10px 14px",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 900,
                      color: "#991b1b",
                      marginBottom: 4,
                      fontSize: 13,
                    }}
                  >
                    OCR取得失敗
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{ocrError}</div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: THEME.text,
                      opacity: 0.7,
                    }}
                  >
                    内容確認の上そのまま置くこともできます。
                  </div>
                </div>
              )}

              {/* OCR成功 */}
              {!ocrLoading && ocrResult && (
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
                            borderRadius: 8,
                            padding: "8px 12px",
                            color: "#991b1b",
                            fontSize: 13,
                            fontWeight: 700,
                            marginBottom: 6,
                            lineHeight: 1.5,
                          }}
                        >
                          ⚠️ {w}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* meta */}
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.55,
                      marginBottom: 6,
                      color: THEME.text,
                    }}
                  >
                    ページ数: {ocrResult.meta?.page_count} ／ 文字数:{" "}
                    {ocrResult.meta?.char_count}
                  </div>

                  {/* 抽出テキスト */}
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 13,
                      marginBottom: 4,
                      color: THEME.text,
                    }}
                  >
                    抽出テキスト
                  </div>
                  <div
                    style={{
                      background: "rgba(248,250,252,0.9)",
                      border: "1px solid rgba(15,23,42,0.10)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontSize: 13,
                      whiteSpace: "pre-wrap",
                      overflowY: "auto",
                      maxHeight: 200,
                      lineHeight: 1.65,
                      fontFamily: "monospace",
                      color: THEME.text,
                    }}
                  >
                    {ocrResult.text || "（テキストを抽出できませんでした）"}
                  </div>
                </div>
              )}
            </div>
            {/* ---- /OCR 解析結果エリア ---- */}

            {/* ボタン行 */}
            <div
              style={{
                marginTop: 6,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                選択中: <b>{pdfFile?.name}</b>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={onCancelFile}
                  disabled={ocrLoading || sending}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(15, 23, 42, 0.12)",
                    background: "transparent",
                    fontWeight: 800,
                    cursor:
                      ocrLoading || sending ? "not-allowed" : "pointer",
                    opacity: ocrLoading || sending ? 0.5 : 1,
                  }}
                >
                  戻る
                </button>

                <PrimaryButton
                  onClick={finalizeDocument}
                  disabled={ocrLoading || sending}
                >
                  {sending
                    ? "置いています..."
                    : ocrLoading
                      ? "解析中..."
                      : "置く"}
                </PrimaryButton>
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
