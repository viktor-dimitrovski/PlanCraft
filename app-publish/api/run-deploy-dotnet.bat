
@echo off
set "GITBASH=C:\Program Files\Git\bin\bash.exe"
if exist "%GITBASH%" (
  "%GITBASH%" -lc "./deploy-dotnet.sh"
) else (
  echo [ERR] Git Bash not found at "%GITBASH%". Please install Git for Windows or run deploy-dotnet.sh from Git Bash.
)
