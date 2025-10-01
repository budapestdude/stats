# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Chess Stats is a comprehensive web application for chess statistics, player analysis, opening exploration, and tournament tracking. It integrates with Chess.com and Lichess APIs to provide real-time data and analysis, with additional OTB (Over-the-Board) tournament data analysis capabilities.

## Tech Stack
- **Backend**: Node.js with Express (JavaScript primary, TypeScript secondary)
- **Frontend**: Next.js 15 with React 19, TypeScript, and Tailwind CSS
- **Database**: SQLite (complete-tournaments.db with 9.1M games) for OTB tournament data
- **APIs**: Chess.com API, Lichess API integration
- **Analysis**: Custom PGN parser and tournament analyzers in otb-database/
- **Testing**: Jest with Supertest for backend, coverage target 70%+

## Development Commands

### Quick Start (Windows)
```bash
# Start both backend and frontend servers (legacy)
./start-dev.bat

# Start improved development servers
./start-dev.ps1
```

### Production-Ready Servers (Recommended)
```bash
# Optimized server with caching (port 3009)
node simple-server-optimized.js

# Production pooled server with connection pooling (port 3010) - RECOMMENDED
node simple-server-pooled.js

# Original legacy server (port 3007)
node simple-server.js

# Production server (default port 3007 or configured)
node production-server.js
```

### Docker Deployment (Production-Ready)
```bash
# Production deployment with optimized pooled server
docker-compose up -d

# Development with all servers exposed
docker-compose --profile dev up -d

# Automated deployment script
./deploy.sh production    # Deploy to production
./deploy.sh development   # Deploy to dev with all servers
```

### Hetzner Production Deployment
```bash
# Deploy to Hetzner VPS (production)
./hetzner-deploy.sh

# Automated setup for new server
./setup-auto-deploy.sh

# Check deployment status
ssh root@YOUR_SERVER_IP "systemctl status chess-stats"
```

### Backend Server Options
```bash
# Legacy primary server (JavaScript, port 3007)
node simple-server.js

# Optimized server with query caching (port 3009)
node simple-server-optimized.js

# Production pooled server with connection management (port 3010)
node simple-server-pooled.js

# TypeScript development server (port 3001)
npm run dev              # Uses nodemon with src/server.ts
npm run dev:simple       # Uses nodemon with src/server-simple.ts

# Production
npm run build           # TypeScript compilation
npm start               # Run compiled version

# Code quality
npm run lint            # ESLint for TypeScript files
npm run format          # Prettier formatting
```

### Frontend Server
```bash
cd frontend

# Development
npm run dev             # Starts on port 3000

# Production
npm run build
npm start

# Linting
npm run lint            # Next.js linting
```

### Testing
```bash
# Backend tests
npm test                 # Run all tests
npm run test:watch       # Watch mode for development
npm run test:coverage    # Generate coverage report

# Run specific test
npm test -- tests/unit/players.test.js

# Test configuration details:
- Framework: Jest with Supertest
- Environment: Node
- Coverage threshold: 70% (branches, functions, lines, statements)
- Test files: tests/ directory
- Unit tests: tests/unit/
- Integration tests: tests/integration/
- Test utilities: tests/setup.js
- Mocks: tests/__mocks__/
- Timeout: 10 seconds per test
```

### Performance & Feature Testing
```bash
# Comprehensive feature testing (all servers)
node test-all-features.js

# Performance benchmarking
node test-performance.js

# Connection pool testing
node test-pool.js

# Database optimization testing
node src/utils/database-analyzer.js

# Create database indexes
node create-indexes.js
```

## API Architecture

### Server Architecture (Production-Ready)
The application provides three optimized servers:

- **Port 3007**: `simple-server.js` - Legacy server (original implementation)
- **Port 3009**: `simple-server-optimized.js` - Optimized with query caching and database optimizations
- **Port 3010**: `simple-server-pooled.js` - **PRODUCTION SERVER** with connection pooling, monitoring, and enterprise features

**Recommended for production: Port 3010 (pooled server)** with connection pooling, real-time monitoring, and comprehensive performance optimizations.

### Core API Endpoints (All Servers)

### Core Endpoints
- `/health` - Health check endpoint
- `/api/test` - Basic API test

### Player Endpoints
- `/api/players/:username` - Get player data (supports both Chess.com and Lichess)
- `/api/players/top` - Top players by rating category
- `/api/players/search` - Search players
- `/api/players/:username/games` - Player game archives
- `/api/players/:username/stats` - Player statistics

### Game & Analysis Endpoints
- `/api/games/search` - Search games database
- `/api/openings` - Opening statistics
- `/api/openings/explorer` - Lichess opening explorer (real data)
- `/api/openings/popular` - Popular openings analysis
- `/api/openings/eco/:eco` - Get opening by ECO code

