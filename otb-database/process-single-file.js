const fs = require('fs');
const path = require('path');
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();

// Connect to database
const db = new sqlite3.Database('./chess-stats.db');

// Create table if not exists
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
  if (err) console.error('Error creating table:', err);
  else console.log('Table ready');
});

async function processFile(fileName) {
  const filePath = path.join(__dirname, 'pgn-files', fileName);
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${fileName}`);
    return;
  }

  console.log(`Processing ${fileName}...`);
  
  const tournaments = new Map();
  let processedGames = 0;
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let currentHeaders = {};
  
  for await (const line of rl) {
    if (line.startsWith('[')) {
      const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
      if (match) {
        currentHeaders[match[1]] = match[2];
      }
    } else if (line.trim() === '' && currentHeaders.Event) {
      // Process game
      const event = currentHeaders.Event.trim();
      
      if (!tournaments.has(event)) {
        tournaments.set(event, {
          name: event,
          location: currentHeaders.Site || null,
          start_date: currentHeaders.Date || null,
          games: 0,
          players: new Map(),
          stats: {
            decisiveGames: 0,
            totalMoves: 0,
            openings: new Map()
          }
        });
      }
      
      const tournament = tournaments.get(event);
      tournament.games++;
      
      // Update player stats
      const result = currentHeaders.Result || '*';
      const updatePlayer = (name, color) => {
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
      
      if (currentHeaders.White && currentHeaders.Black) {
        updatePlayer(currentHeaders.White, 'white');
        updatePlayer(currentHeaders.Black, 'black');
        
        if (result === '1-0' || result === '0-1') {
          tournament.stats.decisiveGames++;
        }
      }
      
      processedGames++;
      if (processedGames % 10000 === 0) {
        console.log(`  Processed ${processedGames} games, found ${tournaments.size} tournaments`);
      }
      
      currentHeaders = {};
      
      // Save to database every 50000 games to avoid memory issues
      if (processedGames % 50000 === 0) {
        console.log('  Saving batch to database...');
        await saveTournaments(tournaments);
        tournaments.clear(); // Clear memory
      }
    }
  }
  
  rl.close();
  
  // Save remaining tournaments
  if (tournaments.size > 0) {
    console.log('  Saving final batch to database...');
    await saveTournaments(tournaments);
  }
  
  console.log(`✅ Completed ${fileName}: ${processedGames} games processed`);
}

async function saveTournaments(tournaments) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO tournament_data 
    (tournament_name, games_count, player_count, location, start_date, end_date, data) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  let saved = 0;
  for (const [name, tournament] of tournaments) {
    if (tournament.games >= 10) { // Only save tournaments with 10+ games
      // Convert players to sorted array
      const players = Array.from(tournament.players.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 30); // Top 30 players
      
      const data = {
        name: tournament.name,
        games_count: tournament.games,
        player_count: tournament.players.size,
        location: tournament.location,
        start_date: tournament.start_date,
        players: players,
        stats: {
          totalGames: tournament.games,
          decisiveRate: Math.round((tournament.stats.decisiveGames / tournament.games) * 100)
        }
      };
      
      stmt.run(
        name,
        tournament.games,
        tournament.players.size,
        tournament.location,
        tournament.start_date,
        tournament.start_date,
        JSON.stringify(data)
      );
      saved++;
    }
  }
  
  stmt.finalize();
  console.log(`    Saved ${saved} tournaments`);
  return saved;
}

// Process a specific file
const targetFile = process.argv[2] || 'LumbrasGigaBase_OTB_2020-2024.pgn';

processFile(targetFile).then(() => {
  console.log('\n✅ Processing complete!');
  
  // Show summary
  db.get('SELECT COUNT(*) as count, SUM(games_count) as total_games FROM tournament_data', (err, row) => {
    if (!err && row) {
      console.log(`\nDatabase now contains:`);
      console.log(`  ${row.count} tournaments`);
      console.log(`  ${row.total_games} total games`);
    }
    db.close();
  });
}).catch(console.error);