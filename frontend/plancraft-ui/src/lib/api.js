// frontend/plancraft-ui/src/lib/api.js
// Full 1:1 coverage of Planning Grid server routes.

// NOTE: Expect ESM (Vite). You can override the base via VITE_API_BASE, e.g. "http://localhost:5058/api".
export const BASE = (import.meta?.env?.VITE_API_BASE) ?? 'http://localhost:5058/api';

/** Build a clean URL without breaking http(s):// */
function buildUrl(path) {
  const left  = String(BASE).replace(/\/+$/g, '');
  const right = String(path).replace(/^\/+/g, '');
  return `${left}/${right}`;
}

/** Core request helper */
async function request(path, options = {}) {
  const res = await fetch(buildUrl(path), {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

const asISO = (d) => (d instanceof Date ? d.toISOString() : d);

/** Shorthand HTTP helpers (do NOT prefix paths with a leading slash). */
export const apiGet    = (p, options)        => request(p, { method: 'GET', ...(options||{}) });
export const apiPost   = (p, body, options)  => request(p, { method: 'POST', body: JSON.stringify(body ?? {}), ...(options||{}) });
export const apiPut    = (p, body, options)  => request(p, { method: 'PUT',  body: JSON.stringify(body ?? {}), ...(options||{}) });
export const apiDelete = (p, options)        => request(p, { method: 'DELETE', ...(options||{}) });
export const apiPatch  = (p, body, options)   => request(p, { method: 'PATCH', body: JSON.stringify(body ?? {}), ...(options || {}) });


/* =========================== PLAN =========================== */

/** GET /plan/grid?from=...&to=...&scenarioId=opt */
export function fetchGrid(from, to, scenarioId) {
  const q = new URLSearchParams();
  if (from) q.set('from', asISO(from));
  if (to) q.set('to', asISO(to));
  if (scenarioId != null) q.set('scenarioId', String(scenarioId));
  return apiGet(`plan/grid?${q.toString()}`);
}

/** POST /plan/autobalance  { from, to, targetLoad } */
export function autobalance(from, to, targetLoad = 0.85) {
  return apiPost('plan/autobalance', { from: asISO(from), to: asISO(to), targetLoad });
}

/** POST /plan/move  { taskId, newStartDate?, newPrimaryPersonId?, newDurationDays?, copy } */
export function moveTask(payload) { return apiPost('plan/move', payload); }

/** GET /plan/compare?scenarioId=SID */
export function compareScenario(sid) { return apiGet(`plan/compare?scenarioId=${encodeURIComponent(sid)}`); }

/** GET /plan/forecast?projectId=PID&trials=opt */
export function forecast(projectId, trials) {
  const q = new URLSearchParams({ projectId: String(projectId) });
  if (trials != null) q.set('trials', String(trials));
  return apiGet(`plan/forecast?${q.toString()}`);
}

/* =========================== PEOPLE =========================== */

/* =========================== PEOPLE =========================== */
// NOTE: no leading slash; BASE already includes /api
export const fetchPeople  = () => apiGet('people');
export const addPerson    = (payload) => apiPost('people', payload);
export const updatePerson = (id, payload) => apiPut(`people/${id}`, payload);
export const deletePerson = (id) => apiDelete(`people/${id}`);



/* =========================== BANKS =========================== */

export const fetchBanks       = ()            => apiGet('banks');
export const listBanks        = ()            => fetchBanks();
export const createBank       = (b)           => apiPost('banks', b);
export const updateBank       = (id, b)       => apiPut(`banks/${id}`, b);
export const deleteBank       = (id)          => apiDelete(`banks/${id}`);

/* =========================== PROJECTS =========================== */

export const fetchProjects    = ()            => apiGet('projects');
export const createProject    = (p)           => apiPost('projects', p);
export const updateProject    = (id, p)       => apiPut(`projects/${id}`, p);
export const deleteProject    = (id)          => apiDelete(`projects/${id}`);

/* =========================== PROJECTS =========================== */
export const getProjects  = () => apiGet('projects');
export const listProjects = () => getProjects();

/* =========================== PHASES =========================== */

export const getPhases        = (projectId)   => apiGet(`projects/${projectId}/phases`);
export const addPhase         = (projectId, phase) => apiPost(`projects/${projectId}/phases`, phase);
export const updatePhase      = (id, phase)   => apiPut(`phases/${id}`, phase);
export const deletePhase      = (id)          => apiDelete(`phases/${id}`);

export const planPhase        = (phaseId, payload) => apiPost(`phases/${phaseId}/plan`, payload);
export const unplanPhase      = (phaseId)     => apiDelete(`phases/${phaseId}/plan`);

/* ===== Back-compat aliases (Phases) ===== */
/** Keep older naming used across UI without breaking new functions */
export const listPhases  = (projectId)        => getPhases(projectId);
export const createPhase = (projectId, phase) => addPhase(projectId, phase);
/* (updatePhase/deletePhase names already match and are exported above) */


/* ===================== PHASE ACCEPTANCE CRITERIA ===================== */
/** List criteria for a phase */
export const getPhaseCriteria      = (phaseId)                 => apiGet(`phases/${phaseId}/criteria`);
/** Create a new criterion */
export const addPhaseCriterion     = (phaseId, payload)        => apiPost(`phases/${phaseId}/criteria`, payload);
/** Update existing criterion */
export const updatePhaseCriterion  = (criterionId, payload)    => apiPut(`criteria/${criterionId}`, payload);
/** Delete criterion */
export const deletePhaseCriterion  = (criterionId)             => apiDelete(`criteria/${criterionId}`);
/** Reorder criteria in a phase */
export const reorderPhaseCriteria  = (phaseId, orderedIds)     => apiPost(`phases/${phaseId}/criteria/reorder`, { ids: orderedIds });
/** Set status of a single criterion (1 Pass, 2 Fail, 3 AcceptedWithNote) */
export const setPhaseCriterionStatus = (phaseId, criterionId, status, note) => apiPatch(`phases/${phaseId}/criteria/${criterionId}/status`, { status, note });
export const setCriterionStatusById = (criterionId, status, note) => apiPatch(`criteria/${criterionId}/status`, { status, note });



/* ===== Back-compat aliases (Criteria) ===== */
export const listCriteria     = (phaseId)              => getPhaseCriteria(phaseId);
export const createCriterion  = (phaseId, payload)     => addPhaseCriterion(phaseId, payload);
export const updateCriterion  = (criterionId, payload) => updatePhaseCriterion(criterionId, payload);
export const deleteCriterion  = (criterionId)          => deletePhaseCriterion(criterionId);
export const reorderCriteria  = (phaseId, ids)         => reorderPhaseCriteria(phaseId, ids);
export const setCriterionStatus = (criterionId, status, note) => setCriterionStatusById(criterionId, status, note);

/* =========================== TASKS =========================== */

export const fetchTasks       = ()            => apiGet('tasks');
export const apiCreateTask    = (task)        => apiPost('tasks', task);
export const updateTask       = (id, task)    => apiPut(`tasks/${id}`, task);
/** Alias pair for DELETE /tasks/{id} (keep both for compatibility) */
export const unscheduleTask   = (taskId)      => apiDelete(`tasks/${taskId}`);
export const deleteTask       = (taskId)      => apiDelete(`tasks/${taskId}`);

/* =========================== ASSIGNMENTS =========================== */
/* Phase-scoped assignment routes (aligned with server PhaseAssignmentRoutes) */
export const listPhaseAssignments    = (phaseId)                 => apiGet(`phases/${phaseId}/assignments`);
export const createPhaseAssignment   = (phaseId, a)             => apiPost(`phases/${phaseId}/assignments`, a);
export const updatePhaseAssignment   = (phaseId, id, a)         => apiPut(`phases/${phaseId}/assignments/${id}`, a);
export const deletePhaseAssignment   = (phaseId, id)            => apiDelete(`phases/${phaseId}/assignments/${id}`);


export const fetchAssignments = ()            => apiGet('assignments');
export const apiCreateAssignment = (a)        => apiPost('assignments', a);
export const updateAssignment = (id, a)       => apiPut(`assignments/${id}`, a);
export const deleteAssignment = (id)          => apiDelete(`assignments/${id}`);

/* =========================== DEPENDENCIES =========================== */

export const fetchDeps        = ()            => apiGet('deps');
export const createDep        = (dep)         => apiPost('deps', dep);
export const deleteDep        = (id)          => apiDelete(`deps/${id}`);

/* =========================== TIME OFF =========================== */

export const fetchTimeOff     = ()            => apiGet('timeoff');
export const createTimeOff    = (x)           => apiPost('timeoff', x);

/* =========================== HOLIDAYS =========================== */

export const fetchHolidays    = ()            => apiGet('holidays');
export const createHoliday    = (h)           => apiPost('holidays', h);

/* =========================== SCENARIOS =========================== */

export const getScenarios     = ()            => apiGet('scenarios');
export const createScenario   = (nameOrObj)   => typeof nameOrObj === 'string' ? apiPost('scenarios', { name: nameOrObj }) : apiPost('scenarios', nameOrObj);
export const addScenarioOverride   = (scenarioId, override) => apiPost(`scenarios/${scenarioId}/override`, override);
export const getScenarioOverrides  = (scenarioId)           => apiGet(`scenarios/${scenarioId}/overrides`);

/* =========================== UTILITIES =========================== */

/** Ping the API (useful in UI to check connectivity). */
export const ping = () => apiGet('plan/forecast?projectId=0&trials=1').catch(() => 'ok');

/** For advanced usage/testing */
export const _raw = { request, apiGet, apiPost, apiPut, apiDelete };

/* =========================== PROJECT DUPLICATION =========================== */

/**
 * Duplicate all phases from one project into another.
 * Calls POST /projects/{sourceProjectId}/duplicate/{targetProjectId}
 */
export const duplicateProjectPhases = (sourceProjectId, targetProjectId) => apiPost(`projects/${sourceProjectId}/duplicate/${targetProjectId}`);

// moze i vaka i taka
// export const duplicateProjectPhases = (sourceProjectId, targetProjectId) => {
//   return apiPost(`projects/${sourceProjectId}/duplicate/${targetProjectId}`);
// };

