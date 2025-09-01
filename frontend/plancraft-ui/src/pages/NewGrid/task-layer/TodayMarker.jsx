import React, { useMemo } from 'react'

const DAY = 24 * 60 * 60 * 1000
const toDay = d => { const x = new Date(d); x.setHours(0,0,0,0); return x }

export default function TodayMarker({ gridStart, zoom, colW }) {
  const left = useMemo(() => {
    if (!gridStart || !colW) return 0
    const daysPerCol = zoom === 'day' ? 1 : (zoom === 'week' ? 7 : 14)
    const diffDays = Math.floor((toDay(new Date()) - toDay(gridStart)) / DAY)
    const col = diffDays / daysPerCol
    return Math.max(0, Math.round(col * colW))
  }, [gridStart, zoom, colW])

  return (
    <>
      <div className="ng-today" style={{ left }} />
    </>
  )
}
