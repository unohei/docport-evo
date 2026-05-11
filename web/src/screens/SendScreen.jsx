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
//
// 変更点 (医療SaaS配色):
// - トップバー背景を水色 DP.navBg(#7EA9D6) へ
// - 検索ボックスは白ピル + ダーク文字 + ミント focus リング
// - タブ「置く / 置いた書類」の選択色を青系 → ミントへ

import { useState } from "react";
import GlobalSidebar, { BottomNav } from "../components/receive/GlobalSidebar";
import { useMediaQuery } from "../hooks/useMediaQuery";
import SendTab           from "../tabs/SendTab";
import SentHistoryPanel  from "../components/sent/SentHistoryPanel";
import { DP }            from "../components/receive/receiveConstants";
import LogoutIcon        from "../assets/logo/logout.svg";
import DocPortLogoIcon   from "../assets/logo/docport_logo_icon_only.svg";

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
  finalizeSelfDocument,
  userId,
  allowedMimeExt,
  departments,
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
        {/* ---- トップバー（DP.navBg / 高さ48px固定）
              サイドバーと同色でL字のブランドフレームを形成 ---- */}
        <div style={{
          height: 48,
          flexShrink: 0,
          background: DP.navBg,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 12,
        }}>
          {/* ブランドマーク + 区分ラベルを密にペアリング */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <img
              src={DocPortLogoIcon}
              alt=""
              aria-hidden="true"
              style={{ width: 20, height: 21, opacity: 0.92, display: "block" }}
            />
            <span style={{
              fontSize: 15,
              fontWeight: 800,
              color: "#FFFFFF",
              letterSpacing: 0.3,
              userSelect: "none",
            }}>
              置く
            </span>
          </div>

          {/* 検索: 置いた書類タブ時にPC・タブレット・スマホすべてで表示 */}
          {isSent ? (
            <div style={{ flex: 1, position: "relative", maxWidth: 300 }}>
              <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "rgba(15,23,42,0.45)", pointerEvents: "none" }}>🔍</span>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="病院名・書類名で検索"
                className="dp-input-dark"
                style={{ width: "100%", padding: "7px 10px 7px 28px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.92)", color: DP.text, fontSize: 12, boxSizing: "border-box" }}
              />
            </div>
          ) : (
            <div style={{ flex: 1 }} />
          )}

          {/* ログアウトボタン（モバイル専用） */}
          {isMobileActual && onLogout && (
            <button
              onClick={onLogout}
              title="ログアウト"
              style={{
                width: 34, height: 34,
                border: "1px solid rgba(255,255,255,0.45)",
                borderRadius: 8,
                background: "rgba(255,255,255,0.20)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
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
        {/* フローライン: トップバーとタブ領域の間に配置 */}
        <div className="dp-flow-line" />

        {/* ---- タブ領域（トップバーと明確に分離した別レイヤー）
              background: DP.surface でトップバーのDP.navBgと視覚的に分離 ---- */}
        <div style={{
          background: DP.surface,
          borderBottom: `1px solid ${DP.border}`,
          flexShrink: 0,
          padding: "0 20px",
          display: "flex",
          gap: 0,
        }}>
          {[
            { key: "send", label: "置く" },
            { key: "sent", label: "置いた書類" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              style={{
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: activeTab === key ? 700 : 500,
                // 選択中タブ: ミント（青系 → ミント差し替え）
                color: activeTab === key ? DP.mintDeep : DP.textSub,
                background: "none",
                border: "none",
                borderBottom: activeTab === key
                  ? `2px solid ${DP.mint}`
                  : "2px solid transparent",
                marginBottom: -1,
                cursor: "pointer",
                transition: "color 140ms ease, border-color 140ms ease",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {label}
            </button>
          ))}
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
                finalizeSelfDocument={finalizeSelfDocument}
                userId={userId}
                allowedMimeExt={allowedMimeExt}
                departments={departments}
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
              // トップバー検索と連動（スマホ含む全サイズ）
              searchQuery={q}
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
