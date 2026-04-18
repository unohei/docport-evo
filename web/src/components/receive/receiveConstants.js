// receiveConstants.js
// 受信画面コンポーネント群で共有する定数・ヘルパー

// ---- カラーパレット（ロゴ配色準拠: navy / blue / skyLight の3トーン） ----
// UI改善: ロゴのメインネイビー(#1F3A6D)・アクセントブルー(#4A90E2)に統一
export const DP = {
  navy:        "#1F3A6D",                   // ロゴメインネイビー（旧 #0E2A5C）
  blue:        "#4A90E2",                   // ロゴアクセントブルー（旧 #1565C0）
  skyLight:    "#EBF3FD",                   // 選択状態背景（旧 #E8F4FD）
  surface:     "#F5F9FF",                   // サイドパネル背景（旧 #F0F6FF）
  border:      "rgba(31, 58, 109, 0.12)",   // 新ネイビー基準（旧 rgba(14,42,92,0.12)）
  borderActive:"rgba(74, 144, 226, 0.42)",  // 新ブルー基準（旧 rgba(21,101,192,0.35)）
  text:        "#0F172A",
  textSub:     "rgba(15, 23, 42, 0.55)",
  white:       "#FFFFFF",
};

// ---- 部署リスト ----
export const DEPARTMENTS = [
  "地域連携室",
  "医事課",
  "健診センター",
  "薬剤科",
  "検査課",
  "総務",
  "病棟看護師",
  "外来看護師",
];

// ---- ヘルパー ----
export function elapsed(createdAt) {
  if (!createdAt) return "";
  const ms = Date.now() - new Date(createdAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(0, Math.floor(ms / 60_000))}分前`;
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

export function docStatusLabel(doc, isExpired) {
  // isExpired チェック廃止: 期限切れ表示を削除（ファイルは保持されるため）
  if (doc.status === "ARCHIVED")    return "完了";
  if (doc.status === "UPLOADED")    return "未対応";
  if (doc.status === "ARRIVED")     return "未対応";  // FAX受信の旧ステータス
  if (doc.status === "IN_PROGRESS") return "対応中";
  if (doc.status === "DOWNLOADED")  return "既読";
  if (doc.status === "CANCELLED")   return "取消";
  return "-";
}

export function docStatusColor(doc, isExpired) {
  // isExpired チェック廃止: 期限切れ表示を削除（ファイルは保持されるため）
  if (doc.status === "ARCHIVED")    return { text: "#047857", bg: "rgba(4,120,87,0.10)" };
  if (doc.status === "UPLOADED")    return { text: DP.blue,   bg: "rgba(21,101,192,0.10)" };
  if (doc.status === "ARRIVED")     return { text: DP.blue,   bg: "rgba(21,101,192,0.10)" };
  if (doc.status === "IN_PROGRESS") return { text: "#B45309", bg: "rgba(180,83,9,0.10)" };
  if (doc.status === "DOWNLOADED")  return { text: "#047857", bg: "rgba(4,120,87,0.08)" };
  return { text: DP.textSub, bg: "rgba(15,23,42,0.06)" };
}

// ---- 送信元・宛先の表示ラベル ----
// FAX受信では from_hospital_id = to_hospital_id（暫定値）のため、
// source=fax の場合は from_fax_number / to_fax_number を優先する
export function senderDisplay(doc, nameOf) {
  if (doc.source === "fax") return doc.from_fax_number || "不明（FAX）";
  return (nameOf && doc.from_hospital_id) ? nameOf(doc.from_hospital_id) || "不明" : "不明";
}

export function recipientDisplay(doc, nameOf) {
  if (doc.source === "fax")          return doc.to_fax_number   || "不明（FAX）";
  if (doc.source === "fax_outbound") return doc.to_fax_number   || "不明（FAX送信）";
  return (nameOf && doc.to_hospital_id) ? nameOf(doc.to_hospital_id) || "不明" : "不明";
}

export function isFaxOutbound(doc) {
  return doc.source === "fax_outbound";
}
