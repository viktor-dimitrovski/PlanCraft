import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'

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

export default function PhaseSidebar({
  banks: banksProp,
  projectsByBank: projectsByBankProp,
  onPhaseIndex,
  onVisibilityChange,
  remainingByPhase = {},
  hideFullyAssigned = false,
  onCatalogs,
}){
  const [banks, setBanks] = useState([])
  const [projects, setProjects] = useState([])
  const [phasesByProject, setPhasesByProject] = useState({})
  const [openBank, setOpenBank] = useState({})
  const [openProj, setOpenProj] = useState({})
  const [selectedBanks, setSelectedBanks] = useState({})
  const [selectedProjects, setSelectedProjects] = useState({})
// run default 'select all' only once; preserve user selection across refreshes
const didInitSelections = useRef(false);

  // keep banksProp
  useEffect(() => {
    if (Array.isArray(banksProp)) setBanks(banksProp)
  }, [banksProp])

// flatten projectsByBankProp and seed phases
useEffect(() => {
  if (!projectsByBankProp) return
  const prjs = []
  const out = {}
  Object.entries(projectsByBankProp).forEach(([bankId, list]) => {
    (list || []).forEach(pr => {
      prjs.push({ ...pr, bankId: Number(bankId) })
      out[pr.id] = pr.phases || []
    })
  })
  setProjects(prjs)
  setPhasesByProject(out)

  // selection init/merge:
  if (!didInitSelections.current) {
    // default: select all (once, on first load)
    const sb = {}; (banksProp || []).forEach(b => { sb[String(b.id)] = true })
    const sp = {}; prjs.forEach(pr => { sp[String(pr.id)] = true })
    setSelectedBanks(sb); setSelectedProjects(sp)
    didInitSelections.current = true
  } else {
    // merge new banks/projects as selected=true, keep existing user choices;
    // also drop projects that disappeared
    setSelectedBanks(prev => {
      const next = { ...prev }
      ;(banksProp || []).forEach(b => {
        const k = String(b.id)
        if (!(k in next)) next[k] = true
      })
      return next
    })
    setSelectedProjects(prev => {
      const next = { ...prev }
      const present = new Set(prjs.map(p => String(p.id)))
      prjs.forEach(pr => {
        const k = String(pr.id)
        if (!(k in next)) next[k] = true
      })
      // prune removed projects
      Object.keys(next).forEach(k => { if (!present.has(k)) delete next[k] })
      return next
    })
  }
}, [projectsByBankProp, banksProp])

  // expose index to parent
  useEffect(() => {
    if (typeof onPhaseIndex !== 'function') return
    const bankMap = {}; (banks || []).forEach(b => bankMap[String(b.id)] = b)
    const idx = {}
    for (const pr of projects) {
      const bank = bankMap[String(pr.bankId ?? pr.clientId ?? '')] || null
      for (const ph of (phasesByProject[pr.id] || [])) {
        idx[String(ph.id)] = {
          ...ph,
          bankId: pr.bankId ?? pr.clientId ?? bank?.id ?? null,
          color: bank?.color || ph.color || '#2563eb',
          bankPrefix: String((bank?.code || bank?.shortCode || bank?.abbr || bank?.name || 'bank'))
            .toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,8) || 'bank',
        }
      }
    }
    onPhaseIndex(idx)
  }, [banks, projects, phasesByProject, onPhaseIndex])

  const projectsByBank = useMemo(() => {
    const by = {}
    for (const pr of projects) {
      const key = String(pr.bankId ?? pr.clientId ?? 'none')
      if (!by[key]) by[key] = []
      by[key].push(pr)
    }
    return by
  }, [projects])

  // catalogs back to parent (optional)
  useEffect(() => {
    if (typeof onCatalogs !== 'function') return
    const banksCatalog = (banks || []).map(b => ({ id:b.id, name:b.name, color:b.color }))
    const projMap = {}
    for (const pr of (projects || [])) {
      const bid = String(pr.bankId ?? pr.clientId ?? 'none')
      if (!projMap[bid]) projMap[bid] = []
      if (!projMap[bid].some(x => String(x.id) === String(pr.id))) {
        projMap[bid].push({ id: pr.id, name: pr.name, phases: phasesByProject[pr.id] || [] })
      }
    }
    for (const k of Object.keys(projMap)) {
      projMap[k].sort((a,b)=> String(a.name).localeCompare(String(b.name)))
    }
    onCatalogs({ banks: banksCatalog, projectsByBank: projMap })
  }, [onCatalogs, banks, projects, phasesByProject])

  // emit ONLY selection (no expand/collapse filtering)
  const emitRef = useRef(()=>{})
  useEffect(() => { emitRef.current = onVisibilityChange || (()=>{}) }, [onVisibilityChange])
  useEffect(() => {
    const selectedBankIds = Object.entries(selectedBanks).filter(([,v])=>v).map(([k])=>Number(k))
    const selectedProjectIds = Object.entries(selectedProjects).filter(([,v])=>v).map(([k])=>Number(k))
    emitRef.current({ selectedBankIds, selectedProjectIds })
  }, [selectedBanks, selectedProjects])

  // selection helpers
  function toggleBankSelected(bankId){
    setSelectedBanks(prev => {
      const next = { ...prev, [bankId]: !prev[bankId] }
      const projs = projectsByBank[String(bankId)] || []
      setSelectedProjects(pv => {
        const copy = { ...pv }
        for (const pr of projs) copy[String(pr.id)] = next[bankId] ? true : false
        return copy
      })
      return next
    })
  }
  function toggleProjectSelected(projectId){
    setSelectedProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }))
  }
  function selectAll(){
    const sb = {}; (banks || []).forEach(b => sb[String(b.id)] = true)
    const sp = {}; (projects || []).forEach(pr => sp[String(pr.id)] = true)
    setSelectedBanks(sb); setSelectedProjects(sp)
  }
  function deselectAll(){
    const sb = {}; (banks || []).forEach(b => sb[String(b.id)] = false)
    const sp = {}; (projects || []).forEach(pr => sp[String(pr.id)] = false)
    setSelectedBanks(sb); setSelectedProjects(sp)
  }

  return (
    <div className="ng-phases">
      <div className="ng-phases-controls">
        <button className="bankCtrl" onClick={selectAll}>Select all</button>
        <button className="bankCtrl" onClick={deselectAll}>Deselect all</button>
      </div>

      {(banks || []).map(b => (
        <div key={b.id} className="bank">
          <div className={`bankRow ${selectedBanks[b.id] ? "is-selected": ""}`}>
            {/* expand/collapse does NOT filter */}
            <button className="bankBtn" onClick={()=>setOpenBank(o=>({...o, [b.id]: !o[b.id]}))} title="Expand/collapse">
              <span className="dot" style={{ background: b.color || '#e5e7eb' }} />
              {b.name}
              <span className="count">{(projectsByBank[String(b.id)]||[]).length}</span>
            </button>
            {/* selection affects filtering */}
            <button className="bankSel" title={selectedBanks[b.id] ? "Deselect" : "Select"}
              onClick={()=>toggleBankSelected(b.id)} />
          </div>

          {openBank[b.id] && (
            <div className="bankProjects">
              {(projectsByBank[String(b.id)]||[]).map(pr => (
                <div key={pr.id} className={`projRow ${selectedProjects[pr.id] ? "is-selected": ""}`}>
                  {/* expand/collapse does NOT filter */}
                  <button className="projBtn" onClick={()=>setOpenProj(o=>({...o, [pr.id]: !o[pr.id]}))} title="Expand/collapse">
                    {pr.name}
                    <span className="count">{(phasesByProject[pr.id]||[]).length}</span>
                  </button>
                  {/* selection affects filtering */}
                  <button className="projSel" title={selectedProjects[pr.id] ? "Deselect" : "Select"}
                    onClick={()=>toggleProjectSelected(pr.id)} />

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
      {!banks?.length && <div className="ng-empty">No banks</div>}
    </div>
  )
}
