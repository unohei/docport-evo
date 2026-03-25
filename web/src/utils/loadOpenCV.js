// loadOpenCV.js
// OpenCV.js をレイジーロードするユーティリティ
//
// 変更点:
// 1. グローバル script タグを廃止し、スキャン時のみ動的に読み込む
// 2. 読み込み済みキャッシュ（モジュールスコープ promise）で2回目以降は即解決
// 3. 読み込み時間を console に計測ログとして出力

let _cachedPromise = null;

/**
 * OpenCV.js を動的にロードし、cv.Mat が利用可能になったら解決する Promise を返す。
 * 2回目以降の呼び出しは同じ Promise を返す（ブラウザキャッシュ + モジュールキャッシュ）。
 */
export function loadOpenCV() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadOpenCV: no window"));
  }

  // すでに読み込み済み
  if (window.cv?.Mat) return Promise.resolve(window.cv);

  // 読み込み中 or 読み込み済み promise を返す
  if (_cachedPromise) return _cachedPromise;

  const t0 = performance.now();

  _cachedPromise = new Promise((resolve, reject) => {
    // script 注入
    const script = document.createElement("script");
    script.src = "/vendor/opencv.js";
    script.async = true;
    script.onerror = () => {
      _cachedPromise = null; // 次回リトライを許可
      reject(new Error("OpenCV.js の読み込みに失敗しました。ネットワークを確認してください。"));
    };
    document.head.appendChild(script);

    // cv.Mat が利用可能になるまでポーリング
    const POLL_INTERVAL = 100; // ms
    const MAX_WAIT = 30_000;   // 30秒でタイムアウト
    let elapsed = 0;

    const poll = setInterval(() => {
      elapsed += POLL_INTERVAL;

      if (window.cv?.Mat) {
        clearInterval(poll);
        const ms = Math.round(performance.now() - t0);
        console.log(`[DocPort:Perf] OpenCV ready in ${ms}ms`);
        // sessionStorage にも記録（計測基盤）
        try {
          sessionStorage.setItem("dp_opencv_load_ms", String(ms));
        } catch { /* ignore */ }
        resolve(window.cv);
        return;
      }

      if (elapsed >= MAX_WAIT) {
        clearInterval(poll);
        _cachedPromise = null;
        reject(new Error("OpenCV.js の初期化がタイムアウトしました（30秒）"));
      }
    }, POLL_INTERVAL);
  });

  return _cachedPromise;
}

/**
 * sessionStorage に保存した計測値を返す（デバッグ・計測用）
 */
export function getOpenCVLoadMs() {
  try {
    const v = sessionStorage.getItem("dp_opencv_load_ms");
    return v ? parseInt(v, 10) : null;
  } catch {
    return null;
  }
}
