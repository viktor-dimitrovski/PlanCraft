import React, { useEffect, useState } from 'react'
import { fetchPeople, apiPost, apiPut, apiDelete } from '../lib/api'

export default function AssignmentPanel({ open, task, onClose, refresh }){
  const [people, setPeople] = useState([])
  const [rows, setRows] = useState([])
  const [original, setOriginal] = useState([])

  useEffect(() => { fetchPeople().then(setPeople) }, [])
  useEffect(() => {
    if (!task) return
    const initial = (task.assignments || []).map(a => ({ id: a.id, personId: a.personId, sharePercent: a.sharePercent, isPrimary: a.isPrimary }))
    setRows(initial.length ? initial : [])
    setOriginal(initial)
  }, [task?.id])

  if (!open || !task) return null

  const total = rows.reduce((s,r)=> s + (parseInt(r.sharePercent,10)||0), 0)
  const over = total !== 100

  const addRow = () => setRows(r => [...r, { personId: people[0]?.id, sharePercent: Math.max(0,100-total), isPrimary: false }])
  const upd = (i, patch) => setRows(rs => rs.map((r,idx) => idx===i ? { ...r, ...patch } : r))
  const del = (i) => setRows(rs => rs.filter((_,idx)=> idx!==i))
  const setPrimary = (i) => setRows(rs => rs.map((r,idx)=> ({ ...r, isPrimary: idx===i })))

  const save = async () => {
    const currentIds = new Set(rows.filter(r=>r.id).map(r=>r.id))
    for (const o of original){
      if (o.id && !currentIds.has(o.id)){
        await apiDelete(`assignments/${o.id}`).catch(()=>{})
      }
    }
    for (const r of rows){
      if (r.id){
        await apiPut(`assignments/${r.id}`, { id:r.id, taskId: task.id, personId: r.personId, sharePercent: parseInt(r.sharePercent,10)||0, isPrimary: !!r.isPrimary }).catch(()=>{})
      } else {
        await apiPost(`assignments`, { taskId: task.id, personId: r.personId, sharePercent: parseInt(r.sharePercent,10)||0, isPrimary: !!r.isPrimary }).catch(()=>{})
      }
    }
    await refresh()
    onClose()
  }

  return (
    <div style={backdropStyle}>
      <div style={panelStyle}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
          <h3 style={{margin:0}}>Assignments — {task.title}</h3>
          <button onClick={onClose}>Close</button>
        </div>
        <div style={{display:'grid', gap:8}}>
          {rows.map((r,i) => (
            <div key={i} style={rowStyle}>
              <select value={r.personId} onChange={e=>upd(i,{personId: parseInt(e.target.value,10)})}>
                {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" min="0" max="100" value={r.sharePercent} onChange={e=>upd(i,{sharePercent: parseInt(e.target.value,10) || 0})} />
              <label style={{display:'flex', alignItems:'center', gap:6}}>
                <input type="radio" name="primary" checked={!!r.isPrimary} onChange={()=>setPrimary(i)} />
                Primary
              </label>
              <button onClick={()=>del(i)}>Remove</button>
            </div>
          ))}
        </div>
        <div style={{display:'flex', justifyContent:'space-between', marginTop:12, alignItems:'center'}}>
          <div style={{fontSize:12, color: over? '#b91c1c' : '#16a34a'}}>Total: {total}% {over? '(should equal 100%)' : ''}</div>
          <div style={{display:'flex', gap:8}}>
            <button onClick={addRow}>Add person</button>
            <button className="primary" disabled={over || rows.length===0} onClick={save}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const backdropStyle = { position:'fixed', inset:0, background:'rgba(0,0,0,.25)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }
const panelStyle = { width: 520, maxWidth:'90vw', background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:16, boxShadow:'0 24px 80px rgba(2,6,23,.25)' }
const rowStyle = { display:'grid', gridTemplateColumns:'1fr 100px 120px 100px', gap:8, alignItems:'center' }
