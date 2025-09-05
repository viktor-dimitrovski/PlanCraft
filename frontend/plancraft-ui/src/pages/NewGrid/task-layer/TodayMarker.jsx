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
  // Inline styles to make the marker self‑contained (no external CSS dependency)
  const lineStyle = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    background: '#ef4444', // red-500
    transform: 'translateX(-1px)', // visually center the 2px line on the day column
    pointerEvents: 'none',
    zIndex: 5
  }

  const dotStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 8,
    height: 8,
    borderRadius: 9999,
    background: '#fff',
    border: '2px solid #ef4444',
    transform: 'translate(-50%, -50%)',
    boxSizing: 'border-box',
    pointerEvents: 'none',
    zIndex: 6
  }

   return (

    <div style={{ ...lineStyle, left }} aria-label="Today marker">
      <span style={dotStyle} />
    </div>
   )
 }
