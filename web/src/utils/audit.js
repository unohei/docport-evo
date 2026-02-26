// audit.js
// 監査ログ v1: document_events への best-effort insert ヘルパー
// - 失敗しても例外を throw しない（監査ログは補助情報。本体処理を止めない）
// - 全イベントをここに集約することで action 名の一覧が一目でわかる
//
// イベント種別（action）:
//   DOC_CREATED     … documents INSERT 成功後
//   OCR_RUN         … /api/ocr 呼び出し成功後（document_id 確定後にまとめて記録）
//   STRUCTURED_EDIT … 構造化情報を人が編集した状態で「置く」確定
//   DOWNLOAD        … 受信側がプレビュー/ダウンロードを開いた時
//   ARCHIVE         … アーカイブ操作
//   CANCEL          … 取り消し操作

import { supabase } from "../supabaseClient";

/**
 * document_events に1行 insert する（best-effort）。
 *
 * @param {string} documentId - documents.id（null の場合は何もしない）
 * @param {string} userId     - auth.uid()（null の場合は何もしない）
 * @param {string} action     - イベント種別（上記コメント参照）
 */
export async function logEvent(documentId, userId, action) {
  if (!documentId || !userId || !action) return;
  try {
    const { error } = await supabase.from("document_events").insert({
      document_id: documentId,
      actor_user_id: userId,
      action,
    });
    if (error) {
      console.warn(`[DocPort] audit log insert failed (${action}):`, error.message);
    }
  } catch (e) {
    console.warn(`[DocPort] audit log error (${action}):`, e?.message ?? e);
  }
}
