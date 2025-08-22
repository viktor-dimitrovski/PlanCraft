// src/components/Grid.jsx
import React from 'react'
import { useDroppable, useDraggable } from '@dnd-kit/core'

/* -------------------- Helpers -------------------- */

function packLanes(tasks) {
  const sorted = [...tasks].sort((a, b) => a.weekIndex - b.weekIndex)
  const lanes = []
  const placed = []

  const spanFloat = (t) => {
    if (typeof t.durationDays === 'number') return t.durationDays / 5
    if (typeof t.estimatedDays === 'number') return t.estimatedDays / 5
    if (typeof t.weekSpan === 'number') return t.weekSpan
    return 1
  }

  for (const t of sorted) {
    const start = t.weekIndex
    const wf = spanFloat(t)
    const end = start + wf
    let laneIndex = 0

    while (true) {
      if (!lanes[laneIndex]) { lanes[laneIndex] = [] }
      const occupied = lanes[laneIndex]
      const intersects = occupied.some(([s, e]) => !(end <= s || start >= e))
      if (!intersects) { occupied.push([start, end]); break }
      laneIndex++
    }
    placed.push({ ...t, _lane: laneIndex, _spanFloat: wf })
  }
  const laneCount = Math.max(1, lanes.length)
  return { placed, laneCount }
}

/* One visual “cell” tile. If droppable=false it's purely decorative. */
function WeekCell({ personId, weekIndex, laneIndex = 0, droppable = false }) {
  if (droppable) {
    const id = `cell:${personId}:${weekIndex}`
    const { setNodeRef, isOver } = useDroppable({ id, data: { personId, weekIndex } })
    return (
      <div
        ref={setNodeRef}
        className={'cell' + (isOver ? ' over' : '')}
        style={{ gridColumn: `${weekIndex + 2} / span 1`, gridRow: `${laneIndex + 1}` }}
        aria-label={`week-${weekIndex}`}
      />
    )
  }
  return (
    <div
      className="cell decor"
      style={{ gridColumn: `${weekIndex + 2} / span 1`, gridRow: `${laneIndex + 1}` }}
      aria-hidden="true"
    />
  )
}

function TaskCard({ t, onUnschedule }) {
  return (
    <div className="taskCardInner">
      <b>{t.title}</b>
      <span style={{ marginLeft: 6, color: 'var(--muted)' }}>
        ({Number.isInteger(t._spanFloat) ? `${t._spanFloat | 0}w` : `${t._spanFloat.toFixed(1)}w`})
      </span>
      <button
        className="taskX"
        title="Unschedule"
        onClick={(e) => { e.stopPropagation(); onUnschedule?.(t.id, t.phaseId) }}
      >✕</button>
    </div>
  )
}

function TaskBar({ t, color, onUnschedule }) {
  const id = `task:${t.id}`
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { kind: 'task', id: t.id, title: t.title, color, weeksFloat: t._spanFloat, task: t }
  })

  const spanInt = Math.max(1, Math.ceil(t._spanFloat))

  // pick a color in this order: task.t.color -> prop `color` -> project color -> bank color
  const accent =
    t.color ??
    color ??
    window.PLANCRAFT_COLORS?.project?.[t.projectId] ??
    window.PLANCRAFT_COLORS?.bank?.[t.bankId];

  return (
    <div
      ref={setNodeRef}
      className={'taskWrap' + (isDragging ? ' dragging' : '')}
      style={{
        gridColumn: `${t.weekIndex + 2} / span ${spanInt}`,
        gridRow: `${t._lane + 1}`
      }}
      {...attributes}
      {...listeners}
    >
      <div
        className="taskCard"
        style={{
          '--taskColor': accent,                 // feeds enterprise.css
          borderColor: accent || 'var(--brand)', // inline fallback
          width: `calc(${(t._spanFloat / spanInt) * 100}%)`
        }}
      >
        <TaskCard t={t} onUnschedule={onUnschedule} />
      </div>
    </div>
  )
}

export default function Grid({
  weeks = [],
  people = [],
  milestones = [],
  onUnschedule,
  /** NEW: fixed pixel width for each week column (enables horizontal scroll) */
  colWidth = 120
}) {
  const gridCols = `200px repeat(${weeks.length}, ${colWidth}px)`
  const gridMinWidth = 200 + weeks.length * colWidth // px

  const renderPersonRow = (p) => {
    const { placed, laneCount } = packLanes(p.tasks || [])
    const lanes = Math.max(1, laneCount)

    return (
      <div
        key={p.id}
        className="personRow"
        style={{
          gridTemplateColumns: gridCols,
          gridTemplateRows: `repeat(${lanes}, var(--laneH))`
        }}
      >
        <div className="legendCell" style={{ gridRow: `1 / span ${lanes}` }}>
          <span className="legendDot" style={{ background: p.color || '#64748b' }} />
          <div>
            <div><b>{p.name}</b></div>
            <div className="meta">{p.capacityHoursPerWeek || 40} h/w</div>
          </div>
        </div>

        {/* Draw visual cells for every lane; make only lane 0 droppable */}
        {Array.from({ length: lanes }).map((_, lane) =>
          weeks.map((w) => (
            <WeekCell
              key={`c-${p.id}-${w.index}-${lane}`}
              personId={p.id}
              weekIndex={w.index}
              laneIndex={lane}
              droppable={lane === 0}
            />
          ))
        )}

        {placed.map((t) => (
          <TaskBar
            key={t.id}
            t={t}
            color={t.projectColor}
            onUnschedule={onUnschedule}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="gridRoot" style={{ minWidth: `${gridMinWidth}px` }}>
      <div className="timeline" style={{ gridTemplateColumns: gridCols }}>
        <div />
        {weeks.map(w => (
          <div key={`w-${w.index}`} className="weekHead">
            {new Date(w.start).toLocaleDateString(undefined, { month: 'numeric', day: '2-digit' })}
          </div>
        ))}
      </div>

      <div className="rows">
        {people.map(renderPersonRow)}
      </div>
    </div>
  )
}
