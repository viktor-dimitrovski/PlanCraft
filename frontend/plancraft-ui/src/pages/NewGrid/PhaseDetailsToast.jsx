// src/app/grid/PhaseDetailsToast.jsx
import React, { useEffect } from "react";

export default function PhaseDetailsToast({ data, onClose }) {
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => onClose?.(), 10000);
    return () => clearTimeout(t);
  }, [data, onClose]);

  if (!data) return null;

  return (
    <div
      className="ng-toast"
      style={{
        position: "absolute", right: 16, bottom: 8, zIndex: 80,
        maxWidth: 480, background: "#0f172a", color: "#e2e8f0",
        border: "1px solid rgba(226,232,240,.15)", borderRadius: 12,
        boxShadow: "0 20px 60px rgba(2,6,23,.4)", padding: "12px 14px"
      }}
      role="status" aria-live="polite"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 9999, background: data.color || "#2563eb" }} />
        <strong style={{ fontSize: 14 }}>{data.title}</strong>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "6px 10px", fontSize: 12 }}>
        <div style={{ color: "#94a3b8" }}>Bank</div><div>{data.bank ?? "—"}</div>
        <div style={{ color: "#94a3b8" }}>Completion</div><div>{data.completion ?? "—"}</div>
        <div style={{ color: "#94a3b8" }}>Start</div><div>{data.start ?? "—"}</div>
        <div style={{ color: "#94a3b8" }}>End</div><div>{data.end ?? "—"}</div>
        <div style={{ color: "#94a3b8" }}>Estimation</div><div>{data.est ?? "—"}</div>
        <div style={{ color: "#94a3b8" }}>Description</div><div>{data.description || "—"}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <button
          onClick={onClose}
          style={{
            padding: "6px 10px", borderRadius: 8, cursor: "pointer",
            border: "1px solid rgba(226,232,240,.2)", background: "transparent", color: "#e2e8f0"
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
