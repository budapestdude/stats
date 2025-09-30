const fs = require('fs');
const readline = require('readline');
const { EventEmitter } = require('events');

class PGNParser extends EventEmitter {
  constructor() {
    super();
    this.currentGame = null;
    this.gamesProcessed = 0;
    this.errors = 0;
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

  // Parse a single game from accumulated lines
  parseGame(lines) {
    if (!lines || lines.length === 0) return null;

    const headerLines = [];
    let moveText = '';
    let inMoves = false;

    for (const line of lines) {
      if (line.startsWith('[')) {
        headerLines.push(line);
      } else if (line.trim() && !line.startsWith('[')) {
        inMoves = true;
        moveText += line + ' ';
      }
    }

    if (headerLines.length === 0) return null;

    const headers = this.parseHeaders(headerLines);
    
    // Clean up move text
    moveText = moveText
      .replace(/\{[^}]*\}/g, '') // Remove comments
      .replace(/\([^)]*\)/g, '')  // Remove variations
      .replace(/\d+\.\.\./g, '')  // Remove move number indicators
      .trim();

    // Extract result from moves
    const resultMatch = moveText.match(/(1-0|0-1|1\/2-1\/2|\*)/);
    const result = resultMatch ? resultMatch[1] : headers.Result || '*';
    
    // Remove result from moves
    if (resultMatch) {
      moveText = moveText.substring(0, resultMatch.index).trim();
    }

    return {
      // Standard headers
      event: headers.Event || 'Unknown',
      site: headers.Site || 'Unknown',
      date: headers.Date || 'Unknown',
      round: headers.Round || '?',
      white: headers.White || 'Unknown',
      black: headers.Black || 'Unknown',
      result: result,
      
      // Ratings
      whiteElo: parseInt(headers.WhiteElo) || null,
      blackElo: parseInt(headers.BlackElo) || null,
      whiteTitle: headers.WhiteTitle || null,
      blackTitle: headers.BlackTitle || null,
      
      // Opening
      eco: headers.ECO || null,
      opening: headers.Opening || null,
      variation: headers.Variation || null,
      
      // Game details
      plyCount: parseInt(headers.PlyCount) || null,
      timeControl: headers.TimeControl || null,
      termination: headers.Termination || null,
      
      // Moves
      moves: moveText,
      pgn: lines.join('\n'),
      
      // Metadata
      headers: headers
    };
  }

  // Stream parse large PGN files
  async parseFile(filePath, options = {}) {
    const { 
      batchSize = 100,
      onBatch = null,
      onGame = null,
      maxGames = null,
      filter = null
    } = options;

    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let currentGameLines = [];
      let batch = [];
      let totalGames = 0;
      let acceptedGames = 0;

      rl.on('line', (line) => {
        line = line.trim();

        // New game starts with Event tag
        if (line.startsWith('[Event ') && currentGameLines.length > 0) {
          // Process previous game
          const game = this.parseGame(currentGameLines);
          
          if (game) {
            totalGames++;
            
            // Apply filter if provided
            if (!filter || filter(game)) {
              acceptedGames++;
              
              if (onGame) {
                onGame(game);
              }
              
              batch.push(game);
              
              // Process batch
              if (batch.length >= batchSize) {
                if (onBatch) {
                  onBatch(batch);
                }
                this.emit('batch', batch);
                batch = [];
              }
            }
            
            // Check max games limit
            if (maxGames && acceptedGames >= maxGames) {
              rl.close();
              return;
            }
          }
          
          currentGameLines = [];
        }

        currentGameLines.push(line);
      });

      rl.on('close', () => {
        // Process last game
        if (currentGameLines.length > 0) {
          const game = this.parseGame(currentGameLines);
          if (game && (!filter || filter(game))) {
            if (onGame) onGame(game);
            batch.push(game);
          }
        }

        // Process remaining batch
        if (batch.length > 0) {
          if (onBatch) onBatch(batch);
          this.emit('batch', batch);
        }

        this.emit('complete', {
          totalGames,
          acceptedGames,
          file: filePath
        });

        resolve({
          totalGames,
          acceptedGames
        });
      });

      rl.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });
    });
  }

  // Extract opening statistics from games
  async analyzeOpenings(filePath, options = {}) {
    const openings = new Map();
    const ecoStats = new Map();

    await this.parseFile(filePath, {
      ...options,
      onGame: (game) => {
        if (game.eco) {
          // ECO statistics
          if (!ecoStats.has(game.eco)) {
            ecoStats.set(game.eco, {
              eco: game.eco,
              name: game.opening,
              count: 0,
              white: 0,
              draws: 0,
              black: 0
            });
          }
          
          const stats = ecoStats.get(game.eco);
          stats.count++;
          
          if (game.result === '1-0') stats.white++;
          else if (game.result === '0-1') stats.black++;
          else if (game.result === '1/2-1/2') stats.draws++;
        }
        
        // First moves analysis
        const firstMoves = game.moves.split(' ').slice(0, 10).join(' ');
        if (firstMoves) {
          if (!openings.has(firstMoves)) {
            openings.set(firstMoves, {
              moves: firstMoves,
              count: 0,
              white: 0,
              draws: 0,
              black: 0
            });
          }
          
          const opening = openings.get(firstMoves);
          opening.count++;
          
          if (game.result === '1-0') opening.white++;
          else if (game.result === '0-1') opening.black++;
          else if (game.result === '1/2-1/2') opening.draws++;
        }
      }
    });

    // Convert maps to sorted arrays
    const ecoList = Array.from(ecoStats.values())
      .sort((a, b) => b.count - a.count)
      .map(stat => ({
        ...stat,
        winRate: ((stat.white / stat.count) * 100).toFixed(1),
        drawRate: ((stat.draws / stat.count) * 100).toFixed(1),
        blackWinRate: ((stat.black / stat.count) * 100).toFixed(1)
      }));

    return {
      ecoStatistics: ecoList.slice(0, 50), // Top 50 ECO codes
      totalOpenings: ecoStats.size
    };
  }

  // Extract player statistics
  async analyzePlayer(filePath, playerName, options = {}) {
    const stats = {
      totalGames: 0,
      asWhite: 0,
      asBlack: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      opponents: new Map(),
      openings: new Map(),
      events: new Set(),
      dateRange: { earliest: null, latest: null }
    };

    await this.parseFile(filePath, {
      ...options,
      filter: (game) => {
        return game.white.toLowerCase().includes(playerName.toLowerCase()) ||
               game.black.toLowerCase().includes(playerName.toLowerCase());
      },
      onGame: (game) => {
        const isWhite = game.white.toLowerCase().includes(playerName.toLowerCase());
        
        stats.totalGames++;
        if (isWhite) {
          stats.asWhite++;
          if (game.result === '1-0') stats.wins++;
          else if (game.result === '0-1') stats.losses++;
          else if (game.result === '1/2-1/2') stats.draws++;
        } else {
          stats.asBlack++;
          if (game.result === '0-1') stats.wins++;
          else if (game.result === '1-0') stats.losses++;
          else if (game.result === '1/2-1/2') stats.draws++;
        }
        
        // Track opponents
        const opponent = isWhite ? game.black : game.white;
        stats.opponents.set(opponent, (stats.opponents.get(opponent) || 0) + 1);
        
        // Track openings
        if (game.eco) {
          const openingKey = `${game.eco}: ${game.opening || 'Unknown'}`;
          stats.openings.set(openingKey, (stats.openings.get(openingKey) || 0) + 1);
        }
        
        // Track events
        stats.events.add(game.event);
        
        // Track date range
        if (game.date && game.date !== '????.??.??') {
          if (!stats.dateRange.earliest || game.date < stats.dateRange.earliest) {
            stats.dateRange.earliest = game.date;
          }
          if (!stats.dateRange.latest || game.date > stats.dateRange.latest) {
            stats.dateRange.latest = game.date;
          }
        }
      }
    });

    // Convert maps to arrays
    stats.topOpponents = Array.from(stats.opponents.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, games: count }));
    
    stats.topOpenings = Array.from(stats.openings.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, games: count }));
    
    stats.events = Array.from(stats.events).slice(0, 20);
    
    delete stats.opponents;
    delete stats.openings;
    
    return stats;
  }
}

