#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'otb-database', 'complete-tournaments.db');

console.log('🚀 Optimizing database for production...\n');

if (!fs.existsSync(DB_PATH)) {
  console.error('❌ Database not found at:', DB_PATH);
  process.exit(1);
}

const db = new sqlite3.Database(DB_PATH);

async function runQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function getQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function optimizeDatabase() {
  try {
    console.log('📊 Analyzing database...');
    
    // Get database size
    const stats = fs.statSync(DB_PATH);
    console.log(`   Database size: ${(stats.size / 1024 / 1024 / 1024).toFixed(2)} GB`);
    
    // Get table counts
    const gamesCount = await getQuery('SELECT COUNT(*) as count FROM games');
    console.log(`   Total games: ${gamesCount.count.toLocaleString()}`);
    
    // Create essential indexes for production
    console.log('\n📑 Creating performance indexes...');
    
    const indexes = [
      // Player indexes
      {
        name: 'idx_games_white_player',
        sql: 'CREATE INDEX IF NOT EXISTS idx_games_white_player ON games(white_player)'
      },
      {
        name: 'idx_games_black_player',
        sql: 'CREATE INDEX IF NOT EXISTS idx_games_black_player ON games(black_player)'
      },
      {
        name: 'idx_games_players_combined',
        sql: 'CREATE INDEX IF NOT EXISTS idx_games_players_combined ON games(white_player, black_player)'
      },
      
      // Tournament indexes
      {
        name: 'idx_games_tournament',
        sql: 'CREATE INDEX IF NOT EXISTS idx_games_tournament ON games(tournament_name)'
      },
      {
        name: 'idx_games_tournament_date',
        sql: 'CREATE INDEX IF NOT EXISTS idx_games_tournament_date ON games(tournament_name, date)'
      },
      
      // Date indexes
      {
        name: 'idx_games_date',
        sql: 'CREATE INDEX IF NOT EXISTS idx_games_date ON games(date)'
      },
      {
        name: 'idx_games_year',
        sql: 'CREATE INDEX IF NOT EXISTS idx_games_year ON games(substr(date, 1, 4))'
      },
      
      // Opening indexes
      {
        name: 'idx_games_eco',
        sql: 'CREATE INDEX IF NOT EXISTS idx_games_eco ON games(eco)'
      },
      {
        name: 'idx_games_opening',
        sql: 'CREATE INDEX IF NOT EXISTS idx_games_opening ON games(opening)'
      },
      
      // Result index
      {
        name: 'idx_games_result',
        sql: 'CREATE INDEX IF NOT EXISTS idx_games_result ON games(result)'
      },
      
      // Composite indexes for common queries
      {
        name: 'idx_games_player_date',
        sql: 'CREATE INDEX IF NOT EXISTS idx_games_player_date ON games(white_player, date)'
      },
      {
        name: 'idx_games_tournament_round',
        sql: 'CREATE INDEX IF NOT EXISTS idx_games_tournament_round ON games(tournament_name, round)'
      }
    ];
    
    for (const index of indexes) {
      process.stdout.write(`   Creating ${index.name}...`);
      try {
        await runQuery(index.sql);
        console.log(' ✅');
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(' (already exists)');
        } else {
          console.log(` ❌ ${err.message}`);
        }
      }
    }
    
    // Optimize database
    console.log('\n🔧 Running optimization commands...');
    
    // Update statistics
    console.log('   Analyzing tables...');
    await runQuery('ANALYZE');
    
    // Vacuum to reclaim space
    console.log('   Vacuuming database (this may take a while)...');
    await runQuery('VACUUM');
    
    // Set optimal pragmas for production
    console.log('\n⚙️  Setting production pragmas...');
    const pragmas = [
      'PRAGMA journal_mode = WAL',           // Write-Ahead Logging for better concurrency
      'PRAGMA synchronous = NORMAL',         // Balance between safety and speed
      'PRAGMA cache_size = -64000',          // 64MB cache
      'PRAGMA page_size = 4096',             // Optimal page size
      'PRAGMA temp_store = MEMORY',          // Use memory for temp tables
      'PRAGMA mmap_size = 2147483648',       // 2GB memory-mapped I/O
      'PRAGMA optimize'                      // Run query planner optimizations
    ];
    
    for (const pragma of pragmas) {
      await runQuery(pragma);
      console.log(`   ${pragma}`);
    }
    
    // Create summary tables for faster aggregations
    console.log('\n📈 Creating summary tables...');
    
    // Player statistics summary
    await runQuery(`
      CREATE TABLE IF NOT EXISTS player_stats (
        player_name TEXT PRIMARY KEY,
        total_games INTEGER,
        games_as_white INTEGER,
        games_as_black INTEGER,
        wins INTEGER,
        draws INTEGER,
        losses INTEGER,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Tournament summary
    await runQuery(`
      CREATE TABLE IF NOT EXISTS tournament_summary (
        tournament_name TEXT PRIMARY KEY,
        total_games INTEGER,
        start_date TEXT,
        end_date TEXT,
        total_players INTEGER,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Opening statistics
    await runQuery(`
      CREATE TABLE IF NOT EXISTS opening_stats (
        eco TEXT PRIMARY KEY,
        opening_name TEXT,
        total_games INTEGER,
        white_wins INTEGER,
        black_wins INTEGER,
        draws INTEGER,
        avg_ply_count REAL,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('   Summary tables created ✅');
    
    // Get final database size
    const finalStats = fs.statSync(DB_PATH);
    console.log(`\n📊 Final database size: ${(finalStats.size / 1024 / 1024 / 1024).toFixed(2)} GB`);
    
    // Test query performance
    console.log('\n🏃 Testing query performance...');
    
    const testQueries = [
      {
        name: 'Player games lookup',
        sql: 'SELECT COUNT(*) FROM games WHERE white_player = ? OR black_player = ? LIMIT 1',
        params: ['Carlsen, Magnus', 'Carlsen, Magnus']
      },
      {
        name: 'Recent games',
        sql: 'SELECT * FROM games WHERE date >= ? ORDER BY date DESC LIMIT 10',
        params: ['2024-01-01']
      },
      {
        name: 'Opening statistics',
        sql: 'SELECT COUNT(*), AVG(ply_count) FROM games WHERE eco = ?',
        params: ['B90']
      }
    ];
    
    for (const test of testQueries) {
      const start = Date.now();
      await getQuery(test.sql, test.params);
      const time = Date.now() - start;
      console.log(`   ${test.name}: ${time}ms`);
    }
    
    console.log('\n✅ Database optimization complete!');
    console.log('\n📝 Recommendations:');
    console.log('   1. Restart the application to apply all optimizations');
    console.log('   2. Monitor query performance in production');
    console.log('   3. Run this script periodically (monthly) to maintain performance');
    console.log('   4. Consider partitioning if database grows beyond 20GB');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

optimizeDatabase();