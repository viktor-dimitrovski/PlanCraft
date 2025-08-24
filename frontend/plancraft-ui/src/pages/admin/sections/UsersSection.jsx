import React, { useEffect, useState } from 'react'
import useAsync from '../hooks/useAsync'
import { fetchPeople, addPerson, updatePerson, deletePerson } from '../../../lib/api'

export default function UsersSection({ onChange }) {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ name: '', capacityHoursPerWeek: 40, color: '#6b7280', skills: '' })
  const [editId, setEditId] = useState(null)
  const [edit, setEdit] = useState({})

  const [load, loading] = useAsync(async () => {
    const data = await fetchPeople()
    setRows(data || [])
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { alert('Name is required'); return }
    const payload = {
      name: form.name.trim(),
      capacityHoursPerWeek: Number(form.capacityHoursPerWeek) || 40,
      color: form.color || '#6b7280',
      skills: (form.skills || '').split(',').map(s => s.trim()).filter(Boolean)
    }
    await addPerson(payload)
    setForm({ name: '', capacityHoursPerWeek: 40, color: '#6b7280', skills: '' })
    await load(); onChange?.()
  }

  const startEdit = (r) => {
    setEditId(r.id)
    setEdit({
      name: r.name || '',
      capacityHoursPerWeek: r.capacityHoursPerWeek ?? 40,
      color: r.color || '#6b7280',
      skills: Array.isArray(r.skills) ? r.skills.join(', ') : ''
    })
  }

  const save = async (id) => {
    if (!edit.name.trim()) { alert('Name is required'); return }
    const payload = {
      name: edit.name.trim(),
      capacityHoursPerWeek: Number(edit.capacityHoursPerWeek) || 40,
      color: edit.color || '#6b7280',
      skills: (edit.skills || '').split(',').map(s => s.trim()).filter(Boolean)
    }
    await updatePerson(id, payload)
    setEditId(null); setEdit({})
    await load(); onChange?.()
  }

  const remove = async (id) => {
    if (!confirm('Delete this user?')) return
    await deletePerson(id)
    await load(); onChange?.()
  }

  return (
    <section className="adminCard">
      <header className="adminCard__head">
        <div>
          <h3 className="adminCard__title">Users</h3>
          <p className="adminCard__sub">Add and manage users (capacity, color, skills).</p>
        </div>
        <div className="adminCard__meta">{loading ? 'Loading…' : `${rows.length} total`}</div>
      </header>

      <form className="formRow" onSubmit={submit}>
        <input placeholder="Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
        <input type="number" min="1" max="168" placeholder="Capacity (h/w)" value={form.capacityHoursPerWeek}
               onChange={e=>setForm({...form, capacityHoursPerWeek:e.target.value})} />
        <input placeholder="Color" value={form.color} onChange={e=>setForm({...form, color:e.target.value})} />
        <input placeholder="Skills (CSV)" value={form.skills} onChange={e=>setForm({...form, skills:e.target.value})} />
        <button className="btn btn--primary" type="submit">Add</button>
      </form>

      <div className="tableWrap">
        <table className="adminTable">
          <thead><tr><th>ID</th><th>Name</th><th>Capacity (h/w)</th><th>Color</th><th>Skills</th><th className="ta-right">Actions</th></tr></thead>
        <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{editId===r.id ? <input value={edit.name} onChange={e=>setEdit({...edit, name:e.target.value})} /> : <b>{r.name}</b>}</td>
                <td>{editId===r.id
                  ? <input type="number" min="1" max="168" value={edit.capacityHoursPerWeek}
                           onChange={e=>setEdit({...edit, capacityHoursPerWeek:e.target.value})} />
                  : (r.capacityHoursPerWeek ?? 40)}</td>
                <td>{editId===r.id
                  ? <input value={edit.color} onChange={e=>setEdit({...edit, color:e.target.value})} />
                  : <><span className="colorDot" style={{ background: r.color || '#e2e8f0' }} />{r.color || <span className="muted">—</span>}</>}</td>
                <td className="muted">{editId===r.id
                  ? <input placeholder="e.g., React,SQL" value={edit.skills} onChange={e=>setEdit({...edit, skills:e.target.value})} />
                  : (Array.isArray(r.skills) ? r.skills.join(', ') : '')}</td>
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
