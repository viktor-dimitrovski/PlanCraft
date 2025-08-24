import React, { useEffect, useState } from 'react'
import useAsync from '../hooks/useAsync'
import { fetchBanks, createBank, updateBank, deleteBank } from '../../../lib/api'

export default function BanksSection({ onChange }) {
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
        <input placeholder="Bank name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
        <input placeholder="Color (optional)" value={form.color} onChange={e=>setForm({...form, color:e.target.value})} />
        <button className="btn btn--primary" type="submit">Add</button>
      </form>

      <div className="tableWrap">
        <table className="adminTable">
          <thead><tr><th>ID</th><th>Name</th><th>Color</th><th className="ta-right">Actions</th></tr></thead>
          <tbody>
            {rows.map(b => (
              <tr key={b.id}>
                <td>{b.id}</td>
                <td>{editId===b.id ? <input value={edit.name} onChange={e=>setEdit({...edit, name:e.target.value})} /> : b.name}</td>
                <td className="bankColorCell">
                  {editId===b.id
                    ? <input value={edit.color} onChange={e=>setEdit({...edit, color:e.target.value})} />
                    : <><span className="colorDot" style={{ background:b.color || '#e2e8f0' }} />{b.color || <span className="muted">—</span>}</>}
                </td>
                <td className="rowActions">
                  {editId===b.id
                    ? (<><button className="btn btn--primary" onClick={()=>save(b.id)}>Save</button><button className="btn" onClick={()=>{setEditId(null); setEdit({})}}>Cancel</button></>)
                    : (<><button className="btn" onClick={()=>startEdit(b)}>Edit</button><button className="btn btn--danger" onClick={()=>remove(b.id)}>Delete</button></>)
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
