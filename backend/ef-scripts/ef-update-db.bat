@echo off
setlocal
set SCRIPT_DIR=%~dp0
set API_DIR=%SCRIPT_DIR%\..\PlanCraft_v5\backend\PlanCraft.Api
if not exist "%API_DIR%\PlanCraft.Api.csproj" set API_DIR=%SCRIPT_DIR%\..\backend\PlanCraft.Api
if not exist "%API_DIR%\PlanCraft.Api.csproj" set API_DIR=%CD%
if not exist "%API_DIR%\PlanCraft.Api.csproj" (
  echo [ERROR] Cannot find PlanCraft.Api.csproj. Edit API_DIR in this script.
  exit /b 1
)
cd /d "%API_DIR%"
set EF=
where dotnet-ef >NUL 2>&1
if %ERRORLEVEL% EQU 0 ( set EF=dotnet-ef ) else ( set EF=dotnet tool run dotnet-ef -- )
%EF% database update
if %ERRORLEVEL% NEQ 0 exit /b 1
echo [OK] Database is up to date.
pause
