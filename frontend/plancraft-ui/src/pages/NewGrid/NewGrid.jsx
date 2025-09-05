/**
 * NewGrid.jsx
 *
 * 1) Purpose (functional):
 *    Timeline planning grid for assigning project phases to people across a calendar.
 *    Supports dragging from sidebar (phases) onto the grid and moving existing cards within the grid,
 *    shows a drop placeholder, and persists assignments.
 *
 * 2) Developer summary:
 *    - Renders calendar columns, people lanes, and a task layer with draggable cards (@dnd-kit).
 *    - Uses `PhaseSidebar` to source phases and lazy-loads assignments per visible phase.
 *    - Pointer-based math (vs droppable cells) determines target lane/column for both new and moved cards.
 *    - `createPhaseAssignment` for new drops; `updatePhaseAssignment` for moves.
 *    - This revision enables drop preview and proper onDragEnd handling for `card:` drags too.
 
  * NewGrid.jsx — single-call version (no per-phase network loops)
 *
 * Uses fetchGridPhases(from,to) aggregated response to populate:
 * - banksCatalog, projectsByBank (for sidebar filters)
 * - phaseIndex (phase metadata: title, bankId, projectId, color)
 * - assignmentsCache (Map<phaseId, Assignment[]>)
 * - tasks (flat array for TaskLayer)
 *
 * Removes per-phase auto loading and NEVER calls listPhaseAssignments.
 */

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import ResizableSidebar from "../../components/ResizableSidebar";
import PhaseSidebar from "./PhaseSidebar";
import { buildMonthSegments } from "./calendar";
import "./newgrid.css";
import TaskLayer from "./task-layer/TaskLayer";
import TodayMarker from "./task-layer/TodayMarker";
import NonWorkLayer from "./task-layer/NonWorkLayer";
import PhaseDetailsToast from "./PhaseDetailsToast";
import PlanningFooter from "./PlanningFooter";

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
  fetchGridPhases,
  createPhaseAssignment,
  updatePhaseAssignment,
  deletePhaseAssignment,
} from "../../lib/api";

/**
 * NOTE (2025-09-05): phaseIndex merge policy
 * We must never replace a richer phase meta with a slimmer one.
 * onPhaseIndex() from children should provide additive deltas.
 * Here we merge them field-by-field, preserving existing properties
 * unless the incoming value is non-null/defined.
 */

