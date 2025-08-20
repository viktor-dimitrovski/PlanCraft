@echo off
REM Lists migrations and shows the current one applied.
setlocal
set SCRIPT_DIR=%~dp0
set API_DIR=%SCRIPT_DIR%\..\PlanCraft\backend\PlanCraft.Api
IF NOT EXIST "%API_DIR%\PlanCraft.Api.csproj" set API_DIR=%CD%
cd /d "%API_DIR%"

where dotnet-ef >NUL 2>&1
IF %ERRORLEVEL% NEQ 0 ( set EF=dotnet tool run dotnet-ef -- ) ELSE ( set EF=dotnet-ef )

%EF% migrations list
pause
