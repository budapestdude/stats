const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./complete-tournaments.db');

console.log('\n===========================================');
console.log('CHECKING INDEX DATABASE STATUS');
console.log('===========================================\n');

// Check total games and tournaments
db.get(`
  SELECT 
    COUNT(*) as total_games,
    COUNT(DISTINCT tournament_name) as total_tournaments
  FROM games
`, (err, stats) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log(`Games indexed: ${stats.total_games.toLocaleString()}`);
    console.log(`Unique tournaments: ${stats.total_tournaments.toLocaleString()}`);
    
    // Check tournament size distribution
    db.all(`
      SELECT 
        tournament_name,
        total_games,
        files_found_in
      FROM tournament_index
      WHERE total_games >= 100
      ORDER BY total_games DESC
      LIMIT 20
    `, (err2, large) => {
      if (!err2 && large) {
        console.log('\nLargest tournaments (100+ games):');
        console.log('----------------------------------');
        large.forEach(t => {
          console.log(`${t.total_games.toString().padStart(5)} games | ${t.tournament_name.substring(0, 50)}`);
        });
        
        // Count tournaments by size
        db.all(`
          SELECT 
            CASE 
              WHEN total_games < 10 THEN '< 10'
              WHEN total_games < 50 THEN '10-49'
              WHEN total_games < 100 THEN '50-99'
              WHEN total_games < 500 THEN '100-499'
              WHEN total_games < 1000 THEN '500-999'
              ELSE '1000+'
            END as range,
            COUNT(*) as count
          FROM tournament_index
          GROUP BY range
          ORDER BY MIN(total_games)
        `, (err3, dist) => {
          if (!err3 && dist) {
            console.log('\nTournament size distribution:');
            console.log('-----------------------------');
            dist.forEach(d => {
              console.log(`${d.range.padEnd(10)} games: ${d.count.toLocaleString()} tournaments`);
            });
          }
          db.close();
        });
      }
    });
  }
});