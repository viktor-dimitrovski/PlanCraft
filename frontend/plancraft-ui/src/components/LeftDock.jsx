import React, { useState } from 'react'
import QuickAdd from './QuickAdd.jsx'
import PhaseExplorer from './PhaseExplorer.jsx'

export default function LeftDock({ afterChange }){
  const [tab, setTab] = useState('backlog') // 'backlog' | 'manage'

  return (
    <div>
      <div className="dockTabs">
        <button className={tab==='backlog' ? 'active' : ''} onClick={()=>setTab('backlog')}>Backlog</button>
        <button className={tab==='manage' ? 'active' : ''} onClick={()=>setTab('manage')}>Manage</button>
      </div>

      {tab === 'manage' && <QuickAdd afterChange={afterChange} />}
      {tab === 'backlog' && <PhaseExplorer />}
    </div>
  )
}
