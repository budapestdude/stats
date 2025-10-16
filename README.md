# ♟️ Chess Stats - The Ultimate Chess Statistics Platform

[![Production Status](https://img.shields.io/badge/status-production-success)](https://invigorating-solace-production.up.railway.app)
[![Database](https://img.shields.io/badge/games-9.1M-blue)](https://github.com/budapestdude/stats)
[![Node.js](https://img.shields.io/badge/node-20%2B-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)

A comprehensive web application for chess statistics, player analysis, opening exploration, and tournament tracking. Features 9.1 million OTB (Over-the-Board) tournament games, real-time Chess.com and Lichess integration, and powerful analytics.

🌐 **Live**: [Production Frontend](https://invigorating-solace-production.up.railway.app) | [API](https://stats-production-10e3.up.railway.app)

---

## ✨ Features

### 🎯 Core Features
- **9.1M Game Database**: Complete OTB tournament games from 1851-2025
- **Player Analytics**: Comprehensive statistics for 442K+ players
- **Opening Explorer**: Opening statistics with 100% ECO code coverage
- **Tournament Data**: 18K tournaments with detailed standings and games
- **Real-time Data**: Live Chess.com and Lichess API integration
- **Advanced Search**: Filter by player, opening, date, result, and more

### 📊 Analytics & Visualization
- Player performance trends by year and color
- Head-to-head statistics with top opponents
- Opening repertoire analysis
- Win/Draw/Loss distributions
- Interactive charts with Recharts

### 🚀 Technical Features
- Three production servers (ports 3007, 3009, 3010)
- Connection pooling and query caching
- Real-time monitoring dashboard
- Docker deployment support
- Comprehensive test coverage (70%+ target)

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express 5
- **Language**: TypeScript & JavaScript (hybrid)
- **Database**: SQLite (5.1GB database with 9.1M games)
- **Caching**: In-memory query cache
- **APIs**: Chess.com, Lichess

### Frontend
- **Framework**: Next.js 15 with React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data Fetching**: React Query (@tanstack/react-query)
- **Chess**: chess.js, react-chessboard
- **Charts**: Recharts

### DevOps
- **Deployment**: Railway (production), Docker support
- **CI/CD**: GitHub Actions workflows
- **Testing**: Jest with Supertest
- **Monitoring**: Built-in performance monitoring

---

## 📋 Prerequisites

- **Node.js** 20+ (LTS recommended)
- **npm** 9+ or **yarn**
- **Git** (for version control)
- **4GB+ RAM** (for full database)

Optional:
- **Docker** & **Docker Compose** (for containerized deployment)

---

## 🚀 Quick Start

### Option 1: Local Development (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/budapestdude/stats.git
   cd chess-stats
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

3. **Database setup**
   ```bash
   # Use the development subset database (included)
   # Located at: otb-database/railway-subset.db

   # OR download the full 9.1M game database (optional)
   node download-full-db.js
   ```

4. **Start development servers**
   ```bash
   # Windows
   ./start-dev.bat

   # Linux/Mac or PowerShell
   ./start-dev.ps1

   # Manual start
   npm run start:pooled    # Backend (port 3010)
   cd frontend && npm run dev  # Frontend (port 3000)
   ```

5. **Open in browser**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3010
   - Health check: http://localhost:3010/health

### Option 2: Docker Deployment

```bash
# Production (recommended pooled server + frontend)
docker-compose --profile production up -d

# Development (all servers)
docker-compose --profile dev up -d
```

---

## 📡 API Endpoints

### Server Ports
- **3007**: Legacy server (`simple-server.js`)
- **3009**: Optimized server with caching (`simple-server-optimized.js`)
- **3010**: ⭐ **Production server** with connection pooling (`simple-server-pooled.js`)

### Core Endpoints

#### Health & Status
```
GET /health                          - Server health check
GET /api/stats/overview              - Database statistics
GET /api/pool/stats                  - Connection pool metrics (port 3010)
GET /monitoring/dashboard            - Performance dashboard (port 3010)
```

#### Players
```
GET /api/players/:username           - Chess.com player data
GET /api/players/:username/stats     - OTB player statistics
GET /api/players/search              - Search players
GET /api/debug/search-player?q=name  - Debug player search
```

#### Games
```
GET /api/games/search                - Search games (filters: player, ECO, result, date)
GET /api/games/:id                   - Get game details
GET /api/games/:id/pgn               - Get game PGN moves
```

#### Openings
```
GET /api/openings                    - Popular openings (top 50)
GET /api/openings/explorer           - Lichess opening explorer
GET /api/openings/eco/:eco           - Opening by ECO code
```

#### Tournaments
```
GET /api/tournaments                 - Tournament list
GET /api/tournaments/:id             - Tournament details
GET /api/tournaments/:id/games       - Tournament games
```

**Full API documentation**: See [CLAUDE.md](CLAUDE.md) for complete endpoint reference

---

## 🧪 Development

### npm Scripts

```bash
# Backend
npm run dev                 # TypeScript dev server (nodemon)
npm run build:backend       # Build TypeScript
npm run start:pooled        # Production pooled server ⭐
npm run start:optimized     # Optimized server
npm run start:legacy        # Legacy server

# Frontend
npm run build               # Build frontend only
npm run build:full          # Build backend + frontend
npm start                   # Start frontend production

# Testing
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report

# Code Quality
npm run lint                # ESLint
npm run format              # Prettier formatting
```

### Project Structure

```
chess-stats/
├── src/                           # Backend source (TypeScript/JavaScript)
│   ├── controllers/               # API controllers
│   ├── routes/                    # Express routes
│   ├── services/                  # Business logic
│   ├── middleware/                # Express middleware
│   ├── utils/                     # Utilities
│   └── config/                    # Configuration
├── frontend/                      # Next.js 15 frontend
│   └── app/                       # App Router pages
│       ├── players/               # Player pages
│       ├── openings/              # Opening explorer
│       ├── games/                 # Game browser
│       └── tournaments/           # Tournament calendar
├── tests/                         # Jest tests
│   ├── unit/                      # Unit tests
│   └── integration/               # Integration tests
├── scripts/                       # Utility scripts
├── otb-database/                  # OTB tournament database
│   ├── railway-subset.db          # Development database
│   └── pgn-files/                 # Source PGN files
├── simple-server-pooled.js        # ⭐ Production server
├── simple-server-optimized.js     # Optimized server
├── simple-server.js               # Legacy server
├── docker-compose.yml             # Docker orchestration
└── Dockerfile                     # Docker build config
```

---

## 🧪 Testing

### Running Tests
```bash
npm test                    # All tests
npm run test:coverage       # With coverage report
npm test -- <file>          # Specific test file
```

### Test Coverage
- **Target**: 70% minimum
- **Framework**: Jest with Supertest
- **Location**: `tests/` directory
- Coverage report: `coverage/lcov-report/index.html`

---

## 📚 Documentation

- **[CLAUDE.md](CLAUDE.md)** - Complete development guide
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines
- **[TODO.md](TODO.md)** - Current tasks and roadmap
- **[RAILWAY_DEPLOYMENT_STATUS.md](RAILWAY_DEPLOYMENT_STATUS.md)** - Production deployment status
- **[DATABASE_CHUNKS_GUIDE.md](DATABASE_CHUNKS_GUIDE.md)** - Database management
- **[DEPLOYMENT_GUIDES_INDEX.md](DEPLOYMENT_GUIDES_INDEX.md)** - All deployment guides

---

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# Production (pooled server + frontend)
docker-compose --profile production up -d

# Development (all 3 servers + frontend)
docker-compose --profile dev up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Manual Docker Build

```bash
# Build image
docker build -t chess-stats .

# Run container
docker run -p 3010:3010 \
  -v $(pwd)/otb-database:/app/otb-database:ro \
  chess-stats
```

---

## 🌐 Production Deployment

### Current Production Setup
- **Frontend**: Railway - https://invigorating-solace-production.up.railway.app
- **Backend**: Railway - https://stats-production-10e3.up.railway.app
- **Database**: 9.1M games, 5.1GB SQLite database
- **Status**: ✅ Fully operational

### Deployment Options
1. **Railway** - Current production (see [RAILWAY_DEPLOYMENT_STATUS.md](RAILWAY_DEPLOYMENT_STATUS.md))
2. **Hetzner VPS** - Docker deployment (see [HETZNER_SETUP_GUIDE.md](HETZNER_SETUP_GUIDE.md))
3. **Docker** - Any VPS with Docker support

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup
- Coding standards
- Testing guidelines
- Pull request process
- Project structure

### Quick Contribution Steps
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes
6. Push to your fork
7. Open a Pull Request

---

## 📊 Database

### Statistics
- **Total Games**: 9,160,700 (9.1M)
- **Players**: 442,516
- **Tournaments**: 18,254
- **Date Range**: 1851-2025
- **Database Size**: 5.1GB
- **ECO Coverage**: 100%

### Database Access
- **Development**: Use `otb-database/railway-subset.db` (small subset)
- **Production**: Download from [GitHub Release](https://github.com/budapestdude/stats/releases/tag/database-v2)
- **Script**: `node download-full-db.js` (auto-downloads and assembles)

---

## 📈 Roadmap

See [TODO.md](TODO.md) for detailed roadmap. Key upcoming features:
- [ ] Player comparison tool
- [ ] Advanced ML-based analytics
- [ ] Progressive Web App (PWA)
- [ ] User accounts and favorites
- [ ] Chess engine integration
- [ ] Mobile apps (React Native)

---

## 🔒 Security

Please report security vulnerabilities to [SECURITY.md](SECURITY.md) (when created) or open a private security advisory on GitHub.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Chess game data from LumbrasGigaBase OTB database
- Chess.com and Lichess for API access
- Next.js, React, and Express communities
- All contributors to this project

---

## 📞 Support

- **Documentation**: Check [CLAUDE.md](CLAUDE.md) and other guides
- **Issues**: [GitHub Issues](https://github.com/budapestdude/stats/issues)
- **Discussions**: [GitHub Discussions](https://github.com/budapestdude/stats/discussions)

---

**Made with ♟️ by the Chess Stats team**

⭐ Star this repo if you find it useful!
