PlanCraft — Visual 6‑month Planner (Drag & Drop)

Stack:
- Backend: ASP.NET Core 8 + EF Core + Npgsql (http://localhost:5058)
- Frontend: React (Vite) + dnd-kit (http://localhost:5173)
- DB: PostgreSQL (local)

Quick Start
1) Ensure PostgreSQL is running locally and reachable with:
   Host=localhost; Port=5432; Database=plancraft; Username=postgres; Password=postgres
   (Change in backend/PlanCraft.Api/appsettings.json if needed.)

2) Backend
   - Install .NET 8 SDK
   - cd backend/PlanCraft.Api
   - dotnet restore
   - dotnet run
   Open Swagger at http://localhost:5058/swagger

   The database schema will be created automatically on first run and seeded with demo data.

3) Frontend
   - cd frontend/plancraft-ui
   - npm install
   - npm run dev
   Open http://localhost:5173

Key Features Included (MVP)
- Time (weeks) × People grid
- Color by Bank/Project
- Drag & drop tasks across people/time (move primary owner & start week)
- Weekly utilization heat bar per person (green/yellow/red)
- What‑If mode (try moves locally without saving)
- Auto‑balance heuristic (suggestions only, via /plan/autobalance)
- Backlog suggestions endpoint (not fully wired in UI)
- Milestones returned by API (markers can be added to UI later)

Extend Later
- Split work per developer in UI (add assignment editor to set SharePercent)
- Dependency visualization (draw arrows/lines)
- Jira sync job to map issues → tasks (placeholder only)
- Auth, multi‑tenant, roles

Notes
- This is a clean base you can refactor into your own style; code is kept simple and readable.
- EF Core uses EnsureCreated for quick start; for production switch to migrations.
