const BASE = 'http://localhost:5058/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}/${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(()=>''); 
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

export const apiGet = (path) => request(path);
export const apiPost = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });
export const apiPut = (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) });
export const apiDelete = (path) => request(path, { method: 'DELETE' });

export async function fetchGrid(from, to) {
  const url = `plan/grid?from=${from}&to=${to}`;
  return apiGet(url);
}
export async function fetchPeople(){ return apiGet('people'); }
export async function fetchProjects(){ return apiGet('projects'); }
export async function autobalance(from, to, targetLoad=0.85){
  return apiPost('plan/autobalance', { from, to, targetLoad });
}
export async function moveTask(taskId, newStartDate, newPrimaryPersonId){
  return apiPost('plan/move', { taskId, newStartDate, newPrimaryPersonId });
}
export async function backlogSuggestions(personId, from, to){
  return apiGet(`suggestions/backlog?personId=${personId}&from=${from}&to=${to}`);
}
