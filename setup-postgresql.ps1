# PostgreSQL Setup Script for Chess Stats
# Run as Administrator for best results

Write-Host "================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Setup for Chess Stats" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "Warning: Not running as Administrator. Some operations may fail." -ForegroundColor Yellow
    Write-Host "Restart PowerShell as Administrator for best results." -ForegroundColor Yellow
    Write-Host ""
}

# Function to check if PostgreSQL is installed
function Test-PostgreSQL {
    $pgPaths = @(
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe",
        "C:\Program Files\PostgreSQL\13\bin\psql.exe"
    )
    
    foreach ($path in $pgPaths) {
        if (Test-Path $path) {
            return $path
        }
    }
    
    # Check if psql is in PATH
    $psqlCommand = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlCommand) {
        return $psqlCommand.Path
    }
    
    return $null
}

# Step 1: Check PostgreSQL installation
Write-Host "Step 1: Checking PostgreSQL installation..." -ForegroundColor Green
$psqlPath = Test-PostgreSQL

if (-not $psqlPath) {
    Write-Host "PostgreSQL is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install PostgreSQL:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Cyan
    Write-Host "2. Run the installer (use default settings)" -ForegroundColor Cyan
    Write-Host "3. Remember your postgres password!" -ForegroundColor Cyan
    Write-Host "4. Run this script again after installation" -ForegroundColor Cyan
    
    $download = Read-Host "Would you like to open the download page? (y/n)"
    if ($download -eq 'y') {
        Start-Process "https://www.postgresql.org/download/windows/"
    }
    
    exit 1
} else {
    Write-Host "✓ PostgreSQL found at: $psqlPath" -ForegroundColor Green
    $psqlDir = Split-Path $psqlPath
    Write-Host ""
}

# Get PostgreSQL password
Write-Host "Step 2: PostgreSQL Connection" -ForegroundColor Green
$pgPassword = Read-Host "Enter your PostgreSQL 'postgres' user password" -AsSecureString
$pgPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pgPassword))

# Set environment variable for password
$env:PGPASSWORD = $pgPasswordPlain

# Test connection
Write-Host "Testing connection..." -ForegroundColor Yellow
$testResult = & "$psqlPath" -U postgres -h localhost -c "SELECT version();" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to connect to PostgreSQL!" -ForegroundColor Red
    Write-Host "Error: $testResult" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure PostgreSQL service is running" -ForegroundColor Cyan
    Write-Host "2. Check your password is correct" -ForegroundColor Cyan
    Write-Host "3. Check Windows Firewall isn't blocking port 5432" -ForegroundColor Cyan
    
    # Try to start the service
    if ($isAdmin) {
        Write-Host ""
        Write-Host "Attempting to start PostgreSQL service..." -ForegroundColor Yellow
        Get-Service -Name "postgresql*" | Start-Service -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    
    exit 1
} else {
    Write-Host "✓ Successfully connected to PostgreSQL" -ForegroundColor Green
    Write-Host ""
}

# Step 3: Create database
Write-Host "Step 3: Creating chess_stats database..." -ForegroundColor Green

# Check if database exists
$dbExists = & "$psqlPath" -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='chess_stats'" 2>&1

if ($dbExists -eq "1") {
    Write-Host "Database 'chess_stats' already exists" -ForegroundColor Yellow
    $recreate = Read-Host "Do you want to DROP and recreate it? (y/n)"
    
    if ($recreate -eq 'y') {
        Write-Host "Dropping existing database..." -ForegroundColor Yellow
        & "$psqlPath" -U postgres -h localhost -c "DROP DATABASE IF EXISTS chess_stats;"
        & "$psqlPath" -U postgres -h localhost -c "CREATE DATABASE chess_stats;"
        Write-Host "✓ Database recreated" -ForegroundColor Green
    }
} else {
    & "$psqlPath" -U postgres -h localhost -c "CREATE DATABASE chess_stats;"
    Write-Host "✓ Database created" -ForegroundColor Green
}

# Step 4: Apply schema
Write-Host ""
Write-Host "Step 4: Applying optimized schema..." -ForegroundColor Green

$schemaPath = Join-Path $PSScriptRoot "database\schema-optimized.sql"

if (Test-Path $schemaPath) {
    & "$psqlPath" -U postgres -h localhost -d chess_stats -f "$schemaPath" 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Schema applied successfully" -ForegroundColor Green
    } else {
        Write-Host "Warning: Some schema elements may have failed" -ForegroundColor Yellow
        Write-Host "This is normal if some objects already exist" -ForegroundColor Yellow
    }
} else {
    Write-Host "Schema file not found at: $schemaPath" -ForegroundColor Red
    exit 1
}

# Step 5: Create .env file
Write-Host ""
Write-Host "Step 5: Creating .env configuration..." -ForegroundColor Green

$envPath = Join-Path $PSScriptRoot ".env"
$envExamplePath = Join-Path $PSScriptRoot ".env.example"

if (Test-Path $envPath) {
    Write-Host ".env file already exists" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/n)"
    
    if ($overwrite -ne 'y') {
        Write-Host "Keeping existing .env file" -ForegroundColor Yellow
    } else {
        Copy-Item $envExamplePath $envPath -Force
        (Get-Content $envPath) -replace 'your_password_here', $pgPasswordPlain | Set-Content $envPath
        Write-Host "✓ .env file created with your password" -ForegroundColor Green
    }
} else {
    Copy-Item $envExamplePath $envPath
    (Get-Content $envPath) -replace 'your_password_here', $pgPasswordPlain | Set-Content $envPath
    Write-Host "✓ .env file created with your password" -ForegroundColor Green
}

# Step 6: Install npm packages
Write-Host ""
Write-Host "Step 6: Installing required npm packages..." -ForegroundColor Green

if (Get-Command npm -ErrorAction SilentlyContinue) {
    npm install dotenv pg
    Write-Host "✓ npm packages installed" -ForegroundColor Green
} else {
    Write-Host "npm not found. Please install Node.js" -ForegroundColor Red
}

# Step 7: Verify database
Write-Host ""
Write-Host "Step 7: Verifying database setup..." -ForegroundColor Green

$tableCount = & "$psqlPath" -U postgres -h localhost -d chess_stats -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>&1

Write-Host "✓ Database has $tableCount tables" -ForegroundColor Green

# Display connection info
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Database Connection Info:" -ForegroundColor Yellow
Write-Host "  Host: localhost" -ForegroundColor White
Write-Host "  Port: 5432" -ForegroundColor White
Write-Host "  Database: chess_stats" -ForegroundColor White
Write-Host "  Username: postgres" -ForegroundColor White
Write-Host "  Password: (saved in .env file)" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Run migration: node migrate-sqlite-to-postgresql.js" -ForegroundColor Cyan
Write-Host "2. Start server: node simple-server.js" -ForegroundColor Cyan
Write-Host "3. Test at: http://localhost:3007/health" -ForegroundColor Cyan
Write-Host ""

# Clear password from environment
$env:PGPASSWORD = ""

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")