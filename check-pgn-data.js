const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('otb-database/complete-tournaments.db', sqlite3.OPEN_READONLY);

console.log('Checking if games have PGN data...\n');

// Check pgn_file column
db.all(`
  SELECT id, white_player, black_player, result, date, eco, opening, pgn_file
  FROM games
  WHERE white_player LIKE '%Carlsen, Magnus%'
  LIMIT 5
`, (err, rows) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }

  console.log('Sample games:');
  rows.forEach(row => {
    console.log(`\nID: ${row.id}`);
    console.log(`Players: ${row.white_player} vs ${row.black_player}`);
    console.log(`Result: ${row.result}`);
    console.log(`Date: ${row.date}`);
    console.log(`ECO: ${row.eco}`);
    console.log(`Opening: ${row.opening || 'N/A'}`);
    console.log(`PGN File: ${row.pgn_file || 'N/A'}`);
  });

  // Check if any games have pgn_file
  db.get(`SELECT COUNT(*) as total, COUNT(pgn_file) as with_pgn FROM games`, (err, row) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log(`\n\nTotal games: ${row.total}`);
      console.log(`Games with pgn_file: ${row.with_pgn}`);
      console.log(`Percentage: ${((row.with_pgn / row.total) * 100).toFixed(2)}%`);
    }
    db.close();
  });
});
