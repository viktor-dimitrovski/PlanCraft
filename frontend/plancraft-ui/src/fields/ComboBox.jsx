// src/fields/ComboBox.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * ComboBox (single-file, reusable)
 * Props:
 *  - items: Array<{ value: any, label: string }>
 *  - value: any
 *  - onChange: (value) => void
 *  - placeholder?: string = 'Select…'
 *  - width?: number|string = 240
 *  - disabled?: boolean
 *  - ariaLabel?: string
 *  - clearable?: boolean = false
 *  - className?: string
 *  - style?: React.CSSProperties
 */
export default function ComboBox({
  items = [],
  value,
  onChange,
  placeholder = 'Select…',
  width = 240,
  disabled = false,
  ariaLabel,
  clearable = false,
  className = '',
  style = {},
}) {
  // --- inject styles once ---
  useEffect(() => {
    const id = 'cbx-style-global';
    if (!document.getElementById(id)) {
      const css = `
/* ================================================= */
/* ComboBox (namespaced .cbx-*)                      */
/* ================================================= */
.cbx { position: relative; }
.cbx__btn {
  position: relative;              /* for chev absolute */
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 0 10px 0 12px;
  padding-right: 56px;             /* space for clear + chevron */
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 0 rgba(0,0,0,0.03);
  transition: border-color .15s, box-shadow .15s;
  cursor: pointer;
}
.cbx__btn:hover { border-color: #d1d5db; }
.cbx__btn:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
.cbx__value { font-size: 14px; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cbx__value.is-placeholder { color: #6b7280; }

/* Chevron fixed at far right */
.cbx__chev {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  opacity: .6;
}

/* Clear button is sibling of .cbx__btn; positioned over the right side */
.cbx__clearBtn {
  position: absolute;
  right: 34px;                     /* just left of chevron */
  top: 50%;
  transform: translateY(-50%);
  width: 22px; height: 22px;
  border: 0; background: transparent; color: #6b7280;
  font-size: 16px; line-height: 22px; border-radius: 6px; cursor: pointer;
  z-index: 2;
}
.cbx__clearBtn:hover { background: #f3f4f6; }
/* Hide X when closed */
.cbx:not(.is-open) .cbx__clearBtn { display: none; }

.cbx__pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 60;
  width: max(220px, 100%);
  max-width: 360px;
  background: #fff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 12px 32px rgba(0,0,0,0.10), 0 3px 8px rgba(0,0,0,0.06);
  border-radius: 12px;
}

.cbx__searchWrap { position: relative; padding: 8px; border-bottom: 1px solid #f3f4f6; }
.cbx__search {
  width: 100%;
  height: 34px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0 28px 0 10px;
  font-size: 14px;
}
.cbx__x {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  width: 24px; height: 24px; border: 0; background: transparent; color: #6b7280;
  font-size: 18px; line-height: 24px; border-radius: 6px; cursor: pointer;
}
.cbx__x:hover { background: #f3f4f6; }

.cbx__list { max-height: 260px; overflow: auto; padding: 6px; }
.cbx__opt {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 14px;
}
.cbx__opt:hover { background: #f9fafb; }
.cbx__opt.is-selected { background: #eef2ff; color: #3730a3; }
.cbx__tick { font-size: 14px; opacity: .8; }
.cbx__empty { padding: 12px; color: #6b7280; font-size: 14px; }
      `.trim();
      const tag = document.createElement('style');
      tag.id = id;
      tag.type = 'text/css';
      tag.appendChild(document.createTextNode(css));
      document.head.appendChild(tag);
    }
  }, []);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(-1); // keyboard highlight
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);

  const selected = useMemo(
    () => items.find(it => String(it?.value) === String(value)) || null,
    [items, value]
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter(it => (it?.label || '').toLowerCase().includes(qq));
  }, [items, q]);

  // close on outside click
  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // reset active when list changes or opens
  useEffect(() => {
    if (open) {
      setActive(filtered.findIndex(it => String(it?.value) === String(value)));
      // focus search on open
      setTimeout(() => searchRef.current?.focus(), 0);
    } else {
      setQ('');
      setActive(-1);
    }
  }, [open, filtered, value]);

  // keyboard handling on button & input
  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => {
        const next = Math.min((i < 0 ? -1 : i) + 1, filtered.length - 1);
        scrollIntoView(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => {
        const prev = Math.max((i < 0 ? filtered.length : i) - 1, 0);
        scrollIntoView(prev);
        return prev;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && active < filtered.length) {
        const it = filtered[active];
        onChange?.(it.value);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  const scrollIntoView = (idx) => {
    const list = listRef.current;
    const el = list?.querySelector(`[data-idx="${idx}"]`);
    if (list && el) {
      const lTop = list.scrollTop;
      const lBot = lTop + list.clientHeight;
      const eTop = el.offsetTop;
      const eBot = eTop + el.offsetHeight;
      if (eTop < lTop) list.scrollTop = eTop;
      if (eBot > lBot) list.scrollTop = eBot - list.clientHeight;
    }
  };

  const wStyle = typeof width === 'number' ? { width: `${width}px` } : { width };

  return (
    <div
      className={`cbx ${open ? 'is-open' : ''} ${className}`}
      ref={rootRef}
      style={{ ...wStyle, ...style }}
    >
      <button
        type="button"
        className="cbx__btn"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        onClick={() => setOpen(o => !o)}
        onKeyDown={onKeyDown}
      >
        <span className={`cbx__value ${selected ? '' : 'is-placeholder'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="cbx__chev" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Clear button is sibling (no nested <button>) */}
      {clearable && selected && (
        <button
          type="button"
          className="cbx__clearBtn"
          aria-label="Clear selection"
          onClick={(e) => { e.stopPropagation(); onChange?.(null); }}
        >
          ×
        </button>
      )}

      {open && (
        <div className="cbx__pop" role="listbox" onKeyDown={onKeyDown}>
          <div className="cbx__searchWrap">
            <input
              ref={searchRef}
              className="cbx__search"
              placeholder="Search…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            {q && (
              <button className="cbx__x" onClick={() => setQ('')} aria-label="Clear">×</button>
            )}
          </div>

          <div className="cbx__list" ref={listRef}>
            {filtered.length === 0 && <div className="cbx__empty">No matches</div>}
            {filtered.map((it, idx) => {
              const isSel = String(it.value) === String(value);
              const isAct = idx === active;
              return (
                <div
                  key={it.value}
                  data-idx={idx}
                  className={`cbx__opt ${isSel ? 'is-selected' : ''}`}
                  role="option"
                  aria-selected={isSel}
                  style={isAct ? { outline: '2px solid #bfdbfe' } : null}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => { onChange?.(it.value); setOpen(false); }}
                >
                  <div className="cbx__optLabel">{it.label}</div>
                  {isSel && <span className="cbx__tick">✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
