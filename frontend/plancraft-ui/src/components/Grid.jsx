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
function WeekCell({ personId, weekIndex, laneIndex = 0, droppable = false, firstOfMonth = false, utilPct = null, isToday = false, isPast = false, quarterStart = false, capLabel = null, biPart = 'even' }) {
  if (droppable) {
    const id = `cell:${personId}:${weekIndex}`
    const { setNodeRef, isOver } = useDroppable({ id, data: { personId, weekIndex } })
    return (
      <div
        ref={setNodeRef}
        className={'cell' + (isOver ? ' over' : '')}
        style={{ gridColumn: `${weekIndex + 2} / span 1`, gridRow: `${laneIndex + 1}` }}
        aria-label={`week-${weekIndex}`}
        data-first={firstOfMonth ? '1' : undefined}
        data-today={isToday ? '1' : undefined}
        data-past={isPast ? '1' : undefined}
        data-quarter={quarterStart ? '1' : undefined}
        data-bi={biPart}
      >
        {utilPct != null && laneIndex === 0 && (
          <div className="util" title={`~${Math.round(utilPct)}%`}><i style={{'--util-pct': `${Math.min(100, Math.max(0, utilPct))}%`}} /></div>
        )}
        {capLabel && laneIndex === 0 && (
          <div className="capLabel" title="hours used / capacity">{capLabel}</div>
        )}
        {utilPct != null && utilPct > 100 && laneIndex === 0 && (
          <div className="overBadge" title="Over capacity" />
        )}
      </div>
    )
  }
  return (
    <div
      className="cell decor" data-first={firstOfMonth ? '1' : undefined}
      data-today={isToday ? '1' : undefined}
      data-past={isPast ? '1' : undefined}
      data-quarter={quarterStart ? '1' : undefined}
        data-bi={biPart}
      style={{ gridColumn: `${weekIndex + 2} / span 1`, gridRow: `${laneIndex + 1}` }}
      aria-hidden="true"
    />
  )
}

function TaskCard({ t, onUnschedule }) {
  return (
    <div className="taskCardInner">
      <b className="title">{t.title}</b>
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

  // derive progress percent from optional fields
  const progress = (typeof t.progressPct === 'number' ? t.progressPct :
                    typeof t.progress === 'number' ? t.progress :
                    (typeof t.doneWeeks === 'number' && typeof t._spanFloat === 'number' && t._spanFloat>0 ? (t.doneWeeks / t._spanFloat) * 100 : null))

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
        {progress != null && (
          <div className="progress" title={`Progress ${Math.round(Math.max(0, Math.min(100, progress)))}%`}>
            <i style={{'--pct': `${Math.max(0, Math.min(100, progress))}%`}} />
          </div>
        )}
      </div>
    </div>
  )
}

/* Group visible weeks by month for a spanning header row */
function groupMonths(weeks) {
  const out = [];
  let current = null;

  weeks.forEach((w, i) => {
    const d = new Date(w.start);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = d.toLocaleString(undefined, { month: 'long' });
    if (!current || current.key !== key) {
      if (current) out.push(current);
      current = { key, label, startIndex: i, span: 1 };
    } else {
      current.span += 1;
    }
  });
  if (current) out.push(current);
  return out;
}

