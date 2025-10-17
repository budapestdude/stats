const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('otb-database/chess-stats.db', sqlite3.OPEN_READONLY);

console.log('Checking chess-stats.db schema and sample data...\n');

// Get schema
db.all("SELECT sql FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }

  console.log('Tables and schemas:');
  tables.forEach(table => {
    console.log('\n' + table.sql);
  });

  // Check if there's a games table with moves
  db.get("SELECT COUNT(*) as count FROM games", (err, row) => {
    if (err) {
      console.log('\nNo games table or error:', err.message);
      db.close();
      return;
    }

    console.log(`\n\nTotal games in chess-stats.db: ${row.count}`);

    // Get a sample game
    db.get("SELECT * FROM games LIMIT 1", (err, game) => {
      if (err) {
        console.error('Error:', err);
      } else if (game) {
        console.log('\nSample game:');
        console.log(JSON.stringify(game, null, 2));
      }
      db.close();
    });
  });
});
