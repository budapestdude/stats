Write-Host "Starting Chess Stats Development Servers..." -ForegroundColor Green
Write-Host ""

# Start Backend
Write-Host "Starting Backend Server on port 3001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run start:simple"

Start-Sleep -Seconds 3

# Start Frontend
Write-Host "Starting Frontend Server on port 3000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Start-Sleep -Seconds 5

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Chess Stats is starting up!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Backend:   http://localhost:3001/health" -ForegroundColor White
Write-Host "Frontend:  http://localhost:3000" -ForegroundColor White
Write-Host "Test Page: http://localhost:3000/test" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Opening test page in browser..." -ForegroundColor Yellow

Start-Sleep -Seconds 2
Start-Process "http://localhost:3000/test"