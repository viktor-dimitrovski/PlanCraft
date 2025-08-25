// src/pages/admin/Phases.jsx
import React, { useEffect, useMemo, useState } from 'react'
import '../../styles/admin-phases.css'
import {
  listPhases, createPhase, updatePhase, deletePhase,
  listCriteria, createCriterion, updateCriterion, deleteCriterion,
  reorderCriteria, setCriterionStatus, calcPercentComplete, ddmmyyyy
} from '../../api/phases'
import PhaseGrid from './PhaseGrid.jsx'
import PhaseForm from './PhaseForm.jsx'
import CriteriaDrawer from './CriteriaDrawer.jsx'
import VerificationPage from './VerificationPage.jsx'

export default function AdminPhases() {
  // In real app, projectId comes from context/selector; default to 1
  const [projectId, setProjectId] = useState(1)
  const [phases, setPhases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editPhase, setEditPhase] = useState(null)
  const [drawerPhase, setDrawerPhase] = useState(null)   // show criteria drawer for this phase
  const [criteria, setCriteria] = useState([])

  const [view, setView] = useState('grid')               // 'grid' | 'verify'
  const [verifyPhase, setVerifyPhase] = useState(null)
  const [verifyCriteria, setVerifyCriteria] = useState([])

  useEffect(() => { load() }, [projectId])
  async function load() {
    try {
      setLoading(true)
      const data = await listPhases(projectId)
      setPhases(data || [])
    } catch (e) {
      setError(e.message || 'Failed to load phases')
    } finally {
      setLoading(false)
    }
  }

  async function onCreateOrUpdate(p) {
    try {
      if (p.id) await updatePhase(p.id, p)
      else await createPhase(projectId, p)
      await load()
      setEditPhase(null)
    } catch (e) { alert(e.message) }
  }

  async function onDelete(phase) {
    if (!window.confirm(`Delete phase "${phase.title}"?`)) return
    try { await deletePhase(phase.id); await load() } catch (e) { alert(e.message) }
  }

  async function openDrawer(phase) {
    setDrawerPhase(phase)
    const list = await listCriteria(phase.id)
    setCriteria(list || [])
  }

  async function startVerification(phase) {
    const list = await listCriteria(phase.id)
    setVerifyPhase(phase)
    setVerifyCriteria(list || [])
    setView('verify')
  }

  // inline status toggle from drawer/verification
  async function updateCriterionStatus(criterionId, status, note) {
    await setCriterionStatus(criterionId, status, note)
    // softly refresh both states if opened
    if (drawerPhase) {
      const list = await listCriteria(drawerPhase.id)
      setCriteria(list || [])
    }
    if (verifyPhase) {
      const list = await listCriteria(verifyPhase.id)
      setVerifyCriteria(list || [])
    }
    await load()
  }

  const sortedPhases = useMemo(() => {
    const arr = [...phases]
    arr.sort((a,b) => (a.priority ?? 0) - (b.priority ?? 0))
    return arr.map(p => ({
      ...p,
      uiTitle: `bank:${p.title || ''}`,
      uiStart: p.startDate ? ddmmyyyy(p.startDate) : '',
      uiPercent: typeof p.completedPct === 'number' ? p.completedPct : (p.criteria ? calcPercentComplete(p.criteria) : 0),
    }))
  }, [phases])

  if (view === 'verify' && verifyPhase) {
    return (
      <VerificationPage
        phase={verifyPhase}
        criteria={verifyCriteria}
        onBack={() => setView('grid')}
        onUpdateStatus={updateCriterionStatus}
      />
    )
  }

  return (
    <div className="admin-phases">
      <header className="ap-header">
        <div className="ap-title">Administration · Phases</div>
        <div className="ap-actions">
          <button className="ap-btn" onClick={() => setEditPhase({})}>+ Add Phase</button>
          <select className="ap-select" value={projectId} onChange={e => setProjectId(Number(e.target.value) || 1)}>
            <option value="1">Project 1</option>
            <option value="2">Project 2</option>
          </select>
        </div>
      </header>

      <PhaseGrid
        loading={loading}
        error={error}
        rows={sortedPhases}
        onEdit={p => setEditPhase(p)}
        onDelete={onDelete}
        onOpenCriteria={openDrawer}
        onStartVerification={startVerification}
      />

      {editPhase && (
        <PhaseForm
          phase={editPhase}
          phases={sortedPhases}
          onCancel={() => setEditPhase(null)}
          onSubmit={onCreateOrUpdate}
        />
      )}

      {drawerPhase && (
        <CriteriaDrawer
          phase={drawerPhase}
          items={criteria}
          onClose={() => setDrawerPhase(null)}
          onAdd={async (payload) => { await createCriterion(drawerPhase.id, payload); const list = await listCriteria(drawerPhase.id); setCriteria(list) ; await load() }}
          onUpdate={async (id, payload) => { await updateCriterion(id, payload); const list = await listCriteria(drawerPhase.id); setCriteria(list) ; await load() }}
          onDelete={async (id) => { await deleteCriterion(id); const list = await listCriteria(drawerPhase.id); setCriteria(list) ; await load() }}
          onReorder={async (orderedIds) => { await reorderCriteria(drawerPhase.id, orderedIds); const list = await listCriteria(drawerPhase.id); setCriteria(list) ; await load() }}
          onToggleStatus={updateCriterionStatus}
        />
      )}
    </div>
  )
}
