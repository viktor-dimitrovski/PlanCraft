@echo off
setlocal
echo Installing/Updating dotnet-ef globally...
dotnet tool install --global dotnet-ef
if %ERRORLEVEL% NEQ 0 (
  dotnet tool update --global dotnet-ef
)
dotnet-ef --version
echo If 'dotnet-ef' is not recognized, close and reopen terminal.
pause
