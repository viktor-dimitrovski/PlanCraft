import React, { useMemo } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";

/* ---------- small helpers (kept minimal & compatible) ---------- */
const parseISO = v => (v ? new Date(v) : null);

const inWeek = (iso, w) => {
  const d = parseISO(iso); if (!d) return false;
  const a = parseISO(w.start); if (!a) return false;
  const b = w.end ? parseISO(w.end) : new Date(a.getTime() + 7*24*3600*1000);
  return d >= a && d < b;
};

const getStartField = t =>
  t.startDate || t.start || t.startUtc ||
  t.StartDate || t.Start || t.StartUtc ||
  t?.schedule?.start || t?.Schedule?.Start;

function normalizeTasks(person){
  if (Array.isArray(person.tasks) && person.tasks.length) return person.tasks;

  // fallback shape: person.assignments[].task
  if (Array.isArray(person.assignments) && person.assignments.length){
    return person.assignments.map(a => {
      const task = a.task || a.Task || {};
      return {
        id: task.id ?? a.taskId ?? a.id,
        title: task.title ?? a.title ?? "Task",
        projectColor: task.projectColor ?? task.ProjectColor,
        startDate: getStartField(task) || getStartField(a),
        weekIndex: task.weekIndex ?? a.weekIndex,
        weekSpan: task.weekSpan ?? a.weekSpan ?? 1,
      };
    }).filter(x => x.id != null);
  }
  return [];
}

const overlaps = (start, end, colStart, colEnd) => (start < colEnd && end > colStart);

/** Count how many tasks overlap each column (week) */
function columnOverlaps(tasks, columnCount){
  const counts = Array(columnCount).fill(0);
  for (const t of tasks){
    const s = Math.max(0, t.weekIndex ?? 0);
    const e = Math.min(columnCount, s + Math.max(1, t.weekSpan ?? 1));
    for (let i = s; i < e; i++) counts[i]++;
  }
  return counts;
}

/** Split timeline into contiguous "busy segments" where at least one task exists. */
function buildSegments(colCounts){
  const segs = [];
  let i = 0;
  while (i < colCounts.length){
    if (colCounts[i] === 0){ i++; continue; }
    const start = i;
    let maxLane = colCounts[i];
    while (i < colCounts.length && colCounts[i] > 0){
      maxLane = Math.max(maxLane, colCounts[i]);
      i++;
    }
    const end = i; // exclusive
    segs.push({ start, end, laneCount: Math.max(1, maxLane) });
  }
  return segs;
}

/** Greedy pack within a segment (classic interval packing) */
function packSegment(tasks, seg){
  const rel = tasks
    .map(t => {
      const sAbs = Math.max(0, t.weekIndex ?? 0);
      const eAbs = sAbs + Math.max(1, t.weekSpan ?? 1);
      const s = Math.max(seg.start, sAbs);
      const e = Math.min(seg.end, eAbs);
      return { ...t, startIndex: s, endIndex: e, span: e - s };
    })
    .filter(x => x.span > 0)
    .sort((a,b)=> (a.startIndex - b.startIndex) || (b.span - a.span) || (a.id - b.id));

  const lanesEnd = []; // absolute column index where each lane ends
  const placed = [];
  for (const it of rel){
    // find first lane that is free for this start
    let lane = 0;
    while (lane < lanesEnd.length && lanesEnd[lane] > it.startIndex) lane++;
    if (lane === lanesEnd.length) lanesEnd.push(it.endIndex);
    else lanesEnd[lane] = it.endIndex;

    placed.push({ ...it, lane });
  }

  return { placed, laneCount: Math.max(1, lanesEnd.length) };
}

/* ------------------- small presentational atoms ------------------- */
function Cell({ id, util, children }){
  const { setNodeRef, isOver } = useDroppable({ id });
  // faint stripe based on utilization (if provided)
  let stripe = "rgba(59,130,246,.10)";
  if (typeof util === "number") {
    if (util < 0.25) stripe = "rgba(239,68,68,.18)";      // under
    else if (util > 0.95) stripe = "rgba(234,179,8,.16)"; // over
  }
  return (
    <div
      ref={setNodeRef}
      className={`cell ${isOver ? "over" : ""}`}
      style={{ backgroundImage: `linear-gradient(${stripe} 0, ${stripe} 6px, transparent 6px)` }}
    >
      {children}
    </div>
  );
}

function TaskBar({ task, gridStartCol, gridSpan, yLane, onTaskClick, onRemoveTask }){
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { task }
  });
  const color = task.projectColor || "#3b82f6";
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="taskBar"
      role="button"
      aria-roledescription="draggable"
      title={task.title}
      style={{
        gridColumn: `${gridStartCol} / span ${gridSpan}`,
        gridRow: "1",
        borderColor: color,
        opacity: isDragging ? 0.85 : 1,
        transform: `translateY(calc(var(--lanePad) + var(--laneH) * ${yLane}))`,
        willChange: isDragging ? "transform, opacity" : "transform"
      }}
      onDoubleClick={()=> onTaskClick?.(task)}
    >
      <span className="taskDot" style={{ background: color }} />
      <b className="taskTitle" title={task.title}>{task.title}</b>
      {gridSpan > 1 && <span className="taskSpan">({gridSpan}w)</span>}
      <button
        className="taskX"
        title="Unschedule (return to backlog)"
        onClick={(e)=>{ e.stopPropagation(); onRemoveTask?.(task); }}
        aria-label="Unschedule"
      >✕</button>
    </div>
  );
}

