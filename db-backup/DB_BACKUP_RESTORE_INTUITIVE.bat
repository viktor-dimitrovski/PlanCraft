@echo off
setlocal EnableExtensions

REM ===== KONFIG (izmeni ako treba) =====================================
set "PGBIN=C:\Program Files\PostgreSQL\16\bin"
set "PGHOST=localhost"
set "PGPORT=5432"
set "PGUSER=postgres"
set "PGPASSWORD=P@ssw0rd"
set "BACKUP_DIR=D:\GIT\my-projects\PlanCraft\db-backup"
REM =====================================================================

REM --- Provere binarnog foldera ---
if not exist "%PGBIN%\pg_dump.exe"    echo [ERR] Nije nadjen pg_dump.exe u "%PGBIN%" & goto :abort
if not exist "%PGBIN%\pg_restore.exe" echo [ERR] Nije nadjen pg_restore.exe u "%PGBIN%" & goto :abort
if not exist "%PGBIN%\psql.exe"       echo [ERR] Nije nadjen psql.exe u "%PGBIN%" & goto :abort
if not exist "%PGBIN%\createdb.exe"   echo [ERR] Nije nadjen createdb.exe u "%PGBIN%" & goto :abort
if not exist "%PGBIN%\dropdb.exe"     echo [ERR] Nije nadjen dropdb.exe u "%PGBIN%" & goto :abort

echo.
echo ===============================
echo   1  -  BACKUP (pg_dump)
echo   2  -  RESTORE u NOVU/POSTOJECU bazu (pg_restore -d NEWDB)
echo ===============================
set /p CHOICE="Izaberi opciju (1/2): "

if "%CHOICE%"=="1" goto backup
if "%CHOICE%"=="2" goto restore
echo [ERR] Nepoznata opcija.
goto :abort

:timestamp
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "TS=%%I"
exit /b

:backup
set /p DBNAME="Unesi NAZIV baze za BACKUP (npr. plancraft): "
if "%DBNAME%"=="" echo [ERR] Nije uneto ime baze. & goto :abort

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%" >nul 2>&1
call :timestamp
set "OUTFILE=%BACKUP_DIR%\%DBNAME%_%TS%.backup"
echo [INFO] Backup DB "%DBNAME%" u "%OUTFILE%"

"%PGBIN%\pg_dump.exe" -h "%PGHOST%" -p %PGPORT% -U "%PGUSER%" -d "%DBNAME%" -F c -b -v -f "%OUTFILE%"
if errorlevel 1 goto :err_dump

"%PGBIN%\pg_restore.exe" -l "%OUTFILE%" >nul
if errorlevel 1 goto :err_invalid

echo [OK] Backup sacuvan: "%OUTFILE%"
goto :done

:restore
set /p INFILE="Putanja do .backup fajla (npr. D:\...\plancraft_YYYY-MM-DD_HH-mm-ss.backup): "
if "%INFILE%"=="" echo [ERR] Nije uneta putanja. & goto :abort
if not exist "%INFILE%" echo [ERR] Fajl ne postoji: "%INFILE%" & goto :abort

set /p NEWDB="Unesi NOVO ime baze (target) za RESTORE: "
if "%NEWDB%"=="" echo [ERR] Nije uneto novo ime baze. & goto :abort

set "TMPFILE=%TEMP%\db_exists_%RANDOM%.txt"
"%PGBIN%\psql.exe" -h "%PGHOST%" -p %PGPORT% -U "%PGUSER%" -t -A -d postgres -o "%TMPFILE%" -c "SELECT 1 FROM pg_database WHERE datname='%NEWDB%';"
if errorlevel 1 goto :err_check
set "EXISTS="
if exist "%TMPFILE%" set /p EXISTS=<"%TMPFILE%"
if exist "%TMPFILE%" del "%TMPFILE%" >nul 2>&1

if "%EXISTS%"=="1" (
  echo [WARN] Baza '%NEWDB%' vec postoji.
  set /p DROPCHOICE="Da je OBRISEM pre restore-a? (Y/N): "
  if /I "%DROPCHOICE%"=="Y" (
    echo [INFO] Zatvaram sesije za '%NEWDB%' ...
    "%PGBIN%\psql.exe" -h "%PGHOST%" -p %PGPORT% -U "%PGUSER%" -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='%NEWDB%';"
    if errorlevel 1 goto :err_terminate
    echo [INFO] DROP DATABASE IF EXISTS '%NEWDB%' ...
    "%PGBIN%\dropdb.exe" -h "%PGHOST%" -p %PGPORT% -U "%PGUSER%" --if-exists -e "%NEWDB%"
    if errorlevel 1 goto :err_drop
    echo [INFO] Kreiram praznu bazu '%NEWDB%' ...
    "%PGBIN%\createdb.exe" -h "%PGHOST%" -p %PGPORT% -U "%PGUSER%" "%NEWDB%"
    if errorlevel 1 goto :err_create
  ) else (
    echo [INFO] Postojeca baza ce biti upotrebljena za restore.
  )
) else (
  echo [INFO] Kreiram praznu bazu '%NEWDB%' ...
  "%PGBIN%\createdb.exe" -h "%PGHOST%" -p %PGPORT% -U "%PGUSER%" "%NEWDB%"
  if errorlevel 1 goto :err_create
)

echo [INFO] RESTORE u bazu '%NEWDB%' iz "%INFILE%" ...
"%PGBIN%\pg_restore.exe" -h "%PGHOST%" -p %PGPORT% -U "%PGUSER%" -d "%NEWDB%" -v "%INFILE%"
if errorlevel 1 goto :err_restore

echo [OK] Restore zavrsen u bazi: %NEWDB%
goto :done

:err_dump
echo [ERR] pg_dump neuspesan.
goto :abort

:err_invalid
echo [ERR] Backup arhiva izgleda neispravna.
goto :abort

:err_check
echo [ERR] Greska pri proveri postojanja baze.
goto :abort

:err_terminate
echo [ERR] Neuspesno terminate sesija za '%NEWDB%'.
goto :abort

:err_drop
echo [ERR] DROP DATABASE neuspesan.
goto :abort

:err_create
echo [ERR] Kreiranje nove baze '%NEWDB%' neuspesno.
goto :abort

:err_restore
echo [ERR] Restore neuspesan.
goto :abort

:done
echo.
echo [DONE]
goto :eof

:abort
echo.
echo [ABORT] Operacija prekinuta.
exit /b 1
