// cardSummary.js
// 変更点（案A: title/subtitle を一定ルールに統一）:
// 1. title: 常に original_filename → file_key末尾 → "untitled"（ブレなし）
// 2. subtitle: structured_json がある場合のみ "患者名 / 疑い病名" 形式で整形。
//             structured_json が null の場合は subtitle を出さない（ブレ防止）
// 3. badges / null安全 はそのまま維持

/** 指定文字数を超えたら末尾を省略 */
function trunc(str, len) {
  if (!str) return null;
  const s = String(str).trim();
  if (!s) return null;
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
 *   title: string,                          // 常に非null（filename or "untitled"）
 *   subtitle: string|null,                  // structured_json がある場合のみ
 *   badges: Array<{label: string, tone: object}>
 * }}
 */
export function buildCardSummary(doc, _hospitalMap) {
  const s = doc?.structured_json ?? null;

  // ---- title ----
  // 常に「original_filename → file_key末尾 → "untitled"」で確定（ブレなし）
  const fileKeyTail = doc?.file_key
    ? (doc.file_key.split("/").pop() || null)
    : null;
  const title = doc?.original_filename || fileKeyTail || "untitled";

  // ---- subtitle ----
  // structured_json がある場合のみ表示。なければ null（PDF以外・旧データも非表示）
  // フォーマット: "患者名 / 疑い病名" または各単体
  //   patient_name      … 最大12文字
  //   suspected_diagnosis > chief_complaint … 最大18文字（どちらか一方）
  let subtitle = null;
  if (s) {
    const parts = [
      trunc(s.patient_name, 12),
      trunc(s.suspected_diagnosis || s.chief_complaint, 18),
    ].filter(Boolean);
    subtitle = parts.length > 0 ? parts.join(" / ") : null;
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
