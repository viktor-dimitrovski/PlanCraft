import React, { useEffect, useState } from 'react'
import { usePlan } from '../state/usePlanStore'
import { fetchGrid, fetchProjects, moveTask, autobalance, getScenarios, createScenario, compareScenario, forecast, apiCreateTask, apiCreateAssignment } from '../lib/api'
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
  const [scenarios, setScenarios] = useState([])
  const { weeks, people, milestones, setData, whatIf, setWhatIf, scenarioId, setScenario } = usePlan()
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTask, setPanelTask] = useState(null)
  const [utilPanel, setUtilPanel] = useState({ over: [], under: [] })
  const [compare, setCompare] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [forecastOut, setForecastOut] = useState(null)

  useEffect(() => { fetchProjects().then(setProjects) }, [])
  const refreshGrid = () => fetchGrid(range.from.toISOString(), range.to.toISOString(), scenarioId).then(setData)
  const refreshScenarios = () => getScenarios().then(setScenarios)
  useEffect(() => { refreshGrid() }, [range.from, range.to, scenarioId])
  useEffect(() => { refreshScenarios() }, [])

  const onTaskMove = (task, newPersonId, weekIndex, newSpan, copy=false, resized=false) => {
    const w = weeks[weekIndex]
    if (!w) return
    if (whatIf) {
      setData({
        weeks, milestones,
        people: people.map(p => ({
          ...p,
          tasks: p.tasks.filter(t => t.id !== task.id)
        })).map(p => p.id === newPersonId 
          ? { ...p, tasks: [...p.tasks, { ...task, weekIndex, weekSpan: newSpan || task.weekSpan }] }
          : p
        )
      })
      return
    }
    moveTask({ taskId: task.id, newStartDate: new Date(w.start).toISOString(), newPrimaryPersonId: newPersonId, newDurationDays: newSpan? newSpan*7 : undefined, copy }).then(()=>{
      refreshGrid()
    })
  }

  const onTaskClick = (task) => { setPanelTask(task); setPanelOpen(true) }

  const createScenarioNow = async () => {
    const name = prompt('Scenario name') || 'Scenario'
    const s = await createScenario(name)
    setScenario(s.id)
    refreshScenarios()
  }

  const doCompare = async () => {
    if (!scenarioId) return
    const res = await compareScenario(scenarioId)
    setCompare(res)
  }

  const doForecast = async () => {
    if (!selectedProject) return
    const f = await forecast(selectedProject)
    setForecastOut(f)
  }

  const onCreateTask = async (personId, weekIndex, title) => {
    const w = weeks[weekIndex]; if(!w) return
    const projectId = projects[0]?.id
    const tRes = await apiCreateTask({ projectId, title, estimatedDays:5, startDate: new Date(w.start).toISOString(), durationDays:7, status:1, requiredSkills: [] })
    await apiCreateAssignment({ taskId: tRes.id, personId, sharePercent:100, isPrimary:true })
    refreshGrid()
  }

  useEffect(() => {
    if (!people || !weeks) return
    const over=[], under=[]
    people.forEach(p => {
      p.weeklyUtilization.forEach((u,idx) => {
        if (u > 1.1) over.push({ person:p.name, week: weeks[idx].start, util: Math.round(u*100) })
        if (u < 0.7) under.push({ person:p.name, week: weeks[idx].start, util: Math.round(u*100) })
      })
    })
    setUtilPanel({ over, under })
  }, [people, weeks])

  const colCount = weeks?.length || 0

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">PlanCraft</div>
        <div className="toolbar">
          <button onClick={() => setWhatIf(!whatIf)} className={whatIf? 'primary': ''}>{whatIf? 'What-if ON' : 'What-if OFF'}</button>
          <button onClick={()=>autobalance(range.from.toISOString(), range.to.toISOString(), 0.85).then(r=> alert(r.proposals.map(p=>`Task ${p.taskId}: ${p.reason}`).join('\n') || 'None'))}>Auto-balance</button>
          <button onClick={createScenarioNow}>New Scenario</button>
          <select value={scenarioId || ''} onChange={e=> setScenario(e.target.value ? parseInt(e.target.value,10) : null)}>
            <option value="">Baseline</option>
            {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={doCompare} disabled={!scenarioId}>Compare</button>
          <select value={selectedProject || ''} onChange={e=> setSelectedProject(e.target.value? parseInt(e.target.value,10): null)}>
            <option value="">Forecast Project…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={doForecast} disabled={!selectedProject}>Forecast</button>
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
          <p style={{fontSize:12, color:'#64748b'}}>Tips: Drag to move; drag the right handle to resize. Hold Ctrl/Alt while dropping to copy.</p>
        </aside>
        <main className="gridwrap">
          {weeks?.length>0 && <Grid weeks={weeks} people={people} milestones={milestones} onTaskMove={onTaskMove} onTaskClick={onTaskClick} onCreateTask={onCreateTask} />}
          <AssignmentPanel open={panelOpen} task={panelTask} onClose={()=>setPanelOpen(false)} refresh={refreshGrid} />
        </main>
        <aside className="rightbar">
          <h3>Milestones</h3>
          <ul>
            {milestones.map((m,i)=>(<li key={i}><span className="legendDot" style={{background:m.color}}></span> {m.projectName}: <b>{m.name}</b> — {new Date(m.date).toLocaleDateString()}</li>))}
          </ul>
          <hr/>
          <h3>Utilization</h3>
          <div className="badge">Overloaded ({utilPanel.over.length})</div>
          <ul>{utilPanel.over.map((x,i)=>(<li key={'o'+i}>{x.person} — {new Date(x.week).toLocaleDateString()} — {x.util}%</li>))}</ul>
          <div className="badge">Underutilized ({utilPanel.under.length})</div>
          <ul>{utilPanel.under.map((x,i)=>(<li key={'u'+i}>{x.person} — {new Date(x.week).toLocaleDateString()} — {x.util}%</li>))}</ul>
          <hr/>
          <h3>Compare</h3>
          {compare.length===0? <p style={{color:'#64748b'}}>Select a scenario and click Compare.</p>:
            <ul>{compare.map((c,i)=>(<li key={i}>{projects.find(p=>p.id===c.projectId)?.name}: Slip {Math.round(c.slipDays)} days (base {new Date(c.baseFinish).toLocaleDateString()} → scen {new Date(c.scenarioFinish).toLocaleDateString()})</li>))}</ul>
          }
          <hr/>
          <h3>Forecast</h3>
          {!forecastOut? <p style={{color:'#64748b'}}>Choose a project and click Forecast.</p>:
            <p>P50 finish: <b>{new Date(forecastOut.p50).toLocaleDateString()}</b><br/>P90 finish: <b>{new Date(forecastOut.p90).toLocaleDateString()}</b></p>
          }
        </aside>
      </div>
    </div>
  )
}
