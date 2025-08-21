// frontend/plancraft-ui/src/lib/api.js
const BASE = (import.meta.env.VITE_API_BASE) || 'http://localhost:5058/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}/${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(()=> ''); 
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

export const apiGet = (path) => request(path);
export const apiPost = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });
export const apiPut = (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) });
export const apiDelete = (path) => request(path, { method: 'DELETE' });

export async function fetchGrid(from, to, scenarioId) {
  const url = `plan/grid?from=${from}&to=${to}` + (scenarioId? `&scenarioId=${scenarioId}` : '');
  return apiGet(url);
}
export async function fetchPeople(){ return apiGet('people'); }
export async function fetchProjects(){ return apiGet('projects'); }
export async function autobalance(from, to, targetLoad=0.85){
  return apiPost('plan/autobalance', { from, to, targetLoad });
}
export async function moveTask(payload){
  return apiPost('plan/move', payload);
}
export async function getScenarios(){ return apiGet('scenarios'); }
export async function createScenario(name){ return apiPost('scenarios', { name }); }
export async function compareScenario(sid){ return apiGet(`plan/compare?scenarioId=${sid}`); }
export async function forecast(projectId){ return apiGet(`plan/forecast?projectId=${projectId}`); }
export async function apiCreateTask(task){ return apiPost('tasks', task); }
export async function apiCreateAssignment(a){ return apiPost('assignments', a); }
export async function unscheduleTask(taskId){ return apiDelete(`tasks/${taskId}`); }
export async function unplanPhase(phaseId) { return apiDelete(`phases/${phaseId}/plan`);}

// NEW: add this
export const fetchBanks    = () => apiGet('banks');

export const createBank    = (b) => apiPost('banks', b);
export const createPerson  = (p) => apiPost('people', p);
export const createProject = (p) => apiPost('projects', p);
export const getPhases     = (projectId) => apiGet(`projects/${projectId}/phases`);
export const addPhase      = (projectId, phase) => apiPost(`projects/${projectId}/phases`, phase);
export const planPhase     = (phaseId, payload) => apiPost(`phases/${phaseId}/plan`, payload);
