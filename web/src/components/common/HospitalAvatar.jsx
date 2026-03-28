// HospitalAvatar.jsx
// 病院アイコン表示コンポーネント
// - isFax=true の場合は FAX専用アバター（📠）を表示（自院アイコンの誤表示を防ぐ）
// - iconUrl があれば img 表示（読み込み失敗時は頭文字プレースホルダーに切替）
// - なければ name の1文字で丸いプレースホルダー

import { useState } from "react";

export default function HospitalAvatar({ name = "", iconUrl = "", size = 28, isFax = false }) {
  const [imgError, setImgError] = useState(false);

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
  };

  // FAX専用アバター: 外部FAXを病院アイコンで表示しない
  if (isFax) {
    return (
      <div style={{
        ...baseStyle,
        background: "#F1F5F9",
        border: "1px solid #CBD5E1",
        color: "#64748B",
        fontSize: Math.floor(size * 0.55),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        📠
      </div>
    );
  }

  if (iconUrl && !imgError) {
    return (
      <img
        src={iconUrl}
        alt={name}
        onError={() => setImgError(true)}
        style={{ ...baseStyle, objectFit: "cover", display: "block" }}
      />
    );
  }

  return (
    <div style={{
      ...baseStyle,
      background: "#DBEAFE",
      color: "#1E40AF",
      fontSize: Math.floor(size * 0.45),
      fontWeight: 800,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {name ? name.charAt(0) : "?"}
    </div>
  );
}
