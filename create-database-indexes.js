const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'otb-database', 'complete-tournaments.db');

console.log('🔧 Starting database indexing process...');
console.log('📂 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  
  console.log('✅ Connected to database\n');
  
  // Define all indexes we need
  const indexes = [
    {
      name: 'idx_white_player',
      sql: 'CREATE INDEX IF NOT EXISTS idx_white_player ON games(white_player)',
      description: 'Index for white player searches'
    },
    {
      name: 'idx_black_player',
      sql: 'CREATE INDEX IF NOT EXISTS idx_black_player ON games(black_player)',
      description: 'Index for black player searches'
    },
    {
      name: 'idx_date',
      sql: 'CREATE INDEX IF NOT EXISTS idx_date ON games(date)',
      description: 'Index for date-based queries'
    },
    {
      name: 'idx_tournament_name',
      sql: 'CREATE INDEX IF NOT EXISTS idx_tournament_name ON games(tournament_name)',
      description: 'Index for tournament searches'
    },
    {
      name: 'idx_result',
      sql: 'CREATE INDEX IF NOT EXISTS idx_result ON games(result)',
      description: 'Index for result filtering'
    },
    {
      name: 'idx_eco',
      sql: 'CREATE INDEX IF NOT EXISTS idx_eco ON games(eco)',
      description: 'Index for opening searches by ECO code'
    },
    {
      name: 'idx_white_player_date',
      sql: 'CREATE INDEX IF NOT EXISTS idx_white_player_date ON games(white_player, date)',
      description: 'Composite index for white player with date'
    },
    {
      name: 'idx_black_player_date',
      sql: 'CREATE INDEX IF NOT EXISTS idx_black_player_date ON games(black_player, date)',
      description: 'Composite index for black player with date'
    }
  ];
  
  let completed = 0;
  let failed = 0;
  const startTime = Date.now();
  
  console.log(`📊 Creating ${indexes.length} indexes on 9.1M games...`);
  console.log('⏱️  This may take several minutes. Please be patient.\n');
  
  // Create indexes sequentially to avoid locking issues
  function createNextIndex(index) {
    if (index >= indexes.length) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('\n' + '='.repeat(50));
      console.log(`✅ Indexing complete!`);
      console.log(`📊 Results: ${completed} successful, ${failed} failed`);
      console.log(`⏱️  Total time: ${duration} seconds`);
      console.log('='.repeat(50));
      
      // Run ANALYZE to update statistics
      console.log('\n🔍 Updating database statistics...');
      db.run('ANALYZE', (err) => {
        if (err) {
          console.error('❌ Error analyzing database:', err);
        } else {
          console.log('✅ Database statistics updated');
        }
        
        // Test query performance
        console.log('\n🧪 Testing query performance...');
        const testQuery = `
          SELECT COUNT(DISTINCT player_name) as count
          FROM (
            SELECT white_player as player_name FROM games WHERE white_player LIKE '%Fischer%'
            UNION
            SELECT black_player as player_name FROM games WHERE black_player LIKE '%Fischer%'
          )
        `;
        
        const testStart = Date.now();
        db.get(testQuery, (err, row) => {
          const testDuration = Date.now() - testStart;
          if (err) {
            console.error('❌ Test query failed:', err);
          } else {
            console.log(`✅ Test query completed in ${testDuration}ms`);
            console.log(`📊 Found ${row.count} players matching "Fischer"`);
          }
          
          db.close((err) => {
            if (err) {
              console.error('❌ Error closing database:', err);
            } else {
              console.log('\n✅ Database connection closed');
              console.log('🎉 Indexing process complete! Your searches should now be much faster.');
            }
          });
        });
      });
      return;
    }
    
    const idx = indexes[index];
    const progress = ((index + 1) / indexes.length * 100).toFixed(0);
    
    console.log(`[${index + 1}/${indexes.length}] (${progress}%) Creating ${idx.name}...`);
    console.log(`  📝 ${idx.description}`);
    
    const indexStart = Date.now();
    
    db.run(idx.sql, (err) => {
      const indexDuration = ((Date.now() - indexStart) / 1000).toFixed(1);
      
      if (err) {
        console.error(`  ❌ Failed (${indexDuration}s):`, err.message);
        failed++;
      } else {
        console.log(`  ✅ Created successfully (${indexDuration}s)`);
        completed++;
      }
      
      console.log('');
      
      // Small delay before next index to avoid overwhelming the system
      setTimeout(() => {
        createNextIndex(index + 1);
      }, 100);
    });
  }
  
  // Check current database size
  db.get("SELECT COUNT(*) as count FROM games", (err, row) => {
    if (err) {
      console.error('❌ Error checking database size:', err);
    } else {
      console.log(`📈 Database contains ${row.count.toLocaleString()} games\n`);
    }
    
    // Start creating indexes
    createNextIndex(0);
  });
});