const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔄 Importing tournament data with games into archive...\n');

const db = new sqlite3.Database(
  path.join(__dirname, 'otb-database', 'chess-stats.db'),
  sqlite3.OPEN_READWRITE,
  (err) => {
    if (err) {
      console.error('❌ Error opening database:', err);
      process.exit(1);
    }
    console.log('✅ Connected to database');
  }
);

async function importTournamentData() {
  // Get all tournament data
  db.all('SELECT * FROM tournament_data', (err, tournaments) => {
    if (err) {
      console.error('Error fetching tournament data:', err);
      return;
    }

    console.log(`📋 Found ${tournaments.length} tournaments with detailed data\n`);

    let totalGames = 0;
    let totalPlayers = 0;
    let processedTournaments = 0;

    tournaments.forEach((tournament, index) => {
      try {
        const data = JSON.parse(tournament.data);
        
        // Insert or update tournament in archive
        db.run(`
          INSERT OR REPLACE INTO tournament_archive 
          (name, location, start_date, end_date, number_of_games, number_of_players, number_of_rounds)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          tournament.tournament_name,
          tournament.location || data.location || 'Unknown',
          tournament.start_date || data.start_date,
          tournament.end_date || data.end_date || tournament.start_date,
          tournament.games_count || data.games_count,
          tournament.player_count || data.player_count,
          data.rounds || Math.ceil(Math.log2(tournament.player_count || 8))
        ], function(err) {
          if (err) {
            console.error(`Error inserting tournament ${tournament.tournament_name}:`, err);
            return;
          }

          const tournamentId = this.lastID;

          // Import standings if available
          if (data.players && Array.isArray(data.players)) {
            const stmtStandings = db.prepare(`
              INSERT OR IGNORE INTO tournament_standings 
              (tournament_id, rank, player_name, points, games_played, wins, draws, losses)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            data.players.forEach((player, rank) => {
              stmtStandings.run(
                tournamentId,
                rank + 1,
                player.name,
                player.score || player.points || 0,
                player.games || 0,
                player.wins || 0,
                player.draws || 0,
                player.losses || 0
              );
              totalPlayers++;
            });

            stmtStandings.finalize();
          }

          // Import games if available
          if (data.games && Array.isArray(data.games)) {
            const stmtGames = db.prepare(`
              INSERT OR IGNORE INTO game_archive 
              (tournament_id, round, board, white_player, black_player, result, eco, opening, date_played)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            data.games.forEach((game) => {
              stmtGames.run(
                tournamentId,
                game.round || 1,
                game.board || 1,
                game.white || game.white_player || 'Unknown',
                game.black || game.black_player || 'Unknown',
                game.result || '*',
                game.eco || null,
                game.opening || null,
                tournament.start_date
              );
              totalGames++;
            });

            stmtGames.finalize();
          }

          // Import crosstable data if available
          if (data.crosstable && Array.isArray(data.crosstable)) {
            const stmtCross = db.prepare(`
              INSERT OR IGNORE INTO game_archive 
              (tournament_id, white_player, black_player, result, date_played)
              VALUES (?, ?, ?, ?, ?)
            `);

            data.crosstable.forEach((entry) => {
              if (entry.opponents) {
                Object.entries(entry.opponents).forEach(([opponent, result]) => {
                  if (result && result !== '-') {
                    stmtCross.run(
                      tournamentId,
                      entry.player,
                      opponent,
                      result,
                      tournament.start_date
                    );
                    totalGames++;
                  }
                });
              }
            });

            stmtCross.finalize();
          }

          processedTournaments++;
          
          if (processedTournaments % 100 === 0) {
            console.log(`  Processed ${processedTournaments}/${tournaments.length} tournaments...`);
          }
        });

      } catch (error) {
        console.error(`Error processing tournament ${tournament.tournament_name}:`, error.message);
      }
    });

    // Wait a bit for all async operations to complete
    setTimeout(() => {
      // Get final statistics
      db.get('SELECT COUNT(*) as count FROM tournament_archive', (err, row) => {
        const tournamentCount = row?.count || 0;
        
        db.get('SELECT COUNT(*) as count FROM game_archive', (err, row) => {
          const gameCount = row?.count || 0;
          
          db.get('SELECT COUNT(*) as count FROM tournament_standings', (err, row) => {
            const standingsCount = row?.count || 0;
            
            db.get('SELECT COUNT(*) as count FROM player_index', (err, row) => {
              const playerCount = row?.count || 0;
              
              console.log('\n✨ Import Complete!');
              console.log('=====================================');
              console.log(`📋 Total Tournaments: ${tournamentCount.toLocaleString()}`);
              console.log(`♟️  Total Games: ${gameCount.toLocaleString()}`);
              console.log(`📊 Total Standings Entries: ${standingsCount.toLocaleString()}`);
              console.log(`👥 Total Players: ${playerCount.toLocaleString()}`);
              console.log('=====================================\n');
              
              console.log('📈 This import added:');
              console.log(`   ${processedTournaments} tournaments processed`);
              console.log(`   ~${totalGames} games imported`);
              console.log(`   ~${totalPlayers} player standings recorded\n`);
              
              console.log('🚀 View your tournament archive at:');
              console.log('   http://localhost:3002/tournament-archive\n');
              
              // Update player statistics
              updatePlayerStats();
            });
          });
        });
      });
    }, 3000);
  });
}

function updatePlayerStats() {
  console.log('📊 Updating player statistics...');
  
  db.run(`
    UPDATE player_index 
    SET 
      total_games = (
        SELECT COUNT(*) FROM game_archive 
        WHERE white_player = player_index.name OR black_player = player_index.name
      ),
      tournaments_count = (
        SELECT COUNT(DISTINCT tournament_id) FROM tournament_standings 
        WHERE player_name = player_index.name
      )
    WHERE name IN (
      SELECT DISTINCT player_name FROM tournament_standings
    )
  `, (err) => {
    if (err) {
      console.error('Error updating player stats:', err);
    } else {
      console.log('✅ Player statistics updated');
    }
    db.close();
  });
}

// Start import
importTournamentData();