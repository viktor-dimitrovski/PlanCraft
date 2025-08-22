import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { fetchProjects, getPhases, addPhase, fetchBanks, fetchTasks } from '../lib/api'
import { useDraggable } from '@dnd-kit/core'

/* Deterministic soft color if bank has no color in DTO */
function colorFromSeed(seed) {
  const s = (typeof seed === 'number' ? seed : String(seed || '')).toString()
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return `hsl(${h}deg 60% 85%)`
}

function PhaseChip({ phase, scheduled, color, bankId }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `phase:${phase.id}`,
    // expose bank coloring to the drop target (scheduler) without breaking existing usage
    data: { phase, bankId, bankColor: color },
    disabled: scheduled,
  })

  const style = {
    padding:'6px 8px',
    border:'1px solid var(--stroke)',
    borderLeft:`4px solid ${color || 'var(--brand-600)'}`,
    borderRadius:12,
    margin:'4px 0',
    // subtle tint so phases visually link to their bank
    background: color ? `color-mix(in srgb, ${color} 8%, #fff)` : '#fff',
    cursor: scheduled ? 'not-allowed' : (isDragging ? 'grabbing' : 'grab'),
    opacity: scheduled ? .55 : (isDragging ? 0 : 1),
    boxShadow: '0 1px 1px rgba(2,6,23,.03)',
    touchAction: 'none',
  }
  const props = scheduled ? {} : { ...attributes, ...listeners }

  return (
    <div ref={setNodeRef} {...props} style={style} className={`phaseChip ${scheduled ? 'scheduled' : ''}`}>
      <span className="grip" aria-hidden>⋮⋮</span>
      {phase.title} <span className="muted-2">({phase.estimatedDays}d)</span>
      {scheduled && <span className="lock" title="Already scheduled">🔒</span>}
    </div>
  )
}

