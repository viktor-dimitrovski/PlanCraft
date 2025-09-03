import { create } from 'zustand'

export const usePlan = create((set) => ({
  weeks: [], people: [], milestones: [], filters: { project: 'all' },
  whatIf: false,
  scenarioId: null,
  setData: (x) => set(x),
  setWhatIf: (v) => set({ whatIf: v }),
  setScenario: (sid) => set({ scenarioId: sid })
}))

// usePlanStore.js (additions only)
import { nanoid } from 'nanoid';

export const usePlanStore = create((set, get) => ({
  // ...existing state & actions

  splitPhaseAssignment: ({ assignmentId, mode, payload }) => {
    // mode: 'time' | 'percent'
    // payload for 'time': { splitAfterDays: number, personIdRight: string }
    // payload for 'percent': { leftPercent: number, personIdRight: string }

    const { phaseAssignments } = get();
    const idx = phaseAssignments.findIndex(a => a.Id === assignmentId);
    if (idx < 0) return;

    const original = phaseAssignments[idx];

    // helper: compute dates
    const addDays = (d, n) => {
      const x = new Date(d);
      x.setDate(x.getDate() + n);
      return x.toISOString().slice(0,10);
    };

    let updated = [...phaseAssignments];

    // Ensure parent grouping
    const parentId = original.ParentAssignmentId || original.Id;

    if (mode === 'time') {
      const { splitAfterDays, personIdRight } = payload;

      if (splitAfterDays <= 0 || splitAfterDays >= original.AssignedDays) {
        // invalid split — ignore or throw
        return;
      }

      // Left segment: keep original person, shrink duration
      const leftDays = splitAfterDays;
      const rightDays = original.AssignedDays - splitAfterDays;

      const left = {
        ...original,
        AssignedDays: leftDays,
        // End date recomputed if you keep both StartDate + AssignedDays
        ParentAssignmentId: parentId,
      };

      // Right segment: new person, starts the next day
      const right = {
        ...original,
        Id: nanoid(),
        PersonId: personIdRight,
        StartDate: addDays(original.StartDate, leftDays), // contiguous
        AssignedDays: rightDays,
        ParentAssignmentId: parentId,
      };

      updated.splice(idx, 1, left);
      updated.push(right);
    }

    if (mode === 'percent') {
      const { leftPercent, personIdRight } = payload;
      const pct = Math.max(0, Math.min(100, leftPercent));
      if (pct === 0 || pct === 100) return;

      // If you store absolute days, split by rounding rules
      const leftDays = Math.round((original.AssignedDays * pct) / 100);
      const rightDays = Math.max(0, original.AssignedDays - leftDays);

      // Keep the same date range for both
      const left = {
        ...original,
        AssignedDays: leftDays,
        ParentAssignmentId: parentId,
      };

      const right = {
        ...original,
        Id: nanoid(),
        PersonId: personIdRight,
        StartDate: original.StartDate,
        AssignedDays: rightDays,
        ParentAssignmentId: parentId,
      };

      updated.splice(idx, 1, left);
      updated.push(right);
    }

    set({ phaseAssignments: updated });
  },
}));
