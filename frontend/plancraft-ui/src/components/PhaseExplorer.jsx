import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { fetchProjects, getPhases, addPhase, apiGet } from '../lib/api'
import { useDraggable } from '@dnd-kit/core'

function PhaseChip({ phase, scheduled }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `phase:${phase.id}`, data: { phase } })
  const style = {
    padding:'6px 8px', border:'1px solid var(--border)', borderRadius:8, margin:'4px 0',
    background:'#fff', cursor: scheduled ? 'not-allowed' : 'grab',
    opacity: scheduled ? .55 : 1, boxShadow: isDragging ? '0 6px 20px rgba(2,6,23,.12)' : 'none'
  }
  const props = scheduled ? {} : { ...attributes, ...listeners }
  return (
    <div ref={setNodeRef} {...props} className={`phaseChip ${scheduled ? 'scheduled' : ''}`}>
      {phase.title} <span style={{color:'var(--muted)'}}>({phase.estimatedDays}d)</span>
      {scheduled && <span style={{ marginLeft: 8, fontSize: 11, color: '#b45309' }}>• scheduled</span>}
    </div>
  )
}

export default function PhaseExplorer(){
  const [projects, setProjects] = useState([])
  const [phasesByProject, setPhasesByProject] = useState({})
  const [scheduledPhaseIds, setScheduledPhaseIds] = useState(new Set())
  const [hideScheduled, setHideScheduled] = useState(true)
  const [search, setSearch] = useState('')
  const [openBanks, setOpenBanks] = useState({})
  const [openProjects, setOpenProjects] = useState({})
  const [loading, setLoading] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const ps = await fetchProjects()
      setProjects(ps)
      const map = {}
      for (const p of ps) map[p.id] = await getPhases(p.id)
      setPhasesByProject(map)

      // If /api/tasks exists, compute which phases are already scheduled.
      try {
        const tasks = await apiGet('tasks')
        const sched = new Set((tasks || []).filter(t => t.phaseId != null).map(t => t.phaseId))
        setScheduledPhaseIds(sched)
      } catch {
        setScheduledPhaseIds(new Set())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Single, deduplicated listener set
  useEffect(() => {
    const onChanged = () => loadAll()
    window.addEventListener('plancraft:projectsChanged', onChanged)
    window.addEventListener('plancraft:refresh', onChanged)
    return () => {
      window.removeEventListener('plancraft:projectsChanged', onChanged)
      window.removeEventListener('plancraft:refresh', onChanged)
    }
  }, [loadAll])

  const grouped = useMemo(() => {
    const byBank = new Map()
    for (const p of projects) {
      const bKey = p.bankId || 0
      const bankName = p.bank?.name || 'Unassigned bank'
      const bankColor = p.bank?.color || '#94a3b8'
      if (!byBank.has(bKey)) byBank.set(bKey, { bankName, bankColor, projects: [] })
      byBank.get(bKey).projects.push(p)
    }
    return Array.from(byBank.entries()).map(([bankId, val]) => ({ bankId, ...val }))
  }, [projects])

  const onAdd = async (projectId) => {
    const title = prompt('Phase title'); if (!title) return
    const days = parseInt(prompt('Estimated days', '5') || '5', 10)
    await addPhase(projectId, { title, estimatedDays: isNaN(days) ? 5 : days })
    await loadAll()
  }

  const match = (txt) => (search ? (txt || '').toLowerCase().includes(search.toLowerCase()) : true)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <h3 style={{ margin: 0 }}>Projects & Phases</h3>
        <button onClick={loadAll} style={{ marginLeft:'auto' }} disabled={loading}>{loading ? 'Loading…' : 'Reload'}</button>
      </div>

      <div className="searchRow" style={{ margin:'8px 0 10px' }}>
        <input placeholder="Search project or phase…" value={search} onChange={e=>setSearch(e.target.value)} />
        <label style={{ display:'flex', alignItems:'center', gap:8 }}>
          <input type="checkbox" checked={hideScheduled} onChange={e=>setHideScheduled(e.target.checked)} />
          Hide scheduled
        </label>
        <div/>
      </div>

      {grouped.map(group => {
        const isOpenBank = openBanks[group.bankId] ?? true
        return (
          <div key={`bank-${group.bankId}`} style={{ marginBottom:8 }}>
            <div className="bankHead" onClick={()=>setOpenBanks(s=>({ ...s, [group.bankId]: !isOpenBank }))}>
              <span className="legendDot" style={{ background: group.bankColor }}></span>
              <b>{group.bankName}</b>
              <span className="badge" style={{ marginLeft:'auto' }}>{group.projects.length} projects</span>
            </div>
            {isOpenBank && (
              <div style={{ paddingLeft:6 }}>
                {group.projects.map(p => {
                  const phases = (phasesByProject[p.id] || [])
                    .filter(ph => match(p.name) || match(ph.title))
                    .filter(ph => !hideScheduled || !scheduledPhaseIds.has(ph.id))
                  const isOpenProj = openProjects[p.id] ?? true
                  return (
                    <div key={`proj-${p.id}`} style={{ marginBottom:6 }}>
                      <div className="projectHead" onClick={()=>setOpenProjects(s=>({ ...s, [p.id]: !isOpenProj }))}>
                        <span className="legendDot" style={{ background: p.color || p.bank?.color || '#e2e8f0' }}></span>
                        <b>{p.name}</b>
                        <span className="badge" style={{ marginLeft:'auto' }}>{phases.length} phases</span>
                        <button onClick={(e)=>{ e.stopPropagation(); onAdd(p.id) }} className="primary">+ Phase</button>
                      </div>
                      {isOpenProj && (
                        <div style={{ paddingLeft:8 }}>
                          {phases.length === 0 && <div style={{ fontSize:12, color:'var(--muted)', padding:'6px 0' }}>No phases.</div>}
                          {phases.map(ph => <PhaseChip key={ph.id} phase={ph} scheduled={scheduledPhaseIds.has(ph.id)} />)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>
        Drag a phase into the grid (onto a person/week) to create a scheduled task and primary assignment.
      </p>
    </div>
  )
}
