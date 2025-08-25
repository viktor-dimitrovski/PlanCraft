// src/components/admin/VerificationPage.jsx
import React, { useMemo, useState } from 'react'

export default function VerificationPage({ phase, criteria, onBack, onUpdateStatus }) {
  const [filter, setFilter] = useState('all')
  const list = useMemo(() => {
    return criteria.filter(c => {
      if (filter==='required') return c.isRequired
      if (filter==='open') return c.isRequired && !(c.status===1 || c.status===3 || c.status===4)
      return true
    })
  }, [criteria, filter])

  const req = criteria.filter(c=>c.isRequired)
  const ok = req.filter(c=>c.status===1 || c.status===3 || c.status===4).length
  const pct = req.length ? Math.round((ok/req.length)*100) : 0

  return (
    <div className="ap-verify">
      <header className="ap-verify__head">
        <button className="ap-btn ghost" onClick={onBack}>← Back</button>
        <div className="ap-verify__title">Verification — {phase?.title}</div>
        <div className="ap-verify__sum">{ok}/{req.length} required · {criteria.length} total · {pct}%</div>
        <select className="ap-select" value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="required">Required only</option>
          <option value="open">Open required</option>
        </select>
      </header>

      <div className="ap-verify__grid">
        {list.map(c => (
          <div key={c.id} className={'ap-card ' + (c.status===1?'is-pass': c.status===2?'is-fail': (c.status===3||c.status===4)?'is-note':'')}>
            <div className="ap-card__title">{c.title}</div>
            <div className="ap-card__meta">{c.isRequired ? 'Required' : 'Optional'}</div>
            {c.note && <div className="ap-card__note">Note: {c.note}</div>}
            <div className="ap-card__actions">
              <button className="ap-btn" onClick={()=>onUpdateStatus(c.id,1)}>Pass</button>
              <button className="ap-btn danger" onClick={()=>onUpdateStatus(c.id,2)}>Fail</button>
              <button className="ap-btn ghost" onClick={async ()=>{
                const note = prompt('Note (optional):', c.note || '') || ''
                await onUpdateStatus(c.id,3,note)
              }}>Accept w/ Note</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
