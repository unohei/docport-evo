// SendScreen.jsx
// 送信画面 - GlobalSidebar + 新UIシェルで SendTab を包む
// ReceiveScreen と並列に存在し、アプリ全体の世界観を統一する
//
// 変更点:
// 1. GlobalSidebar を共有し、受信画面と同一のナビゲーション体験を提供
// 2. 右側メインエリアは DP.surface 背景で新UIと統一
// 3. SendTab のロジックはそのまま流用（最小差分）

import GlobalSidebar from "../components/receive/GlobalSidebar";
import SendTab from "../tabs/SendTab";
import { DP } from "../components/receive/receiveConstants";

export default function SendScreen({
  // ナビゲーション
  activeTab,
  onTabChange,
  onLogout,
  myHospitalIcon,
  unreadCount,
  // SendTab に渡す props
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
  isMobile,
}) {
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
          <div style={{ marginBottom: 24 }}>
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

          {/* SendTab（"置く" タイトルは非表示にして SendScreen ヘッダーに統一） */}
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
    </div>
  );
}
