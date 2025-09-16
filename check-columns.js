const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'otb-database', 'complete-tournaments.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  
  console.log('Connected to database');
  
  // Get table columns
  db.all("PRAGMA table_info(games)", [], (err, rows) => {
    if (err) {
      console.error('Error getting table info:', err);
    } else {
      console.log('Games table columns:');
      rows.forEach(row => {
        console.log(`  ${row.name} (${row.type})`);
      });
    }
    
    // Test a simple query
    db.get("SELECT * FROM games LIMIT 1", [], (err, row) => {
      if (err) {
        console.error('Error getting sample row:', err);
      } else {
        console.log('\nSample row keys:', Object.keys(row));
      }
      db.close();
    });
  });
});