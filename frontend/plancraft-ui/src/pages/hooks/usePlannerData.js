/**
 * usePlannerData (wired, minimal)
 * Moves only fetch/refresh/event-listener concerns out of Planner.jsx.
 * UI and state names remain unchanged.
 */
import { useCallback, useEffect } from 'react';
import {
  fetchGrid,
  fetchProjects,
  getScenarios,
} from '../../lib/api';

/**
 * @param {Object} deps
 * @param {{from: Date, to: Date}} deps.range
 * @param {string|null} deps.scenarioId
 * @param {(data: any)=>void} deps.setData
 * @param {(projects: any[])=>void} deps.setProjects
 * @param {(scenarios: any[])=>void} deps.setScenarios
 */
export default function usePlannerData({ range, scenarioId, setData, setProjects, setScenarios }) {
  // initial projects
  useEffect(() => {
    fetchProjects().then(setProjects).catch(console.error);
  }, [setProjects]);

  const refreshGrid = useCallback(() => {
    if (!range?.from || !range?.to) return;
    return fetchGrid(range.from.toISOString(), range.to.toISOString(), scenarioId)
      .then(setData)
      .catch(console.error);
  }, [range?.from, range?.to, scenarioId, setData]);

  const refreshScenarios = useCallback(() => {
    return getScenarios().then(setScenarios).catch(console.error);
  }, [setScenarios]);

  // react to range/scenario changes
  useEffect(() => { refreshGrid(); }, [refreshGrid]);
  useEffect(() => { refreshScenarios(); }, []);

  // global refresh event
  useEffect(() => {
    const f = () => { refreshGrid(); };
    window.addEventListener('plancraft:refresh', f);
    return () => window.removeEventListener('plancraft:refresh', f);
  }, [refreshGrid]);

  return { refreshGrid, refreshScenarios };
}
