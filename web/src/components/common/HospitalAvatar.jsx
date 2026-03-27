// HospitalAvatar.jsx
// 病院アイコン表示コンポーネント
// - iconUrl があれば img 表示（読み込み失敗時は頭文字プレースホルダーに切替）
// - なければ name の1文字で丸いプレースホルダー

import { useState } from "react";

export default function HospitalAvatar({ name = "", iconUrl = "", size = 28 }) {
  const [imgError, setImgError] = useState(false);

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
  };

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
