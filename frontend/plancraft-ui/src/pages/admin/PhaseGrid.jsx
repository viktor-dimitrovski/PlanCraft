// src/components/admin/PhaseGrid.jsx
import React from 'react'

export default function PhaseGrid({ loading, error, rows, onEdit, onDelete, onOpenCriteria, onStartVerification }) {
  if (error) return <div className="ap-error">{error}</div>
  return (
    <div className="ap-table-wrap">
      <table className="ap-table">
        <thead>
          <tr>
            <th style={{width:70}}>Priority</th>
            <th>Phase</th>
            <th style={{width:110}}>Estimate (d)</th>
            <th style={{width:130}}>Start date</th>
            <th style={{width:140}}>Status</th>
            <th style={{width:240}}>Completed</th>
            <th style={{width:180}}>Depends on</th>
            <th style={{width:300}}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={8}><div className="ap-loader">Loading…</div></td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={8}><div className="ap-empty">No phases yet.</div></td></tr>
          ) : rows.map(p => (
            <tr key={p.id}>
              <td><span className="ap-pill">{p.priority ?? 0}</span></td>
              <td>
                <div className="ap-title-cell">
                  <div className="ap-title-strong">{p.uiTitle}</div>
                  {p.description && <div className="ap-meta">{p.description}</div>}
                </div>
              </td>
              <td>{p.estimateDays ?? ''}</td>
              <td>{p.uiStart}</td>
              <td><StatusBadge value={p.status} /></td>
              <td><Progress value={p.uiPercent ?? 0} /></td>
              <td>{p.dependantPhaseTitle ? <span className="ap-dep">{p.dependantPhaseTitle}</span> : <span className="ap-meta">—</span>}</td>
              <td className="ap-actions-col">
                <button className="ap-btn ghost" onClick={() => onOpenCriteria(p)}>Criteria</button>
                <button className="ap-btn" onClick={() => onStartVerification(p)}>Start Verification</button>
                <button className="ap-btn ghost" onClick={() => onEdit(p)}>Edit</button>
                <button className="ap-btn danger" onClick={() => onDelete(p)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ value }) {
  // 0 Planned,1 InProgress,2 Blocked,3 Done,9 Canceled
  const map = {
    0: { t:'Planned',  c:'#64748b' },
    1: { t:'In Progress', c:'#2563eb' },
    2: { t:'Blocked',  c:'#ef4444' },
    3: { t:'Done',     c:'#16a34a' },
    9: { t:'Canceled', c:'#6b7280' },
  }
  const m = map[value ?? 0] ?? map[0]
  return <span className="ap-badge" style={{background:m.c+'22', color:m.c}}>{m.t}</span>
}

function Progress({ value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  // color ramp: <50 -> red/pink, 50-89 -> teal/blue, >=90 -> green
  let bar = '#ef4444'
  if (v >= 50) bar = '#0ea5e9'
  if (v >= 90) bar = '#16a34a'
  return (
    <div className="ap-progress">
      <div className="ap-progress__track"/>
      <div className="ap-progress__bar" style={{width:`${v}%`, background:bar}}/>
      <div className="ap-progress__cap"/>
      <div className="ap-progress__label" style={{color:bar}}>{v}%</div>
    </div>
  )
}
