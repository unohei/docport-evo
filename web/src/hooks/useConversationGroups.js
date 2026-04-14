// useConversationGroups.js
// inboxDocs + sentDocs を「相手病院単位」でグループ化する表示専用フック
//
// 設計方針:
// - API / DB / state は一切変更しない（表示ロジックのみ）
// - GROUPING_MODES を将来 "patient" / "date" に切り替えられるよう定数化
// - useMemo で包んでいるため依存配列が変わらない限り再計算なし

import { useMemo } from "react";

// ---- グルーピングモード定数（将来の切り替え用） ----
export const GROUPING_MODES = {
  HOSPITAL: "hospital",  // 相手病院単位（現在のデフォルト）
  // PATIENT: "patient", // 将来: structured_json.patient_name が必要
};

// ---- grouping key 生成（モードに応じて切り替え） ----
function keyOf(doc, myHospitalId, mode) {
  if (mode === GROUPING_MODES.HOSPITAL) {
    // 自院から見た「相手病院」のIDをキーに
    const peer =
      doc.from_hospital_id === myHospitalId
        ? doc.to_hospital_id
        : doc.from_hospital_id;
    return peer ?? "unknown";
  }
  // フォールバック（将来モード追加時のデフォルト）
  return doc.from_hospital_id === myHospitalId
    ? (doc.to_hospital_id ?? "unknown")
    : (doc.from_hospital_id ?? "unknown");
}

// ---- メインフック ----
export function useConversationGroups(
  inboxDocs,
  sentDocs,
  myHospitalId,
  mode = GROUPING_MODES.HOSPITAL,
) {
  return useMemo(() => {
    if (!myHospitalId) return [];

    // 受信 + 送信を合算し、ID重複を除去
    const seen   = new Set();
    const allDocs = [];
    for (const doc of [...(inboxDocs ?? []), ...(sentDocs ?? [])]) {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        allDocs.push(doc);
      }
    }

    // keyOf で Map にグループ化
    const map = new Map();
    for (const doc of allDocs) {
      const k = keyOf(doc, myHospitalId, mode);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(doc);
    }

    // 各グループを整理（ドキュメントは created_at 降順）
    const groups = Array.from(map.entries()).map(([peerHospitalId, docs]) => {
      const sorted = [...docs].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
      const sent = docs.filter(d => d.from_hospital_id === myHospitalId);
      const recv = docs.filter(d => d.to_hospital_id   === myHospitalId);

      return {
        id:            peerHospitalId,   // grouping key（リストの key prop 用）
        peerHospitalId,                  // 相手病院 ID
        docs:          sorted,           // 全書類（created_at 降順）
        latestDoc:     sorted[0] ?? null,
        sentCount:     sent.length,
        recvCount:     recv.length,
        totalCount:    docs.length,
        hasReply:      sent.length > 0 && recv.length > 0, // 往復あり
      };
    });

    // グループ自体も最新書類の日時で降順ソート
    return groups.sort(
      (a, b) =>
        new Date(b.latestDoc?.created_at ?? 0) -
        new Date(a.latestDoc?.created_at ?? 0),
    );
  }, [inboxDocs, sentDocs, myHospitalId, mode]);
}
