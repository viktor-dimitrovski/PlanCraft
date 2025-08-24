import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getPhases, addPhase, updatePhase, deletePhase } from '../../../lib/api'

export default function PhasesSection({ banks, projects, onChange }) {
  const [rowsByProject, setRowsByProject] = useState({})
  const [selectedBank, setSelectedBank] = useState('')
  const [selectedProject, setSelectedProject] = useState('')

  const projectsByBank = useMemo(
    () => (bankId) => (projects || []).filter(p => p.bankId === bankId),
    [projects]
  )

  useEffect(() => {
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
    // Include projectId to avoid accidental 0 on server binders
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
        <select value={selectedBank} onChange={(e)=>{ setSelectedBank(e.target.value); setSelectedProject('') }}>
          {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <select value={selectedProject} onChange={(e)=>setSelectedProject(e.target.value)}>
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
          <thead><tr><th>ID</th><th>Title</th><th>Estimated days</th><th className="ta-right">Actions</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{editId===r.id ? <input value={edit.title} onChange={e=>setEdit({...edit, title:e.target.value})} /> : r.title}</td>
                <td>{editId===r.id
                  ? <input type="number" min="1" step="1" value={edit.estimatedDays} onChange={e=>setEdit({...edit, estimatedDays:e.target.value})} />
                  : r.estimatedDays}</td>
                <td className="rowActions">
                  {editId===r.id
                    ? (<><button className="btn btn--primary" onClick={()=>save(r.id)}>Save</button><button className="btn" onClick={()=>{setEditId(null); setEdit({})}}>Cancel</button></>)
                    : (<><button className="btn" onClick={()=>setEditId(r.id) || setEdit({ title:r.title, estimatedDays:r.estimatedDays })}>Edit</button><button className="btn btn--danger" onClick={()=>remove(r.id)}>Delete</button></>)
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
