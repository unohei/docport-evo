// useConversationGroups.js
// inboxDocs + sentDocs を「相手病院単位 or 患者単位」でグループ化する表示専用フック
//
// 変更点 (v4):
// - assigned_to → assigned_department に修正（DetailPane の DB フィールド名と統一）

import { useMemo } from "react";

export const GROUPING_MODES = {
  HOSPITAL: "hospital",  // 相手病院単位（デフォルト）
  PATIENT:  "patient",   // 患者単位（structured_json.patient_name / patient_id）
};

// ---- 現在地推定（DB変更なし・表示専用） ----
// 優先順位: キャンセル > 完了 > アサイン対応中 > 返信待ち > 未対応
export function deriveCurrentStatus(docs, myHospitalId) {
  if (!docs || !docs.length) return null;
  // docs は created_at 降順（newest first）

  if (docs.some(d => d.status === "CANCELLED")) {
    return { label: "キャンセル", level: "cancel" };
  }
  if (docs.every(d => d.status === "ARCHIVED")) {
    return { label: "完了", level: "complete" };
  }
  // アサイン済み: 未完了の書類に assigned_department が設定されている
  const activeAssigned = docs.find(
    d => d.assigned_department &&
         d.status !== "ARCHIVED" &&
         d.status !== "CANCELLED",
  );
  if (activeAssigned) {
    return { label: `${activeAssigned.assigned_department}で対応中`, level: "in_progress" };
  }
  // 返信待ち: 最新書類が自院送信かつ相手からの受信が存在する
  const latestDoc   = docs[0];
  const isSent      = latestDoc?.from_hospital_id === myHospitalId;
  const hasIncoming = docs.some(d => d.to_hospital_id === myHospitalId);
  if (isSent && hasIncoming) {
    return { label: "返信待ち", level: "waiting" };
  }
  return { label: "未対応", level: "pending" };
}

// ---- grouping key 生成 ----
function keyOf(doc, myHospitalId, mode) {
  if (mode === GROUPING_MODES.PATIENT) {
    const sj   = doc.structured_json;
    const name = sj?.patient_name?.trim();
    const pid  = sj?.patient_id?.trim();
    return name || pid || "患者不明";
  }
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

    const seen    = new Set();
    const allDocs = [];
    for (const doc of [...(inboxDocs ?? []), ...(sentDocs ?? [])]) {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        allDocs.push(doc);
      }
    }

    const map = new Map();
    for (const doc of allDocs) {
      const k = keyOf(doc, myHospitalId, mode);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(doc);
    }

    const groups = Array.from(map.entries()).map(([key, docs]) => {
      const sorted = [...docs].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
      const sent = docs.filter(d => d.from_hospital_id === myHospitalId);
      const recv = docs.filter(d => d.to_hospital_id   === myHospitalId);

      const peerHospitalIds = [
        ...new Set(
          docs.flatMap(d => [d.from_hospital_id, d.to_hospital_id].filter(Boolean)),
        ),
      ].filter(id => id !== myHospitalId);

      return {
        id:             key,
        peerHospitalId: mode === GROUPING_MODES.HOSPITAL ? key : (peerHospitalIds[0] ?? null),
        patientLabel:   mode === GROUPING_MODES.PATIENT  ? key : null,
        peerHospitalIds,
        mode,
        docs:           sorted,
        latestDoc:      sorted[0] ?? null,
        sentCount:      sent.length,
        recvCount:      recv.length,
        totalCount:     docs.length,
        hasReply:       sent.length > 0 && recv.length > 0,
        currentStatus:  deriveCurrentStatus(sorted, myHospitalId),
      };
    });

    return groups.sort(
      (a, b) =>
        new Date(b.latestDoc?.created_at ?? 0) -
        new Date(a.latestDoc?.created_at ?? 0),
    );
  }, [inboxDocs, sentDocs, myHospitalId, mode]);
}
