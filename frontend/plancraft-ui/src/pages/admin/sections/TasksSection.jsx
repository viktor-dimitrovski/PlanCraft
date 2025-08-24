import React, { useEffect, useMemo, useState } from 'react'
import useAsync from '../hooks/useAsync'
import { fetchTasks, apiCreateTask, updateTask, deleteTask } from '../../../lib/api'

const iso = (d) => {
  try {
    if (!d) return null
    const dt = new Date(d)
    if (isNaN(+dt)) return null
    return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())).toISOString()
  } catch { return null }
}

export default function TasksSection({ banks, projects, phasesByProject, onChange }) {
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
        <select value={selBank} onChange={(e)=>{ setSelBank(e.target.value); setSelProject('') }}>
          {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={selProject} onChange={(e)=>setSelProject(e.target.value)}>
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
                    ? (<><button className="btn btn--primary" onClick={()=>save(r.id)}>Save</button><button className="btn" onClick={()=>{setEditId(null); setEdit({})}}>Cancel</button></>)
                    : (<><button className="btn" onClick={()=>startEdit(r)}>Edit</button><button className="btn btn--danger" onClick={()=>remove(r.id)}>Delete</button></>)
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
