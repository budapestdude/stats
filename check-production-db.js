const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database('chess-production.db', sqlite3.OPEN_READONLY);

console.log('\n📊 PRODUCTION DATABASE STATUS\n');
console.log('='.repeat(50));

db.serialize(() => {
  // Check what tables exist
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.log('Error getting tables:', err);
      return;
    }
    console.log('📁 Tables found:');
    if (tables && tables.length > 0) {
      tables.forEach(table => {
        console.log(`   - ${table.name}`);
      });
    } else {
      console.log('   No tables found!');
    }
    console.log();

    // Check counts in each major table
    db.get('SELECT COUNT(*) as count FROM players', (err, row) => {
      console.log(`👥 Players: ${(row?.count || 0).toLocaleString()}`);
    });

    db.get('SELECT COUNT(*) as count FROM tournaments', (err, row) => {
      console.log(`🏆 Tournaments: ${(row?.count || 0).toLocaleString()}`);
    });

    db.get('SELECT COUNT(*) as count FROM games', (err, row) => {
      console.log(`♟️  Games: ${(row?.count || 0).toLocaleString()}`);
    });

    // Show a sample tournament
    db.get('SELECT * FROM tournaments LIMIT 1', (err, tournament) => {
      if (tournament) {
        console.log('\n📋 Sample Tournament:');
        console.log(`   Name: ${tournament.name}`);
        console.log(`   Location: ${tournament.location}`);
        console.log(`   Date: ${tournament.date}`);
      }
    });

    // Show a sample player
    db.get('SELECT * FROM players LIMIT 1', (err, player) => {
      if (player) {
        console.log('\n👤 Sample Player:');
        console.log(`   Name: ${player.name}`);
        console.log(`   Rating: ${player.peak_rating}`);
        console.log(`   Games: ${player.total_games}`);
      }
    });

    setTimeout(() => db.close(), 1000);
  });
});