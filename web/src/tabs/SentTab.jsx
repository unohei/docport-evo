// SentTab.jsx
// 変更点（カード用要約追加）:
// 1. buildCardSummary を import し、各カード上部に title/subtitle を表示
// 2. 各カード下部（ボタン行の直前）にバッジ行を追加（最大3個）
// 3. 既存のカードレイアウトは変更なし

import {
  Card,
  Pill,
  PrimaryButton,
  SecondaryButton,
  TextInput,
} from "../components/ui/primitives";
import { buildCardSummary } from "../utils/cardSummary";

export default function SentTab({
  headerTitle,
  headerDesc,
  isMobile,
  qSent,
  setQSent,
  filteredSentDocs,
  nameOf,
  fmt,
  isExpired,
  cancelDocument,
  statusLabel,
  statusTone,
  openPreview, // ★変更：プレビュー起動
}) {
  const getThumbUrl = (doc) =>
    doc?.thumb_url || doc?.thumbnail_url || doc?.thumbUrl || "";

  const canOpen = (doc) => !!openPreview;

  return (
    <Card>
      <div style={headerTitle}>記録</div>
      <div style={{ ...headerDesc, marginTop: 6 }}>
        置いた履歴（未読のうちは取り消し可）
      </div>

      <div style={{ marginTop: 14 }}>
        <TextInput
          value={qSent}
          onChange={(e) => setQSent(e.target.value)}
          placeholder="検索（病院名 / コメント）"
          style={{ maxWidth: isMobile ? "100%" : 420 }}
        />
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {filteredSentDocs.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.7, padding: 8 }}>
            記録はまだありません。
          </div>
        ) : (
          filteredSentDocs.map((doc) => {
            const expired = isExpired(doc.expires_at);
            const thumbUrl = getThumbUrl(doc);
            const summary = buildCardSummary(doc);

            return (
              <div
                key={doc.id}
                style={{
                  backgroundColor: "rgba(255, 254, 200, 0.55)", // 付箋（黄色）
                  border: "1px solid rgba(15,23,42,0.12)",
                  borderRadius: 12,
                  padding: 12,
                  display: "grid",
                  gap: 10,
                  boxShadow: "0 6px 14px rgba(15, 23, 42, 0.08)",
                }}
              >
                {/* ── カード上部：title / subtitle ── */}
                {summary.title && (
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.4,
                      paddingBottom: 6,
                      borderBottom: "1px solid rgba(15,23,42,0.09)",
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      alignItems: "baseline",
                    }}
                  >
                    <span style={{ fontWeight: 800, color: "#0f172a" }}>
                      {summary.title}
                    </span>
                    {summary.subtitle && (
                      <span style={{ opacity: 0.6, fontSize: 11 }}>
                        {summary.subtitle}
                      </span>
                    )}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {/* 左：サムネ + 情報 */}
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      minWidth: 0,
                      alignItems: "flex-start",
                      flex: 1,
                    }}
                  >
                    {/* サムネ（タップでプレビュー） */}
                    <button
                      onClick={() => openPreview(doc)}
                      disabled={!canOpen(doc)}
                      title={canOpen(doc) ? "プレビュー" : "開けません"}
                      style={{
                        width: 86,
                        height: 86,
                        borderRadius: 10,
                        border: "1px solid rgba(15,23,42,0.12)",
                        background: "rgba(255,255,255,0.75)",
                        padding: 0,
                        cursor: canOpen(doc) ? "pointer" : "not-allowed",
                        overflow: "hidden",
                        flex: "0 0 auto",
                        opacity: canOpen(doc) ? 1 : 0.6,
                      }}
                    >
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt="thumb"
                          loading="lazy"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "grid",
                            placeItems: "center",
                            fontSize: 22,
                            opacity: 0.8,
                          }}
                        >
                          📄
                        </div>
                      )}
                    </button>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>
                        {nameOf(doc.to_hospital_id)}
                      </div>

                      <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>
                        {fmt(doc.created_at)}{" "}
                        {doc.expires_at
                          ? ` / 期限: ${fmt(doc.expires_at)}`
                          : ""}
                      </div>

                      {doc.comment ? (
                        <div
                          style={{ fontSize: 14, opacity: 0.8, marginTop: 6 }}
                        >
                          {doc.comment}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* 右：ステータス */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <Pill tone={statusTone(doc)}>
                      {expired ? "期限切れ" : statusLabel(doc.status)}
                    </Pill>
                  </div>
                </div>

                {/* ── カード下部：badges ── */}
                {summary.badges.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {summary.badges.map((b, i) => (
                      <Pill
                        key={i}
                        tone={b.tone}
                        style={{ fontSize: 11, padding: "3px 9px" }}
                      >
                        {b.label}
                      </Pill>
                    ))}
                  </div>
                )}

                {/* ボタン */}
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    justifyContent: "flex-end",
                    flexWrap: "wrap",
                  }}
                >
                  <PrimaryButton
                    onClick={() => openPreview(doc)}
                    disabled={!canOpen(doc)}
                  >
                    プレビュー
                  </PrimaryButton>

                  <SecondaryButton
                    onClick={() => cancelDocument(doc)}
                    disabled={doc.status !== "UPLOADED" || expired}
                  >
                    取り消す
                  </SecondaryButton>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
