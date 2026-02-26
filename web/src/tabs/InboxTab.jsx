// InboxTab.jsx
// 変更点（カード用要約追加 + title統一）:
// 1. buildCardSummary を import し、各カード上部に title/subtitle を表示
//    - title: 常に original_filename（ブレなし）
//    - subtitle: structured_json がある場合のみ "患者名 / 疑い病名" 形式
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

export default function InboxTab({
  headerTitle,
  headerDesc,
  isMobile,
  showUnreadOnly,
  setShowUnreadOnly,
  showExpired,
  setShowExpired,
  qInbox,
  setQInbox,
  filteredInboxDocs,
  nameOf,
  fmt,
  isExpired,
  openPreview, // ★変更：プレビュー起動
  archiveDocument,
  statusLabel,
  isLegacyKey,
  statusTone,
}) {
  const getThumbUrl = (doc) =>
    doc?.thumb_url || doc?.thumbnail_url || doc?.thumbUrl || "";

  return (
    <Card>
      <div style={headerTitle}>受け取る</div>
      <div style={{ ...headerDesc, marginTop: 6 }}>
        プレビューで確認（右上「端末で開く」も可）
      </div>

      <div
        style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}
      >
        <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
          <input
            type="checkbox"
            checked={showUnreadOnly}
            onChange={(e) => setShowUnreadOnly(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          未読のみ
        </label>

        <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
          <input
            type="checkbox"
            checked={showExpired}
            onChange={(e) => setShowExpired(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          期限切れも表示
        </label>

        <div style={{ flex: 1, minWidth: isMobile ? 200 : 260 }}>
          <TextInput
            value={qInbox}
            onChange={(e) => setQInbox(e.target.value)}
            placeholder="検索（病院名 / コメント）"
          />
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {filteredInboxDocs.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.7, padding: 8 }}>
            受け取りBOXは空です。
          </div>
        ) : (
          filteredInboxDocs.map((doc) => {
            const expired = isExpired(doc.expires_at);
            const legacy = isLegacyKey(doc.file_key);
            const thumbUrl = getThumbUrl(doc);
            const summary = buildCardSummary(doc);

            const disabledOpen =
              expired ||
              doc.status === "CANCELLED" ||
              doc.status === "ARCHIVED";

            return (
              <div
                key={doc.id}
                style={{
                  backgroundColor: "rgba(186, 230, 253, 0.6)", // 付箋（ブルー）
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
                    <button
                      onClick={() => openPreview(doc)}
                      disabled={disabledOpen}
                      title={disabledOpen ? "開けません" : "プレビュー"}
                      style={{
                        width: 86,
                        height: 86,
                        borderRadius: 10,
                        border: "1px solid rgba(15,23,42,0.12)",
                        background: "rgba(255,255,255,0.75)",
                        padding: 0,
                        cursor: disabledOpen ? "not-allowed" : "pointer",
                        overflow: "hidden",
                        flex: "0 0 auto",
                        opacity: disabledOpen ? 0.6 : 1,
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
                        {nameOf(doc.from_hospital_id)}
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

                    {legacy ? (
                      <Pill
                        tone={{
                          bg: "rgba(255, 226, 163, 0.6)",
                          text: "#7a4b00",
                          border: "rgba(122, 75, 0, 0.25)",
                        }}
                      >
                        旧データ
                      </Pill>
                    ) : null}
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
                    disabled={disabledOpen}
                  >
                    プレビュー
                  </PrimaryButton>

                  <SecondaryButton
                    onClick={() => archiveDocument(doc)}
                    disabled={doc.status === "ARCHIVED"}
                  >
                    Archive
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
