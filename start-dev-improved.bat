@echo off
echo =========================================
echo  Chess Stats Development Environment
echo  Version 2.0 - Refactored Architecture
echo =========================================
echo.

REM Check if we should use legacy or new server
set USE_LEGACY=0
if "%1"=="legacy" set USE_LEGACY=1

if %USE_LEGACY%==1 (
    echo Using LEGACY server (simple-server.js)
    echo Starting Backend Server on port 3007...
    start "Chess Stats Backend (Legacy)" cmd /k "cd /d %~dp0 && node simple-server.js"
) else (
    echo Using NEW refactored server (server-refactored.js)
    echo Starting Backend Server v2.0 on port 3007...
    start "Chess Stats Backend v2.0" cmd /k "cd /d %~dp0 && node server-refactored.js"
)

timeout /t 3 /nobreak > nul

echo Starting Frontend Server on port 3000...
start "Chess Stats Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 5 /nobreak > nul

echo.
echo ========================================
echo  Chess Stats is starting up!
echo ========================================
echo  Backend:   http://localhost:3007/health
echo  Frontend:  http://localhost:3000
echo  Test Page: http://localhost:3000/test
echo  API Test:  http://localhost:3000/api-test
echo ----------------------------------------
echo  New Features in v2.0:
echo  - Modular route architecture
echo  - Rate limiting protection
echo  - Multi-tier caching
echo  - Input validation
echo  - Winston logging
echo  - Security enhancements
echo ========================================
echo.
echo Press any key to open the test page...
pause > nul

start http://localhost:3000/test

echo.
echo ========================================
echo  Servers are running!
echo ========================================
echo  To use legacy server, run: start-dev-improved.bat legacy
echo  To view logs: Check error.log and combined.log
echo  To monitor cache: http://localhost:3007/api/cache/stats
echo.
echo  Press Ctrl+C in server windows to stop
echo ========================================