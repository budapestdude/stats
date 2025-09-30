const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chess-stats.db');

console.log('\n===========================================');
console.log('ANALYZING TOURNAMENT GAME COUNTS');
console.log('===========================================\n');

// First, let's see the distribution of game counts
db.all(`
  SELECT 
    CASE 
      WHEN games_count < 10 THEN '< 10'
      WHEN games_count < 50 THEN '10-49'
      WHEN games_count < 100 THEN '50-99'
      WHEN games_count < 200 THEN '100-199'
      WHEN games_count < 500 THEN '200-499'
      ELSE '500+'
    END as range,
    COUNT(*) as count,
    SUM(games_count) as total_games
  FROM tournament_data
  GROUP BY range
  ORDER BY MIN(games_count)
`, (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Game Count Distribution:');
    console.log('------------------------');
    rows.forEach(row => {
      console.log(`${row.range.padEnd(10)} | ${row.count.toString().padStart(6)} tournaments | ${(row.total_games || 0).toString().padStart(8)} total games`);
    });
    
    // Now let's check what the actual sum of games_count is
    db.get(`
      SELECT 
        COUNT(*) as total_tournaments,
        SUM(games_count) as total_games,
        AVG(games_count) as avg_games_per_tournament,
        MAX(games_count) as max_games,
        MIN(games_count) as min_games
      FROM tournament_data
    `, (err2, stats) => {
      if (!err2 && stats) {
        console.log('\n\nOverall Statistics:');
        console.log('-------------------');
        console.log(`Total tournaments: ${stats.total_tournaments}`);
        console.log(`Total games (sum of games_count): ${stats.total_games}`);
        console.log(`Average games per tournament: ${Math.round(stats.avg_games_per_tournament)}`);
        console.log(`Max games in a tournament: ${stats.max_games}`);
        console.log(`Min games in a tournament: ${stats.min_games}`);
        
        console.log('\n\nSample of small tournaments (<10 games):');
        console.log('------------------------------------------');
        db.all(`
          SELECT tournament_name, games_count, player_count
          FROM tournament_data
          WHERE games_count < 10
          LIMIT 20
        `, (err3, small) => {
          if (!err3 && small && small.length > 0) {
            small.forEach(t => {
              console.log(`${t.games_count} games | ${t.player_count} players | ${t.tournament_name}`);
            });
          } else {
            console.log('No tournaments with < 10 games found.');
          }
          
          db.close();
        });
      }
    });
  }
});