// structuredFormat.js
// 構造化JSON（v1/v2）の共通ユーティリティ
// - normalizeStructuredJson : v1→v2 フィールド名正規化（後方互換）
// - toKarteText             : カルテ貼り付け用テキスト生成
// - STRUCTURED_FIELDS       : 表示フィールド定義（順序保持）

/** gender の内部値 → 表示用日本語 */
export const GENDER_DISPLAY = {
  male:   "男性",
  female: "女性",
  other:  "その他",
};

/**
 * カルテ貼り付け用テキストに出力するフィールド定義。
 * キー名は v2 スキーマ準拠。ラベルは医療現場向け表記。
 */
export const STRUCTURED_FIELDS = [
  ["patient_name",        "患者名"],
  ["patient_id",          "患者ID"],
  ["date_of_birth",       "生年月日"],
  ["gender",              "性別"],
  ["referring_hospital",  "紹介元医療機関"],
  ["referring_doctor",    "紹介元医師"],
  ["department",          "診療科"],
  ["target_hospital",     "紹介先医療機関"],
  ["referral_date",       "紹介日"],
  ["chief_complaint",     "主訴"],
  ["diagnosis",           "診断"],
  ["purpose_of_referral", "紹介目的"],
  ["allergy",             "アレルギー"],
  ["medication",          "内服薬"],
  ["past_history",        "既往歴"],
  ["notes",               "備考"],
];

/**
 * v1 → v2 フィールド名正規化（後方互換）。
 * null 入力は null を返す。
 *
 * v1 旧キー名:
 *   birth_date / referrer_hospital / referrer_doctor / referral_to_hospital /
 *   suspected_diagnosis / allergies / medications
 * v2 新キー名:
 *   date_of_birth / referring_hospital / referring_doctor / target_hospital /
 *   diagnosis / allergy / medication（＋ gender / department / purpose_of_referral / past_history / notes）
 */
export function normalizeStructuredJson(raw) {
  if (!raw) return null;
  return {
    ...raw,
    date_of_birth:      raw.date_of_birth      ?? raw.birth_date           ?? null,
    referring_hospital: raw.referring_hospital  ?? raw.referrer_hospital    ?? null,
    referring_doctor:   raw.referring_doctor    ?? raw.referrer_doctor      ?? null,
    target_hospital:    raw.target_hospital     ?? raw.referral_to_hospital ?? null,
    diagnosis:          raw.diagnosis           ?? raw.suspected_diagnosis  ?? null,
    allergy:            raw.allergy             ?? raw.allergies            ?? null,
    medication:         raw.medication          ?? raw.medications          ?? null,
  };
}

/**
 * 正規化済みの structured_json → カルテ貼り付け用テキスト。
 * null 値は空文字として出力する（"患者名: " のように末尾を空白で揃える）。
 */
export function toKarteText(sj) {
  if (!sj) return "";
  return STRUCTURED_FIELDS
    .map(([key, label]) => {
      let val = sj[key] ?? "";
      if (key === "gender") val = GENDER_DISPLAY[val] ?? (val || "");
      return `${label}: ${val}`;
    })
    .join("\n");
}
