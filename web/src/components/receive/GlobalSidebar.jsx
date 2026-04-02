// GlobalSidebar.jsx
// アプリ全体のナビゲーション（64px 固定幅）
// 項目: ホーム(ロゴ) / 受信 / 送信 / 下書き / 設定
// 変更点: BottomNav をnamed exportとして追加（モバイル時に使用）

import { useRef, useState } from "react";
import DocPortLogoIcon from "../../assets/logo/docport_logo_icon_only.svg";
import ReceiveIcon  from "../../assets/logo/receive_box.svg";
import SendIcon     from "../../assets/logo/send_box.svg";
import LogoutIcon   from "../../assets/logo/logout.svg";
import { DP } from "./receiveConstants";

// ---- ユーザーアバターボタン（クリックで画像変更） ----
function AvatarButton({ avatarUrl, onAvatarUpload }) {
  const inputRef   = useRef(null);
  const [busy,     setBusy]     = useState(false);
  const [hovered,  setHovered]  = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setBusy(true);
    try {
      await onAvatarUpload(file);
      setImgError(false); // 新画像で再試行
    } catch (err) {
      console.error("avatar upload:", err);
      alert("画像のアップロードに失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const showImg = avatarUrl && !imgError;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handleChange}
      />
      <button
        onClick={() => !busy && inputRef.current?.click()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="プロフィール画像を変更"
        disabled={busy}
        style={{
          width: 34, height: 34,
          borderRadius: "50%",
          border: hovered
            ? "2px solid rgba(255,255,255,0.55)"
            : "2px solid rgba(255,255,255,0.18)",
          background: showImg ? "transparent" : "rgba(255,255,255,0.12)",
          cursor: busy ? "wait" : "pointer",
          padding: 0,
          overflow: "hidden",
          position: "relative",
          transition: "border-color 140ms ease",
          flexShrink: 0,
        }}
      >
        {/* アバター画像 or プレースホルダー */}
        {busy ? (
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", lineHeight: "34px" }}>…</span>
        ) : showImg ? (
          <img
            src={avatarUrl}
            alt="ユーザー"
            onError={() => setImgError(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <span style={{ fontSize: 18, lineHeight: "30px" }}>👤</span>
        )}

        {/* hoverオーバーレイ */}
        {hovered && !busy && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <span style={{ fontSize: 12, lineHeight: 1 }}>📷</span>
          </div>
        )}
      </button>
    </>
  );
}

function NavIcon({ emoji, iconSrc, label, active, badge, onClick, disabled = false }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={label}
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        border: "none",
        background: active ? "rgba(255,255,255,0.18)" : "transparent",
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        fontSize: 20,
        opacity: disabled ? 0.30 : 1,
        transition: "background 140ms ease",
      }}
    >
      {iconSrc
        ? <img src={iconSrc} alt={label} style={{ width: 26, height: 26, filter: "brightness(0) invert(1)", opacity: active ? 1 : 0.65 }} />
        : <span style={{ lineHeight: 1 }}>{emoji}</span>
      }
      {badge > 0 && (
        <span style={{
          position: "absolute",
          top: 5, right: 5,
          minWidth: 16, height: 16,
          borderRadius: 999,
          background: "#EF4444",
          color: "#fff",
          fontSize: 9,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 3px",
          lineHeight: 1,
        }}>
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

// ---- BottomNav（モバイル用・画面下部固定ナビ） ----
export function BottomNav({
  activeTab,
  onTabChange,
  myAvatarUrl,
  onAvatarUpload,
  unreadCount,
}) {
  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      height: 56,
      background: DP.navy,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-around",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      zIndex: 200,
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      <NavIcon
        iconSrc={ReceiveIcon}
        label="受信"
        active={activeTab === "inbox"}
        badge={unreadCount}
        onClick={() => onTabChange("inbox")}
      />
      <NavIcon
        iconSrc={SendIcon}
        label="送信"
        active={activeTab === "send" || activeTab === "sent"}
        onClick={() => onTabChange("send")}
      />
      {/* 下書き（未実装: デモ非表示）<NavIcon emoji="📝" label="下書き" active={false} disabled /> */}
      {/* 設定（未実装: デモ非表示）<NavIcon emoji="⚙️" label="設定" active={false} disabled /> */}
      {/* ユーザー（未実装: デモ非表示）<AvatarButton avatarUrl={myAvatarUrl} onAvatarUpload={onAvatarUpload} /> */}
    </div>
  );
}

export default function GlobalSidebar({
  activeTab,
  onTabChange,
  myHospitalIcon,
  myAvatarUrl,
  onAvatarUpload,
  unreadCount,
  onLogout,
}) {
  return (
    <div style={{
      width: 64,
      flexShrink: 0,
      background: DP.navy,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "10px 0",
      gap: 2,
      borderRight: "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* ロゴ — ホーム兼用 */}
      <button
        onClick={() => onTabChange("inbox")}
        title="ホーム"
        style={{
          width: 48, height: 48,
          borderRadius: 13,
          border: "none",
          background: "rgba(255,255,255,0.10)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 5,
          marginBottom: 10,
        }}
      >
        <img src={DocPortLogoIcon} alt="DocPort" style={{ width: 32, height: 32 }} />
      </button>

      {/* メインナビ */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        alignItems: "center",
      }}>
        {/* 受信 */}
        <NavIcon
          iconSrc={ReceiveIcon}
          label="受信"
          active={activeTab === "inbox"}
          badge={unreadCount}
          onClick={() => onTabChange("inbox")}
        />
        {/* 送信 */}
        <NavIcon
          iconSrc={SendIcon}
          label="送信"
          active={activeTab === "send"}
          onClick={() => onTabChange("send")}
        />
        {/* 下書き（未実装: デモ非表示）
        <NavIcon
          emoji="📝"
          label="下書き（準備中）"
          active={activeTab === "draft"}
          disabled
        /> */}
        {/* 設定（未実装: デモ非表示）
        <NavIcon
          emoji="⚙️"
          label="設定（準備中）"
          active={activeTab === "settings"}
          disabled
        /> */}
      </div>

      {/* ボトム: 病院アイコン + ログアウト */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        paddingBottom: 4,
      }}>
        {myHospitalIcon && (
          <img
            src={myHospitalIcon}
            alt="病院"
            style={{
              width: 34, height: 34,
              borderRadius: 9,
              border: "2px solid rgba(255,255,255,0.18)",
              objectFit: "cover",
            }}
          />
        )}
        {/* ユーザーアバター（未実装: デモ非表示）
        <AvatarButton avatarUrl={myAvatarUrl} onAvatarUpload={onAvatarUpload} /> */}
        <NavIcon iconSrc={LogoutIcon} label="ログアウト" active={false} onClick={onLogout} />
      </div>
    </div>
  );
}
