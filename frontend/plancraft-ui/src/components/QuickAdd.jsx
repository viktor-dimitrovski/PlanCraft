import React, { useEffect, useState } from 'react'
import { fetchBanks, createBank, createPerson, createProject } from '../lib/api'

export default function QuickAdd({ afterChange }) {
  const [banks, setBanks] = useState([])
  const [bankName, setBankName] = useState('')
  const [bankColor, setBankColor] = useState('#2563eb')

  const [personName, setPersonName] = useState('')
  const [personCap, setPersonCap] = useState(40)
  const [personColor, setPersonColor] = useState('#6b7280')

  const [projectName, setProjectName] = useState('')
  const [projectBankId, setProjectBankId] = useState('')

  const loadBanks = async () => setBanks(await fetchBanks())
  useEffect(() => { loadBanks() }, [])

  const onAddBank = async (e) => {
    e.preventDefault()
    if (!bankName.trim()) return
    await createBank({ name: bankName.trim(), color: bankColor || '#2563eb' })
    setBankName(''); setBankColor('#2563eb')
    await loadBanks()
    afterChange?.('bank')
  }

  const onAddPerson = async (e) => {
    e.preventDefault()
    if (!personName.trim()) return
    await createPerson({
      name: personName.trim(),
      capacityHoursPerWeek: parseInt(personCap, 10) || 40,
      skills: [],
      color: personColor || '#6b7280'
    })
    setPersonName(''); setPersonCap(40); setPersonColor('#6b7280')
    afterChange?.('person')
  }

  const onAddProject = async (e) => {
    e.preventDefault()
    if (!projectName.trim() || !projectBankId) return
    await createProject({ name: projectName.trim(), bankId: parseInt(projectBankId, 10) })
    setProjectName(''); setProjectBankId('')
    afterChange?.('project')
    // notify other panes (PhasePanel) to refresh projects list
    window.dispatchEvent(new Event('plancraft:projectsChanged'))
  }

  return (
    <div>
      <h3>Quick Add</h3>

      {/* Bank */}
      <form onSubmit={onAddBank} style={box}>
        <div style={row}>
          <label style={label}>Bank</label>
          <input value={bankName} onChange={e=>setBankName(e.target.value)} placeholder="Bank name" />
          <input value={bankColor} onChange={e=>setBankColor(e.target.value)} placeholder="#2563eb" />
          <button className="primary" type="submit">+ Bank</button>
        </div>
      </form>

      {/* Person */}
      <form onSubmit={onAddPerson} style={box}>
        <div style={row}>
          <label style={label}>Person</label>
          <input value={personName} onChange={e=>setPersonName(e.target.value)} placeholder="Full name" />
          <input type="number" min="8" max="60" value={personCap} onChange={e=>setPersonCap(e.target.value)} title="Capacity h/week" />
          <input value={personColor} onChange={e=>setPersonColor(e.target.value)} placeholder="#6b7280" />
          <button className="primary" type="submit">+ Person</button>
        </div>
      </form>

      {/* Project */}
      <form onSubmit={onAddProject} style={box}>
        <div style={{...row, alignItems:'stretch'}}>
          <label style={label}>Project</label>
          <input value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="Project name" />
          <select value={projectBankId} onChange={e=>setProjectBankId(e.target.value)}>
            <option value="">Bank…</option>
            {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button className="primary" type="submit" disabled={!projectName || !projectBankId}>+ Project</button>
        </div>
      </form>

      <div style={{fontSize:12, color:'#64748b'}}>
        Adding a project will make it available in <b>Projects & Phases</b>.  
        Add phases there and drag them into the grid to schedule.
      </div>
    </div>
  )
}

const box  = { border:'1px solid #e5e7eb', borderRadius:10, padding:8, background:'#fff', marginBottom:10 }
const row  = { display:'grid', gridTemplateColumns:'70px 1fr 130px 120px', gap:8, alignItems:'center' }
const label= { fontSize:12, color:'#64748b' }
