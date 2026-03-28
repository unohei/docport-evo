// RecipientPicker.jsx
// 宛先選択コンポーネント: DocPort病院 (hospitals) + FAX連絡先 (contacts) の統合検索UI
//
// recipient オブジェクト構造:
//   DocPort: { type: "hospital", id: string, name: string, sub: null, faxNumber: null }
//   FAX:     { type: "fax", id: string, name: string, sub: string|null, faxNumber: string }
//
// 表示ルール:
//   - contacts.is_active === false → 非表示
//   - contacts.replaced_by_hospital_id が設定済み → 非表示（DocPort移行済み）

import { useState, useMemo, useRef, useEffect } from "react";

const BADGE = {
  hospital: { label: "DocPort", bg: "rgba(14,165,233,0.11)", color: "#0369a1", border: "rgba(14,165,233,0.30)" },
  fax:      { label: "FAX",     bg: "rgba(234,179,8,0.11)",  color: "#854d0e", border: "rgba(234,179,8,0.30)" },
};

function TypeBadge({ type }) {
  const s = BADGE[type] || BADGE.fax;
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 999,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {s.label}
    </span>
  );
}

export default function RecipientPicker({
  hospitals,
  myHospitalId,
  contacts,
  recipient,
  setRecipient,
  disabled = false,
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // 宛先候補を統合（DocPort病院 + 有効なFAX連絡先）
  const candidates = useMemo(() => {
    const list = [];

    // DocPort病院（自院除外）
    (hospitals || [])
      .filter(h => h.id !== myHospitalId)
      .forEach(h => list.push({
        type: "hospital",
        id: h.id,
        name: h.name,
        sub: null,
        faxNumber: null,
      }));

    // FAX連絡先（無効・DocPort移行済みを除外）
    (contacts || [])
      .filter(c => c.is_active && !c.replaced_by_hospital_id)
      .forEach(c => list.push({
        type: "fax",
        id: c.id,
        name: c.name,
        sub: c.department_name || null,
        faxNumber: c.fax_number,
      }));

    return list;
  }, [hospitals, myHospitalId, contacts]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter(c =>
      c.name.toLowerCase().includes(query) ||
      (c.sub || "").toLowerCase().includes(query)
    );
  }, [candidates, q]);

  // クリック外でドロップダウンを閉じる
  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = item => {
    setRecipient(item);
    setQ("");
    setOpen(false);
  };

  const handleClear = () => {
    setRecipient(null);
    setQ("");
  };

  // ---- 選択済み表示 ----
  if (recipient) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 12px", borderRadius: 12,
        border: "1px solid rgba(14,165,233,0.35)",
        background: "rgba(14,165,233,0.06)",
        opacity: disabled ? 0.6 : 1,
      }}>
        <TypeBadge type={recipient.type} />
        <span style={{ flex: 1, fontWeight: 700, color: "#0F172A", fontSize: 14 }}>
          {recipient.name}
          {recipient.sub && (
            <span style={{ fontWeight: 400, color: "rgba(15,23,42,0.50)", fontSize: 12, marginLeft: 6 }}>
              {recipient.sub}
            </span>
          )}
        </span>
        {recipient.type === "fax" && (
          <span style={{ fontSize: 11, color: "rgba(15,23,42,0.40)", fontFamily: "monospace", flexShrink: 0 }}>
            {recipient.faxNumber}
          </span>
        )}
        {!disabled && (
          <button
            onClick={handleClear}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(15,23,42,0.40)", fontSize: 18, lineHeight: 1, padding: "0 2px",
            }}
            title="選択解除"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  // ---- 検索入力 + ドロップダウン ----
  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="病院名・クリニック名で検索..."
          disabled={disabled}
          style={{
            width: "100%", padding: "9px 12px 9px 34px", borderRadius: 12,
            border: "1px solid rgba(15,23,42,0.12)",
            background: disabled ? "rgba(15,23,42,0.04)" : "rgba(255,255,255,0.85)",
            fontWeight: 600, color: "#0F172A", outline: "none",
            boxSizing: "border-box", fontSize: 14,
          }}
        />
        <span style={{
          position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
          fontSize: 14, opacity: 0.35, pointerEvents: "none",
        }}>
          🔍
        </span>
      </div>

      {open && !disabled && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#fff", borderRadius: 12,
          border: "1px solid rgba(15,23,42,0.12)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          zIndex: 50, maxHeight: 280, overflowY: "auto",
        }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: "16px 14px", textAlign: "center",
              color: "rgba(15,23,42,0.45)", fontSize: 13,
            }}>
              一致する宛先がありません
            </div>
          ) : (
            filtered.map(item => (
              <button
                key={`${item.type}-${item.id}`}
                onMouseDown={() => handleSelect(item)}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "10px 14px", border: "none",
                  borderBottom: "1px solid rgba(15,23,42,0.06)",
                  background: "transparent", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  transition: "background 100ms",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(14,165,233,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <TypeBadge type={item.type} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "#0F172A", fontSize: 13 }}>
                    {item.name}
                  </div>
                  {item.sub && (
                    <div style={{ fontSize: 11, color: "rgba(15,23,42,0.50)", marginTop: 1 }}>
                      {item.sub}
                    </div>
                  )}
                </div>
                {item.type === "fax" && item.faxNumber && (
                  <span style={{
                    fontSize: 11, color: "rgba(15,23,42,0.40)",
                    fontFamily: "monospace", flexShrink: 0,
                  }}>
                    {item.faxNumber}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
