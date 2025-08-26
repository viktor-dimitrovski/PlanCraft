// src/pages/admin/Management.jsx
import React, { useCallback, useEffect, useState, Suspense } from 'react'
import '../../styles/admin.css'
import { fetchBanks, fetchProjects, getPhases } from '../../lib/api'

// --- Lazy chunks (one file per section) ---
const BanksSection    = React.lazy(() => import('./sections/BanksSection'))
const ProjectsSection = React.lazy(() => import('./sections/ProjectsSection'))
// const PhasesSection   = React.lazy(() => import('./sections/PhasesSection'))
const TasksSection    = React.lazy(() => import('./sections/TasksSection'))
const UsersSection    = React.lazy(() => import('./sections/UsersSection'))
const AdminPhases     = React.lazy(() => import('./Phases.jsx')) // NEW

// Optional: warm up chunks on hover/focus for snappier UX
const preload = {
  banks:    () => import('./sections/BanksSection'),
  projects: () => import('./sections/ProjectsSection'),
  // phases:   () => import('./sections/PhasesSection'),
  tasks:    () => import('./sections/TasksSection'),
  users:    () => import('./sections/UsersSection'),
  adminPhases:  () => import('./Phases.jsx'), // NEW
}

// Tiny fallback block used while a chunk loads
function LoadingCard({ label = 'Loading…' }) {
  return <div className="adminCard"><header className="adminCard__head"><h3 className="adminCard__title">{label}</h3></header></div>
}

export default function Management() {
  const [tab, setTab] = useState(() => {
    const hash = window.location.hash || ''
    const qs = hash.includes('?') ? hash.split('?')[1] : ''
    const fromUrl = new URLSearchParams(qs).get('tab')
    let fromStore = null
    try { fromStore = localStorage.getItem('mgmt.tab') } catch {}
    return fromUrl || fromStore || 'banks'
  }) // banks | projects | phases | adminPhases | tasks | users

  const [banks, setBanks] = useState([])
  const [projects, setProjects] = useState([])
  const [phasesByProject, setPhasesByProject] = useState({})

  const refreshAll = useCallback(async () => {
    const bs = (await fetchBanks()) || []
    setBanks(bs)

    const ps = (await fetchProjects()) || []
    setProjects(ps)

    // Build phases map in parallel
    const pairs = await Promise.all(
      ps.map(async (p) => [p.id, (await getPhases(p.id)) || []])
    )
    const map = {}
    for (const [pid, phases] of pairs) map[pid] = phases
    setPhasesByProject(map)

    // notify other app parts (Grid/Explorer) to refresh views
    window.dispatchEvent(new Event('plancraft:refresh'))
  }, [])

  // Persist last tab + sync #/admin?tab=...
  useEffect(() => {
    try { localStorage.setItem('mgmt.tab', tab) } catch {}
    const [path, qs] = (window.location.hash || '').split('?')
    if (path === '#/admin') {
      const sp = new URLSearchParams(qs || '')
      sp.set('tab', tab)
      const newHash = '#/admin?' + sp.toString()
      if (window.location.hash !== newHash) {
        window.history.replaceState(null, '', newHash)
      }
    }
  }, [tab])

  return (
    <div className="adminWrap">
      <div className="adminContainer">
        <header className="adminHeader">
          <div className="adminTitle">
            <h2 className="adminTitle">Administration</h2>
            <p className="adminSubtitle">Banks, projects, phases, tasks & users</p>
          </div>
          <div className="adminActions">
            <div className="adminTabs">
              <button
                className={`tabBtn ${tab==='banks'?'active':''}`}
                onMouseEnter={preload.banks} onFocus={preload.banks}
                onClick={()=>setTab('banks')}
              >Banks</button>
              <button
                className={`tabBtn ${tab==='projects'?'active':''}`}
                onMouseEnter={preload.projects} onFocus={preload.projects}
                onClick={()=>setTab('projects')}
              >Projects</button>
              {/* <button
                className={`tabBtn ${tab==='phases'?'active':''}`}
                onMouseEnter={preload.phases} onFocus={preload.phases}
                onClick={()=>setTab('phases')}
              >Phases</button> */}
              {/* NEW */}
              <button
                className={`tabBtn ${tab==='adminPhases'?'active':''}`}
                onMouseEnter={preload.adminPhases} onFocus={preload.adminPhases}
                onClick={()=>setTab('adminPhases')}
              >Phases (Advanced)</button>
              <button
                className={`tabBtn ${tab==='tasks'?'active':''}`}
                onMouseEnter={preload.tasks} onFocus={preload.tasks}
                onClick={()=>setTab('tasks')}
              >Tasks</button>
              <button
                className={`tabBtn ${tab==='users'?'active':''}`}
                onMouseEnter={preload.users} onFocus={preload.users}
                onClick={()=>setTab('users')}
              >Users</button>
            </div>
            <button className="btn" onClick={refreshAll}>Refresh all</button>
          </div>
        </header>

        {tab==='banks' && (
          <Suspense fallback={<LoadingCard label="Loading Banks…" />}>
            <BanksSection onChange={refreshAll} />
          </Suspense>
        )}

        {tab==='projects' && (
          <Suspense fallback={<LoadingCard label="Loading Projects…" />}>
            <ProjectsSection
              banks={banks}             // <— put this back
              onChange={refreshAll}
            />
          </Suspense>
        )}


        {/* {tab==='phases' && (
          <Suspense fallback={<LoadingCard label="Loading Phases…" />}>
            <PhasesSection onChange={refreshAll} />
          </Suspense>
        )} */}

        {/* NEW */}
        {tab==='adminPhases' && (
          <Suspense fallback={<LoadingCard label="Loading Phases…" />}>
            <AdminPhases />
          </Suspense>
        )}

        {tab==='tasks' && (
          <Suspense fallback={<LoadingCard label="Loading Tasks…" />}>
            <TasksSection onChange={refreshAll} />
          </Suspense>
        )}

        {tab==='users' && (
          <Suspense fallback={<LoadingCard label="Loading Users…" />}>
            <UsersSection onChange={refreshAll} />
          </Suspense>
        )}
      </div>
    </div>
  )
}
