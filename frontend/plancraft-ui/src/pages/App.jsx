import React, { useEffect, useState } from 'react'
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

// API: keep exact exported names from lib/api.js
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
import AssignmentPanel from '../components/AssignmentPanel.jsx'
import Legend from '../components/Legend.jsx'
import ResizableSidebar from '../components/ResizableSidebar.jsx'

export default function App () {
  const [range, setRange] = useState(() => {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to   = new Date(now.getFullYear(), now.getMonth() + 5, 1)
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

  // DragOverlay preview
  const [activeDrag, setActiveDrag] = useState(null)

  // -------- data
  useEffect(() => { fetchProjects().then(setProjects) }, [])

  const refreshGrid = () =>
    fetchGrid(range.from.toISOString(), range.to.toISOString(), scenarioId)
      .then(setData)

  const refreshScenarios = () => getScenarios().then(setScenarios)

  useEffect(() => { refreshGrid() }, [range.from, range.to, scenarioId])
  useEffect(() => { refreshScenarios() }, [])

  useEffect(() => {
    const f = () => refreshGrid()
    window.addEventListener('plancraft:refresh', f)
    return () => window.removeEventListener('plancraft:refresh', f)
  }, [range.from, range.to, scenarioId])

  // -------- DnD
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragStart = (event) => {
    const { active } = event
    const data = active?.data?.current
    const id = String(active?.id || '')
    if (id.startsWith('phase:') && data?.phase) {
      const ph = data.phase
      setActiveDrag({ kind: 'phase', title: ph.title, days: ph.estimatedDays ?? 5 })
      return
    }
    if (id.startsWith('task:') && data?.task) {
      const t = data.task
      const span = t._spanFloat ?? (typeof t.estimatedDays === 'number' ? t.estimatedDays / 5 : 1)
      setActiveDrag({ kind: 'task', title: t.title, span, color: t.projectColor })
      return
    }
    setActiveDrag(null)
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
        // Normal refresh flow
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

  // UPDATED: accepts (taskId, phaseId), dispatches phaseUnscheduled to re-show in backlog
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
          <button onClick={() => setWhatIf(!whatIf)} className={whatIf ? 'primary' : ''}>
            {whatIf ? 'What-if ON' : 'What-if OFF'}
          </button>
          <button
            onClick={() =>
              autobalance(range.from.toISOString(), range.to.toISOString(), 0.85)
                .then(r => alert((r.proposals || [])
                  .map(p => `Task ${p.taskId}: ${p.reason}`).join('\n') || 'No proposals'))
            }
          >
            Auto-balance
          </button>
          <button onClick={createScenarioNow}>New scenario</button>
        </div>
      </div>

      {/* DnD wraps left + grid + right so backlog → grid drag works */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        autoScroll
      >
        <div className="container">
          <ResizableSidebar side="left" min={280} max={560} initial={320} storageKey="plancraft.leftWidth">
            <LeftDock
              projects={projects}
              hideEmpty={hideEmpty}
              onReload={refreshGrid}
              onPlanPhase={planPhase}
            />
          </ResizableSidebar>

          <div className="main">
            <Grid
              range={range}
              weeks={weeks}
              people={people}
              milestones={milestones}
              density={density}
              hideEmpty={hideEmpty}
              onCreateTask={async (personId, weekIndex, title) => {
                const w = weeks?.[weekIndex]; if (!w) return
                const projectId = projects[0]?.id
                try {
                  const tRes = await apiCreateTask({
                    projectId, title,
                    estimatedDays: 5,
                    startDate: w.start,
                    durationDays: 7,
                    status: 1,
                    requiredSkills: []
                  })
                  await apiCreateAssignment({ taskId: tRes.id, personId, sharePercent: 100, isPrimary: true })
                  refreshGrid()
                } catch (e) {
                  console.error('Quick add failed:', e)
                  alert('Could not quick-add task. Check API console.')
                }
              }}
              onTaskClick={onTaskClick}
              onUnschedule={onUnschedule}  // now expects (taskId, phaseId)
            />
          </div>

          <ResizableSidebar side="right" min={260} max={420} initial={300} storageKey="plancraft.rightWidth">
            <Legend items={projects || []} />
            <AssignmentPanel
              open={panelOpen}
              task={panelTask}
              onClose={() => setPanelOpen(false)}
              onUnschedule={async (taskId) => {
                // use the shared handler so PhaseExplorer is informed instantly
                await onUnschedule(taskId, panelTask?.phaseId)
                setPanelOpen(false)
              }}
            />
          </ResizableSidebar>
        </div>

        {/* Drag preview */}
        <DragOverlay dropAnimation={null} className="dnd-overlay">
          {activeDrag
            ? (activeDrag.kind === 'phase'
                ? (
                  <div style={{
                    padding: '6px 10px',
                    border: '1px solid var(--stroke)',
                    borderRadius: 12,
                    background: '#fff',
                    boxShadow: '0 6px 20px rgba(2,6,23,.18)',
                    fontSize: 13
                  }}>
                    {activeDrag.title} <span className="muted-2">({activeDrag.days}d)</span>
                  </div>
                )
                : (
                  <div style={{
                    border: `2px solid ${activeDrag.color || 'var(--brand)'}`,
                    background: '#fff',
                    borderRadius: 12,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 10px',
                    boxShadow: '0 6px 20px rgba(2,6,23,.18)'
                  }}>
                    <b style={{marginRight: 6}}>{activeDrag.title}</b>
                    <span className="muted-2">
                      {Number.isFinite(activeDrag.span) ? `${activeDrag.span.toFixed(1)}w` : ''}
                    </span>
                  </div>
                )
              )
            : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
