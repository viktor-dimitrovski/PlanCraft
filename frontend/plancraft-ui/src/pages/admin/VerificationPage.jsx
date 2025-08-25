// src/components/admin/VerificationPage.jsx
import React, { useMemo, useState } from 'react'

/* --- Tiny inline icons --- */
const CheckIcon = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
    <path d="M7 12l3 3 7-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const XIcon = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
    <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const NoteIcon = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M6 4h9l3 3v13H6z" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M15 4v4h4" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M8 12h8M8 16h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const ResetIcon = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.708V8H3V3h5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </svg>
)

/* --- Simple modal --- */
function Modal({ open, title, initial, onCancel, onSave }) {
  const [text, setText] = useState(initial || '')
  if (!open) return null
  return (
    <div className="ap-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ap-modal__backdrop" onClick={onCancel} />
      <div className="ap-modal__panel">
        <div className="ap-modal__head">
          <div className="ap-modal__title">{title}</div>
          <button className="ap-btn ghost" onClick={onCancel} aria-label="Close">✕</button>
        </div>
        <div className="ap-modal__body">
          <textarea
            className="ap-textarea"
            rows={6}
            placeholder="Write a short note visible to all reviewers…"
            value={text}
            onChange={e=>setText(e.target.value)}
          />
        </div>
        <div className="ap-modal__actions">
          <button className="ap-btn ghost" onClick={onCancel}>Cancel</button>
          <button className="ap-btn primary" onClick={()=>onSave(text.trim())} disabled={!text.trim()}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default function VerificationPage({ phase, criteria, onBack, onUpdateStatus }) {
  const [filter, setFilter]   = useState('all') // all | required | open
  const [query, setQuery]     = useState('')
  const [expanded, setExp]    = useState({})   // id -> bool (read more)
  const [noteFor, setNoteFor] = useState(null) // criterion object for modal

  const toggleExpand = (id) => setExp(prev => ({ ...prev, [id]: !prev[id] }))

  const required = useMemo(() => criteria.filter(c => c.isRequired), [criteria])
  const passedReq = useMemo(
    () => required.filter(c => c.status === 1 || c.status === 3 || c.status === 4),
    [required]
  )
  const pct = required.length ? Math.round((passedReq.length / required.length) * 100) : 0

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return criteria.filter(c => {
      if (filter === 'required' && !c.isRequired) return false
      if (filter === 'open' && !(c.isRequired && !(c.status === 1 || c.status === 3 || c.status === 4))) return false
      if (!q) return true
      const hay = `${c.title || ''} ${c.note || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [criteria, filter, query])

    const onPass = (c) => onUpdateStatus(phase.id, c.id, 1, "");
    const onFail = (c) => onUpdateStatus(phase.id, c.id, 2, "");
    const onReset = (c) => onUpdateStatus(phase.id, c.id, 0, "");

  const onSaveNote = async (text) => {
    if (!noteFor) return
    await onUpdateStatus(phase.id, noteFor.id, 3, text)
    setNoteFor(null)
  }

  return (
    <div className="ap-verify">
      {/* Page header */}
      <header className="ap-verify__head" role="region" aria-label="Verification Toolbar">
        <button className="ap-btn ghost" onClick={onBack} aria-label="Back to phases">← Back</button>

        <div className="ap-verify__title">
          QA Verification — <span className="ap-verify__phase">{phase?.title}</span>
        </div>

        <div className="ap-verify__stats">
          <div className="ap-chip ap-chip--muted">{passedReq.length}/{required.length} required</div>
          <div className="ap-chip ap-chip--muted">{criteria.length} total</div>
          <div className="ap-progress" aria-label="Progress">
            <div className="ap-progress__bar" style={{ width: `${pct}%` }} />
            <span className="ap-progress__label">{pct}%</span>
          </div>
        </div>

        <div className="ap-verify__filters">
          <input
            className="ap-input"
            placeholder="Search scenarios…"
            value={query}
            onChange={e=>setQuery(e.target.value)}
            aria-label="Search"
          />
          <select className="ap-select" value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filter">
            <option value="all">All</option>
            <option value="required">Required only</option>
            <option value="open">Open required</option>
          </select>
        </div>
      </header>

      {/* Cards grid */}
      <div className="ap-verify__list">
        {filtered.map(c => {
          const isPass = c.status === 1 || c.status === 3 || c.status === 4
          const isFail = c.status === 2
          const isExpanded = !!expanded[c.id]

          return (
            <article
              key={c.id}
              className={
                'ap-card ap-verifyCard ' +
                (isPass ? 'is-pass ' : '') +
                (isFail ? 'is-fail ' : '') +
                (isExpanded ? 'is-expanded ' : 'is-collapsed ')
              }
            >
              {/* Top line: status chips */}
              <div className="ap-verifyCard__chips">
                <span className={'ap-chip ' + (c.isRequired ? 'ap-chip--req' : 'ap-chip--opt')}>
                  {c.isRequired ? 'Required' : 'Optional'}
                </span>
                {isPass && <span className="ap-chip ap-chip--pass"><CheckIcon/> Passed</span>}
                {isFail && <span className="ap-chip ap-chip--fail"><XIcon/> Failed</span>}
                {c.note && <span className="ap-chip ap-chip--note"><NoteIcon/> Note</span>}
              </div>

              {/* Scenario text (title holds full scenario) */}
              <div className="ap-scenario">
                <div className="ap-scenario__text">{c.title}</div>
                <button className="ap-link ap-scenario__toggle" onClick={()=>toggleExpand(c.id)}>
                  {isExpanded ? 'Read less' : 'Read more'}
                </button>
              </div>

              {/* Actions row (equal width buttons) */}
              <div className="ap-verifyCard__actions" role="toolbar" aria-label="Actions">
                <button className="ap-btn primary ap-btn--block" onClick={()=>onPass(c)}><CheckIcon/> Pass</button>
                <button className="ap-btn danger outline ap-btn--block" onClick={()=>onFail(c)}><XIcon/> Fail</button>
                <button className="ap-btn ghost ap-btn--block" onClick={()=>setNoteFor(c)}><NoteIcon/> Note</button>
                <button className="ap-btn ghost ap-btn--block" onClick={()=>onReset(c)}><ResetIcon/> Reset</button>
              </div>

              {/* Existing note */}
              {c.note && (
                <div className="ap-card__note">Note: {c.note}</div>
              )}
            </article>
          )
        })}
      </div>

      {/* Note modal */}
      <Modal
        open={!!noteFor}
        title="Accept with note"
        initial={noteFor?.note || ''}
        onCancel={()=>setNoteFor(null)}
        onSave={onSaveNote}
      />
    </div>
  )
}
