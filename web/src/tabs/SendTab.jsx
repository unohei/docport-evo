// SendTab.jsx
import { useMemo, useState } from "react";
import FileDrop from "../components/FileDrop";
import ScanCapture from "../components/ScanCapture";
import {
  THEME,
  Card,
  PrimaryButton,
  Select,
  SecondaryButton,
  TextArea,
} from "../components/ui/primitives";

export default function SendTab({
  headerTitle,
  headerDesc,
  isMobile,
  myHospitalId,
  hospitals,
  toHospitalId,
  setToHospitalId,
  comment,
  setComment,
  pdfFile,
  setPdfFile,
  sending,
  createDocument,
}) {
  // ★入力方法（pdf未選択時のみ切替）
  const [inputMode, setInputMode] = useState("drop"); // "drop" | "scan"

  const hospitalOptions = useMemo(() => {
    const list = hospitals ?? [];
    return list
      .filter((h) => String(h.id) !== String(myHospitalId))
      .map((h) => ({
        value: h.id,
        label: h.name ?? h.code ?? String(h.id),
      }));
  }, [hospitals, myHospitalId]);

  const canPlace =
    !!pdfFile &&
    !!toHospitalId &&
    String(toHospitalId) !== String(myHospitalId);

  const SegButton = ({ active, children, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: "none",
        border: "1px solid rgba(15,23,42,0.12)",
        background: active ? "white" : "transparent",
        color: THEME.text,
        fontWeight: 800,
        fontSize: 13,
        padding: "10px 12px",
        borderRadius: 12,
        cursor: "pointer",
        boxShadow: active ? "0 1px 8px rgba(15,23,42,0.10)" : "none",
        flex: 1,
        minWidth: 0,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );

  return (
    <Card>
      <div style={headerTitle}>置く</div>
      <div style={headerDesc}>ドラッグ＆ドロップ / スキャンでPDFを置きます</div>

      {!pdfFile ? (
        <>
          {/* ★入力方法の切替（スイッチ） */}
          <div
            style={{
              marginTop: 14,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 520,
                display: "flex",
                gap: 10,
                padding: 8,
                borderRadius: 16,
                border: "1px solid rgba(15,23,42,0.10)",
                background: "rgba(255,255,255,0.65)",
              }}
            >
              <SegButton
                active={inputMode === "drop"}
                onClick={() => setInputMode("drop")}
              >
                📎 ドラッグで置く
              </SegButton>
              <SegButton
                active={inputMode === "scan"}
                onClick={() => setInputMode("scan")}
              >
                📷 スキャンで置く
              </SegButton>
            </div>
          </div>

          {/* ★選択中モードの表示 */}
          <div style={{ marginTop: 14 }}>
            {inputMode === "drop" ? (
              <FileDrop
                accept="application/pdf"
                onFile={(file) => setPdfFile(file)}
              />
            ) : (
              <ScanCapture
                filenameBase="紹介状"
                preferRearCamera={true} // タブレットは背面推奨
                onDone={(file) => setPdfFile(file)} // 既存の送信フローに乗せる
                onCancel={() => {
                  // ここでは閉じない（必要なら drop に戻すなど）
                  // setInputMode("drop");
                }}
              />
            )}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            ※ PDFが選択されると、宛先とコメント入力フォームが表示されます
          </div>
        </>
      ) : (
        <>
          {/* 選択中PDF */}
          <div
            style={{
              marginTop: 14,
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
              border: "1px solid rgba(15,23,42,0.12)",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>
                選択中のPDF
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  fontWeight: 800,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {pdfFile.name}
              </div>
            </div>

            <SecondaryButton
              onClick={() => setPdfFile(null)}
              disabled={sending}
            >
              取り替える
            </SecondaryButton>
          </div>

          {/* 宛先 / コメント */}
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gap: 12,
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>
                宛先（病院）
              </div>
              <div style={{ marginTop: 6 }}>
                <Select
                  value={toHospitalId}
                  onChange={(e) => setToHospitalId(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">選択してください</option>
                  {hospitalOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>
                コメント（任意）
              </div>
              <div style={{ marginTop: 6 }}>
                <TextArea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="例：紹介状 / 検査結果 / 予約確認 など"
                  rows={3}
                  style={{
                    width: "100%",
                    resize: "vertical",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <PrimaryButton onClick={createDocument} disabled={!canPlace}>
              {sending ? "置いています…" : "置く"}
            </PrimaryButton>
          </div>
        </>
      )}
    </Card>
  );
}