function mergePhaseMeta(oldMeta = {}, newMeta = {}){
  const out = { ...oldMeta };
  for(const [k,v] of Object.entries(newMeta)){
    if(v !== undefined && v !== null){
      out[k] = v;
    }else if(out[k] === undefined){
      out[k] = v; // keep undefined only if it didn't exist
    }
  }
  return out;
}

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
  const [showFooter, setShowFooter] = useState(true);
  const [selectedPhaseData, setSelectedPhaseData] = useState(null);
  const [zoom, setZoom] = useState("week");
  // Stable callback so PhaseSidebar's effect doesn't loop
  const handlePhaseIndex = useCallback((delta) => {
    setPhaseIndex((prev) => {
      const next = { ...prev };
      for (const [id, meta] of Object.entries(delta || {})) {
        next[id] = mergePhaseMeta(prev[id], meta);
      }
      return next;
    });
  }, []);
  const [startMonth, setStartMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [monthSpan, setMonthSpan] = useState(12);

  const [cardStyle, setCardStyle] = useState("standard");

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
    document.documentElement.style.setProperty(
      "--ng-footerH",
      showFooter ? "80px" : "0px"
    );
  }, [showFooter]);
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const lh = parseFloat(cs.getPropertyValue("--ng-laneH")) || 56;
    setLaneH(lh);
  }, [zoom]);
  useEffect(() => {
    document.documentElement.style.setProperty("--ng-colW", colW + "px");
  }, [colW]);

  const [people, setPeople] = useState([]);
  const [peopleLoadedFromGrid, setPeopleLoadedFromGrid] = useState(false);
  useEffect(() => {
    if (peopleLoadedFromGrid) return;
    let cancelled = false;
    (async () => {
      try {
        const ppl = await fetchPeople();
        if (!cancelled) setPeople(ppl || []);
      } catch {
        if (!cancelled) setPeople([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [peopleLoadedFromGrid]);
  // === Single-call load for banks -> projects -> phases -> assignments for the visible window ===
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshFromServer();
} catch (e) {
        console.error("fetchGridPhases failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

    // Keep current selection from PhaseSidebar so Refresh can re-apply it
  const [selBankIds, setSelBankIds] = useState(null);
  const [selProjectIds, setSelProjectIds] = useState(null);

        // === Server refresh that respects current selection ===
        async function refreshFromServer() {
          try {
const grid = await fetchGridPhases(from, to);
        //if (cancelled) return;

        const banks = Array.isArray(grid) ? grid : grid?.banks || [];
        if (grid && Array.isArray(grid.people)) {
          setPeople(grid.people);
          setPeopleLoadedFromGrid(true);
        }

        // catalogs for sidebar
        setBanksCatalog(
          (banks || []).map((b) => ({ id: b.id, name: b.name, color: b.color }))
        );
        const pbb = {};
        const idx = {};
        const collected = [];

        for (const b of banks || []) {
          const bid = String(b.id);
          pbb[bid] = (b.projects || []).map((p) => ({
            id: p.id,
            name: p.name,
            phases: p.phases || [],
          }));
          //bitna tocka
          for (const p of b.projects || []) {
            for (const ph of p.phases || []) {
              //debugger
              idx[String(ph.id)] = {id: ph.id,
                projectId: p.id,
                bankId: b.id,            // fix here
                bankName: b.name,
                bankPrefix: (() => {
                  const raw = (b.code || b.shortCode || b.abbr || b.name) || '';
                  const pref = String(raw).toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,8);
                  return pref || null;
                })(),
// add here
                title: ph.title || ph.name,
                color: b.color || ph.color || "#2563eb",
                estimatedDays:
                ph.estimatedDays ?? ph.durationDays ?? ph.days ?? null,
                description: ph.description || "",
              };
              for (const a of ph.assignments || []) {
                collected.push({
                  id: a.id,
                  phaseId: ph.id,
                  personId: a.personId,
                  startDate: a.startDate,
                  assignedDays: a.assignedDays,
                });
              }
            }
          }
        }

        setProjectsByBank(pbb);
        //debugger
        setPhaseIndex(idx);

        const cache = new Map();
        for (const a of collected) {
          const pid = Number(a.phaseId);
          const arr = cache.get(pid) || [];
          arr.push(a);
          cache.set(pid, arr);
        }
        Object.keys(idx).forEach((k) => {
          const pid = Number(k);
          if (!cache.has(pid)) cache.set(pid, []);
        });
        setAssignmentsCache(cache);

        setTasks(
          collected.map((a) => ({
            id: String(a.id),
            assignmentId: a.id,
            phaseId: Number(a.phaseId),
            personId: Number(a.personId),
            start: new Date(a.startDate),
            durationDays: Number(a.assignedDays || 0),
	    title: `${idx[String(a.phaseId)]?.bankPrefix}:${idx[String(a.phaseId)]?.title}`,
            color: idx[String(a.phaseId)]?.color || "#2563eb",
          }))
        );
            // Re-apply selection (project-first)
            const bankSet = new Set((selBankIds || []).map(Number));
            const projSet = new Set((selProjectIds || []).map(Number));
            const allow = [];
            for (const [pid, ph] of Object.entries(idx)) {
              let include = false;
              if (projSet.size > 0) include = projSet.has(Number(ph.projectId));
              else if (bankSet.size > 0) include = bankSet.has(Number(ph.bankId));
              else include = true;
              if (include) allow.push(Number(pid));
            }
            if (selBankIds && selProjectIds && bankSet.size===0 && projSet.size===0) {
              rebuildTasksFromCache(assignmentsCache, [-1]);
            } else {
              rebuildTasksFromCache(assignmentsCache, allow);
            }
          } catch (e) {
            console.error("refreshFromServer failed", e);
          }
        }

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const id = setInterval(() => { try { refreshFromServer(); } catch {} }, 10000);
    return () => clearInterval(id);
  }, [from, to, selBankIds, selProjectIds]);

  const [phaseIndex, setPhaseIndex] = useState({});
  const [dropPreview, setDropPreview] = useState(null);
  const [splitPrompt, setSplitPrompt] = useState(null);
  const [splitDays, setSplitDays] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [assignmentsCache, setAssignmentsCache] = useState(() => new Map());
  // === Split existing assignment (context menu) ===
  const [splitExisting, setSplitExisting] = useState(null); // { assignmentId, personId, startDate, assignedDays, title }
  const [splitExistingDays, setSplitExistingDays] = useState(1);
  const [splitExistingPersonId, setSplitExistingPersonId] = useState("");
  // Keep current selection from PhaseSidebar so Refresh can re-apply it
  // const [selBankIds, setSelBankIds] = useState(null);
  // const [selProjectIds, setSelProjectIds] = useState(null);

  // helper to find phaseId from assignmentsCache
  const findPhaseIdFor = (id) => {
    for (const [pid, list] of assignmentsCache) {
      if ((list || []).some((a) => String(a.id) === String(id)))
        return Number(pid);
    }
    return null;
  };

  async function applySplitExisting() {
    const aId = String(splitExisting.assignmentId);
    const leftDays = Number(splitExistingDays);
    const rightPersonId = Number(splitExistingPersonId);
    const phaseId = findPhaseIdFor(aId);
    if (!phaseId || leftDays <= 0) return;

    // find original from cache
    const list = assignmentsCache.get(phaseId) || [];
    const original = list.find((a) => String(a.id) == aId);
    if (!original) return;
    const total = Number(original.assignedDays || 0);
    if (leftDays >= total) return;
    const rightDays = total - leftDays;

    const rightStartDate = (() => {
      const d = new Date(original.startDate);
      d.setDate(d.getDate() + leftDays);
      return d.toISOString().slice(0, 10);
    })();

    // optimistic updates
    const prevCache = assignmentsCache;
    const prevTasks = tasks;

    setAssignmentsCache((prev) => {
      const next = new Map(prev);
      const arr = (next.get(phaseId) || []).map((x) =>
        String(x.id) === aId ? { ...x, assignedDays: leftDays } : x
      );
      next.set(phaseId, arr);
      return next;
    });
    setTasks((prev) =>
      prev.map((t) =>
        String(t.assignmentId) === aId ? { ...t, durationDays: leftDays } : t
      )
    );

    try {
      // shrink original
      await updatePhaseAssignment(phaseId, Number(aId), {
        assignedDays: leftDays,
      });
      // create right segment
      const created = await createPhaseAssignment(phaseId, {
        personId: rightPersonId,
        assignedDays: rightDays,
        startDate: rightStartDate,
      });
      if (created && created.id != null) {
        // fetch phase meta for title/color
        const phase = phaseIndex[String(phaseId)] || {};
        const title = phase.title || phase.name || `Phase ${phaseId}`;
        const color = phase.color || "#2563eb";

        setAssignmentsCache((prev) => {
          const next = new Map(prev);
          const arr = next.get(phaseId) || [];
          next.set(phaseId, [
            ...arr,
            {
              id: created.id,
              phaseId,
              personId: rightPersonId,
              assignedDays: rightDays,
              startDate: rightStartDate,
            },
          ]);
          return next;
        });
        setTasks((prev) => [
          ...prev,
          {
            id: String(created.id),
            assignmentId: created.id,
            phaseId,
            personId: rightPersonId,
            start: new Date(rightStartDate),
            durationDays: rightDays,
            title,
            color,
          },
        ]);
      }
    } catch (err) {
      console.error("split existing failed", err);
      // rollback
      setAssignmentsCache(prevCache);
      setTasks(prevTasks);
    } finally {
      setSplitExisting(null);
    }
  }

  const [isPhaseDrag, setIsPhaseDrag] = useState(false);
  // 1) state
  const [phaseRemaining, setPhaseRemaining] = useState({});
  function rebuildTasksFromCache(
    mapLike = assignmentsCache,
    filterPhaseIds = null
  ) {
    const selected =
      filterPhaseIds && filterPhaseIds.length
        ? new Set(filterPhaseIds.map(Number))
        : null;
    const out = [];
    mapLike.forEach((list, pid) => {
      if (selected && !selected.has(Number(pid))) return;
      const ph = phaseIndex[String(pid)] || {};
      (list || []).forEach((a) => {
        out.push({
          id: String(a.id),
          assignmentId: a.id,
          phaseId: a.phaseId,
          personId: a.personId,
          start: new Date(a.startDate),
          durationDays: Number(
            a.assignedDays || ph.estimatedDays || ph.durationDays || 1
          ),
          title:
            (ph.bankPrefix ? ph.bankPrefix + ":" : "") +
            (ph.title || ph.name || `Phase ${a.phaseId}`),
          color: ph.color || "#2563eb",
        });
      });
    });
    setTasks(out);
  }

  const onSidebarVisibility = ({ selectedBankIds, selectedProjectIds }) => {
    // Store selection so we can re-apply it after server refresh
    setSelBankIds(Array.isArray(selectedBankIds) ? selectedBankIds.map(Number) : []);
    setSelProjectIds(Array.isArray(selectedProjectIds) ? selectedProjectIds.map(Number) : []);

    const bankSet = new Set((selectedBankIds || []).map(Number));
    const projSet = new Set((selectedProjectIds || []).map(Number));

    // If neither banks nor projects are selected -> show NONE
    if (bankSet.size === 0 && projSet.size === 0) {
      rebuildTasksFromCache(assignmentsCache, [-1]);
      return;
    }

    // Project-first logic:
    // - If any projects are selected, show ONLY those projects (ignore bank selection per item)
    // - If no projects are selected, fall back to bank selection
    const allow = [];
    for (const [pid, ph] of Object.entries(phaseIndex)) {
      let include = false;
      if (projSet.size > 0) {
        include = projSet.has(Number(ph.projectId));
      } else if (bankSet.size > 0) {
        include = bankSet.has(Number(ph.bankId));
      }
      if (include) allow.push(Number(pid));
    }
    rebuildTasksFromCache(assignmentsCache, allow);
  };


  // === Catalogs emitted from PhaseSidebar ===
  const [banksCatalog, setBanksCatalog] = useState([]); // [{id, name}]
  const [projectsByBank, setProjectsByBank] = useState({}); // { [bankId]: [{id, name}] }

  // === Bank & Project filter state (catalogs are global constants above) ===
  // Null => no filter (show all). Bank filter gates project filter.
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  // Optional alias for clarity: we handle PhaseAssignments (internally stored in `tasks`)
  const phaseAssignments = tasks;

  // Visible PhaseAssignments based on filters
  const visibleAssignments = useMemo(() => {
    let list = phaseAssignments;
    if (selectedBankId != null) {
      list = list.filter((pa) => {
        const ph = phaseIndex[String(pa.phaseId)] || {};
        const bankId = ph?.bankId ?? ph?.bank?.id ?? null;
        return bankId != null && String(bankId) === String(selectedBankId);
      });
      if (selectedProjectId != null) {
        list = list.filter((pa) => {
          const ph = phaseIndex[String(pa.phaseId)] || {};
          const projId =
            ph?.projectId ?? ph?.project?.id ?? ph?.projectKey ?? null;
          return projId != null && String(projId) === String(selectedProjectId);
        });
      }
    }
    return list;
  }, [phaseAssignments, selectedBankId, selectedProjectId, phaseIndex]);
  // 2) топ-левел функција (без hooks внатре)
  function recomputeRemaining(mapLike) {
    const res = {};
    // total по фаза (од phaseIndex)
    for (const [id, ph] of Object.entries(phaseIndex || {})) {
      const total =
        Number(ph.estimatedDays || ph.durationDays || ph.days || 0) || 0;
      res[Number(id)] = total;
    }
    // одземај ги доделените денови од assignmentsCache
    const m =
      mapLike && typeof mapLike.forEach === "function"
        ? mapLike
        : assignmentsCache;
    if (m && typeof m.forEach === "function") {
      m.forEach((list, pid) => {
        const used = (list || []).reduce(
          (s, a) => s + Number(a.assignedDays || 0),
          0
        );
        res[Number(pid)] = Math.max(0, (res[Number(pid)] ?? 0) - used);
      });
    }
    setPhaseRemaining(res);
  }

  // 3) ефект кој се тригерира кога ќе се смени assignmentsCache/phaseIndex
  useEffect(() => {
    try {
      recomputeRemaining();
    } catch {}
  }, [assignmentsCache, phaseIndex]);

  const inFlight = useRef(new Set());

  const { cols, months } = useMemo(
    () => buildMonthSegments(from, to, zoom),
    [from, to, zoom]
  );
  // Track pointer so computeDropPreview can use exact cursor position
  const pointerRef = useRef({ x: 0, y: 0 });
  const dragBiasRef = useRef({ x: 0, y: 0 }); // calibrates overlay center vs raw pointer

  // Optional: keep it updated during the drag (helps when dnd-kit uses an overlay)
  useEffect(() => {
    const onMove = (ev) => {
      pointerRef.current = { x: ev.clientX, y: ev.clientY };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  // Use dnd-kit rect data (when available) to sync pointer exactly at drag start/move
  function updatePointerFromEvent(e) {
    try {
      const r =
        e?.active?.rect?.current?.translated ||
        e?.active?.rect?.current?.initial;
      if (r) {
        pointerRef.current = {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
        };
      }
    } catch {
      /* no-op */
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const daysPerColumn = (z) => (z === "day" ? 1 : z === "week" ? 7 : 14);
  async function refreshAssignments(visiblePhaseIds) {
    rebuildTasksFromCache(assignmentsCache, visiblePhaseIds || null);
  }

  const [activeDragId, setActiveDragId] = useState(null);
  const renderGhost = () => {
    if (!activeDragId || !activeDragId.startsWith("phase:")) return null;
    const phaseId = Number(activeDragId.split(":")[1]);
    const phase = phaseIndex[String(phaseId)] || {};
    const dpc = daysPerColumn(zoom);
    const days = Number(
      phase.estimatedDays || phase.durationDays || phase.days || 5
    );
    const spanCols = Math.max(1, Math.ceil(days / dpc));
    const widthPx = spanCols * colW;
    const title = phase.bankPrefix + ":" + phase.title;
    return (
      <div className="ng-ghostCard" style={{ width: widthPx }}>
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
    // 1) Same surface and pointer
    const surface = document.querySelector(".ng-taskLayer");
    if (!surface || !cols.length || !people.length) return null;

    const rect = surface.getBoundingClientRect();
    const px =
      pointerRef.current.x + (dragBiasRef?.current?.x || 0) - rect.left;
    const py = pointerRef.current.y + (dragBiasRef?.current?.y || 0) - rect.top;
    if (px < 0 || py < 0) return null;

    // 2) Snap (keep your original policy)
    //    - columns: floor (must cross the boundary)
    //    - lanes:   round (half-threshold)
    const dpc =
      typeof daysPerColumn === "function"
        ? daysPerColumn(zoom)
        : zoom === "day"
        ? 1
        : zoom === "week"
        ? 7
        : 14;

    const colIndex = Math.max(0, Math.floor(px / colW));
    // Sticky lane selection: stay in тековната лента додека центарот не ја премине границата
    const laneIdx = Math.min(
      Math.max(Math.floor(py / laneH), 0),
      Math.max(people.length - 1, 0)
    );

    // 3) Duration -> whole columns -> width
    let durationDays = 5;
    if (activeId && typeof activeId === "string") {
      if (activeId.startsWith("phase:")) {
        const phaseId = Number(activeId.split(":")[1]);
        const phase = phaseIndex[String(phaseId)] || {};
        durationDays = Number(
          phase.estimatedDays || phase.durationDays || phase.days || 5
        );
      } else if (activeId.startsWith("assignment:")) {
        const aid = activeId.replace("assignment:", "");
        const t = tasks.find(
          (x) => `assignment:${x.id}` === activeId || String(x.id) === aid
        );
        if (t) durationDays = Number(t.durationDays || 1);
      }
    }

    const spanCols = Math.max(1, Math.ceil(durationDays / dpc));
    const widthPx = spanCols * colW;

    // 4) Return preview box in the same coordinate system as TaskLayer
    return {
      left: colIndex * colW,
      top: laneIdx * laneH + 6,
      width: widthPx,
      height: laneH - 12,
      laneIdx,
      colIndex,
    };
  }

  const isPhaseId = (id, e) =>
    e?.active?.data?.current?.kind === "phase" ||
    (typeof id === "string" && id.startsWith("phase:"));

  const isAssignmentId = (id, e) =>
    e?.active?.data?.current?.kind === "assignment" ||
    (typeof id === "string" && id.startsWith("assignment:"));

  const onDragStart = (e) => {
    try {
      const r =
        e?.active?.rect?.current?.translated ||
        e?.active?.rect?.current?.initial;
      if (r && pointerRef?.current) {
        const centerX = r.left + r.width / 2;
        const centerY = r.top + r.height / 2;
        dragBiasRef.current.x = centerX - pointerRef.current.x;
        dragBiasRef.current.y = centerY - pointerRef.current.y;
      } else {
        dragBiasRef.current.x = 0;
        dragBiasRef.current.y = 0;
      }
    } catch {
      dragBiasRef.current.x = 0;
      dragBiasRef.current.y = 0;
    }
    if (typeof updatePointerFromEvent === "function") updatePointerFromEvent(e);
    const id = String(e?.active?.id || "");
    setActiveDragId(id);

    // Use the unified helpers (no 'card' anywhere)
    const isPhase = isPhaseId(id, e);
    const isAssignment = isAssignmentId(id, e);

    // Keep this state if you use it later for split/create UI
    setIsPhaseDrag(isPhase);

    // NEW: enable preview for both phase and card drags

    const show = isPhaseId(id, e) || isAssignmentId(id, e);
    if (show) {
      setDropPreview(computeDropPreview(id));
    } else {
      setDropPreview(null);
    }
  };

  // always clear preview if drag cancels
  const onDragCancel = () => setDropPreview(null);
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

  const onDragMove = (e) => {
    if (typeof updatePointerFromEvent === "function") updatePointerFromEvent(e);
    try {
      const sc = document.querySelector(".ng-scroll");
      if (sc && typeof window.applyAutoScroll === "function")
        window.applyAutoScroll(sc, pointerRef.current, {
          edge: 64,
          maxSpeed: 36,
        });
    } catch {}
    const id = String(e?.active?.id || "");
    // keep preview live for both phase and card drags
    const show = isPhaseId(id, e) || isAssignmentId(id, e);
    if (show) {
      setDropPreview(computeDropPreview(id));
    } else {
      setDropPreview(null);
    }
  };

  async function onDragEnd(evt) {
    const id = String(evt?.active?.id || "");

    try {
      // === 1) assignment moved within grid ===
      if (
        id.startsWith("assignment:") ||
        evt?.active?.data?.current?.kind === "assignment"
      ) {
        // ✅ Use the SAME math as preview
        const target = dropPreview ?? computeDropPreview(id);
        if (!target || !cols.length || !people.length) return;
        const { colIndex, laneIdx } = target;

        const dpc = daysPerColumn(zoom);
        const startDate = new Date(cols[0].start);
        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(startDate.getDate() + colIndex * dpc);

        const person = people[laneIdx];
        if (!person) return;

        const assignmentId = id.replace("assignment:", "");
        const t = tasks.find((x) => String(x.id) === assignmentId);
        if (t) {
          await persistMove({
            id: t.id,
            personId: person.id,
            start: startDate,
            durationDays: t.durationDays,
          });
        }
        return;
      }

      // === 2) phase from sidebar -> create assignment ===
      if (
        id.startsWith("phase:") ||
        evt?.active?.data?.current?.kind === "phase"
      ) {
        const phaseId = Number(id.split(":")[1]);

        // ✅ Use the SAME math as preview
        const target = dropPreview ?? computeDropPreview(id);
        if (!target || !cols.length || !people.length) return;
        const { colIndex, laneIdx } = target;

        const dpc = daysPerColumn(zoom);
        const startDate = new Date(cols[0].start);
        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(startDate.getDate() + colIndex * dpc);

        const person = people[laneIdx];
        if (!person) return;

        const phase = phaseIndex[String(phaseId)] || {};
        const totalDays = Number(
          phase.estimatedDays || phase.durationDays || phase.days || 1
        );
        const remainingDays =
          phaseRemaining && phaseRemaining[String(phaseId)] != null
            ? Number(phaseRemaining[String(phaseId)])
            : totalDays;
        const maxDays = Math.max(1, remainingDays);

        setSplitDays(maxDays);
        setSplitPrompt({
          x: pointerRef.current.x + 12,
          y: pointerRef.current.y + 12,
          personId: person.id,
          startDate,
          phaseId,
          maxDays,
          title:
            (phase.bankPrefix ? phase.bankPrefix + ":" : "") +
            (phase.title || phase.name || `Phase ${a.phaseId}`),
        });
        return;
      }
    } finally {
      setActiveDragId(null);
      setDropPreview(null);
      setIsPhaseDrag(false);
    }
  }

  const onDeleteAssignment = async (assignmentId) => {
    // 0) Avoid double-firing (fast key-repeat)
    if (!inFlight.current) inFlight.current = new Set();
    if (inFlight.current.has(String(assignmentId))) return;
    inFlight.current.add(String(assignmentId));
    // snapshots for rollback
    const prevTasks = tasks;
    const prevCache = assignmentsCache;

    // find the phaseId that owns this assignment (from your cache)
    const findPhaseIdFor = (id) => {
      for (const [pid, list] of assignmentsCache) {
        if ((list || []).some((a) => String(a.id) === String(id)))
          return Number(pid);
      }
      return null;
    };
    const phaseId = findPhaseIdFor(assignmentId);

    // optimistic UI (keep your existing behavior)
    setTasks((prev) =>
      prev.filter((x) => String(x.id) !== String(assignmentId))
    );
    setAssignmentsCache((prev) => {
      const next = new Map(prev);
      next.forEach((list, pid) => {
        next.set(
          pid,
          (list || []).filter((a) => String(a.id) !== String(assignmentId))
        );
      });
      return next;
    });

    try {
      // Primary endpoint: /phases/:phaseId/assignments/:id
      if (phaseId != null) {
        await deletePhaseAssignment(phaseId, Number(assignmentId));
      } else {
        throw new Error("phaseId not found for assignment " + assignmentId);
      }
    } catch (err) {
      console.error("Delete failed, rolling back", err);
      // rollback
      setTasks(prevTasks);
      setAssignmentsCache(prevCache);
    }
  };

  function computePhaseOverview(
    assignment,
    { phaseIndex, banksCatalog, assignmentsCache }
  ) {
    const phaseId = Number(assignment.phaseId);
    const ph = phaseIndex[String(phaseId)] || {};
    const bank = banksCatalog.find((b) => String(b.id) === String(ph.bankId));
    const list = assignmentsCache.get(phaseId) || [];

    // earliest start (прв доделен ден на било кој сегмент)
    const earliest = list.reduce((min, a) => {
      const d = new Date(a.startDate);
      d.setHours(0, 0, 0, 0);
      return !min || d < min ? d : min;
    }, null);

    // latest end (последен ден од последниот сегмент)
    const latest = list.reduce((max, a) => {
      const d = new Date(a.startDate);
      d.setDate(d.getDate() + Math.max(0, Number(a.assignedDays || 0) - 1));
      d.setHours(0, 0, 0, 0);
      return !max || d > max ? d : max;
    }, null);

    const fmt = (d) => (d ? d.toISOString().slice(0, 10) : "—");
    const estDays = ph.estimatedDays ?? ph.durationDays ?? ph.days ?? null;

    // ако assignment има проценти, користи ги; иначе прикажи "scheduled / estimate"
    const completion =
      typeof assignment.percentageComplete === "number"
        ? `${Math.round(assignment.percentageComplete)}%`
        : estDays
        ? `${list.reduce(
            (s, a) => s + Number(a.assignedDays || 0),
            0
          )}/${Number(estDays)}d scheduled`
        : "—";

    return {
      bank: bank?.name || "—",
      color: ph.color || bank?.color || "#2563eb",
      title: ph.title || ph.name || `Phase ${phaseId}`,
      description: ph.description || "",
      start: fmt(earliest),
      end: fmt(latest),
      est: estDays ? `${Number(estDays)}d` : "—",
      completion,
    };
  }

  // function onSelectAssignment(assignment){
  //   const data = computePhaseOverview(assignment, { phaseIndex, banksCatalog, assignmentsCache });
  //   setSelectedPhaseData(data);
  // }

  // Parent-side resolver. Safe even if assignment is incomplete or absent.
  function computePhaseOverviewFromPhase(phaseId, assignmentId) {
    // 1) Phase meta
    const ph = phaseIndex[String(phaseId)] || {};
    //debugger;
    // const bank = banksCatalog?.find?.(
    //   (b) => String(b.id) === String(ph.bankId)
    // );

    // 2) All chunks for this phase (can be empty)
    const chunks = assignmentsCache.get(Number(phaseId)) || [];

    // 3) Earliest start / latest end across all chunks (even if no clicked assignment)
    const earliest = chunks.reduce((min, a) => {
      const d = new Date(a.startDate);
      d.setHours(0, 0, 0, 0);
      return !min || d < min ? d : min;
    }, null);

    const latest = chunks.reduce((max, a) => {
      const d = new Date(a.startDate);
      d.setDate(d.getDate() + Math.max(0, Number(a.assignedDays || 0) - 1));
      d.setHours(0, 0, 0, 0);
      return !max || d > max ? d : max;
    }, null);

    // 4) Estimation + scheduled/remaining from phaseIndex + cache
    const estDays = ph.estimatedDays ?? ph.durationDays ?? ph.days ?? null;
    const scheduled = chunks.reduce(
      (s, a) => s + Number(a.assignedDays || 0),
      0
    );

    // 5) Completion:
    //    Prefer the clicked assignment’s percentage (if we can match it in tasks),
    //    else fall back to scheduled/estimated summary.
    let completion = "—";
    if (assignmentId != null) {
      const t = tasks.find(
        (t) => String(t.assignmentId) === String(assignmentId)
      );
      if (t && typeof t.percentageComplete === "number") {
        completion = `${Math.round(t.percentageComplete)}%`;
      }
    }
    if (completion === "—") {
      completion =
        estDays != null ? `${scheduled}/${Number(estDays)}d scheduled` : "—";
    }

    const fmt = (d) => (d ? d.toISOString().slice(0, 10) : "—");
    // 6) Build per-person splits from chunks
    const personById = new Map((people || []).map(p => [String(p.id), p.name]));
    const splits = chunks.map(a => {
      const s = new Date(a.startDate); s.setHours(0,0,0,0);
      const e = new Date(a.startDate);
      e.setDate(e.getDate() + Math.max(0, Number(a.assignedDays || 0) - 1));
      e.setHours(0,0,0,0);
      return {
        personId: Number(a.personId),
        personName: personById.get(String(a.personId)) || null,
        start: fmt(s),
        end: fmt(e),
        days: Number(a.assignedDays || 0),
      };
    }).sort((a,b)=> a.start===b.start
      ? String(a.personName||"").localeCompare(String(b.personName||""))
      : (a.start < b.start ? -1 : 1));

    return {
      bank: ph.bankName || "—",
      color: ph.color || bank?.color || "#2563eb",
      title: ph.title || ph.name || `Phase ${phaseId}`,
      description: ph.description || "",
      start: fmt(earliest),
      end: fmt(latest),
      est: estDays != null ? `${Number(estDays)}d` : "—",
      completion,
      splits,
    };
  }

  // This is the callback you pass to children (can be called with partial data)
  function onSelectAssignment({ phaseId, assignmentId }) {
    if (phaseId == null) return;
    const data = computePhaseOverviewFromPhase(phaseId, assignmentId);
    setSelectedPhaseData(data);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragCancel={() => {
          setDropPreview(null);
          setIsPhaseDrag(false);
        }}
        onDragEnd={onDragEnd}
      >
        <div
          className={`ng-shell ${
            cardStyle === "compact"
              ? "ng-style-compact"
              : cardStyle === "slim"
              ? "ng-style-slim"
              : cardStyle === "contrast"
              ? "ng-style-contrast"
              : cardStyle === "clarity"
              ? "ng-style-clarity"
              : ""
          }`}
        >
          <div className="ng-toolbar">
            <button className="ng-btn" onClick={() => setShowFooter((s) => !s)}>
              {showFooter ? "Hide footer" : "Show footer"}
            </button>
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
              onClick={refreshFromServer}
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

            <div className="ng-pill">
              <span className="ng-label">Style</span>
              <select
                className="ng-select"
                value={cardStyle}
                onChange={(e) => setCardStyle(e.target.value)}
              >
                <option value="standard">Standard</option>
                <option value="compact">Compact</option>
                <option value="slim">Slim</option>
                <option value="contrast">Contrast</option>
                <option value="clarity">Clarity</option>
              </select>
            </div>

            {/* === Bank & Project filters (using global catalogs) === */}
            <div className="ng-pill">
              <span className="ng-label">Bank</span>
              <select
                className="ng-select"
                value={selectedBankId ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedBankId(val === "" ? null : val);
                  setSelectedProjectId(null); // reset project when bank changes
                }}
              >
                <option value="">All</option>
                {banksCatalog.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="ng-pill">
              <span className="ng-label">Project</span>
              <select
                className="ng-select"
                value={selectedProjectId ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedProjectId(val === "" ? null : val);
                }}
                disabled={selectedBankId == null}
              >
                <option value="">All</option>
                {(projectsByBank[selectedBankId] || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
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
                  banks={banksCatalog}
                  projectsByBank={projectsByBank}
                  //onPhaseIndex={setPhaseIndex}
                  onPhaseIndex={handlePhaseIndex}
                  onVisibilityChange={onSidebarVisibility}
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
                      tasks={visibleAssignments}
                      colWidth={colW}
                      onDeleteAssignment={onDeleteAssignment}
                      onSelectAssignment={onSelectAssignment}
                      onRequestSplit={(assignment) =>
                        setSplitExisting({
                          assignmentId: assignment.id,
                          personId: assignment.personId,
                          startDate: assignment.start
                            .toISOString()
                            .slice(0, 10),
                          assignedDays: assignment.durationDays,
                          title: assignment.title,
                        })
                      }
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

          {splitExisting && (
            <div
              className="ng-splitPrompt"
              style={{
                left: (pointerRef.current?.x || 200) + 12,
                top: (pointerRef.current?.y || 120) + 12,
              }}
            >
              <div className="ng-splitPrompt__card">
                <div className="ng-splitPrompt__title">
                  Split “{splitExisting.title}”
                </div>
                <div className="ng-splitPrompt__row">
                  <label>Left segment days</label>
                  <input
                    type="number"
                    min={1}
                    max={splitExisting.assignedDays - 1}
                    value={splitExistingDays}
                    onChange={(e) =>
                      setSplitExistingDays(
                        Math.max(
                          1,
                          Math.min(
                            splitExisting.assignedDays - 1,
                            Number(e.target.value || 1)
                          )
                        )
                      )
                    }
                  />
                  <small>Total: {splitExisting.assignedDays}d</small>
                </div>
                <div className="ng-splitPrompt__row">
                  <label>Right segment → Person</label>
                  <select
                    value={splitExistingPersonId}
                    onChange={(e) => setSplitExistingPersonId(e.target.value)}
                  >
                    <option value="">Select person…</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ng-splitPrompt__row">
                  <button
                    className="primary"
                    disabled={!splitExistingPersonId}
                    onClick={applySplitExisting}
                  >
                    Split
                  </button>
                  <button onClick={() => setSplitExisting(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          <DragOverlay>{renderGhost()}</DragOverlay>
        </div>
      </DndContext>
      {showFooter && (
        <PlanningFooter
          period={{ from, to }}
          people={people}
          phaseIndex={phaseIndex}
          assignmentsCache={assignmentsCache}
          selectedPhaseData={selectedPhaseData}
          onCloseToast={() => setSelectedPhaseData(null)}
          onToggle={() => setShowFooter((s) => !s)}
          showToggle
        />
      )}
    </>
  );
}
