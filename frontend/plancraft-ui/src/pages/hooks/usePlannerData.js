// usePlannerData.js
import { useState, useEffect } from "react";
import { fetchGridPhases } from "../../lib/api";

/**
 * Normalize server response (banks → projects → phases → assignments)
 * into { people, tasks, weeks }
 */
function normalizeGrid(grid, from, to) {
  const banks = Array.isArray(grid) ? grid : grid?.banks || [];
  const people = grid?.people || [];
  const tasks = [];

  for (const b of banks) {
    for (const p of b.projects || []) {
      for (const ph of p.phases || []) {
        for (const a of ph.assignments || []) {
          tasks.push({
            id: String(a.id),
            assignmentId: a.id,
            phaseId: ph.id,
            projectId: p.id,
            bankId: b.id,
            personId: a.personId,
            startDate: a.startDate,
            assignedDays: a.assignedDays,
            // for display
            title: ph.title || `Phase ${ph.id}`,
            color: b.color || ph.color || "#2563eb",
          });
        }
      }
    }
  }

  return { people, tasks, weeks: buildWeeks(from, to) };
}

/**
 * Utility: build week ranges between from..to
 */
function buildWeeks(from, to) {
  const weeks = [];
  const start = new Date(from);
  let idx = 0;
  while (start < to) {
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    weeks.push({ start: new Date(start), end, index: idx++ });
    start.setDate(start.getDate() + 7);
  }
  return weeks;
}

export default function usePlannerData(from, to, scenarioId) {
  const [people, setPeople] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const grid = await fetchGridPhases(from, to, scenarioId);
        if (cancelled) return;
        const { people, tasks, weeks } = normalizeGrid(grid, from, to);
        setPeople(people);
        setTasks(tasks);
        setWeeks(weeks);
      } catch (e) {
        console.error("usePlannerData fetch failed", e);
        if (!cancelled) {
          setPeople([]);
          setTasks([]);
          setWeeks(buildWeeks(from, to));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to, scenarioId]);

  return { people, tasks, weeks, loading };
}
