import React, { useEffect, useState } from 'react'
import { usePlan } from '../state/usePlanStore'
import { fetchGrid, fetchProjects, moveTask, autobalance } from '../lib/api'
import Grid from '../components/Grid.jsx'
import Legend from '../components/Legend.jsx'
import AssignmentPanel from '../components/AssignmentPanel.jsx'

export default function App(){
  const [range, setRange] = useState(()=>{
    const now = new Date()
    const to = new Date(now.getFullYear(), now.getMonth()+4, 1)
    return { from: now, to }
  })
  const [projects, setProjects] = useState([])
  const { weeks, people, milestones, setData, whatIf, setWhatIf } = usePlan()
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTask, setPanelTask] = useState(null)

  useEffect(() => { fetchProjects().then(setProjects) }, [])

  const refreshGrid = () => fetchGrid(range.from.toISOString(), range.to.toISOString()).then(setData)

  useEffect(() => { refreshGrid() }, [range.from, range.to])

  const onTaskMove = (task, newPersonId, weekIndex) => {
    const w = weeks[weekIndex]
    if (!w) return
    if (whatIf) {
      setData({
        weeks,
        milestones,
        people: people.map(p => ({
          ...p,
          tasks: p.tasks.filter(t => t.id !== task.id)
        })).map(p => p.id === newPersonId 
          ? { ...p, tasks: [...p.tasks, { ...task, weekIndex }] }
          : p
        )
      })
      return
    }
    // send UTC
    moveTask(task.id, new Date(w.start).toISOString(), newPersonId).then(()=>{
      refreshGrid()
    })
  }

  const doAutoBalance = async () => {
    const res = await autobalance(range.from.toISOString(), range.to.toISOString(), 0.85)
    alert(`Proposals: \n` + (res.proposals?.map(p => `Task ${p.taskId}: ${p.reason}`).join('\n') || 'None'))
  }

  const onTaskClick = (task) => { setPanelTask(task); setPanelOpen(true) }

  const colCount = weeks?.length || 0

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">PlanCraft</div>
        <div className="toolbar">
          <button onClick={() => setWhatIf(!whatIf)} className={whatIf? 'primary': ''}>{whatIf? 'What-if ON' : 'What-if OFF'}</button>
          <button onClick={doAutoBalance}>Auto-balance (AI)</button>
        </div>
      </div>
      <div className="container">
        <aside className="sidebar">
          <h3>Legend</h3>
          <Legend projects={projects} />
          <hr />
          <h4>Range</h4>
          <div style={{display:'grid', gap:8}}>
            <input type="date" value={weeks?.[0]?.start?.slice?.(0,10)} onChange={e=> setRange(r => ({...r, from: new Date(e.target.value)}))} />
            <input type="date" value={weeks?.[colCount-1]?.end?.slice?.(0,10)} onChange={e=> setRange(r => ({...r, to: new Date(e.target.value)}))} />
          </div>
          <p style={{fontSize:12, color:'#64748b'}}>Drag tasks across people/weeks. Heat bar shows weekly utilization.</p>
        </aside>
        <main className="gridwrap">
          {weeks?.length>0 && <Grid weeks={weeks} people={people} milestones={milestones} onTaskMove={onTaskMove} onTaskClick={onTaskClick} />}
          <AssignmentPanel open={panelOpen} task={panelTask} onClose={()=>setPanelOpen(false)} refresh={refreshGrid} />
        </main>
      </div>
    </div>
  )
}
