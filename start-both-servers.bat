@echo off
echo 🚀 Chess Stats - Parallel Deployment Strategy
echo.
echo Starting both servers for gradual migration...
echo.

echo ✅ Starting Original Server (port 3007)...
start "Original Server (3007)" cmd /k "node simple-server.js"

echo.
echo ⏳ Waiting for original server to start...
timeout /t 3 /nobreak >nul

echo ✅ Starting Refactored Server (port 3008)...
start "Refactored Server (3008)" cmd /k "PORT=3008 node server-refactored.js"

echo.
echo 🌐 Both servers are now running:
echo.
echo   📊 Original Server:   http://localhost:3007
echo   🎯 Refactored Server: http://localhost:3008
echo.
echo 🔧 Testing endpoints:
echo   - Health Check (Original):   curl http://localhost:3007/health
echo   - Health Check (Refactored): curl http://localhost:3008/health
echo   - Authentication (New):      curl -X POST http://localhost:3008/api/auth/login
echo   - API Docs (New):            http://localhost:3008/api-docs
echo   - WebSocket Stats (New):     curl http://localhost:3008/api/websocket/stats
echo.
echo 📋 Migration Strategy:
echo   1. Keep original server running for existing users
echo   2. Test new features on refactored server (port 3008)
echo   3. Gradually migrate frontend to use new endpoints
echo   4. Monitor performance and stability
echo   5. Complete migration when ready
echo.
echo 🎯 Default Admin User (Refactored Server):
echo   Username: admin
echo   Password: admin123
echo.
echo Press any key to close this window...
pause >nul