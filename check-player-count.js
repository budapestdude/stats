const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'otb-database', 'complete-tournaments.db');

console.log('📊 Checking player statistics in database...\n');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  
  console.log('✅ Connected to database\n');
  
  // Count unique players
  const query = `
    SELECT 
      COUNT(DISTINCT player_name) as unique_players,
      COUNT(*) as total_occurrences
    FROM (
      SELECT white_player as player_name FROM games
      UNION ALL
      SELECT black_player as player_name FROM games
    )
  `;
  
  console.log('🔍 Counting unique players...');
  const startTime = Date.now();
  
  db.get(query, (err, row) => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (err) {
      console.error('❌ Error counting players:', err);
    } else {
      console.log('\n📈 Player Statistics:');
      console.log('─'.repeat(40));
      console.log(`🎯 Unique players: ${row.unique_players.toLocaleString()}`);
      console.log(`📊 Total player records: ${row.total_occurrences.toLocaleString()}`);
      console.log(`⏱️  Query time: ${duration} seconds`);
      console.log('─'.repeat(40));
      
      // Check total games
      db.get("SELECT COUNT(*) as count FROM games", (err, gameRow) => {
        if (!err) {
          console.log(`🎮 Total games: ${gameRow.count.toLocaleString()}`);
          const avgGamesPerPlayer = (gameRow.count * 2 / row.unique_players).toFixed(1);
          console.log(`📊 Avg games per player: ${avgGamesPerPlayer}`);
        }
        
        // Check if indexes exist
        db.all("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='games'", (err, indexes) => {
          if (!err) {
            console.log(`\n🔧 Indexes on games table: ${indexes.length}`);
            indexes.forEach(idx => {
              console.log(`  ✓ ${idx.name}`);
            });
          }
          
          db.close();
        });
      });
    }
  });
});