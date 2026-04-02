// ReceiveScreen.jsx
// 受信画面のオーケストレーター
// 変更点（レスポンシブ対応）:
// - モバイル（<640px）: GlobalSidebar → BottomNav、レーンフィルタ横スクロールタブ、カード一覧↔詳細をトグル
// - タブレット（<1024px）: GlobalSidebar + カード一覧 + 詳細（BusinessLanePanel非表示）
// - PC: 従来の4カラム構成（GlobalSidebar + BusinessLane + CardList + DetailPane）

import { useState, useMemo, useCallback } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import GlobalSidebar, { BottomNav } from "../components/receive/GlobalSidebar";
import BusinessLanePanel from "../components/receive/BusinessLanePanel";
import CardListPanel     from "../components/receive/CardListPanel";
import DetailPane        from "../components/receive/DetailPane";
import { DP }            from "../components/receive/receiveConstants";

// ---- モバイル用レーンフィルタ（横スクロールタブ） ----
function MobileLaneFilter({ docs, departments, activeLane, onLaneChange }) {
  const newCount  = docs.filter(d =>
    !d.owner_user_id && (d.status === "UPLOADED" || d.status === "ARRIVED")
  ).length;
  const doneCount = docs.filter(d => d.status === "ARCHIVED").length;

  const deptCounts = useMemo(() => {
    const counts = {};
    docs.forEach(d => {
      if (d.assigned_department && d.status !== "ARCHIVED") {
        counts[d.assigned_department] = (counts[d.assigned_department] || 0) + 1;
      }
    });
    return counts;
  }, [docs]);

  const lanes = [
    { key: "new",  label: "新着書類", count: newCount },
    ...(departments || []).map(d => ({ key: d.name, label: d.name, count: deptCounts[d.name] || 0 })),
    { key: "done", label: "完了",     count: doneCount },
  ];

  return (
    <div style={{
      display: "flex",
      overflowX: "auto",
      gap: 8,
      padding: "8px 12px",
      borderBottom: `1px solid ${DP.border}`,
      background: DP.surface,
      flexShrink: 0,
      WebkitOverflowScrolling: "touch",
      scrollbarWidth: "none",
    }}>
      {lanes.map(lane => {
        const active = activeLane === lane.key;
        return (
          <button
            key={lane.key}
            onClick={() => onLaneChange(lane.key)}
            style={{
              flexShrink: 0,
              padding: "6px 14px",
              borderRadius: 999,
              border: active ? `1.5px solid ${DP.blue}` : `1px solid ${DP.border}`,
              background: active ? DP.skyLight : DP.white,
              color: active ? DP.blue : DP.text,
              fontSize: 13,
              fontWeight: active ? 800 : 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              whiteSpace: "nowrap",
              minHeight: 36,
            }}
          >
            {lane.label}
            {lane.count > 0 && (
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                padding: "1px 6px",
                borderRadius: 999,
                background: active ? "rgba(21,101,192,0.15)" : "rgba(15,23,42,0.07)",
                color: active ? DP.blue : DP.textSub,
              }}>
                {lane.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function ReceiveScreen({
  // ナビゲーション
  activeTab,
  onTabChange,
  onLogout,
  myHospitalIcon,
  myAvatarUrl,
  onAvatarUpload,
  myHospitalName,
  unreadCount,
  // データ
  docs,
  nameOf,
  iconOf,
  fmt,
  isExpired,
  // アクション
  archiveDocument,
  assignDocument,
  hospitalMembers,
  myUserId,
  fetchPreviewUrl,
  fetchDownloadUrl,
  departments,
  addDepartment,
}) {
  const isMobile = useMediaQuery("(max-width: 639px)");
  const isTablet = useMediaQuery("(max-width: 899px)");

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
    return docs.filter(d =>
      d.assigned_department === activeLane && d.status !== "ARCHIVED"
    );
  }, [docs, activeLane]);

  const handleLaneChange = useCallback(lane => {
    setActiveLane(lane);
    setSelectedDoc(null);
  }, []);

  // DetailPane / CardListPanel に渡す共通 props
  const detailProps = {
    doc: selectedDoc,
    nameOf,
    iconOf,
    fmt,
    onArchive: archiveDocument,
    onAssign: assignDocument,
    hospitalMembers,
    myUserId,
    fetchPreviewUrl,
    fetchDownloadUrl,
    departments,
  };
  const cardProps = {
    docs: laneDocs,
    activeLane,
    nameOf,
    iconOf,
    selectedDoc,
    onSelect: setSelectedDoc,
    isExpired,
  };
  const sidebarProps = {
    activeTab,
    onTabChange,
    myHospitalIcon,
    myAvatarUrl,
    onAvatarUpload,
    unreadCount,
    onLogout,
  };

  // ---- モバイルレイアウト ----
  if (isMobile) {
    const showDetail = !!selectedDoc;
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        background: DP.white,
        // BottomNav の高さ分を確保（safe-area-inset-bottom も含む）
        paddingBottom: "calc(64px + env(safe-area-inset-bottom))",
        boxSizing: "border-box",
      }}>
        {/* トップバー */}
        <div style={{
          flexShrink: 0,
          background: DP.navy,
          height: 48,
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          gap: 10,
        }}>
          {showDetail ? (
            <button
              onClick={() => setSelectedDoc(null)}
              style={{
                color: "rgba(255,255,255,0.90)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 700,
                padding: "4px 0",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ← 一覧に戻る
            </button>
          ) : (
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>
              受信ボックス
            </span>
          )}
        </div>

        {/* コンテンツ（flex-1） */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {showDetail ? (
            <DetailPane {...detailProps} />
          ) : (
            <>
              <MobileLaneFilter
                docs={docs}
                departments={departments}
                activeLane={activeLane}
                onLaneChange={handleLaneChange}
              />
              <div style={{ flex: 1, overflow: "hidden" }}>
                <CardListPanel {...cardProps} fullWidth />
              </div>
            </>
          )}
        </div>

        {/* BottomNav（固定） */}
        <BottomNav
          activeTab={activeTab}
          onTabChange={onTabChange}
          unreadCount={unreadCount}
          myAvatarUrl={myAvatarUrl}
          onAvatarUpload={onAvatarUpload}
          onLogout={onLogout}
        />
      </div>
    );
  }

  // ---- タブレットレイアウト（BusinessLanePanel 非表示、2ペイン） ----
  if (isTablet) {
    return (
      <div style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: DP.white,
      }}>
        <GlobalSidebar {...sidebarProps} />
        <CardListPanel {...cardProps} />
        {selectedDoc
          ? <DetailPane {...detailProps} />
          : (
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: DP.white,
              color: DP.textSub,
              flexDirection: "column",
              gap: 12,
            }}>
              <span style={{ fontSize: 44, opacity: 0.25 }}>📄</span>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>書類を選択してください</p>
            </div>
          )
        }
      </div>
    );
  }

  // ---- PC レイアウト（4カラム構成） ----
  return (
    <div style={{
      display: "flex",
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      background: "#FFFFFF",
    }}>
      <GlobalSidebar {...sidebarProps} />

      <BusinessLanePanel
        docs={docs}
        activeLane={activeLane}
        onLaneChange={handleLaneChange}
        myHospitalName={myHospitalName}
        departments={departments}
        addDepartment={addDepartment}
      />

      <CardListPanel {...cardProps} />

      <DetailPane {...detailProps} />
    </div>
  );
}
