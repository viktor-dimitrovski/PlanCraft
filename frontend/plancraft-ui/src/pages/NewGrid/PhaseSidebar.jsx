import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { fetchBanks, fetchProjects, getPhases } from '../../lib/api'

function PhaseItem({ phase }){
  const id = `phase:${phase.id}`
  const {attributes, listeners, setNodeRef, isDragging} = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`phaseItem${isDragging ? ' dragging' : ''}`}
      title={phase.title || phase.name}
    >
      {phase.title || phase.name}
    </div>
  )
}

export default function PhaseSidebar({ onPhaseIndex, onVisibilityChange }){
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

  useEffect(() => {
    const map = {}
    for(const pr of projects){
      for(const ph of (phasesByProject[pr.id] || [])){
        map[String(ph.id)] = ph
      }
    }
    if(typeof onPhaseIndex === 'function') onPhaseIndex(map)
  }, [projects, phasesByProject, onPhaseIndex])

  const projectsByBank = useMemo(() => {
    const by = {}
    for(const p of projects){
      const key = String(p.bankId ?? p.clientId ?? 'none')
      if(!by[key]) by[key] = []
      by[key].push(p)
    }
    return by
  }, [projects])

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
                      {(phasesByProject[pr.id]||[]).map(ph => (
                        <PhaseItem key={ph.id} phase={ph} />
                      ))}
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
