// preview.js
// プレビューキー解決とプレビュー可否判定のユーティリティ
//
// 役割:
// - preview_file_key が存在する場合はそちらを優先（将来の自動PDF変換対応）
// - ブラウザ内プレビュー可能な拡張子（pdf/画像系）のみ iframe 表示する
// - それ以外はダウンロード促進 UI に切り替える

/** ブラウザ内 iframe / img でそのまま表示できる拡張子 */
export const PREVIEWABLE_EXTS = new Set(["pdf", "png", "jpg", "jpeg", "webp"]);

/**
 * ファイルキー（or URL）から拡張子を取得する（小文字・クエリ文字列を除外）
 * 例: "documents/abc.PDF" → "pdf"
 */
export function getExtFromKey(key) {
  if (!key) return "";
  const noQuery = key.split("?")[0];
  const filename = noQuery.split("/").pop() || "";
  return (filename.split(".").pop() || "").toLowerCase();
}

/**
 * プレビューに使うキーを決定する。
 * preview_file_key があればそれを優先（変換済み PDF など）。
 * なければ通常の file_key を使う。
 *
 * @param {object} doc - documents テーブルの行
 * @returns {string|null}
 */
export function getPreviewKey(doc) {
  return doc?.preview_file_key || doc?.file_key || null;
}

/**
 * キーの拡張子がブラウザ内プレビュー可能かどうか。
 *
 * @param {string|null} key - file_key または preview_file_key
 * @returns {boolean}
 */
export function isPreviewable(key) {
  return PREVIEWABLE_EXTS.has(getExtFromKey(key));
}
