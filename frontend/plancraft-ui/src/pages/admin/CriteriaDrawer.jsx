// src/components/admin/CriteriaDrawer.jsx
import React, { useMemo, useState } from 'react'

export default function CriteriaDrawer({
  phase, items, onClose, onAdd, onUpdate, onDelete, onReorder, onToggleStatus
}) {
  const [title, setTitle] = useState('')
  const [isRequired, setIsRequired] = useState(true)

  const summary = useMemo(() => {
    const req = items.filter(x => x.isRequired)
    const ok = req.filter(x => x.status === 1 || x.status === 4).length
    const pct = req.length ? Math.round((ok/req.length)*100) : 0
    return { total: items.length, required: req.length, ok, pct }
  }, [items])

  // drag&drop reorder
  const [dragId, setDragId] = useState(null)
  function dragStart(id){ setDragId(id) }
  function dragOver(e){ e.preventDefault() }
  async function drop(targetId){
    if (dragId == null || dragId === targetId) return
    const ids = items.map(x => x.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    ids.splice(to,0,ids.splice(from,1)[0])
    await onReorder(ids)
    setDragId(null)
  }

  async function add() {
    if (!title.trim()) return
    await onAdd({ title: title.trim(), isRequired })
    setTitle(''); setIsRequired(true)
  }

  return (
    <>
      <div className="ap-drawer">
        <div className="ap-drawer__head">
          <div>
            <div className="ap-drawer__title">Acceptance Criteria — {phase?.title}</div>
            <div className="ap-drawer__meta">{summary.ok}/{summary.required} required · {summary.total} total · {summary.pct}%</div>
          </div>
          <button className="ap-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ap-drawer__add">
          <input placeholder="New criterion title…" value={title} onChange={e=>setTitle(e.target.value)} />
          <label className="ap-switch">
            <input type="checkbox" checked={isRequired} onChange={e=>setIsRequired(e.target.checked)} />
            <span>Required</span>
          </label>
          <button className="ap-btn" onClick={add}>Add</button>
        </div>

        <div className="ap-criteria-list">
          {items.map(item => (
            <div key={item.id}
                 className="ap-crit"
                 draggable
                 onDragStart={()=>dragStart(item.id)}
                 onDragOver={dragOver}
                 onDrop={()=>drop(item.id)}
            >
              <div className="ap-crit__handle">⋮⋮</div>
              <div className="ap-crit__main">
                <div className="ap-crit__title">{item.title}</div>
                <div className="ap-crit__meta">{item.isRequired ? 'Required' : 'Optional'}</div>
              </div>

              <div className="ap-crit__actions">
                <StatusToggle item={item} onToggle={onToggleStatus}/>
                <button className="ap-btn ghost" onClick={()=>onUpdate(item.id, { title: prompt('Edit title', item.title) || item.title })}>Edit</button>
                <button className="ap-btn danger" onClick={()=>onDelete(item.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="ap-drawer-backdrop" onClick={onClose}/>
    </>
  )
}

function StatusToggle({ item, onToggle }) {
  // 1 Pass, 2 Fail, 3 AcceptedWithNote, 4 ??? (you mentioned 4 in formula; keep 3 here for UI)
  const active = item.status
  async function set(s) {
    let note = undefined
    if (s === 3) note = prompt('Note (optional):', item.note || '') || ''
    await onToggle(item.id, s, note)
  }
  return (
    <div className="ap-status-toggle">
      <button className={'ap-chip ' + (active===1?'on':'')} onClick={()=>set(1)}>Pass</button>
      <button className={'ap-chip ' + (active===2?'on':'')} onClick={()=>set(2)}>Fail</button>
      <button className={'ap-chip ' + (active===3?'on':'')} onClick={()=>set(3)}>Accept w/ Note</button>
    </div>
  )
}
