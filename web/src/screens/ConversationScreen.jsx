// ConversationScreen.jsx
// 「送受信ではなくやりとり（連携）単位で見る」画面
//
// 変更点 (v3):
// - departments / addDepartment を ConversationListPanel に渡す（部署タブ用）

import { useState, useMemo, useCallback } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useConversationGroups, GROUPING_MODES } from "../hooks/useConversationGroups";
import GlobalSidebar, { BottomNav } from "../components/receive/GlobalSidebar";
import ConversationListPanel from "../components/conversation/ConversationListPanel";
import ConversationDetailPane from "../components/conversation/ConversationDetailPane";
import { DP } from "../components/receive/receiveConstants";
import LogoutIcon from "../assets/logo/logout.svg";

export default function ConversationScreen({
  activeTab,
  onTabChange,
  onLogout,
  myHospitalIcon,
  myAvatarUrl,
  onAvatarUpload,
  unreadCount,
  inboxDocs,
  sentDocs,
  myHospitalId,
  nameOf,
  iconOf,
  fmt,
  isExpired,
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

  const [selectedGroup,  setSelectedGroup]  = useState(null);
  const [q,              setQ]              = useState("");
  const [groupingMode,   setGroupingMode]   = useState(GROUPING_MODES.HOSPITAL);

  const handleGroupingModeChange = useCallback(newMode => {
    setGroupingMode(newMode);
    setSelectedGroup(null);
  }, []);

  const groups = useConversationGroups(inboxDocs, sentDocs, myHospitalId, groupingMode);

  const filteredGroups = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter(g => {
      const fname = (g.latestDoc?.original_filename || "").toLowerCase();
      if (g.patientLabel) return g.patientLabel.toLowerCase().includes(query) || fname.includes(query);
      const name = nameOf(g.peerHospitalId).toLowerCase();
      return name.includes(query) || fname.includes(query);
    });
  }, [groups, q, nameOf]);

  const handleGroupSelect = useCallback(group => setSelectedGroup(group), []);

  const sidebarProps = {
    activeTab, onTabChange, myHospitalIcon, myAvatarUrl, onAvatarUpload, unreadCount, onLogout,
  };

  const detailProps = {
    group: selectedGroup, myHospitalId,
    nameOf, iconOf, fmt, isExpired,
    onArchive: archiveDocument, onAssign: assignDocument,
    hospitalMembers, myUserId,
    fetchPreviewUrl, fetchDownloadUrl, departments,
  };

  // 部署タブ用: ListPanel に渡す共通 props
  const listPanelProps = {
    groups: filteredGroups,
    nameOf, iconOf,
    selectedGroup, onSelect: handleGroupSelect,
    isExpired, searchQuery: q,
    groupingMode, onGroupingModeChange: handleGroupingModeChange,
    departments, addDepartment,
  };

  // ---- モバイルレイアウト ----
  if (isMobile) {
    const showDetail = !!selectedGroup;
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        height: "100vh", width: "100vw",
        background: DP.white,
        paddingBottom: "calc(64px + env(safe-area-inset-bottom))",
        boxSizing: "border-box",
      }}>
        {/* トップバー */}
        <div style={{ flexShrink: 0, background: DP.navy, display: "flex", flexDirection: "column" }}>
          <div style={{ height: 48, display: "flex", alignItems: "center", padding: "0 14px", gap: 10 }}>
            {showDetail ? (
              <button
                onClick={() => setSelectedGroup(null)}
                style={{
                  color: "rgba(255,255,255,0.90)", background: "none", border: "none",
                  cursor: "pointer", fontSize: 14, fontWeight: 700,
                  padding: "4px 0", display: "flex", alignItems: "center", gap: 6, flex: 1,
                }}
              >
                ← 一覧に戻る
              </button>
            ) : (
              <>
                <span style={{
                  color: "rgba(255,255,255,0.90)", fontSize: 15, fontWeight: 800,
                  letterSpacing: 0.3, flexShrink: 0, userSelect: "none",
                }}>
                  受信
                </span>
                <div style={{ flex: 1, position: "relative" }}>
                  <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "rgba(255,255,255,0.35)", pointerEvents: "none" }}>🔍</span>
                  <input
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder={groupingMode === GROUPING_MODES.PATIENT ? "患者名で検索" : "病院名で検索"}
                    className="dp-input-dark"
                    style={{ width: "100%", padding: "7px 10px 7px 28px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.90)", fontSize: 12, boxSizing: "border-box" }}
                  />
                </div>
              </>
            )}
            {onLogout && (
              <button
                onClick={onLogout} title="ログアウト"
                style={{ width: 36, height: 36, border: "none", borderRadius: 8, background: "rgba(255,255,255,0.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}
              >
                <img src={LogoutIcon} alt="ログアウト" style={{ width: 20, height: 20, filter: "brightness(0) invert(1)", opacity: 0.65 }} />
              </button>
            )}
          </div>
          <div className="dp-flow-line" />
        </div>

        {/* コンテンツ */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {showDetail ? (
            <ConversationDetailPane key={selectedGroup?.id ?? "none"} {...detailProps} isMobile />
          ) : (
            <ConversationListPanel {...listPanelProps} fullWidth />
          )}
        </div>

        <BottomNav
          activeTab={activeTab} onTabChange={onTabChange}
          unreadCount={unreadCount} myAvatarUrl={myAvatarUrl} onAvatarUpload={onAvatarUpload}
        />
      </div>
    );
  }

  // ---- PC / タブレットレイアウト ----
  return (
    <div style={{
      display: "flex", height: "100vh", width: "100vw",
      overflow: "hidden", background: DP.white,
    }}>
      <GlobalSidebar {...sidebarProps} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* トップバー */}
        <div style={{
          height: 48, flexShrink: 0, background: DP.navy,
          display: "flex", alignItems: "center", padding: "0 16px", gap: 12,
        }}>
          <span style={{
            color: "rgba(255,255,255,0.90)", fontSize: 15, fontWeight: 800,
            letterSpacing: 0.3, flexShrink: 0, userSelect: "none",
          }}>
            受信
          </span>
          <div style={{ flex: 1, position: "relative", maxWidth: 300 }}>
            <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "rgba(255,255,255,0.35)", pointerEvents: "none" }}>🔍</span>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={groupingMode === GROUPING_MODES.PATIENT ? "患者名・書類名で検索" : "病院名・書類名で検索"}
              className="dp-input-dark"
              style={{ width: "100%", padding: "7px 10px 7px 28px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.90)", fontSize: 12, boxSizing: "border-box" }}
            />
          </div>
        </div>
        <div className="dp-flow-line" />

        {/* コンテンツ */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <ConversationListPanel {...listPanelProps} />
          <ConversationDetailPane key={selectedGroup?.id ?? "none"} {...detailProps} />
        </div>
      </div>
    </div>
  );
}
