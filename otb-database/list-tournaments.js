const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'chess-stats.db');

if (!fs.existsSync(dbPath)) {
  console.log('Database not found!');
  process.exit(1);
}

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

console.log('Fetching notable tournaments from database...\n');

// Get top tournaments by game count
db.all(`
  SELECT name, games_count 
  FROM events 
  WHERE games_count > 50
  ORDER BY games_count DESC 
  LIMIT 100
`, (err, rows) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }
  
  console.log('Top Tournaments by Game Count:');
  console.log('================================');
  
  rows.forEach((row, i) => {
    console.log(`${i + 1}. ${row.name} - ${row.games_count} games`);
  });
  
  // Also search for specific tournament types
  console.log('\n\nSearching for World Championships...');
  console.log('====================================');
  
  db.all(`
    SELECT name, games_count 
    FROM events 
    WHERE name LIKE '%World%' OR name LIKE '%Champion%'
    ORDER BY games_count DESC 
    LIMIT 20
  `, (err, worldRows) => {
    if (!err && worldRows) {
      worldRows.forEach(row => {
        console.log(`- ${row.name} (${row.games_count} games)`);
      });
    }
    
    console.log('\n\nSearching for Olympiads...');
    console.log('==========================');
    
    db.all(`
      SELECT name, games_count 
      FROM events 
      WHERE name LIKE '%Olympiad%'
      ORDER BY games_count DESC 
      LIMIT 20
    `, (err, olympiadRows) => {
      if (!err && olympiadRows) {
        olympiadRows.forEach(row => {
          console.log(`- ${row.name} (${row.games_count} games)`);
        });
      }
      
      console.log('\n\nSearching for Major Tournament Series...');
      console.log('=========================================');
      
      const series = ['Tata Steel', 'Linares', 'Dortmund', 'Gibraltar', 'Sinquefield'];
      series.forEach(name => {
        db.get(`
          SELECT COUNT(*) as count, SUM(games_count) as total 
          FROM events 
          WHERE name LIKE '%${name}%'
        `, (err, row) => {
          if (!err && row && row.count > 0) {
            console.log(`${name}: ${row.count} tournaments, ${row.total} total games`);
          }
        });
      });
      
      setTimeout(() => {
        db.close();
      }, 2000);
    });
  });
});