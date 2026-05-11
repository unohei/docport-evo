// receiveConstants.js
// 受信画面コンポーネント群で共有する定数・ヘルパー

// ---- カラーパレット ----
// 方針: 「医療SaaS / 医療連携OS」感
//   - クロム（サイドバー/トップバー）: 水色ベース（#7EA9D6 系）で清潔感・透明感
//   - アクセント: ミント（#67C8B6 系）を active / selected / focus / badge に限定使用
//   - navy（#1F3A6D）は見出し文字色専用として残置（読みやすさ用途）
//   - blue（#4A90E2）はロゴ準拠の汎用青、ボタンや一部の補助アクセントで継続使用
export const DP = {
  navy:        "#1F3A6D",                   // ロゴメインネイビー（見出し文字色専用）
  blue:        "#4A90E2",                   // ロゴアクセントブルー（ボタン等で継続使用）
  skyLight:    "#EBF3FD",                   // 既存の青系ソフト背景（一部画面で継続使用）
  surface:     "#F5F9FF",                   // サイドパネル背景
  border:      "rgba(31, 58, 109, 0.12)",
  borderActive:"rgba(74, 144, 226, 0.42)",
  text:        "#0F172A",
  textSub:     "rgba(15, 23, 42, 0.55)",
  white:       "#FFFFFF",

  // ---- クロム（サイドバー / トップバー）専用ライトブルー ----
  // ログイン画面・ロゴと同じ水色帯。曇った業務系を避け、医療SaaS感へ。
  navBg:       "#7EA9D6",                   // 基本背景（サイドバー / トップバー）
  navBgHover:  "#91B8E1",                   // ナビ項目 hover
  navBgActive: "#6B97C5",                   // ナビ項目 active（選択中タブ）

  // ---- ミントアクセント ----
  // 使用箇所: active / selected / focus ring / unread badge / success / progress / notification
  // 画面全体を緑にせず、アクセント限定で使用すること。
  mint:        "#67C8B6",                   // メインアクセント（インジケータ・境界）
  mintSoft:    "#DDF4EE",                   // ソフト背景（選択タブの淡塗りなど）
  mintDeep:    "#2E9F8A",                   // 濃ミント（バッジ背景・mintSoft上の文字色など）
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

// ---- 送信側向け「現在地」表示ラベル生成（グループ単位） ----
// ConversationCard / ConversationDetailPane のグループヘッダで使用。
// pending かつ受信側アサインあり → 「〇〇病院（△△部署）で対応中」
// それ以外 → currentStatus.label をそのまま返す
export function senderCurrentLabel(currentStatus, peerAssignedDept, peerHospitalName) {
  if (!currentStatus) return null;
  if (currentStatus.level === "pending" && peerAssignedDept) {
    const prefix = peerHospitalName
      ? `${peerHospitalName}（${peerAssignedDept}）`
      : peerAssignedDept;
    return `${prefix}で対応中`;
  }
  return currentStatus.label;
}

// ---- 送信側向け「現在地」ステータス生成（個別書類単位） ----
// DetailPane など書類単位の表示で使用。doc.peer_assigned_dept と doc.status から判定。
// 戻り値: { level, label } または null（CANCELLED は既存バッジで表示済みのため除外）
export function senderDocStatus(doc, nameOf) {
  if (!doc) return null;
  if (doc.status === "ARCHIVED") return { level: "complete", label: "完了" };
  if (doc.status === "CANCELLED") return null;
  if (doc.peer_assigned_dept) {
    const hosp   = doc.to_hospital_id && nameOf ? nameOf(doc.to_hospital_id) : null;
    const prefix = hosp ? `${hosp}（${doc.peer_assigned_dept}）` : doc.peer_assigned_dept;
    return { level: "in_progress", label: `${prefix}で対応中` };
  }
  return { level: "pending", label: "未対応" };
}

// ---- 送信方向判定（自院視点）----
// FAX受信は from_hospital_id が to_hospital_id と同値の暫定値のため、
// source === "fax" を受信として扱い、from_hospital_id 比較を使わない。
// この関数をアイコン・ラベル・カウントの全判定で共通使用すること。
export function isDocSent(doc, myHospitalId) {
  if (!doc || !myHospitalId) return false;
  if (doc.source === "fax") return false;           // 外部FAX受信は常に「受信」
  if (doc.source === "manual_upload") return false; // 自院置き（紙取り込み）は常に「受信」
  return doc.from_hospital_id === myHospitalId;
}
