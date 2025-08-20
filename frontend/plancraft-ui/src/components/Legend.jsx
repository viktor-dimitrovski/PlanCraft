import React from 'react'
export default function Legend({ projects }){
  return (
    <div className="legend">
      {projects.map(p => (
        <span key={p.id}><i className="legendDot" style={{ background:p.color || p.bank?.color }}></i>{p.name}</span>
      ))}
    </div>
  )
}
