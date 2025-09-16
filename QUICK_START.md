# Chess Stats - Quick Start Guide

## 🚀 Servers are Running!

Both the backend and frontend servers are now running successfully.

## 📍 Access Points

### Main Application
- **Homepage**: http://localhost:3000
- **Test Page**: http://localhost:3000/test (Connection diagnostics)
- **Style Test**: http://localhost:3000/style-test (CSS debugging)
- **Simple Test**: http://localhost:3000/simple (Basic CSS test)
- **Debug Page**: http://localhost:3000/debug (Advanced debugging)
- **Players**: http://localhost:3000/players
- **Openings**: http://localhost:3000/openings
- **Tournaments**: http://localhost:3000/tournaments
- **Analytics**: http://localhost:3000/analytics

### Backend API
- **Health Check**: http://localhost:3005/health
- **API Test**: http://localhost:3005/api/test
- **Players API**: http://localhost:3005/api/players
- **Top Players**: http://localhost:3005/api/players/top
- **Stats Overview**: http://localhost:3005/api/stats/overview

## 🎯 Quick Start Methods

### Method 1: Using Batch File (Windows)
```cmd
double-click start-dev.bat
```

### Method 2: Using PowerShell
```powershell
.\start-dev.ps1
```

### Method 3: Manual Start
**Terminal 1 - Backend:**
```bash
npm run start:simple
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## 🧪 Testing the Connection

1. Visit http://localhost:3000/test
2. You should see a green "Backend Connected!" message
3. Try the test buttons to verify API endpoints

## 🛠️ Troubleshooting

If localhost refuses to connect:

1. **Check if ports are available:**
   - Backend uses port 3001
   - Frontend uses port 3000

2. **Kill existing processes (Windows):**
   ```cmd
   netstat -ano | findstr :3000
   netstat -ano | findstr :3001
   taskkill /PID <PID> /F
   ```

3. **Try the simple backend:**
   ```bash
   npm run start:simple
   ```
   This doesn't require database connections.

4. **Check Windows Firewall:**
   - May need to allow Node.js through firewall
   - Check Windows Defender settings

## 📊 Current Features

✅ Player search and browsing
✅ Top players leaderboard
✅ Basic statistics
✅ Responsive design
✅ API integration ready

## 🚧 Coming Soon

- Opening explorer with interactive board
- Tournament tracking
- Advanced analytics
- Player profiles with game history
- Data visualization charts

## 💡 Development Tips

- Frontend auto-refreshes on code changes
- Backend requires restart for changes (or use nodemon)
- API routes are proxied through Next.js
- Test data is currently hardcoded (no database required)

## 📝 Notes

The current setup uses:
- **Backend**: Simple Express server with mock data
- **Frontend**: Next.js with React Query for data fetching
- **No database required** for initial testing

Enjoy exploring Chess Stats! ♟️