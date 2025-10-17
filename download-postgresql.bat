@echo off
echo ========================================
echo PostgreSQL Installer Download Helper
echo ========================================
echo.
echo PostgreSQL is required for Chess Stats to handle 10M+ games efficiently.
echo.
echo This will open the PostgreSQL download page in your browser.
echo.
echo IMPORTANT NOTES:
echo ----------------
echo 1. Download PostgreSQL 15 or 16 (latest stable)
echo 2. Use the graphical installer (EDB installer)
echo 3. During installation:
echo    - Use default port: 5432
echo    - Remember your postgres password!
echo    - Install Stack Builder (optional)
echo 4. After installation, run setup-postgresql.bat
echo.
echo Press any key to open the download page...
pause >nul

start https://www.postgresql.org/download/windows/

echo.
echo Download page opened in your browser.
echo.
echo After PostgreSQL is installed, run:
echo   setup-postgresql.bat
echo.
pause