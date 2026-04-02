// SentHistoryPanel.jsx
// 送信済みパネル（2カラム: カード一覧 + 詳細ペイン）
// 変更点: isMobile prop 追加 → モバイル時は一覧↔詳細の1画面遷移型UIに切替

import { useState, useMemo } from "react";
import { DP } from "../receive/receiveConstants";
import SentCard from "./SentCard";
import SentDetailPane from "./SentDetailPane";

export default function SentHistoryPanel({
  docs,
  nameOf,
  iconOf,
  fmt,
  isExpired,
  cancelDocument,
  fetchPreviewUrl,
  fetchDownloadUrl,
  isMobile = false,
}) {
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return docs;
    return docs.filter(d => {
      const to    = nameOf(d.to_hospital_id).toLowerCase();
      const cmt   = (d.comment || "").toLowerCase();
      const fname = (d.original_filename || "").toLowerCase();
      return to.includes(query) || cmt.includes(query) || fname.includes(query);
    });
  }, [docs, q, nameOf]);

  // ---- モバイルレイアウト（一覧↔詳細トグル） ----
  if (isMobile) {
    const showDetail = !!selectedDoc;
    return (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden" }}>
        {showDetail ? (
          <>
            {/* 戻るボタン */}
            <div style={{
              padding: "8px 14px",
              borderBottom: `1px solid ${DP.border}`,
              background: DP.surface,
              flexShrink: 0,
            }}>
              <button
                onClick={() => setSelectedDoc(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: DP.navy,
                  fontSize: 14,
                  fontWeight: 700,
                  padding: "4px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                ← 一覧に戻る
              </button>
            </div>
            {/* 詳細ペイン */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              <SentDetailPane
                doc={selectedDoc}
                nameOf={nameOf}
                iconOf={iconOf}
                fmt={fmt}
                isExpired={isExpired}
                cancelDocument={cancelDocument}
                fetchPreviewUrl={fetchPreviewUrl}
                fetchDownloadUrl={fetchDownloadUrl}
              />
            </div>
          </>
        ) : (
          <>
            {/* カード一覧ヘッダー */}
            <div style={{
              padding: "14px 14px 10px",
              borderBottom: `1px solid ${DP.border}`,
              background: DP.white,
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: DP.navy }}>送信済み</span>
                <span style={{ fontSize: 13, color: DP.textSub, fontWeight: 600 }}>{filtered.length}件</span>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="病院名・書類名で検索"
                  style={{
                    width: "100%",
                    padding: "7px 10px 7px 28px",
                    borderRadius: 8,
                    border: `1px solid ${DP.border}`,
                    outline: "none",
                    fontSize: 12,
                    color: DP.text,
                    background: "#F1F5F9",
                    boxSizing: "border-box",
                  }}
                />
                <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, opacity: 0.4, pointerEvents: "none" }}>🔍</span>
              </div>
            </div>
            {/* カード一覧 */}
            <div style={{ flex: 1, overflow: "auto", padding: "8px 10px", display: "grid", gap: 6, alignContent: "start" }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "32px 0", textAlign: "center", color: DP.textSub, fontSize: 13 }}>
                  送信済み書類がありません
                </div>
              ) : (
                filtered.map(doc => (
                  <SentCard
                    key={doc.id}
                    doc={doc}
                    nameOf={nameOf}
                    iconOf={iconOf}
                    selected={false}
                    onClick={() => setSelectedDoc(doc)}
                    isExpired={isExpired}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ---- PC/タブレットレイアウト（2カラム） ----
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* ---- 左: カード一覧（320px） ---- */}
      <div style={{
        width: 320,
        flexShrink: 0,
        background: "#F8FAFC",
        borderRight: `1px solid ${DP.border}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* ヘッダー */}
        <div style={{
          padding: "14px 14px 10px",
          borderBottom: `1px solid ${DP.border}`,
          background: DP.white,
          flexShrink: 0,
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: DP.navy }}>送信済み</span>
            <span style={{ fontSize: 13, color: DP.textSub, fontWeight: 600 }}>
              {filtered.length}件
            </span>
          </div>
          {/* 検索 */}
          <div style={{ position: "relative" }}>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="病院名・書類名で検索"
              style={{
                width: "100%",
                padding: "7px 10px 7px 28px",
                borderRadius: 8,
                border: `1px solid ${DP.border}`,
                outline: "none",
                fontSize: 12,
                color: DP.text,
                background: "#F1F5F9",
                boxSizing: "border-box",
              }}
            />
            <span style={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 12,
              opacity: 0.4,
              pointerEvents: "none",
            }}>
              🔍
            </span>
          </div>
        </div>

        {/* カード一覧 */}
        <div style={{
          flex: 1,
          overflow: "auto",
          padding: "8px 10px",
          display: "grid",
          gap: 6,
          alignContent: "start",
        }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: "32px 0",
              textAlign: "center",
              color: DP.textSub,
              fontSize: 13,
            }}>
              送信済み書類がありません
            </div>
          ) : (
            filtered.map(doc => (
              <SentCard
                key={doc.id}
                doc={doc}
                nameOf={nameOf}
                iconOf={iconOf}
                selected={selectedDoc?.id === doc.id}
                onClick={() => setSelectedDoc(doc)}
                isExpired={isExpired}
              />
            ))
          )}
        </div>
      </div>

      {/* ---- 右: 詳細ペイン（flex-1） ---- */}
      <SentDetailPane
        doc={selectedDoc}
        nameOf={nameOf}
        iconOf={iconOf}
        fmt={fmt}
        isExpired={isExpired}
        cancelDocument={cancelDocument}
        fetchPreviewUrl={fetchPreviewUrl}
      />
    </div>
  );
}
