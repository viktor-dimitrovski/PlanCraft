
// Calendar helpers for NewGrid

function pad(n){ return String(n).padStart(2,'0') }

export function startOfUnit(date, unit){
  const d = new Date(date)
  if(unit === 'week' || unit === '2week'){
    // Start Monday
    const day = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - day)
    d.setHours(0,0,0,0)
    return d
  }
  if(unit === 'month'){
    return new Date(d.getFullYear(), d.getMonth(), 1)
  }
  d.setHours(0,0,0,0)
  return d
}

function endOfUnit(start, unit){
  const d = new Date(start)
  if(unit === 'day'){
    d.setDate(d.getDate()+0) // same day
  }else if(unit === 'week'){
    d.setDate(d.getDate()+6)
  }else if(unit === '2week'){
    d.setDate(d.getDate()+13)
  }else{
    d.setMonth(d.getMonth()+1); d.setDate(0)
  }
  d.setHours(23,59,59,999)
  return d
}

function isMonthStart(d){ return d.getDate()===1 }

export function buildColumns(from, to, zoom){
  const cols = []
  const f = new Date(from); f.setHours(0,0,0,0)
  const t = new Date(to);   t.setHours(0,0,0,0)

  if(zoom === 'day'){
    for(let d=new Date(f); d < t; d.setDate(d.getDate()+1)){
      const key = 'd'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())
      cols.push({
        key, start: new Date(d), end: endOfUnit(d,'day'),
        label: String(d.getDate()),
        weekEdge: ((d.getDay()+6)%7)===0,
        monthEdge: isMonthStart(d)
      })
    }
    return cols
  }

  if(zoom === 'week'){
    for(let s=startOfUnit(f,'week'); s < t; s.setDate(s.getDate()+7)){
      const e = endOfUnit(s,'week')
      const sd = s.getDate(), ed = e.getDate()
      const key = 'w'+s.toISOString().slice(0,10)
      cols.push({
        key, start: new Date(s), end: e,
        label: `${sd} – ${ed}`,
        weekEdge: true,
        monthEdge: s.getDate()===1
      })
    }
    return cols
  }

  // 2-week
  for(let s=startOfUnit(f,'2week'); s < t; s.setDate(s.getDate()+14)){
    const e = endOfUnit(s,'2week')
    const sd = s.getDate(), ed = e.getDate()
    const key = 'f'+s.toISOString().slice(0,10)
    cols.push({
      key, start: new Date(s), end: e,
      label: `${sd} – ${ed}`,
      weekEdge: true
    })
  }
  return cols
}

export function buildMonthSegments(from, to, zoom){
  const cols = buildColumns(from, to, zoom)
  const segments = []
  for(const c of cols){
    const mkey = c.start.getFullYear()+'-'+pad(c.start.getMonth()+1)
    const label = c.start.toLocaleDateString(undefined,{ month:'long' })
    const last = segments[segments.length-1]
    if(last && last.mkey === mkey){
      last.span += 1
    }else{
      segments.push({ key:'m'+mkey+'-'+segments.length, mkey, label, span:1 })
    }
  }
  return { cols, months: segments }
}