### Tournament & OTB Database
- `/api/tournaments` - Tournament listings
- `/api/tournaments/upcoming` - Upcoming tournaments
- `/api/tournaments/:id` - Tournament details
- `/api/tournaments/:id/standings` - Tournament standings
- `/api/tournaments/:id/games` - Tournament games
- `/api/otb/database/search` - Search OTB tournament database
- `/api/otb/database/tournaments` - List OTB tournaments
- `/api/otb/database/players/:name/games` - Player's OTB games
- `/api/otb/database/game/:id` - Individual game data

### Statistics Endpoints
- `/api/stats/overview` - Platform statistics overview
- `/api/stats/rating-distribution` - Rating distribution data
- `/api/stats/activity` - Activity statistics
- `/api/stats/opening-trends` - Opening popularity trends
- `/api/stats/country-rankings` - Country-based rankings

### Production Server Exclusive Endpoints (Port 3010)
- `/api/pool/stats` - Connection pool statistics and performance metrics
- `/api/stress-test` - Load testing endpoint for performance validation
- `/monitoring/dashboard` - Real-time monitoring dashboard (web interface)
- `/monitoring/metrics` - Detailed performance metrics (JSON)
- `/monitoring/snapshot` - Current performance snapshot
- `/monitoring/health` - Comprehensive health checks
- `/monitoring/alerts` - System alerts and notifications
- `/api/cache/clear` - Clear query cache (development/maintenance)

### External API Integration
- **Chess.com API** (`https://api.chess.com/pub`)
  - Uses proper User-Agent header as required
  - Handles rate limiting with 429 status codes
- **Lichess API** (`https://lichess.org/api`)
  - Opening explorer with position analysis
  - Top players by variant

### Frontend API Configuration
The frontend can be configured to use different backend servers:
- **Development**: Uses `http://localhost:3007` (or 3009/3010) via Next.js rewrites
- **Production (Railway)**: Frontend deployed on Railway, calls Hetzner API directly (configured via NEXT_PUBLIC_API_URL)
- **Production (Hetzner)**: Both frontend and backend on same server
- API URLs configured in `frontend/app/lib/cache.ts` and `frontend/app/contexts/CacheContext.tsx`

## Frontend Structure

Next.js 15 App Router pages:
- `/` - Home with platform overview
- `/players` - Player search and listings
- `/players/[username]` - Individual profiles (pre-generated for top players)
- `/openings` - Opening explorer with analysis
- `/games` - Game database browser
- `/tournaments` - Tournament calendar
- `/tournaments/[slug]` - Tournament details
- `/statistics` - Statistical analysis
- `/compare` - Player comparison
- `/otb-database` - OTB tournament data interface
- `/historical` - Historical analysis with timeline
- `/test` - API testing interface
- `/api-test` - Comprehensive API testing
- `/real-data-test` - Live API data testing
- `/debug` - Debug information display

## OTB Database System

The project includes comprehensive OTB tournament data processing:

### Key Modules (otb-database/)
- `download-manager.js` - Downloads PGN files from sources
- `pgn-parser.js` - Parses PGN format chess games
- `enhanced-pgn-parser.js` - Enhanced parser with better error handling
- `database-indexer.js` - Indexes games into SQLite
- `batch-indexer.js` - Batch processing for large files
- `optimized-importer.js` - Optimized import for performance
- `tournament-extractor.js` - Extracts tournament metadata
- `player-analyzer-enhanced.js` - Advanced player statistics
- `historical-analyzer.js` - Historical trend analysis
- `comprehensive-analyzer.js` - Multi-dimensional analysis
- `name-normalizer.js` - Normalizes player names for consistency

### Database Schema
SQLite database (`complete-tournaments.db`) with tables:
- `games` - Full game records with moves (9.1M+ records)
- `tournaments` - Tournament information
- `players` - Player profiles and ratings
- `openings` - Opening repertoires
- Indexes on players, dates, tournaments for performance

### Database Build Options
```bash
# Build production database (8-12 GB, 10.5M games)
node build-production-database.js

# Check import status
node check-import-status.js

# Verify database
node check-production-db.js
```

## Important Configuration

### Port Configuration
- **Backend Legacy** (simple-server.js): **3007**
- **Backend Optimized** (simple-server-optimized.js): **3009**
- **Backend Production** (simple-server-pooled.js): **3010** ⭐ **RECOMMENDED**
- Backend TypeScript: 3001
- Frontend Next.js: 3000 (default)

### TypeScript Configuration
- Target: ES2022
- Module: CommonJS
- Strict mode enabled
- Source maps enabled
- Output directory: ./dist
- Root directory: ./src

### CORS Settings
Backend allows any localhost port for development flexibility.

### Environment Considerations
- No `.env` file required for basic operation
- User-Agent header configured for Chess.com compliance
- Rate limiting awareness built into API calls

## Testing & Verification