// CLI interface for testing
if (require.main === module) {
  const parser = new PGNParser();
  const filePath = process.argv[2];
  const command = process.argv[3] || 'parse';
  
  if (!filePath) {
    console.log(`
PGN Parser Usage:
  node pgn-parser.js <file.pgn> [command]
  
Commands:
  parse     - Parse and count games (default)
  openings  - Analyze opening statistics
  player    - Analyze player statistics (requires player name as 4th argument)
  
Examples:
  node pgn-parser.js games.pgn
  node pgn-parser.js games.pgn openings
  node pgn-parser.js games.pgn player "Magnus Carlsen"
    `);
    process.exit(1);
  }
  
  console.log(`Processing ${filePath}...`);
  
  switch(command) {
    case 'openings':
      parser.analyzeOpenings(filePath)
        .then(stats => {
          console.log('\nTop Openings:');
          stats.ecoStatistics.slice(0, 20).forEach(eco => {
            console.log(`${eco.eco}: ${eco.name || 'Unknown'}`);
            console.log(`  Games: ${eco.count}, W: ${eco.winRate}%, D: ${eco.drawRate}%, B: ${eco.blackWinRate}%`);
          });
        })
        .catch(console.error);
      break;
    
    case 'player':
      const playerName = process.argv[4];
      if (!playerName) {
        console.log('Please provide a player name');
        process.exit(1);
      }
      parser.analyzePlayer(filePath, playerName)
        .then(stats => {
          console.log(`\nPlayer Statistics for ${playerName}:`);
          console.log(JSON.stringify(stats, null, 2));
        })
        .catch(console.error);
      break;
    
    default:
      let gameCount = 0;
      parser.parseFile(filePath, {
        onGame: (game) => {
          gameCount++;
          if (gameCount % 1000 === 0) {
            process.stdout.write(`\rProcessed ${gameCount} games...`);
          }
        }
      })
      .then(result => {
        console.log(`\n✅ Parsing complete!`);
        console.log(`Total games: ${result.totalGames}`);
        console.log(`Accepted games: ${result.acceptedGames}`);
      })
      .catch(console.error);
  }
}

module.exports = PGNParser;