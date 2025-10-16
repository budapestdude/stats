@echo off
echo Starting Chess Stats Development Servers...
echo.

echo Starting Backend Server on port 3007...
start cmd /k "cd /d %~dp0 && node simple-server.js"

timeout /t 3 /nobreak > nul

echo Starting Frontend Server on port 3000...
start cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 5 /nobreak > nul

echo.
echo ========================================
echo Chess Stats is starting up!
echo ========================================
echo Backend:  http://localhost:3007/health
echo Frontend: http://localhost:3000
echo Test Page: http://localhost:3000/test
echo ========================================
echo.
echo Press any key to open the test page in your browser...
pause > nul

start http://localhost:3000/test