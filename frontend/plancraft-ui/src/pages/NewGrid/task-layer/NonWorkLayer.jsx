import React, { useEffect, useMemo, useState } from 'react'
import { workConfig, dayStatus } from '../work-calendar'

export default function NonWorkLayer({ cols, people, zoom, colW }) {
  const [laneH, setLaneH] = useState(56)
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement)
    setLaneH(parseFloat(cs.getPropertyValue('--ng-laneH')) || 56)
  }, [cols, zoom])

  const daysPerCol = zoom === 'day' ? 1 : (zoom === 'week' ? 7 : 14)

  const blocks = useMemo(() => {
    const out = []
    if (!cols?.length) return out

    const MS = 24*60*60*1000
    const toDay = d => { const x = new Date(d); x.setHours(0,0,0,0); return x }
    const gridStart = toDay(cols[0].start)
    const totalCols = cols.length
    const totalDays = totalCols * daysPerCol

    for (let row = 0; row < people.length; row++) {
      const personId = people[row]?.id
      for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
        const d = new Date(gridStart.getTime() + dayOffset*MS)
        const st = dayStatus(personId, d, workConfig)
        if (!st.nonWork) continue

        const colIdx = Math.floor(dayOffset / daysPerCol)
        const part   = dayOffset % daysPerCol
        const left   = Math.round(colIdx * colW + part * (colW / daysPerCol))
        const top    = Math.round(row * laneH)
        const width  = Math.max(1, Math.round(colW / daysPerCol))
        const height = laneH

        out.push({
          key: `${personId}-${d.toISOString()}`,
          left, top, width, height,
          className: st.onLeave ? 'ng-nonwork ng-nonwork--leave'
                    : st.holiday ? 'ng-nonwork ng-nonwork--holiday'
                    : 'ng-nonwork ng-nonwork--weekend'
        })
      }
    }
    return out
  }, [cols, people, zoom, colW, laneH])

  return (
    <div className="ng-nonworkLayer">
      {blocks.map(b => (
        <div key={b.key} className={b.className}
             style={{ left:b.left, top:b.top, width:b.width, height:b.height }} />
      ))}
    </div>
  )
}
