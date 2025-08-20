@echo off
REM DESTROYS and recreates the plancraft database in local Postgres. USE WITH CARE.
setlocal
set PSQL=psql
set HOST=localhost
set USER=postgres
set DB=plancraft

echo Dropping database %DB%...
%PSQL% -h %HOST% -U %USER% -c "DROP DATABASE IF EXISTS %DB%;"
IF %ERRORLEVEL% NEQ 0 (
  echo Failed to drop DB. Ensure psql is in PATH and credentials are correct.
  exit /b 1
)
echo Creating database %DB%...
%PSQL% -h %HOST% -U %USER% -c "CREATE DATABASE %DB%;"
IF %ERRORLEVEL% NEQ 0 (
  echo Failed to create DB.
  exit /b 1
)
echo Now run ef-update-db.bat (or start the API, which runs db.Database.Migrate()).
pause
