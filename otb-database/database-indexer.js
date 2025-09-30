const fs = require('fs');
const readline = require('readline');
const path = require('path');
const crypto = require('crypto');

class DatabaseIndexer {
  constructor() {
    this.indexes = {
      players: {},        // playerName -> [{file, lineNumber, gameId}]
      events: {},         // eventName -> [{file, lineNumber, gameId}]
      years: {},          // year -> [{file, lineNumber, gameId}]
      openings: {},       // eco -> [{file, lineNumber, gameId}]
      timeControls: {},   // timeControl -> [{file, lineNumber, gameId}]
      gameIds: {},        // gameId -> {file, lineNumber, metadata}
      fileOffsets: {}     // file -> [gameStartOffsets]
    };
    
    this.stats = {
      totalGames: 0,
      totalPlayers: new Set(),
      totalEvents: new Set(),
      dateRange: { earliest: null, latest: null },
      filesProcessed: 0,
      indexingTime: 0
    };
  }

  generateGameId(game) {
    // Create a unique ID based on game metadata
    const str = `${game.white}-${game.black}-${game.date}-${game.event}`;
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 12);
  }

  normalizePlayerName(name) {
    if (!name) return null;
    // Remove titles and normalize
    return name.replace(/^(GM|IM|FM|WGM|WIM|WFM|CM|WCM)\s+/i, '')
               .trim()
               .toLowerCase()
               .replace(/,\s*/, ', ');
  }

  extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/(\d{4})/);
    return match ? match[1] : null;
  }

  categorizeTimeControl(timeControl, eventName) {
    if (eventName) {
      const eventLower = eventName.toLowerCase();
      if (eventLower.includes('blitz') || eventLower.includes('bullet')) return 'blitz';
      if (eventLower.includes('rapid')) return 'rapid';
      if (eventLower.includes('online') || eventLower.includes('lichess') || 
          eventLower.includes('chess.com') || eventLower.includes('ficgs')) return 'online';
    }
    
    if (!timeControl || timeControl === '-') return 'classical';
    
    const tcLower = timeControl.toLowerCase();
    
    if (tcLower.includes('m')) {
      const minMatch = tcLower.match(/(\d+)m/);
      if (minMatch) {
        const minutes = parseInt(minMatch[1]);
        if (minutes < 10) return 'blitz';
        if (minutes < 60) return 'rapid';
        return 'classical';
      }
    }
    
    const match = timeControl.match(/^(\d+)(?:\+(\d+))?/);
    if (match) {
      const baseTime = parseInt(match[1]);
      const increment = parseInt(match[2] || 0);
      let totalSeconds = baseTime > 100 ? baseTime + (increment * 40) : (baseTime * 60) + (increment * 40);
      
      if (totalSeconds < 600) return 'blitz';
      if (totalSeconds < 1800) return 'rapid';
      return 'classical';
    }
    
    return 'classical';
  }

  addToIndex(indexMap, key, value) {
    if (!key) return;
    if (!indexMap[key]) {
      indexMap[key] = [];
    }
    indexMap[key].push(value);
  }

  async indexFile(filePath) {
    const fileName = path.basename(filePath);
    console.log(`Indexing ${fileName}...`);
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentGame = {};
    let lineNumber = 0;
    let gameStartLine = 0;
    let gamesInFile = 0;
    let byteOffset = 0;
    const fileOffsets = [];

    for await (const line of rl) {
      lineNumber++;
      
      if (line.startsWith('[')) {
        if (gameStartLine === 0) {
          gameStartLine = lineNumber;
          fileOffsets.push(byteOffset);
        }
        
        const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
        if (match) {
          const [, key, value] = match;
          currentGame[key.toLowerCase()] = value;
        }
      } else if (line.trim() === '' && currentGame.white && currentGame.black) {
        // End of game headers, process the game
        const gameId = this.generateGameId(currentGame);
        const gameRef = {
          file: fileName,
          line: gameStartLine,
          offset: fileOffsets[fileOffsets.length - 1],
          gameId
        };
        
        // Index by game ID with full metadata
        this.indexes.gameIds[gameId] = {
          file: fileName,
          line: gameStartLine,
          offset: fileOffsets[fileOffsets.length - 1],
          white: currentGame.white,
          black: currentGame.black,
          date: currentGame.date,
          event: currentGame.event,
          result: currentGame.result,
          eco: currentGame.eco,
          timeControl: currentGame.timecontrol
        };
        
        // Index by players
        const whiteName = this.normalizePlayerName(currentGame.white);
        const blackName = this.normalizePlayerName(currentGame.black);
        if (whiteName) {
          this.addToIndex(this.indexes.players, whiteName, gameRef);
          this.stats.totalPlayers.add(whiteName);
        }
        if (blackName) {
          this.addToIndex(this.indexes.players, blackName, gameRef);
          this.stats.totalPlayers.add(blackName);
        }
        
        // Index by event
        if (currentGame.event) {
          this.addToIndex(this.indexes.events, currentGame.event.toLowerCase(), gameRef);
          this.stats.totalEvents.add(currentGame.event);
        }
        
        // Index by year
        const year = this.extractYear(currentGame.date);
        if (year) {
          this.addToIndex(this.indexes.years, year, gameRef);
          
          // Update date range
          if (!this.stats.dateRange.earliest || currentGame.date < this.stats.dateRange.earliest) {
            this.stats.dateRange.earliest = currentGame.date;
          }
          if (!this.stats.dateRange.latest || currentGame.date > this.stats.dateRange.latest) {
            this.stats.dateRange.latest = currentGame.date;
          }
        }
        
        // Index by opening
        if (currentGame.eco) {
          this.addToIndex(this.indexes.openings, currentGame.eco, gameRef);
        }
        
        // Index by time control category
        const timeCategory = this.categorizeTimeControl(currentGame.timecontrol, currentGame.event);
        this.addToIndex(this.indexes.timeControls, timeCategory, gameRef);
        
        gamesInFile++;
        this.stats.totalGames++;
        
        // Reset for next game
        currentGame = {};
        gameStartLine = 0;
      }
      
      byteOffset += Buffer.byteLength(line + '\n');
    }

    // Store file offsets for quick seeking
    this.indexes.fileOffsets[fileName] = fileOffsets;
    
    console.log(`  Indexed ${gamesInFile} games from ${fileName}`);
    this.stats.filesProcessed++;
    
    return gamesInFile;
  }

  async buildIndexes() {
    const startTime = Date.now();
    const pgnDir = path.join(__dirname, 'pgn-files');
    const indexDir = path.join(__dirname, 'indexes');
    
    // Create indexes directory
    if (!fs.existsSync(indexDir)) {
      fs.mkdirSync(indexDir, { recursive: true });
    }
    
    // Get all PGN files
    const pgnFiles = fs.readdirSync(pgnDir)
      .filter(f => f.endsWith('.pgn'))
      .sort();
    
    console.log(`Building indexes for ${pgnFiles.length} PGN files...\n`);
    
    // Index each file
    for (const file of pgnFiles) {
      const filePath = path.join(pgnDir, file);
      await this.indexFile(filePath);
    }
    
    this.stats.indexingTime = Date.now() - startTime;
    
    // Save indexes to disk
    console.log('\nSaving indexes to disk...');
    
    // Save main indexes
    fs.writeFileSync(
      path.join(indexDir, 'players.json'),
      JSON.stringify(this.indexes.players, null, 2)
    );
    
    fs.writeFileSync(
      path.join(indexDir, 'events.json'),
      JSON.stringify(this.indexes.events, null, 2)
    );
    
    fs.writeFileSync(
      path.join(indexDir, 'years.json'),
      JSON.stringify(this.indexes.years, null, 2)
    );
    
    fs.writeFileSync(
      path.join(indexDir, 'openings.json'),
      JSON.stringify(this.indexes.openings, null, 2)
    );
    
    fs.writeFileSync(
      path.join(indexDir, 'time-controls.json'),
      JSON.stringify(this.indexes.timeControls, null, 2)
    );
    
    fs.writeFileSync(
      path.join(indexDir, 'game-ids.json'),
      JSON.stringify(this.indexes.gameIds, null, 2)
    );
    
    fs.writeFileSync(
      path.join(indexDir, 'file-offsets.json'),
      JSON.stringify(this.indexes.fileOffsets, null, 2)
    );
    
    // Save statistics
    const statsOutput = {
      ...this.stats,
      totalPlayers: this.stats.totalPlayers.size,
      totalEvents: this.stats.totalEvents.size,
      topPlayers: this.getTopPlayers(20),
      topEvents: this.getTopEvents(20),
      yearDistribution: this.getYearDistribution(),
      timeControlDistribution: this.getTimeControlDistribution(),
      indexingTime: `${Math.round(this.stats.indexingTime / 1000)} seconds`,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(
      path.join(indexDir, 'index-stats.json'),
      JSON.stringify(statsOutput, null, 2)
    );
    
    console.log('\nIndexing complete!');
    console.log('='.repeat(50));
    console.log(`Total games indexed: ${this.stats.totalGames.toLocaleString()}`);
    console.log(`Total unique players: ${this.stats.totalPlayers.size.toLocaleString()}`);
    console.log(`Total unique events: ${this.stats.totalEvents.size.toLocaleString()}`);
    console.log(`Date range: ${this.stats.dateRange.earliest} to ${this.stats.dateRange.latest}`);
    console.log(`Indexing time: ${Math.round(this.stats.indexingTime / 1000)} seconds`);
    console.log('='.repeat(50));
    
    return statsOutput;
  }

  getTopPlayers(limit = 10) {
    return Object.entries(this.indexes.players)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, limit)
      .map(([name, games]) => ({
        name,
        games: games.length
      }));
  }

  getTopEvents(limit = 10) {
    return Object.entries(this.indexes.events)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, limit)
      .map(([event, games]) => ({
        event,
        games: games.length
      }));
  }

  getYearDistribution() {
    const distribution = {};
    Object.entries(this.indexes.years).forEach(([year, games]) => {
      distribution[year] = games.length;
    });
    return distribution;
  }

  getTimeControlDistribution() {
    const distribution = {};
    Object.entries(this.indexes.timeControls).forEach(([tc, games]) => {
      distribution[tc] = games.length;
    });
    return distribution;
  }
}

