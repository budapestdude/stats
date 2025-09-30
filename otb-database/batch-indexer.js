const fs = require('fs');
const readline = require('readline');
const path = require('path');
const crypto = require('crypto');

class BatchIndexer {
  constructor(batchSize = 50000) {
    this.batchSize = batchSize;
    this.indexDir = path.join(__dirname, 'indexes');
    this.tempDir = path.join(__dirname, 'indexes', 'temp');
    this.currentBatch = {
      players: {},
      events: {},
      years: {},
      openings: {},
      timeControls: {},
      gameIds: {}
    };
    this.batchCount = 0;
    this.totalGames = 0;
    this.stats = {
      totalPlayers: new Set(),
      totalEvents: new Set(),
      dateRange: { earliest: null, latest: null },
      filesProcessed: 0,
      startTime: Date.now()
    };
    
    // Ensure directories exist
    if (!fs.existsSync(this.indexDir)) {
      fs.mkdirSync(this.indexDir, { recursive: true });
    }
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    
    // Clear any existing temp files
    this.clearTempFiles();
  }

  clearTempFiles() {
    const tempFiles = fs.readdirSync(this.tempDir);
    tempFiles.forEach(file => {
      fs.unlinkSync(path.join(this.tempDir, file));
    });
  }

  generateGameId(game) {
    const str = `${game.white}-${game.black}-${game.date}-${game.event}`;
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 12);
  }

  normalizePlayerName(name) {
    if (!name) return null;
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

  async saveBatch() {
    if (Object.keys(this.currentBatch.gameIds).length === 0) return;
    
    this.batchCount++;
    console.log(`  Saving batch ${this.batchCount} (${Object.keys(this.currentBatch.gameIds).length} games)...`);
    
    // Save each index type to a separate batch file
    const batchFiles = {
      players: `players-batch-${this.batchCount}.json`,
      events: `events-batch-${this.batchCount}.json`,
      years: `years-batch-${this.batchCount}.json`,
      openings: `openings-batch-${this.batchCount}.json`,
      timeControls: `timeControls-batch-${this.batchCount}.json`,
      gameIds: `gameIds-batch-${this.batchCount}.json`
    };
    
    for (const [indexType, fileName] of Object.entries(batchFiles)) {
      const filePath = path.join(this.tempDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(this.currentBatch[indexType]));
    }
    
    // Clear current batch
    this.currentBatch = {
      players: {},
      events: {},
      years: {},
      openings: {},
      timeControls: {},
      gameIds: {}
    };
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  async processGame(game, fileName, lineNumber) {
    const gameId = this.generateGameId(game);
    const gameRef = {
      file: fileName,
      line: lineNumber,
      gameId
    };
    
    // Store minimal game metadata
    this.currentBatch.gameIds[gameId] = {
      f: fileName,  // Use short keys to save memory
      l: lineNumber,
      w: game.white,
      b: game.black,
      d: game.date,
      e: game.event,
      r: game.result
    };
    
    // Index by players
    const whiteName = this.normalizePlayerName(game.white);
    const blackName = this.normalizePlayerName(game.black);
    if (whiteName) {
      this.addToIndex(this.currentBatch.players, whiteName, gameRef);
      this.stats.totalPlayers.add(whiteName);
    }
    if (blackName) {
      this.addToIndex(this.currentBatch.players, blackName, gameRef);
      this.stats.totalPlayers.add(blackName);
    }
    
    // Index by event
    if (game.event) {
      this.addToIndex(this.currentBatch.events, game.event.toLowerCase(), gameRef);
      this.stats.totalEvents.add(game.event);
    }
    
    // Index by year
    const year = this.extractYear(game.date);
    if (year) {
      this.addToIndex(this.currentBatch.years, year, gameRef);
      
      // Update date range
      if (!this.stats.dateRange.earliest || game.date < this.stats.dateRange.earliest) {
        this.stats.dateRange.earliest = game.date;
      }
      if (!this.stats.dateRange.latest || game.date > this.stats.dateRange.latest) {
        this.stats.dateRange.latest = game.date;
      }
    }
    
    // Index by opening
    if (game.eco) {
      this.addToIndex(this.currentBatch.openings, game.eco, gameRef);
    }
    
    // Index by time control category
    const timeCategory = this.categorizeTimeControl(game.timecontrol, game.event);
    this.addToIndex(this.currentBatch.timeControls, timeCategory, gameRef);
    
    this.totalGames++;
    
    // Save batch if it's full
    if (this.totalGames % this.batchSize === 0) {
      await this.saveBatch();
    }
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

    for await (const line of rl) {
      lineNumber++;
      
      if (line.startsWith('[')) {
        if (gameStartLine === 0) {
          gameStartLine = lineNumber;
        }
        
        const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
        if (match) {
          const [, key, value] = match;
          currentGame[key.toLowerCase()] = value;
        }
      } else if (line.trim() === '' && currentGame.white && currentGame.black) {
        // End of game headers, process the game
        await this.processGame(currentGame, fileName, gameStartLine);
        gamesInFile++;
        
        // Show progress
        if (gamesInFile % 10000 === 0) {
          process.stdout.write(`\r  Processed ${gamesInFile} games from ${fileName}...`);
        }
        
        // Reset for next game
        currentGame = {};
        gameStartLine = 0;
      }
    }

    console.log(`\r  Indexed ${gamesInFile} games from ${fileName}                    `);
    this.stats.filesProcessed++;
    
    return gamesInFile;
  }

  async mergeBatches() {
    console.log('\nMerging batch files...');
    
    const indexTypes = ['players', 'events', 'years', 'openings', 'timeControls', 'gameIds'];
    
    for (const indexType of indexTypes) {
      console.log(`  Merging ${indexType} index...`);
      
      const mergedIndex = {};
      let batchNum = 1;
      
      // Read and merge all batch files for this index type
      while (true) {
        const batchFile = path.join(this.tempDir, `${indexType}-batch-${batchNum}.json`);
        if (!fs.existsSync(batchFile)) break;
        
        const batchData = JSON.parse(fs.readFileSync(batchFile));
        
        // Merge the batch data
        if (indexType === 'gameIds') {
          // For gameIds, just merge objects
          Object.assign(mergedIndex, batchData);
        } else {
          // For others, merge arrays
          for (const [key, values] of Object.entries(batchData)) {
            if (!mergedIndex[key]) {
              mergedIndex[key] = [];
            }
            mergedIndex[key].push(...values);
          }
        }
        
        batchNum++;
        
        // Delete the batch file after merging to free disk space
        fs.unlinkSync(batchFile);
      }
      
      // Save the merged index
      const outputFile = path.join(this.indexDir, `${indexType}.json`);
      console.log(`    Saving to ${path.basename(outputFile)} (${Object.keys(mergedIndex).length} entries)`);
      
      // For large indexes, write in streaming fashion
      if (indexType === 'gameIds' || indexType === 'players') {
        const stream = fs.createWriteStream(outputFile);
        stream.write('{\n');
        
        const keys = Object.keys(mergedIndex);
        keys.forEach((key, index) => {
          const value = JSON.stringify(mergedIndex[key]);
          const comma = index < keys.length - 1 ? ',' : '';
          stream.write(`  "${key}": ${value}${comma}\n`);
          
          // Clear from memory after writing
          delete mergedIndex[key];
        });
        
        stream.write('}\n');
        stream.end();
        
        await new Promise(resolve => stream.on('finish', resolve));
      } else {
        fs.writeFileSync(outputFile, JSON.stringify(mergedIndex, null, 2));
      }
    }
  }

  async buildIndexes() {
    const pgnDir = path.join(__dirname, 'pgn-files');
    
    // Get all PGN files
    const pgnFiles = fs.readdirSync(pgnDir)
      .filter(f => f.endsWith('.pgn'))
      .sort();
    
    console.log(`Building indexes for ${pgnFiles.length} PGN files...`);
    console.log(`Using batch size: ${this.batchSize.toLocaleString()} games\n`);
    
    // Index each file
    for (const file of pgnFiles) {
      const filePath = path.join(pgnDir, file);
      await this.indexFile(filePath);
    }
    
    // Save any remaining games in the current batch
    await this.saveBatch();
    
    // Merge all batches into final indexes
    await this.mergeBatches();
    
    // Save statistics
    const elapsed = Date.now() - this.stats.startTime;
    const statsOutput = {
      totalGames: this.totalGames,
      totalPlayers: this.stats.totalPlayers.size,
      totalEvents: this.stats.totalEvents.size,
      filesProcessed: this.stats.filesProcessed,
      dateRange: this.stats.dateRange,
      indexingTime: `${Math.round(elapsed / 1000)} seconds`,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(
      path.join(this.indexDir, 'index-stats.json'),
      JSON.stringify(statsOutput, null, 2)
    );
    
    // Clean up temp directory
    this.clearTempFiles();
    
    console.log('\nIndexing complete!');
    console.log('='.repeat(50));
    console.log(`Total games indexed: ${this.totalGames.toLocaleString()}`);
    console.log(`Total unique players: ${this.stats.totalPlayers.size.toLocaleString()}`);
    console.log(`Total unique events: ${this.stats.totalEvents.size.toLocaleString()}`);
    console.log(`Date range: ${this.stats.dateRange.earliest} to ${this.stats.dateRange.latest}`);
    console.log(`Indexing time: ${Math.round(elapsed / 1000)} seconds`);
    console.log('='.repeat(50));
    
    return statsOutput;
  }
}

// Quick lookup class that uses the built indexes
class QuickLookup {
  constructor() {
    this.indexDir = path.join(__dirname, 'indexes');
    this.indexes = {};
    this.loaded = false;
  }

  async loadIndex(indexType) {
    if (this.indexes[indexType]) return this.indexes[indexType];
    
    const filePath = path.join(this.indexDir, `${indexType}.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`Index ${indexType} not found. Please run the indexer first.`);
      return null;
    }
    
    console.log(`Loading ${indexType} index...`);
    this.indexes[indexType] = JSON.parse(fs.readFileSync(filePath));
    return this.indexes[indexType];
  }

  async searchPlayer(name) {
    const players = await this.loadIndex('players');
    if (!players) return null;
    
    const normalized = name.toLowerCase().trim();
    
    // Exact match
    if (players[normalized]) {
      return {
        exact: [{
          name: normalized,
          games: players[normalized].length
        }],
        partial: []
      };
    }
    
    // Partial matches
    const partial = [];
    for (const [playerName, games] of Object.entries(players)) {
      if (playerName.includes(normalized)) {
        partial.push({
          name: playerName,
          games: games.length
        });
      }
      if (partial.length >= 20) break; // Limit results
    }
    
    return { exact: [], partial: partial.sort((a, b) => b.games - a.games) };
  }

  async getPlayerGames(name) {
    const players = await this.loadIndex('players');
    if (!players) return null;
    
    const normalized = name.toLowerCase().trim();
    return players[normalized] || null;
  }

  async getStats() {
    const statsPath = path.join(this.indexDir, 'index-stats.json');
    if (!fs.existsSync(statsPath)) return null;
    return JSON.parse(fs.readFileSync(statsPath));
  }
}

// Main execution
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'search') {
    // Search mode
    const lookup = new QuickLookup();
    const query = process.argv.slice(3).join(' ');
    
    lookup.searchPlayer(query).then(results => {
      if (!results) return;
      
      if (results.exact.length > 0) {
        console.log('\nExact matches:');
        results.exact.forEach(r => {
          console.log(`  ${r.name}: ${r.games} games`);
        });
      }
      
      if (results.partial.length > 0) {
        console.log('\nPartial matches:');
        results.partial.slice(0, 10).forEach(r => {
          console.log(`  ${r.name}: ${r.games} games`);
        });
      }
      
      if (results.exact.length === 0 && results.partial.length === 0) {
        console.log(`No players found matching "${query}"`);
      }
    });
  } else if (command === 'stats') {
    // Show statistics
    const lookup = new QuickLookup();
    lookup.getStats().then(stats => {
      if (stats) {
        console.log('\nDatabase Statistics:');
        console.log('='.repeat(40));
        console.log(`Total games: ${stats.totalGames?.toLocaleString()}`);
        console.log(`Total players: ${stats.totalPlayers?.toLocaleString()}`);
        console.log(`Total events: ${stats.totalEvents?.toLocaleString()}`);
        console.log(`Date range: ${stats.dateRange?.earliest} to ${stats.dateRange?.latest}`);
        console.log(`Indexed on: ${stats.timestamp}`);
      }
    });
  } else {
    // Build indexes
    console.log('Starting batch indexing...\n');
    const indexer = new BatchIndexer(50000); // 50k games per batch
    indexer.buildIndexes().catch(console.error);
  }
}

module.exports = { BatchIndexer, QuickLookup };