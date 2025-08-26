import React, { useEffect, useMemo, useState } from 'react'
import useAsync from '../hooks/useAsync'
import {
  fetchProjects, createProject, updateProject, deleteProject,
  duplicateProjectPhases, fetchBanks
} from '../../../lib/api'
import ComboBox from '../../../fields/ComboBox.jsx'

export default function ProjectsSection({ banks = [], onChange }) {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ name: '', bankId: '' })
  const [editId, setEditId] = useState(null)
  const [edit, setEdit] = useState({})

  // Bank sources (props or API)
  const [bankOpts, setBankOpts] = useState(banks || [])

  // Filters
  const [bankFilterId, setBankFilterId] = useState('') // string ids
  const [search, setSearch] = useState('')

  // Duplicate modal
  const [dupOpen, setDupOpen] = useState(false)
  const [dupSource, setDupSource] = useState(null)   // { id, name, bankId }
  const [dupBankId, setDupBankId] = useState('')     // destination bank (string)
  const [dupProjectId, setDupProjectId] = useState('') // destination project (string)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(null) // { type:'success'|'error', text:string }

  const [load, loading] = useAsync(async () => {
    const data = await fetchProjects()
    setRows(data || [])
  }, [setRows])

  const [loadBanks] = useAsync(async () => {
    if (!banks || banks.length === 0) {
      const list = await fetchBanks()
      setBankOpts(list || [])
    } else {
      setBankOpts(banks)
    }
  }, [banks])

  useEffect(() => { load(); loadBanks() }, [load, loadBanks])

  // Derived data
  const filteredRows = useMemo(() => {
    let list = rows
    if (bankFilterId) list = list.filter(r => String(r.bankId) === String(bankFilterId))
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(r => r.name?.toLowerCase().includes(q))
    }
    return list
  }, [rows, bankFilterId, search])

  // Destination projects (by selected destination bank)
  const destProjects = useMemo(() => {
    if (!dupBankId) return []
    const list = rows.filter(p => String(p.bankId) === String(dupBankId))
    if (dupSource?.id) return list.filter(p => p.id !== dupSource.id)
    return list
  }, [rows, dupBankId, dupSource])

  // CRUD
  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { alert('Name is required'); return }
    const bankId = parseInt(form.bankId,10); if (!Number.isFinite(bankId)) { alert('Select a bank'); return }
    await createProject({ name: form.name.trim(), bankId })
    setForm({ name:'', bankId:'' })
    await load(); onChange?.()
  }

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

  // Duplicate flow
  const openDuplicate = (row) => {
    setDupSource({ id: row.id, name: row.name, bankId: row.bankId })
    setDupBankId(String(row.bankId)) // preselect same bank
    setDupProjectId('')
    setDupOpen(true)
  }
  const closeDuplicate = () => {
    setDupOpen(false)
    setDupSource(null)
    setDupBankId('')
    setDupProjectId('')
  }
  // drafts used only by the toolbar form
  const [bankFilterDraft, setBankFilterDraft] = useState(bankFilterId);
  const [searchDraft, setSearchDraft] = useState(search);

  const applyFilters = (e) => {
    e.preventDefault();
    setBankFilterId(bankFilterDraft ?? '');
    setSearch(searchDraft ?? '');
  };

  const resetFilters = () => {
    setBankFilterDraft('');
    setSearchDraft('');
    setBankFilterId('');
    setSearch('');
  };

  useEffect(() => { setDupProjectId('') }, [dupBankId])

  const doDuplicate = async () => {
    if (!dupSource) return
    if (!dupBankId) { setFlash({ type:'error', text:'Please choose destination bank.' }); return }
    const destId = parseInt(dupProjectId, 10)
    if (!Number.isFinite(destId)) { setFlash({ type:'error', text:'Please choose destination project.' }); return }
    if (destId === dupSource.id) { setFlash({ type:'error', text:'Destination project must be different from source.' }); return }
    try {
      setBusy(true)
      await duplicateProjectPhases(dupSource.id, destId)
      setFlash({ type:'success', text:`Phases duplicated: ${dupSource.id} → ${destId}` })
      closeDuplicate()
      await load(); onChange?.()
    } catch (err) {
      setFlash({ type:'error', text:`Error duplicating phases: ${err.message || err}` })
    } finally {
      setBusy(false)
      setTimeout(() => setFlash(null), 4000)
    }
  }

  return (
    <section className="adminCard">
      <header className="adminCard__head">
        <div>
          <h3 className="adminCard__title">Projects</h3>
          <p className="adminCard__sub">Link projects to banks and manage the portfolio.</p>
        </div>
        <div className="adminCard__meta">{loading ? 'Loading…' : `${filteredRows.length}/${rows.length} shown`}</div>
      </header>

      {flash && (
        <div
          className={`flash ${flash.type === 'success' ? 'flash--success' : 'flash--error'}`}
          style={{
            marginBottom: 12, padding: '10px 12px', borderRadius: 8,
            background: flash.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: flash.type === 'success' ? '#065f46' : '#991b1b',
            border: `1px solid ${flash.type === 'success' ? '#34d399' : '#fca5a5'}`,
            display: 'flex', alignItems:'center', justifyContent:'space-between'
          }}
        >
          <span>{flash.text}</span>
          <button className="btn" type="button" onClick={()=>setFlash(null)} aria-label="Close">×</button>
        </div>
      )}

      {/* Toolbar (submit to apply filters) */}
      <form
        className="formRow"
        onSubmit={applyFilters}
        style={{ gap: 8, alignItems:'center', flexWrap:'wrap' }}
      >
        <label style={{ fontSize: 13, color:'#475569' }}>Filter by bank</label>

        <ComboBox
          items={[{ value:'', label:'All banks…' }, ...bankOpts.map(b => ({ value: String(b.id), label: b.name }))]}
          value={bankFilterDraft}
          onChange={(v) => setBankFilterDraft(v ?? '')}
          placeholder="All banks…"
          width={240}
        />

        <input
          placeholder="Search by project name…"
          value={searchDraft}
          onChange={(e)=>setSearchDraft(e.target.value)}
          style={{ minWidth: 220 }}
        />

        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button className="btn" type="button" onClick={resetFilters}>Reset</button>
          <button className="btn btn--primary" type="submit">Apply</button>
        </div>
      </form>


      <div className="tableWrap">
        <table className="adminTable">
          <thead>
            <tr>
              <th>ID</th><th>Name</th><th>Bank</th><th className="ta-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(r => (
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
                        {bankOpts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    )
                    : (bankOpts.find(b=>b.id===r.bankId)?.name || r.bankId)}
                </td>
                <td className="rowActions" style={{ display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap' }}>
                  {editId===r.id ? (
                    <>
                      <button className="btn btn--primary" onClick={()=>save(r.id)} type="button">Save</button>
                      <button className="btn" onClick={()=>{setEditId(null); setEdit({})}} type="button">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn" onClick={()=>{setEditId(r.id); setEdit({ name:r.name, bankId:r.bankId })}} type="button">Edit</button>
                      <button className="btn btn--danger" onClick={()=>remove(r.id)} type="button">Delete</button>
                      <button
                        className="btn"
                        type="button"
                        onClick={()=>openDuplicate(r)}
                        title="Duplicate all phases from this project into another project"
                      >
                        Duplicate phases…
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Duplicate modal: destination bank/project via ComboBox */}
      {dupOpen && (
        <div
          role="dialog" aria-modal="true"
          style={{
            position:'fixed', inset:0, zIndex:50, background:'rgba(0,0,0,0.45)',
            display:'grid', placeItems:'center', padding:16
          }}
          onClick={(e)=>{ if (e.target === e.currentTarget) closeDuplicate() }}
        >
          <div
            style={{
              width:'min(600px, 100%)', background:'#fff', borderRadius:12,
              boxShadow:'0 20px 60px rgba(0,0,0,0.2)', padding:20
            }}
          >
            <header style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
              <h4 style={{margin:0}}>Duplicate phases</h4>
              <button className="btn" onClick={closeDuplicate} type="button" aria-label="Close">×</button>
            </header>

            <div style={{display:'grid', gap:10}}>
              <div style={{ color:'#334155' }}>
                Source project: <b>{dupSource?.name}</b> (ID {dupSource?.id}) — Bank: <b>{bankOpts.find(b=>b.id===dupSource?.bankId)?.name || dupSource?.bankId}</b>
              </div>

              <label style={{display:'block'}}>Destination bank</label>
              <ComboBox
                items={bankOpts.map(b => ({ value: String(b.id), label: b.name }))}
                value={dupBankId}
                onChange={(v) => setDupBankId(v ?? '')}
                placeholder="Select bank…"
                width="100%"
              />

              <label style={{display:'block'}}>Destination project</label>
              <ComboBox
                items={destProjects.map(p => ({ value: String(p.id), label: `${p.name} (ID ${p.id})` }))}
                value={dupProjectId}
                onChange={(v) => setDupProjectId(v ?? '')}
                placeholder={dupBankId ? 'Select project…' : 'Choose destination bank first'}
                width="100%"
              />

              <div style={{marginTop:4, fontSize:13, color:'#475569', lineHeight:1.4}}>
                <div>• <b>StartDate</b> → <code>NULL</code></div>
                <div>• <b>Status</b> → <code>Planned (0)</code></div>
                <div>• <b>NoAssignedDays</b> → <code>EstimatedDays</code></div>
                <div>• Dependencies/ParallelWith → remapped po <b>Title</b> kon novite fazi</div>
              </div>
            </div>

            <footer style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:16}}>
              <button className="btn" onClick={closeDuplicate} type="button" disabled={busy}>Cancel</button>
              <button
                className="btn btn--primary"
                onClick={doDuplicate}
                type="button"
                disabled={busy || !dupBankId || !dupProjectId}
              >
                {busy ? 'Duplicating…' : 'Duplicate'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  )
}
