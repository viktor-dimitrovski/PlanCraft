import React, { useEffect, useState } from 'react'
import useAsync from '../hooks/useAsync'
import { fetchBanks, createBank, updateBank, deleteBank } from '../../../lib/api'

// --- helpers ---
const isHex6 = (v) => /^#?[0-9a-fA-F]{6}$/.test(v || '')
const normalizeHex = (v) => {
  if (!v) return ''
  const s = v.trim()
  if (!s) return ''
  return s.startsWith('#') ? s : `#${s}`
}

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
    if (form.color && !isHex6(form.color)) { alert('Color must be hex, e.g. #3366FF'); return }
    const color = form.color ? normalizeHex(form.color) : null
    await createBank({ name: form.name.trim(), color })
    setForm({ name: '', color: '' })
    await load(); onChange?.()
  }

  const startEdit = (b) => {
    setEditId(b.id)
    setEdit({ name: b.name, color: b.color || '' })
  }

  const save = async (id) => {
    if (!edit.name.trim()) { alert('Name is required'); return }
    if (edit.color && !isHex6(edit.color)) { alert('Color must be hex, e.g. #3366FF'); return }
    const color = edit.color ? normalizeHex(edit.color) : null
    await updateBank(id, { name: edit.name.trim(), color })
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

      {/* ADD new */}
      <form className="formRow" onSubmit={submit}>
        <input
          placeholder="Bank name"
          value={form.name}
          onChange={e=>setForm({...form, name:e.target.value})}
          aria-label="Bank name"
        />

        {/* Color picker + hex input */}
        <div className="colorPickerWrap" aria-label="Brand color">
          <input
            type="color"
            value={form.color || '#3b82f6'}
            onChange={e=>setForm({...form, color: e.target.value})}
            title="Pick color"
          />
          <input
            className="hexInput"
            placeholder="#RRGGBB"
            value={form.color}
            onChange={e=>setForm({...form, color: e.target.value})}
            aria-label="Hex color"
          />
          {form.color && (
            <button type="button" className="btn" onClick={()=>setForm({...form, color:''})}>
              Clear
            </button>
          )}
        </div>

        <button className="btn btn--primary" type="submit">Add</button>
      </form>

      {/* TABLE */}
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
                  {editId===b.id ? (
                    <div className="colorPickerWrap">
                      <input
                        type="color"
                        value={edit.color || '#3b82f6'}
                        onChange={e=>setEdit({...edit, color:e.target.value})}
                        title="Pick color"
                      />
                      <input
                        className="hexInput"
                        placeholder="#RRGGBB"
                        value={edit.color}
                        onChange={e=>setEdit({...edit, color:e.target.value})}
                      />
                      {edit.color && (
                        <button type="button" className="btn" onClick={()=>setEdit({...edit, color:''})}>
                          Clear
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <span className="colorDot" style={{ background: b.color || '#e2e8f0' }} />
                      {b.color || <span className="muted">—</span>}
                    </>
                  )}
                </td>

                <td className="rowActions">
                  {editId===b.id ? (
                    <>
                      <button className="btn btn--primary" onClick={()=>save(b.id)}>Save</button>
                      <button className="btn" onClick={()=>{setEditId(null); setEdit({})}}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn" onClick={()=>startEdit(b)}>Edit</button>
                      <button className="btn btn--danger" onClick={()=>remove(b.id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
