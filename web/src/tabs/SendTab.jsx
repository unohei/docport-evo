import { useState } from "react";

import FileDrop from "../components/FileDrop";
import ScanCapture from "../components/ScanCapture";
import {
  Card,
  Pill,
  PrimaryButton,
  StepChip,
  TextArea,
  Select,
  SecondaryButton,
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
  const hospitalOptions = hospitals
    .filter((h) => h.id !== myHospitalId)
    .map((h) => ({ value: h.id, label: h.name }));

  const canPlace = !!toHospitalId && !!pdfFile && !sending;

  // ★スキャン：背面/前面の切り替え
  const [preferRearCamera, setPreferRearCamera] = useState(true);

  return (
    <Card>
      <div style={headerTitle}>置く</div>
      <div style={{ ...headerDesc, marginTop: 6 }}>PDFを置くだけで共有。</div>

      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <StepChip n={1} label="PDFを置く" />
        <StepChip n={2} label="宛先を選ぶ" />
        <StepChip n={3} label="必要なら一言" />
      </div>

      <div style={{ marginTop: 14 }}>
        <Pill>※ まずはPDFを「置く」。それだけでOK。</Pill>
      </div>

      {/* ★PDF未選択なら FileDrop + Scan を最初に出す */}
      {!pdfFile ? (
        <div style={{ marginTop: 14 }}>
          <FileDrop
            onFile={(file) => setPdfFile(file)}
            disabled={sending}
            title="PDFをここに置く"
            hint="ドラッグ&ドロップ / クリックで選択"
          />

          {/* 区切り */}
          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: 0.7,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <div
              style={{ flex: 1, height: 1, background: "rgba(15,23,42,0.12)" }}
            />
            <div>または</div>
            <div
              style={{ flex: 1, height: 1, background: "rgba(15,23,42,0.12)" }}
            />
          </div>

          {/* スキャン（紙→PDF→置く） */}
          {!sending ? (
            <div style={{ marginTop: 12 }}>
              {/* ★カメラ切り替え（背面/前面） */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>
                  カメラ
                </div>

                <button
                  type="button"
                  onClick={() => setPreferRearCamera(true)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: `1px solid ${
                      preferRearCamera
                        ? "rgba(15,23,42,0.35)"
                        : "rgba(15,23,42,0.14)"
                    }`,
                    background: preferRearCamera
                      ? "rgba(15,23,42,0.06)"
                      : "white",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  背面（おすすめ）
                </button>

                <button
                  type="button"
                  onClick={() => setPreferRearCamera(false)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: `1px solid ${
                      !preferRearCamera
                        ? "rgba(15,23,42,0.35)"
                        : "rgba(15,23,42,0.14)"
                    }`,
                    background: !preferRearCamera
                      ? "rgba(15,23,42,0.06)"
                      : "white",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  前面
                </button>

                <div style={{ fontSize: 12, opacity: 0.6 }}>
                  黒い場合は切り替えてみてください
                </div>
              </div>

              <ScanCapture
                key={preferRearCamera ? "rear" : "front"} // ★追加：切り替えで再マウント
                filenameBase="紹介状"
                preferRearCamera={preferRearCamera}
                onDone={(file) => setPdfFile(file)}
                onCancel={() => {}}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {/* 選択後の状態 */}
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
                  style={{ width: "100%" }}
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
