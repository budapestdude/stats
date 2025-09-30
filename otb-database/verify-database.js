const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'chess-stats.db');
const db = new sqlite3.Database(dbPath);

console.log('Database Verification Report');
console.log('============================\n');

db.serialize(() => {
  // Count total games
  db.get('SELECT COUNT(*) as total FROM games', (err, row) => {
    if (err) {
      console.error('Error counting games:', err);
    } else {
      console.log(`Total games in database: ${row.total.toLocaleString()}`);
    }
  });
  
  // Top events
  db.all('SELECT event, COUNT(*) as count FROM games GROUP BY event ORDER BY count DESC LIMIT 10', (err, rows) => {
    if (!err && rows) {
      console.log('\nTop 10 Events:');
      rows.forEach((r, i) => {
        console.log(`  ${i+1}. ${r.event}: ${r.count} games`);
      });
    }
  });
  
  // Top players
  db.all(`
    SELECT player, COUNT(*) as games_played 
    FROM (
      SELECT white as player FROM games 
      UNION ALL 
      SELECT black as player FROM games
    ) 
    GROUP BY player 
    ORDER BY games_played DESC 
    LIMIT 10
  `, (err, rows) => {
    if (!err && rows) {
      console.log('\nTop 10 Players by Games:');
      rows.forEach((r, i) => {
        console.log(`  ${i+1}. ${r.player}: ${r.games_played} games`);
      });
    }
  });
  
  // Date range
  db.get('SELECT MIN(date) as earliest, MAX(date) as latest FROM games WHERE date IS NOT NULL', (err, row) => {
    if (!err && row) {
      console.log('\nDate Range:');
      console.log(`  Earliest: ${row.earliest || 'N/A'}`);
      console.log(`  Latest: ${row.latest || 'N/A'}`);
    }
  });
  
  // Games with moves vs without
  db.get('SELECT COUNT(*) as with_moves FROM games WHERE moves IS NOT NULL AND moves != ""', (err, row) => {
    if (!err && row) {
      console.log('\nGames with moves:', row.with_moves.toLocaleString());
    }
    db.close();
  });
});