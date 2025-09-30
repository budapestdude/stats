const fs = require('fs');
const path = require('path');
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();

// Connect to database
const db = new sqlite3.Database('./chess-stats.db');

class TournamentExtractor {
  constructor() {
    this.tournaments = new Map(); // tournament name -> data
    this.currentBatch = [];
    this.processedGames = 0;
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
        stats: {
          totalGames: 0,
          totalMoves: 0,
          decisiveGames: 0,
          openings: new Map(),
          longestGame: 0,
          shortestDecisive: Infinity
        }
      });
    }

    const tournament = this.tournaments.get(tournamentName);
    
    // Record game
    tournament.games.push({
      white: headers.White,
      black: headers.Black,
      result: result,
      date: headers.Date,
      round: headers.Round,
      eco: headers.ECO,
      opening: headers.Opening,
      plyCount: parseInt(headers.PlyCount) || 0
    });

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
    tournament.stats.totalGames++;
    
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
    if (this.processedGames % 1000 === 0) {
      console.log(`Processed ${this.processedGames} games, found ${this.tournaments.size} tournaments`);
    }
  }

  // Parse a PGN file
  async parseFile(filePath) {
    console.log(`Parsing ${filePath}...`);
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentHeaders = [];
    let inHeaders = false;

    for await (const line of rl) {
      if (line.startsWith('[')) {
        inHeaders = true;
        currentHeaders.push(line);
      } else if (inHeaders && line.trim() === '') {
        // End of headers, process the game
        if (currentHeaders.length > 0) {
          const headers = this.parseHeaders(currentHeaders);
          this.processGame(headers);
          currentHeaders = [];
        }
        inHeaders = false;
      }
    }

    // Process last game if exists
    if (currentHeaders.length > 0) {
      const headers = this.parseHeaders(currentHeaders);
      this.processGame(headers);
    }
  }

  // Get tournament data for API
  getTournamentData(tournamentName) {
    const tournament = this.tournaments.get(tournamentName);
    if (!tournament) return null;

    // Convert players map to sorted array
    const players = Array.from(tournament.players.values())
      .sort((a, b) => b.score - a.score)
      .map((player, index) => ({
        ...player,
        performance: 2800 - (index * 20) // Approximate performance
      }));

    // Find most common opening
    let mostCommonOpening = 'Unknown';
    let maxCount = 0;
    tournament.stats.openings.forEach((count, opening) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonOpening = opening;
      }
    });

    const avgLength = tournament.stats.totalMoves > 0 
      ? Math.round(tournament.stats.totalMoves / tournament.stats.totalGames / 2) // Convert ply to moves
      : 0;

    return {
      name: tournament.name,
      games_count: tournament.stats.totalGames,
      location: tournament.location,
      start_date: tournament.start_date,
      players: players.slice(0, 20), // Top 20 players
      stats: {
        totalGames: tournament.stats.totalGames,
        decisiveRate: Math.round((tournament.stats.decisiveGames / tournament.stats.totalGames) * 100),
        averageLength: avgLength,
        mostCommonOpening: mostCommonOpening,
        longestGame: Math.round(tournament.stats.longestGame / 2),
        shortestDecisive: tournament.stats.shortestDecisive < Infinity 
          ? Math.round(tournament.stats.shortestDecisive / 2) 
          : 0,
        upsets: 0 // Would need rating data to calculate
      }
    };
  }

  // Save tournament data to database
  async saveTournamentData() {
    console.log(`\nSaving data for ${this.tournaments.size} tournaments...`);
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO tournament_crosstables 
      (tournament_name, data) 
      VALUES (?, ?)
    `);

    let saved = 0;
    this.tournaments.forEach((tournament, name) => {
      const data = this.getTournamentData(name);
      if (data && data.games_count > 5) { // Only save tournaments with at least 5 games
        stmt.run(name, JSON.stringify(data));
        saved++;
        if (saved % 100 === 0) {
          console.log(`Saved ${saved} tournaments...`);
        }
      }
    });

    stmt.finalize();
    console.log(`Saved ${saved} tournaments to database`);
  }
}

// Main execution
async function main() {
  // Create table if not exists
  db.run(`
    CREATE TABLE IF NOT EXISTS tournament_crosstables (
      tournament_name TEXT PRIMARY KEY,
      data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const extractor = new TournamentExtractor();
  
  // Parse PGN files
  const pgnDir = path.join(__dirname, 'pgn-files');
  const pgnFiles = fs.readdirSync(pgnDir).filter(f => f.endsWith('.pgn'));
  
  console.log(`Found ${pgnFiles.length} PGN files`);
  
  // Process a larger PGN file with real tournament data
  const targetFile = pgnFiles.find(f => f.includes('2020-2024')) || pgnFiles.find(f => f.includes('2015-2019')) || pgnFiles[0];
  if (targetFile) {
    const testFile = path.join(pgnDir, targetFile);
    console.log(`Processing ${targetFile}...`);
    await extractor.parseFile(testFile);
    
    console.log(`\nExtracted ${extractor.tournaments.size} tournaments`);
    console.log(`Total games processed: ${extractor.processedGames}`);
    
    // Show sample tournament
    const sampleTournaments = Array.from(extractor.tournaments.keys()).slice(0, 5);
    console.log('\nSample tournaments:');
    sampleTournaments.forEach(name => {
      const data = extractor.getTournamentData(name);
      console.log(`- ${name}: ${data.games_count} games, ${data.players.length} players`);
    });
    
    // Save to database
    await extractor.saveTournamentData();
  }
  
  db.close();
  console.log('\nDone!');
}

// Run the extraction
main().catch(console.error);