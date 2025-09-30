const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'chess-stats.db');

if (!fs.existsSync(dbPath)) {
  console.error('Database file not found:', dbPath);
  process.exit(1);
}

console.log('🔧 Creating optimized indexes for chess-stats.db');
console.log('================================================');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('✓ Connected to database');
});

// Performance optimizations
db.serialize(() => {
  console.log('\n📊 Applying database optimizations...');
  
  db.run('PRAGMA journal_mode = WAL', (err) => {
    if (!err) console.log('✓ WAL mode enabled');
  });
  
  db.run('PRAGMA synchronous = NORMAL');
  db.run('PRAGMA cache_size = -64000'); // 64MB cache
  db.run('PRAGMA temp_store = MEMORY');
  db.run('PRAGMA mmap_size = 268435456'); // 256MB memory-mapped I/O
  db.run('PRAGMA page_size = 4096');
  db.run('PRAGMA threads = 4');
  
  console.log('✓ Performance settings applied');
});

const indexes = [
  // Player indexes
  {
    name: 'idx_games_white',
    sql: 'CREATE INDEX IF NOT EXISTS idx_games_white ON games(white)',
    description: 'White player lookup'
  },
  {
    name: 'idx_games_black',
    sql: 'CREATE INDEX IF NOT EXISTS idx_games_black ON games(black)',
    description: 'Black player lookup'
  },
  {
    name: 'idx_games_players_composite',
    sql: 'CREATE INDEX IF NOT EXISTS idx_games_players_composite ON games(white, black, date)',
    description: 'Composite player search'
  },
  
  // Date and event indexes
  {
    name: 'idx_games_date',
    sql: 'CREATE INDEX IF NOT EXISTS idx_games_date ON games(date)',
    description: 'Date-based queries'
  },
  {
    name: 'idx_games_event',
    sql: 'CREATE INDEX IF NOT EXISTS idx_games_event ON games(event)',
    description: 'Tournament/event lookup'
  },
  {
    name: 'idx_games_event_date',
    sql: 'CREATE INDEX IF NOT EXISTS idx_games_event_date ON games(event, date)',
    description: 'Event timeline queries'
  },
  
  // Opening indexes
  {
    name: 'idx_games_eco',
    sql: 'CREATE INDEX IF NOT EXISTS idx_games_eco ON games(eco)',
    description: 'ECO code lookup'
  },
  {
    name: 'idx_games_opening',
    sql: 'CREATE INDEX IF NOT EXISTS idx_games_opening ON games(opening)',
    description: 'Opening name lookup'
  },
  {
    name: 'idx_games_opening_stats',
    sql: 'CREATE INDEX IF NOT EXISTS idx_games_opening_stats ON games(eco, opening, result)',
    description: 'Opening statistics'
  },
  
  // Rating indexes
  {
    name: 'idx_games_white_elo',
    sql: 'CREATE INDEX IF NOT EXISTS idx_games_white_elo ON games(white_elo)',
    description: 'White rating queries'
  },
  {
    name: 'idx_games_black_elo',
    sql: 'CREATE INDEX IF NOT EXISTS idx_games_black_elo ON games(black_elo)',
    description: 'Black rating queries'
  },
  {
    name: 'idx_games_avg_elo',
    sql: 'CREATE INDEX IF NOT EXISTS idx_games_avg_elo ON games((white_elo + black_elo) / 2)',
    description: 'Average rating queries'
  },
  
  // Result and time control
  {
    name: 'idx_games_result',
    sql: 'CREATE INDEX IF NOT EXISTS idx_games_result ON games(result)',
    description: 'Result filtering'
  },
  {
    name: 'idx_games_time_control',
    sql: 'CREATE INDEX IF NOT EXISTS idx_games_time_control ON games(time_control)',
    description: 'Time control filtering'
  },
  
  // Full-text search support
  {
    name: 'idx_games_player_search',
    sql: 'CREATE INDEX IF NOT EXISTS idx_games_player_search ON games(white COLLATE NOCASE, black COLLATE NOCASE)',
    description: 'Case-insensitive player search'
  },
  
  // Other table indexes if they exist
  {
    name: 'idx_events_name',
    sql: 'CREATE INDEX IF NOT EXISTS idx_events_name ON events(name)',
    description: 'Event name lookup',
    optional: true
  },
  {
    name: 'idx_players_name',
    sql: 'CREATE INDEX IF NOT EXISTS idx_players_name ON players(name)',
    description: 'Player name lookup',
    optional: true
  },
  {
    name: 'idx_players_rating',
    sql: 'CREATE INDEX IF NOT EXISTS idx_players_rating ON players(rating DESC)',
    description: 'Player rating ranking',
    optional: true
  }
];

let completed = 0;
let failed = 0;

console.log(`\n🚀 Creating ${indexes.length} indexes...`);
console.log('================================');

db.serialize(() => {
  indexes.forEach((index) => {
    db.run(index.sql, (err) => {
      if (err) {
        if (index.optional && err.message.includes('no such table')) {
          console.log(`⊘ ${index.name}: Table doesn't exist (skipped)`);
        } else {
          console.error(`✗ ${index.name}: ${err.message}`);
          failed++;
        }
      } else {
        console.log(`✓ ${index.name}: ${index.description}`);
        completed++;
      }
      
      // Check if all indexes have been processed
      if (completed + failed === indexes.length || 
          (index.optional && completed + failed === indexes.filter(i => !i.optional).length)) {
        finalize();
      }
    });
  });
});

function finalize() {
  console.log('\n📈 Updating database statistics...');
  
  db.run('ANALYZE', (err) => {
    if (err) {
      console.error('Error running ANALYZE:', err);
    } else {
      console.log('✓ Statistics updated');
    }
    
    // Get database info
    db.get("SELECT COUNT(*) as count FROM games", (err, row) => {
      if (!err && row) {
        console.log(`\n📊 Database Info:`);
        console.log(`  Total games: ${row.count.toLocaleString()}`);
      }
      
      // Get index info
      db.all("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'", (err, rows) => {
        if (!err && rows) {
          console.log(`  Total indexes: ${rows.length}`);
        }
        
        console.log('\n✅ Index creation complete!');
        console.log(`  Created: ${completed}`);
        if (failed > 0) {
          console.log(`  Failed: ${failed}`);
        }
        
        console.log('\n💡 Tips for optimal performance:');
        console.log('  - The database now uses WAL mode for better concurrency');
        console.log('  - Indexes will significantly speed up player, opening, and event searches');
        console.log('  - First queries may be slower as the cache warms up');
        console.log('  - Use the optimized-server.js for best performance');
        
        db.close();
      });
    });
  });
}