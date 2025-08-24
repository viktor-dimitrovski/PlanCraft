// src/pages/admin/Management.jsx
import React, { useCallback, useEffect, useState, Suspense } from 'react'
import '../../styles/admin.css'
import { fetchBanks, fetchProjects, getPhases } from '../../lib/api'

// --- Lazy chunks (one file per section) ---
const BanksSection    = React.lazy(() => import('./sections/BanksSection'))
const ProjectsSection = React.lazy(() => import('./sections/ProjectsSection'))
const PhasesSection   = React.lazy(() => import('./sections/PhasesSection'))
const TasksSection    = React.lazy(() => import('./sections/TasksSection'))
const UsersSection    = React.lazy(() => import('./sections/UsersSection'))

// Optional: warm up chunks on hover/focus for snappier UX
const preload = {
  banks:    () => import('./sections/BanksSection'),
  projects: () => import('./sections/ProjectsSection'),
  phases:   () => import('./sections/PhasesSection'),
  tasks:    () => import('./sections/TasksSection'),
  users:    () => import('./sections/UsersSection'),
}

// Tiny fallback block used while a chunk loads
function LoadingCard({ label = 'Loading…' }) {
  return <div className="adminCard"><header className="adminCard__head"><h3 className="adminCard__title">{label}</h3></header></div>
}

export default function Management() {
  const [tab, setTab] = useState('banks') // banks | projects | phases | tasks | users

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

  useEffect(() => { refreshAll() }, [refreshAll])

  return (
    <div className="adminWrap">
      <div className="adminContainer">
        <header className="adminHeader">
          <div>
            <h2 className="adminTitle">Administration</h2>
            <p className="adminSubtitle">Banks, projects, phases, tasks & users — enterprise-ready CRUD.</p>
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
              <button
                className={`tabBtn ${tab==='phases'?'active':''}`}
                onMouseEnter={preload.phases} onFocus={preload.phases}
                onClick={()=>setTab('phases')}
              >Phases</button>
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
            <ProjectsSection banks={banks} onChange={refreshAll} />
          </Suspense>
        )}

        {tab==='phases' && (
          <Suspense fallback={<LoadingCard label="Loading Phases…" />}>
            <PhasesSection banks={banks} projects={projects} onChange={refreshAll} />
          </Suspense>
        )}

        {tab==='tasks' && (
          <Suspense fallback={<LoadingCard label="Loading Tasks…" />}>
            <TasksSection
              banks={banks}
              projects={projects}
              phasesByProject={phasesByProject}
              onChange={refreshAll}
            />
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
