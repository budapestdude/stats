# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive development infrastructure and configuration files
- GitHub issue templates (bug report, feature request)
- Pull request template with extensive checklist
- CONTRIBUTING.md with development guidelines
- SECURITY.md for vulnerability reporting
- .dockerignore for optimized Docker builds
- .editorconfig for consistent code formatting
- .prettierignore for Prettier exclusions
- Updated README.md with current project state
- LICENSE file (MIT)

### Changed
- Updated .gitignore to exclude Claude IDE directory and large database files
- Enhanced npm scripts in package.json for better workflow

## [1.0.0] - 2025-10-16

### Added - Major Codebase Organization
- Added entire src/ directory to git (80+ TypeScript/JavaScript files)
- Added scripts/ directory with deployment and database utilities
- Added lib/ directory with database optimizer
- Added frontend/components/ with React components
- Created Dockerfile with multi-stage builds
- Created docker-compose.yml with production and dev profiles
- Added .env.example files for configuration templates
- Created comprehensive documentation:
  - TODO.md - Current project status and roadmap
  - ROOT_DIRECTORY_CLEANUP_PLAN.md - Organization strategy
  - DATABASE_CHUNKS_GUIDE.md - Database management guide
  - DEPLOYMENT_GUIDES_INDEX.md - Deployment documentation index

### Changed
- Updated .gitignore to properly exclude temporary database files
- Enhanced package.json with new npm scripts:
  - build:backend, build:full
  - start:pooled, start:optimized, start:legacy

### Fixed
- Critical git tracking issues resolved (src/ was untracked)
- Database temporary files now properly excluded from git

## [0.9.0] - 2025-10-11 - Production Deployment

### Added - Railway Production Deployment
- Deployed backend to Railway (9.1M games database)
- Deployed frontend to Railway with Next.js 15
- Full database download system (5.1GB in 3 chunks)
- PGN extraction for ALL 9.1M games via on-demand system
- Real tournament data integration
- All API endpoints functional and documented

### Added - Server Architecture
- Simple-server-pooled.js (port 3010) - Production server with connection pooling
- Simple-server-optimized.js (port 3009) - Optimized with query caching
- Simple-server.js (port 3007) - Legacy server
- Real-time monitoring dashboard
- Health checks and performance metrics
- Connection pool statistics endpoint

### Added - Frontend Pages
- Home page with platform overview
- Player search and profiles
- Pre-generated pages for top 10 players
- Opening explorer with analysis
- Tournament calendar
- Game database browser
- Statistics dashboard
- All tabs working (Overview, Yearly Progress, Openings, Opponents)

### Added - API Integration
- Chess.com API integration with proper User-Agent
- Lichess API integration
- Full OTB database API (9.1M games)
- Player statistics calculation
- Opening analysis endpoints
- Tournament endpoints with real data
- Game search with comprehensive filters

### Added - Database & Performance
- SQLite database with 9.1M games indexed
- Player name normalization system
- ECO code standardization (100% coverage)
- Source PGN file organization (7.1GB)
- Database indexing for fast queries

### Fixed - Data Quality
- Opening data now shows all games (was showing only 3-8)
  - Fixed by using SUBSTR(eco, 1, 3) for base ECO codes
- Tournament endpoint returns real data (was returning mocks)
- Game search returns actual database games
- PGN moves available for ALL games via extraction system

## [0.5.0] - 2025-09 - OTB Database Integration

### Added
- Complete OTB tournament database integration
- 9.1M games from 1851-2025
- 442K players, 18K tournaments
- PGN parser and batch indexer
- Tournament extractor and analyzer
- Player analyzer with enhanced statistics
- Historical trend analysis
- Name normalization system

### Added - Testing
- Jest test framework setup
- Unit tests for core modules
- Integration tests for API endpoints
- Coverage reporting (70% target)
- Test fixtures and mocks

## [0.3.0] - 2025-08 - Frontend Development

### Added
- Next.js 15 with React 19 framework
- TypeScript for all frontend code
- Tailwind CSS styling system
- React Query for data fetching and caching
- Chess.js for move validation
- react-chessboard for board visualization
- Recharts for data visualization

### Added - Frontend Features
- Interactive chess board
- Player profile pages
- Opening explorer interface
- Game browser with filters
- Tournament calendar view
- Statistics dashboard
- Responsive design for mobile

## [0.1.0] - 2025-07 - Initial Release

### Added - Backend Foundation
- Express.js server setup
- TypeScript configuration
- SQLite database support
- Basic API structure
- CORS configuration
- Error handling middleware
- Logging with Winston

### Added - Core Features
- Player data endpoints
- Game search functionality
- Opening database queries
- Tournament data endpoints
- Basic statistics calculations

---

## Version History Summary

- **v1.0.0**: Major codebase organization and infrastructure improvements
- **v0.9.0**: Production deployment to Railway with full feature set
- **v0.5.0**: OTB database integration with 9.1M games
- **v0.3.0**: Frontend development with Next.js and React
- **v0.1.0**: Initial backend foundation and core features

---

## Links

- [GitHub Repository](https://github.com/budapestdude/stats)
- [Production Frontend](https://invigorating-solace-production.up.railway.app)
- [Production API](https://stats-production-10e3.up.railway.app)
- [Database Release](https://github.com/budapestdude/stats/releases/tag/database-v2)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

For security vulnerabilities, see [SECURITY.md](SECURITY.md).
