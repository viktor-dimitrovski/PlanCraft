EF Helper Scripts for PlanCraft

1) Install dotnet-ef
   - Global (admin):   setup-ef-global.bat
   - Local (no admin): setup-ef-local.bat
     Then call the tool via: dotnet tool run dotnet-ef -- <args>

2) Baseline existing DB (keep your current tables)
   - Run: ef-baseline.bat
   This adds a 'Baseline' migration with --ignore-changes and updates the DB.

3) Add a new migration and apply
   - Run: ef-add-migration.bat Add_MyChange

4) Apply pending migrations
   - Run: ef-update-db.bat

5) List migrations
   - Run: ef-list.bat

6) Remove the last migration
   - Run: ef-remove-last.bat
   If it's already applied, you'll need to revert the DB to the previous migration first.

7) Reset local DB (destructive)
   - Run: ef-reset-db.bat
   Drops and recreates the 'plancraft' database on localhost using psql.

Tips
- If scripts can't find your API project, edit API_DIR inside the BAT files to point to backend\PlanCraft.Api.
- If 'dotnet-ef' is not recognized after installing globally, close and reopen your terminal to refresh PATH.
