// frontend/plancraft-ui/src/lib/api.js
// Full 1:1 coverage of Planning Grid server routes.

// NOTE: Expect ESM (Vite). You can override the base via VITE_API_BASE, e.g. "http://localhost:5058/api".
// export const BASE = (import.meta?.env?.VITE_API_BASE) ?? 'http://localhost:5058/api';
// Always take from env
export const BASE = import.meta.env.VITE_API_BASE;

/** Build a clean URL without breaking http(s):// */
function buildUrl(path) {
  const left  = String(BASE).replace(/\/+$/g, '');
  const right = String(path).replace(/^\/+/g, '');
  return `${left}/${right}`;
}


/* =========================== AUTH (JWT) =========================== */
/**
 * Centralized JWT auth for all API calls.
 * - Stores token in memory + localStorage
 * - Adds Authorization header automatically
 * - Exposes login/logout/whoami and a tiny subscribe mechanism
 */
const TOKEN_KEY = (import.meta.env.VITE_AUTH_TOKEN_KEY || 'hp.jwt').trim();
const TOKEN_EXP_KEY = TOKEN_KEY + '.exp';
const SKEW_SECONDS = 30; // refresh margin

let _token = null;
let _expUtc = null;
try {
  const t = localStorage.getItem(TOKEN_KEY);
  const e = localStorage.getItem(TOKEN_EXP_KEY);
  _token = t || null;
  _expUtc = e ? new Date(e) : null;
} catch {}

function _nowUtc() { return new Date(); }
function _isExpired() {
  if (!_token || !_expUtc) return true;
  return (_expUtc.getTime() - SKEW_SECONDS * 1000) <= _nowUtc().getTime();
}

function _decodeJwtExp(jwt) {
  try {
    const [, payload] = jwt.split('.');
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (json && typeof json.exp === 'number') {
      return new Date(json.exp * 1000);
    }
  } catch {}
  return null;
}

function setAuthToken(token, expiresAtUtc) {
  _token = token || null;
  _expUtc = null;
  if (_token) {
    _expUtc = expiresAtUtc ? new Date(expiresAtUtc) : _decodeJwtExp(_token);
  }
  try {
    if (_token) {
      localStorage.setItem(TOKEN_KEY, _token);
      if (_expUtc) localStorage.setItem(TOKEN_EXP_KEY, _expUtc.toISOString());
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXP_KEY);
    }
  } catch {}
  _emitAuthChange();
}

function getAuthToken() {
  if (_isExpired()) return null;
  return _token;
}

function clearAuth() { setAuthToken(null, null); }

const _listeners = new Set();
function onAuthChange(cb) { _listeners.add(cb); return () => _listeners.delete(cb); }
function _emitAuthChange() { for (const cb of _listeners) { try { cb({ token: _token, exp: _expUtc }); } catch {} } }

/** Minimal login against /auth/login returning { token, expiresAtUtc } */
async function login(username, password) {
  const res = await fetch(buildUrl('auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const text = await res.text().catch(()=>''); 
    throw new Error(`Login failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  setAuthToken(data.token, data.expiresAtUtc);
  return data;
}

/** Optional helper to inspect current principal (requires auth) */
async function whoAmI() {
  return request('auth/whoami', { method: 'GET' });
}

export const auth = {
  login, logout: clearAuth, whoAmI,
  getToken: getAuthToken, setToken: setAuthToken,
  onChange: onAuthChange
};


/** Core request helper */
async function request(path, options = {}) {
  const token = getAuthToken();
  const baseHeaders = { 'Content-Type': 'application/json' };
  const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {};
  const mergedHeaders = { ...baseHeaders, ...authHeader, ...(options.headers || {}) };

  const res = await fetch(buildUrl(path), {
    ...options,
    headers: mergedHeaders,
  });

  if (res.status === 401) {
    // Token invalid/expired; clear and notify listeners
    clearAuth();
  }

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
// export function fetchGrid(from, to, scenarioId) {
//   const q = new URLSearchParams();
//   if (from) q.set('from', asISO(from));
//   if (to)   q.set('to',   asISO(to));
//   if (scenarioId != null) q.set('scenarioId', String(scenarioId));
//   return apiGet(`plan/grid?${q.toString()}`);
//}

export function fetchGridPhases(from, to, scenarioId) {
  const q = new URLSearchParams();
  const asDateOnly = d => (d instanceof Date ? d.toISOString().slice(0,10) : d);
  if (from) q.set('from', asDateOnly(from));
  if (to)   q.set('to',   asDateOnly(to));
  if (scenarioId != null) q.set('scenarioId', String(scenarioId));
  return apiGet(`plan/grid-phases?${q.toString()}`);
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

/* =========================== GRID (single-call nested) =========================== */
/** GET /plan/grid?from=...&to=...&scenarioId=opt
 * Returns: [ { id,name,color, projects:[{ id,name, phases:[{ id,title,estimatedDays,color, assignments:[{id,personId,startDate,assignedDays}] }]}] } ]
 */

