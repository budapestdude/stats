const fs = require('fs');
const path = require('path');
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();

// Connect to database
const db = new sqlite3.Database('./chess-stats.db');

class BatchTournamentProcessor {
  constructor() {
    this.tournaments = new Map();
    this.processedGames = 0;
    this.processedFiles = 0;
    this.totalFiles = 0;
  }

  // Parse PGN headers
  parseHeaders(headerLines) {
    const headers = {};
    headerLines.forEach(line => {
      const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
      if (match) {
        headers[match[1]] = match[2];
      }
    });
    return headers;
  }

  // Process a single game
  processGame(headers) {
    if (!headers.Event || !headers.White || !headers.Black) return;

    const tournamentName = headers.Event.trim();
    const result = headers.Result || '*';
    
    // Initialize tournament if not exists
    if (!this.tournaments.has(tournamentName)) {
      this.tournaments.set(tournamentName, {
        name: tournamentName,
        games: [],
        players: new Map(),
        location: headers.Site || null,
        start_date: headers.Date || null,
        end_date: headers.Date || null,
        stats: {
          totalGames: 0,
          totalMoves: 0,
          decisiveGames: 0,
          openings: new Map(),
          longestGame: 0,
          shortestDecisive: Infinity,
          dates: new Set()
        }
      });
    }

    const tournament = this.tournaments.get(tournamentName);
    
    // Update date range
    if (headers.Date && headers.Date !== '????.??.??') {
      tournament.stats.dates.add(headers.Date);
    }

    // Record game (store less data to save memory)
    tournament.stats.totalGames++;

    // Update player stats
    const updatePlayer = (name, color, result) => {
      if (!tournament.players.has(name)) {
        tournament.players.set(name, {
          name: name,
          games: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          score: 0
        });
      }
      
      const player = tournament.players.get(name);
      player.games++;
      
      if (result === '1-0' && color === 'white' || result === '0-1' && color === 'black') {
        player.wins++;
        player.score += 1;
      } else if (result === '1/2-1/2') {
        player.draws++;
        player.score += 0.5;
      } else if (result === '1-0' && color === 'black' || result === '0-1' && color === 'white') {
        player.losses++;
      }
    };

    updatePlayer(headers.White, 'white', result);
    updatePlayer(headers.Black, 'black', result);

    // Update tournament stats
    if (result === '1-0' || result === '0-1') {
      tournament.stats.decisiveGames++;
    }
    
    const plyCount = parseInt(headers.PlyCount) || 0;
    if (plyCount > 0) {
      tournament.stats.totalMoves += plyCount;
      if (plyCount > tournament.stats.longestGame) {
        tournament.stats.longestGame = plyCount;
      }
      if ((result === '1-0' || result === '0-1') && plyCount < tournament.stats.shortestDecisive) {
        tournament.stats.shortestDecisive = plyCount;
      }
    }

    // Track openings
    if (headers.Opening) {
      const opening = headers.Opening;
      tournament.stats.openings.set(opening, (tournament.stats.openings.get(opening) || 0) + 1);
    }

    this.processedGames++;
    if (this.processedGames % 5000 === 0) {
      console.log(`  Processed ${this.processedGames} games, found ${this.tournaments.size} tournaments`);
    }
  }

