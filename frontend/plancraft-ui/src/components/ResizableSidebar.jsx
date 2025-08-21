import React, { useEffect, useRef } from 'react'

/**
 * Sidebar resizer
 * - Sets inline width on <aside> and inline gridTemplateColumns on the container
 * - Writes/reads --leftWidth for consistency with CSS
 * - Works with pointer/mouse/touch; safe with dnd-kit
 */
export default function ResizableSidebar({ children, min = 240, max = 720, storageKey = 'plancraft.leftWidth' }) {
  const asideRef = useRef(null)
  const containerRef = useRef(null)

  const getContainer = () => {
    if (containerRef.current) return containerRef.current
    let el = asideRef.current?.closest('[data-grid-container]')
    if (!el) el = asideRef.current?.closest('.container')
    if (!el) el = document.querySelector('[data-grid-container]') || document.querySelector('.container')
    containerRef.current = el
    return el
  }

  const applyWidth = (px) => {
    const val = `${px}px`
    // 1) set CSS var (for CSS-based layouts)
    document.documentElement.style.setProperty('--leftWidth', val)
    // 2) hard guarantee: inline width on <aside>
    if (asideRef.current) asideRef.current.style.width = val
    // 3) sync container columns inline (hard guarantee)
    const cont = getContainer()
    if (cont) {
      const right = getComputedStyle(cont).gridTemplateColumns.split(' ').pop() || '320px'
      cont.style.gridTemplateColumns = `${val} 1fr ${right}`
    }
    try { localStorage.setItem(storageKey, String(px)) } catch {}
  }

  useEffect(() => {
    const saved = parseInt(localStorage.getItem(storageKey) || '0', 10)
    const start = Number.isFinite(saved) && saved > 0 ? saved : parseInt(getComputedStyle(document.documentElement).getPropertyValue('--leftWidth')) || 360
    applyWidth(Math.min(max, Math.max(min, start)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const begin = (startX) => {
    const startW = asideRef.current?.getBoundingClientRect().width || 360
    const move = (clientX) => {
      const raw = startW + (clientX - startX)
      const clamped = Math.min(max, Math.max(min, raw))
      applyWidth(clamped)
    }
    const stop = () => {
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', onPM, true)
      window.removeEventListener('pointerup', onPU, true)
      window.removeEventListener('mousemove', onMM, true)
      window.removeEventListener('mouseup', onMU, true)
      window.removeEventListener('touchmove', onTM, { capture:true })
      window.removeEventListener('touchend', onTU, true)
    }
    const onPM = e => { e.preventDefault(); e.stopPropagation(); move(e.clientX) }
    const onPU = e => { e.preventDefault(); e.stopPropagation(); stop() }
    const onMM = e => { e.preventDefault(); e.stopPropagation(); move(e.clientX) }
    const onMU = e => { e.preventDefault(); e.stopPropagation(); stop() }
    const onTM = e => {
      if (!e.touches?.[0]) return
      e.preventDefault(); e.stopPropagation(); move(e.touches[0].clientX)
    }
    const onTU = e => { e.preventDefault(); e.stopPropagation(); stop() }

    window.addEventListener('pointermove', onPM, true)
    window.addEventListener('pointerup', onPU, true)
    window.addEventListener('mousemove', onMM, true)
    window.addEventListener('mouseup', onMU, true)
    window.addEventListener('touchmove', onTM, { passive:false, capture:true })
    window.addEventListener('touchend', onTU, true)
    document.body.style.cursor = 'col-resize'
  }

  const onPointerDown = (e) => { e.preventDefault(); e.stopPropagation(); begin(e.clientX) }
  const onMouseDown   = (e) => { e.preventDefault(); e.stopPropagation(); begin(e.clientX) }
  const onTouchStart  = (e) => { const t=e.touches?.[0]; if(!t) return; e.preventDefault(); e.stopPropagation(); begin(t.clientX) }

  return (
    <aside className="sidebar" ref={asideRef}>
      <div className="resizer" onPointerDown={onPointerDown} onMouseDown={onMouseDown} onTouchStart={onTouchStart} />
      {children}
    </aside>
  )
}
