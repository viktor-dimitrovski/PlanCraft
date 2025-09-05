// src/pages/App.jsx
import '../styles/enterprise.css'
import '../styles/shell.css'
import React, { useEffect, useMemo, useState } from 'react'
import NewGridPage from './NewGrid/index.jsx'
import Management from './admin/Management.jsx'
import Planner from './Planner.jsx'
import SideNav from '../components/SideNav.jsx'

// NEW
import AdminPhases from './admin/Phases.jsx'

export default function App() {
  const [hash, setHash] = useState(window.location.hash || '#/grid')
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/grid')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (!window.location.hash) window.location.hash = '#/grid'
  }, [])

  useEffect(() => {
    document.body.classList.toggle('nav-open', navOpen)
    const onEsc = (e) => { if (e.key === 'Escape') setNavOpen(false) }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [navOpen])

  const route = useMemo(() => (hash || '#/grid').replace(/^#/, ''), [hash])

  let Page = NewGridPage
  if (route.startsWith('/admin/phases')) Page = AdminPhases      // NEW
  else if (route.startsWith('/admin')) Page = Management
  else if (route.startsWith('/planner')) Page = Planner

  return (
    <div className="shell">
      <SideNav active={route} open={navOpen} onClose={() => setNavOpen(false)} />
      <button className="nav-launcher nav-launcher-top nav-magenta" onClick={() => setNavOpen(true)} aria-label="Open menu" title="Open menu">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg><span style={{marginLeft: 6, fontWeight: 700}}>Menu</span>
      </button>
      <main className="shell-main">
        <Page />
      </main>
    </div>
  )
}