export default function Grid({ weeks = [], people = [], milestones = [], onUnschedule, /** NEW: fixed pixel width for each week column (enables horizontal scroll) */ colWidth = 120, density = 'compact', hideEmpty = false, visibleWeekStart = 0, visibleWeekEnd = (weeks?.length||0), zoomMode = 'week' }) {
  const gridCols = `200px repeat(${weeks.length}, var(--weekW))`
  const gridMinWidth = 200 + weeks.length * colWidth // px

  // --- NEW: enrich weeks with month-start flag for vertical guides
  const weeksInfo = React.useMemo(() => {
    let prevMonth = -1
    const today = new Date(); const weekOf = (d)=>{ const dt=new Date(d); dt.setHours(0,0,0,0); return dt; };
    return weeks.map((w) => {
      const d = new Date(w.start)
      const m = d.getMonth()
      const firstOfMonth = m !== prevMonth
      prevMonth = m
      const ts = weekOf(w.start).getTime()
      const todayTs = weekOf(today).getTime()
      const endTs = weekOf(w.end || w.start).getTime()
      const isToday = ts <= todayTs && todayTs <= endTs
      const isPast = endTs < todayTs
      const weekIdx = w.index ?? 0
      const isQuarterStart = (weekIdx % 13) === 0
      return { ...w, _firstOfMonth: firstOfMonth, _isToday: isToday, _isPast: isPast, _qStart: isQuarterStart }
    })
  }, [weeks])

  // Compute weekly utilization (%) per person based on tasks and capacity
  function computeUtilForPerson(p, weekCount){
    const cap = Number(p.capacityHoursPerWeek || 40)
    const util = Array.from({length: weekCount}, ()=>0)
    const tasks = Array.isArray(p.tasks) ? p.tasks : []
    for(const t of tasks){
      const spanFloat = (typeof t.durationDays === 'number' ? t.durationDays/5 :
                         typeof t.estimatedDays === 'number' ? t.estimatedDays/5 :
                         typeof t.weekSpan === 'number' ? t.weekSpan : 1)
      const span = Math.max(1, Math.ceil(spanFloat))
      const start = Math.max(0, Number(t.weekIndex||0))
      const hours = (Number(t.estimatedDays ?? t.durationDays ?? (span*5)) * 8) / span
      for(let k=0;k<span;k++){
        const w = start + k
        if (w >= 0 && w < weekCount){
          util[w] += hours
        }
      }
    }
    // Convert to percentage of capacity
    return util.map(h => Math.min(200, cap>0 ? (h/cap)*100 : 0))
  }

  // Compute weekly load hours and capacity hours per person
  function computeLoadAndCapForPerson(p, weekCount){
    const capVal = Number(p.capacityHoursPerWeek || 40);
    const load = Array.from({length: weekCount}, () => 0);
    const cap = Array.from({length: weekCount}, () => capVal);
    const tasks = Array.isArray(p.tasks) ? p.tasks : [];
    for (const t of tasks){
      const spanFloat = (typeof t.durationDays === 'number' ? t.durationDays/5 :
                         typeof t.estimatedDays === 'number' ? t.estimatedDays/5 :
                         typeof t.weekSpan === 'number' ? t.weekSpan : 1);
      const span = Math.max(1, Math.ceil(spanFloat));
      const start = Math.max(0, Number(t.weekIndex || 0));
      const hoursTotal = Number(t.estimatedDays ?? t.durationDays ?? (span * 5)) * 8;
      const perWeek = hoursTotal / span;
      for (let k=0;k<span;k++){
        const w = start + k;
        if (w >= 0 && w < weekCount){
          load[w] += perWeek;
        }
      }
    }
    return { load, cap };
  }

  
  // Visible week window (column virtualization)
  const wStart = Math.max(0, visibleWeekStart);
  const wEnd = Math.min(weeksInfo.length, visibleWeekEnd);
  const weeksRender = weeksInfo.slice(wStart, wEnd);
// --- NEW: month groups for the spanning header band
  const months = React.useMemo(() => groupMonths(weeks), [weeks])

  const renderPersonRow = (p) => {
    const { placed, laneCount } = packLanes(p.tasks || [])
    const lanes = Math.max(1, laneCount)
    const util = computeUtilForPerson(p, weeksInfo.length)
    const { load, cap } = computeLoadAndCapForPerson(p, weeksInfo.length)
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
          weeksRender.map((w) => (
            <WeekCell
              key={`c-${p.id}-${w.index}-${lane}`}
              personId={p.id}
              weekIndex={w.index}
              laneIndex={lane}
              droppable={lane === 0}
              firstOfMonth={w._firstOfMonth}
              isToday={w._isToday}
              isPast={w._isPast}
              quarterStart={w._qStart}
              utilPct={lane === 0 ? util[w.index] : null}
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
    <div className="gridRoot" data-density={density} data-zoom={zoomMode} style={{ minWidth: '100%', '--col-count': weeks.length }}>
      {/* --- NEW: two-row timeline with month band and bold dates --- */}
      <div className="timeline" style={{ gridTemplateColumns: gridCols, gridTemplateRows: '28px 24px' }}>
        {/* Row 1: Month band (spanning) */}
        <div style={{ gridRow: '1' }} />
        {months.map(m => (
          <div
            key={m.key}
            className="monthBand"
            style={{ gridRow: '1', gridColumn: `${m.startIndex + 2} / span ${m.span}` }}
          >
            <span className="monthLabel">{m.label}</span>
          </div>
        ))}

        {/* Row 2: Week dates (bold) */}
        <div style={{ gridRow: '2' }} />
        {weeksInfo.map(w => (
          <div
            key={`w-${w.index}`}
            className={'weekHead' + (w._firstOfMonth ? ' isMonthStart' : '') + (w._isToday ? ' isToday' : '') + (w._isPast ? ' isPast' : '')}
            style={{ gridRow: '2' }}
          >
            <b>{new Date(w.start).toLocaleDateString(undefined, { month: 'numeric', day: '2-digit' })}</b>
          </div>
        ))}
      </div>

      <div className="rows">
        {people.map(renderPersonRow)}
      </div>
    </div>
  )
}
