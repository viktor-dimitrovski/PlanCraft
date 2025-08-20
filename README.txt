PlanCraft v5 — Phases 1–5

Included:
- Phase 1: EF Migrations (init), Serilog, env var CS, Docker Compose, UTC converters, error handling.
- Phase 2: Resize to change duration, copy-on-drop (Ctrl/Alt), dependency names in tooltip, inline create on double-click, milestone panel.
- Phase 3: PTO & Holidays (capacity-adjusted heatbar), skills-aware auto-balance, utilization finder panel.
- Phase 4: Scenarios (create + overrides in grid), compare vs baseline (finish slip).
- Phase 5: Critical path & slack, blocker alerts, Monte Carlo forecast (P50/P90).

Quick Start
1) PostgreSQL up (or run docker-compose).
   - Local: default CS in backend/appsettings.json
   - Docker: `docker compose up --build` then open UI on http://localhost:5173 and API on http://localhost:5058/swagger

2) Backend
   cd backend/PlanCraft.Api
   dotnet restore
   dotnet run

3) Frontend
   cd frontend/plancraft-ui
   npm install
   npm run dev

Notes
- Resize: drag the small handle at the right of a task to change duration. Hold Ctrl/Alt during drop to copy.
- Inline create: double-click an empty cell to create a task for that person & week.
- Scenario dropdown: choose Baseline or a created scenario. Compare to see slip per project.
- Forecast: select a project and run Monte Carlo to get P50/P90 finish.
