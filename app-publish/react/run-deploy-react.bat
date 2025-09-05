
@echo off
set "GITBASH=C:\Program Files\Git\bin\bash.exe"
if exist "%GITBASH%" (
  "%GITBASH%" -lc "./deploy-react.sh"
) else (
  echo [ERR] Git Bash not found at "%GITBASH%". Please install Git for Windows or run deploy-react.sh from Git Bash.
)
pause