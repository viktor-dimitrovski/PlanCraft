import React, { useEffect, useRef } from 'react'

/**
 * Resizable sidebar (left or right)
 * - Updates CSS vars: --leftWidth / --rightWidth
 * - Syncs container gridTemplateColumns
 * - Pointer/mouse/touch safe (works with dnd-kit)
 */
export default function ResizableSidebar({
  children,
  side = 'left',                   // 'left' | 'right'
  min = 240,
  max = 720,
  initial = 320,
  storageKey,
}) {
  const asideRef = useRef(null)
  const containerRef = useRef(null)
  const varName = side === 'right' ? '--rightWidth' : '--leftWidth'
  const key = storageKey || (side === 'right' ? 'plancraft.rightWidth' : 'plancraft.leftWidth')

  const getContainer = () => {
    if (containerRef.current) return containerRef.current
    let el = asideRef.current?.closest('.container')
    if (!el) el = document.querySelector('.container')
    containerRef.current = el
    return el
  }

  const applyWidth = (px) => {
    const val = `${px}px`
    document.documentElement.style.setProperty(varName, val)
    if (asideRef.current) asideRef.current.style.width = val

    const cont = getContainer()
    if (cont) {
      const computed = getComputedStyle(cont).gridTemplateColumns.split(' ')
      const left  = computed[0] || '360px'
      const mid   = '1fr'
      const right = computed[computed.length - 1] || '320px'
      cont.style.gridTemplateColumns =
        side === 'right' ? `${left} ${mid} ${val}` : `${val} ${mid} ${right}`
    }
    try { localStorage.setItem(key, String(px)) } catch {}
  }

  useEffect(() => {
    const saved = parseInt(localStorage.getItem(key) || '0', 10)
    const start = Number.isFinite(saved) && saved > 0 ? saved : initial
    applyWidth(Math.max(min, Math.min(max, start)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const begin = (startX) => {
    const startW = asideRef.current?.getBoundingClientRect().width || initial
    const move = (clientX) => {
      const dx = clientX - startX
      const raw = side === 'right' ? startW - dx : startW + dx
      const clamped = Math.min(max, Math.max(min, raw))
      applyWidth(clamped)
    }
    const stop = () => {
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', onMM, true)
      window.removeEventListener('mouseup', onMU, true)
      window.removeEventListener('touchmove', onTM, { capture:true })
      window.removeEventListener('touchend', onTU, true)
    }
    const onMM = (e) => { e.preventDefault(); move(e.clientX) }
    const onMU = (e) => { e.preventDefault(); stop() }
    const onTM = (e) => { const t = e.touches?.[0]; if (!t) return; e.preventDefault(); move(t.clientX) }
    const onTU = (e) => { e.preventDefault(); stop() }

    window.addEventListener('mousemove', onMM, true)
    window.addEventListener('mouseup', onMU, true)
    window.addEventListener('touchmove', onTM, { passive:false, capture:true })
    window.addEventListener('touchend', onTU, true)
    document.body.style.cursor = 'col-resize'
  }

  const onMouseDown  = (e) => { e.preventDefault(); begin(e.clientX) }
  const onTouchStart = (e) => { const t=e.touches?.[0]; if(!t) return; e.preventDefault(); begin(t.clientX) }

  return (
    <aside className="sidebar" ref={asideRef}>
      <div className="resizer" onMouseDown={onMouseDown} onTouchStart={onTouchStart} />
      {children}
    </aside>
  )
}
