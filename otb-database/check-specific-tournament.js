const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chess-stats.db');

// Check if "eycc girls u18" exists in database
const tournamentName = "eycc girls u18";

console.log(`\nSearching for tournament: "${tournamentName}"\n`);

// First check tournament_data table
db.get(`
  SELECT * FROM tournament_data 
  WHERE LOWER(tournament_name) = LOWER(?)
`, [tournamentName], (err, row) => {
  if (err) {
    console.error('Error querying tournament_data:', err);
  } else if (row) {
    console.log('✅ Found in tournament_data table!');
    console.log(`Tournament: ${row.tournament_name}`);
    console.log(`Games: ${row.games_count}`);
    console.log(`Players: ${row.player_count}`);
  } else {
    console.log('❌ Not found in tournament_data table');
  }
  
  // Also check events table
  db.get(`
    SELECT * FROM events 
    WHERE LOWER(name) = LOWER(?)
  `, [tournamentName], (err2, row2) => {
    if (err2) {
      console.error('Error querying events:', err2);
    } else if (row2) {
      console.log('\n✅ Found in events table!');
      console.log(`Name: ${row2.name}`);
      console.log(`Games count: ${row2.games_count}`);
    } else {
      console.log('❌ Not found in events table');
    }
    
    // Search for similar tournament names
    console.log('\nSearching for similar tournament names...');
    db.all(`
      SELECT tournament_name, games_count 
      FROM tournament_data 
      WHERE LOWER(tournament_name) LIKE '%eycc%' OR LOWER(tournament_name) LIKE '%girls%' OR LOWER(tournament_name) LIKE '%u18%'
      LIMIT 10
    `, (err3, rows) => {
      if (!err3 && rows && rows.length > 0) {
        console.log('\nSimilar tournaments found:');
        rows.forEach(r => {
          console.log(`- ${r.tournament_name} (${r.games_count} games)`);
        });
      } else {
        console.log('No similar tournaments found');
      }
      
      db.close();
    });
  });
});