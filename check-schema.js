const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'otb-database', 'complete-tournaments.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  
  console.log('Database schema:\n');
  
  // Get all tables
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('Error getting tables:', err);
      return;
    }
    
    console.log('Tables found:', tables.map(t => t.name).join(', '));
    console.log('\nColumns in games table:');
    
    // Get columns for games table
    db.all("PRAGMA table_info(games)", (err, columns) => {
      if (err) {
        console.error('Error getting columns:', err);
        return;
      }
      
      columns.forEach(col => {
        console.log(`  ${col.cid}. ${col.name} (${col.type})${col.pk ? ' PRIMARY KEY' : ''}${col.notnull ? ' NOT NULL' : ''}`);
      });
      
      db.close();
    });
  });
});