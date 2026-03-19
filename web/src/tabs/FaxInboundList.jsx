// FaxInboundList.jsx
// v1.0 FAX受信一覧（最小UI）
// 変更点:
//   1. documents + fax_inbounds(document_id FK) + fax_webhook_events を結合表示
//   2. 受信ステータス(ARRIVED/DOC_CREATED/FAILED)と送信ステータス(QUEUED/SENT/FAILED)をバッジ表示
//   3. PDF「開く」ボタン: presign-download 経由で別タブ表示

import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Card, THEME } from "../components/ui/primitives";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

// ---- ステータス変換（英語 → 日本語）----

function faxInboundStatusLabel(status) {
  if (status === "ARRIVED")     return "受信済み";
  if (status === "DOC_CREATED") return "登録完了";
  if (status === "FAILED")      return "エラー";
  return status || "-";
}

function faxWebhookStatusLabel(status) {
  if (status === "QUEUED")  return "送信待ち";
  if (status === "SENT")    return "送信完了";
  if (status === "FAILED")  return "送信失敗";
  return status || "-";
}

// ---- ステータスバッジ色定義 ----

const INBOUND_TONE = {
  ARRIVED:     { color: "#1d4ed8", bg: "rgba(59,130,246,0.12)" },
  DOC_CREATED: { color: "#047857", bg: "rgba(16,185,129,0.12)" },
  FAILED:      { color: "#b91c1c", bg: "rgba(239,68,68,0.12)" },
};
const WEBHOOK_TONE = {
  QUEUED:  { color: "#92400e", bg: "rgba(245,158,11,0.12)" },
  SENT:    { color: "#047857", bg: "rgba(16,185,129,0.12)" },
  FAILED:  { color: "#b91c1c", bg: "rgba(239,68,68,0.12)" },
};

function StatusBadge({ label, tone }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        color: tone?.color ?? THEME.text,
        background: tone?.bg ?? "rgba(15,23,42,0.08)",
      }}
    >
      {label}
    </span>
  );
}

// ---- データ取得 ----
// 1. documents + fax_inbounds（PostgREST embedded resource で1回のリクエスト）
// 2. fax_webhook_events（provider_message_id IN で一括取得 → JS 側で最新1件を選択）

