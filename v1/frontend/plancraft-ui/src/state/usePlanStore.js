import { create } from 'zustand'

export const usePlan = create((set) => ({
  weeks: [], people: [], milestones: [], filters: { project: 'all' },
  whatIf: false,
  setData: (x) => set(x),
  setWhatIf: (v) => set({ whatIf: v })
}))
