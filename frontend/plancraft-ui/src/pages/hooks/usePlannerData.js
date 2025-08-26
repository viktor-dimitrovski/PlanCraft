
/**
 * usePlannerData — minimal, defensive hook for NewGrid wiring
 * - Attempts to load grid data for a date range via lib/api.fetchGrid(from, to, scenarioId?)
 * - Maps it to { people: [{id,name,color?}], tasks: [{id,personId,start,durationDays,title,color}] }
 * - Fallbacks: if API fails or data is empty, leaves arrays empty (NewGrid will use demo).
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { fetchGrid } from '../../lib/api';

// crude ISO -> Date
const toDate = (v) => {
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') {
    // accept 'YYYY-MM-DD' or full ISO
    const d = new Date(v);
    if (!isNaN(d)) return d;
  }
  return null;
};

// Try multiple shapes to extract arrays
function normalizeGrid(result) {
  if (!result || typeof result !== 'object') return { people: [], tasks: [] };

  const people =
    result.people ||
    result.persons ||
    result.resources ||
    [];

  // common assignment collections
  const collections = [
    result.tasks, result.items, result.assignments, result.cards, result.phases,
  ].filter(Boolean);

  // pick first non-empty; else []
  const rawTasks = collections.find(a => Array.isArray(a) && a.length) || [];

  // map tasks
  const tasks = rawTasks.map((t, idx) => {
    const id = String(t.id ?? t.taskId ?? t.cardId ?? `T${idx+1}`);
    const personId = String(
      t.personId ?? t.assigneeId ?? t.resourceId ?? t.ownerId ?? t.person?.id ?? 'P1'
    );
    const start =
      toDate(t.startDate) || toDate(t.start) || toDate(t.begin) || new Date();

    const durationDays = Number(
      t.durationDays ?? t.duration ?? t.days ?? 1
    ) || 1;

    const title = t.title ?? t.name ?? t.summary ?? 'Untitled';
    const color = t.color ?? t.colour ?? t.hex ?? undefined;

    return { id, personId, start, durationDays, title, color };
  });

  // If no explicit people, derive unique set from tasks
  const peopleOut = Array.isArray(people) && people.length
    ? people.map(p => ({ id: String(p.id ?? p.personId ?? p.key ?? p.code ?? 'P?'), name: p.name ?? p.title ?? `Person ${p.id ?? '?'}`, color: p.color }))
    : Array.from(new Set(tasks.map(t => t.personId))).map((pid, i) => ({ id: String(pid), name: `Person ${pid}` }));

  return { people: peopleOut, tasks };
}

export default function usePlannerData({ range, scenarioId = null }) {
  const [state, setState] = useState({ people: [], tasks: [] });
  const [error, setError] = useState(null);
  const from = range?.from ?? null;
  const to = range?.to ?? null;

  const refreshGrid = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchGrid?.(from, to, scenarioId);
      const normalized = normalizeGrid(res);
      setState(normalized);
    } catch (e) {
      // Silent fallback — NewGrid will show demo data
      setError(e);
      setState({ people: [], tasks: [] });
    }
  }, [from, to, scenarioId]);

  // refresh on deps change
  useEffect(() => { if (from && to) refreshGrid(); }, [refreshGrid]);

  return {
    people: state.people,
    tasks: state.tasks,
    error,
    refreshGrid,
  };
}
