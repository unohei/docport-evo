// SendScreen.jsx
// 送信画面 - GlobalSidebar + 新UIシェル
//
// 変更点（タブ切り替え追加）:
// 1. activeTab "send" / "sent" を使って「送信する」「送信済み」タブを切り替え
// 2. 「送信済み」タブは SentTab のロジックをそのまま流用し新UIに組み込む
// 3. ローカル state 不要 - activeTab / onTabChange で App.jsx と同期

import GlobalSidebar from "../components/receive/GlobalSidebar";
import SendTab from "../tabs/SendTab";
import SentTab from "../tabs/SentTab";
import { DP } from "../components/receive/receiveConstants";

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
  // SentTab props
  qSent,
  setQSent,
  filteredSentDocs,
  nameOf,
  fmt,
  isExpired,
  cancelDocument,
  statusLabel,
  statusTone,
  openPreview,
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
      {/* 左: グローバルサイドバー（受信画面と共通） */}
      <GlobalSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        myHospitalIcon={myHospitalIcon}
        unreadCount={unreadCount}
        onLogout={onLogout}
      />

      {/* 右: メインコンテンツエリア */}
      <div style={{
        flex: 1,
        overflow: "auto",
        background: DP.surface,
        padding: isMobile ? "16px 12px" : "28px 36px",
      }}>
        <div style={{ maxWidth: 740, margin: "0 auto" }}>
          {/* ページヘッダー */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 22,
              fontWeight: 900,
              color: DP.navy,
              letterSpacing: -0.3,
            }}>
              送信
            </div>
            <div style={{
              fontSize: 13,
              color: DP.textSub,
              marginTop: 4,
            }}>
              書類を置いて相手の受け取りBOXに届ける
            </div>
          </div>

          {/* タブ切り替え */}
          <div style={{
            display: "flex",
            gap: 0,
            marginBottom: 20,
            borderBottom: "2px solid rgba(15,23,42,0.1)",
          }}>
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
                  marginBottom: -2,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 送信するタブ */}
          {!isSent && (
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
          )}

          {/* 送信済みタブ（SentTab のロジックをそのまま流用） */}
          {isSent && (
            <SentTab
              headerTitle={{ display: "none" }}
              headerDesc={{ display: "none" }}
              isMobile={isMobile}
              qSent={qSent}
              setQSent={setQSent}
              filteredSentDocs={filteredSentDocs ?? []}
              nameOf={nameOf}
              fmt={fmt}
              isExpired={isExpired}
              cancelDocument={cancelDocument}
              statusLabel={statusLabel}
              statusTone={statusTone}
              openPreview={openPreview}
            />
          )}
        </div>
      </div>
    </div>
  );
}
