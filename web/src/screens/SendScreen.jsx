// SendScreen.jsx
// 送信画面 - GlobalSidebar + タブ切り替え（送信する / 送信済み）
//
// 変更点（送信済みタブ 2ペイン化）:
// 1. タブストリップをヘッダーに固定し、常に表示
// 2. 「送信する」タブ: 従来の SendTab（スクロール可能な入力フォーム）
// 3. 「送信済み」タブ: SentHistoryPanel（カード一覧 + 詳細ペイン）受信画面と同構成
// 4. SentTab.jsx は不要になったため import を削除

import GlobalSidebar     from "../components/receive/GlobalSidebar";
import SendTab           from "../tabs/SendTab";
import SentHistoryPanel  from "../components/sent/SentHistoryPanel";
import { DP }            from "../components/receive/receiveConstants";

export default function SendScreen({
  // ナビゲーション
  activeTab,
  onTabChange,
  onLogout,
  myHospitalIcon,
  unreadCount,
  isMobile,
  // SendTab props
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
  uploadStatus,
  ocrResult,
  ocrError,
  checkMode,
  setCheckMode,
  finalizeDocument,
  userId,
  allowedMimeExt,
  // SentHistoryPanel props
  filteredSentDocs,
  nameOf,
  iconOf,
  fmt,
  isExpired,
  cancelDocument,
  fetchPreviewUrl,
}) {
  const isSent = activeTab === "sent";

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      background: DP.white,
    }}>
      {/* 左: グローバルサイドバー */}
      <GlobalSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        myHospitalIcon={myHospitalIcon}
        unreadCount={unreadCount}
        onLogout={onLogout}
      />

      {/* 右: ヘッダー + コンテンツ */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minWidth: 0,
      }}>
        {/* ---- ヘッダー + タブストリップ（常時固定） ---- */}
        <div style={{
          padding: "16px 24px 0",
          background: DP.surface,
          borderBottom: `1px solid ${DP.border}`,
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: 20,
            fontWeight: 900,
            color: DP.navy,
            letterSpacing: -0.3,
            marginBottom: 2,
          }}>
            送信
          </div>
          <div style={{ fontSize: 12, color: DP.textSub, marginBottom: 10 }}>
            書類を置いて相手の受け取りBOXに届ける
          </div>

          {/* タブ */}
          <div style={{ display: "flex", gap: 0 }}>
            {[
              { key: "send", label: "送信する" },
              { key: "sent", label: "送信済み" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => onTabChange(key)}
                style={{
                  padding: "8px 18px",
                  fontSize: 14,
                  fontWeight: activeTab === key ? 700 : 400,
                  color: activeTab === key ? DP.navy : DP.textSub,
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === key
                    ? `2px solid ${DP.navy}`
                    : "2px solid transparent",
                  marginBottom: -1,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- 送信するタブ: スクロール可能フォーム ---- */}
        {!isSent && (
          <div style={{
            flex: 1,
            overflow: "auto",
            background: DP.surface,
            padding: isMobile ? "20px 12px" : "24px 36px",
          }}>
            <div style={{ maxWidth: 740, margin: "0 auto" }}>
              <SendTab
                headerTitle={{ display: "none" }}
                isMobile={isMobile}
                myHospitalId={myHospitalId}
                hospitals={hospitals}
                toHospitalId={toHospitalId}
                setToHospitalId={setToHospitalId}
                comment={comment}
                setComment={setComment}
                pdfFile={pdfFile}
                onFileDrop={onFileDrop}
                onCancelFile={onCancelFile}
                sending={sending}
                uploadStatus={uploadStatus}
                ocrResult={ocrResult}
                ocrError={ocrError}
                checkMode={checkMode}
                setCheckMode={setCheckMode}
                finalizeDocument={finalizeDocument}
                userId={userId}
                allowedMimeExt={allowedMimeExt}
              />
            </div>
          </div>
        )}

        {/* ---- 送信済みタブ: 2ペイン（カード一覧 + 詳細） ---- */}
        {isSent && (
          <div style={{ flex: 1, overflow: "hidden" }}>
            <SentHistoryPanel
              docs={filteredSentDocs ?? []}
              nameOf={nameOf}
              iconOf={iconOf}
              fmt={fmt}
              isExpired={isExpired}
              cancelDocument={cancelDocument}
              fetchPreviewUrl={fetchPreviewUrl}
            />
          </div>
        )}
      </div>
    </div>
  );
}
