
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { dayStatus } from '../work-calendar'
import { daysPerColumn, clamp, addDays, getScrollParent, applyAutoScroll } from '../dragMath'

const DAY = 24 * 60 * 60 * 1000
const toStartOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x }

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
    const snappedSpan = Math.max(1, Math.round((t.durationDays || 1) / dpc))

    const top = (idx ?? 0) * laneH + (laneH / 2)
    const left = Math.max(0, Math.round(col * colW))
    const width = Math.max(1, Math.round(snappedSpan * colW))

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

  // Tooltip state (anchored to card, not pointer)
  const [tip, setTip] = useState(null) // { id, x, y, title, dateRange, duration }

  // DnD
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 50, tolerance: 4 } }),
  )
  const [dragId, setDragId] = useState(null)
  const pointerRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const cs = getComputedStyle(document.documentElement)
    const lh = parseFloat(cs.getPropertyValue('--ng-laneH')) || 56
    setLaneH(lh)
  }, [cols, zoom])

  const colW = Number(colWidth ?? 120)
  const dpc = daysPerColumn(zoom)
  const gridStart = cols?.[0]?.start ? new Date(cols[0].start) : null

  const effectiveTasks = useMemo(() => {
    if(localEdits.size === 0) return tasks
    return tasks.map(t => {
      const ov = localEdits.get(String(t.id))
      if(!ov) return t
      return { ...t, ...(ov.start ? { start: ov.start } : null), ...(ov.personId ? { personId: ov.personId } : null) }
    })
  }, [tasks, localEdits])

  const layout = useMemo(() => {
    const visible = effectiveTasks.filter(t => !hiddenIds.has(String(t.id)))
    return computeLayout({ cols, people, zoom, tasks: visible, colW, laneH })
  }, [cols, people, zoom, effectiveTasks, colW, laneH, hiddenIds])

  // Keyboard
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

  useEffect(() => {
    if(tip && !layout.some(c => c.id === tip.id)){
      setTip(null)
    }
  }, [layout, tip])

  const formatDate = (d) => d?.toLocaleDateString?.() ?? ''

  // Show tooltip anchored to card (no mousemove updates)
  function showTipForCard(card){
    // position the tooltip above the card, centered
    const x = card.left + (card.width / 2)
    const y = card.top - (laneH / 2) - 8
    setTip(prev => (prev?.id === card.id ? prev : {
      id: card.id,
      x, y,
      title: card.title,
      dateRange: `${formatDate(card.start)} – ${formatDate(card.end)}`,
      duration: `${card.durationDays} day${card.durationDays === 1 ? '' : 's'}`,
    }))
  }
  function hideTip(){ setTip(null) }

  function onLayerClick(e){
    if(e.currentTarget === e.target){
      setSelectedId(null); setTip(null)
    }
  }
  function onLayerLeave(){
    setTip(null)
  }

  // Auto-scroll while dragging
  useEffect(() => {
    function onMove(ev){
      pointerRef.current = { x: ev.clientX, y: ev.clientY }
      if(dragId){
        const container = getScrollParent(rootRef.current)
        applyAutoScroll(container, pointerRef.current, { edge: 48, maxSpeed: 32 })
      }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [dragId])

  // DnD handlers
  function onDragStart(evt){
    const id = String(evt?.active?.id ?? '')
    setDragId(id)
    setSelectedId(id)
    setTip(null) // hide tooltip on drag start
  }
  function onDragCancel(){ setDragId(null) }
  function onDragEnd(evt){
    const id = String(evt?.active?.id ?? '')
    const delta = evt?.delta || { x: 0, y: 0 }
    const card = layout.find(c => c.id === id)
    if(!card || !gridStart){ setDragId(null); return }

    const nextLeft = card.left + Math.round(delta.x)
    const nextTop  = card.top  + Math.round(delta.y)

    const colIndex = Math.max(0, Math.round(nextLeft / colW))
    const startDate = addDays(toStartOfDay(gridStart), colIndex * dpc)

    const approxIdx = Math.round((nextTop - (laneH / 2)) / laneH)
    const clampedIdx = clamp(approxIdx, 0, Math.max(people.length - 1, 0))
    const nextPerson = people?.[clampedIdx]
    const nextPersonId = nextPerson ? String(nextPerson.id) : card.personId

    if(typeof onTaskUpdate === 'function'){
      onTaskUpdate({
        id,
        personId: nextPersonId,
        start: startDate,
        startDate: startDate,
        durationDays: card.durationDays,
        title: card.title,
        color: card.color
      })
    }else{
      setLocalEdits(prev => {
        const next = new Map(prev)
        next.set(id, { start: startDate, personId: nextPersonId })
        return next
      })
    }

    setDragId(null)
  }

  // Draggable card (composes base CSS transform with drag transform to avoid jump)
  function DraggableCard({ card }){
    const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({ id: card.id })
    const dragT = CSS.Translate.toString(transform) // e.g., translate3d(x, y, 0)
    const composed = transform
      ? `translateY(calc(-50% + var(--ng-card-yshift))) ${dragT}`
      : undefined // let CSS apply its own base transform when idle

    const style = {
      left: card.left,
      top: card.top,
      width: card.width,
      borderLeftColor: card.color || '#2563eb',
      transform: composed,
      willChange: transform ? 'transform' : undefined,
    }
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={`ng-card${card.warn ? ' ng-card--warn' : ''}${selectedId === card.id ? ' ng-card--selected' : ''}${(isDragging || dragId === card.id) ? ' ng-card--dragging' : ''}`}
        style={style}
        onClick={(e) => { e.stopPropagation(); setSelectedId(card.id) }}
        onMouseEnter={() => showTipForCard(card)}
        onMouseLeave={hideTip}
        tabIndex={0}
        aria-selected={selectedId === card.id}
        aria-label={`${card.title} from ${formatDate(card.start)} to ${formatDate(card.end)}`}
      >
        <div className="ng-cardDragHandle" />
        <div className="ng-cardTitle">{card.title}</div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragCancel={onDragCancel}
      onDragEnd={onDragEnd}
    >
      <div
        ref={rootRef}
        className="ng-taskLayer"
        onClick={onLayerClick}
        onMouseLeave={onLayerLeave}
      >
        {layout.map(card => (<DraggableCard key={card.id} card={card} />))}

        {tip && !dragId && (
          <div className="ng-tooltip" style={{ left: tip.x, top: tip.y }} role="tooltip">
            <div className="ng-tooltip__title">{tip.title}</div>
            <div className="ng-tooltip__meta">{tip.dateRange}</div>
            <div className="ng-tooltip__meta">{tip.duration}</div>
            <div className="ng-tooltip__keys">Esc – deselect · Del – remove</div>
          </div>
        )}
      </div>
    </DndContext>
  )
}