export default function PhaseExplorer(){
  const [projects, setProjects] = useState([])
  const [phasesByProject, setPhasesByProject] = useState({})

  // Banks (id -> { name, color })
  const [bankMap, setBankMap] = useState(new Map())

  // Phases that are already scheduled (hide to prevent duplicates)
  const [scheduledPhaseIds, setScheduledPhaseIds] = useState(new Set())

  const [search, setSearch] = useState('')
  const [openBanks, setOpenBanks] = useState({})
  const [openProjects, setOpenProjects] = useState({})
  const [loading, setLoading] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      // 1) Banks
      try {
        const banks = await fetchBanks()
        const map = new Map()
        for (const b of banks || []) {
          map.set(b.id, { name: b.name, color: b.color || colorFromSeed(b.id) })
        }
        setBankMap(map)
      } catch {
        setBankMap(new Map())
      }

      // 2) Projects
      const ps = await fetchProjects()
      setProjects(ps)

      // 3) Phases per project
      const map = {}
      for (const p of ps) map[p.id] = await getPhases(p.id)
      setPhasesByProject(map)

      // 4) Scheduled phases from tasks (expects tasks carry phaseId)
      try {
        const tasks = await fetchTasks()
        const ids = new Set((tasks || []).filter(t => t.phaseId != null).map(t => t.phaseId))
        setScheduledPhaseIds(ids)
      } catch {
        setScheduledPhaseIds(new Set())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Keep in sync with grid actions (schedule/unschedule)
  useEffect(() => {
    const onChanged = () => loadAll()

    const onPhaseScheduled = (e) => {
      const id = e?.detail?.phaseId
      if (typeof id === 'number') {
        setScheduledPhaseIds(prev => {
          const next = new Set(prev); next.add(id); return next
        })
      }
    }
    const onPhaseUnscheduled = (e) => {
      const id = e?.detail?.phaseId
      if (typeof id === 'number') {
        setScheduledPhaseIds(prev => {
          const next = new Set(prev); next.delete(id); return next
        })
      }
    }

    window.addEventListener('plancraft:projectsChanged', onChanged)
    window.addEventListener('plancraft:refresh', onChanged)
    window.addEventListener('plancraft:phaseScheduled', onPhaseScheduled)
    window.addEventListener('plancraft:phaseUnscheduled', onPhaseUnscheduled)
    return () => {
      window.removeEventListener('plancraft:projectsChanged', onChanged)
      window.removeEventListener('plancraft:refresh', onChanged)
      window.removeEventListener('plancraft:phaseScheduled', onPhaseScheduled)
      window.removeEventListener('plancraft:phaseUnscheduled', onPhaseUnscheduled)
    }
  }, [loadAll])

  /* Publish colors to a tiny global for the grid to reuse (no coupling) */
  useEffect(() => {
    const bank = {}
    bankMap.forEach((v, k) => { bank[k] = v.color })
    const project = {}
    for (const p of projects) {
      const info = bankMap.get(p.bankId)
      if (info) project[p.id] = info.color
    }
    window.PLANCRAFT_COLORS = { bank, project }
  }, [bankMap, projects])

  /* Group projects by bankId using real bank names/colors */
  const grouped = useMemo(() => {
    const groups = new Map()
    for (const p of projects) {
      const id = p.bankId
      const info = bankMap.get(id) || { name: `Bank #${id}`, color: colorFromSeed(id) }
      if (!groups.has(id)) groups.set(id, { bankId: id, bankName: info.name, bankColor: info.color, projects: [] })
      groups.get(id).projects.push(p)
    }
    return Array.from(groups.values())
  }, [projects, bankMap])

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
        <div/>
      </div>

      {grouped.map(group => {
        const isOpenBank = openBanks[group.bankId] ?? true
        return (
          /* Set --accent here so all children (project head + chips) inherit bank color */
          <div key={`bank-${group.bankId}`} style={{ marginBottom:8, '--accent': group.bankColor }}>
            <div className="bankHead" onClick={()=>setOpenBanks(s=>({ ...s, [group.bankId]: !isOpenBank }))}>
              <span className={'chev' + (isOpenBank ? ' open' : '')} aria-hidden />
              <span className="legendDot" style={{ background: group.bankColor }}></span>
              <b>{group.bankName}</b>
              <span className="badge soft" style={{ marginLeft:'auto' }}>{group.projects.length} projects</span>
            </div>
            {isOpenBank && (
              <div style={{ paddingLeft:6 }}>
                {group.projects.map(p => {
                  const phases = (phasesByProject[p.id] || [])
                    .filter(ph => match(p.name) || match(ph.title))
                    .filter(ph => !scheduledPhaseIds.has(ph.id))  // NEVER show scheduled (prevents duplicates)
                  const isOpenProj = openProjects[p.id] ?? true
                  return (
                    <div key={`proj-${p.id}`} style={{ marginBottom:6 }}>
                      <div className="projectHead" onClick={()=>setOpenProjects(s=>({ ...s, [p.id]: !isOpenProj }))}>
                        <span className={'chev' + (isOpenProj ? ' open' : '')} aria-hidden />
                        <span className="legendDot" style={{ background: group.bankColor }}></span>
                        <b>{p.name}</b>
                        <span className="badge soft" style={{ marginLeft:'auto' }}>{phases.length} phases</span>
                        <button onClick={(e)=>{ e.stopPropagation(); onAdd(p.id) }} className="primary">+ Phase</button>
                      </div>
                      {isOpenProj && (
                        <div style={{ paddingLeft:8 }}>
                          {phases.length === 0 && <div style={{ fontSize:12, color:'var(--muted)', padding:'6px 0' }}>No phases.</div>}
                          {phases.map(ph => (
                            <PhaseChip
                              key={ph.id}
                              phase={ph}
                              scheduled={false}
                              color={group.bankColor}
                              bankId={group.bankId}
                            />
                          ))}
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
