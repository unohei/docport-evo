// hospitalMatch.js
// 紹介先病院名（OCR structured_json.referral_to_hospital）→ hospitals マスタ候補サジェスト
//
// マッチング戦略:
//   1. 正規化（全角半角スペース除去・末尾サフィックス除去・小文字化）
//   2. スコアリング: 完全一致(100) > OCR名が病院名を含む(70) > 病院名がOCR名を含む(50)
//   3. スコア降順で上位 MAX_CANDIDATES 件を返す（0点は除外）

const MAX_CANDIDATES = 3;

/**
 * 病院名を正規化する。
 * - 全角・半角スペース除去
 * - 末尾サフィックス（病院、医院、クリニック等）除去
 * - 小文字化
 *
 * @param {string} name
 * @returns {string}
 */
export function normalizeForMatch(name) {
  if (!name) return "";
  return name
    .replace(/[\s\u3000]+/g, "")
    .replace(/(病院|医院|クリニック|診療所|センター|医療センター|総合病院)$/, "")
    .toLowerCase();
}

/**
 * 正規化済みの2文字列のマッチスコアを返す（0 = 不一致）。
 *
 * スコア基準:
 *   100 … 完全一致
 *    70 … OCR 名が病院名を含む（「○○大学病院附属」に「○○大学病院」が含まれる等）
 *    50 … 病院名が OCR 名を含む（短縮名・略称でマスタ側が長い等）
 *
 * @param {string} normTarget - OCR の referral_to_hospital（正規化済み）
 * @param {string} normH      - hospitals テーブルの name（正規化済み）
 * @returns {number}
 */
function scoreMatch(normTarget, normH) {
  if (!normTarget || !normH) return 0;
  if (normTarget === normH) return 100;          // 完全一致
  if (normTarget.includes(normH)) return 70;     // OCR 名が病院名を含む（短縮名マッチ）
  if (normH.includes(normTarget)) return 50;     // 病院名が OCR 名を含む
  return 0;                                      // 不一致
}

/**
 * OCR で取得した紹介先病院名に対する候補病院リストを返す。
 *
 * @param {string|null} targetName  - structured_json.referral_to_hospital
 * @param {Array<{id: string, name: string}>} hospitals - 病院マスタ全件
 * @param {string|null} excludeId   - 自院 ID（自院は除外）
 * @returns {Array<{id: string, name: string, score: number}>} スコア降順・最大3件
 */
export function findHospitalCandidates(targetName, hospitals, excludeId) {
  if (!targetName || !hospitals?.length) return [];
  const normTarget = normalizeForMatch(targetName);
  if (!normTarget || normTarget.length < 2) return [];

  const scored = [];
  for (const h of hospitals) {
    if (h.id === excludeId) continue;
    const normH = normalizeForMatch(h.name);
    const score = scoreMatch(normTarget, normH);
    if (score > 0) scored.push({ ...h, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_CANDIDATES);
}
