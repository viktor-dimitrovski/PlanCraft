import React, { useEffect, useState } from 'react'
import useAsync from '../hooks/useAsync'
import { fetchProjects, createProject, updateProject, deleteProject } from '../../../lib/api'

export default function ProjectsSection({ banks, onChange }) {
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
    const bankId = parseInt(form.bankId,10); if (!Number.isFinite(bankId)) { alert('Select a bank'); return }
    await createProject({ name: form.name.trim(), bankId })
    setForm({ name:'', bankId:'' })
    await load(); onChange?.()
  }
  const startEdit = (row) => { setEditId(row.id); setEdit({ name: row.name, bankId: row.bankId }) }
  const save = async (id) => {
    if (!edit.name.trim()) { alert('Name is required'); return }
    const bankId = parseInt(edit.bankId,10); if (!Number.isFinite(bankId)) { alert('Select a bank'); return }
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
        <input placeholder="Project name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
        <select value={form.bankId} onChange={e=>setForm({...form, bankId:e.target.value})}>
          <option value="">Bank…</option>
          {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button className="btn btn--primary" type="submit">Add</button>
      </form>

      <div className="tableWrap">
        <table className="adminTable">
          <thead><tr><th>ID</th><th>Name</th><th>Bank</th><th className="ta-right">Actions</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{editId===r.id ? <input value={edit.name} onChange={e=>setEdit({...edit, name:e.target.value})} /> : r.name}</td>
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
                    ? (<><button className="btn btn--primary" onClick={()=>save(r.id)}>Save</button><button className="btn" onClick={()=>{setEditId(null); setEdit({})}}>Cancel</button></>)
                    : (<><button className="btn" onClick={()=>setEditId(r.id) || setEdit({ name:r.name, bankId:r.bankId })}>Edit</button><button className="btn btn--danger" onClick={()=>remove(r.id)}>Delete</button></>)
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
