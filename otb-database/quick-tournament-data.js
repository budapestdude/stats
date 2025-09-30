const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function extractSampleTournament() {
  const pgnFile = path.join(__dirname, 'pgn-files', 'LumbrasGigaBase_OTB_2020-2024.pgn');
  
  if (!fs.existsSync(pgnFile)) {
    console.log('PGN file not found');
    return;
  }

  const tournaments = new Map();
  let processedGames = 0;
  const maxGames = 1000; // Process first 1000 games for speed

  const fileStream = fs.createReadStream(pgnFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let currentHeaders = {};
  
  for await (const line of rl) {
    if (processedGames >= maxGames) break;
    
    if (line.startsWith('[')) {
      const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
      if (match) {
        currentHeaders[match[1]] = match[2];
      }
    } else if (line.trim() === '' && currentHeaders.Event) {
      // Process game
      const event = currentHeaders.Event;
      
      if (!tournaments.has(event)) {
        tournaments.set(event, {
          name: event,
          games: [],
          players: new Map()
        });
      }
      
      const tournament = tournaments.get(event);
      const result = currentHeaders.Result || '*';
      
      // Add game
      tournament.games.push({
        white: currentHeaders.White,
        black: currentHeaders.Black,
        result: result,
        date: currentHeaders.Date,
        round: currentHeaders.Round
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
      
      if (currentHeaders.White && currentHeaders.Black) {
        updatePlayer(currentHeaders.White, 'white', result);
        updatePlayer(currentHeaders.Black, 'black', result);
      }
      
      processedGames++;
      currentHeaders = {};
    }
  }
  
  rl.close();
  
  // Find the largest tournament
  let largestTournament = null;
  let maxGamesInTournament = 0;
  
  tournaments.forEach(tournament => {
    if (tournament.games.length > maxGamesInTournament) {
      maxGamesInTournament = tournament.games.length;
      largestTournament = tournament;
    }
  });
  
  if (largestTournament) {
    console.log(`\nLargest tournament found: ${largestTournament.name}`);
    console.log(`Games: ${largestTournament.games.length}`);
    console.log(`Players: ${largestTournament.players.size}`);
    
    // Create crosstable
    const players = Array.from(largestTournament.players.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Top 10 players
    
    console.log('\nTop 10 Standings:');
    console.log('Rank | Player | Score | Games | W | D | L');
    console.log('-----|--------|-------|-------|---|---|---');
    
    players.forEach((player, index) => {
      console.log(`${(index + 1).toString().padEnd(4)} | ${player.name.substring(0, 20).padEnd(20)} | ${player.score.toFixed(1).padEnd(5)} | ${player.games.toString().padEnd(5)} | ${player.wins} | ${player.draws} | ${player.losses}`);
    });
    
    // Save this tournament data to file
    const outputData = {
      name: largestTournament.name,
      games_count: largestTournament.games.length,
      players: players,
      sample_games: largestTournament.games.slice(0, 5)
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'sample-tournament-data.json'),
      JSON.stringify(outputData, null, 2)
    );
    
    console.log('\nSample tournament data saved to sample-tournament-data.json');
  }
  
  console.log(`\nTotal tournaments found: ${tournaments.size}`);
  console.log(`Total games processed: ${processedGames}`);
}

extractSampleTournament().catch(console.error);