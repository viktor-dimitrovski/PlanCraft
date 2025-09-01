/**
 * TaskLayer.jsx
 *
 * 1) Purpose (functional):
 *    Renders and manages all task assignments on the scheduling grid. It computes each assignment's
 *    position/size from the grid columns (time) and people (lanes), lets users drag assignments
 *    to reschedule (change start date) or reassign (change person), and provides a compact
 *    tooltip + keyboard affordances (Esc deselect, Del remove).
 *
 * 2) Developer overview:
 *    - Props: { cols, people, zoom, tasks, colWidth, onTaskUpdate }
 *      * cols: array of time columns (each with .start). people: lane order. zoom: day/week/2w.
 *      * tasks: [{ id, personId, start: Date, durationDays, title, color }]
 *      * onTaskUpdate({ id, personId, start, startDate, durationDays, title, color }) is called on drop.
 *    - Layout: computeLayout() converts tasks -> absolute left/top/width (px) using col width and lane height.
 *      It also flags assignments overlapping non-work days via dayStatus().
 *    - DnD: useDndMonitor listens to drag lifecycle; DraggableCard uses useDraggable per assignment.
 *      We tag drags with data.kind='task' and include the assignment data. This makes drop targets
 *      and higher-level handlers consistent with phase drags (which use kind='phase').
 *    - Styling: Cards expose CSS variable `--ng-accent` based on `assignment.color` so global CSS
 *      (e.g. .ng-assignment { border-left: 3px solid var(--ng-accent, #2563eb); }) can render a bank-colored accent.
 *      We also keep borderLeftColor inline as a safe fallback.
 *    - LocalEdits: stores temporary start/personId while dragging when onTaskUpdate is not supplied.
 *      HiddenIds: demo delete. Lane height is synced from CSS var --ng-laneH.
 *
 *    Extension points:
 *      - Change border rendering centrally via CSS using --ng-accent.
 *      - Add more drag metadata in useDraggable({ data: {...} }) if consumers need it.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDraggable, useDndMonitor } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { dayStatus } from '../work-calendar'
import { daysPerColumn, clamp, addDays } from '../dragMath'

const DAY = 24 * 60 * 60 * 1000
const toStartOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x }

/**
 * Compute left/top/width for every task assignment.
 */
function computeLayout({ cols, people, zoom, tasks, colW, laneH }){
  const dpc = daysPerColumn(zoom)
  const gridStart = cols?.[0]?.start ? new Date(cols[0].start) : null
  if(!gridStart || !Array.isArray(tasks) || !Array.isArray(people)) return []

  const personIndexById = new Map(people.map((p, i) => [String(p.id), i]))

  return tasks.map(t => {
    const idx = personIndexById.get(String(t.personId))
    const start = toStartOfDay(t.start)
    const diffDays = Math.floor((start - toStartOfDay(gridStart)) / DAY)
    const col = diffDays / dpc
    const workPerCol = (zoom === 'day') ? 1 : (zoom === 'week' ? 5 : 10)
    const span = (Number(t.durationDays || 1) / workPerCol)
    const top = (idx ?? 0) * laneH + (laneH / 2)
    const left = Math.max(0, Math.round(col * colW))
    const width = Math.max(1, Math.round(span * colW))

    let warn = false
    try { const st = dayStatus(String(t.personId), start); warn = Boolean(st?.nonWork) } catch {}

    return {
      id: String(t.id),
      title: t.title || 'Untitled',
      color: t.color || '#2563eb',
      personId: String(t.personId),
      start,
      durationDays: Number(t.durationDays || 1),
      left, top, width, warn,
      end: new Date(start.getTime() + (Number(t.durationDays || 1) - 1) * DAY),
    }
  })
}

