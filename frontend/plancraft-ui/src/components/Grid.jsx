import React from 'react'
import { DndContext, useDroppable, useDraggable } from '@dnd-kit/core'
import { planPhase } from '../lib/api' 

function WeekHeader({ weeks, milestones }){
  return (
    <div className="headerRow" style={{position:'sticky', top:0, zIndex:5}}>
      <div style={{padding:'6px 10px', fontSize:12, color:'#64748b'}}>People \\ Weeks</div>
      <div className="weeks" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)`, position:'relative'}}>
        {weeks.map(w => <div key={w.index} className="weekCell">{new Date(w.start).toLocaleDateString()}</div>)}
        {milestones.map((m,i) => {
          const idx = weeks.findIndex(w => new Date(m.date) >= new Date(w.start) && new Date(m.date) < new Date(w.end))
          if (idx < 0) return null
          const left = `calc(${(idx+0.5)/weeks.length*100}% - 4px)`
          return <div title={`${m.projectName}: ${m.name} (${new Date(m.date).toLocaleDateString()})`} key={i} className="milestone" style={{ position:'absolute', top: 2, left, background: m.color }}></div>
        })}
      </div>
    </div>
  )
}

function PersonRow({ person, weeks, onDropCell, onDropTask, onTaskClick, onCreateTask }){
  return (
    <div className="row">
      <div className="personCell">
        <span className="personDot" style={{background: person.color || '#6b7280'}}></span>
        <div>
          <div style={{fontWeight:600}}>{person.name}</div>
          <div style={{fontSize:12, color:'#64748b'}}>{person.capacityHoursPerWeek} h/w</div>
        </div>
      </div>
      <RowGrid person={person} weeks={weeks} onDropCell={onDropCell} onDropTask={onDropTask} onTaskClick={onTaskClick} onCreateTask={onCreateTask} />
    </div>
  )
}

function RowGrid({ person, weeks, onDropCell, onDropTask, onTaskClick, onCreateTask }){
  return (
    <div className="rowGrid" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)`}}>
      {weeks.map(w => <Cell key={w.index} person={person} week={w} onDropCell={onDropCell} onCreateTask={onCreateTask} util={person.weeklyUtilization[w.index]} />)}
      {person.tasks.map(t => (
        <Task key={t.id} task={t} startIdx={t.weekIndex} span={t.weekSpan} onDropTask={onDropTask} onClick={onTaskClick} />
      ))}
    </div>
  )
}

function Cell({ person, week, onDropCell, onCreateTask, util }){
  const id = `cell:${person.id}:${week.index}`
  const { isOver, setNodeRef } = useDroppable({ id, data: { personId: person.id, weekIndex: week.index }})
  const utilColor = util<0.7? 'linear-gradient(90deg, #86efac, #22c55e)': util<1.0? 'linear-gradient(90deg, #fde68a, #f59e0b)': 'linear-gradient(90deg, #fecaca, #ef4444)'
  const onDbl = () => {
    const title = prompt('Create task title')
    if (!title) return
    onCreateTask(person.id, week.index, title)
  }
  return (
    <div ref={setNodeRef} className="cell" onDoubleClick={onDbl} style={{ background: isOver? 'rgba(59,130,246,.06)' : 'white' }}>
      <div className="utilBar" style={{ background: utilColor, opacity: .45 }}></div>
      <div className="utilLabel">{Math.round(util*100)}%</div>
    </div>
  )
}

