import React, { useEffect, useState } from 'react'
import '../styles/enterprise.css'

import { DndContext, useSensor, useSensors, PointerSensor, closestCenter } from '@dnd-kit/core'

import { usePlan } from '../state/usePlanStore'
import {
  fetchGrid, fetchProjects, moveTask, autobalance,
  getScenarios, createScenario, compareScenario, forecast,
  apiCreateTask, apiCreateAssignment, planPhase
} from '../lib/api'

import Grid from '../components/Grid.jsx'
import LeftDock from '../components/LeftDock.jsx'
import AssignmentPanel from '../components/AssignmentPanel.jsx'
import Legend from '../components/Legend.jsx'
import ResizableSidebar from '../components/ResizableSidebar.jsx'
import { unscheduleTask } from '../lib/api';

export default function App(){
  const [range, setRange] = useState(() => {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 5, 1)
    return { from, to }
  })
  const [hideEmpty, setHideEmpty] = useState(true)
  const [density, setDensity] = useState('compact')

  const [projects, setProjects] = useState([])
  const [scenarios, setScenarios] = useState([])
  const [compare, setCompare] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [forecastOut, setForecastOut] = useState(null)

  const { weeks, people, milestones, setData, whatIf, setWhatIf, scenarioId, setScenario } = usePlan()
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTask, setPanelTask] = useState(null)

  useEffect(() => { fetchProjects().then(setProjects) }, [])

  const refreshGrid = () =>
    fetchGrid(range.from.toISOString(), range.to.toISOString(), scenarioId).then(setData)
  const refreshScenarios = () => getScenarios().then(setScenarios)

  useEffect(() => { refreshGrid() }, [range.from, range.to, scenarioId])
  useEffect(() => { refreshScenarios() }, [])

  useEffect(() => {
    const f = () => refreshGrid()
    window.addEventListener('plancraft:refresh', f)
    return () => window.removeEventListener('plancraft:refresh', f)
  }, [range.from, range.to, scenarioId])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // DnD drop handler: tasks and phases
  const onDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const aid = String(active.id);
    const oid = String(over.id);

    if (aid.startsWith('phase:') && oid.startsWith('cell:')) {
      const parts = aid.split(':');
      const phaseId = parseInt(parts[1], 10);
      if (!Number.isFinite(phaseId)) return;

      const [, personIdStr, weekIdxStr] = oid.split(':');
      const personId = parseInt(personIdStr, 10);
      const weekIndex = parseInt(weekIdxStr, 10);
      const w = weeks?.[weekIndex];
      if (!w) return;

      try {
        await planPhase(phaseId, { personId, startDateUtc: w.start, requiredSkills: [] });
        // refresh everything that depends on tasks/phases
        refreshGrid();
        window.dispatchEvent(new Event('plancraft:refresh'));
        window.dispatchEvent(new Event('plancraft:projectsChanged'));
      } catch (err) {
        console.error('planPhase failed:', err);
        alert('Could not schedule phase. See console for details.');
      }
      return;
    }

    // Task moved/copied across cells
    if (aid.startsWith('task:') && oid.startsWith('cell:')) {
      const [, personIdStr, weekIdxStr] = oid.split(':');
      const personId = parseInt(personIdStr, 10);
      const weekIndex = parseInt(weekIdxStr, 10);
      const w = weeks?.[weekIndex];
      if (!w) return;

      const copy = !!(event?.activatorEvent?.altKey || event?.activatorEvent?.ctrlKey);
      const task = active?.data?.current?.task;
      if (!task) return;

      if (whatIf) {
        setData({
          weeks,
          milestones,
          people: people
            .map(p => ({ ...p, tasks: (p.tasks || []).filter(t => t.id !== task.id) }))
            .map(p => p.id === personId
              ? { ...p, tasks: [...(p.tasks || []), { ...task, startDate: w.start }] }
              : p
            )
        });
      } else {
        try {
          await moveTask({
            taskId: task.id,
            newStartDate: w.start,
            newPrimaryPersonId: personId,
            newDurationDays: undefined,
            copy
          });
          refreshGrid();
        } catch (err) {
          console.error('moveTask failed:', err);
          alert('Could not move task. See console for details.');
        }
      }
    }
  }

  const onTaskClick = (task) => { setPanelTask(task); setPanelOpen(true) }

  const createScenarioNow = async () => {
    const name = prompt('Scenario name') || 'Scenario'
    const s = await createScenario(name)
    setScenario(s.id)
    refreshScenarios()
  }
  const doCompare = async () => { if (scenarioId) setCompare(await compareScenario(scenarioId)) }
  const doForecast = async () => { if (selectedProject) setForecastOut(await forecast(selectedProject)) }

  const onCreateTask = async (personId, weekIndex, title) => {
    const w = weeks?.[weekIndex]; if (!w) return
    const projectId = projects[0]?.id
    try {
      const tRes = await apiCreateTask({
        projectId, title, estimatedDays: 5, startDate: w.start, durationDays: 7, status: 1, requiredSkills: []
      })
      await apiCreateAssignment({ taskId: tRes.id, personId, sharePercent: 100, isPrimary: true })
      refreshGrid()
    } catch (e) {
      console.error('Quick add failed:', e)
      alert('Could not quick-add task. Check API console.')
    }
  }

  // Range inputs with safe fallbacks
  const colCount = weeks?.length || 0
  const fromStr = weeks?.[0]?.start?.slice?.(0, 10) ?? ''
  const toStr   = weeks?.[colCount - 1]?.end?.slice?.(0, 10) ?? ''

  const onFrom = (e) => { const v = e.target.value; if (!v) return; setRange(r => ({ ...r, from: new Date(v) })) }
  const onTo   = (e) => { const v = e.target.value; if (!v) return; setRange(r => ({ ...r, to:   new Date(v) })) }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">PlanCraft</div>
        <div className="toolbar">
          <button onClick={() => setWhatIf(!whatIf)} className={whatIf ? 'primary' : ''}>
            {whatIf ? 'What-if ON' : 'What-if OFF'}
          </button>
          <button onClick={() =>
            autobalance(range.from.toISOString(), range.to.toISOString(), 0.85)
              .then(r => alert((r.proposals || []).map(p => `Task ${p.taskId}: ${p.reason}`).join('\n') || 'No proposals'))
          }>Auto-balance</button>

          <button onClick={createScenarioNow}>New Scenario</button>
          <select value={scenarioId || ''} onChange={e => setScenario(e.target.value ? parseInt(e.target.value, 10) : null)}>
            <option value="">Baseline</option>
            {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={doCompare} disabled={!scenarioId}>Compare</button>

          <select value={selectedProject || ''} onChange={e => setSelectedProject(e.target.value ? parseInt(e.target.value, 10) : null)}>
            <option value="">Forecast Project…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={doForecast} disabled={!selectedProject}>Forecast</button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="container" data-grid-container>
          <ResizableSidebar>
            <LeftDock afterChange={(what) => {
              if (what === 'person') refreshGrid()
              if (what === 'project' || what === 'bank') fetchProjects().then(setProjects)
            }} />
            {/* The resizer handle is inside ResizableSidebar */}
          </ResizableSidebar>

          <main className="gridwrap">
            {weeks?.length > 0 && (
              <Grid
                weeks={weeks}
                people={people}
                milestones={milestones}
                onTaskClick={onTaskClick}
                onCreateTask={onCreateTask}
                onRemoveTask={async (task) => {
                  if (!confirm(`Unschedule "${task.title}"?`)) return
                  try{
                    await unscheduleTask(task.id)
                    refreshGrid()
                    window.dispatchEvent(new Event('plancraft:refresh'))
                    window.dispatchEvent(new Event('plancraft:projectsChanged'))
                  }catch(e){
                    console.error(e); alert('Could not unschedule task.')
                  }
                }}
              />
            )}
            <AssignmentPanel open={panelOpen} task={panelTask} onClose={() => setPanelOpen(false)} refresh={refreshGrid} />
          </main>

          <aside className="rightbar">
            <h3>Compare</h3>
            {compare.length === 0
              ? <p style={{ color: '#64748b' }}>Select a scenario and click Compare.</p>
              : <ul>{compare.map((c, i) => (
                  <li key={i}>
                    {projects.find(p => p.id === c.projectId)?.name}: Slip {Math.round(c.slipDays)}d
                    {' '} (base {new Date(c.baseFinish).toLocaleDateString()} → scen {new Date(c.scenarioFinish).toLocaleDateString()})
                  </li>
                ))}</ul>
            }
            <hr />
            <h3>Range</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <input type="date" value={fromStr} onChange={onFrom} />
              <input type="date" value={toStr}   onChange={onTo} />
            </div>
            <hr />
            <h3>Forecast</h3>
            {!forecastOut
              ? <p style={{ color: '#64748b' }}>Choose a project and click Forecast.</p>
              : <p>P50 finish: <b>{new Date(forecastOut.p50).toLocaleDateString()}</b><br/>
                   P90 finish: <b>{new Date(forecastOut.p90).toLocaleDateString()}</b></p>}
          </aside>
        </div>
      </DndContext>
    </div>
  )
}
