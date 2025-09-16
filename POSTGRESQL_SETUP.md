# PostgreSQL Setup Guide for Chess Stats

## Why PostgreSQL?

For a 10M+ game database, PostgreSQL offers:
- **Partitioning**: Tables split by date for faster queries
- **Better indexing**: GIN, GiST, and partial indexes
- **Materialized views**: Pre-computed aggregations
- **JSONB support**: Efficient storage for ratings data
- **Full-text search**: Fast player/tournament name searches
- **Better concurrency**: Multiple readers/writers
- **Compression**: Automatic TOAST compression for large text fields

SQLite limitations at scale:
- Single writer at a time
- No partitioning
- Limited index types
- No materialized views
- Slower aggregations on large datasets

## Installation

### Windows

1. Download PostgreSQL 15+ from: https://www.postgresql.org/download/windows/
2. Run the installer with default settings
3. Remember your postgres password
4. Default port: 5432

### Verify Installation

```bash
# Add PostgreSQL to PATH (adjust version number)
set PATH=%PATH%;C:\Program Files\PostgreSQL\15\bin

# Test connection
psql -U postgres -c "SELECT version();"
```

## Database Setup

### 1. Create Database

```bash
# Login as postgres user
psql -U postgres

# Create database
CREATE DATABASE chess_stats;

# Create user (optional but recommended)
CREATE USER chess_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE chess_stats TO chess_user;

# Exit
\q
```

### 2. Apply Optimized Schema

```bash
# Apply the optimized schema
psql -U postgres -d chess_stats -f database/schema-optimized.sql
```

### 3. Configure PostgreSQL for Large Dataset

Edit `postgresql.conf` (usually in PostgreSQL data directory):

```conf
# Memory (adjust based on your system - these are for 16GB RAM)
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
work_mem = 32MB

# Checkpoint
checkpoint_segments = 32
checkpoint_completion_target = 0.9
wal_buffers = 16MB

# Query Planning
random_page_cost = 1.1  # For SSD
effective_io_concurrency = 200  # For SSD

# Parallel queries
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
max_parallel_maintenance_workers = 4

# Statistics
default_statistics_target = 100
```

### 4. Create .env File

Create `.env` in project root:

```env
# PostgreSQL Connection
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chess_stats
DB_USER=chess_user
DB_PASSWORD=your_secure_password

# Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=20

# Keep SQLite for comparison
SQLITE_DB_PATH=./otb-database/chess-stats.db
```

## Migration from SQLite

Run the migration script:

```bash
node migrate-sqlite-to-postgresql.js
```

This will:
1. Connect to both databases
2. Migrate players (with ID mapping)
3. Migrate tournaments
4. Migrate games in batches (10,000 at a time)
5. Update statistics and materialized views

## Performance Optimization

### 1. Analyze Tables After Import

```sql
-- Run after importing data
ANALYZE players;
ANALYZE games;
ANALYZE tournaments;
ANALYZE openings;
```

### 2. Refresh Materialized Views

```sql
-- Refresh statistics (run daily)
REFRESH MATERIALIZED VIEW CONCURRENTLY player_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY opening_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_activity;
```

### 3. Monitor Performance

```sql
-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find slow queries
SELECT 
    query,
    calls,
    total_time,
    mean,
    max
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY mean DESC
LIMIT 10;
```

## Backup Strategy

### Daily Backup Script

Create `backup-database.bat`:

```batch
@echo off
set BACKUP_DIR=C:\chess-stats-backups
set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%
set BACKUP_FILE=%BACKUP_DIR%\chess_stats_%TIMESTAMP%.backup

"C:\Program Files\PostgreSQL\15\bin\pg_dump" -U postgres -d chess_stats -Fc -f %BACKUP_FILE%

echo Backup completed: %BACKUP_FILE%
```

### Restore from Backup

```bash
pg_restore -U postgres -d chess_stats -c backup_file.backup
```

## Expected Performance

With proper configuration and the optimized schema:

- **Simple player lookup**: < 10ms
- **Player game history (1000 games)**: < 50ms
- **Opening statistics**: < 100ms (from materialized view)
- **Complex aggregations**: < 500ms (from materialized views)
- **Full-text search**: < 100ms
- **Bulk insert (10,000 games)**: < 5 seconds

## Monitoring Dashboard

Use pgAdmin or DataGrip for visual monitoring:
1. Download pgAdmin: https://www.pgadmin.org/download/
2. Connect to localhost:5432
3. Monitor query performance, locks, and statistics

## Troubleshooting

### Connection Issues
- Check PostgreSQL service is running: `net start postgresql-x64-15`
- Verify firewall allows port 5432
- Check pg_hba.conf for authentication settings

### Performance Issues
- Run `VACUUM ANALYZE` on all tables
- Check for missing indexes: `SELECT * FROM pg_stat_user_tables WHERE n_dead_tup > 1000;`
- Monitor connections: `SELECT * FROM pg_stat_activity;`

### Disk Space
- Enable compression: `ALTER TABLE games SET (toast_compression = 'lz4');`
- Archive old partitions to separate tablespace
- Use `pg_repack` to reclaim space without locking