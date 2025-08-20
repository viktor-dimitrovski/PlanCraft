@echo off
setlocal
dotnet new tool-manifest 1>NUL 2>NUL
dotnet tool install dotnet-ef
if %ERRORLEVEL% NEQ 0 (
  dotnet tool update dotnet-ef
)
dotnet tool run dotnet-ef -- --version
echo Use: dotnet tool run dotnet-ef -- <args>
pause