/* ----------------------------- GRID ------------------------------ */
export default function Grid({
  weeks,
  people,
  milestones = [],
  onTaskClick,
  onCreateTask,
  onRemoveTask,
  hideEmpty = true,
  density = "compact"
}){
  const columns = weeks.length;

  const weekLabels = useMemo(
    () => weeks.map(w => new Date(w.start).toLocaleDateString(undefined, { month:"numeric", day:"numeric" })),
    [weeks]
  );

  const densityVars = {
    compact: { "--laneH": "26px", "--lanePad": "6px" },
    cozy:    { "--laneH": "32px", "--lanePad": "8px" },
    roomy:   { "--laneH": "40px", "--lanePad": "10px" },
  }[density] || {};

  const visiblePeople = useMemo(() => {
    if (!hideEmpty) return people;
    return people.filter(p => normalizeTasks(p).some(t =>
      typeof t.weekIndex === "number"
        ? t.weekIndex >= 0 && t.weekIndex < columns
        : weeks.some(w => inWeek(getStartField(t), w))
    ));
  }, [people, weeks, columns, hideEmpty]);

  // milestone pins -> header positions (kept as-is, optional)
  const pins = useMemo(() => {
    return milestones.map(ms => {
      const d = parseISO(ms.date); if (!d) return null;
      const idx = weeks.findIndex(w => {
        const a = parseISO(w.start);
        const b = w.end ? parseISO(w.end) : new Date(a.getTime() + 7*24*3600*1000);
        return d >= a && d < b;
      });
      return (idx >= 0) ? { ...ms, weekIndex: idx } : null;
    }).filter(Boolean);
  }, [milestones, weeks]);

  return (
    <div className="plannerGrid" style={densityVars}>
      {/* header */}
      <div className="weekHeader" style={{ gridTemplateColumns: `200px repeat(${columns}, 1fr)` }}>
        <div />
        {pins.map((ms, i) => (
          <div key={`ms-${i}`} className="milestonePin" style={{ gridColumn: `${ms.weekIndex + 2} / span 1`, justifySelf:"center" }}>
            <span style={{ background: ms.color || "#22c55e" }} />
          </div>
        ))}
        {weekLabels.map((d, i) => <div key={i}>{d}</div>)}
      </div>

      {/* rows */}
      <div className="rows">
        {visiblePeople.map(person => {
          const raw = normalizeTasks(person).filter(t =>
            (typeof t.weekIndex === "number")
              ? t.weekIndex >= 0 && t.weekIndex < columns
              : weeks.some(w => inWeek(getStartField(t), w))
          );

          // 1) per-column overlaps
          const colCounts = columnOverlaps(raw, columns);

          // 2) split into contiguous busy segments
          const segments = buildSegments(colCounts);

          // 3) pack each segment independently & compute Y offsets by stacking segment bands
          const placedAll = [];
          let yBase = 0;
          for (const seg of segments){
            const segTasks = raw.filter(t => {
              const s = Math.max(0, t.weekIndex ?? 0);
              const e = Math.min(columns, s + Math.max(1, t.weekSpan ?? 1));
              return overlaps(s, e, seg.start, seg.end);
            });

            const { placed, laneCount } = packSegment(segTasks, seg);
            for (const it of placed){
              placedAll.push({
                id: it.id,
                title: it.title,
                color: it.projectColor,
                startCol: 2 + it.startIndex,
                span: it.span,
                yLane: yBase + it.lane
              });
            }
            yBase += laneCount; // next segment starts below previous one
          }

          const totalLaneCount = Math.max(1, yBase);
          const util = Array.isArray(person.weeklyUtilization) ? person.weeklyUtilization : [];

          return (
            <div
              key={person.id}
              className="personRow"
              style={{
                gridTemplateColumns: `200px repeat(${columns}, 1fr)`,
                "--laneCount": totalLaneCount,
                "--weekCount": columns
              }}
            >
              {/* left legend */}
              <div className="legendCell" role="rowheader" aria-label={`${person.name} ${person.capacityHoursPerWeek||40} hours`}>
                <span className="legendDot" style={{ background: person.color || "#94a3b8" }} />
                <div>
                  <div><b>{person.name}</b></div>
                  <div className="meta">{person.capacityHoursPerWeek || 40} h/w</div>
                </div>
              </div>

              {/* week cells with quick-add */}
              {weeks.map((w, wi) => (
                <Cell key={`c:${person.id}:${wi}`} id={`cell:${person.id}:${wi}`} util={util[wi]}>
                  <div className="quickAdd">
                    <button
                      type="button"
                      title="Quick add"
                      aria-label="Quick add"
                      onMouseDown={e=>e.stopPropagation()}
                      onPointerDown={e=>e.stopPropagation()}
                      onClick={(e)=>{ e.stopPropagation(); onCreateTask?.(person.id, wi, "New Task"); }}
                    >＋</button>
                  </div>
                </Cell>
              ))}

              {/* faint horizontal lane guides behind chips */}
              <div className="laneCanvas" />

              {/* tasks */}
              {placedAll.map(p => (
                <TaskBar
                  key={p.id}
                  task={p}
                  gridStartCol={p.startCol}
                  gridSpan={p.span}
                  yLane={p.yLane}
                  onTaskClick={onTaskClick}
                  onRemoveTask={onRemoveTask}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
