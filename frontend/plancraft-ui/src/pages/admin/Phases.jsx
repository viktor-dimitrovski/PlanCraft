// src/pages/admin/Phases.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import '../../styles/admin-phases.css'
import {
  listPhases, createPhase, updatePhase, deletePhase,
  listCriteria, createCriterion, updateCriterion, deleteCriterion,
  reorderCriteria, setCriterionStatus,
  listProjects, listBanks,
} from '../../lib/api'

import PhaseGrid from './PhaseGrid.jsx'
import PhaseForm from './PhaseForm.jsx'
import CriteriaDrawer from './CriteriaDrawer.jsx'
import VerificationPage from './VerificationPage.jsx'

// ---------------- UI helpers (локални) ----------------
function ddmmyyyy(dateStrOrDate) {
  const d = (dateStrOrDate instanceof Date) ? dateStrOrDate : new Date(dateStrOrDate)
  if (Number.isNaN(+d)) return ''
  const dd = `${d.getDate()}`.padStart(2, '0')
  const mm = `${d.getMonth() + 1}`.padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}
function calcPercentComplete(criteria) {
  const required = (criteria || []).filter(c => c.isRequired)
  if (!required.length) return 0
  const ok = required.filter(c => c.status === 1 || c.status === 3 || c.status === 4).length
  return Math.round((ok / required.length) * 100)
}
// ------------------------------------------------------

