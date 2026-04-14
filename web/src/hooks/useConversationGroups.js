// useConversationGroups.js
// inboxDocs + sentDocs を「相手病院単位 or 患者単位」でグループ化する表示専用フック
//
// 変更点 (v2):
// - GROUPING_MODES に PATIENT を追加（structured_json.patient_name / patient_id をキーに）
// - グループに patientLabel / peerHospitalIds / mode フィールドを追加
// - 既存の peerHospitalId / docs / latestDoc 等は変更なし（後方互換）

import { useMemo } from "react";

export const GROUPING_MODES = {
  HOSPITAL: "hospital",  // 相手病院単位（デフォルト）
  PATIENT:  "patient",   // 患者単位（structured_json.patient_name / patient_id）
};

// ---- grouping key 生成 ----
function keyOf(doc, myHospitalId, mode) {
  if (mode === GROUPING_MODES.PATIENT) {
    const sj   = doc.structured_json;
    const name = sj?.patient_name?.trim();
    const pid  = sj?.patient_id?.trim();
    return name || pid || "患者不明";
  }
  // HOSPITAL: 自院から見た「相手病院」IDをキーに
  const peer =
    doc.from_hospital_id === myHospitalId
      ? doc.to_hospital_id
      : doc.from_hospital_id;
  return peer ?? "unknown";
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
    const seen    = new Set();
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
    const groups = Array.from(map.entries()).map(([key, docs]) => {
      const sorted = [...docs].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
      const sent = docs.filter(d => d.from_hospital_id === myHospitalId);
      const recv = docs.filter(d => d.to_hospital_id   === myHospitalId);

      // 関連病院一覧（自院を除く）: 患者モードで複数病院が絡む場合の副表示用
      const peerHospitalIds = [
        ...new Set(
          docs.flatMap(d =>
            [d.from_hospital_id, d.to_hospital_id].filter(Boolean),
          ),
        ),
      ].filter(id => id !== myHospitalId);

      return {
        id:             key,
        // 病院モード: key = 相手病院ID  /  患者モード: 代表病院ID（参照用）
        peerHospitalId: mode === GROUPING_MODES.HOSPITAL ? key : (peerHospitalIds[0] ?? null),
        // 患者モード専用ラベル（病院モードでは null）
        patientLabel:   mode === GROUPING_MODES.PATIENT  ? key : null,
        peerHospitalIds,   // 関連病院ID一覧（患者モードの病院名副表示用）
        mode,              // カード・詳細パネルの表示切替に使用
        docs:          sorted,
        latestDoc:     sorted[0] ?? null,
        sentCount:     sent.length,
        recvCount:     recv.length,
        totalCount:    docs.length,
        hasReply:      sent.length > 0 && recv.length > 0,
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
