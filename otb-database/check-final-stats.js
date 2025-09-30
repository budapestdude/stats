const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chess-stats.db');

console.log('\n===========================================');
console.log('FINAL DATABASE STATISTICS');
console.log('===========================================\n');

// Get total counts
db.get(`
  SELECT 
    COUNT(*) as total_tournaments,
    SUM(games_count) as total_games,
    MIN(start_date) as earliest_date,
    MAX(start_date) as latest_date
  FROM tournament_data
`, (err, stats) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log(`Total Tournaments Indexed: ${stats.total_tournaments.toLocaleString()}`);
    console.log(`Total Games Processed: ${stats.total_games ? stats.total_games.toLocaleString() : 'N/A'}`);
    console.log(`Date Range: ${stats.earliest_date || 'N/A'} to ${stats.latest_date || 'N/A'}`);
    
    // Get largest tournaments
    console.log('\n--- Top 20 Largest Tournaments ---');
    db.all(`
      SELECT tournament_name, games_count, player_count 
      FROM tournament_data 
      ORDER BY games_count DESC 
      LIMIT 20
    `, (err2, rows) => {
      if (!err2 && rows) {
        rows.forEach((row, i) => {
          console.log(`${(i+1).toString().padStart(2)}. ${row.tournament_name.substring(0, 50).padEnd(50)} | ${row.games_count.toString().padStart(4)} games | ${row.player_count} players`);
        });
      }
      
      // Get tournament count by year
      console.log('\n--- Tournaments by Year ---');
      db.all(`
        SELECT 
          SUBSTR(start_date, 1, 4) as year,
          COUNT(*) as count
        FROM tournament_data
        WHERE start_date IS NOT NULL AND start_date != ''
        GROUP BY SUBSTR(start_date, 1, 4)
        ORDER BY year DESC
        LIMIT 20
      `, (err3, years) => {
        if (!err3 && years) {
          years.forEach(y => {
            if (y.year && y.year.match(/^\d{4}$/)) {
              console.log(`${y.year}: ${y.count.toLocaleString()} tournaments`);
            }
          });
        }
        
        db.close();
        console.log('\n===========================================\n');
      });
    });
  }
});