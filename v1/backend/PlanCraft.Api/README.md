# PlanCraft.Api (Backend)
ASP.NET Core 8 minimal API + EF Core (Npgsql) for planning grid.

## Prereqs
- .NET 8 SDK
- Local PostgreSQL running on `localhost:5432` (adjust password in `appsettings.json` if needed)

## Run
```bash
cd backend/PlanCraft.Api
dotnet restore
dotnet run
```
The API starts at http://localhost:5058 with Swagger UI.

## DB
On first run, the API will `EnsureCreated()` and seed demo data from `data/seed.json`.
Change connection string in `appsettings.json` if your Postgres differs.
