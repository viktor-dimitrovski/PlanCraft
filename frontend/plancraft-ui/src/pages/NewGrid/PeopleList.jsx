import React from 'react'

export default function PeopleList({ people = [] }){
  return (
    <div className="people">
      {people.map(p => (
        <div key={p.id} className="ng-person" title={p.name}>
          <span className="dot" style={{ background: p.color || '#64748b' }} />
          {p.name}
        </div>
      ))}
      {!people.length && <div className="ng-empty">No people</div>}
    </div>
  )
}