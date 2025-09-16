const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const db = new sqlite3.Database(
  path.join(__dirname, 'otb-database', 'chess-stats.db'),
  sqlite3.OPEN_READONLY
);

console.log('\n📊 CHECKING IMPORT STATUS...\n');
console.log('='.repeat(60));

// Check checkpoint file
const checkpointFile = path.join(__dirname, 'import-checkpoint.json');
if (fs.existsSync(checkpointFile)) {
  const checkpoint = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
  console.log('📌 Current Checkpoint:');
  console.log(`   Players: File ${checkpoint.lastCheckpoint.playerFile}/212`);
  console.log(`   Events: File ${checkpoint.lastCheckpoint.eventFile}/212`);
  console.log(`   Games: File ${checkpoint.lastCheckpoint.gameFile}/212`);
  console.log('='.repeat(60));
}

db.serialize(() => {
  // Players
  db.get('SELECT COUNT(*) as count FROM player_index', (err, row) => {
    console.log(`👥 Players indexed: ${(row?.count || 0).toLocaleString()}`);
    
    db.get('SELECT COUNT(*) as count FROM player_index WHERE peak_rating IS NOT NULL', (err, row) => {
      console.log(`   - With ratings: ${(row?.count || 0).toLocaleString()}`);
    });
  });

  // Tournaments
  db.get('SELECT COUNT(*) as count FROM tournament_archive', (err, row) => {
    console.log(`\n🏆 Tournaments: ${(row?.count || 0).toLocaleString()}`);
    
    db.get('SELECT MIN(start_date) as min, MAX(end_date) as max FROM tournament_archive', (err, row) => {
      if (row?.min && row?.max) {
        console.log(`   - Date range: ${row.min} to ${row.max}`);
      }
    });
  });

  // Games
  db.get('SELECT COUNT(*) as count FROM game_archive', (err, row) => {
    console.log(`\n♟️  Games: ${(row?.count || 0).toLocaleString()}`);
    
    if (row?.count > 0) {
      db.get('SELECT COUNT(DISTINCT white_player) + COUNT(DISTINCT black_player) as players FROM game_archive LIMIT 10000', (err, row) => {
        console.log(`   - Unique players in games: ${(row?.players || 0).toLocaleString()}`);
      });
      
      db.get('SELECT COUNT(DISTINCT eco) as openings FROM game_archive WHERE eco IS NOT NULL', (err, row) => {
        console.log(`   - Unique ECO codes: ${(row?.openings || 0).toLocaleString()}`);
      });
    }
  });

  // Opening stats
  db.get('SELECT COUNT(*) as count FROM opening_stats', (err, row) => {
    console.log(`\n📖 Opening variations: ${(row?.count || 0).toLocaleString()}`);
  });

  // Top rated players
  db.all('SELECT name, title, peak_rating FROM player_index WHERE peak_rating IS NOT NULL ORDER BY peak_rating DESC LIMIT 10', (err, players) => {
    if (players && players.length > 0) {
      console.log('\n🏅 Top 10 Rated Players:');
      players.forEach((p, i) => {
        const title = p.title ? `${p.title} ` : '';
        console.log(`   ${i + 1}. ${title}${p.name}: ${p.peak_rating}`);
      });
    }
  });

  // Database size
  setTimeout(() => {
    const stats = fs.statSync(path.join(__dirname, 'otb-database', 'chess-stats.db'));
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`\n💾 Database size: ${sizeMB} MB`);
    console.log('='.repeat(60));
    
    db.close();
  }, 1000);
});