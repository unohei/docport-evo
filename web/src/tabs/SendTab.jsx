import { useMemo, useState } from "react";

import FileDrop from "../components/FileDrop";
import ScanCapture from "../components/ScanCapture";

import {
  THEME,
  Card,
  PrimaryButton,
  StepChip,
  TextArea,
  Select,
} from "../components/ui/primitives";

// 置くタブ
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
  // drag | scan
  const [inputMode, setInputMode] = useState("drag");

  const myHospitalName = useMemo(() => {
    if (!myHospitalId) return "";
    return hospitals.find((h) => h.id === myHospitalId)?.name ?? "";
  }, [myHospitalId, hospitals]);

  const options = useMemo(() => {
    // 宛先候補（自院以外）
    return (hospitals ?? [])
      .filter((h) => h.id !== myHospitalId)
      .map((h) => ({ value: h.id, label: h.name }));
  }, [hospitals, myHospitalId]);

  // --- Segmented switch (Drag / Scan) ---
  const SegButton = ({ active, icon, children, onClick }) => {
    // ★メニューの青トーンに寄せる（明るめブルー）
    const accent = "rgba(14, 165, 233, 0.16)";
    const accentBorder = "rgba(14, 165, 233, 0.40)";
    const accentShadow = "rgba(14, 165, 233, 0.22)";
    const accentText = "#0369a1";

    const idle = "rgba(15, 23, 42, 0.04)";
    const idleBorder = "rgba(15, 23, 42, 0.10)";
    const idleText = "#0f172a";

    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: isMobile ? "12px 10px" : "12px 14px",
          borderRadius: 14,
          border: `1px solid ${active ? accentBorder : idleBorder}`,
          background: active ? accent : idle,
          color: active ? accentText : idleText,
          fontWeight: 800,
          cursor: "pointer",
          boxShadow: active ? `0 0 0 3px ${accentShadow}` : "none",
          transition: "all 160ms ease",
          position: "relative",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
        <span style={{ fontSize: isMobile ? 14 : 15 }}>{children}</span>

        {/* 下線バー：選択がパッと分かる */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 8,
            height: 3,
            borderRadius: 999,
            background: active ? "rgba(14, 165, 233, 0.95)" : "transparent",
            transition: "all 160ms ease",
          }}
        />
      </button>
    );
  };

  // --- Step UI（pdfFile が無いとき：入力/スキャン、あるとき：フォーム） ---
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={headerTitle}>置く</div>
        <div style={headerDesc}>
          ドラッグ＆ドロップ / スキャンでPDFを置きます
        </div>
      </div>

      {/* 入力方法スイッチ（未選択時だけ表示） */}
      {!pdfFile ? (
        <Card>
          <div
            style={{
              display: "grid",
              gap: 12,
              padding: isMobile ? 12 : 14,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 10,
                padding: 8,
                borderRadius: 16,
                border: "1px solid rgba(15, 23, 42, 0.10)",
                background: "rgba(255,255,255,0.75)",
              }}
            >
              <SegButton
                active={inputMode === "drag"}
                icon="📎"
                onClick={() => setInputMode("drag")}
              >
                ドラッグで置く
              </SegButton>

              <SegButton
                active={inputMode === "scan"}
                icon="📷"
                onClick={() => setInputMode("scan")}
              >
                スキャンで置く
              </SegButton>
            </div>

            {/* 本体 */}
            {inputMode === "drag" ? (
              <FileDrop
                onSelected={(file) => setPdfFile(file)}
                helperText="ドラッグ＆ドロップ / クリックで選択"
                headline="PDFをここに置く"
                footnote="※ PDFが選択されると、宛先とコメント入力フォームが表示されます"
              />
            ) : (
              <ScanCapture
                filenameBase="紹介状"
                preferRearCamera={true}
                onDone={(file) => setPdfFile(file)}
                onCancel={() => setInputMode("drag")}
              />
            )}
          </div>
        </Card>
      ) : null}

      {/* PDF 選択後：フォーム */}
      {pdfFile ? (
        <Card>
          <div
            style={{ padding: isMobile ? 12 : 14, display: "grid", gap: 12 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StepChip>1</StepChip>
              <div style={{ fontWeight: 800 }}>宛先と一言</div>
              <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
                所属：{myHospitalName || "（profiles未設定）"}
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>宛先病院</div>
              <Select
                value={toHospitalId}
                onChange={(e) => setToHospitalId(e.target.value)}
              >
                <option value="">選択してください</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>一言（任意）</div>
              <TextArea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="例）紹介状です。よろしくお願いします。"
                // はみ出し防止：親幅に収める
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <PrimaryButton
                onClick={createDocument}
                disabled={sending}
                style={{ minWidth: isMobile ? 140 : 180 }}
              >
                {sending ? "置いています..." : "置く"}
              </PrimaryButton>

              <button
                type="button"
                onClick={() => {
                  setPdfFile(null);
                  setComment("");
                  setToHospitalId("");
                }}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(15, 23, 42, 0.12)",
                  background: "transparent",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ファイルを選び直す
              </button>

              <div style={{ fontSize: 12, opacity: 0.75 }}>
                選択中：{pdfFile?.name}
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
