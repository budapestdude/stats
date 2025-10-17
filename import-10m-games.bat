@echo off
echo =====================================================
echo    Chess Stats - 10 Million Game Database Import
echo =====================================================
echo.
echo This will import 9.3 million chess games from PGN files
echo Estimated time: 51 minutes
echo Estimated database size: 7 GB
echo.
echo Press CTRL+C to cancel, or any other key to continue...
pause > nul

echo.
echo [%date% %time%] Starting import...
echo.

cd otb-database
node optimized-importer.js

echo.
echo [%date% %time%] Import complete!
echo.
echo Database is ready at: otb-database\chess-stats-10m.db
echo.
pause