// Quick search functions using the indexes
class IndexSearcher {
  constructor() {
    this.indexDir = path.join(__dirname, 'indexes');
    this.indexes = null;
    this.loadIndexes();
  }

  loadIndexes() {
    console.log('Loading indexes...');
    
    try {
      this.indexes = {
        players: JSON.parse(fs.readFileSync(path.join(this.indexDir, 'players.json'))),
        events: JSON.parse(fs.readFileSync(path.join(this.indexDir, 'events.json'))),
        years: JSON.parse(fs.readFileSync(path.join(this.indexDir, 'years.json'))),
        openings: JSON.parse(fs.readFileSync(path.join(this.indexDir, 'openings.json'))),
        timeControls: JSON.parse(fs.readFileSync(path.join(this.indexDir, 'time-controls.json'))),
        gameIds: JSON.parse(fs.readFileSync(path.join(this.indexDir, 'game-ids.json'))),
        stats: JSON.parse(fs.readFileSync(path.join(this.indexDir, 'index-stats.json')))
      };
      
      console.log('Indexes loaded successfully!');
      console.log(`Total indexed games: ${this.indexes.stats.totalGames}`);
    } catch (error) {
      console.error('Failed to load indexes:', error.message);
      console.log('Please run the indexer first to build the indexes.');
      this.indexes = null;
    }
  }

