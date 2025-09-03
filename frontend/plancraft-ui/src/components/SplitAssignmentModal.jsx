import React, { useState } from 'react';
import { usePlanStore } from '../state/usePlanStore';

export default function SplitAssignmentModal({ assignment, people, onClose }) {
  const split = usePlanStore(s => s.splitPhaseAssignment);
  const [mode, setMode] = useState('time'); // 'time' | 'percent'
  const [personIdRight, setPersonIdRight] = useState('');
  const [splitAfterDays, setSplitAfterDays] = useState(1);
  const [leftPercent, setLeftPercent] = useState(50);

  const submit = () => {
    if (!personIdRight) return;
    if (mode === 'time') {
      split({
        assignmentId: assignment.Id,
        mode: 'time',
        payload: { splitAfterDays: Number(splitAfterDays), personIdRight },
      });
    } else {
      split({
        assignmentId: assignment.Id,
        mode: 'percent',
        payload: { leftPercent: Number(leftPercent), personIdRight },
      });
    }
    onClose?.();
  };

  return (
    <div className="ap-modal">
      <div className="ap-modal-card">
        <div className="ap-modal-header">
          <h3>Split PhaseAssignment</h3>
          <button className="ap-btn ghost" onClick={onClose}>×</button>
        </div>

        <div className="ap-modal-body">
          <div className="ap-field">
            <label>Mode</label>
            <select value={mode} onChange={e => setMode(e.target.value)}>
              <option value="time">By time (sequential)</option>
              <option value="percent">By percent (parallel)</option>
            </select>
          </div>

          {mode === 'time' && (
            <div className="ap-field">
              <label>Split after (days)</label>
              <input
                type="number"
                min={1}
                max={assignment.AssignedDays - 1}
                value={splitAfterDays}
                onChange={e => setSplitAfterDays(e.target.value)}
              />
              <small>Total: {assignment.AssignedDays} days</small>
            </div>
          )}

          {mode === 'percent' && (
            <div className="ap-field">
              <label>Left segment percent</label>
              <input
                type="number"
                min={1}
                max={99}
                value={leftPercent}
                onChange={e => setLeftPercent(e.target.value)}
              />
              <small>Right gets {100 - leftPercent}%</small>
            </div>
          )}

          <div className="ap-field">
            <label>Assign right segment to</label>
            <select value={personIdRight} onChange={e => setPersonIdRight(e.target.value)}>
              <option value="">Select person…</option>
              {people.map(p => (
                <option key={p.Id} value={p.Id}>{p.Name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="ap-modal-footer">
          <button className="ap-btn" onClick={submit}>Split</button>
          <button className="ap-btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
