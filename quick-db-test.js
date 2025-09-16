const sqlite3 = require('sqlite3').verbose();

// Quick database test with immediate close
const db = new sqlite3.Database('chess-production.db', sqlite3.OPEN_READONLY);

console.log('🔍 QUICK DATABASE TEST\n');

// Test games table first
db.get('SELECT COUNT(*) as count FROM games LIMIT 1', (err, row) => {
  if (err) {
    console.log('❌ Games table error:', err.message);
  } else {
    console.log('✅ Games count:', (row?.count || 0).toLocaleString());
  }
  
  // Test sample game
  db.get('SELECT * FROM games LIMIT 1', (err, game) => {
    if (err) {
      console.log('❌ Sample game error:', err.message);
    } else if (game) {
      console.log('✅ Sample game found:', Object.keys(game).join(', '));
    } else {
      console.log('❌ No games in table');
    }
    
    db.close((err) => {
      if (err) console.log('Close error:', err.message);
      console.log('🔚 Database closed');
      process.exit(0);
    });
  });
});