@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM =====================================================================
REM  CONFIG PLACEHOLDERS (LEFT EMPTY ON PURPOSE; OVERRIDDEN BY .env)
REM =====================================================================
REM SSH to VPS
set "REMOTE_SSH_HOST="
set "REMOTE_SSH_PORT=22"
set "REMOTE_SSH_USER=deploy"

REM Remote PostgreSQL (on VPS)
set "REMOTE_DB_HOST=127.0.0.1"
set "REMOTE_DB_PORT=5432"
set "REMOTE_DB_NAME="
set "REMOTE_DB_USER="
set "REMOTE_DB_PASSWORD="

REM Local TCP port for SSH tunnel (avoid conflict with local Postgres)
set "TUNNEL_LOCAL_PORT=5433"

REM Where to upload backup on the VPS (must be writable by REMOTE_SSH_USER)
set "REMOTE_BACKUP_DIR=/var/backups/deploy"

REM Optional: path to PuTTY tools (plink.exe / pscp.exe). If blank, use PATH.
set "PUTTY_DIR="
REM Example:
REM set "PUTTY_DIR=C:\Program Files\PuTTY"

REM Optional: PuTTY private key (.ppk). If empty, Pageant/agent is used.
set "KEYFILE="
REM Example:
REM set "KEYFILE=C:\Users\YourName\.ssh\mykey.ppk"

REM Toggle features
set "ENABLE_UPLOAD=1"
set "ENABLE_REMOTE_RESTORE=1"

REM ===== LOCAL POSTGRES CONFIG (will be overridden by .env) =============
if not defined PGBIN set "PGBIN=C:\Program Files\PostgreSQL\16\bin"
set "PGHOST=localhost"
set "PGPORT=5432"
set "PGUSER="
set "PGPASSWORD="
set "PGDATABASE="
set "BACKUP_DIR="
REM =====================================================================

REM ===== Load .env if present ==========================================
if exist ".env" (
  for /f "usebackq tokens=* delims=" %%a in (".env") do (
    set "line=%%a"
    if not "!line!"=="" if not "!line:~0,1!"=="#" (
      for /f "tokens=1* delims==" %%b in ("!line!") do (
        set "%%b=%%c"
      )
    )
  )
)

REM ===== Sanity checks =================================================
if "%PGDATABASE%"=="" (
  echo [ERR] PGDATABASE not set. Check .env.
  goto :abort
)
if "%PGUSER%"=="" (
  echo [ERR] PGUSER not set. Check .env.
  goto :abort
)
if "%PGPASSWORD%"=="" (
  echo [ERR] PGPASSWORD not set. Check .env.
  goto :abort
)
if "%PGHOST%"=="" (
  echo [ERR] PGHOST not set. Check .env.
  goto :abort
)

REM ===== Tools =========================================================
if defined PGBIN (
set "PG_DUMP=%PGBIN%\pg_dump.exe"
set "PG_RESTORE=%PGBIN%\pg_restore.exe"
set "PG_PSQL=%PGBIN%\psql.exe"
) else (
set "PG_DUMP=pg_dump.exe"
set "PG_RESTORE=pg_restore.exe"
set "PG_PSQL=psql.exe"
)

if defined PUTTY_DIR (
  set "PLINK_EXE=%PUTTY_DIR%\plink.exe"
  set "PSCP_EXE=%PUTTY_DIR%\pscp.exe"
) else (
  set "PLINK_EXE=plink.exe"
  set "PSCP_EXE=pscp.exe"
)

REM ===== Ensure backup dir =============================================
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM ===== Timestamp =====================================================
for /f "tokens=1-3 delims=/- " %%a in ("%date%") do set "DS=%%c%%a%%b"
for /f "tokens=1-3 delims=:. " %%h in ("%time%") do set "TS=%%h%%i%%j"
set "STAMP=%DS%_%TS%"

REM ===== Backup file ===================================================
set "BACKUP_FILE=%BACKUP_DIR%\%PGDATABASE%_%STAMP%.dump"

echo.
echo [INFO] Backing up local DB "%PGDATABASE%" to:
echo        "%BACKUP_FILE%"
echo.

set "PGPASSWORD=%PGPASSWORD%"
"%PG_DUMP%" --no-owner --no-privileges -h "%PGHOST%" -p "%PGPORT%" -U "%PGUSER%" -d "%PGDATABASE%" -F c -Z 6 -f "%BACKUP_FILE%"
if errorlevel 1 goto :err_backup

echo [OK] Local backup complete.

REM ===== Upload to VPS =================================================
if not exist "%PSCP_EXE%" (
  echo [ERR] pscp.exe not found. Skipping upload.
  goto :abort
)

echo [INFO] Uploading backup to %REMOTE_SSH_USER%@%REMOTE_SSH_HOST%:%REMOTE_BACKUP_DIR%
"%PSCP_EXE%" -P %REMOTE_SSH_PORT% "%BACKUP_FILE%" %REMOTE_SSH_USER%@%REMOTE_SSH_HOST%:%REMOTE_BACKUP_DIR%/
if errorlevel 1 (
  echo [ERR] Upload failed. Aborting restore.
  goto :abort
)
echo [OK] Upload complete.

REM ===== OPTIONAL: RESTORE TO REMOTE VIA SSH TUNNEL ====================
if "%ENABLE_REMOTE_RESTORE%"=="1" (
  echo.
  echo [INFO] Starting SSH tunnel: local %TUNNEL_LOCAL_PORT% -> %REMOTE_DB_HOST%:%REMOTE_DB_PORT% via %REMOTE_SSH_USER%@%REMOTE_SSH_HOST%
  if not exist "%PLINK_EXE%" (
    echo [ERR] plink.exe not found on PATH nor PUTTY_DIR. Skipping remote restore.
    goto :after_remote
  )

  REM Start plink in background (-N no shell, -L local forward)
  start "PG_TUNNEL" /B "%PLINK_EXE%" -ssh -N %SSH_KEY_OPT% -L %TUNNEL_LOCAL_PORT%:%REMOTE_DB_HOST%:%REMOTE_DB_PORT% -P %REMOTE_SSH_PORT% %REMOTE_SSH_USER%@%REMOTE_SSH_HOST%
  REM Give tunnel time to come up
  ping -n 3 127.0.0.1 >nul

  echo [INFO] Restoring to remote DB "%REMOTE_DB_NAME%" over tunnel -> localhost:%TUNNEL_LOCAL_PORT%
  set "PGPASSWORD=%REMOTE_DB_PASSWORD%"
  "%PG_RESTORE%" --no-owner --no-privileges -h 127.0.0.1 -p %TUNNEL_LOCAL_PORT% -U "%REMOTE_DB_USER%" -d "%REMOTE_DB_NAME%" --clean --if-exists "%BACKUP_FILE%"
  if errorlevel 1 (
    echo [ERR] Remote restore failed.
    goto :cleanup_tunnel
  ) else (
    echo [OK] Remote restore complete.
  )

  :cleanup_tunnel
  echo [INFO] Closing SSH tunnel...
  REM Kill any plink instance we started (best-effort)
  taskkill /F /IM plink.exe >nul 2>&1
)

:after_remote
echo.
echo [DONE]
REM Cleanup stray files created by bad expansions
if exist 127.0.0.1 del /Q 127.0.0.1
if exist localhost del /Q localhost
del /Q *.dump

goto :eof

:err_backup
echo [ERR] Local backup failed.
goto :abort

:abort
echo.
echo [ABORT] Operation aborted.
exit /b 1
