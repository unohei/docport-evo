import "../index.css";

// ---- BrandWaveLines ----
// ログイン画面と同じ波線モチーフをログイン後画面にも引き継ぐ。
// position:fixed で全画面の底部に共通表示。
// pointer-events:none / z-index:0 / opacity:0.10 でコンテンツ可読性に影響しない。
// waveFlow アニメーションは index.css で定義済み（translateX -10px、8〜14s）。
function BrandWaveLines() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 88,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
        opacity: 0.10,
      }}
    >
      <svg
        viewBox="0 0 1440 88"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        {/* 波1: 前面 / ブランドブルー / strokeWidth 1.8 */}
        <path
          d="M0,38 C360,56 720,20 1080,38 C1260,47 1360,30 1440,38"
          stroke="#4A90E2" strokeWidth="1.8" fill="none"
          style={{ animation: "waveFlow 8s ease-in-out infinite" }}
        />
        {/* 波2: 中間 / ブランドブルー / strokeWidth 1.3 */}
        <path
          d="M0,52 C360,30 720,68 1080,52 C1260,42 1360,62 1440,52"
          stroke="#4A90E2" strokeWidth="1.3" fill="none"
          style={{ animation: "waveFlow 11s ease-in-out infinite" }}
        />
        {/* 波3: 後面 / ブランドネイビー / strokeWidth 1 */}
        <path
          d="M0,65 C360,46 720,79 1080,65 C1260,55 1360,73 1440,65"
          stroke="#1F3A6D" strokeWidth="1" fill="none"
          style={{ animation: "waveFlow 14s ease-in-out infinite" }}
        />
      </svg>
    </div>
  );
}

export default function Root({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "transparent",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {children}
      <BrandWaveLines />
    </div>
  );
}
