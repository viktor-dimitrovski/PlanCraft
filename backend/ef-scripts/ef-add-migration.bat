@echo off
setlocal ENABLEDELAYEDEXPANSION
if "%~1"=="" (
  echo Usage: %~nx0 MigrationName
  exit /b 1
)
set NAME=%~1

set SCRIPT_DIR=%~dp0
set API_DIR=%SCRIPT_DIR%\..\PlanCraft.Api
if not exist "%API_DIR%\PlanCraft.Api.csproj" set API_DIR=%SCRIPT_DIR%\..\PlanCraft.Api
if not exist "%API_DIR%\PlanCraft.Api.csproj" set API_DIR=%CD%
if not exist "%API_DIR%\PlanCraft.Api.csproj" (
  echo [ERROR] Cannot find PlanCraft.Api.csproj. Edit API_DIR in this script.
  exit /b 1
)
cd /d "%API_DIR%"

set EF=
where dotnet-ef >NUL 2>&1
if %ERRORLEVEL% EQU 0 ( set EF=dotnet-ef ) else ( set EF=dotnet tool run dotnet-ef -- )

%EF% migrations add %NAME%
if %ERRORLEVEL% NEQ 0 exit /b 1
%EF% database update
if %ERRORLEVEL% NEQ 0 exit /b 1
echo [OK] Migration %NAME% applied.
pause