  // Parse a PGN file
  async parseFile(filePath) {
    console.log(`\nProcessing file ${this.processedFiles + 1}/${this.totalFiles}: ${path.basename(filePath)}`);
    
    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let currentHeaders = [];
      let inHeaders = false;
      let gamesInFile = 0;

      rl.on('line', (line) => {
        if (line.startsWith('[')) {
          inHeaders = true;
          currentHeaders.push(line);
        } else if (inHeaders && line.trim() === '') {
          // End of headers, process the game
          if (currentHeaders.length > 0) {
            const headers = this.parseHeaders(currentHeaders);
            this.processGame(headers);
            currentHeaders = [];
            gamesInFile++;
          }
          inHeaders = false;
        }
      });

      rl.on('close', () => {
        // Process last game if exists
        if (currentHeaders.length > 0) {
          const headers = this.parseHeaders(currentHeaders);
          this.processGame(headers);
          gamesInFile++;
        }
        console.log(`  Completed: ${gamesInFile} games from this file`);
        this.processedFiles++;
        resolve();
      });

      rl.on('error', reject);
    });
  }

  // Get tournament data for storage
  formatTournamentData(tournament) {
    // Convert players map to sorted array
    const players = Array.from(tournament.players.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 50); // Top 50 players to save space

    // Find most common opening
    let mostCommonOpening = 'Unknown';
    let maxCount = 0;
    tournament.stats.openings.forEach((count, opening) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonOpening = opening;
      }
    });

    // Get date range
    const dates = Array.from(tournament.stats.dates).sort();
    const startDate = dates[0] || null;
    const endDate = dates[dates.length - 1] || null;

    const avgLength = tournament.stats.totalMoves > 0 
      ? Math.round(tournament.stats.totalMoves / tournament.stats.totalGames / 2)
      : 0;

    return {
      name: tournament.name,
      games_count: tournament.stats.totalGames,
      player_count: tournament.players.size,
      location: tournament.location,
      start_date: startDate,
      end_date: endDate,
      players: players,
      stats: {
        totalGames: tournament.stats.totalGames,
        decisiveRate: Math.round((tournament.stats.decisiveGames / tournament.stats.totalGames) * 100),
        averageLength: avgLength,
        mostCommonOpening: mostCommonOpening,
        longestGame: Math.round(tournament.stats.longestGame / 2),
        shortestDecisive: tournament.stats.shortestDecisive < Infinity 
          ? Math.round(tournament.stats.shortestDecisive / 2) 
          : 0
      }
    };
  }

  // Save tournament data to database in batches
  async saveTournamentData() {
    console.log(`\n=== Saving tournament data to database ===`);
    console.log(`Total tournaments to save: ${this.tournaments.size}`);
    
    // Create table if not exists
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS tournament_data (
          tournament_name TEXT PRIMARY KEY,
          games_count INTEGER,
          player_count INTEGER,
          location TEXT,
          start_date TEXT,
          end_date TEXT,
          data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO tournament_data 
      (tournament_name, games_count, player_count, location, start_date, end_date, data) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let saved = 0;
    let skipped = 0;
    const batch = [];
    
    for (const [name, tournament] of this.tournaments) {
      // Only save tournaments with at least 10 games
      if (tournament.stats.totalGames >= 10) {
        const data = this.formatTournamentData(tournament);
        batch.push([
          name,
          data.games_count,
          data.player_count,
          data.location,
          data.start_date,
          data.end_date,
          JSON.stringify(data)
        ]);
        
        // Save in batches of 100
        if (batch.length >= 100) {
          for (const params of batch) {
            stmt.run(...params);
          }
          saved += batch.length;
          batch.length = 0;
          console.log(`  Saved ${saved} tournaments...`);
        }
      } else {
        skipped++;
      }
    }
    
    // Save remaining batch
    if (batch.length > 0) {
      for (const params of batch) {
        stmt.run(...params);
      }
      saved += batch.length;
    }

    stmt.finalize();
    
    console.log(`\n✅ Saved ${saved} tournaments to database`);
    console.log(`⏭️  Skipped ${skipped} small tournaments (< 10 games)`);
  }

  // Print summary statistics
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('PROCESSING COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total PGN files processed: ${this.processedFiles}`);
    console.log(`Total games processed: ${this.processedGames}`);
    console.log(`Total tournaments found: ${this.tournaments.size}`);
    
    // Find largest tournaments
    const sortedTournaments = Array.from(this.tournaments.values())
      .sort((a, b) => b.stats.totalGames - a.stats.totalGames)
      .slice(0, 10);
    
    console.log('\nTop 10 Largest Tournaments:');
    console.log('-'.repeat(60));
    sortedTournaments.forEach((t, i) => {
      console.log(`${i + 1}. ${t.name}`);
      console.log(`   Games: ${t.stats.totalGames}, Players: ${t.players.size}`);
    });
  }
}

// Main execution
async function main() {
  const processor = new BatchTournamentProcessor();
  
  // Get all PGN files
  const pgnDir = path.join(__dirname, 'pgn-files');
  const pgnFiles = fs.readdirSync(pgnDir)
    .filter(f => f.endsWith('.pgn'))
    .map(f => path.join(pgnDir, f));
  
  processor.totalFiles = pgnFiles.length;
  
  console.log('='.repeat(60));
  console.log('BATCH TOURNAMENT PROCESSOR');
  console.log('='.repeat(60));
  console.log(`Found ${pgnFiles.length} PGN files to process`);
  console.log('This may take several minutes...\n');
  
  // Process each file
  for (const file of pgnFiles) {
    try {
      await processor.parseFile(file);
    } catch (error) {
      console.error(`Error processing ${path.basename(file)}:`, error.message);
    }
  }
  
  // Print summary
  processor.printSummary();
  
  // Save to database
  await processor.saveTournamentData();
  
  // Close database
  db.close(() => {
    console.log('\n✅ Database connection closed');
    console.log('🎉 Processing complete!');
  });
}

// Run the batch processor
console.log('Starting batch tournament processor...');
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});