async function fetchFaxInboundData() {
  const { data: docs, error: docsErr } = await supabase
    .from("documents")
    .select(
      "id, original_filename, file_key, to_hospital_id, created_at," +
      "fax_inbounds!document_id(id, status, provider_message_id, error_stage)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (docsErr) throw docsErr;
  if (!docs || docs.length === 0) return [];

  // fax_inbounds が紐づいているドキュメントだけ表示する
  const faxDocs = docs.filter(
    (d) => Array.isArray(d.fax_inbounds) && d.fax_inbounds.length > 0
  );
  if (faxDocs.length === 0) return [];

  // provider_message_id を収集して fax_webhook_events を一括取得
  const msgIds = faxDocs
    .flatMap((d) => d.fax_inbounds.map((f) => f.provider_message_id))
    .filter(Boolean);

  // provider_message_id → 最新 event_status のマップ
  const webhookMap = {};
  if (msgIds.length > 0) {
    const { data: events } = await supabase
      .from("fax_webhook_events")
      .select("provider_message_id, event_status, created_at")
      .in("provider_message_id", msgIds)
      .order("created_at", { ascending: false });

    // 新着順なので先に来た行が最新（in() の降順ソート済み）
    if (events) {
      for (const ev of events) {
        if (!webhookMap[ev.provider_message_id]) {
          webhookMap[ev.provider_message_id] = ev.event_status;
        }
      }
    }
  }

  // 結合して整形して返す
  return faxDocs.map((doc) => {
    const inbound = doc.fax_inbounds[0]; // 1ドキュメントにつき1 fax_inbound 想定
    const pmid = inbound?.provider_message_id ?? null;
    return {
      id:                  doc.id,
      created_at:          doc.created_at,
      original_filename:   doc.original_filename,
      file_key:            doc.file_key,
      to_hospital_id:      doc.to_hospital_id,
      inbound_status:      inbound?.status ?? null,
      inbound_error_stage: inbound?.error_stage ?? null,
      provider_message_id: pmid,
      webhook_status:      pmid ? (webhookMap[pmid] ?? null) : null,
    };
  });
}

// ---- コンポーネント ----

export default function FaxInboundList({ session }) {
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [openingId, setOpeningId] = useState(null); // PDF取得中の row.id

  const load = () => {
    setLoading(true);
    setError("");
    fetchFaxInboundData()
      .then((data) => setRows(data))
      .catch((e) => setError(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchFaxInboundData()
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((e)   => { if (!cancelled) setError(e?.message ?? String(e)); })
      .finally(()  => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // presign-download 経由で別タブ表示
  const handleOpenPdf = async (row) => {
    if (!row.file_key) return alert("file_key がありません");
    setOpeningId(row.id);
    try {
      const token = session?.access_token;
      const res = await fetch(
        `${API_BASE}/presign-download?key=${encodeURIComponent(row.file_key)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) throw new Error(await res.text());
      const { download_url } = await res.json();
      window.open(download_url, "_blank", "noreferrer");
    } catch (e) {
      alert(`PDF取得エラー: ${e?.message ?? e}`);
    } finally {
      setOpeningId(null);
    }
  };

  const fmt = (dt) =>
    dt ? new Date(dt).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" }) : "-";

  // ---- テーブルスタイル（Tailwind 未使用のためインラインで統一）----
  const thStyle = {
    padding: "8px 12px",
    textAlign: "left",
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(15,23,42,0.55)",
    borderBottom: "2px solid rgba(15,23,42,0.10)",
    whiteSpace: "nowrap",
    background: "rgba(248,250,252,0.9)",
  };
  const tdStyle = {
    padding: "10px 12px",
    fontSize: 13,
    color: THEME.text,
    borderBottom: "1px solid rgba(15,23,42,0.07)",
    verticalAlign: "middle",
  };

  return (
    <Card>
      {/* ヘッダー行 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: THEME.text }}>
            FAX受信一覧
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, color: THEME.text, marginTop: 4 }}>
            CloudFAX経由で受信した書類の処理状況（新着順）
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid rgba(14,165,233,0.35)",
            background: loading ? "rgba(14,165,233,0.04)" : "rgba(14,165,233,0.09)",
            fontSize: 13,
            fontWeight: 800,
            color: THEME.primaryText,
            cursor: loading ? "wait" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "読込中..." : "更新"}
        </button>
      </div>

      {/* ローディング */}
      {loading && (
        <div style={{ padding: "24px 8px", opacity: 0.65, fontSize: 13 }}>
          読み込み中...
        </div>
      )}

      {/* エラー */}
      {!loading && error && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.20)",
            color: "#b91c1c",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          エラー: {error}
        </div>
      )}

      {/* 空 */}
      {!loading && !error && rows.length === 0 && (
        <div style={{ padding: "24px 8px", opacity: 0.6, fontSize: 13 }}>
          FAX受信データがありません。
        </div>
      )}

      {/* テーブル */}
      {!loading && !error && rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>受信日時</th>
                <th style={thStyle}>書類名</th>
                <th style={thStyle}>受信ステータス</th>
                <th style={thStyle}>送信ステータス</th>
                <th style={thStyle}>宛先ID</th>
                <th style={thStyle}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{fmt(row.created_at)}</td>

                  {/* 書類名 */}
                  <td style={{ ...tdStyle, maxWidth: 220 }}>
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={row.original_filename ?? row.file_key ?? "-"}
                    >
                      {row.original_filename ?? row.file_key ?? "-"}
                    </div>
                  </td>

                  {/* 受信ステータス */}
                  <td style={tdStyle}>
                    {row.inbound_status ? (
                      <div>
                        <StatusBadge
                          label={faxInboundStatusLabel(row.inbound_status)}
                          tone={INBOUND_TONE[row.inbound_status]}
                        />
                        {/* FAILED 時の error_stage を補足表示 */}
                        {row.inbound_status === "FAILED" && row.inbound_error_stage && (
                          <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 3 }}>
                            {row.inbound_error_stage}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ opacity: 0.4, fontSize: 12 }}>-</span>
                    )}
                  </td>

                  {/* 送信ステータス */}
                  <td style={tdStyle}>
                    {row.webhook_status ? (
                      <StatusBadge
                        label={faxWebhookStatusLabel(row.webhook_status)}
                        tone={WEBHOOK_TONE[row.webhook_status]}
                      />
                    ) : (
                      <span style={{ opacity: 0.4, fontSize: 12 }}>-</span>
                    )}
                  </td>

                  {/* 宛先（UUIDを短縮表示） */}
                  <td
                    style={{ ...tdStyle, fontSize: 11, opacity: 0.65 }}
                    title={row.to_hospital_id ?? ""}
                  >
                    {row.to_hospital_id
                      ? row.to_hospital_id.slice(0, 8) + "…"
                      : "-"}
                  </td>

                  {/* PDF開くボタン */}
                  <td style={tdStyle}>
                    {row.file_key ? (
                      <button
                        onClick={() => handleOpenPdf(row)}
                        disabled={openingId === row.id}
                        style={{
                          padding: "5px 12px",
                          borderRadius: 8,
                          border: "1px solid rgba(14,165,233,0.4)",
                          background:
                            openingId === row.id
                              ? "rgba(14,165,233,0.04)"
                              : "rgba(14,165,233,0.10)",
                          color: THEME.primaryText,
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: openingId === row.id ? "wait" : "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {openingId === row.id ? "取得中…" : "開く"}
                      </button>
                    ) : (
                      <span style={{ opacity: 0.4, fontSize: 12 }}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
