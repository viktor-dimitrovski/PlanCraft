import { addDays, addWeeks, format, startOfWeek } from 'date-fns'

export function monday(d){ return startOfWeek(d, { weekStartsOn: 1 }) }
export function fmt(d){ return format(d, 'yyyy-MM-dd') }
export function weeksBetween(a,b){
  const arr=[]; let i=0; let cur=monday(a)
  while(cur<=b){ arr.push({ start: cur, end: addDays(cur, 7), index: i++ }); cur = addWeeks(cur,1) }
  return arr
}
