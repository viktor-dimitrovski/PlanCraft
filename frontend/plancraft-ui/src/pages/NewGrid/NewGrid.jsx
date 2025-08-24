
import React, { useMemo, useRef, useState, useEffect } from 'react'
import ResizableSidebar from '../../components/ResizableSidebar'
import { buildMonthSegments } from './calendar'
import './newgrid.css'

// Generate demo people list (placeholder). In later steps we'll wire true data.
const demoPeople = Array.from({length: 24}, (_,i)=>({ id:'P'+(i+1), name: `Person ${i+1}` }))

export default function NewGrid(){
  // --- Controls ---
  const [zoom, setZoom] = useState('day') // 'day' | 'week' | '2week'
  const [monthSpan, setMonthSpan] = useState(12)
  const [startMonth, setStartMonth] = useState(()=>{
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,7) // yyyy-mm
  })

  // Compute time range
  const { from, to } = useMemo(()=>{
    const [y,m] = startMonth.split('-').map(Number)
    const from = new Date(y, m-1, 1)
    const to = new Date(y, (m-1) + monthSpan, 1)
    return { from, to }
  }, [startMonth, monthSpan])

  // Column width heuristics (denser for daily)
  const colW = zoom === 'day' ? 36 : zoom === 'week' ? 96 : 128

  // Build calendar columns & months for headers
  const { cols, months } = useMemo(()=>buildMonthSegments(from, to, zoom), [from, to, zoom])

  // Expose CSS var for column width
  useEffect(()=>{
    document.documentElement.style.setProperty('--ng-colW', colW+'px')
  }, [colW])

  return (
    <div className="ng-shell">
      {/* Toolbar */}
      <div className="ng-toolbar">
        <div className="ng-pill">
          <span className="ng-label">Zoom</span>
          <select className="ng-select" value={zoom} onChange={e=>setZoom(e.target.value)}>
            <option value="day">Daily</option>
            <option value="week">Week</option>
            <option value="2week">2 Weeks</option>
          </select>
        </div>

        <div className="ng-pill">
          <span className="ng-label">Start</span>
          <input className="ng-input" type="month" value={startMonth} onChange={e=>setStartMonth(e.target.value)} />
        </div>

        <div className="ng-pill">
          <span className="ng-label">Months</span>
          <select className="ng-select" value={monthSpan} onChange={e=>setMonthSpan(Number(e.target.value))}>
            {[6,9,12,15,18,24,36].map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Left Sidebar (resizable) */}
      <ResizableSidebar side="left" min={220} max={560} initial={320} storageKey="ng-left">
        <div className="ng-left">
          <div className="ng-person" style={{height:'var(--ng-headerH1)'}}>People</div>
          <div className="ng-person" style={{height:'var(--ng-headerH2)'}}> </div>
          <div className="people">
            {demoPeople.map(p=> <div key={p.id} className="ng-person">{p.name}</div>)}
          </div>
        </div>
      </ResizableSidebar>

      {/* Grid area */}
      <div className="ng-gridWrap">
        <div className="ng-scroll">
          {/* Body: left lanes + right background grid */}
          <div className="ng-body">
            <div className="ng-bodyLeft">
              <div className="ng-leftHeaderSpacer" />
              {/* Mirror the header height so body rows align */}
              
              {demoPeople.map(p => (
                <div key={p.id} className="ng-person">{p.name}</div>
              ))}
            </div>

            <div className="ng-bodyRight">
              {/* Background grid columns */}
              
              
              {/* Header rows (sticky) — now constrained to right grid */}
              <div className="ng-header">
                <div className="ng-headerRow1" style={{gridTemplateColumns:`repeat(${cols.length}, var(--ng-colW))`}}>
                  {months.map(m => (
                    <div key={m.key} className="ng-monthCell" style={{gridColumn:`span ${m.span}`}}>{m.label}</div>
                  ))}
                </div>
                <div className="ng-headerRow2" style={{gridTemplateColumns:`repeat(${cols.length}, var(--ng-colW))`}}>
                  {cols.map(c => (
                    <div key={c.key} className="ng-colLabel">{c.label}</div>
                  ))}
                </div>
              </div>

<div className="ng-gridBg" style={{gridTemplateColumns:`repeat(${cols.length}, var(--ng-colW))`}}>
                {cols.map(col => (
                  <div key={col.key} className="ng-bgCol">
                    {demoPeople.map(p => (
                      <div key={p.id} className="ng-laneRow" />
                    ))}
                  </div>
                ))}
              </div>

              {/* Task layer placeholder */}
              <div className="ng-taskLayer">
                {/* future: absolutely-positioned cards go here */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
