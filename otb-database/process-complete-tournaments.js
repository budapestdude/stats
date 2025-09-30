const sqlite3 = require('sqlite3').verbose();

// Connect to both databases
const indexDb = new sqlite3.Database('./complete-tournaments.db');
const outputDb = new sqlite3.Database('./chess-stats.db');

// Clear old partial data and create new table for complete tournaments
outputDb.serialize(() => {
  outputDb.run(`DROP TABLE IF EXISTS complete_tournaments`);
  
  outputDb.run(`
    CREATE TABLE complete_tournaments (
      tournament_name TEXT PRIMARY KEY,
      total_games INTEGER,
      total_players INTEGER,
      location TEXT,
      start_date TEXT,
      end_date TEXT,
      crosstable TEXT,
      standings TEXT,
      stats TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

class CompleteTournamentProcessor {
  constructor() {
    this.processedCount = 0;
    this.batchSize = 10; // Process 10 tournaments at a time
  }

  async processTournament(tournamentName) {
    return new Promise((resolve) => {
      // Get all games for this tournament
      indexDb.all(`
        SELECT * FROM games 
        WHERE tournament_name = ?
        ORDER BY date, round
      `, [tournamentName], (err, games) => {
        if (err || !games || games.length === 0) {
          resolve(null);
          return;
        }

        // Build player statistics
        const players = new Map();
        const dates = new Set();
        let decisiveGames = 0;
        let totalMoves = 0;
        let longestGame = 0;
        let shortestDecisive = Infinity;
        const openings = new Map();

        // Process each game
        games.forEach(game => {
          // Track dates
          if (game.date) dates.add(game.date);

          // Track openings
          if (game.opening) {
            openings.set(game.opening, (openings.get(game.opening) || 0) + 1);
          }

          // Track game length
          if (game.ply_count) {
            totalMoves += game.ply_count;
            if (game.ply_count > longestGame) {
              longestGame = game.ply_count;
            }
            if ((game.result === '1-0' || game.result === '0-1') && game.ply_count < shortestDecisive) {
              shortestDecisive = game.ply_count;
            }
          }

          // Initialize players if not exists
          if (!players.has(game.white_player)) {
            players.set(game.white_player, {
              name: game.white_player,
              games: 0,
              wins: 0,
              draws: 0,
              losses: 0,
              score: 0,
              opponents: new Set()
            });
          }
          if (!players.has(game.black_player)) {
            players.set(game.black_player, {
              name: game.black_player,
              games: 0,
              wins: 0,
              draws: 0,
              losses: 0,
              score: 0,
              opponents: new Set()
            });
          }

          const whitePlayer = players.get(game.white_player);
          const blackPlayer = players.get(game.black_player);

          // Update game counts and opponents
          whitePlayer.games++;
          blackPlayer.games++;
          whitePlayer.opponents.add(game.black_player);
          blackPlayer.opponents.add(game.white_player);

          // Update results
          if (game.result === '1-0') {
            whitePlayer.wins++;
            whitePlayer.score += 1;
            blackPlayer.losses++;
            decisiveGames++;
          } else if (game.result === '0-1') {
            blackPlayer.wins++;
            blackPlayer.score += 1;
            whitePlayer.losses++;
            decisiveGames++;
          } else if (game.result === '1/2-1/2') {
            whitePlayer.draws++;
            blackPlayer.draws++;
            whitePlayer.score += 0.5;
            blackPlayer.score += 0.5;
          }
        });

        // Convert to sorted standings
        const standings = Array.from(players.values())
          .sort((a, b) => {
            // Sort by score, then by wins, then by games
            if (b.score !== a.score) return b.score - a.score;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return a.games - b.games; // Fewer games is better if same score
          })
          .map((player, index) => ({
            position: index + 1,
            name: player.name,
            games: player.games,
            wins: player.wins,
            draws: player.draws,
            losses: player.losses,
            score: player.score,
            performance: Math.round(2400 + (player.score / player.games - 0.5) * 400) // Rough performance estimate
          }));

        // Get date range
        const sortedDates = Array.from(dates).sort();
        const startDate = sortedDates[0] || null;
        const endDate = sortedDates[sortedDates.length - 1] || null;

        // Find most common opening
        let mostCommonOpening = 'Unknown';
        let maxOpeningCount = 0;
        openings.forEach((count, opening) => {
          if (count > maxOpeningCount) {
            maxOpeningCount = count;
            mostCommonOpening = opening;
          }
        });

        // Calculate statistics
        const stats = {
          totalGames: games.length,
          totalPlayers: players.size,
          decisiveRate: Math.round((decisiveGames / games.length) * 100),
          averageLength: totalMoves > 0 ? Math.round(totalMoves / games.length / 2) : 0,
          longestGame: Math.round(longestGame / 2),
          shortestDecisive: shortestDecisive < Infinity ? Math.round(shortestDecisive / 2) : 0,
          mostCommonOpening: mostCommonOpening,
          rounds: Math.max(...Array.from(players.values()).map(p => p.games))
        };

        resolve({
          name: tournamentName,
          totalGames: games.length,
          totalPlayers: players.size,
          location: games[0].location || null,
          startDate: startDate,
          endDate: endDate,
          standings: standings,
          stats: stats
        });
      });
    });
  }

  async processBatch(tournaments) {
    const results = [];
    
    for (const tournament of tournaments) {
      console.log(`  Processing: ${tournament.tournament_name} (${tournament.total_games} games)`);
      
      const data = await this.processTournament(tournament.tournament_name);
      if (data) {
        results.push(data);
        this.processedCount++;
      }
    }

    // Save batch to output database
    if (results.length > 0) {
      await this.saveBatch(results);
    }
  }

  async saveBatch(tournaments) {
    return new Promise((resolve) => {
      const stmt = outputDb.prepare(`
        INSERT INTO complete_tournaments 
        (tournament_name, total_games, total_players, location, start_date, end_date, crosstable, standings, stats)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      outputDb.serialize(() => {
        outputDb.run('BEGIN TRANSACTION');
        
        tournaments.forEach(t => {
          // Create crosstable (head-to-head results between top players)
          const crosstable = this.buildCrosstable(t.standings.slice(0, 20));
          
          stmt.run(
            t.name,
            t.totalGames,
            t.totalPlayers,
            t.location,
            t.startDate,
            t.endDate,
            JSON.stringify(crosstable),
            JSON.stringify(t.standings),
            JSON.stringify(t.stats)
          );
        });
        
        outputDb.run('COMMIT', () => {
          stmt.finalize();
          console.log(`  ✓ Saved ${tournaments.length} tournaments`);
          resolve();
        });
      });
    });
  }

  buildCrosstable(topPlayers) {
    // For now, return simplified crosstable
    // In a complete implementation, we'd look up actual game results between players
    return topPlayers.map(p => ({
      player: p.name,
      score: p.score,
      games: p.games
    }));
  }

  async processAll() {
    console.log('\n' + '='.repeat(60));
    console.log('PROCESSING COMPLETE TOURNAMENTS');
    console.log('='.repeat(60));

    // Get tournaments to process (those with 50+ games for meaningful crosstables)
    return new Promise((resolve) => {
      indexDb.all(`
        SELECT tournament_name, total_games, total_players
        FROM tournament_index
        WHERE total_games >= 50
        ORDER BY total_games DESC
      `, async (err, tournaments) => {
        if (err || !tournaments) {
          console.error('Error getting tournaments:', err);
          resolve();
          return;
        }

        console.log(`\nFound ${tournaments.length} tournaments with 50+ games\n`);

        // Process in batches
        for (let i = 0; i < tournaments.length; i += this.batchSize) {
          const batch = tournaments.slice(i, i + this.batchSize);
          console.log(`\nBatch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(tournaments.length / this.batchSize)}`);
          await this.processBatch(batch);
          
          // Show progress
          if (this.processedCount % 100 === 0) {
            console.log(`\nProgress: ${this.processedCount}/${tournaments.length} tournaments processed`);
          }
        }

        console.log('\n' + '='.repeat(60));
        console.log(`COMPLETE: Processed ${this.processedCount} tournaments`);
        console.log('='.repeat(60));
        
        resolve();
      });
    });
  }
}

// Main execution
async function main() {
  const processor = new CompleteTournamentProcessor();
  await processor.processAll();
  
  // Show final statistics
  outputDb.get(`
    SELECT 
      COUNT(*) as count,
      SUM(total_games) as total_games,
      SUM(total_players) as total_players
    FROM complete_tournaments
  `, (err, stats) => {
    if (!err && stats) {
      console.log('\nFinal Database Statistics:');
      console.log(`  ${stats.count} complete tournaments`);
      console.log(`  ${stats.total_games} total games`);
      console.log(`  ${stats.total_players} total player entries`);
    }
    
    indexDb.close();
    outputDb.close();
  });
}

main().catch(console.error);