import { create } from 'zustand'

export const usePlan = create((set) => ({
  weeks: [], people: [], milestones: [], filters: { project: 'all' },
  whatIf: false,
  scenarioId: null,
  setData: (x) => set(x),
  setWhatIf: (v) => set({ whatIf: v }),
  setScenario: (sid) => set({ scenarioId: sid })
}))
