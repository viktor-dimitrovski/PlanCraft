import React, { useEffect, useRef, useState } from 'react'

export default function PhaseForm({
  phase,
  phases,
  onCancel,
  onSubmit,              // onSubmit(payload, { keepOpen?: boolean })
  contextBank,
  contextProject,
}) {
  const isEditing = !!phase.id

  const [m, setM] = useState({
    id: phase.id,
    priority: phase.priority ?? 0,
    title: phase.title || '',
    description: phase.description || '',
    EstimatedDays: phase.EstimatedDays ?? phase.estimatedDays ?? 0,
    startDate: phase.startDate ? toInput(phase.startDate) : '',
    status: phase.status ?? 0,
    dependantPhaseId: phase.dependantPhaseId ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [addMore, setAddMore] = useState(!isEditing)   // при додавање default on
  const [savedFlash, setSavedFlash] = useState(false)

  const titleRef = useRef(null)

  // ESC = close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  function toInput(d) {
    const x = new Date(d)
    return isNaN(x)
      ? ''
      : `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  }
  function fromInput(v) {
    if (!v) return null
    return new Date(v).toISOString()
  }

  // --- Simple validation: Title != '' AND EstimatedDays > 0
  const isValid = (m.title?.trim()?.length ?? 0) > 0 && Number(m.EstimatedDays) > 0

  async function submit(e) {
    e.preventDefault()
    if (!isValid) return
    setSaving(true)
    try {
      const payload = {
        id: m.id,
        priority: Number(m.priority) || 0,
        title: (m.title || '').trim(),
        description: (m.description || '').trim(),
        EstimatedDays: Number(m.EstimatedDays) || 0,
        startDate: fromInput(m.startDate),
        status: Number(m.status) || 0,
        dependantPhaseId: m.dependantPhaseId ? Number(m.dependantPhaseId) : null,
      }

      // ВАЖНО: испраќаме флаг до parent за да не затвори ако Add more е вклучено и ова е Add (не Edit)
      await onSubmit(payload, { keepOpen: addMore && !isEditing })

      if (!isEditing && addMore) {
        // покажи "Saved ✓", исчисти релевантни полиња и фокусирај Title
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 2000)
        setM(prev => ({
          ...prev,
          id: undefined,
          title: '',
          description: '',
          EstimatedDays: 0,
          startDate: '',
          dependantPhaseId: '',
        }))
        // врати фокус на Title
        setTimeout(() => titleRef.current?.focus(), 0)
      } else {
        onCancel?.()
      }
    } finally {
      setSaving(false)
    }
  }

  const priorPhases = phases
    .filter(p => !m.id || p.id !== m.id)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

  const uiPreview = `${contextBank ? `${contextBank}:` : 'bank:'}${m.title || '<title>'}`

  return (
    <div className="ap-modal ap-phaseModal">
      <div className="ap-modal__card ap-modal__card--xl">
        {/* Header (max 2 реда) */}
        <header className="ap-modal__head ap-modal__head--accent">
          <div className="ap-phaseHdr">
            <div className="ap-phaseHdr__line1">
              <span className="ap-eyebrow">{isEditing ? 'Edit Phase' : 'Add Phase'}</span>
              <h2 className="ap-modal__title">Phase details</h2>
              {savedFlash && <span className="ap-saveBadge">Saved&nbsp;✓</span>}
            </div>
            {(contextBank || contextProject) && (
              <div className="ap-phaseHdr__chips">
                {contextBank && <span className="ap-chip ap-chip--on-accent">Bank: <b>{contextBank}</b></span>}
                {contextProject && <span className="ap-chip ap-chip--on-accent">Project: <b>{contextProject}</b></span>}
              </div>
            )}
          </div>
          <button
            type="button"
            className="ap-modal__close"
            onClick={onCancel}
            aria-label="Close"
            title="Close (Esc)"
          >
            ×
          </button>
        </header>

        {/* Form */}
        <form onSubmit={submit} className="ap-form ap-formGrid ap-formGrid--2">
          {/* BASICS */}
          <div className="ap-section full">
            <div className="ap-section__title">Basics</div>
          </div>

          <div className="ap-field">
            <label>Priority</label>
            <input
              type="number"
              value={m.priority}
              onChange={e => setM({ ...m, priority: e.target.value })}
            />
          </div>

          <div className="ap-field">
            <label>Status</label>
            <select
              value={m.status}
              onChange={e => setM({ ...m, status: Number(e.target.value) })}
            >
              <option value={0}>Planned</option>
              <option value={1}>In Progress</option>
              <option value={2}>Blocked</option>
              <option value={3}>Done</option>
              <option value={9}>Canceled</option>
            </select>
          </div>

          <div className="ap-field full">
            <label>Title</label>
            <input
              ref={titleRef}
              value={m.title}
              onChange={e => setM({ ...m, title: e.target.value })}
              placeholder="Short name"
            />
            {(!m.title || !m.title.trim()) && (
              <div className="ap-field__error">Title is required.</div>
            )}
            <div className="ap-help">UI preview: <code className="ap-code">{uiPreview}</code></div>
          </div>

          <div className="ap-field full">
            <label>Description</label>
            <textarea
              rows={4}
              value={m.description}
              onChange={e => setM({ ...m, description: e.target.value })}
              placeholder="Optional short description…"
            />
          </div>

          {/* SCHEDULING */}
          <div className="ap-section full">
            <div className="ap-section__title">Scheduling</div>
          </div>

          <div className="ap-field">
            <label>Estimate (days)</label>
            <input
              type="number"
              value={m.EstimatedDays}
              onChange={e => setM({ ...m, EstimatedDays: e.target.value })}
            />
            {!(Number(m.EstimatedDays) > 0) && (
              <div className="ap-field__error">Enter a value greater than 0.</div>
            )}
          </div>

          <div className="ap-field">
            <label>Start date</label>
            <input
              type="date"
              value={m.startDate}
              onChange={e => setM({ ...m, startDate: e.target.value })}
            />
          </div>

          {/* DEPENDENCIES */}
          <div className="ap-section full">
            <div className="ap-section__title">Dependencies</div>
          </div>

          <div className="ap-field full">
            <label>Dependant phase</label>
            <select
              value={m.dependantPhaseId ?? ''}
              onChange={e => setM({ ...m, dependantPhaseId: e.target.value })}
            >
              <option value="">None</option>
              {priorPhases.map(p => (
                <option key={p.id} value={p.id}>
                  {p.uiTitle || p.title}
                </option>
              ))}
            </select>
          </div>

          {/* Footer */}
          <div className="ap-modal__foot ap-modal__foot--sticky full">
            {!isEditing && (
              <label className="ap-addMore">
                <input
                  type="checkbox"
                  checked={addMore}
                  onChange={e => setAddMore(e.target.checked)}
                />
                Add more
              </label>
            )}
            <div className="ap-footActions">
              <button type="button" className="ap-btn ghost" onClick={onCancel}>
                Cancel
              </button>
              <button type="submit" className="ap-btn primary" disabled={saving || !isValid}>
                {saving ? 'Saving…' : isEditing ? 'Save' : addMore ? 'Save & add another' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