### API Testing
```bash
# Backend health checks (all servers)
curl http://localhost:3007/health  # Legacy server
curl http://localhost:3009/health  # Optimized server
curl http://localhost:3010/health  # Production pooled server (recommended)

# Production server specific endpoints
curl http://localhost:3010/api/pool/stats          # Connection pool stats
curl http://localhost:3010/monitoring/snapshot     # Performance metrics
curl http://localhost:3010/api/stress-test?requests=50  # Load testing

# Test specific endpoints (works on all servers)
curl http://localhost:3010/api/players/magnuscarlsen
curl http://localhost:3010/api/openings/explorer
curl http://localhost:3010/api/tournaments
curl http://localhost:3010/api/stats/database
```

### Frontend Testing Pages
- `/test` - Main API testing interface
- `/api-test` - Comprehensive endpoint testing
- `/real-data-test` - Live data validation
- `/cache-monitor` - Cache monitoring interface (React Query cache inspection)
- `/dev-tools` - Development tools
- `/websocket-test` - WebSocket connection testing
- `/debug` - Debug information and environment

### Test Structure & Requirements
- **Unit tests**: In `tests/unit/` for individual functions
- **Integration tests**: In `tests/integration/` for API endpoints
- **Test utilities**: Available in `tests/setup.js`
- **Mocks**: P-queue mock in `tests/__mocks__/`
- **Coverage target**: 70% minimum
- **Test matching**: `**/__tests__/**/*.js` and `**/?(*.)+(spec|test).js`

## Development Workflow

1. **Start Development**: Run `./start-dev.bat` to launch both servers
2. **Backend Changes**: Edit `simple-server.js` directly (no compilation needed)
3. **Frontend Changes**: Next.js hot-reloads automatically
4. **OTB Data Processing**: Use scripts in `otb-database/` for tournament data
5. **API Testing**: Use `/test` page or direct API calls
6. **Run Tests**: Use `npm test` before committing changes
7. **Lint and Format**: Run `npm run lint` and `npm run format` for code quality

## Code Conventions

### Backend
- Primary server in JavaScript (`simple-server.js`) for simplicity
- TypeScript alternatives available but not primary
- Express middleware order: CORS → JSON parsing → routes
- Proper error handling with try-catch blocks
- Test coverage required for all new endpoints
- Use async/await for asynchronous operations

### Frontend
- TypeScript for all components
- Tailwind CSS for styling with custom utilities in `lib/utils.ts`
- React Query (@tanstack/react-query) for data fetching and caching
  - Configured with CacheContext in `frontend/app/contexts/CacheContext.tsx`
  - Preloading strategy in `frontend/app/lib/cache.ts`
- Chess.js library for move validation
- react-chessboard for board visualization
- Components should be functional with hooks
- Next.js 15 App Router with React 19 Server Components where applicable

### Data Processing
- OTB database scripts use Node.js with SQLite
- Batch processing for large PGN files
- Progress monitoring with checkpoint files
- Memory-efficient streaming for large datasets
- Error recovery and resume capabilities

## High-level Architecture

### Request Flow
1. Client (Next.js frontend) makes API request
2. Backend Express server receives request on port 3007/3009/3010
3. Middleware processes (CORS, auth if needed, rate limiting)
4. Controller handles business logic
5. External APIs (Chess.com/Lichess) or SQLite database queried
6. Response formatted and sent back
7. Frontend updates UI with React Query caching

### Data Sources
- **Real-time data**: Chess.com and Lichess APIs
- **Historical OTB data**: SQLite database with 9.1M+ imported games
- **Caching**: In-memory caching for frequently accessed data
- **Static data**: Pre-generated pages for top players

### Key Dependencies
- **express**: Web framework
- **axios**: HTTP client for API calls
- **sqlite3**: Database for OTB games (complete-tournaments.db)
- **chess.js**: Chess move validation and logic
- **react-chessboard**: Chess board visualization
- **@tanstack/react-query**: Data fetching and caching
- **p-queue**: Queue management for rate limiting
- **winston**: Logging (src/utils/logger.js)
- **recharts**: Data visualization charts
- **lucide-react**: Icon library

## Deployment Architecture

### Production Environment (Hetzner VPS)
- **Frontend**: Next.js deployed on Railway (https://your-app.railway.app)
- **Backend**: Node.js server on Hetzner VPS (http://195.201.6.244:3007)
- **Database**: SQLite database on Hetzner server (9.1M+ games)
- **Configuration**: Frontend makes direct API calls to Hetzner backend

### Deployment Files
- `deploy.sh` - Automated Docker deployment script
- `hetzner-deploy.sh` - Direct deployment to Hetzner VPS
- `setup-auto-deploy.sh` - Configure GitHub Actions auto-deployment
- `Dockerfile` - Multi-stage Docker build
- `docker-compose.yml` - Production container orchestration
- `.github/workflows/` - CI/CD pipeline (if configured)

### Railway Deployment
Frontend is deployed on Railway with:
- Environment variable `NEXT_PUBLIC_API_URL` pointing to Hetzner backend
- Build command: `npm run build`
- Start command: `npm start`
- No backend API routes (frontend calls Hetzner directly)