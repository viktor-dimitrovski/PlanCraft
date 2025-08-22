import React, { useMemo } from 'react'
import {
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'

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
    placed.push({ ...t, _lane: laneIndex, _spanFloat: spanFloat(t) })
  }
  const laneCount = Math.max(1, lanes.length)
  return { placed, laneCount }
}

function WeekCell({ personId, weekIndex }) {
  const id = `cell:${personId}:${weekIndex}`
  const { setNodeRef, isOver } = useDroppable({ id, data: { personId, weekIndex } })

  return (
    <div
      ref={setNodeRef}
      className={'cell' + (isOver ? ' over' : '')}
      style={{ gridColumn: `${weekIndex + 2} / span 1`, gridRow: `1 / -1` }}
      aria-label={`week-${weekIndex}`}
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
        onClick={(e) => { e.stopPropagation(); onUnschedule?.(t.id) }}   // ⬅️ added
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
          borderColor: color || 'var(--brand)',
          width: `calc(${(t._spanFloat / spanInt) * 100}%)`
        }}
      >
        <TaskCard t={t} onUnschedule={onUnschedule} />   {/* ⬅️ added */}
      </div>
    </div>
  )
}

export default function Grid({
  weeks = [],
  people = [],
  milestones = [],
  onUnschedule,           // ⬅️ added (optional)
}) {
  const columnCount = (weeks?.length || 0) + 1

  const renderPersonRow = (p) => {
    const { placed, laneCount } = packLanes(p.tasks || [])
    const lanes = Math.max(1, laneCount)

    return (
      <div
        key={p.id}
        className="personRow"
        style={{
          gridTemplateColumns: `200px repeat(${weeks.length}, 1fr)`,
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

        {weeks.map((w) => (
          <WeekCell key={`c-${p.id}-${w.index}`} personId={p.id} weekIndex={w.index} />
        ))}

        {placed.map((t) => (
          <TaskBar
            key={t.id}
            t={t}
            color={t.projectColor}
            onUnschedule={onUnschedule}     // ⬅️ added
          />
        ))}
      </div>
    )
  }

  return (
    <div className="gridRoot">
      <div className="timeline" style={{ gridTemplateColumns: `200px repeat(${weeks.length}, 1fr)` }}>
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
