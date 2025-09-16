const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔄 Indexing all players from tournament data...\n');

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

async function indexAllPlayers() {
  // First, clear and recreate player_index with better structure
  db.serialize(() => {
    console.log('📊 Creating comprehensive player index...\n');

    // Get all unique players from standings
    db.all(`
      SELECT 
        player_name,
        player_title,
        player_federation,
        MAX(player_rating) as peak_rating,
        player_fide_id,
        COUNT(*) as tournaments_played,
        SUM(games_played) as total_games,
        SUM(wins) as total_wins,
        SUM(draws) as total_draws,
        SUM(losses) as total_losses,
        SUM(points) as total_points,
        AVG(performance_rating) as avg_performance,
        MIN(tournament_id) as first_tournament,
        MAX(tournament_id) as last_tournament
      FROM tournament_standings
      WHERE player_name IS NOT NULL AND player_name != ''
      GROUP BY player_name
    `, (err, players) => {
      if (err) {
        console.error('Error fetching players:', err);
        return;
      }

      console.log(`Found ${players.length} unique players from tournament standings\n`);

      // Clear existing player_index
      db.run('DELETE FROM player_index', (err) => {
        if (err) console.error('Error clearing player_index:', err);

        // Insert all players
        const stmt = db.prepare(`
          INSERT INTO player_index 
          (name, fide_id, peak_rating, current_rating, title, federation, 
           total_games, tournaments_count, first_game_date, last_game_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let inserted = 0;
        players.forEach((player) => {
          stmt.run(
            player.player_name,
            player.player_fide_id,
            player.peak_rating,
            player.peak_rating, // Use peak as current for now
            player.player_title,
            player.player_federation,
            player.total_games || 0,
            player.tournaments_played || 0,
            null, // Will update with actual dates later
            null
          );
          inserted++;
          
          if (inserted % 1000 === 0) {
            console.log(`  Indexed ${inserted}/${players.length} players...`);
          }
        });

        stmt.finalize(() => {
          console.log(`\n✅ Indexed ${inserted} players`);

          // Now also check tournament_data for more players
          checkTournamentDataForPlayers();
        });
      });
    });
  });
}

function checkTournamentDataForPlayers() {
  console.log('\n🔍 Checking tournament_data for additional players...\n');

  db.all('SELECT data FROM tournament_data LIMIT 1000', (err, tournaments) => {
    if (err) {
      console.error('Error fetching tournament data:', err);
      finalizeIndexing();
      return;
    }

    const allPlayers = new Map();
    let processedTournaments = 0;

    tournaments.forEach(tournament => {
      try {
        const data = JSON.parse(tournament.data);
        
        // Extract players from various data structures
        if (data.players && Array.isArray(data.players)) {
          data.players.forEach(player => {
            const name = player.name || player.player_name;
            if (name && !allPlayers.has(name)) {
              allPlayers.set(name, {
                name: name,
                rating: player.rating || player.elo || null,
                title: player.title || null,
                federation: player.fed || player.federation || null,
                games: player.games || 0,
                wins: player.wins || 0,
                draws: player.draws || 0,
                losses: player.losses || 0
              });
            }
          });
        }

        // Check crosstable data
        if (data.crosstable && Array.isArray(data.crosstable)) {
          data.crosstable.forEach(entry => {
            const name = entry.player || entry.name;
            if (name && !allPlayers.has(name)) {
              allPlayers.set(name, {
                name: name,
                rating: entry.rating || null,
                title: entry.title || null
              });
            }
          });
        }

        // Check games data
        if (data.games && Array.isArray(data.games)) {
          data.games.forEach(game => {
            ['white', 'black', 'white_player', 'black_player'].forEach(field => {
              if (game[field] && !allPlayers.has(game[field])) {
                allPlayers.set(game[field], {
                  name: game[field],
                  rating: game[field + '_rating'] || null
                });
              }
            });
          });
        }

        processedTournaments++;
      } catch (e) {
        // Skip invalid JSON
      }
    });

    console.log(`Found ${allPlayers.size} additional unique players from ${processedTournaments} tournaments`);

    // Insert new players not already in index
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO player_index (name, peak_rating, title, federation)
      VALUES (?, ?, ?, ?)
    `);

    let added = 0;
    allPlayers.forEach(player => {
      stmt.run(player.name, player.rating, player.title, player.federation);
      added++;
    });

    stmt.finalize(() => {
      console.log(`Added ${added} new players to index`);
      finalizeIndexing();
    });
  });
}

function finalizeIndexing() {
  // Update tournament and game counts for all players
  console.log('\n📈 Updating player statistics...\n');

  // Create additional indexes for better performance
  db.serialize(() => {
    db.run('CREATE INDEX IF NOT EXISTS idx_standings_player_name ON tournament_standings(player_name)');
    db.run('CREATE INDEX IF NOT EXISTS idx_player_index_name ON player_index(name)');
    db.run('CREATE INDEX IF NOT EXISTS idx_player_index_rating ON player_index(peak_rating DESC)');
    db.run('CREATE INDEX IF NOT EXISTS idx_player_index_federation ON player_index(federation)');

    // Get final count
    db.get('SELECT COUNT(*) as total FROM player_index', (err, row) => {
      const totalPlayers = row?.total || 0;

      // Get top rated players
      db.all(`
        SELECT name, title, federation, peak_rating, tournaments_count
        FROM player_index
        WHERE peak_rating IS NOT NULL
        ORDER BY peak_rating DESC
        LIMIT 20
      `, (err, topPlayers) => {
        console.log('\n✨ Player Indexing Complete!');
        console.log('=====================================');
        console.log(`👥 Total Players Indexed: ${totalPlayers.toLocaleString()}`);
        console.log('=====================================\n');

        if (topPlayers && topPlayers.length > 0) {
          console.log('🏆 Top 20 Rated Players:');
          console.log('------------------------');
          topPlayers.forEach((p, i) => {
            const title = p.title ? `${p.title} ` : '';
            const fed = p.federation ? ` (${p.federation})` : '';
            const tournaments = p.tournaments_count ? ` - ${p.tournaments_count} tournaments` : '';
            console.log(`${(i + 1).toString().padStart(2)}. ${title}${p.name}${fed}: ${p.peak_rating}${tournaments}`);
          });
        }

        console.log('\n🚀 Player profiles ready at:');
        console.log('   http://localhost:3002/players\n');

        db.close();
      });
    });
  });
}

// Start indexing
indexAllPlayers();