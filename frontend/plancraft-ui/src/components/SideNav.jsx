// src/components/SideNav.jsx
import React from "react";
import { createPortal } from "react-dom";

export default function SideNav({ active, open, onClose }) {
  const links = [
    { href: "#/grid", label: "Planner", icon: IconCalendar },
    { href: "#/admin", label: "Admin", icon: IconCog },
    { href: '#/admin/phases',   label: 'Admin • Phases', icon: IconListCheck },
    { href: "#/planner", label: "Legacy Grid", icon: IconGrid },
  ];

  function IconListCheck(props){
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...props}>
        <path d="M4 6h10M4 12h10M4 18h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M17 7l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }

  // Mount the drawer + backdrop to <body> so they sit above any headers/toolbars
  return createPortal(
    <>
      <nav
        className={open ? "sidenav is-open" : "sidenav"}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="sidenav__brand">
          <span className="sidenav__gh">PG</span>
          <span className="sidenav__title">Planning Grid</span>
          <button
            className="sidenav__close"
            onClick={onClose}
            aria-label="Close menu"
            title="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 5l14 14M19 5L5 19"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="sidenav__group">
          {links.map((link) => {
            const isActive = (active || "").startsWith(link.href.slice(1));
            const Icon = link.icon;
            return (
              <a
                key={link.href}
                href={link.href}
                className={"sidenav__item " + (isActive ? "active" : "")}
                title={link.label}
                onClick={onClose}
              >
                <Icon className="sidenav__icon" />
                <span className="sidenav__label">{link.label}</span>
              </a>
            );
          })}

          {/* --- Minimal addition: direct submenu links to Admin sections --- */}
          <div style={{ marginLeft: 28, marginTop: 6 }}>
            <a href="#/admin?tab=banks"       className="sidenav__item" onClick={onClose}>• Banks</a>
            <a href="#/admin?tab=projects"    className="sidenav__item" onClick={onClose}>• Projects</a>
            <a href="#/admin?tab=phases"      className="sidenav__item" onClick={onClose}>• Phases</a>
            <a href="#/admin?tab=adminPhases" className="sidenav__item" onClick={onClose}>• Phases (Advanced)</a>
            <a href="#/admin?tab=tasks"       className="sidenav__item" onClick={onClose}>• Tasks</a>
            <a href="#/admin?tab=users"       className="sidenav__item" onClick={onClose}>• Users</a>
          </div>
          {/* --- end minimal addition --- */}
        </div>
      </nav>

      {/* Backdrop (div, not button → avoids global button:hover styles) */}
      <div
        className={open ? "nav-backdrop is-open" : "nav-backdrop"}
        onClick={onClose}
        aria-hidden={!open}
        role="presentation"
      />
    </>,
    document.body
  );
}

function IconCalendar(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...props}>
      <path
        d="M7 2v3M17 2v3M3 8h18M5 21h14a2 2 0 0 0 2-2V8H3v11a2 2 0 0 0 2 2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconCog(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3-2.4 1a7 7 0 0 0-1.7-1l-.3-2.6h-4l-.3 2.6a7 7 0 0 0-1.7 1l-2.4-1-2 3 2 1.5a7 7 0 0 0 0 2L4.1 14.5l2 3 2.4-1a7 7 0 0 0 1.7 1l.3 2.6h4l.3-2.6a7 7 0 0 0 1.7-1l2.4 1 2-3-2-1.5a7 7 0 0 0 .1-1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconGrid(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...props}>
      <path
        d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}
