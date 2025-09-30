const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chess-stats.db');

db.all(`
  SELECT tournament_name, games_count, player_count 
  FROM tournament_data 
  ORDER BY games_count DESC 
  LIMIT 20
`, (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('\nTop 20 tournaments in database:');
    console.log('=' .repeat(80));
    rows.forEach((row, i) => {
      console.log(`${i+1}. ${row.tournament_name}`);
      console.log(`   Games: ${row.games_count}, Players: ${row.player_count}`);
    });
  }
  db.close();
});