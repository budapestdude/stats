@echo off
echo ================================
echo PostgreSQL Setup for Chess Stats
echo ================================
echo.

REM Check if psql is available
where psql >nul 2>&1
if %errorlevel% neq 0 (
    echo PostgreSQL is not installed or not in PATH!
    echo.
    echo Please install PostgreSQL:
    echo 1. Download from: https://www.postgresql.org/download/windows/
    echo 2. Run the installer - use default settings
    echo 3. Remember your postgres password!
    echo 4. Add PostgreSQL bin folder to PATH
    echo    Usually: C:\Program Files\PostgreSQL\15\bin
    echo.
    echo Opening download page...
    start https://www.postgresql.org/download/windows/
    pause
    exit /b 1
)

echo PostgreSQL found!
echo.

REM Get password
set /p PGPASSWORD=Enter PostgreSQL 'postgres' user password: 

REM Test connection
echo Testing connection...
psql -U postgres -h localhost -c "SELECT version();" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo Failed to connect to PostgreSQL!
    echo Please check:
    echo 1. PostgreSQL service is running
    echo 2. Password is correct
    echo 3. Port 5432 is not blocked
    echo.
    pause
    exit /b 1
)

echo Connection successful!
echo.

REM Create database
echo Creating chess_stats database...
psql -U postgres -h localhost -c "DROP DATABASE IF EXISTS chess_stats;" >nul 2>&1
psql -U postgres -h localhost -c "CREATE DATABASE chess_stats;"
if %errorlevel% equ 0 (
    echo Database created successfully!
) else (
    echo Warning: Database may already exist
)
echo.

REM Apply schema
echo Applying optimized schema...
if exist "database\schema-optimized.sql" (
    psql -U postgres -h localhost -d chess_stats -f "database\schema-optimized.sql" >nul 2>&1
    echo Schema applied!
) else (
    echo Error: schema-optimized.sql not found!
    pause
    exit /b 1
)
echo.

REM Create .env file
echo Creating .env configuration...
if not exist ".env" (
    copy .env.example .env >nul
    echo .env file created - Please edit it with your password
) else (
    echo .env file already exists
)
echo.

REM Install packages
echo Installing required npm packages...
call npm install dotenv pg >nul 2>&1
if %errorlevel% equ 0 (
    echo Packages installed!
) else (
    echo Warning: npm install failed
)
echo.

REM Verify
echo Verifying database setup...
psql -U postgres -h localhost -d chess_stats -c "\dt" >nul 2>&1
if %errorlevel% equ 0 (
    echo Database tables created successfully!
) else (
    echo Warning: Could not verify tables
)
echo.

echo ================================
echo Setup Complete!
echo ================================
echo.
echo Database: chess_stats
echo Host: localhost
echo Port: 5432
echo User: postgres
echo.
echo IMPORTANT: Edit .env file with your PostgreSQL password
echo.
echo Next steps:
echo 1. Edit .env file with your password
echo 2. Run: node migrate-sqlite-to-postgresql.js
echo 3. Start server: node simple-server.js
echo.
pause