function Task({ task, startIdx, span, onDropTask, onClick }){
  const id = `task:${task.id}`
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, data: { task }})
  const style = {
    gridColumn: `${startIdx+1} / span ${span}`,
    background: task.projectColor,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging? .8 : 1
  }
  const [hover, setHover] = React.useState(false)

  const onMouseDown = (e) => {
    e.stopPropagation()
    const startX = e.clientX
    const startSpan = span
    const onMove = (ev) => {
      const dx = ev.clientX - startX
      const cellW = (e.currentTarget.parentElement?.clientWidth || 1000) / (document.querySelectorAll('.weekCell').length || 12)
      const deltaCols = Math.round(dx / cellW)
      const newSpan = Math.max(1, startSpan + deltaCols)
      e.currentTarget.style.gridColumn = `${startIdx+1} / span ${newSpan}`
    }
    const onUp = (ev) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const dx = ev.clientX - startX
      const cellW = (e.currentTarget.parentElement?.clientWidth || 1000) / (document.querySelectorAll('.weekCell').length || 12)
      const deltaCols = Math.round(dx / cellW)
      const newSpan = Math.max(1, startSpan + deltaCols)
      onDropTask(task, task.assignments.find(a=>a.isPrimary)?.personId, startIdx, newSpan, ev.ctrlKey || ev.altKey, true)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div className={`task ${task.isCritical? 'critOutline':''} ${task.blocked? 'blockOutline':''}`} ref={setNodeRef} style={style} {...listeners} {...attributes}
         onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onClick={()=>onClick && onClick(task)}>
      <div className="assignmentStripes">
        {task.assignments.map(a => <div key={a.personId} style={{ width: `${a.sharePercent}%`, background: 'black' }} />)}
      </div>
      <span className="taskName" title={task.title}>{task.title}</span>
      <span className="taskTag">{task.projectName}{task.slackDays===0? ' • CP' : ''}</span>
      <div className="resizeHandle" onMouseDown={onMouseDown} title="Drag to resize (change duration). Ctrl/Alt+release to copy"></div>
      {hover && <TaskTooltip task={task} />}
    </div>
  )
}

function TaskTooltip({ task }){
  return (
    <div className="tooltip" style={{ top: -46, right: 0 }}>
      <div style={{fontWeight:600, marginBottom:4}}>Dependencies</div>
      {(task.dependencies?.length||0)===0 && <div style={{fontSize:12, color:'#64748b'}}>None</div>}
      {(task.dependencies||[]).map(d => (
        <div key={d.id} style={{fontSize:12}}>Depends on <b>{d.title}</b> ({d.projectName})</div>
      ))}
      {task.blocked && <div style={{marginTop:6, color:'#b45309'}}>⚠ Blocked by unmet predecessor</div>}
    </div>
  )
}

export default function Grid({ weeks, people, milestones, onCellDrop, onTaskMove, onTaskClick, onCreateTask }){
  const handleDragEnd = async (e) => {
    const { active, over } = e
    if (!over) return
    const data = active.data.current
    // Phase dropped onto a cell? Create a Task from phase:
    if (active.id.startsWith('phase:') && over.id.startsWith('cell:')){
      const [, personIdStr, weekIdxStr] = over.id.split(':')
      const personId = parseInt(personIdStr, 10)
      const weekIndex = parseInt(weekIdxStr, 10)
      const w = weeks[weekIndex]; if(!w) return
      const phaseId = parseInt(active.id.split(':')[1], 10)
      await planPhase(phaseId, { personId, startDateUtc: w.start, requiredSkills: [] })
      // After creating the new task, trigger reload via parent callback (reuse your existing refresh)
      // Easiest path: dispatch a custom event parent listens for, or expose a refresh prop.
      window.dispatchEvent(new Event('plancraft:refresh'))
      return
    }

    // Existing task moved
    if (active.id.startsWith('task:') && over.id.startsWith('cell:')){
      const [, personIdStr, weekIdxStr] = over.id.split(':')
      const copy = e?.activatorEvent?.altKey || e?.activatorEvent?.ctrlKey
      onTaskMove(data.task, parseInt(personIdStr,10), parseInt(weekIdxStr,10), undefined, copy, false)
    }
  }
  return (
    <div className="grid">
      <WeekHeader weeks={weeks} milestones={milestones} />
      <DndContext onDragEnd={handleDragEnd}>
        {people.map(p => <PersonRow key={p.id} person={p} weeks={weeks} onDropCell={()=>{}} onDropTask={onTaskMove} onTaskClick={onTaskClick} onCreateTask={onCreateTask} />)}
      </DndContext>
    </div>
  )
}
