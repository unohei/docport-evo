// cardSummary.js
// 変更点:
// 1. 参照先を doc.structured → doc.structured_json に変更（DB永続化対応）
// 2. structured_updated_by === 'human' の場合に「人が修正」バッジを追加（優先3位）
// 3. structured_json が NULL でも安全に動作（既存データ対応）

/** 20文字超えたら末尾を省略 */
function trunc(str, len = 20) {
  if (!str) return null;
  const s = String(str);
  return s.length > len ? s.slice(0, len) + "…" : s;
}

/** expires_at が過去かどうか */
function isExpiredDate(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

// バッジ色定義
const TONE = {
  expired:    { bg: "rgba(254,202,202,0.85)", text: "#991b1b", border: "rgba(153,27,27,0.3)" },
  warning:    { bg: "rgba(254,243,199,0.9)",  text: "#92400e", border: "rgba(146,64,14,0.3)" },
  human:      { bg: "rgba(251,207,232,0.9)",  text: "#9d174d", border: "rgba(157,23,77,0.28)" },
  structured: { bg: "rgba(186,230,253,0.9)",  text: "#0c4a6e", border: "rgba(12,74,110,0.25)" },
  nonpdf:     { bg: "rgba(233,213,255,0.9)",  text: "#4c1d95", border: "rgba(76,29,149,0.25)" },
  read:       { bg: "rgba(209,250,229,0.85)", text: "#065f46", border: "rgba(6,95,70,0.25)" },
};

/**
 * カード表示用の要約を生成する。
 *
 * @param {object} doc         - documents テーブルの行
 * @param {object} [_hospitalMap] - 将来拡張用（現在未使用）
 * @returns {{
 *   title: string|null,
 *   subtitle: string|null,
 *   badges: Array<{label: string, tone: object}>
 * }}
 */
export function buildCardSummary(doc, _hospitalMap) {
  // structured_json は DB永続化された JSONB カラム（NULL の場合もある）
  const s = doc?.structured_json ?? null;

  // ---- title ----
  // patient_name > original_filename > null（null の場合は上部セクションを非表示）
  const title = s?.patient_name || doc?.original_filename || null;

  // ---- subtitle ----
  // suspected_diagnosis（25文字以内）> chief_complaint（20文字で省略）> null
  let subtitle = null;
  if (s) {
    const diag = s.suspected_diagnosis;
    const complaint = s.chief_complaint;
    if (diag && String(diag).length <= 25) {
      subtitle = diag;
    } else if (complaint) {
      subtitle = trunc(complaint, 20);
    }
  }

  // ---- badges（最大3個、優先度順） ----
  const candidates = [];

  // 1. 期限切れ
  if (isExpiredDate(doc?.expires_at)) {
    candidates.push({ label: "期限切れ", tone: TONE.expired });
  }

  // 2. 要配慮（structured_json.warnings あり）
  if (s?.warnings?.length > 0) {
    candidates.push({ label: "要配慮", tone: TONE.warning });
  }

  // 3. 人が修正（structured_updated_by === 'human'）
  if (s !== null && doc?.structured_updated_by === "human") {
    candidates.push({ label: "人が修正", tone: TONE.human });
  }

  // 4. 構造化済（AI 抽出のみ）
  if (s !== null && doc?.structured_updated_by !== "human") {
    candidates.push({ label: "構造化済", tone: TONE.structured });
  }

  // 5. 原本が PDF 以外
  const ext = doc?.file_ext?.toLowerCase();
  if (ext && ext !== "pdf") {
    candidates.push({ label: ext.toUpperCase(), tone: TONE.nonpdf });
  }

  // 6. 既読
  if (doc?.status === "DOWNLOADED") {
    candidates.push({ label: "既読", tone: TONE.read });
  }

  return { title, subtitle, badges: candidates.slice(0, 3) };
}
