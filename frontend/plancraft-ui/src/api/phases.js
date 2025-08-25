// src/api/phases.js
// Lightweight fetch helpers. Adjust BASE if your API is on a different path.
import { BASE } from '../lib/api.js'

async function http(method, url, data) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${url} => ${res.status}`)
  if (res.status === 204) return null
  return await res.json()
}

// PHASES
export const listPhases = (projectId) => http('GET', `${BASE}/projects/${projectId}/phases`)
export const createPhase = (projectId, payload) => http('POST', `${BASE}/projects/${projectId}/phases`, payload)
export const updatePhase = (phaseId, payload) => http('PUT', `${BASE}/phases/${phaseId}`, payload)
export const deletePhase = (phaseId) => http('DELETE', `${BASE}/phases/${phaseId}`)

// ACCEPTANCE CRITERIA (note: you already have GET api/phases/{phaseId}/criteria on backend)
export const listCriteria = (phaseId) => http('GET', `${BASE}/phases/${phaseId}/criteria`)
export const createCriterion = (phaseId, payload) => http('POST', `${BASE}/phases/${phaseId}/criteria`, payload)
export const updateCriterion = (criterionId, payload) => http('PUT', `${BASE}/criteria/${criterionId}`, payload)
export const deleteCriterion = (criterionId) => http('DELETE', `${BASE}/criteria/${criterionId}`)
export const reorderCriteria = (phaseId, orderedIds) =>
  http('POST', `${BASE}/phases/${phaseId}/criteria/reorder`, { ids: orderedIds })

// Update single criterion status (Pass=1, Fail=2, AcceptedWithNote=3)
export const setCriterionStatus = (criterionId, status, note) =>
  http('POST', `${BASE}/criteria/${criterionId}/status`, { status, note })

// Utilities
export function ddmmyyyy(dateStrOrDate) {
  const d = (dateStrOrDate instanceof Date) ? dateStrOrDate : new Date(dateStrOrDate)
  const dd = `${d.getDate()}`.padStart(2, '0')
  const mm = `${d.getMonth() + 1}`.padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

// Compute % based on required criteria
// required=IsRequired===true; success if status in {1 (Pass), 4 (AcceptedWithNotes)} or {1,3}? 
// Your text says 1 or 4; using 1 or 4:
export function calcPercentComplete(criteria) {
  const required = criteria.filter(c => c.isRequired)
  if (!required.length) return 0
  const ok = required.filter(c => c.status === 1 || c.status === 4).length
  return Math.round((ok / required.length) * 100)
}
