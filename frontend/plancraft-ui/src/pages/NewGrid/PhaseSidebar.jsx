import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { fetchBanks, fetchProjects, getPhases } from '../../lib/api'

function PhaseItem({ phase, totalDays = 0, remainingDays = 0 }){
  const id = `phase:${phase.id}`
  const {attributes, listeners, setNodeRef, isDragging} = useDraggable({
    id,
    data: { kind: 'phase', phase }
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`phaseItem${isDragging ? " dragging" : ""} ${remainingDays <= 0 ? "depleted" : ""}`}
      title={phase.title || phase.name}
    >
      <span className="phaseTitle">{phase.title || phase.name}</span>
      <span className="phaseDays">
        {totalDays > 0 ? `${remainingDays}/${totalDays}d` : `${remainingDays}d`}
      </span>
    </div>
  )
}

export default function PhaseSidebar({ onPhaseIndex, onVisibilityChange, remainingByPhase = {}, hideFullyAssigned = false }){
  const [banks, setBanks] = useState([])
  const [projects, setProjects] = useState([])
  const [phasesByProject, setPhasesByProject] = useState({})
  const [openBank, setOpenBank] = useState({})
  const [openProj, setOpenProj] = useState({})

  // stable emitter to avoid parent re-render loops
  const emitRef = useRef(() => {})
  useEffect(() => { emitRef.current = onVisibilityChange || (() => {}) }, [onVisibilityChange])

  useEffect(() => {
    fetchBanks().then(setBanks).catch(()=>setBanks([]))
    fetchProjects().then(setProjects).catch(()=>setProjects([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const out = {}
      for(const p of projects){
        try{
          const phases = await getPhases(p.id)
          out[p.id] = (phases || []).map(ph => ({ ...ph, projectId: p.id }))
        }catch{ out[p.id] = [] }
      }
      if(!cancelled) setPhasesByProject(out)
    })()
    return () => { cancelled = true }
  }, [projects])

  // Expose phase index (enriched with bank color) to parent
  useEffect(() => {
    if (typeof onPhaseIndex !== 'function') return
    const projMap = {}
    for (const p of projects) projMap[String(p.id)] = p
    const bankMap = {}
    for (const b of banks) bankMap[String(b.id)] = b

    const idx = {}
    for (const pr of projects) {
      for (const ph of (phasesByProject[pr.id] || [])) {
        const project = projMap[String(pr.id)]
        const bank = project ? (bankMap[String(project.bankId ?? project.clientId ?? '')] || project.bank) : null
        const color = (bank && bank.color) || ph.color || "#2563eb"
        idx[String(ph.id)] = { ...ph, color }
      }
    }
    onPhaseIndex(idx)
  }, [banks, projects, phasesByProject, onPhaseIndex])

  const projectsByBank = useMemo(() => {
    const by = {}
    for(const p of projects){
      const key = String(p.bankId ?? p.clientId ?? 'none')
      if(!by[key]) by[key] = []
      by[key].push(p)
    }
    return by
  }, [projects])

  // Emit visible phases (by opened projects) to parent
  useEffect(() => {
    const visiblePhaseIds = []
    for(const [pid, isOpen] of Object.entries(openProj)){
      if(!isOpen) continue
      for(const ph of (phasesByProject[pid] || [])){
        visiblePhaseIds.push(Number(ph.id))
      }
    }
    emitRef.current({ visiblePhaseIds })
  }, [openProj, phasesByProject])

  return (
    <div className="ng-phases">
      {banks.map(b => (
        <div key={b.id} className="bank">
          <button className="bankBtn" onClick={()=>setOpenBank(o=>({...o, [b.id]: !o[b.id]}))}>
            <span className="dot" style={{ background: b.color || '#e5e7eb' }} />
            {b.name}
            <span className="count">{(projectsByBank[String(b.id)]||[]).length}</span>
          </button>
          {openBank[b.id] && (
            <div className="bankProjects">
              {(projectsByBank[String(b.id)]||[]).map(pr => (
                <div key={pr.id} className="proj">
                  <button className="projBtn" onClick={()=>setOpenProj(o=>({...o, [pr.id]: !o[pr.id]}))}>
                    {pr.name}
                    <span className="count">{(phasesByProject[pr.id]||[]).length}</span>
                  </button>
                  {openProj[pr.id] && (
                    <div className="phaseList">
                      {(phasesByProject[pr.id]||[])
                        .filter(ph => {
                          const total = Number(ph.estimatedDays || ph.durationDays || ph.days || 0) || 0
                          const rem = (remainingByPhase && remainingByPhase[String(ph.id)] != null)
                            ? Number(remainingByPhase[String(ph.id)])
                            : total
                          return !hideFullyAssigned || rem > 0
                        })
                        .map(ph => {
                          const total = Number(ph.estimatedDays || ph.durationDays || ph.days || 0) || 0
                          const rem = (remainingByPhase && remainingByPhase[String(ph.id)] != null)
                            ? Number(remainingByPhase[String(ph.id)])
                            : total
                          return (
                            <PhaseItem key={ph.id} phase={ph} totalDays={total} remainingDays={rem} />
                          )
                        })}
                      {!((phasesByProject[pr.id]||[]).length) && <div className="ng-empty">No phases</div>}
                    </div>
                  )}
                </div>
              ))}
              {!((projectsByBank[String(b.id)]||[]).length) && <div className="ng-empty">No projects</div>}
            </div>
          )}
        </div>
      ))}
      {!banks.length && <div className="ng-empty">No banks</div>}
    </div>
  )
}
