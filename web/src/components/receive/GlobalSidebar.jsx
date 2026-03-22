// GlobalSidebar.jsx
// アプリ全体のナビゲーション（64px 固定幅）
// 項目: ホーム(ロゴ) / 受信 / 送信 / 下書き / 設定

import DocPortLogo  from "../../assets/logo/logo.png";
import ReceiveIcon  from "../../assets/logo/receive_box.svg";
import { DP } from "./receiveConstants";

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
        ? <img src={iconSrc} alt={label} style={{ width: 22, height: 22, filter: "brightness(0) invert(1)", opacity: active ? 1 : 0.65 }} />
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

export default function GlobalSidebar({
  activeTab,
  onTabChange,
  myHospitalIcon,
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
          width: 42, height: 42,
          borderRadius: 11,
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
        <img src={DocPortLogo} alt="DocPort" style={{ width: 30, height: 30 }} />
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
          emoji="📤"
          label="送信"
          active={activeTab === "send"}
          onClick={() => onTabChange("send")}
        />
        {/* 下書き（未実装: stub） */}
        <NavIcon
          emoji="📝"
          label="下書き（準備中）"
          active={activeTab === "draft"}
          disabled
        />
        {/* 設定（未実装: stub） */}
        <NavIcon
          emoji="⚙️"
          label="設定（準備中）"
          active={activeTab === "settings"}
          disabled
        />
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
        <button
          onClick={onLogout}
          title="ログアウト"
          style={{
            width: 34, height: 34,
            borderRadius: 9,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            color: "rgba(255,255,255,0.45)",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          出
        </button>
      </div>
    </div>
  );
}
