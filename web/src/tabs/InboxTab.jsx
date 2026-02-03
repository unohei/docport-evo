import {
  Card,
  Pill,
  PrimaryButton,
  SecondaryButton,
  TextInput,
} from "../components/ui/primitives";

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
  downloadDocument,
  archiveDocument,
  statusLabel,
  isLegacyKey,
  statusTone, // ★追加
}) {
  return (
    <Card>
      <div style={headerTitle}>受け取る</div>
      <div style={{ ...headerDesc, marginTop: 6 }}>
        クリックでDL（「未読」から「既読」）
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

            return (
              <div
                key={doc.id}
                style={{
                  border: "1px solid rgba(15,23,42,0.12)",
                  borderRadius: 12,
                  padding: 12,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>
                      {nameOf(doc.from_hospital_id)}
                    </div>
                    <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>
                      {fmt(doc.created_at)}{" "}
                      {doc.expires_at ? ` / 期限: ${fmt(doc.expires_at)}` : ""}
                    </div>
                    {doc.comment ? (
                      <div style={{ fontSize: 14, opacity: 0.8, marginTop: 6 }}>
                        {doc.comment}
                      </div>
                    ) : null}
                  </div>

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

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    justifyContent: "flex-end",
                    flexWrap: "wrap",
                  }}
                >
                  <PrimaryButton
                    onClick={() => downloadDocument(doc)}
                    disabled={
                      expired ||
                      doc.status === "CANCELLED" ||
                      doc.status === "ARCHIVED"
                    }
                  >
                    開く
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