  searchPlayer(playerName) {
    if (!this.indexes) return null;
    
    const normalized = playerName.toLowerCase().trim();
    const results = [];
    
    // Exact match
    if (this.indexes.players[normalized]) {
      results.push({
        name: normalized,
        games: this.indexes.players[normalized],
        matchType: 'exact'
      });
    }
    
    // Partial matches
    Object.entries(this.indexes.players).forEach(([name, games]) => {
      if (name !== normalized && name.includes(normalized)) {
        results.push({
          name,
          games,
          matchType: 'partial'
        });
      }
    });
    
    return results.sort((a, b) => b.games.length - a.games.length);
  }

  searchEvent(eventName) {
    if (!this.indexes) return null;
    
    const normalized = eventName.toLowerCase().trim();
    const results = [];
    
    Object.entries(this.indexes.events).forEach(([event, games]) => {
      if (event.includes(normalized)) {
        results.push({
          event,
          games,
          count: games.length
        });
      }
    });
    
    return results.sort((a, b) => b.count - a.count);
  }

  getGamesInYear(year) {
    if (!this.indexes) return null;
    return this.indexes.years[year.toString()] || [];
  }

  getGamesByOpening(eco) {
    if (!this.indexes) return null;
    return this.indexes.openings[eco.toUpperCase()] || [];
  }

