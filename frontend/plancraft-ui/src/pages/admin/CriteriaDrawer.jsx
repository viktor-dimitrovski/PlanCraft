import React, { useMemo, useState } from 'react'

export default function CriteriaDrawer({
  phase, items, onClose, onAdd, onUpdate, onDelete, onReorder
}) {
  const [title, setTitle] = useState('')
  const [isRequired, setIsRequired] = useState(true)

  const summary = useMemo(() => {
    const req = items.filter(x => x.isRequired)
    const ok = req.filter(x => x.status === 1 || x.status === 4).length
    const pct = req.length ? Math.round((ok / req.length) * 100) : 0
    return { total: items.length, required: req.length, ok, pct }
  }, [items])

  // Expand/collapse per item
  const [expanded, setExpanded] = useState({})
  const toggleExpand = (id) => setExpanded(s => ({ ...s, [id]: !s[id] }))

  // Inline edit
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const startEdit = (item) => { setEditingId(item.id); setEditTitle(item.title || '') }
  const cancelEdit = () => { setEditingId(null); setEditTitle('') }
  const saveEdit = async (id) => {
    const t = editTitle.trim()
    if (t) await onUpdate(id, { title: t })
    cancelEdit()
  }

  // Drag & drop with dashed placeholder
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const [overPos, setOverPos] = useState('before')  // 'before' | 'after'

  function dragStart(id, e) {
    setDragId(id)
    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(id))
    }
  }
  function dragOverRow(e, itemId) {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = e.clientY < (rect.top + rect.height / 2) ? 'before' : 'after'
    if (overId !== itemId || overPos !== pos) { setOverId(itemId); setOverPos(pos) }
  }
  function dragEnd() { setDragId(null); setOverId(null); setOverPos('before') }
  async function drop(targetId) {
    if (dragId == null || targetId == null || dragId === targetId) { dragEnd(); return }
    const ids = items.map(x => x.id)
    const from = ids.indexOf(dragId)
    let to = ids.indexOf(targetId)
    if (overPos === 'after') to += 1
    const moved = ids.splice(from, 1)[0]
    if (from < to) to -= 1
    ids.splice(to, 0, moved)
    await onReorder(ids)
    dragEnd()
  }

  return (
    <>
      {/* wider drawer */}
      <div className="ap-drawer ap-drawer--wide">
        <div className="ap-drawer__head">
          <div>
            <div className="ap-drawer__title">Acceptance Criteria — {phase?.title}</div>
            <div className="ap-drawer__meta">
              {summary.ok}/{summary.required} required · {summary.total} total · {summary.pct}%
            </div>
          </div>
          <button className="ap-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ap-drawer__add">
          <input
            placeholder="New criterion title…"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <label className="ap-switch">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={e => setIsRequired(e.target.checked)}
            />
            <span>Required</span>
          </label>
          <button className="ap-btn" onClick={async () => {
            if (!title.trim()) return
            await onAdd({ title: title.trim(), isRequired })
            setTitle(''); setIsRequired(true)
          }}>Add</button>
        </div>

        <div className="ap-criteria-list">
          {items.map(item => {
            const state =
              item.status === 1 ? 'is-pass' :
              item.status === 2 ? 'is-fail' :
              item.status === 3 ? 'is-note' : 'is-none'

            const isDragging = dragId === item.id
            const showBefore = !isDragging && overId === item.id && overPos === 'before'
            const showAfter  = !isDragging && overId === item.id && overPos === 'after'
            const isEditing = editingId === item.id
            const isExpanded = !!expanded[item.id]

            return (
              <React.Fragment key={item.id}>
                {showBefore && <div className="ap-drop-indicator" aria-hidden="true" />}
                <article
                  className={`ap-verifyRow ${state} ${isDragging ? 'is-dragging' : ''}`}
                  draggable
                  onDragStart={(e) => dragStart(item.id, e)}
                  onDragOver={(e) => dragOverRow(e, item.id)}
                  onDrop={() => drop(item.id)}
                  onDragEnd={dragEnd}
                >

                  {/* zone 1: status */}
                  <div className="ap-verifyRow__status">
                    <span className={`ap-statusDot ${state}`} aria-hidden="true">
                      {state === 'is-fail' ? (
                        <svg viewBox="0 0 24 24" width="14" height="14">
                          <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="14" height="14">
                          <path d="M7 12l3 3 7-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <div className="ap-verifyRow__chips">
                      <span className={`ap-chip ${item.isRequired ? 'ap-chip--req' : 'ap-chip--opt'}`}>
                        {item.isRequired ? 'Required' : 'Optional'}
                      </span>
                      {item.status === 1 && <span className="ap-chip ap-chip--pass">Passed</span>}
                      {item.status === 2 && <span className="ap-chip ap-chip--fail">Failed</span>}
                      {item.status === 3 && <span className="ap-chip ap-chip--note">Note</span>}
                    </div>
                  </div>

                  {/* zone 2: text */}
                  <div className="ap-verifyRow__text">
                    {isEditing ? (
                      <div className="ap-inlineEdit">
                        <textarea
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          className="ap-inlineEdit__input"
                          rows={3}
                          autoFocus
                        />
                        <div className="ap-inlineEdit__actions">
                          <button className="ap-btn ap-btn--sm primary" onClick={() => saveEdit(item.id)}>Save</button>
                          <button className="ap-btn ap-btn--sm ghost" onClick={cancelEdit}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={`ap-scenario__text ${isExpanded ? 'is-expanded' : 'is-clamped'}`}>
                          {item.title}
                        </div>
                        <button className="ap-link ap-scenario__toggle" onClick={() => toggleExpand(item.id)}>
                          {isExpanded ? 'Show less' : 'Read more'}
                        </button>
                      </>
                    )}
                  </div>

                  {/* zone 3: actions */}
                  <div className="ap-verifyRow__actions" role="toolbar" aria-label="Actions">
                    <button className="ap-btn ap-btn--sm" onClick={() => startEdit(item)}>Edit</button>
                    <button className="ap-btn danger ap-btn--sm" onClick={() => onDelete(item.id)}>Delete</button>
                    <div className="ap-rowHandle" title="Drag to reorder">⋮⋮</div>
                  </div>
                </article>
                {showAfter && <div className="ap-drop-indicator" aria-hidden="true" />}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      <div className="ap-drawer-backdrop" onClick={onClose}/>
    </>
  )
}
