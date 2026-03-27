// loadOpenCV.js
// OpenCV.js をレイジーロードするユーティリティ
//
// 変更点 (v2):
// 1. resolve() を引数なしで呼ぶ（thenable 固着バグ修正）
//    @techstark/opencv-js の window.cv は Emscripten Module であり .then を持つ thenable。
//    resolve(window.cv) を渡すと Promise 仕様上 Module.then が採用され
//    await loadOpenCV() が永久に pending になる。→ resolve() で即時解決させる。
// 2. 二重 resolve ガード（settled フラグ）を追加
// 3. 各ポイントに [OpenCV] ログを追加（原因追跡用）

let _cachedPromise = null;

/**
 * OpenCV.js を動的にロードし、cv.Mat が利用可能になったら解決する Promise を返す。
 * 2回目以降の呼び出しは同じ Promise を返す（ブラウザキャッシュ + モジュールキャッシュ）。
 */
export function loadOpenCV() {
  console.log("[OpenCV] load enter");

  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadOpenCV: no window"));
  }

  // すでに読み込み済み
  if (window.cv?.Mat) {
    console.log("[OpenCV] module already ready");
    return Promise.resolve(); // ← 引数なし: thenable 採用を回避
  }

  // 読み込み中 or 読み込み済み promise を返す
  if (_cachedPromise) {
    console.log("[OpenCV] return cached promise");
    return _cachedPromise;
  }

  const t0 = performance.now();

  _cachedPromise = new Promise((resolve, reject) => {
    // 二重 resolve/reject ガード
    let settled = false;
    let poll = null;

    const _resolve = () => {
      if (settled) return;
      settled = true;
      if (poll) clearInterval(poll);
      const ms = Math.round(performance.now() - t0);
      console.log(`[DocPort:Perf] OpenCV ready in ${ms}ms`);
      try { sessionStorage.setItem("dp_opencv_load_ms", String(ms)); } catch { /* ignore */ }
      console.log("[OpenCV] resolve");
      // ★ 引数なし: window.cv（Emscripten thenable）を渡すと
      //    Promise が Module.then を採用して pending のまま固着する
      resolve();
    };

    const _reject = (err) => {
      if (settled) return;
      settled = true;
      if (poll) clearInterval(poll);
      _cachedPromise = null; // 次回リトライを許可
      console.warn("[OpenCV] reject:", err?.message);
      reject(err);
    };

    // script 注入
    const existing = document.querySelector('script[src*="opencv.js"]');
    if (existing) {
      console.log("[OpenCV] script exists");
    } else {
      const script = document.createElement("script");
      script.src = "/vendor/opencv.js";
      script.async = true;
      script.onerror = () => _reject(new Error("OpenCV.js の読み込みに失敗しました。ネットワークを確認してください。"));
      document.head.appendChild(script);
    }

    // cv.Mat が利用可能になるまでポーリング
    const POLL_INTERVAL = 100; // ms
    const MAX_WAIT = 30_000;   // 30秒でタイムアウト
    let elapsed = 0;

    poll = setInterval(() => {
      elapsed += POLL_INTERVAL;

      if (window.cv?.Mat) {
        console.log("[OpenCV] poll: cv.Mat detected");
        _resolve();
        return;
      }

      if (elapsed >= MAX_WAIT) {
        _reject(new Error("OpenCV.js の初期化がタイムアウトしました（30秒）"));
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
