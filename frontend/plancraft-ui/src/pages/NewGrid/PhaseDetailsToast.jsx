// src/app/grid/PhaseDetailsToast.jsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * PhaseDetailsToast (redesigned)
 * - Two-column meta layout
 * - Sticky Assignments header, scrollable body
 * - Consistent typography & spacing
 * - Central date formatting (default dd.MM.yyyy)
 *
 * Date format priority:
 *  1) data.dateFormat
 *  2) window.__PLANGRID_DATE_FMT (if present)
 *  3) "dd.MM.yyyy" (default)
 */

export default function PhaseDetailsToast({ data, onClose }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
    if (!data) return;
    const t = setTimeout(() => onClose?.(), 10000);
    return () => clearTimeout(t);
  }, [data, onClose]);


  // ---------- Date formatting ----------
  const dateFormat = data?.dateFormat || window.__PLANGRID_DATE_FMT || "dd.MM.yyyy";
  const fmtDate = useMemo(() => makeFormatter(dateFormat), [dateFormat]);

  // Normalize description
  const desc = String(data?.description ?? "").trim();
  const LIMIT = 220;
  const isLong = desc.length > LIMIT;
  const visibleText = expanded || !isLong ? desc : desc.slice(0, LIMIT) + "…";

  // ---------- Assignments model ----------
  const splits = useMemo(() => {
    // Preferred: data.splits [{ personId, personName, start, end, days }]
    if (Array.isArray(data?.splits) && data.splits.length) {
      return data.splits.map(s => ({
        ...s,
        start: fmtDate(s.start),
        end: fmtDate(s.end),
        days: Number(s.days || 0),
        personName: s.personName || (s.personId ? `#${s.personId}` : "—"),
      }));
    }
    // Fallback: data.assignments [{ personId, personName?, startDate, assignedDays }]
    if (Array.isArray(data?.assignments) && data.assignments.length) {
      return data.assignments.map(a => {
        const startISO = toIso(a.startDate);
        const endISO = addDaysIso(startISO, Math.max(0, Number(a.assignedDays || 0) - 1));
        return {
          personId: a.personId ?? null,
          personName: a.personName ?? (a.personId ? `#${a.personId}` : "—"),
          start: fmtDate(startISO),
          end: fmtDate(endISO),
          days: Number(a.assignedDays || 0),
        };
      });
    }
    return [];
  }, [data, fmtDate]);

  if (!data) return null;

  // ---------- UI ----------
  return (
    <div
      className="ng-toast"
      role="status"
      aria-live="polite"
      style={styles.shell}
    >
      {/* Title */}
      <div style={styles.header}>
        <div style={{ ...styles.dot, background: data.color || "#2563eb" }} />
        <div style={styles.title}>{data.title}</div>
      </div>

      {/* Meta grid */}
      <div style={styles.metaGrid}>
        <Label>Bank</Label><Value>{data.bank ?? "—"}</Value>
        <Label>Completion</Label><Value>{data.completion ?? "—"}</Value>
        <Label>Start</Label><Value>{fmtDate(data.start)}</Value>
        <Label>End</Label><Value>{fmtDate(data.end)}</Value>
        <Label>Estimation</Label><Value>{data.est ?? "—"}</Value>

        <Label>Description</Label>
        <Value>
          <div style={styles.desc}>
            {visibleText || "—"}
            {isLong && (
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                style={styles.moreBtn}
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        </Value>
      </div>

      {/* Assignments table */}
      {splits.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={styles.sectionTitle}>Assignments</div>
          <div style={styles.tableWrap}>
            <div style={styles.tableHeader}>
              <div style={{ ...styles.th, textAlign: "left" }}>Person</div>
              <div style={{ ...styles.th, textAlign: "left" }}>When</div>
              <div style={{ ...styles.th, textAlign: "right", width: 56 }}>Days</div>
            </div>
            <div style={styles.tableBody} role="list">
              {splits.map((s, i) => (
                <div key={i} style={styles.row} role="listitem">
                  <div style={styles.cellPerson} title={String(s.personId || "")}>
                    {s.personName}
                  </div>
                  <div style={styles.cellWhen}>
                    <span style={styles.whenMono}>{s.start}</span>
                    <span style={styles.whenArrow}> → </span>
                    <span style={styles.whenMono}>{s.end}</span>
                  </div>
                  <div style={styles.cellDays}>
                    <span style={styles.badge}>{Number(s.days || 0)}d</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer action */}
      <div style={styles.actions}>
        <button onClick={onClose} style={styles.closeBtn}>Close</button>
      </div>
    </div>
  );
}

/* --- Small presentational helpers --- */
function Label({ children }) {
  return <div style={styles.label}>{children}</div>;
}
function Value({ children }) {
  return <div style={styles.value}>{children}</div>;
}

/* --- Styles (inline for portability) --- */
const styles = {
  shell: {
    position: "absolute",
    right: 16,
    bottom: 8,
    zIndex: 80,
    maxWidth: 640,
    background: "#0f172a",
    color: "#e2e8f0",
    border: "1px solid rgba(226,232,240,.15)",
    borderRadius: 12,
    boxShadow: "0 20px 60px rgba(2,6,23,.40)",
    padding: "14px 16px",
    fontFamily: "Inter, Roboto, system-ui, -apple-system, Segoe UI, Arial, sans-serif",
    fontSize: 13,
    lineHeight: 1.45,
  },
  header: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 9999, background: "#2563eb", flex: "0 0 10px" },
  title: { fontWeight: 700, fontSize: 14 },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "140px 1fr",
    gap: "8px 12px",
    alignItems: "start",
  },
  label: { color: "#93a2b1" },
  value: {},
  desc: { whiteSpace: "pre-wrap", wordBreak: "break-word" },
  moreBtn: {
    marginLeft: 6, border: "none", background: "transparent",
    color: "#93c5fd", cursor: "pointer", fontSize: 12, padding: 0,
  },
  sectionTitle: { fontSize: 12, color: "#cbd5e1", marginBottom: 6, fontWeight: 700 },
  tableWrap: {
    border: "1px solid rgba(148,163,184,.25)",
    borderRadius: 10,
    overflow: "hidden",
    background: "rgba(15,23,42,.35)",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 1.2fr 56px",
    padding: "8px 10px",
    position: "sticky",
    top: 0,
    background: "rgba(15,23,42,.85)",
    backdropFilter: "blur(2px)",
    borderBottom: "1px solid rgba(148,163,184,.25)",
    zIndex: 1,
  },
  th: { fontSize: 11, color: "rgba(226,232,240,.8)", fontWeight: 600 },
  tableBody: {
    maxHeight: 180,
    overflowY: "auto",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1.2fr 56px",
    padding: "8px 10px",
    alignItems: "center",
    borderBottom: "1px dashed rgba(148,163,184,.18)",
  },
  cellPerson: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cellWhen: { display: "flex", alignItems: "baseline", gap: 2, minWidth: 220 },
  whenMono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace" },
  whenArrow: { opacity: 0.75 },
  cellDays: { textAlign: "right" },
  badge: {
    display: "inline-block",
    minWidth: 28,
    padding: "2px 6px",
    borderRadius: 6,
    fontWeight: 600,
    background: "rgba(59,130,246,.16)",
    color: "#cfe0ff",
    textAlign: "right",
  },
  actions: { display: "flex", justifyContent: "flex-end", marginTop: 12 },
  closeBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
    border: "1px solid rgba(226,232,240,.25)",
    background: "transparent",
    color: "#e2e8f0",
  },
};

/* --- Date helpers --- */
function makeFormatter(fmt) {
  // Support a few common tokens without external deps.
  // Accept Date | ISO string (yyyy-mm-dd) | anything new Date() can parse.
  return function formatAny(dLike) {
    if (!dLike) return "—";
    let d;
    try {
      if (typeof dLike === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dLike)) {
        const [y, m, dd] = dLike.split("-").map(Number);
        d = new Date(y, (m || 1) - 1, dd || 1);
      } else {
        d = new Date(dLike);
      }
      if (Number.isNaN(d.getTime())) return "—";
    } catch {
      return "—";
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    switch (fmt) {
      case "yyyy-MM-dd":
        return `${yyyy}-${mm}-${dd}`;
      case "MM/dd/yyyy":
        return `${mm}/${dd}/${yyyy}`;
      case "dd.MM.yyyy":
      default:
        return `${dd}.${mm}.${yyyy}`;
    }
  };
}

function toIso(d) {
  try {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}
function addDaysIso(isoStart, add) {
  try {
    const [y, m, d] = String(isoStart).split("-").map(Number);
    const x = new Date(y, (m || 1) - 1, d || 1);
    x.setDate(x.getDate() + Number(add || 0));
    return x.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}
