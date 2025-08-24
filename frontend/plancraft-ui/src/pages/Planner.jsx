import React, { useCallback, useEffect, useRef, useState } from 'react'
import '../styles/enterprise.css'

import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
  MeasuringStrategy,
  DragOverlay,
} from '@dnd-kit/core'

import { usePlan } from '../state/usePlanStore'
import usePlannerData from './hooks/usePlannerData'

import {
  fetchGrid,
  fetchProjects,
  moveTask,
  autobalance,
  getScenarios,
  createScenario,
  compareScenario,
  forecast,
  apiCreateTask,
  apiCreateAssignment,
  planPhase,
  unscheduleTask
} from '../lib/api'

import Grid from '../components/Grid.jsx'
import LeftDock from '../components/LeftDock.jsx'
import { exportGridPNG, exportGridPDF } from '../lib/exporter'
import ResizableSidebar from '../components/ResizableSidebar.jsx'
import Management from './admin/Management.jsx'

function getRouteFromHash () {
  return (window.location.hash === '#/admin') ? 'admin' : 'planner'
}

export default function App () {
  const [route, setRouteState] = useState(getRouteFromHash())
  const setRoute = useCallback((r) => {
    setRouteState(r)
    window.location.hash = r === 'admin' ? '#/admin' : '#/'
  }, [])

  useEffect(() => {
    const onHash = () => setRouteState(getRouteFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const [range, setRange] = useState(() => {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to   = new Date(now.getFullYear(), now.getMonth() + 5, 1)
    return { from, to }
  })

  const [hideEmpty, setHideEmpty] = useState(true)
  const [density, setDensity] = useState('compact')
  const [colWidth, setColWidth] = useState(120)
  const [zoomMode, setZoomMode] = useState('week')
  const gridRef = useRef(null)
  const [visWindow, setVisWindow] = useState({ wStart: 0, wEnd: 0 })

  const [projects, setProjects] = useState([])
  const [scenarios, setScenarios] = useState([])
  const [compare, setCompare] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [forecastOut, setForecastOut] = useState(null)

  const { weeks, people, milestones, setData, whatIf, setWhatIf, scenarioId, setScenario } = usePlan()
  const { refreshGrid, refreshScenarios } = usePlannerData({ range, scenarioId, setData, setProjects, setScenarios })

  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [panelTask, setPanelTask] = useState(null)


  useEffect(() => {
    const onKey = async (e) => {
      if (!selectedTaskId) return;
      const key = e.key;
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key)) return;
      e.preventDefault();
      // Find current task and person index
      const pIdx = (people || []).findIndex(p => (p.tasks||[]).some(t => t.id === selectedTaskId));
      if (pIdx < 0) return;
      const person = people[pIdx];
      const task = (person.tasks||[]).find(t => t.id === selectedTaskId);
      if (!task) return;
      let newWeek = task.weekIndex;
      let newPersonId = person.id;
      if (key === 'ArrowLeft') newWeek = Math.max(0, newWeek - (zoomMode==='biweekly'?2:1));
      if (key === 'ArrowRight') newWeek = newWeek + (zoomMode==='biweekly'?2:1);
      if (key === 'ArrowUp' && pIdx > 0) newPersonId = people[pIdx - 1].id;
      if (key === 'ArrowDown' && pIdx < people.length - 1) newPersonId = people[pIdx + 1].id;
      try{
        await moveTask(task.id, newPersonId, newWeek);
      }finally{
        refreshGrid();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedTaskId, people, refreshGrid]);

  // DnD sensors (pointer with small distance to avoid accidental drags)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // Compute visible week window (column virtualization)
  useEffect(() => {
    const el = gridRef.current;
    if (!el || !weeks || !weeks.length) return;
    const overscan = 3;
    const compute = () => {
      const viewW = el.clientWidth || 0;
      const total = weeks.length;
      const start = Math.max(0, Math.floor((el.scrollLeft || 0) / Math.max(1, colWidth)) - overscan);
      const end = Math.min(total, Math.ceil(((el.scrollLeft || 0) + viewW) / Math.max(1, colWidth)) + overscan);
      setVisWindow({ wStart: start, wEnd: end });
    };
    compute();
    el.addEventListener('scroll', compute);
    window.addEventListener('resize', compute);
    return () => {
      el.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
    };
  }, [gridRef, weeks, colWidth]);

  // DragOverlay preview
  const [activeDrag, setActiveDrag] = useState(null)

  // data fetch moved to usePlannerData

  // moved to usePlannerData: refreshGrid
  const onDragStart = (event) => {
    const { active } = event
    const data = active?.data?.current
    theId: {
      const id = String(active?.id || '')
      if (id.startsWith('phase:') && data?.phase) {
        const ph = data.phase
        setActiveDrag({ kind: 'phase', title: ph.title, days: ph.estimatedDays ?? 5 })
        break theId
      }
      if (id.startsWith('task:') && data?.task) {
        const t = data.task
        const span = t._spanFloat ?? (typeof t.estimatedDays === 'number' ? t.estimatedDays / 5 : 1)
        setActiveDrag({ kind: 'task', title: t.title, span, color: t.projectColor })
        break theId
      }
      setActiveDrag(null)
    }
  }

  const onDragEnd = async (event) => {
    setActiveDrag(null)

    const { active, over } = event
    if (!over) return

    const aid = String(active.id)
    const oid = String(over.id)

    // Phase from backlog → cell (schedule)
    if (aid.startsWith('phase:') && oid.startsWith('cell:')) {
      const parts = aid.split(':')
      const phaseId = parseInt(parts[1], 10)
      if (!Number.isFinite(phaseId)) return

      const [, personIdStr, weekIdxStr] = oid.split(':')
      const personId = parseInt(personIdStr, 10)
      const weekIndex = parseInt(weekIdxStr, 10)
      const w = weeks?.[weekIndex]
      if (!w) return

      try {
        await planPhase(phaseId, {
          personId,
          startDateUtc: w.start,
          requiredSkills: []
        })
        // Immediately inform backlog to hide this phase
        window.dispatchEvent(new CustomEvent('plancraft:phaseScheduled', { detail: { phaseId } }))
        // Refresh
        refreshGrid()
        window.dispatchEvent(new Event('plancraft:refresh'))
        window.dispatchEvent(new Event('plancraft:projectsChanged'))
      } catch (err) {
        console.error('planPhase failed:', err)
        alert('Could not schedule phase. See console for details.')
      }
      return
    }

    // Task move/copy within grid
    if (aid.startsWith('task:') && oid.startsWith('cell:')) {
      const [, personIdStr, weekIdxStr] = oid.split(':')
      const personId = parseInt(personIdStr, 10)
      const weekIndex = parseInt(weekIdxStr, 10)
      const w = weeks?.[weekIndex]
      if (!w) return

      const copy = !!(event?.activatorEvent?.altKey || event?.activatorEvent?.ctrlKey)
      const task = active?.data?.current?.task
      if (!task) return

      if (whatIf) {
        // optimistic local move
        setData({
          weeks,
          milestones,
          people: people
            .map(p => ({ ...p, tasks: (p.tasks || []).filter(t => t.id !== task.id) }))
            .map(p => p.id === personId
              ? { ...p, tasks: [...(p.tasks || []), { ...task, startDate: w.start }] }
              : p
            )
        })
      } else {
        try {
          await moveTask({
            taskId: task.id,
            newStartDate: w.start,
            newPrimaryPersonId: personId,
            newDurationDays: undefined,
            copy
          })
          refreshGrid()
        } catch (err) {
          console.error('moveTask failed:', err)
          alert('Could not move task. See console for details.')
        }
      }
    }
  }

  const onTaskClick = (task) => { setPanelTask(task); setPanelOpen(true) }

  // accepts (taskId, phaseId), dispatches phaseUnscheduled to re-show in backlog
  const onUnschedule = async (taskId, phaseId) => {
    try {
      await unscheduleTask(taskId)
      if (Number.isFinite(phaseId)) {
        window.dispatchEvent(new CustomEvent('plancraft:phaseUnscheduled', { detail: { phaseId } }))
      }
    } catch (e) {
      console.error('unscheduleTask failed:', e)
      alert('Could not unschedule task. See console for details.')
    } finally {
      refreshGrid()
    }
  }

  const createScenarioNow = async () => {
    const name = prompt('Scenario name') || 'Scenario'
    const s = await createScenario(name)
    setScenario(s.id)
    refreshScenarios()
  }
  const doCompare  = async () => { if (scenarioId) setCompare(await compareScenario(scenarioId)) }
  const doForecast = async () => { if (selectedProject) setForecastOut(await forecast(selectedProject)) }

  const colCount = weeks?.length || 0
  const fromStr  = weeks?.[0]?.start?.slice?.(0,10) ?? ''
  const toStr    = weeks?.[colCount - 1]?.end?.slice?.(0,10) ?? ''

  const onFrom = (e) => { const v = e.target.value; if (!v) return; setRange(r => ({ ...r, from: new Date(v) })) }
  const onTo   = (e) => { const v = e.target.value; if (!v) return; setRange(r => ({ ...r, to:   new Date(v) })) }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">PlanCraft</div>
        <div className="toolbar">
          <div className="navTabs">
            <button
              className={route === "planner" ? "primary" : ""}
              onClick={() => setRoute("planner")}
            >
              Planner
            </button>
            <button
              className={route === "admin" ? "primary" : ""}
              onClick={() => setRoute("admin")}
            >
              Admin
            </button>
          </div>
          {route === "planner" && (
            <>
              <button
                onClick={() => setWhatIf(!whatIf)}
                className={whatIf ? "primary" : ""}
              >
                {whatIf ? "What-if ON" : "What-if OFF"}
              </button>
              <button
                onClick={() =>
                  autobalance(
                    range.from.toISOString(),
                    range.to.toISOString(),
                    0.85
                  ).then((r) =>
                    alert(
                      (r.proposals || [])
                        .map((p) => `Task ${p.taskId}: ${p.reason}`)
                        .join("\n") || "No proposals"
                    )
                  )
                }
              >
                Auto-balance
              </button>
              <button onClick={createScenarioNow}>New scenario</button>
            </>
          )}
        </div>
      </div>

      {route === "admin" ? (
        <div className="container" style={{ gridTemplateColumns: "1fr" }}>
          <div className="main">
            <Management />
          </div>
        </div>
      ) : (
        // --- Planner Route ---
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          autoScroll
        >
          <div className="container" style={{"--rightWidth":"0px"}}>
            <ResizableSidebar
              side="left"
              min={280}
              max={560}
              initial={320}
              storageKey="plancraft.leftWidth"
            >
              <LeftDock
                projects={projects}
                hideEmpty={hideEmpty}
                onReload={refreshGrid}
                onPlanPhase={planPhase}
              />
            </ResizableSidebar>

            <div className="main">
              {/* From/To left aligned above the grid */}
              <div className="gridToolbar">
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>From</span>
                  <input type="date" value={fromStr} onChange={onFrom} />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>To</span>
                  <input type="date" value={toStr} onChange={onTo} />
                </label>

                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <button onClick={() => gridRef.current && exportGridPNG(gridRef.current, 'plancraft-grid.png')}>Export PNG</button>
                  <button onClick={() => gridRef.current && exportGridPDF(gridRef.current, 'plancraft-grid.pdf')}>Export PDF</button>
                  <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span>Zoom</span>
                    <input type="range" min="90" max="160" step="10"
                      value={colWidth} onChange={(e)=>{
                        const v = Number(e.target.value);
                        setColWidth(v);
                        setDensity(v >= 140 ? 'expanded' : 'compact');
                      }} />
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:6 }} title="Jump to date">
                    <span>Go to</span>
                    <input type="date" onChange={(e)=>{
                      const d = new Date(e.target.value);
                      if (isNaN(d)) return;
                      const from = new Date(d.getFullYear(), d.getMonth(), 1);
                      const to = new Date(d.getFullYear(), d.getMonth() + 5, 1);
                      setRange({ from, to });
                    }} />
                  
                <div role="group" aria-label="Zoom scale" style={{ display:'inline-flex', gap:6, border:'1px solid var(--stroke)', borderRadius:8, padding:2 }}>
                  <button
                    onClick={() => setZoomMode('week')}
                    aria-pressed={zoomMode==='week'}
                    style={{ padding:'4px 8px', borderRadius:6, background: zoomMode==='week' ? 'var(--brand-50)' : 'transparent' }}
                  >Week</button>
                  <button
                    onClick={() => { setZoomMode('biweekly'); if (colWidth < 120) setColWidth(120); }}
                    aria-pressed={zoomMode==='biweekly'}
                    style={{ padding:'4px 8px', borderRadius:6, background: zoomMode==='biweekly' ? 'var(--brand-50)' : 'transparent' }}
                  >Bi-week</button>
                </div>

</label>
                </div>


                <button onClick={() => {
                  const now = new Date();
                  const from = new Date(now.getFullYear(), now.getMonth(), 1);
                  const to = new Date(now.getFullYear(), now.getMonth() + 5, 1);
                  setRange({ from, to });
                }}>Today</button>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>Density</span>
                  <select value={density} onChange={(e) => setDensity(e.target.value)}>
                    <option value="compact">Compact</option>
                    <option value="expanded">Expanded</option>
                  </select>
                </label>
              </div>

              {/* Horizontal scroll shell */}
              <div className="gridShell" ref={gridRef} data-dragging={activeDrag ? "1" : undefined}>
                <Grid
                  visibleWeekStart={visWindow.wStart}
                  visibleWeekEnd={visWindow.wEnd}
                  weeks={weeks}
                  people={people}
                  milestones={milestones}
                  density={density}
                  hideEmpty={hideEmpty}
                  colWidth={colWidth}
                  squareCells={true}
                  onTaskClick={(t) => { setPanelTask(t); setPanelOpen(true); setSelectedTaskId(t?.id) }}
                  onUnschedule={onUnschedule}
                  onCreateTask={async (personId, weekIndex, title) => {
                    const w = weeks?.[weekIndex]
                    if (!w) return
                    const projectId = projects[0]?.id
                    try {
                      const tRes = await apiCreateTask({
                        projectId,
                        title,
                        estimatedDays: 5,
                        startDate: w.start,
                        durationDays: 7,
                        status: 1,
                        requiredSkills: [],
                      })
                      await apiCreateAssignment({
                        taskId: tRes.id,
                        personId,
                        sharePercent: 100,
                        isPrimary: true,
                      })
                      refreshGrid()
                    } catch (e) {
                      console.error("Quick add failed:", e)
                      alert("Could not quick-add task. Check API console.")
                    }
                  }}
                />
              </div>
            </div>

            
          </div>

          {/* Drag preview */}
          <DragOverlay dropAnimation={null} className="dnd-overlay">
            {activeDrag ? (
              activeDrag.kind === "phase" ? (
                <div
                  style={{
                    padding: "6px 10px",
                    border: "1px solid var(--stroke)",
                    borderRadius: 12,
                    background: "#fff",
                    boxShadow: "0 6px 20px rgba(2,6,23,.18)",
                    fontSize: 13,
                  }}
                >
                  {activeDrag.title}{" "}
                  <span className="muted-2">({activeDrag.days}d)</span>
                </div>
              ) : (
                <div
                  style={{
                    border: `2px solid ${activeDrag.color || "var(--brand)"}`,
                    background: "#fff",
                    borderRadius: 12,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 10px",
                    boxShadow: "0 6px 20px rgba(2,6,23,.18)",
                  }}
                >
                  <b style={{ marginRight: 6 }}>{activeDrag.title}</b>
                  <span className="muted-2">
                    {Number.isFinite(activeDrag.span)
                      ? `${activeDrag.span.toFixed(1)}w`
                      : ""}
                  </span>
                </div>
              )
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
