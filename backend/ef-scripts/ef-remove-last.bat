@echo off
REM Removes the last migration (if not applied) or reverts DB then removes.
setlocal
set SCRIPT_DIR=%~dp0
set API_DIR=%SCRIPT_DIR%\..\PlanCraft\backend\PlanCraft.Api
IF NOT EXIST "%API_DIR%\PlanCraft.Api.csproj" set API_DIR=%CD%
cd /d "%API_DIR%"

where dotnet-ef >NUL 2>&1
IF %ERRORLEVEL% NEQ 0 ( set EF=dotnet tool run dotnet-ef -- ) ELSE ( set EF=dotnet-ef )

echo Attempting to remove last migration...
%EF% migrations remove
IF %ERRORLEVEL% NEQ 0 (
  echo Could not remove directly. Trying to revert DB to previous migration...
  for /f "delims=" %%G in ('%EF% migrations list ^| findstr /R /C:"\[.\]"') do set CURRENT=%%G
  echo Current: %CURRENT%
  echo Please run: %EF% database update <PreviousMigrationName> then rerun this script.
  pause
  exit /b 1
)
echo Removed last migration.
pause
