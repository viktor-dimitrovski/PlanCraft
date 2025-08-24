import React, { useEffect, useMemo, useState } from 'react'

export default function TaskLayer({ cols, people, zoom, tasks = [], colWidth }) {
  const [laneH, setLaneH] = useState(56)

  useEffect(() => {
    const cs = getComputedStyle(document.documentElement)
    const lh = parseFloat(cs.getPropertyValue('--ng-laneH')) || 56
    setLaneH(lh)
  }, [cols, zoom])

  const daysPerCol = zoom === 'day' ? 1 : zoom === 'week' ? 7 : 14
  const colW = Number(colWidth ?? 120)

  const layout = useMemo(() => {
    const map = []
    const idToRow = new Map(people.map((p, i) => [p.id, i]))
    if (!cols || cols.length === 0) return map

    const DAY = 24 * 60 * 60 * 1000
    const toDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x }
    const gridStart = toDay(cols[0].start)
    const pxPerDay = colW / daysPerCol

    for (const t of tasks) {
      const rowIdx = idToRow.get(t.personId) ?? 0
      const start = toDay(t.start instanceof Date ? t.start : new Date(t.start))
      const dur   = Math.max(1, Number(t.durationDays || 1))

      const startDays = Math.floor((start - gridStart) / DAY)
      const left  = Math.round(startDays * pxPerDay)
      const width = Math.max(2, Math.round(dur * pxPerDay))
      const top   = Math.round(rowIdx * laneH + laneH / 2) // center; CSS uses translateY(-50%)

      map.push({ id: t.id, left, width, top, title: t.title ?? 'Task', color: t.color })
    }
    return map
  }, [tasks, people, cols, colW, laneH, daysPerCol])

  return (
    <div className="ng-taskLayer">
      {layout.map(card => (
        <div
          key={card.id}
          className="ng-card"
          style={{ left: card.left, top: card.top, width: card.width, borderLeftColor: card.color || '#2563eb' }}
        >
          <div className="ng-cardTitle">{card.title}</div>
        </div>
      ))}
    </div>
  )
}
