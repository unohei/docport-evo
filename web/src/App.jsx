console.log("App.jsx LOADED: sky-blue + deepsea buttons (responsive)");

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import DocPortLogo from "./assets/logo/docport-logo.svg";

import Root from "./components/Root";
import { useMediaQuery } from "./hooks/useMediaQuery";
import {
  THEME,
  Card,
  PrimaryButton,
  SecondaryButton,
  SidebarButton,
  TextInput,
} from "./components/ui/primitives";

import SendTab from "./tabs/SendTab";
import InboxTab from "./tabs/InboxTab";
import SentTab from "./tabs/SentTab";

function fmt(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toLocaleString();
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

function statusLabel(status) {
  if (status === "UPLOADED") return "未読";
  if (status === "DOWNLOADED") return "既読";
  if (status === "CANCELLED") return "取消";
  if (status === "ARCHIVED") return "アーカイブ";
  return status || "-";
}

function isLegacyKey(fileKey) {
  if (!fileKey || typeof fileKey !== "string") return true;
  const VALID_PREFIXES = ["documents/"];
  const LEGACY_HINTS = ["docs/", "uploads/", "tmp/", "test/"];

  const ok = VALID_PREFIXES.some((p) => fileKey.startsWith(p));
  const legacyHint = LEGACY_HINTS.some((p) => fileKey.startsWith(p));
  return !ok || legacyHint;
}

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
console.log("API_BASE =", API_BASE);

// ---- Preview Modal (App内に同梱) ----
function PreviewModal({
  isOpen,
  onClose,
  title,
  url,
  loading,
  error,
  metaLeft,
}) {
  if (!isOpen) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        padding: 12,
      }}
    >
      <div
        style={{
          width: "min(1020px, 100%)",
          height: "min(88vh, 920px)",
          background: "rgba(255,255,255,0.93)",
          border: "1px solid rgba(15,23,42,0.12)",
          borderRadius: 16,
          boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "56px 1fr",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "10px 12px",
            borderBottom: "1px solid rgba(15,23,42,0.10)",
            background: "rgba(248,250,252,0.9)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: 14,
                color: THEME.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={title}
            >
              {title || "プレビュー"}
            </div>
            {metaLeft ? (
              <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7 }}>
                {metaLeft}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* 端末で開く（外部ビューア） */}
            <a
              href={url || "#"}
              target="_blank"
              rel="noreferrer noopener"
              style={{
                pointerEvents: url ? "auto" : "none",
                opacity: url ? 1 : 0.5,
                textDecoration: "none",
              }}
            >
              <button
                style={{
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: "rgba(14,165,233,0.10)",
                  fontWeight: 900,
                  color: THEME.text,
                  cursor: url ? "pointer" : "not-allowed",
                }}
              >
                端末で開く
              </button>
            </a>

            <button
              onClick={onClose}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.12)",
                background: "rgba(255,255,255,0.85)",
                fontWeight: 900,
                color: THEME.text,
                cursor: "pointer",
              }}
            >
              閉じる
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ background: "rgba(255,255,255,0.72)" }}>
          {loading ? (
            <div style={{ padding: 16, fontWeight: 900, opacity: 0.78 }}>
              読み込み中...
            </div>
          ) : error ? (
            <div style={{ padding: 16 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                プレビューできませんでした
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{error}</div>
              <div style={{ marginTop: 12, fontSize: 13 }}>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ fontWeight: 900 }}
                  >
                    端末で開く（外部）
                  </a>
                ) : (
                  <span style={{ opacity: 0.7 }}>
                    ※URLを取得できませんでした
                  </span>
                )}
              </div>
            </div>
          ) : url ? (
            <iframe
              title="pdf-preview"
              src={url}
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          ) : (
            <div style={{ padding: 16, opacity: 0.75 }}>URL取得待ち</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("send"); // inbox | send | sent
  const [loading, setLoading] = useState(true);

  // ★メールリンク経由タブ判定
  const [authReturn, setAuthReturn] = useState(false);

  // data
  const [profile, setProfile] = useState(null); // { hospital_id }
  const [hospitals, setHospitals] = useState([]);
  const [inboxDocs, setInboxDocs] = useState([]);
  const [sentDocs, setSentDocs] = useState([]);

  // send form
  const [toHospitalId, setToHospitalId] = useState("");
  const [comment, setComment] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [sending, setSending] = useState(false);

  // login
  const [email, setEmail] = useState("");

  // filters
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const [qInbox, setQInbox] = useState("");
  const [qSent, setQSent] = useState("");

  // Preview (Modal)
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  // breakpoints
  const isMobile = useMediaQuery("(max-width: 820px)");
  const isNarrow = useMediaQuery("(max-width: 1024px)");

  // ロゴサイズ
  const logoLoginSize = isMobile ? 72 : 180;
  const logoTopbarSize = isMobile ? 28 : 80;

  // 病院アイコンサイズ
  const hospitalIconTopbarSize = isMobile ? 22 : 34;

  useEffect(() => {
    const hasAuthParams =
      typeof window !== "undefined" &&
      (window.location.search || window.location.hash);

    if (hasAuthParams) setAuthReturn(true);

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);

      if (data.session && hasAuthParams) {
        window.history.replaceState({}, document.title, "/");
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);

      const nowHasAuthParams =
        typeof window !== "undefined" &&
        (window.location.search || window.location.hash);

      if (nowHasAuthParams) setAuthReturn(true);

      if (sess && nowHasAuthParams) {
        window.history.replaceState({}, document.title, "/");
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const myHospitalId = profile?.hospital_id ?? null;

  const myHospitalName = useMemo(() => {
    if (!myHospitalId) return "";
    return hospitals.find((h) => h.id === myHospitalId)?.name ?? "";
  }, [myHospitalId, hospitals]);

  // 病院ID -> 表示名
  const nameOf = (hid) => hospitals.find((h) => h.id === hid)?.name ?? hid;

  // 病院ID -> アイコンURL
  const iconOf = (hid) =>
    hospitals.find((h) => h.id === hid)?.icon_url || "/default-hospital.svg";

  // 未読件数
  const unreadCount = useMemo(() => {
    return inboxDocs.filter(
      (d) =>
        d.status === "UPLOADED" &&
        !isExpired(d.expires_at) &&
        d.status !== "ARCHIVED",
    ).length;
  }, [inboxDocs]);

  // 受信：フィルタ＆検索
  const filteredInboxDocs = useMemo(() => {
    let list = inboxDocs;

    if (!showExpired) list = list.filter((d) => !isExpired(d.expires_at));
    list = list.filter((d) => d.status !== "ARCHIVED");
    if (showUnreadOnly) list = list.filter((d) => d.status === "UPLOADED");

    const q = (qInbox || "").trim().toLowerCase();
    if (q) {
      list = list.filter((d) => {
        const from = nameOf(d.from_hospital_id).toLowerCase();
        const to = nameOf(d.to_hospital_id).toLowerCase();
        const c = (d.comment || "").toLowerCase();
        return from.includes(q) || to.includes(q) || c.includes(q);
      });
    }
    return list;
  }, [inboxDocs, showExpired, showUnreadOnly, qInbox, hospitals]);

  // 送信履歴：検索
  const filteredSentDocs = useMemo(() => {
    const q = (qSent || "").trim().toLowerCase();
    if (!q) return sentDocs;
    return sentDocs.filter((d) => {
      const from = nameOf(d.from_hospital_id).toLowerCase();
      const to = nameOf(d.to_hospital_id).toLowerCase();
      const c = (d.comment || "").toLowerCase();
      return from.includes(q) || to.includes(q) || c.includes(q);
    });
  }, [sentDocs, qSent, hospitals]);

  const loadAll = async () => {
    if (!session) return;

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("hospital_id, role")
      .eq("id", session.user.id)
      .single();

    if (profErr) {
      alert(
        `profiles取得に失敗: ${profErr.message}\n（profilesに紐付け済みか確認）`,
      );
      return;
    }
    setProfile(prof);

    const { data: hs, error: hsErr } = await supabase
      .from("hospitals")
      .select("id, name, code, icon_url")
      .order("name", { ascending: true });
    if (hsErr) return alert(`hospitals取得に失敗: ${hsErr.message}`);
    setHospitals(hs);

    const { data: inbox, error: inboxErr } = await supabase
      .from("documents")
      .select(
        "id, from_hospital_id, to_hospital_id, comment, status, created_at, expires_at, file_key",
      )
      .eq("to_hospital_id", prof.hospital_id)
      .order("created_at", { ascending: false });
    if (inboxErr) return alert(`inbox取得に失敗: ${inboxErr.message}`);
    setInboxDocs(inbox ?? []);

    const { data: sent, error: sentErr } = await supabase
      .from("documents")
      .select(
        "id, from_hospital_id, to_hospital_id, comment, status, created_at, expires_at, file_key",
      )
      .eq("from_hospital_id", prof.hospital_id)
      .order("created_at", { ascending: false });
    if (sentErr) return alert(`sent取得に失敗: ${sentErr.message}`);
    setSentDocs(sent ?? []);
  };

  useEffect(() => {
    if (!session) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const sendMagicLink = async () => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert(error.message);
    else alert("メール送信しました（届いたリンクを開いてログイン）");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setHospitals([]);
    setInboxDocs([]);
    setSentDocs([]);
    setToHospitalId("");
    setComment("");
    setPdfFile(null);
    setShowUnreadOnly(false);
    setShowExpired(false);
    setQInbox("");
    setQSent("");
    setAuthReturn(false);

    // preview reset
    setPreviewDoc(null);
    setPreviewUrl("");
    setPreviewError("");
    setPreviewLoading(false);
  };

  // ---- R2 presign helpers ----
  const getPresignedUpload = async () => {
    const res = await fetch(`${API_BASE}/presign-upload`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { upload_url, file_key }
  };

  const putPdf = async (uploadUrl, file) => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: file,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`R2 PUT failed: ${res.status} ${t}`);
    }
  };

  const getPresignedDownload = async (fileKey) => {
    const res = await fetch(
      `${API_BASE}/presign-download?key=${encodeURIComponent(fileKey)}`,
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json(); // { download_url }
  };

  const createDocument = async () => {
    if (sending) return;
    try {
      if (!myHospitalId) return alert("profileのhospital_idが取れてません");
      if (!toHospitalId) return alert("宛先病院を選んでください");
      if (toHospitalId === myHospitalId)
        return alert("自院宛は選べません（テストならOKにしても良い）");
      if (!pdfFile) return alert("PDFを選択してください");
      if (pdfFile.type !== "application/pdf")
        return alert("PDFのみアップロードできます");

      setSending(true);

      const { upload_url, file_key } = await getPresignedUpload();
      await putPdf(upload_url, pdfFile);

      const { data, error } = await supabase
        .from("documents")
        .insert({
          from_hospital_id: myHospitalId,
          to_hospital_id: toHospitalId,
          comment: comment || null,
          file_key,
          status: "UPLOADED",
          expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        })
        .select()
        .single();

      if (error) return alert(`送信に失敗: ${error.message}`);

      await supabase.from("document_events").insert({
        document_id: data.id,
        actor_user_id: session.user.id,
        action: "UPLOAD",
      });

      setComment("");
      setToHospitalId("");
      setPdfFile(null);
      await loadAll();
      setTab("sent");
      alert("置きました（相手の受け取りBOXに入りました）");
    } catch (e) {
      alert(`失敗: ${e?.message ?? e}`);
    } finally {
      setSending(false);
    }
  };

  // ---- Preview (Inbox/Sent共通) ----
  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewUrl("");
    setPreviewError("");
    setPreviewLoading(false);
  };

  const openPreview = async (doc, opts = { markDownloaded: false }) => {
    try {
      if (!doc?.file_key) return alert("file_keyが空です（旧データの可能性）");
      if (isLegacyKey(doc.file_key))
        return alert(
          `旧データの可能性があるためブロックしました。\nfile_key: ${doc.file_key}`,
        );
      if (isExpired(doc.expires_at)) return alert("期限切れのため開けません");
      if (doc.status === "CANCELLED") return alert("取り消し済みです");
      if (doc.status === "ARCHIVED") return alert("アーカイブ済みです");

      setPreviewDoc(doc);
      setPreviewLoading(true);
      setPreviewError("");
      setPreviewUrl("");

      const { download_url } = await getPresignedDownload(doc.file_key);
      if (!download_url) throw new Error("download_url が取得できませんでした");

      setPreviewUrl(download_url);

      // Inboxは「見たら既読」に寄せる（必要なければ opts を false に）
      if (opts?.markDownloaded && session?.user?.id) {
        if (doc.status !== "DOWNLOADED") {
          await supabase
            .from("documents")
            .update({ status: "DOWNLOADED" })
            .eq("id", doc.id);

          await supabase.from("document_events").insert({
            document_id: doc.id,
            actor_user_id: session.user.id,
            action: "DOWNLOAD",
          });

          await loadAll();
        }
      }
    } catch (e) {
      setPreviewError(e?.message ?? String(e));
    } finally {
      setPreviewLoading(false);
    }
  };

  // Inbox用（既読化あり）
  const openInboxPreview = (doc) => openPreview(doc, { markDownloaded: true });
  // Sent用（既読化なし）
  const openSentPreview = (doc) => openPreview(doc, { markDownloaded: false });

  const archiveDocument = async (doc) => {
    try {
      if (!doc?.id) return;
      if (doc.status === "ARCHIVED") return;

      await supabase
        .from("documents")
        .update({ status: "ARCHIVED" })
        .eq("id", doc.id);

      await supabase.from("document_events").insert({
        document_id: doc.id,
        actor_user_id: session.user.id,
        action: "ARCHIVE",
      });

      await loadAll();
    } catch (e) {
      alert(`アーカイブ失敗: ${e?.message ?? e}`);
    }
  };

  const cancelDocument = async (doc) => {
    try {
      if (!doc?.id) return;

      const expired = isExpired(doc.expires_at);
      const canCancel = doc.status === "UPLOADED" && !expired;
      if (!canCancel)
        return alert("未読（UPLOADED）かつ期限内のみ取り消しできます");

      const ok = confirm(
        "この“置いた”共有を取り消しますか？（相手はDLできなくなります）",
      );
      if (!ok) return;

      await supabase
        .from("documents")
        .update({ status: "CANCELLED" })
        .eq("id", doc.id);

      await supabase.from("document_events").insert({
        document_id: doc.id,
        actor_user_id: session.user.id,
        action: "CANCEL",
      });

      await loadAll();
    } catch (e) {
      alert(`取り消し失敗: ${e?.message ?? e}`);
    }
  };

  // ★色トーン（期限切れ最優先）
  const statusTone = (doc) => {
    const expired = isExpired(doc.expires_at);
    if (expired) {
      return {
        bg: "rgba(239, 68, 68, 0.12)",
        text: "#991b1b",
        border: "rgba(153, 27, 27, 0.22)",
      };
    }
    switch (doc.status) {
      case "UPLOADED":
        return {
          bg: "rgba(59, 130, 246, 0.12)",
          text: "#1d4ed8",
          border: "rgba(29, 78, 216, 0.22)",
        };
      case "DOWNLOADED":
        return {
          bg: "rgba(16, 185, 129, 0.12)",
          text: "#047857",
          border: "rgba(4, 120, 87, 0.22)",
        };
      case "CANCELLED":
        return {
          bg: "rgba(100, 116, 139, 0.14)",
          text: "#334155",
          border: "rgba(51, 65, 85, 0.22)",
        };
      case "ARCHIVED":
        return {
          bg: "rgba(168, 85, 247, 0.12)",
          text: "#6d28d9",
          border: "rgba(109, 40, 217, 0.22)",
        };
      default:
        return {
          bg: "rgba(15, 23, 42, 0.08)",
          text: "#0f172a",
          border: "rgba(15, 23, 42, 0.18)",
        };
    }
  };

  // ---- Rendering ----
  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  if (session && authReturn) {
    return (
      <Root>
        <div style={{ padding: 24 }}>
          <div style={{ maxWidth: 520, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <img
                src={DocPortLogo}
                alt="DocPort"
                style={{ width: 44, height: 44, opacity: 0.95 }}
              />
              <div>
                <div
                  style={{ fontWeight: 800, fontSize: 18, color: THEME.text }}
                >
                  ログイン完了
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, color: THEME.text }}>
                  このタブは閉じてOKです（元のDocPortタブへ戻ってください）
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <PrimaryButton
                onClick={() => {
                  setAuthReturn(false);
                  window.history.replaceState({}, document.title, "/");
                }}
              >
                DocPortを開く
              </PrimaryButton>

              <SecondaryButton onClick={() => window.close()}>
                このタブを閉じる
              </SecondaryButton>
            </div>

            <p
              style={{
                marginTop: 12,
                fontSize: 12,
                opacity: 0.6,
                color: THEME.text,
              }}
            >
              ※「閉じる」が効かない場合は、手動で閉じてください
            </p>
          </div>
        </div>
      </Root>
    );
  }

  // ------- LOGIN -------
  if (!session) {
    return (
      <Root>
        <div style={{ padding: 24 }}>
          <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
            <img
              src={DocPortLogo}
              alt="DocPort"
              style={{
                width: logoLoginSize,
                height: logoLoginSize,
                marginBottom: 14,
                opacity: 0.95,
              }}
            />

            <h1 style={{ marginBottom: 8, fontWeight: 800, color: THEME.text }}>
              DocPort
            </h1>
            <p style={{ marginTop: 0, opacity: 0.7, color: THEME.text }}>
              送らない共有。置くだけ連携。
            </p>

            <div
              style={{
                marginTop: 24,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <TextInput
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email"
                style={{ flex: 1, minWidth: 220, maxWidth: 320 }}
              />
              <PrimaryButton onClick={sendMagicLink} style={{ minWidth: 160 }}>
                Send Link
              </PrimaryButton>
            </div>

            <p
              style={{
                marginTop: 12,
                fontSize: 13,
                opacity: 0.7,
                color: THEME.text,
              }}
            >
              ※ メールのリンクを開くとログインできます
            </p>
          </div>
        </div>
      </Root>
    );
  }

  // ------- APP -------
  const headerTitle = { fontSize: 18, fontWeight: 800, color: THEME.text };
  const headerDesc = { fontSize: 12, opacity: 0.7, color: THEME.text };

  const isInboxPreviewing =
    !!previewDoc && previewDoc.to_hospital_id === myHospitalId;

  const previewTitle = previewDoc
    ? isInboxPreviewing
      ? `受け取る / ${nameOf(previewDoc.from_hospital_id)}`
      : `記録 / ${nameOf(previewDoc.to_hospital_id)}`
    : "";

  const previewMetaLeft = previewDoc
    ? `${fmt(previewDoc.created_at)}${
        previewDoc.expires_at ? ` / 期限: ${fmt(previewDoc.expires_at)}` : ""
      }`
    : "";

  return (
    <Root>
      {/* Top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          background: THEME.topbar,
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${THEME.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: isMobile ? "10px 12px" : "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: isMobile ? "flex-start" : "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {/* ロゴ + タイトル */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <img
              src={DocPortLogo}
              alt="DocPort"
              style={{
                width: logoTopbarSize,
                height: logoTopbarSize,
                opacity: 0.92,
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: THEME.text }}>
                DocPort
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  opacity: 0.7,
                  color: THEME.text,
                  flexWrap: "wrap",
                }}
              >
                <span>
                  {myHospitalName
                    ? `所属：${myHospitalName}${
                        unreadCount ? ` / 未読: ${unreadCount}` : ""
                      }`
                    : "所属：（profiles未設定）"}
                </span>

                {myHospitalId ? (
                  <img
                    src={iconOf(myHospitalId)}
                    alt="hospital icon"
                    style={{
                      width: hospitalIconTopbarSize,
                      height: hospitalIconTopbarSize,
                      borderRadius: 8,
                      objectFit: "cover",
                      border: `1px solid ${THEME.border}`,
                      opacity: 0.95,
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: isMobile ? "flex-start" : "flex-end",
            }}
          >
            <SecondaryButton onClick={logout} style={{ minWidth: 120 }}>
              ログアウト
            </SecondaryButton>
          </div>
        </div>
      </div>

      {/* Shell */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: isMobile ? 12 : 16,
          display: "grid",
          gridTemplateColumns: isMobile
            ? "1fr"
            : isNarrow
              ? "220px 1fr"
              : "240px 1fr",
          gap: 14,
        }}
      >
        {/* Sidebar */}
        <div>
          <Card>
            <div style={{ fontSize: 13, opacity: 0.7, fontWeight: 800 }}>
              メニュー
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                marginTop: 12,
                gridTemplateColumns: isMobile
                  ? "repeat(3, minmax(0, 1fr))"
                  : "1fr",
              }}
            >
              <SidebarButton
                active={tab === "send"}
                onClick={() => setTab("send")}
              >
                置く
              </SidebarButton>

              <SidebarButton
                active={tab === "inbox"}
                onClick={() => setTab("inbox")}
                badge={unreadCount ? `未読 ${unreadCount}` : null}
              >
                受け取る
              </SidebarButton>

              <SidebarButton
                active={tab === "sent"}
                onClick={() => setTab("sent")}
              >
                記録
              </SidebarButton>
            </div>
          </Card>
        </div>

        {/* Main */}
        <div>
          {tab === "send" && (
            <SendTab
              headerTitle={headerTitle}
              headerDesc={headerDesc}
              isMobile={isMobile}
              myHospitalId={myHospitalId}
              hospitals={hospitals}
              toHospitalId={toHospitalId}
              setToHospitalId={setToHospitalId}
              comment={comment}
              setComment={setComment}
              pdfFile={pdfFile}
              setPdfFile={setPdfFile}
              sending={sending}
              createDocument={createDocument}
            />
          )}

          {tab === "inbox" && (
            <InboxTab
              headerTitle={headerTitle}
              headerDesc={headerDesc}
              isMobile={isMobile}
              showUnreadOnly={showUnreadOnly}
              setShowUnreadOnly={setShowUnreadOnly}
              showExpired={showExpired}
              setShowExpired={setShowExpired}
              qInbox={qInbox}
              setQInbox={setQInbox}
              filteredInboxDocs={filteredInboxDocs}
              nameOf={nameOf}
              fmt={fmt}
              isExpired={isExpired}
              openPreview={openInboxPreview}
              archiveDocument={archiveDocument}
              statusLabel={statusLabel}
              isLegacyKey={isLegacyKey}
              statusTone={statusTone}
            />
          )}

          {tab === "sent" && (
            <SentTab
              headerTitle={headerTitle}
              headerDesc={headerDesc}
              isMobile={isMobile}
              qSent={qSent}
              setQSent={setQSent}
              filteredSentDocs={filteredSentDocs}
              nameOf={nameOf}
              fmt={fmt}
              isExpired={isExpired}
              cancelDocument={cancelDocument}
              statusLabel={statusLabel}
              statusTone={statusTone}
              openPreview={openSentPreview}
            />
          )}
        </div>
      </div>

      {/* Preview Modal */}
      <PreviewModal
        isOpen={!!previewDoc}
        onClose={closePreview}
        title={previewTitle}
        metaLeft={previewMetaLeft}
        url={previewUrl}
        loading={previewLoading}
        error={previewError}
      />
    </Root>
  );
}
