# Root Directory Cleanup Plan

## Current State
The root directory contains many server files and utility scripts that could be better organized.

## Server Files Analysis

### Production Servers (Keep in Root - Frequently Used)
- `simple-server.js` - Legacy server (port 3007)
- `simple-server-optimized.js` - Optimized with caching (port 3009)
- `simple-server-pooled.js` - **RECOMMENDED** Production pooled server (port 3010)
- `production-server.js` - Production server alternative

### Specialized/Experimental Servers (Consider Moving to `servers/` directory)
- `optimized-server.js` - Optimization experiment
- `server-refactored.js` - Refactored version
- `server-with-docs.js` - Server with Swagger docs
- `server-secure.js` - Security-hardened version
- `simple-server-cached.js` - Caching experiment
- `simple-server-postgresql.js` - PostgreSQL version
- `simple-server-production.js` - Production variant
- `fast-api-server.js` - Fast API variant
- `tournament-archive-api.js` - Tournament-specific server
- `production-archive-api.js` - Production archive server

### Database Utilities (Consider Moving to `scripts/database/`)
- `build-production-database.js`
- `check-production-db.js`
- `check-import-status.js`
- `check-columns.js`
- `check-schema.js`
- `check-player-count.js`
- `add-indexes.js`
- `create-database-indexes.js`
- `create-search-indexes.js`
- `inspect-production.js`
- `quick-db-test.js`
- `test-db-performance.js`
- `create-subset-db.js`
- `migrate-to-archive.js`
- `migrate-sqlite-to-postgresql.js`

### Player/Data Management (Consider Moving to `scripts/data/`)
- `create-player-pages.js`
- `update-player-pages.js`
- `index-all-players.js`
- `import-tournament-data.js`
- `import-everything.js`

### Testing Files (Consider Moving to `tests/manual/`)
- `test-performance.js`
- `test-pool.js`
- `test-all-features.js`
- `test-enhanced-search.js`
- `test-advanced-statistics.js`
- `test-ml-system.js`
- `test-retry-mechanism.js`
- `test-carlsen-search.js`
- `train-ml-models.js`

### Monitoring/Analysis (Keep or Move to `scripts/monitoring/`)
- `monitor-build.js`

### Deployment/Setup Scripts (Consider Moving to `scripts/deployment/`)
- `upload-to-railway.js`

### Temporary/Checkpoint Files (Consider Cleanup)
- `import-checkpoint.json`
- `production-checkpoint.json`
- `nul` - Empty file, can be deleted
- `upload.tar.gz` - Old upload archive, consider deleting
- `performance-results-1756443578973.csv` - Old test results
- `performance-results-1756443578973.json` - Old test results

### Windows-Specific Batch Files (Keep in Root for Convenience)
- `start-dev.bat`
- `start-dev-improved.bat`
- `start-both-servers.bat`
- `import-10m-games.bat`
- `download-postgresql.bat`
- `setup-postgresql.bat`

### PowerShell Scripts (Keep in Root for Windows Setup)
- `start-dev.ps1`
- `auto-setup-windows.ps1`
- `setup-postgresql.ps1`
- `fix-ssh-key.ps1`

### Configuration Files (Keep in Root)
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `jest.config.js`
- `ecosystem.config.js`
- `.gitignore`
- `.env.example`
- `.env.production.example`
- `Dockerfile`
- `docker-compose.yml`
- `railway.json`

### Database Files (Keep - Active Use)
- `complete-tournaments.db`
- `chess-stats.db`
- `chess-production.db`
- Database chunks: `complete-tournaments.db.part1/2/3`

## Recommended Action Plan

### Phase 1: Create Organization Structure
```
mkdir -p servers/experimental
mkdir -p scripts/database
mkdir -p scripts/data
mkdir -p tests/manual
mkdir -p scripts/monitoring
mkdir -p archive/old-results
```

### Phase 2: Move Files
1. Move experimental servers to `servers/experimental/`
2. Move database utilities to `scripts/database/`
3. Move data management to `scripts/data/`
4. Move manual tests to `tests/manual/`
5. Move old results to `archive/old-results/`

### Phase 3: Cleanup
1. Delete `nul` file
2. Archive or delete old `.csv`/`.json` result files
3. Consider archiving `.tar.gz` files

### Phase 4: Update Documentation
1. Update CLAUDE.md with new structure
2. Update start scripts to reflect new paths
3. Document which servers are production-ready

## Keep in Root (Essential Files)
- **Production Servers**: simple-server*.js (3 main ones)
- **Development Scripts**: start-dev.* files
- **Configuration**: package.json, tsconfig.json, docker files
- **Documentation**: All .md files
- **Database**: Active .db files

## Benefits
- Cleaner root directory
- Easier to find production vs experimental code
- Better organization for new developers
- Reduces confusion about which server to use