export default function TaskLayer({ cols, people, zoom, tasks = [], colWidth, onTaskUpdate }){
  const rootRef = useRef(null)
  const [laneH, setLaneH] = useState(56)
  const [selectedId, setSelectedId] = useState(null)
  const [hiddenIds, setHiddenIds] = useState(() => new Set())
  const [localEdits, setLocalEdits] = useState(() => new Map()) // id -> {start, personId}

  // Tooltip state (anchored to assignment, not pointer)
  const [tip, setTip] = useState(null) // { id, x, y, title, dateRange, duration }
  const [dragId, setDragId] = useState(null)

  // Sync lane height from CSS var
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement)
    const lh = parseFloat(cs.getPropertyValue('--ng-laneH')) || 56
    setLaneH(lh)
  }, [cols, zoom])

  const colW = Number(colWidth ?? 120)
  const dpc = daysPerColumn(zoom)
  const gridStart = cols?.[0]?.start ? new Date(cols[0].start) : null

  // Merge tasks with local edits
  const effectiveTasks = useMemo(() => {
    if(localEdits.size === 0) return tasks
    return tasks.map(t => {
      const ov = localEdits.get(String(t.id))
      if(!ov) return t
      return { ...t, ...(ov.start ? { start: ov.start } : null), ...(ov.personId ? { personId: ov.personId } : null) }
    })
  }, [tasks, localEdits])

  // Derived layout (filtered by hiddenIds for demo delete)
  const layout = useMemo(() => {
    const visible = effectiveTasks.filter(t => !hiddenIds.has(String(t.id)))
    return computeLayout({ cols, people, zoom, tasks: visible, colW, laneH })
  }, [cols, people, zoom, effectiveTasks, colW, laneH, hiddenIds])

  // Keyboard: Esc = deselect; Delete/Backspace = "remove" (demo hide)
  useEffect(() => {
    function onKey(e){
      if(e.key === 'Escape'){
        setSelectedId(null); setTip(null)
      }else if((e.key === 'Delete' || e.key === 'Backspace') && selectedId){
        setHiddenIds(prev => { const next = new Set(prev); next.add(String(selectedId)); return next })
        setSelectedId(null); setTip(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  // If the hovered assignment disappears (e.g., after delete), remove tooltip
  useEffect(() => {
    if(tip && !layout.some(c => c.id === tip.id)){
      setTip(null)
    }
  }, [layout, tip])

  const formatDate = (d) => d?.toLocaleDateString?.() ?? ''

  // Show tooltip anchored to assignment (no mousemove updates)
  function showTipForCard(assignment){
    const x = assignment.left + (assignment.width / 2)
    const y = assignment.top - (laneH / 2) - 8
    setTip(prev => (prev?.id === assignment.id ? prev : {
      id: assignment.id,
      x, y,
      title: assignment.title,
      dateRange: `${formatDate(assignment.start)} – ${formatDate(assignment.end)}`,
      duration: `${assignment.durationDays} day${assignment.durationDays === 1 ? '' : 's'}`,
    }))
  }
  function hideTip(){ setTip(null) }

  function onLayerClick(e){
    if(e.currentTarget === e.target){
      setSelectedId(null); setTip(null)
    }
  }
  function onLayerLeave(){ setTip(null) }

  // Listen to top-level DnD for assignment drags
// Listen to top-level DnD for assignment drags (UI only)
useDndMonitor({
  onDragStart(event) {
    const id = String(event?.active?.id ?? '');
    const plainId = id.replace(/^assignment:/, '');
    if (layout.some(c => c.id === plainId)) {
      setDragId(id);
      setSelectedId(plainId);
      // if you have setTip, uncomment the next line:
      setTip(null);
    }
  },
  onDragCancel() {
    setDragId(null);
  },
  onDragEnd() {
    setDragId(null);
  },
});


  // Draggable assignment — composes base CSS transform with drag transform so it doesn't jump
  function DraggableAssignment({ assignment }){
    const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({ id: `assignment:${assignment.id}`, data: { kind: 'assignment', taskId: assignment.id, task: assignment } })
    const dragT = CSS.Translate.toString(transform) // translate3d(x,y,0)
    const style = {
      left: assignment.left,
      top: assignment.top,
      width: assignment.width,
      "--ng-accent": assignment.color || '#2563eb',
      borderLeftColor: assignment.color || '#2563eb',
      transform: transform
        ? `translateY(calc(-50% + var(--ng-assignment-yshift))) ${dragT}`
        : undefined,
      willChange: transform ? 'transform' : undefined,
    }
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={`ng-assignment${assignment.warn ? ' ng-assignment--warn' : ''}${selectedId === assignment.id ? ' ng-assignment--selected' : ''}${(isDragging || dragId === assignment.id) ? ' ng-assignment--dragging' : ''}`}
        style={style}
        onClick={(e) => { e.stopPropagation(); setSelectedId(assignment.id) }}
        onMouseEnter={() => showTipForCard(assignment)}
        onMouseLeave={hideTip}
        tabIndex={0}
        aria-selected={selectedId === assignment.id}
        aria-label={`${assignment.title} from ${formatDate(assignment.start)} to ${formatDate(assignment.end)}`}
      >
        <div className="ng-assignmentDragHandle" />
        <div className="ng-assignmentTitle">{assignment.title}</div>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className="ng-taskContent"
      onClick={onLayerClick}
      onMouseLeave={onLayerLeave}
    >
      {layout.map(assignment => (<DraggableAssignment key={assignment.id} assignment={assignment} />))}

      {tip && !dragId && (
        <div className="ng-tooltip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          <div className="ng-tooltip__title">{tip.title}</div>
          <div className="ng-tooltip__meta">{tip.dateRange}</div>
          <div className="ng-tooltip__meta">{tip.duration}</div>
          <div className="ng-tooltip__keys">Esc – deselect · Del – remove</div>
        </div>
      )}
    </div>
  )
}
