import React, { useMemo, useRef, useState, useEffect } from "react";
import ResizableSidebar from "../../components/ResizableSidebar";
import PhaseSidebar from "./PhaseSidebar";
import { buildMonthSegments } from "./calendar";
import "./newgrid.css";
import TaskLayer from "./task-layer/TaskLayer";
import TodayMarker from "./task-layer/TodayMarker";
import NonWorkLayer from "./task-layer/NonWorkLayer";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  fetchPeople,
  createPhaseAssignment,
  updatePhaseAssignment,
  listPhaseAssignments,
} from "../../lib/api";

function LaneRow({ person }) {
  const { setNodeRef, isOver } = useDroppable({ id: `lane:${person.id}` });
  return (
    <div
      ref={setNodeRef}
      className={`ng-person ${isOver ? "ng-lane--over" : ""}`}
    >
      {person.name}
    </div>
  );
}

export default function NewGrid() {
  const [zoom, setZoom] = useState("week");
  const [startMonth, setStartMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [monthSpan, setMonthSpan] = useState(12);

  const { from, to } = useMemo(() => {
    const [yy, mm] = startMonth.split("-").map(Number);
    const from = new Date(yy, (mm || 1) - 1, 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(yy, (mm || 1) - 1 + monthSpan, 1);
    to.setHours(0, 0, 0, 0);
    return { from, to };
  }, [startMonth, monthSpan]);

  const colW = zoom === "day" ? 36 : zoom === "week" ? 96 : 128;
  const [laneH, setLaneH] = useState(56);
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const lh = parseFloat(cs.getPropertyValue("--ng-laneH")) || 56;
    setLaneH(lh);
  }, [zoom]);
  useEffect(() => {
    document.documentElement.style.setProperty("--ng-colW", colW + "px");
  }, [colW]);

  const [people, setPeople] = useState([]);
  useEffect(() => {
    fetchPeople()
      .then(setPeople)
      .catch(() => setPeople([]));
  }, []);

  const [phaseIndex, setPhaseIndex] = useState({});

  const [dropPreview, setDropPreview] = useState(null);
  const [splitPrompt, setSplitPrompt] = useState(null);
  const [splitDays, setSplitDays] = useState(0);

  const [tasks, setTasks] = useState([]);
  const [assignmentsCache, setAssignmentsCache] = useState(() => new Map());
  
// 1) state
const [phaseRemaining, setPhaseRemaining] = useState({});

// 2) топ-левел функција (без hooks внатре)
function recomputeRemaining(mapLike) {
  const res = {};
  // total по фаза (од phaseIndex)
  for (const [id, ph] of Object.entries(phaseIndex || {})) {
    const total = Number(ph.estimatedDays || ph.durationDays || ph.days || 0) || 0;
    res[Number(id)] = total;
  }
  // одземај ги доделените денови од assignmentsCache
  const m = mapLike && typeof mapLike.forEach === 'function' ? mapLike : assignmentsCache;
  if (m && typeof m.forEach === 'function') {
    m.forEach((list, pid) => {
      const used = (list || []).reduce((s, a) => s + Number(a.assignedDays || 0), 0);
      res[Number(pid)] = Math.max(0, (res[Number(pid)] ?? 0) - used);
    });
  }
  setPhaseRemaining(res);
}

// 3) ефект кој се тригерира кога ќе се смени assignmentsCache/phaseIndex
useEffect(() => {
  try { recomputeRemaining(); } catch {}
}, [assignmentsCache, phaseIndex]);


const inFlight = useRef(new Set());

  const { cols, months } = useMemo(
    () => buildMonthSegments(from, to, zoom),
    [from, to, zoom]
  );

  const pointerRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (ev) => {
      pointerRef.current = { x: ev.clientX, y: ev.clientY };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const daysPerColumn = (z) => (z === "day" ? 1 : z === "week" ? 7 : 14);

  async function refreshAssignments(visiblePhaseIds) {
    const toLoad = (visiblePhaseIds || [])
      .map(Number)
      .filter(
        (pid) => !inFlight.current.has(pid) && !assignmentsCache.has(pid)
      );

    if (!toLoad.length) {
      const all = [];
      assignmentsCache.forEach((list, pid) => {
        const phase = phaseIndex[String(pid)] || {};
        for (const a of list || []) {
          all.push({
            id: String(a.id),
            assignmentId: a.id,
            phaseId: a.phaseId,
            personId: a.personId,
            start: new Date(a.startDate),
            durationDays: Number(
              a.assignedDays || phase.estimatedDays || phase.durationDays || 1
            ),
            title: phase.title || phase.name || `Phase ${a.phaseId}`,
            color: phase.color || "#2563eb",
          });
        }
      });
      setTasks(all);
      return;
    }

    const queue = [...toLoad];
    const results = [];
    const CONC = 4;
    const workers = new Array(CONC).fill(0).map(async () => {
      while (queue.length) {
        const pid = queue.shift();
        inFlight.current.add(pid);
        try {
          const list = await listPhaseAssignments(Number(pid));
          results.push([pid, list || []]);
        } catch {
          results.push([pid, []]);
        } finally {
          inFlight.current.delete(pid);
        }
      }
    });
    await Promise.all(workers);

    setAssignmentsCache((prev) => {
      const next = new Map(prev);
      for (const [pid, list] of results) {
        next.set(Number(pid), list || []);
      }
      return next;
    });

    const all = [];
    for (const [pid, list] of results) {
      const phase = phaseIndex[String(pid)] || {};
      for (const a of list || []) {
        all.push({
          id: String(a.id),
          assignmentId: a.id,
          phaseId: a.phaseId,
          personId: a.personId,
          start: new Date(a.startDate),
          durationDays: Number(
            a.assignedDays || phase.estimatedDays || phase.durationDays || 1
          ),
          title: phase.title || phase.name || `Phase ${a.phaseId}`,
          color: phase.color || "#2563eb",
        });
      }
    }
    assignmentsCache.forEach((list, pid) => {
      if (toLoad.includes(Number(pid))) return;
      const phase = phaseIndex[String(pid)] || {};
      for (const a of list || []) {
        all.push({
          id: String(a.id),
          assignmentId: a.id,
          phaseId: a.phaseId,
          personId: a.personId,
          start: new Date(a.startDate),
          durationDays: Number(
            a.assignedDays || phase.estimatedDays || phase.durationDays || 1
          ),
          title: phase.title || phase.name || `Phase ${a.phaseId}`,
          color: phase.color || "#2563eb",
        });
      }
    });
    setTasks(all);
  }

  const [activeDragId, setActiveDragId] = useState(null);
  const renderGhost = () => {
    if (!activeDragId || !activeDragId.startsWith("phase:")) return null;
    const phaseId = Number(activeDragId.split(":")[1]);
    const phase = phaseIndex[String(phaseId)] || {};
    const title = phase.title || phase.name || `Phase ${phaseId}`;
    return (
      <div className="ng-ghostCard">
        <div className="ng-ghostTitle">{title}</div>
      </div>
    );
  };

  async function persistMove(t) {
    const task = tasks.find((x) => String(x.id) === String(t.id));
    if (!task) return;
    const payload = {
      personId: Number(t.personId),
      assignedDays: Number(t.durationDays || task.durationDays || 1),
      startDate: t.start instanceof Date ? t.start.toISOString() : t.start,
    };
    try {
      await updatePhaseAssignment(
        Number(task.phaseId),
        Number(task.assignmentId || task.id),
        payload
      );
      setTasks((prev) =>
        prev.map((x) =>
          String(x.id) === String(t.id)
            ? { ...x, personId: t.personId, start: t.start }
            : x
        )
      );
      setAssignmentsCache((prev) => {
        const next = new Map(prev);
        const list = (next.get(Number(task.phaseId)) || []).map((a) =>
          a.id === Number(task.assignmentId || task.id)
            ? {
                ...a,
                personId: payload.personId,
                assignedDays: payload.assignedDays,
                startDate: payload.startDate,
              }
            : a
        );
        next.set(Number(task.phaseId), list);
        return next;
      });
    } catch (err) {
      console.error("update assignment error", err);
    }
  }

  function computeDropPreview(activeId) {
    const surface = document.querySelector(".ng-taskLayer");
    if (!surface || !cols.length || !people.length) return null;

    const rect = surface.getBoundingClientRect();
    const px = pointerRef.current.x - rect.left;
    const py = pointerRef.current.y - rect.top;
    if (px < 0 || py < 0) return null;

    const dpc = zoom === "day" ? 1 : zoom === "week" ? 7 : 14;
    const colIndex = Math.max(0, Math.round(px / colW));
    const laneIdx = Math.min(
      Math.max(Math.floor(py / laneH), 0),
      Math.max(people.length - 1, 0)
    );

    let durationDays = 5;
    if (activeId && typeof activeId === "string") {
      if (activeId.startsWith("phase:")) {
        const phaseId = Number(activeId.split(":")[1]);
        const phase = phaseIndex[String(phaseId)] || {};
        durationDays = Number(
          phase.estimatedDays || phase.durationDays || phase.days || 5
        );
      } else if (activeId.startsWith("card:")) {
        const t = tasks.find(
          (x) =>
            `card:${x.id}` === activeId ||
            String(x.id) === activeId.replace("card:", "")
        );
        if (t) durationDays = Number(t.durationDays || 1);
      }
    }

    const workPerCol = zoom === "day" ? 1 : zoom === "week" ? 5 : 10;
    const widthPx = (durationDays / workPerCol) * colW;
    return {
      left: colIndex * colW,
      top: laneIdx * laneH + 6,
      width: widthPx,
      height: laneH - 12,
      laneIdx,
      colIndex,
    };
  }

  const onDragStart = (e) => {
    const id = String(e?.active?.id || "");
    setActiveDragId(id);
    setDropPreview(computeDropPreview(id));
  };

  // helper used by split prompt
  async function onCreatePhaseAssignment({
    phaseId,
    personId,
    startDate,
    assignedDays,
  }) {
    try {
      const payload = {
        personId: Number(personId),
        assignedDays: Number(assignedDays),
        startDate:
          startDate instanceof Date ? startDate.toISOString() : startDate,
      };
      const created = await createPhaseAssignment(Number(phaseId), payload);
      if (created && created.id != null) {
        setAssignmentsCache((prev) => {
          const next = new Map(prev);
          const list = next.get(Number(phaseId)) || [];
          next.set(Number(phaseId), [
            ...list,
            {
              id: created.id,
              phaseId: Number(phaseId),
              personId: payload.personId,
              assignedDays: payload.assignedDays,
              startDate: payload.startDate,
            },
          ]);
          return next;
        });
        const phase = phaseIndex[String(phaseId)] || {};
        const title = phase.title || phase.name || `Phase ${phaseId}`;
        const color = phase.color || "#2563eb";
        setTasks((prev) => [
          ...prev,
          {
            id: String(created.id),
            assignmentId: created.id,
            phaseId: Number(phaseId),
            personId: Number(personId),
            start: startDate instanceof Date ? startDate : new Date(startDate),
            durationDays: Number(assignedDays),
            title,
            color,
          },
        ]);
      }
    } catch (err) {
      console.error("create assignment error", err);
    }
  }
  async function onDragEnd(evt) {
    const id = String(evt?.active?.id || "");
    if (id.startsWith("phase:")) {
      const phaseId = Number(id.split(":")[1]);
      const surface = document.querySelector(".ng-taskLayer");
      if (!surface || !cols.length || !people.length) {
        setActiveDragId(null);
        setDropPreview(null);
        return;
      }
      const rect = surface.getBoundingClientRect();
      const px = pointerRef.current.x - rect.left;
      const py = pointerRef.current.y - rect.top;
      if (px < 0 || py < 0) {
        setActiveDragId(null);
        setDropPreview(null);
        return;
      }

      const colIndex = Math.max(0, Math.round(px / colW));
      const dpc = daysPerColumn(zoom);
      const startDate = new Date(cols[0].start);
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(startDate.getDate() + colIndex * dpc);

      const laneIdx = Math.min(
        Math.max(Math.floor(py / laneH), 0),
        Math.max(people.length - 1, 0)
      );
      const person = people[laneIdx];
      if (!person) {
        setActiveDragId(null);
        setDropPreview(null);
        return;
      }

      const phase = phaseIndex[String(phaseId)] || {};
      const maxDays = Number(
        phase.estimatedDays || phase.durationDays || phase.days || 1
      );

      setSplitDays(maxDays);
      setSplitPrompt({
        x: pointerRef.current.x + 12,
        y: pointerRef.current.y + 12,
        personId: person.id,
        startDate,
        phaseId,
        maxDays,
        title: phase.title || phase.name || `Phase ${phaseId}`,
      });
      setActiveDragId(null);
      setDropPreview(null);
      return;
    }
    setActiveDragId(null);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={(e) =>
        setDropPreview(computeDropPreview(String(e?.active?.id || "")))
      }
      onDragCancel={() => setDropPreview(null)}
      onDragEnd={onDragEnd}
    >
      <div className="ng-shell">
        <div className="ng-toolbar">
          <button
            className="ng-btn"
            onClick={() => {
              setAssignmentsCache(new Map());
              setTasks([]);
            }}
          >
            Clear cache
          </button>
          <button
            className="ng-btn"
            onClick={() => {
              const openPhases = Object.keys(phaseIndex).map(Number);
              refreshAssignments(openPhases);
            }}
          >
            Refresh
          </button>
          <div className="ng-pill">
            <span className="ng-label">Zoom</span>
            <select
              className="ng-select"
              value={zoom}
              onChange={(e) => setZoom(e.target.value)}
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="bi">Bi-weekly</option>
            </select>
          </div>
          <div className="ng-pill">
            <span className="ng-label">Start</span>
            <input
              className="ng-input"
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
            />
          </div>
          <div className="ng-pill">
            <span className="ng-label">Months</span>
            <select
              className="ng-select"
              value={monthSpan}
              onChange={(e) => setMonthSpan(Number(e.target.value))}
            >
              {[6, 9, 12, 15, 18, 24, 36].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ResizableSidebar
          side="left"
          min={240}
          max={560}
          initial={320}
          storageKey="ng-left"
        >
          <div className="ng-left">
            <div className="ng-section">
              <div className="ng-sectionTitle">Phases</div>
              <PhaseSidebar
                onPhaseIndex={setPhaseIndex}
                onVisibilityChange={({ visiblePhaseIds }) => refreshAssignments(visiblePhaseIds)}
                remainingByPhase={phaseRemaining}
                hideFullyAssigned
              />
            </div>
          </div>
        </ResizableSidebar>

        <div className="ng-gridWrap">
          <div className="ng-scroll">
            <div className="ng-body">
              <div className="ng-bodyLeft">
                <div className="ng-headerH1" />
                <div className="ng-headerH2" />
                <div className="people">
                  {people.map((p) => (
                    <LaneRow key={p.id} person={p} />
                  ))}
                </div>
              </div>

              <div className="ng-bodyRight">
                <div
                  className="ng-months"
                  style={{
                    gridTemplateColumns: `repeat(${months.reduce(
                      (s, m) => s + m.span,
                      0
                    )}, var(--ng-colW))`,
                  }}
                >
                  {months.map((m) => (
                    <div
                      key={m.key}
                      className="ng-month"
                      style={{ gridColumn: `span ${m.span}` }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>

                <div
                  className="ng-cols"
                  style={{
                    gridTemplateColumns: `repeat(${cols.length}, var(--ng-colW))`,
                  }}
                >
                  {cols.map((c) => (
                    <div key={c.key} className="ng-colHead">
                      <span className="ng-colLabel">{c.label}</span>
                    </div>
                  ))}
                </div>

                <NonWorkLayer cols={cols} people={people} colW={colW} />

                <div
                  className="ng-gridBg"
                  style={{
                    gridTemplateColumns: `repeat(${cols.length}, var(--ng-colW))`,
                  }}
                >
                  {cols.map((col) => (
                    <div key={col.key} className="ng-bgCol">
                      {people.map((p) => (
                        <div key={p.id} className="ng-laneRow" />
                      ))}
                    </div>
                  ))}
                </div>

                <div className="ng-taskLayer">
                  {cols.length > 0 && (
                    <TodayMarker
                      gridStart={cols[0].start}
                      zoom={zoom}
                      colW={colW}
                    />
                  )}

                  <TaskLayer
                    cols={cols}
                    people={people}
                    zoom={zoom}
                    tasks={tasks}
                    colWidth={colW}
                    onTaskUpdate={persistMove}
                  />

                  {dropPreview && (
                    <div
                      aria-hidden="true"
                      className="ng-dropPreview"
                      style={{
                        left: dropPreview.left,
                        top: dropPreview.top,
                        width: dropPreview.width,
                        height: dropPreview.height,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {splitPrompt && (
          <div
            className="ng-splitPrompt"
            style={{
              position: "fixed",
              left: splitPrompt.x,
              top: splitPrompt.y,
              zIndex: 60,
              background: "#fff",
              border: "1px solid rgba(2,6,23,.1)",
              borderRadius: 10,
              boxShadow: "0 12px 32px rgba(0,0,0,.18)",
              padding: "10px 12px",
              minWidth: 220,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              Assign “{splitPrompt.title}”
            </div>
            <div className="ng-splitPrompt__row">
              <label>Days:</label>
              <input
                type="number"
                min={1}
                max={splitPrompt.maxDays}
                value={splitDays}
                onChange={(e) =>
                  setSplitDays(
                    Math.max(
                      1,
                      Math.min(
                        Number(splitPrompt.maxDays),
                        Number(e.target.value || 1)
                      )
                    )
                  )
                }
              />
              <button
                className="primary"
                onClick={async () => {
                  try {
                    await onCreatePhaseAssignment({
                      phaseId: splitPrompt.phaseId,
                      personId: splitPrompt.personId,
                      startDate: splitPrompt.startDate,
                      assignedDays: splitDays,
                    });
                  } finally {
                    setSplitPrompt(null);
                  }
                }}
              >
                OK
              </button>
              <button
                onClick={async () => {
                  try {
                    await onCreatePhaseAssignment({
                      phaseId: splitPrompt.phaseId,
                      personId: splitPrompt.personId,
                      startDate: splitPrompt.startDate,
                      assignedDays: splitPrompt.maxDays,
                    });
                  } finally {
                    setSplitPrompt(null);
                  }
                }}
              >
                All {splitPrompt.maxDays}d
              </button>
              <button onClick={() => setSplitPrompt(null)}>Cancel</button>
            </div>
          </div>
        )}
        <DragOverlay>{renderGhost()}</DragOverlay>
      </div>
    </DndContext>
  );
}