// Lightweight, accessible combobox with built-in search
function Combo({ items, value, onChange, placeholder = 'Select…', width = 220, disabled, ariaLabel }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)

  const selected = useMemo(
    () => items.find(it => String(it.value) === String(value)) || null,
    [items, value]
  )
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    if (!qq) return items
    return items.filter(it => (it.label || '').toLowerCase().includes(qq))
  }, [items, q])

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className="ap-combo" ref={ref} style={{ width }}>
      <button
        type="button"
        className="ap-combo__btn"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        onClick={() => setOpen(o => !o)}
      >
        <span className={`ap-combo__value ${selected ? '' : 'is-placeholder'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="ap-combo__chev" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="ap-combo__pop" role="listbox">
          <div className="ap-combo__searchWrap">
            <input
              className="ap-combo__search"
              placeholder="Search…"
              value={q}
              onChange={e => setQ(e.target.value)}
              autoFocus
            />
            {q && (
              <button className="ap-combo__clear" onClick={() => setQ('')} aria-label="Clear">
                ×
              </button>
            )}
          </div>

          <div className="ap-combo__list">
            {filtered.length === 0 && <div className="ap-combo__empty">No matches</div>}
            {filtered.map(it => {
              const isSel = String(it.value) === String(value)
              return (
                <div
                  key={it.value}
                  className={`ap-combo__opt ${isSel ? 'is-selected' : ''}`}
                  role="option"
                  aria-selected={isSel}
                  onClick={() => { onChange(it.value); setOpen(false); setQ('') }}
                >
                  <div className="ap-combo__optLabel">{it.label}</div>
                  {isSel && <span className="ap-combo__tick">✓</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminPhases() {
  // Filters
  const [bankId, setBankId] = useState(null);
  const [banks, setBanks] = useState([]);

  const [projectId, setProjectId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState("");

  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editPhase, setEditPhase] = useState(null);

  // Drawer за acceptance criteria
  const [drawerPhase, setDrawerPhase] = useState(null);
  const [criteria, setCriteria] = useState([]);

  // Verification view (само тестирање)
  const [view, setView] = useState("grid"); // 'grid' | 'verify'
  const [verifyPhase, setVerifyPhase] = useState(null);
  const [verifyCriteria, setVerifyCriteria] = useState([]);

  // 1) Load banks + projects (once)
  useEffect(() => {
    (async () => {
      try {
        setProjectsLoading(true);
        let bs = [];
        try {
          bs = await listBanks();
        } catch {
          bs = [];
        }
        setBanks(Array.isArray(bs) ? bs : []);

        const ps = await listProjects();
        const arr = Array.isArray(ps) ? ps : [];
        setProjects(arr);

        // Defaults
        let initialBankId = bs?.[0]?.id ?? arr?.[0]?.bankId ?? null;
        if (initialBankId == null && bs?.length) initialBankId = bs[0].id;
        setBankId(initialBankId ?? null);

        const firstProj = arr.find((p) =>
          initialBankId ? p.bankId === initialBankId : true
        );
        if (firstProj) setProjectId(firstProj.id);
      } catch (e) {
        setProjectsError(e.message || "Failed to load projects/banks");
      } finally {
        setProjectsLoading(false);
      }
    })();
  }, []);

  // 2) When bank changes, pick first project from that bank
  useEffect(() => {
    if (!bankId) return;
    const first = projects.find((p) => p.bankId === bankId);
    if (first) setProjectId(first.id);
  }, [bankId, projects]);

  // 3) Load phases for selected project
  useEffect(() => {
    if (projectId) load();
  }, [projectId]);

  async function load() {
    try {
      setLoading(true);
      const data = await listPhases(projectId);
      setPhases(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load phases");
    } finally {
      setLoading(false);
    }
  }

  async function onCreateOrUpdate(p) {
    try {
      if (p.id) await updatePhase(p.id, p);
      else await createPhase(projectId, p);
      await load();
      setEditPhase(null);
    } catch (e) {
      alert(e.message);
    }
  }

  async function onDelete(phase) {
    if (!window.confirm(`Delete phase "${phase.title}"?`)) return;
    try {
      await deletePhase(phase.id);
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function openDrawer(phase) {
    setDrawerPhase(phase);
    const list = await listCriteria(phase.id);
    setCriteria(Array.isArray(list) ? list : []);
  }

  async function startVerification(phase) {
    const list = await listCriteria(phase.id);
    setVerifyPhase(phase);
    setVerifyCriteria(Array.isArray(list) ? list : []);
    setView("verify");
  }

  // Phases.jsx (parent)
  async function updateCriterionStatus(phaseId, criterionId, status, note) {
    if (!phaseId)
      phaseId = verifyPhase?.id ?? drawerPhase?.id;
    if (!phaseId) return; // nothing to do

    await setCriterionStatus(criterionId, status, note);

    // refresh side panels if they’re showing this phase
    if (drawerPhase?.id === phaseId) {
      const list = await listCriteria(phaseId);
      setCriteria(Array.isArray(list) ? list : []);
    }
    if (verifyPhase?.id === phaseId) {
      const list = await listCriteria(phaseId);
      setVerifyCriteria(Array.isArray(list) ? list : []);
    }

    await load();
  }

  const sortedPhases = useMemo(() => {
    const arr = [...phases];
    arr.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    return arr.map((p) => ({
      ...p,
      uiTitle: `bank:${p.title || ""}`,
      uiStart: p.startDate ? ddmmyyyy(p.startDate) : "",
    }));
  }, [phases]);


  // Projects filtered by bank (search is inside Combo)
  const visibleProjects = useMemo(() => {
    return (projects || []).filter((p) =>
      bankId ? p.bankId === bankId : true
    );
  }, [projects, bankId]);

  const currentBank = banks.find((b) => b.id === bankId);
  const currentProject = projects.find((p) => p.id === projectId);

  if (view === "verify" && verifyPhase) {
    return (
      <VerificationPage
        phase={verifyPhase}
        criteria={verifyCriteria}
        onBack={() => setView("grid")}
        onUpdateStatus={updateCriterionStatus}
      />
    );
  }

  return (
    <section className="adminCard">
      <header className="adminCard__head">
        <div>
          <h3 className="adminCard__title">Administration · Phases</h3>
          <p className="adminCard__sub">Create and manage Phases, Use-Cases, Verify, Track Phase Progress</p>
        </div>

        <div
          className="ap-actions"
          style={{ gap: 10, display: "flex", alignItems: "center" }}
        >
          {projectsLoading ? (
            <span className="ap-meta">Loading…</span>
          ) : projectsError ? (
            <span className="ap-error">{projectsError}</span>
          ) : (
            <>
              {/* BANK combobox */}
              <Combo
                ariaLabel="Select bank"
                placeholder="Select bank…"
                width={240}
                items={(banks || []).map((b) => ({
                  value: b.id,
                  label: b.title || b.name || `Bank ${b.id}`,
                }))}
                value={bankId ?? ""}
                onChange={(val) => setBankId(val ? Number(val) : null)}
              />

              {/* PROJECT combobox */}
              <Combo
                ariaLabel="Select project"
                placeholder="Select project…"
                width={280}
                items={visibleProjects.map((p) => ({
                  value: p.id,
                  label: p.title || p.name || `Project ${p.id}`,
                }))}
                value={projectId || ""}
                onChange={(val) => setProjectId(Number(val))}
              />
            </>
          )}

          <button
            className="ap-btn"
            onClick={() => setEditPhase({})}
            disabled={!projectId}
            title="Add phase to selected project"
          >
            + Add Phase
          </button>
        </div>

        {/* <div className="adminCard__meta">{loading ? 'Loading…' : `xy total`}</div> */}
      </header>





      <PhaseGrid
        loading={loading}
        error={error}
        rows={sortedPhases}
        onEdit={(p) => setEditPhase(p)}
        onDelete={onDelete}
        onOpenCriteria={openDrawer}
        onStartVerification={startVerification}
      />

      {editPhase && (
        <PhaseForm
          phase={editPhase}
          phases={sortedPhases}
          onCancel={() => setEditPhase(null)}
          onSubmit={onCreateOrUpdate}
          contextBank={currentBank?.title || currentBank?.name}
          contextProject={currentProject?.title || currentProject?.name}
        />
      )}

      {drawerPhase && (
        <CriteriaDrawer
          phase={drawerPhase}
          items={criteria}
          onClose={() => setDrawerPhase(null)}
          onAdd={async (payload) => {
            await createCriterion(drawerPhase.id, payload);
            const list = await listCriteria(drawerPhase.id);
            setCriteria(Array.isArray(list) ? list : []);
            await load();
          }}
          onUpdate={async (id, payload) => {
            await updateCriterion(id, payload);
            const list = await listCriteria(drawerPhase.id);
            setCriteria(Array.isArray(list) ? list : []);
            await load();
          }}
          onDelete={async (id) => {
            await deleteCriterion(id);
            const list = await listCriteria(drawerPhase.id);
            setCriteria(Array.isArray(list) ? list : []);
            await load();
          }}
          onReorder={async (orderedIds) => {
            await reorderCriteria(drawerPhase.id, orderedIds);
            const list = await listCriteria(drawerPhase.id);
            setCriteria(Array.isArray(list) ? list : []);
            await load();
          }}
          onToggleStatus={updateCriterionStatus}
        />
      )}
    </section>
  );
}
