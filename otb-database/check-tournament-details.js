const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chess-stats.db');

// Check a specific tournament
const tournamentName = "World Blitz 2022";

db.get(`
  SELECT * FROM tournament_data 
  WHERE tournament_name = ?
`, [tournamentName], (err, row) => {
  if (err) {
    console.error('Error:', err);
  } else if (row) {
    console.log(`\nTournament: ${row.tournament_name}`);
    console.log(`Games: ${row.games_count}`);
    console.log(`Players: ${row.player_count}`);
    console.log(`Location: ${row.location}`);
    console.log(`Dates: ${row.start_date} to ${row.end_date}`);
    
    if (row.data) {
      const data = JSON.parse(row.data);
      console.log('\nPlayer standings:');
      console.log('================');
      if (data.players && data.players.length > 0) {
        data.players.slice(0, 10).forEach((p, i) => {
          console.log(`${i+1}. ${p.name}: ${p.score}/${p.games} (W:${p.wins} D:${p.draws} L:${p.losses})`);
        });
      } else {
        console.log('No player data found!');
      }
      
      console.log('\nStats:', data.stats);
    }
  } else {
    console.log('Tournament not found');
  }
  db.close();
});