import React, { useEffect, useMemo, useState, useCallback } from 'react'
import '../styles/admin.css'

import {
  fetchBanks, createBank, updateBank, deleteBank,
  fetchProjects, createProject, updateProject, deleteProject,
  getPhases, addPhase, updatePhase, deletePhase,
  fetchTasks, apiCreateTask, updateTask, deleteTask
} from '../lib/api'

/* ---------- helpers ---------- */

const iso = (d) => {
  try {
    if (!d) return null
    const dt = new Date(d)
    if (isNaN(+dt)) return null
    return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())).toISOString()
  } catch { return null }
}

function useAsync(fn, deps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const run = useCallback(async (...args) => {
    setLoading(true); setError(null)
    try { return await fn(...args) }
    catch (e) { setError(e); throw e }
    finally { setLoading(false) }
  }, deps) // eslint-disable-line
  return [run, loading, error]
}

/* =========================================================
   Banks
   ========================================================= */

function BanksManager({ onChange }) {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ name: '', color: '' })
  const [editId, setEditId] = useState(null)
  const [edit, setEdit] = useState({})

  const [load, loading] = useAsync(async () => {
    const data = await fetchBanks()
    setRows(data || [])
  }, [setRows])

  useEffect(() => { load() }, [load])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { alert('Name is required'); return }
    await createBank({ name: form.name.trim(), color: form.color || null })
    setForm({ name: '', color: '' })
    await load(); onChange?.()
  }
  const startEdit = (b) => { setEditId(b.id); setEdit({ name: b.name, color: b.color || '' }) }
  const save = async (id) => {
    if (!edit.name.trim()) { alert('Name is required'); return }
    await updateBank(id, { name: edit.name.trim(), color: edit.color || null })
    setEditId(null); setEdit({})
    await load(); onChange?.()
  }
  const remove = async (id) => {
    if (!confirm('Delete this bank?')) return
    await deleteBank(id)
    await load(); onChange?.()
  }

  return (
    <section className="adminCard">
      <header className="adminCard__head">
        <div>
          <h3 className="adminCard__title">Banks</h3>
          <p className="adminCard__sub">Create and manage banks and their brand color.</p>
        </div>
        <div className="adminCard__meta">{loading ? 'Loading…' : `${rows.length} total`}</div>
      </header>

      <form className="formRow" onSubmit={submit}>
        <label className="sr-only" htmlFor="bankName">Bank name</label>
        <input id="bankName" placeholder="Bank name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
        <label className="sr-only" htmlFor="bankColor">Color</label>
        <input id="bankColor" placeholder="Color (optional)" value={form.color} onChange={e=>setForm({...form, color:e.target.value})} />
        <button className="btn btn--primary" type="submit">Add</button>
      </form>

      <div className="tableWrap">
        <table className="adminTable">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Color</th><th className="ta-right">Actions</th></tr>
          </thead>
          <tbody>
            {rows.map(b => (
              <tr key={b.id}>
                <td>{b.id}</td>
                <td>
                  {editId===b.id
                    ? <input value={edit.name} onChange={e=>setEdit({...edit, name:e.target.value})} />
                    : b.name}
                </td>
                <td className="bankColorCell">
                  {editId===b.id
                    ? <input value={edit.color} onChange={e=>setEdit({...edit, color:e.target.value})} />
                    : <>
                        <span className="colorDot" style={{ background:b.color || '#e2e8f0' }} />
                        {b.color || <span className="muted">—</span>}
                      </>}
                </td>
                <td className="rowActions">
                  {editId===b.id
                    ? (<>
                        <button className="btn btn--primary" onClick={()=>save(b.id)}>Save</button>
                        <button className="btn" onClick={()=>{setEditId(null); setEdit({})}}>Cancel</button>
                      </>)
                    : (<>
                        <button className="btn" onClick={()=>startEdit(b)}>Edit</button>
                        <button className="btn btn--danger" onClick={()=>remove(b.id)}>Delete</button>
                      </>)
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* =========================================================
   Projects
   ========================================================= */

function ProjectsManager({ banks, onChange }) {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ name: '', bankId: '' })
  const [editId, setEditId] = useState(null)
  const [edit, setEdit] = useState({})

  const [load, loading] = useAsync(async () => {
    const data = await fetchProjects()
    setRows(data || [])
  }, [setRows])

  useEffect(() => { load() }, [load])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { alert('Name is required'); return }
    const bankId = parseInt(form.bankId,10)
    if (!Number.isFinite(bankId)) { alert('Select a bank'); return }
    await createProject({ name: form.name.trim(), bankId })
    setForm({ name:'', bankId:'' })
    await load(); onChange?.()
  }
  const startEdit = (row) => { setEditId(row.id); setEdit({ name: row.name, bankId: row.bankId }) }
  const save = async (id) => {
    if (!edit.name.trim()) { alert('Name is required'); return }
    const bankId = parseInt(edit.bankId,10)
    if (!Number.isFinite(bankId)) { alert('Select a bank'); return }
    await updateProject(id, { name: edit.name.trim(), bankId })
    setEditId(null); setEdit({})
    await load(); onChange?.()
  }
  const remove = async (id) => {
    if (!confirm('Delete this project?')) return
    await deleteProject(id)
    await load(); onChange?.()
  }

  return (
    <section className="adminCard">
      <header className="adminCard__head">
        <div>
          <h3 className="adminCard__title">Projects</h3>
          <p className="adminCard__sub">Link projects to banks and manage the portfolio.</p>
        </div>
        <div className="adminCard__meta">{loading ? 'Loading…' : `${rows.length} total`}</div>
      </header>

      <form className="formRow" onSubmit={submit}>
        <label className="sr-only" htmlFor="projectName">Project name</label>
        <input id="projectName" placeholder="Project name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
        <label className="sr-only" htmlFor="projectBank">Bank</label>
        <select id="projectBank" value={form.bankId} onChange={e=>setForm({...form, bankId:e.target.value})}>
          <option value="">Bank…</option>
          {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button className="btn btn--primary" type="submit">Add</button>
      </form>

      <div className="tableWrap">
        <table className="adminTable">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Bank</th><th className="ta-right">Actions</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>
                  {editId===r.id
                    ? <input value={edit.name} onChange={e=>setEdit({...edit, name:e.target.value})} />
                    : r.name}
                </td>
                <td>
                  {editId===r.id
                    ? (
                      <select value={edit.bankId} onChange={e=>setEdit({...edit, bankId:e.target.value})}>
                        <option value="">Bank…</option>
                        {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    )
                    : (banks.find(b=>b.id===r.bankId)?.name || r.bankId)}
                </td>
                <td className="rowActions">
                  {editId===r.id
                    ? (<>
                        <button className="btn btn--primary" onClick={()=>save(r.id)}>Save</button>
                        <button className="btn" onClick={()=>{setEditId(null); setEdit({})}}>Cancel</button>
                      </>)
                    : (<>
                        <button className="btn" onClick={()=>startEdit(r)}>Edit</button>
                        <button className="btn btn--danger" onClick={()=>remove(r.id)}>Delete</button>
                      </>)
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* =========================================================
   Phases  (Bank → Project → Add)
   ========================================================= */

function PhasesManager({ banks, projects, onChange }) {
  const [rowsByProject, setRowsByProject] = useState({})
  const [selectedBank, setSelectedBank] = useState('')
  const [selectedProject, setSelectedProject] = useState('')

  const projectsByBank = useMemo(
    () => (bankId) => (projects || []).filter(p => p.bankId === bankId),
    [projects]
  )

  useEffect(() => {
    // default: first bank that has projects
    if (!selectedBank && banks.length) {
      const bankWithProj = banks.find(b => projects.some(p => p.bankId === b.id)) || banks[0]
      setSelectedBank(String(bankWithProj.id))
    }
  }, [banks, projects, selectedBank])

  useEffect(() => {
    const bankId = parseInt(selectedBank, 10)
    if (!Number.isFinite(bankId)) return
    const list = projectsByBank(bankId)
    if (list.length && !selectedProject) setSelectedProject(String(list[0].id))
  }, [selectedBank, projectsByBank, selectedProject])

  const loadFor = useCallback(async (projectId) => {
    if (!projectId) return
    const phases = await getPhases(projectId)
    setRowsByProject(s => ({ ...s, [projectId]: phases || [] }))
  }, [])

  useEffect(() => { if (selectedProject) loadFor(parseInt(selectedProject,10)) }, [selectedProject, loadFor])

  const rows = useMemo(() => rowsByProject[parseInt(selectedProject,10)] || [], [rowsByProject, selectedProject])

  const [form, setForm] = useState({ title: '', estimatedDays: 5 })
  const [editId, setEditId] = useState(null)
  const [edit, setEdit] = useState({})

  const submit = async (e) => {
    e.preventDefault()
    const pid = parseInt(selectedProject,10)
    if (!Number.isFinite(pid)) { alert('Choose a project'); return }
    if (!form.title.trim()) { alert('Title is required'); return }
    const days = parseInt(form.estimatedDays,10); if (!Number.isFinite(days) || days <= 0) { alert('Estimated days must be > 0'); return }
    await addPhase(pid, { title: form.title.trim(), estimatedDays: days })
    setForm({ title:'', estimatedDays: 5 })
    await loadFor(pid); onChange?.()
  }

  const startEdit = (r) => { setEditId(r.id); setEdit({ title: r.title, estimatedDays: r.estimatedDays }) }
  const save = async (id) => {
    if (!edit.title.trim()) { alert('Title is required'); return }
    const days = parseInt(edit.estimatedDays,10); if (!Number.isFinite(days) || days <= 0) { alert('Estimated days must be > 0'); return }
    await updatePhase(id, { title: edit.title.trim(), estimatedDays: days, projectId: parseInt(selectedProject, 10) }) 
    setEditId(null); setEdit({})
    await loadFor(parseInt(selectedProject,10)); onChange?.()
  }
  const remove = async (id) => {
    if (!confirm('Delete this phase?')) return
    await deletePhase(id)
    await loadFor(parseInt(selectedProject,10)); onChange?.()
  }

  const bankProjects = projectsByBank(parseInt(selectedBank,10))

  return (
    <section className="adminCard">
      <header className="adminCard__head">
        <div>
          <h3 className="adminCard__title">Phases</h3>
          <p className="adminCard__sub">Add phases under a specific bank & project.</p>
        </div>
      </header>

      <div className="formRow">
        <label className="sr-only" htmlFor="phaseBank">Bank</label>
        <select id="phaseBank" value={selectedBank} onChange={(e)=>{ setSelectedBank(e.target.value); setSelectedProject('') }}>
          {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <label className="sr-only" htmlFor="phaseProject">Project</label>
        <select id="phaseProject" value={selectedProject} onChange={(e)=>setSelectedProject(e.target.value)}>
          {bankProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <form className="formRow" onSubmit={submit}>
        <input placeholder="Phase title" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} />
        <input type="number" min="1" step="1" placeholder="Estimated days" value={form.estimatedDays}
               onChange={e=>setForm({...form, estimatedDays:e.target.value})} />
        <button className="btn btn--primary" type="submit">Add</button>
      </form>

      <div className="tableWrap">
        <table className="adminTable">
          <thead>
            <tr><th>ID</th><th>Title</th><th>Estimated days</th><th className="ta-right">Actions</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>
                  {editId===r.id
                    ? <input value={edit.title} onChange={e=>setEdit({...edit, title:e.target.value})} />
                    : r.title}
                </td>
                <td>
                  {editId===r.id
                    ? <input type="number" min="1" step="1" value={edit.estimatedDays}
                             onChange={e=>setEdit({...edit, estimatedDays:e.target.value})} />
                    : r.estimatedDays}
                </td>
                <td className="rowActions">
                  {editId===r.id
                    ? (<>
                        <button className="btn btn--primary" onClick={()=>save(r.id)}>Save</button>
                        <button className="btn" onClick={()=>{setEditId(null); setEdit({})}}>Cancel</button>
                      </>)
                    : (<>
                        <button className="btn" onClick={()=>startEdit(r)}>Edit</button>
                        <button className="btn btn--danger" onClick={()=>remove(r.id)}>Delete</button>
                      </>)
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* =========================================================
   Tasks  (Bank → Project → Phase → Add)
   ========================================================= */

function TasksManager({ banks, projects, phasesByProject, onChange }) {
  // Selection for the add form
  const [selBank, setSelBank] = useState('')
  const [selProject, setSelProject] = useState('')

  useEffect(() => {
    if (!selBank && banks.length) {
      const bankWithProj = banks.find(b => projects.some(p => p.bankId === b.id)) || banks[0]
      setSelBank(String(bankWithProj.id))
    }
  }, [banks, projects, selBank])

  useEffect(() => {
    const bankId = parseInt(selBank, 10)
    if (!Number.isFinite(bankId)) return
    const proj = projects.find(p => p.bankId === bankId)
    if (proj && !selProject) setSelProject(String(proj.id))
  }, [selBank, projects, selProject])

  const bankProjects = useMemo(
    () => projects.filter(p => p.bankId === parseInt(selBank,10)),
    [projects, selBank]
  )
  const phases = useMemo(
    () => phasesByProject[parseInt(selProject,10)] || [],
    [phasesByProject, selProject]
  )

  const [rows, setRows] = useState([])
  const [form, setForm] = useState({
    title:'', projectId:'', phaseId:'', estimatedDays:5, startDate:'', durationDays:5, status:1
  })
  const [editId, setEditId] = useState(null)
  const [edit, setEdit] = useState({})

  const [load, loading] = useAsync(async () => {
    const data = await fetchTasks()
    setRows(data || [])
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async (e) => {
    e.preventDefault()
    const projectId = parseInt(form.projectId || selProject,10)
    if (!Number.isFinite(projectId)) { alert('Select a project'); return }
    if (!form.title.trim()) { alert('Title is required'); return }

    const payload = {
      projectId,
      title: form.title.trim(),
      estimatedDays: parseInt(form.estimatedDays,10) || 0,
      startDate: iso(form.startDate),
      durationDays: parseInt(form.durationDays,10) || null,
      status: parseInt(form.status,10) || 1,
      requiredSkills: [],
      phaseId: form.phaseId ? parseInt(form.phaseId,10) : null
    }
    await apiCreateTask(payload)
    setForm({ title:'', projectId:'', phaseId:'', estimatedDays:5, startDate:'', durationDays:5, status:1 })
    await load(); onChange?.()
  }

  const startEdit = (r) => {
    setEditId(r.id)
    setEdit({
      title: r.title, projectId: r.projectId, phaseId: r.phaseId || '',
      estimatedDays: r.estimatedDays || 0,
      startDate: r.startDate ? r.startDate.slice(0,10) : '',
      durationDays: r.durationDays || '',
      status: r.status || 1
    })
  }
  const save = async (id) => {
    if (!edit.title?.trim()) { alert('Title is required'); return }
    const payload = {
      projectId: parseInt(edit.projectId,10),
      title: edit.title.trim(),
      estimatedDays: parseInt(edit.estimatedDays,10) || 0,
      startDate: iso(edit.startDate),
      durationDays: edit.durationDays ? parseInt(edit.durationDays,10) : null,
      status: parseInt(edit.status,10) || 1,
      requiredSkills: [],
      phaseId: edit.phaseId ? parseInt(edit.phaseId,10) : null
    }
    await updateTask(id, payload)
    setEditId(null); setEdit({})
    await load(); onChange?.()
  }
  const remove = async (id) => {
    if (!confirm('Delete this task?')) return
    await deleteTask(id)
    await load(); onChange?.()
  }

  return (
    <section className="adminCard">
      <header className="adminCard__head">
        <div>
          <h3 className="adminCard__title">Tasks</h3>
          <p className="adminCard__sub">Create tasks and link them to projects and (optionally) phases.</p>
        </div>
        <div className="adminCard__meta">{loading ? 'Loading…' : `${rows.length} total`}</div>
      </header>

      <div className="formRow">
        <label className="sr-only" htmlFor="taskBankSel">Bank</label>
        <select id="taskBankSel" value={selBank} onChange={(e)=>{ setSelBank(e.target.value); setSelProject('') }}>
          {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <label className="sr-only" htmlFor="taskProjectSel">Project</label>
        <select id="taskProjectSel" value={selProject} onChange={(e)=>setSelProject(e.target.value)}>
          {bankProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <form className="formRow" onSubmit={submit}>
        <input placeholder="Task title" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} />
        <select value={form.projectId || selProject} onChange={e=>setForm({...form, projectId:e.target.value})}>
          {bankProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={form.phaseId} onChange={e=>setForm({...form, phaseId:e.target.value})}>
          <option value="">Phase (optional)</option>
          {phases.map(ph => <option key={ph.id} value={ph.id}>{ph.title}</option>)}
        </select>
        <input type="number" min="1" step="1" placeholder="Est. days" value={form.estimatedDays}
               onChange={e=>setForm({...form, estimatedDays:e.target.value})} />
        <input type="date" value={form.startDate} onChange={e=>setForm({...form, startDate:e.target.value})} />
        <input type="number" min="1" step="1" placeholder="Duration days" value={form.durationDays}
               onChange={e=>setForm({...form, durationDays:e.target.value})} />
        <input type="number" min="0" step="1" placeholder="Status" value={form.status}
               onChange={e=>setForm({...form, status:e.target.value})} />
        <button className="btn btn--primary" type="submit">Add</button>
      </form>

      <div className="tableWrap">
        <table className="adminTable">
          <thead>
            <tr>
              <th>ID</th><th>Title</th><th>Project</th><th>Phase</th>
              <th>Est.</th><th>Start</th><th>Dur.</th><th>Status</th>
              <th className="ta-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{editId===r.id ? <input value={edit.title} onChange={e=>setEdit({...edit, title:e.target.value})} /> : r.title}</td>
                <td>
                  {editId===r.id
                    ? (
                      <select value={edit.projectId} onChange={e=>setEdit({...edit, projectId:e.target.value})}>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} — { (banks.find(b=>b.id===p.bankId)?.name) || p.bankId }
                          </option>
                        ))}
                      </select>
                    )
                    : (() => {
                        const p = projects.find(p=>p.id===r.projectId)
                        const b = p ? banks.find(b=>b.id===p.bankId) : null
                        return p ? `${p.name} — ${b?.name ?? p.bankId}` : r.projectId
                      })()}
                </td>
                <td>
                  {editId===r.id
                    ? (
                      <select value={edit.phaseId || ''} onChange={e=>setEdit({...edit, phaseId:e.target.value})}>
                        <option value="">—</option>
                        {(phasesByProject[edit.projectId] || []).map(ph => <option key={ph.id} value={ph.id}>{ph.title}</option>)}
                      </select>
                    )
                    : (r.phaseId || <span className="muted">—</span>)}
                </td>
                <td>{editId===r.id ? <input type="number" min="1" step="1" value={edit.estimatedDays}
                                            onChange={e=>setEdit({...edit, estimatedDays:e.target.value})} />
                                    : (r.estimatedDays ?? <span className="muted">—</span>)}</td>
                <td>{editId===r.id ? <input type="date" value={edit.startDate} onChange={e=>setEdit({...edit, startDate:e.target.value})} />
                                    : (r.startDate ? r.startDate.slice(0,10) : <span className="muted">—</span>)}</td>
                <td>{editId===r.id ? <input type="number" min="1" step="1" value={edit.durationDays}
                                            onChange={e=>setEdit({...edit, durationDays:e.target.value})} />
                                    : (r.durationDays ?? <span className="muted">—</span>)}</td>
                <td>{editId===r.id ? <input type="number" min="0" step="1" value={edit.status}
                                            onChange={e=>setEdit({...edit, status:e.target.value})} />
                                    : (r.status ?? 0)}</td>
                <td className="rowActions">
                  {editId===r.id
                    ? (<>
                        <button className="btn btn--primary" onClick={()=>save(r.id)}>Save</button>
                        <button className="btn" onClick={()=>{setEditId(null); setEdit({})}}>Cancel</button>
                      </>)
                    : (<>
                        <button className="btn" onClick={()=>startEdit(r)}>Edit</button>
                        <button className="btn btn--danger" onClick={()=>remove(r.id)}>Delete</button>
                      </>)
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* =========================================================
   Admin page with tabs & centered container
   ========================================================= */

export default function Management() {
  const [tab, setTab] = useState('banks') // banks | projects | phases | tasks

  const [banks, setBanks] = useState([])
  const [projects, setProjects] = useState([])
  const [phasesByProject, setPhasesByProject] = useState({})

  const refreshAll = useCallback(async () => {
    const bs = await fetchBanks(); setBanks(bs || [])
    const ps = await fetchProjects(); setProjects(ps || [])
    const map = {}
    for (const p of ps || []) map[p.id] = await getPhases(p.id)
    setPhasesByProject(map)
    window.dispatchEvent(new Event('plancraft:refresh'))
  }, [])

  useEffect(() => { refreshAll() }, [refreshAll])

  return (
    <div className="adminWrap">
      <div className="adminContainer">
        <header className="adminHeader">
          <div>
            <h2 className="adminTitle">Administration</h2>
            <p className="adminSubtitle">Banks, projects, phases & tasks — enterprise-ready CRUD.</p>
          </div>
          <div className="adminActions">
            <div className="adminTabs">
              <button className={`tabBtn ${tab==='banks'?'active':''}`} onClick={()=>setTab('banks')}>Banks</button>
              <button className={`tabBtn ${tab==='projects'?'active':''}`} onClick={()=>setTab('projects')}>Projects</button>
              <button className={`tabBtn ${tab==='phases'?'active':''}`} onClick={()=>setTab('phases')}>Phases</button>
              <button className={`tabBtn ${tab==='tasks'?'active':''}`} onClick={()=>setTab('tasks')}>Tasks</button>
            </div>
            <button className="btn" onClick={refreshAll}>Refresh all</button>
          </div>
        </header>

        {tab==='banks'    && <BanksManager onChange={refreshAll} />}
        {tab==='projects' && <ProjectsManager banks={banks} onChange={refreshAll} />}
        {tab==='phases'   && <PhasesManager banks={banks} projects={projects} onChange={refreshAll} />}
        {tab==='tasks'    && <TasksManager banks={banks} projects={projects} phasesByProject={phasesByProject} onChange={refreshAll} />}
      </div>
    </div>
  )
}
