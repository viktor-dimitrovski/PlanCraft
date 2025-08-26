// Helper math for DnD grid snapping & auto-scroll

export function daysPerColumn(zoom){
  if(zoom === 'day') return 1
  if(zoom === 'week') return 7
  // fallback / bi-weekly (fortnight) as a default third step
  return 14
}

export function clamp(v, min, max){
  return Math.min(max, Math.max(min, v))
}

export function addDays(date, days){
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// Find nearest scrollable parent
export function getScrollParent(el){
  let node = el
  while(node){
    const style = node instanceof Element ? getComputedStyle(node) : null
    if(style && (/(auto|scroll)/).test(style.overflow + style.overflowY + style.overflowX)){
      return node
    }
    node = node.parentElement || node.parentNode
  }
  return el?.ownerDocument?.scrollingElement || document.scrollingElement || null
}

// Auto-scroll when pointer near edges
export function applyAutoScroll(container, pointer, opts = {}){
  if(!container) return
  const edge = opts.edge ?? 48
  const maxSpeed = opts.maxSpeed ?? 32

  const rect = container.getBoundingClientRect()
  let dx = 0, dy = 0

  const leftDist = pointer.x - rect.left
  const rightDist = rect.right - pointer.x
  const topDist = pointer.y - rect.top
  const botDist = rect.bottom - pointer.y

  if(leftDist < edge) dx = -lerpSpeed(leftDist, edge, maxSpeed)
  else if(rightDist < edge) dx = lerpSpeed(rightDist, edge, maxSpeed)

  if(topDist < edge) dy = -lerpSpeed(topDist, edge, maxSpeed)
  else if(botDist < edge) dy = lerpSpeed(botDist, edge, maxSpeed)

  if(dx !== 0 || dy !== 0){
    container.scrollBy({ left: dx, top: dy, behavior: 'auto' })
  }
}

function lerpSpeed(dist, edge, maxSpeed){
  const t = Math.max(0, Math.min(1, (edge - dist) / edge))
  return Math.round(t * maxSpeed)
}