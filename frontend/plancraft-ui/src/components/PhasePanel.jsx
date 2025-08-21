import React, { useEffect, useState, useCallback } from 'react'
import { fetchProjects, getPhases, addPhase, apiGet } from '../lib/api'
import { useDraggable } from '@dnd-kit/core'

function DraggablePhase({ phase, scheduled }) {
  const draggable = useDraggable({ id: `phase:${phase.id}`, data: { phase } })
  const { attributes, listeners, setNodeRef, isDragging } = draggable

  const style = {
    padding: '6px 8px',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    margin: '4px 0',
    background: '#fff',
    cursor: scheduled ? 'not-allowed' : 'grab',
    opacity: scheduled ? 0.55 : 1,
    boxShadow: isDragging ? '0 6px 20px rgba(2,6,23,.12)' : 'none',
  }

  // If it's already scheduled, we still render (so you can see it),
  // but we don't attach draggable listeners to avoid accidental duplicates.
  const props = scheduled ? {} : { ...attributes, ...listeners }

  return (
    <div ref={setNodeRef} {...props} style={style} title={scheduled ? 'Already scheduled (has a task)' : 'Drag onto the grid'}>
      {phase.title}{' '}
      <span style={{ color: '#64748b' }}>({phase.estimatedDays}d)</span>
      {scheduled && <span style={{ marginLeft: 8, fontSize: 11, color: '#b45309' }}>• scheduled</span>}
    </div>
  )
}

export default function PhasePanel() {
  const [projects, setProjects] = useState([])
  const [phasesByProject, setPhasesByProject] = useState({})
  const [scheduledPhaseIds, setScheduledPhaseIds] = useState(new Set())
  const [hideScheduled, setHideScheduled] = useState(true)
  const [loading, setLoading] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      // 1) Projects
      const ps = await fetchProjects()
      setProjects(ps)

      // 2) Phases per project
      const map = {}
      for (const p of ps) {
        map[p.id] = await getPhases(p.id)
      }
      setPhasesByProject(map)

      // 3) Scheduled phases set (from tasks having PhaseId)
      const tasks = await apiGet('tasks')
      const scheduled = new Set((tasks || []).filter(t => t.phaseId != null).map(t => t.phaseId))
      setScheduledPhaseIds(scheduled)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Auto-refresh when someone creates a new project elsewhere
  useEffect(() => {
    const onChanged = () => loadAll()
    window.addEventListener('plancraft:projectsChanged', onChanged)
    return () => window.removeEventListener('plancraft:projectsChanged', onChanged)
  }, [loadAll])

  const onAdd = async (pid) => {
    const title = prompt('Phase title'); if (!title) return
    const daysVal = prompt('Estimated days', '5')
    const days = parseInt(daysVal || '5', 10)
    await addPhase(pid, { title, estimatedDays: isNaN(days) ? 5 : days })
    await loadAll()
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <h3 style={{ margin: 0 }}>Projects & Phases</h3>
        <button onClick={loadAll} style={{ marginLeft:'auto' }} disabled={loading}>{loading ? 'Loading…' : 'Reload'}</button>
      </div>
      <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#64748b', margin:'8px 0 12px' }}>
        <input type="checkbox" checked={hideScheduled} onChange={e => setHideScheduled(e.target.checked)} />
        Hide phases that are already scheduled
      </label>

      {projects.map(p => {
        const phases = phasesByProject[p.id] || []
        return (
          <div key={p.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="legendDot" style={{ background: p.color || p.bank?.color }}></span>
              <b>{p.name}</b>
              <button onClick={() => onAdd(p.id)} style={{ marginLeft: 'auto' }}>+ Phase</button>
            </div>
            <div>
              {phases
                .filter(ph => !hideScheduled || !scheduledPhaseIds.has(ph.id))
                .map(ph => (
                  <DraggablePhase key={ph.id} phase={ph} scheduled={scheduledPhaseIds.has(ph.id)} />
                ))}
              {phases.length === 0 && <div style={{ fontSize: 12, color: '#64748b', padding: '6px 0' }}>No phases yet.</div>}
            </div>
          </div>
        )
      })}
      <p style={{ fontSize: 12, color: '#64748b' }}>
        Drag a phase into the grid (onto a person/week) to create a scheduled task and primary assignment.
      </p>
    </div>
  )
}
