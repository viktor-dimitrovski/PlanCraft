// Work calendar configuration & helpers
const dayKey = d => { const x = new Date(d); x.setHours(0,0,0,0); return x.toISOString().slice(0,10) }
const inRange = (d, isoFrom, isoTo) => {
  const t = new Date(d).getTime()
  return t >= new Date(isoFrom).setHours(0,0,0,0) && t <= new Date(isoTo).setHours(23,59,59,999)
}

export const workConfig = {
  weekends: [0, 6],
  companyHolidays: [
    '2025-09-01', // Bank Holiday (example)
  ],
  leavesByPerson: {
    2: [['2025-08-27','2025-08-27']],
    1: [['2025-09-03','2025-09-03']],
  }
}

export function isWeekend(date, cfg=workConfig){ return cfg.weekends.includes(new Date(date).getDay()) }
export function isCompanyHoliday(date, cfg=workConfig){ return cfg.companyHolidays.includes(dayKey(date)) }
export function isOnLeave(personId, date, cfg=workConfig){
  const ranges = cfg.leavesByPerson?.[personId] || []
  return ranges.some(([fromISO,toISO]) => inRange(date, fromISO, toISO))
}
export function dayStatus(personId, date, cfg=workConfig){
  const weekend = isWeekend(date, cfg)
  const holiday = isCompanyHoliday(date, cfg)
  const onLeave = isOnLeave(personId, date, cfg)
  const nonWork = weekend || holiday || onLeave
  return { weekend, holiday, onLeave, nonWork }
}
