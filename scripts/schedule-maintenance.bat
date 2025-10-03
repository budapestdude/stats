@echo off
REM Database Maintenance Scheduler for Windows
REM This script sets up scheduled tasks for database backup and optimization

echo ================================================
echo Chess Stats - Database Maintenance Scheduler
echo ================================================
echo.

REM Get the script directory
set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR%..

echo Script directory: %SCRIPT_DIR%
echo Project directory: %PROJECT_DIR%
echo.

REM Schedule daily backup at 2 AM
echo Creating scheduled task for daily database backup...
schtasks /Create /SC DAILY /TN "ChessStats_Daily_Backup" /TR "node \"%SCRIPT_DIR%backup-database.js\" backup" /ST 02:00 /F /RU SYSTEM
if %ERRORLEVEL% EQU 0 (
    echo [OK] Daily backup scheduled for 2:00 AM
) else (
    echo [ERROR] Failed to schedule daily backup
)
echo.

REM Schedule weekly optimization on Sunday at 3 AM
echo Creating scheduled task for weekly database optimization...
schtasks /Create /SC WEEKLY /D SUN /TN "ChessStats_Weekly_Optimization" /TR "node \"%SCRIPT_DIR%optimize-database.js\"" /ST 03:00 /F /RU SYSTEM
if %ERRORLEVEL% EQU 0 (
    echo [OK] Weekly optimization scheduled for Sunday 3:00 AM
) else (
    echo [ERROR] Failed to schedule weekly optimization
)
echo.

REM Show created tasks
echo ================================================
echo Scheduled Tasks Created:
echo ================================================
schtasks /Query /TN "ChessStats_Daily_Backup" /FO LIST 2>nul
echo.
schtasks /Query /TN "ChessStats_Weekly_Optimization" /FO LIST 2>nul

echo.
echo ================================================
echo Maintenance scheduling complete!
echo ================================================
echo.
echo To run backup manually:  node scripts\backup-database.js backup
echo To run optimization:     node scripts\optimize-database.js
echo To list backups:         node scripts\backup-database.js list
echo.
pause
