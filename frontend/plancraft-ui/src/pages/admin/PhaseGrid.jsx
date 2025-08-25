// src/components/admin/PhaseGrid.jsx
import React, { useMemo, useState } from 'react'

export default function PhaseGrid({
  loading,
  error,
  rows,
  onEdit,
  onDelete,
  onOpenCriteria,
  onStartVerification
}) {
  const [expanded, setExpanded] = useState(() => new Set())

  const toggle = (id) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const normalized = useMemo(() => Array.isArray(rows) ? rows : [], [rows])

  if (error) return <div className="ap-error">{error}</div>

  return (
    <div className="ap-table-wrap adminHeader">
      <table className="ap-table tableWrap">
        <thead>
          <tr>
            <th style={{ width: 70 }}>Priority</th>
            <th>Phase</th>
            <th style={{ width: 110 }}>Estimate (d)</th>
            <th style={{ width: 130 }}>Start date</th>
            <th style={{ width: 140 }}>Status</th>
            <th style={{ width: 240 }}>Completed</th>
            <th style={{ width: 180 }}>Depends on</th>
            <th style={{ width: 300 }}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={8}>
                <div className="ap-loader">Loading…</div>
              </td>
            </tr>
          ) : normalized.length === 0 ? (
            <tr>
              <td colSpan={8}>
                <div className="ap-empty">No phases yet.</div>
              </td>
            </tr>
          ) : (
            normalized.map(p => {
              const isOpen = expanded.has(p.id)
              const desc = p.description || ''
              const needToggle = desc.length > 120 // show expander only for longer texts
              return (
                <tr key={p.id} className={`ap-row ${isOpen ? 'is-expanded' : ''}`}>
                  <td><span className="ap-pill">{p.priority ?? 0}</span></td>

                  <td>
                    <div className="ap-title-cell">
                      <div className="ap-title-strong" title={p.uiTitle}>
                        {p.uiTitle}
                      </div>

                      {desc && (
                        <div className={`ap-meta ap-desc ${isOpen ? 'is-open' : ''}`} title={desc}>
                          {desc}
                        </div>
                      )}

                      {needToggle && (
                        <button
                          type="button"
                          className="ap-more"
                          onClick={() => toggle(p.id)}
                          aria-expanded={isOpen}
                        >
                          {isOpen ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  </td>

                  <td>{p.estimatedDays ?? p.EstimatedDays ?? ''}</td>
                  <td>{p.uiStart}</td>
                  <td><StatusBadge value={p.status} /></td>
                  <td><Progress value={p.uiPercent ?? 0} /></td>

                  <td>
                    {p.dependantPhaseTitle
                      ? <span className="ap-dep">{p.dependantPhaseTitle}</span>
                      : <span className="ap-meta">—</span>}
                  </td>

                  <td className="ap-actions-col">
                    <button className="ap-btn ghost" onClick={() => onOpenCriteria(p)}>Criteria</button>
                    <button className="ap-btn verify" onClick={() => onStartVerification(p)}>Verify</button>
                    <button className="ap-btn ghost" onClick={() => onEdit(p)}>Edit</button>
                    <button className="ap-btn danger" onClick={() => onDelete(p)}>Delete</button>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ value }) {
  // 0 Planned,1 InProgress,2 Blocked,3 Done,9 Canceled
  const map = {
    0: { t: 'Planned',      c: '#111827' },   // darker for contrast
    1: { t: 'In Progress',  c: '#2563eb' },
    2: { t: 'Blocked',      c: '#ef4444' },
    3: { t: 'Done',         c: '#16a34a' },
    9: { t: 'Canceled',     c: '#6b7280' },
  }
  const m = map[value ?? 0] ?? map[0]
  return (
    <span
      className="ap-badge"
      style={{ background: m.c + '20', color: m.c }}
    >
      {m.t}
    </span>
  )
}

// Progress.jsx
function Progress({
  value,
  className = '',
  ariaLabel = 'Progress',
  showLabel = true,
}) {
  const n = Number.isFinite(+value) ? +value : 0;
  const v = Math.max(0, Math.min(100, n));

  return (
    <div
      className={`ap-progress ${className}`}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
    >
      <div className="ap-progress__bar" style={{ width: `${v}%` }} />
      {showLabel && <span className="ap-progress__label">{v}%</span>}
    </div>
  );
}

