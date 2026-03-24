// ReceiveScreen.jsx
// 受信画面のオーケストレーター（4カラム構成）
// 変更点: コンポーネントをファイル分割し、本ファイルをスリム化

import { useState, useMemo, useCallback } from "react";
import GlobalSidebar     from "../components/receive/GlobalSidebar";
import BusinessLanePanel from "../components/receive/BusinessLanePanel";
import CardListPanel     from "../components/receive/CardListPanel";
import DetailPane        from "../components/receive/DetailPane";

export default function ReceiveScreen({
  // ナビゲーション
  activeTab,
  onTabChange,
  onLogout,
  myHospitalIcon,
  myHospitalName,
  unreadCount,
  // データ
  docs,
  nameOf,
  fmt,
  isExpired,
  // アクション
  archiveDocument,
  assignDocument,
  hospitalMembers,
  myUserId,
  fetchPreviewUrl,
}) {
  const [activeLane,  setActiveLane]  = useState("new");
  const [selectedDoc, setSelectedDoc] = useState(null);

  // レーン別ドキュメント絞り込み
  const laneDocs = useMemo(() => {
    if (activeLane === "new") {
      return docs.filter(d =>
        !d.owner_user_id && (d.status === "UPLOADED" || d.status === "ARRIVED")
      );
    }
    if (activeLane === "done") {
      return docs.filter(d => d.status === "ARCHIVED");
    }
    // 部署レーン
    return docs.filter(d =>
      d.assigned_department === activeLane && d.status !== "ARCHIVED"
    );
  }, [docs, activeLane]);

  const handleLaneChange = useCallback(lane => {
    setActiveLane(lane);
    setSelectedDoc(null);
  }, []);

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      background: "#FFFFFF",
    }}>
      <GlobalSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        myHospitalIcon={myHospitalIcon}
        unreadCount={unreadCount}
        onLogout={onLogout}
      />

      <BusinessLanePanel
        docs={docs}
        activeLane={activeLane}
        onLaneChange={handleLaneChange}
        myHospitalName={myHospitalName}
      />

      <CardListPanel
        docs={laneDocs}
        activeLane={activeLane}
        nameOf={nameOf}
        selectedDoc={selectedDoc}
        onSelect={setSelectedDoc}
        isExpired={isExpired}
      />

      <DetailPane
        doc={selectedDoc}
        nameOf={nameOf}
        fmt={fmt}
        onArchive={archiveDocument}
        onAssign={assignDocument}
        hospitalMembers={hospitalMembers}
        myUserId={myUserId}
        fetchPreviewUrl={fetchPreviewUrl}
      />
    </div>
  );
}
