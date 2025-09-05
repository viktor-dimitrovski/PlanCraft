// src/app/grid/PlanningFooter.jsx
import React, { useMemo } from "react";
import PhaseDetailsToast from "./PhaseDetailsToast";

const fmt = (d) => { try { return d?.toISOString?.().slice(0,10) || "—"; } catch { return "—"; } };

export default function PlanningFooter({
  period, people = [], phaseIndex = {}, assignmentsCache,
  projectsByBank = {}, selectedPhaseData, onCloseToast
}) {
  const stats = useMemo(() => {
    let phases = 0, assignedDays = 0, remainingDays = 0;
    const projects = new Set();

    if (assignmentsCache && typeof assignmentsCache.forEach === "function") {
      assignmentsCache.forEach((list, pid) => {
        const ph = phaseIndex[String(pid)] || {};
        const total = Number(ph.estimatedDays || ph.durationDays || ph.days || 0) || 0;
        const used = (list || []).reduce((s, a) => s + Number(a.assignedDays || 0), 0);
        assignedDays += used;
        remainingDays += Math.max(0, total - used);
        phases += 1;
        if (ph.projectId != null) projects.add(String(ph.projectId));
      });
    }
    return { phases, people: people.length, projects: projects.size, assignedDays, remainingDays };
  }, [assignmentsCache, phaseIndex, people]);

  return (
    <div
      className="ng-footer"
      style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 70,
        height: 80, display: "flex", alignItems: "center",
        gap: 12, padding: "8px 12px",
        background: "#fff", borderTop: "1px solid #e5e7eb"
      }}
    >
      {/* единствен лев-алигниран блок (ќе тече колку што собира) */}
      <Badge label="Period" value={`${fmt(period?.from)} → ${fmt(period?.to)}`} />
      <Badge label="Phases" value={stats.phases} />
      <Badge label="People" value={stats.people} />
      <Badge label="Assigned" value={`${stats.assignedDays}d`} />
      <Badge label="Remaining" value={`${stats.remainingDays}d`} />

      {/* toast внатре, апсолутно десно/долу за да „лебди“ над содржина */}
      <div style={{ position: "relative", flex: 1 }}>
        <PhaseDetailsToast data={selectedPhaseData} onClose={onCloseToast} />
      </div>
    </div>
  );
}

function Badge({ label, value }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "6px 10px", borderRadius: 8,
      border: "1px solid #e5e7eb", background: "#f8fafc", marginRight: 8
    }}>
      <span style={{ color: "#475569", fontSize: 12 }}>{label}:</span>
      <strong style={{ fontSize: 12 }}>{String(value)}</strong>
    </div>
  );
}
