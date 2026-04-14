// SendScreen.jsx
// 送信画面 - GlobalSidebar + タブ切り替え（送信する / 送信済み）
//
// 変更点（送信済みタブ 2ペイン化）:
// 1. タブストリップをヘッダーに固定し、常に表示
// 2. 「送信する」タブ: 従来の SendTab（スクロール可能な入力フォーム）
// 3. 「送信済み」タブ: SentHistoryPanel（カード一覧 + 詳細ペイン）受信画面と同構成
// 4. SentTab.jsx は不要になったため import を削除
//
// 変更点（レスポンシブ対応）:
// - モバイル時は GlobalSidebar の代わりに BottomNav を使用
// - isMobile prop がない場合は useMediaQuery で自己判定

import { useState } from "react";
import GlobalSidebar, { BottomNav } from "../components/receive/GlobalSidebar";
import { useMediaQuery } from "../hooks/useMediaQuery";
import SendTab           from "../tabs/SendTab";
import SentHistoryPanel  from "../components/sent/SentHistoryPanel";
import { DP }            from "../components/receive/receiveConstants";
import LogoutIcon        from "../assets/logo/logout.svg";

export default function SendScreen({
  // ナビゲーション
  activeTab,
  onTabChange,
  onLogout,
  myHospitalIcon,
  myAvatarUrl,
  onAvatarUpload,
  unreadCount,
  isMobile,
  // SendTab props
  myHospitalId,
  hospitals,
  contacts,
  recipient,
  setRecipient,
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
  fetchDownloadUrl,
}) {
  const isSent = activeTab === "sent";
  // prop で渡される isMobile を優先、なければ自己判定
  const isMobileQuery = useMediaQuery("(max-width: 639px)");
  const isMobileActual = isMobile ?? isMobileQuery;
  // 送信済みタブ用の検索クエリ（モバイルは SentHistoryPanel 内部 state を使用）
  const [q, setQ] = useState("");

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      background: DP.white,
      // モバイル時は BottomNav 分の下パディング
      ...(isMobileActual && { paddingBottom: "calc(64px + env(safe-area-inset-bottom))", boxSizing: "border-box", flexDirection: "column" }),
    }}>
      {/* 左: グローバルサイドバー（デスクトップ/タブレット時のみ） */}
      {!isMobileActual && (
        <GlobalSidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          myHospitalIcon={myHospitalIcon}
          myAvatarUrl={myAvatarUrl}
          onAvatarUpload={onAvatarUpload}
          unreadCount={unreadCount}
          onLogout={onLogout}
        />
      )}

      {/* 右: ヘッダー + コンテンツ */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minWidth: 0,
      }}>
        {/* ---- ヘッダー + タブストリップ（常時固定）
              サイドバーと同色（DP.navy）でつながったブランドフレームを形成 ---- */}
        <div style={{
          background: DP.navy,
          flexShrink: 0,
        }}>
          {/* タイトル行: スクリーン名 + 検索（送信済みタブ時） + ログアウト（モバイル） */}
          <div style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 20px 0",
            gap: 12,
          }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.50)",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              flexShrink: 0,
              userSelect: "none",
            }}>
              送信
            </span>

            {/* 検索: 送信済みタブ + PC/タブレット時のみ表示 */}
            {isSent && !isMobileActual && (
              <div style={{ flex: 1, position: "relative", maxWidth: 300 }}>
                <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "rgba(255,255,255,0.35)", pointerEvents: "none" }}>🔍</span>
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="病院名・書類名で検索"
                  className="dp-input-dark"
                  style={{ width: "100%", padding: "7px 10px 7px 28px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.90)", fontSize: 12, boxSizing: "border-box" }}
                />
              </div>
            )}

            {/* ログアウトボタン（モバイル専用） */}
            {isMobileActual && onLogout && (
              <button
                onClick={onLogout}
                title="ログアウト"
                style={{
                  width: 34, height: 34,
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.08)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginLeft: "auto",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <img
                  src={LogoutIcon}
                  alt="ログアウト"
                  style={{ width: 18, height: 18, filter: "brightness(0) invert(1)", opacity: 0.65 }}
                />
              </button>
            )}
          </div>

          {/* タブ: 暗背景に合わせて白テキスト */}
          <div style={{ display: "flex", gap: 0, padding: "4px 20px 0" }}>
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
                  color: activeTab === key ? "#fff" : "rgba(255,255,255,0.45)",
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === key
                    ? "2px solid rgba(255,255,255,0.85)"
                    : "2px solid transparent",
                  marginBottom: -1,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {/* フローライン: トップバーの下に流れるアニメーション */}
          <div className="dp-flow-line" />
        </div>

        {/* ---- 送信するタブ: スクロール可能フォーム ---- */}
        {!isSent && (
          <div style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            background: DP.surface,
            padding: isMobileActual ? "20px 12px" : "24px 36px",
          }}>
            <div style={{ maxWidth: 740, margin: "0 auto", width: "100%" }}>
              <SendTab
                headerTitle={{ display: "none" }}
                isMobile={isMobileActual}
                myHospitalId={myHospitalId}
                hospitals={hospitals}
                contacts={contacts}
                recipient={recipient}
                setRecipient={setRecipient}
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
              fetchDownloadUrl={fetchDownloadUrl}
              isMobile={isMobileActual}
              // PC/タブレット: トップバー検索と連動。モバイル: undefined → 内部 state を使用
              searchQuery={isMobileActual ? undefined : q}
            />
          </div>
        )}
      </div>

      {/* モバイル時: BottomNav（固定） */}
      {isMobileActual && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={onTabChange}
          unreadCount={unreadCount}
          myAvatarUrl={myAvatarUrl}
          onAvatarUpload={onAvatarUpload}
        />
      )}
    </div>
  );
}
