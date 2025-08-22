// src/components/Legend.jsx
import React from "react";

/**
 * Legend
 * - Safe when data hasn't loaded yet
 * - De-duplicates entries
 * - Works with either `projects` (that contain bank info) or a `banks` list
 *   Shape tolerated:
 *     project.bank?.{ name,color } OR project.Bank?.{ Name,Color }
 *     bank.{ id,name,color } OR bank.{ Id,Name,Color }
 */
export default function Legend({ projects = [], banks = [] }) {
  const items = React.useMemo(() => {
    const out = [];
    const seen = new Set();

    // Prefer explicit banks prop if present
    if (Array.isArray(banks)) {
      for (const b of banks) {
        const name =
          b?.name ?? b?.Name ?? b?.title ?? "Unassigned bank";
        const color =
          b?.color ?? b?.Color ?? "#94a3b8"; // slate-400 fallback
        const key = `bank:${name}|${color}`;
        if (!seen.has(key)) {
          out.push({ label: name, color });
          seen.add(key);
        }
      }
    }

    // Also derive bank “pills” from projects if provided
    if (Array.isArray(projects)) {
      for (const p of projects) {
        const bank = p?.bank ?? p?.Bank ?? null;
        const label =
          bank?.name ??
          bank?.Name ??
          p?.bankName ??
          p?.name ??
          p?.title ??
          "Project";
        const color =
          bank?.color ?? bank?.Color ?? p?.color ?? "#e2e8f0"; // zinc-200 fallback
        const key = `proj:${label}|${color}`;
        if (!seen.has(key)) {
          out.push({ label, color });
          seen.add(key);
        }
      }
    }

    return out;
  }, [projects, banks]);

  if (!items.length) return null;

  return (
    <div className="legendWrap">
      {items.map((it, i) => (
        <span key={i} className="legendPill">
          <span className="legendDot" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