  getGamesByTimeControl(category) {
    if (!this.indexes) return null;
    return this.indexes.timeControls[category.toLowerCase()] || [];
  }

  getGameMetadata(gameId) {
    if (!this.indexes) return null;
    return this.indexes.gameIds[gameId] || null;
  }

  async getGamePGN(gameRef) {
    // Read the actual PGN for a specific game using the file offset
    const filePath = path.join(__dirname, 'pgn-files', gameRef.file);
    
    return new Promise((resolve, reject) => {
      const gameLines = [];
      let capturing = false;
      let lineCount = 0;
      
      const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity
      });
      
      rl.on('line', (line) => {
        lineCount++;
        
        if (lineCount >= gameRef.line) {
          capturing = true;
        }
        
        if (capturing) {
          gameLines.push(line);
          
          // Stop when we hit the next game or end of moves
          if (gameLines.length > 1 && line.trim() === '' && 
              gameLines[gameLines.length - 2].match(/\d\-\d|\*$/)) {
            rl.close();
          }
        }
      });
      
      rl.on('close', () => {
        resolve(gameLines.join('\n'));
      });
      
      rl.on('error', reject);
    });
  }
}

// Main execution
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'search') {
    // Search mode
    const searcher = new IndexSearcher();
    const searchType = process.argv[3];
    const query = process.argv.slice(4).join(' ');
    
    if (searchType === 'player') {
      const results = searcher.searchPlayer(query);
      if (results && results.length > 0) {
        console.log(`\nFound ${results.length} player(s) matching "${query}":`);
        results.slice(0, 10).forEach(r => {
          console.log(`  ${r.name}: ${r.games.length} games (${r.matchType})`);
        });
      } else {
        console.log(`No players found matching "${query}"`);
      }
    } else if (searchType === 'event') {
      const results = searcher.searchEvent(query);
      if (results && results.length > 0) {
        console.log(`\nFound ${results.length} event(s) matching "${query}":`);
        results.slice(0, 10).forEach(r => {
          console.log(`  ${r.event}: ${r.count} games`);
        });
      } else {
        console.log(`No events found matching "${query}"`);
      }
    } else if (searchType === 'year') {
      const games = searcher.getGamesInYear(query);
      if (games && games.length > 0) {
        console.log(`\nFound ${games.length} games in ${query}`);
        console.log('Sample games:');
        games.slice(0, 5).forEach(g => {
          const meta = searcher.getGameMetadata(g.gameId);
          if (meta) {
            console.log(`  ${meta.white} vs ${meta.black} - ${meta.event}`);
          }
        });
      } else {
        console.log(`No games found in ${query}`);
      }
    } else {
      console.log('Usage: node database-indexer.js search [player|event|year] <query>');
    }
  } else {
    // Build indexes
    console.log('Starting database indexing...\n');
    const indexer = new DatabaseIndexer();
    indexer.buildIndexes().catch(console.error);
  }
}

module.exports = { DatabaseIndexer, IndexSearcher };