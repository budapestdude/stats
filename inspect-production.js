const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔍 INSPECTING PRODUCTION DATABASE\n');

const db = new sqlite3.Database('chess-production.db', sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
});

db.serialize(() => {
  // List all tables
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('Error listing tables:', err);
      return;
    }
    
    console.log('📁 TABLES FOUND:');
    tables.forEach(table => console.log(`   - ${table.name}`));
    console.log();

    // Check each main table
    const tablesToCheck = ['players', 'tournaments', 'games', 'openings'];
    
    tablesToCheck.forEach((tableName, index) => {
      setTimeout(() => {
        db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
          if (err) {
            console.log(`❌ ${tableName}: Error - ${err.message}`);
          } else {
            console.log(`📊 ${tableName}: ${(row.count || 0).toLocaleString()} records`);
          }
          
          // Show schema for this table
          db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
            if (err) {
              console.log(`   Schema error: ${err.message}`);
            } else if (columns) {
              console.log(`   Columns: ${columns.map(c => c.name).join(', ')}`);
            }
            console.log();
            
            if (index === tablesToCheck.length - 1) {
              // Show sample data from tournaments
              db.get('SELECT * FROM tournaments LIMIT 1', (err, sample) => {
                if (!err && sample) {
                  console.log('📋 SAMPLE TOURNAMENT:');
                  Object.entries(sample).forEach(([key, value]) => {
                    console.log(`   ${key}: ${value}`);
                  });
                }
                
                // Check if games table has any records at all
                db.get('SELECT * FROM games LIMIT 1', (err, gameSample) => {
                  console.log('\n🎯 GAMES TABLE STATUS:');
                  if (err) {
                    console.log(`   Error: ${err.message}`);
                  } else if (gameSample) {
                    console.log('   ✅ Has data - sample record:');
                    Object.entries(gameSample).forEach(([key, value]) => {
                      console.log(`   ${key}: ${value}`);
                    });
                  } else {
                    console.log('   ❌ No games found - table is empty');
                  }
                  
                  db.close();
                });
              });
            }
          });
        });
      }, index * 100);
    });
  });
});