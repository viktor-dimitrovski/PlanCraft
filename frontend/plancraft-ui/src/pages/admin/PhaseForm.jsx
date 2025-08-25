// src/components/admin/PhaseForm.jsx
import React, { useState } from 'react'

export default function PhaseForm({ phase, phases, onCancel, onSubmit, contextBank, contextProject }) {
  const [m, setM] = useState({
    id: phase.id,
    priority: phase.priority ?? 0,
    title: phase.title || '',
    description: phase.description || '',
    EstimatedDays: phase.EstimatedDays ?? 0, // keep your existing naming
    startDate: phase.startDate ? toInput(phase.startDate) : '',
    status: phase.status ?? 0,
    dependantPhaseId: phase.dependantPhaseId ?? '',
  })
  const [saving, setSaving] = useState(false)

  function toInput(d) {
    const x = new Date(d)
    return isNaN(x) ? '' : `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`
  }
  function fromInput(v) {
    if (!v) return null
    return new Date(v).toISOString()
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        id: m.id,
        priority: Number(m.priority) || 0,
        title: m.title?.trim(),
        description: m.description?.trim(),
        EstimatedDays: Number(m.EstimatedDays) || 0,
        startDate: fromInput(m.startDate),
        status: Number(m.status) || 0,
        dependantPhaseId: m.dependantPhaseId ? Number(m.dependantPhaseId) : null,
      }
      await onSubmit(payload)
    } finally {
      setSaving(false)
    }
  }

  const priorPhases = phases
    .filter(p => !m.id || p.id !== m.id)
    .sort((a,b) => (a.priority??0)-(b.priority??0))

  return (
    <div className="ap-modal">
      <div className="ap-modal__card">
        <div className="ap-modal__head">
          <div className="ap-modal__title">{m.id ? 'Edit Phase' : 'Add Phase'}</div>
          <button className="ap-icon-btn" onClick={onCancel} aria-label="Close">✕</button>
        </div>

        {/* NEW: show filter context so user knows where this phase will be created */}
        {(contextBank || contextProject) && (
          <div className="ap-meta" style={{ margin: '0 20px 8px' }}>
            {contextBank && <>Bank: <b>{contextBank}</b>&nbsp;&nbsp;</>}
            {contextProject && <>Project: <b>{contextProject}</b></>}
          </div>
        )}

        <form onSubmit={submit} className="ap-form">
          <div className="ap-two">
            <label>
              Priority
              <input type="number" value={m.priority}
                onChange={e=>setM({...m, priority: e.target.value})}/>
            </label>
            <label>
              Status
              <select value={m.status}
                onChange={e=>setM({...m, status: Number(e.target.value)})}>
                <option value={0}>Planned</option>
                <option value={1}>In Progress</option>
                <option value={2}>Blocked</option>
                <option value={3}>Done</option>
                <option value={9}>Canceled</option>
              </select>
            </label>
          </div>

          <label>
            Title <span className="ap-hint">(UI will show as <b>bank:&lt;title&gt;</b>)</span>
            <input
              value={m.title}
              onChange={e => setM({ ...m, title: e.target.value })}
              placeholder="Short name"
            />
          </label>

          <label>
            Description
            <textarea rows={3} value={m.description}
              onChange={e=>setM({...m, description:e.target.value})}/>
          </label>

          <div className="ap-two">
            <label>
              Estimate (days)
              <input type="number" value={m.EstimatedDays}
                onChange={e=>setM({...m, EstimatedDays:e.target.value})}/>
            </label>
            <label>
              Start date
              <input type="date" value={m.startDate}
                onChange={e=>setM({...m, startDate:e.target.value})}/>
            </label>
          </div>

          <label>
            Dependant phase
            <select value={m.dependantPhaseId ?? ''}
              onChange={e=>setM({...m, dependantPhaseId: e.target.value})}>
              <option value="">None</option>
              {priorPhases.map(p =>
                <option key={p.id} value={p.id}>
                  {p.uiTitle || p.title}
                </option>
              )}
            </select>
          </label>

          <div className="ap-modal__foot">
            <button type="button" className="ap-btn ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="ap-btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
