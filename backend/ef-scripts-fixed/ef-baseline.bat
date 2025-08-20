@echo off
REM Baseline existing DB with --ignore-changes and apply it.
setlocal ENABLEDELAYEDEXPANSION

REM ---- Locate API project ----
set SCRIPT_DIR=%~dp0
set API_DIR=%SCRIPT_DIR%\..\PlanCraft_v5\backend\PlanCraft.Api
if exist "%API_DIR%\PlanCraft.Api.csproj" goto api_ok

REM Try sibling 'backend\PlanCraft.Api' from where user placed this script
set API_DIR=%SCRIPT_DIR%\..\backend\PlanCraft.Api
if exist "%API_DIR%\PlanCraft.Api.csproj" goto api_ok

REM Try current directory
set API_DIR=%CD%
if exist "%API_DIR%\PlanCraft.Api.csproj" goto api_ok

echo [ERROR] Could not locate PlanCraft.Api.csproj.
echo Edit API_DIR at top of this script to your backend\PlanCraft.Api path.
exit /b 1

:api_ok
cd /d "%API_DIR%"

REM ---- Determine EF command (global or local tool) ----
set EF=
where dotnet-ef >NUL 2>&1
if %ERRORLEVEL% EQU 0 (
  set EF=dotnet-ef
) else (
  dotnet tool run dotnet-ef -- --version >NUL 2>&1
  if %ERRORLEVEL% EQU 0 (
    set EF=dotnet tool run dotnet-ef --
  ) else (
    echo [ERROR] dotnet-ef not found. Run setup-ef-global.bat or setup-ef-local.bat first.
    exit /b 1
  )
)

echo Using EF command: %EF%
echo Creating Baseline migration (ignore changes)...
%EF% migrations add Baseline -- --ignore-changes
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Failed to add Baseline migration.
  exit /b 1
)

echo Applying migrations to database...
%EF% database update
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Failed to update database.
  exit /b 1
)

echo [OK] Baseline created and applied.
pause
