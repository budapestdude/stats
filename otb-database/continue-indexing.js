const fs = require('fs');
const readline = require('readline');
const path = require('path');

class ContinuedBatchIndexer {
  constructor(startBatch = 157, batchSize = 50000) {
    this.batchSize = batchSize;
    this.batchNumber = startBatch;
    this.tempDir = path.join(__dirname, 'indexes', 'temp');
    
    this.currentBatches = {
      players: new Map(),
      events: new Map(),
      openings: new Map(),
      timeControls: new Map(),
      gameIds: new Set()
    };
    
    this.gameCount = 0;
    this.totalGamesProcessed = startBatch * batchSize; // Approximate games already processed
    
    // Files to process
    this.filesToProcess = [
      { name: 'LumbrasGigaBase_OTB_2015-2019.pgn', skipLines: 1560000 }, // Skip ~780k games already processed
      { name: 'LumbrasGigaBase_OTB_2020-2024.pgn', skipLines: 0 },
      { name: 'lumbrasgigabase_2025.pgn', skipLines: 0 },
      { name: 'classic_games.pgn', skipLines: 0 },
      { name: 'world_champions.pgn', skipLines: 0 }
    ];
    
    console.log(`Continuing indexing from batch ${this.batchNumber}`);
    console.log(`Approximately ${this.totalGamesProcessed.toLocaleString()} games already indexed`);
  }

  async processFiles() {
    for (const fileInfo of this.filesToProcess) {
      const filePath = path.join(__dirname, 'pgn-files', fileInfo.name);
      
      if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${fileInfo.name}, skipping...`);
        continue;
      }
      
      console.log(`\nProcessing ${fileInfo.name}...`);
      if (fileInfo.skipLines > 0) {
        console.log(`Skipping first ${fileInfo.skipLines.toLocaleString()} lines...`);
      }
      
      await this.processFile(filePath, fileInfo.skipLines);
    }
    
    // Save any remaining data
    if (this.gameCount > 0) {
      await this.saveBatch();
    }
    
    console.log('\n=== Indexing Complete ===');
    console.log(`Total batches created: ${this.batchNumber - 1}`);
    console.log(`Total games processed: ${this.totalGamesProcessed.toLocaleString()}`);
    console.log('\nNext step: Run merge-indexes.js to combine all batch files');
  }

  async processFile(filePath, skipLines = 0) {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let currentGame = [];
      let inGame = false;
      let lineNumber = 0;
      let skippedLines = 0;
      let localGameCount = 0;

      rl.on('line', (line) => {
        lineNumber++;
        
        // Skip lines if needed
        if (lineNumber <= skipLines) {
          skippedLines++;
          if (skippedLines % 100000 === 0) {
            console.log(`Skipped ${skippedLines.toLocaleString()} lines...`);
          }
          return;
        }

        // Check if we're starting a new game
        if (line.startsWith('[Event ')) {
          if (currentGame.length > 0) {
            this.processGame(currentGame);
            localGameCount++;
            
            if (localGameCount % 10000 === 0) {
              console.log(`Processed ${localGameCount.toLocaleString()} games from current file...`);
            }
            
            // Check if we need to save a batch
            if (this.gameCount >= this.batchSize) {
              this.saveBatch().then(() => {
                console.log(`Batch ${this.batchNumber - 1} saved. Starting batch ${this.batchNumber}...`);
              });
            }
          }
          currentGame = [line];
          inGame = true;
        } else if (inGame) {
          currentGame.push(line);
        }
      });

      rl.on('close', () => {
        // Process the last game
        if (currentGame.length > 0) {
          this.processGame(currentGame);
        }
        
        console.log(`Finished processing ${path.basename(filePath)}: ${localGameCount.toLocaleString()} games`);
        resolve();
      });

      rl.on('error', reject);
    });
  }

  processGame(gameLines) {
    const game = {};
    let moveText = [];
    
    for (const line of gameLines) {
      if (line.startsWith('[')) {
        const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
        if (match) {
          game[match[1]] = match[2];
        }
      } else if (line.trim() && !line.startsWith('[')) {
        moveText.push(line);
      }
    }
    
    // Extract opening from moves
    const moves = moveText.join(' ');
    const opening = this.extractOpening(moves);
    
    // Categorize time control
    const timeControl = this.categorizeTimeControl(game.TimeControl, game.Event);
    
    // Update indexes
    if (game.White) {
      this.currentBatches.players.set(game.White, 
        (this.currentBatches.players.get(game.White) || 0) + 1);
    }
    if (game.Black) {
      this.currentBatches.players.set(game.Black, 
        (this.currentBatches.players.get(game.Black) || 0) + 1);
    }
    if (game.Event) {
      this.currentBatches.events.set(game.Event, 
        (this.currentBatches.events.get(game.Event) || 0) + 1);
    }
    if (opening) {
      this.currentBatches.openings.set(opening, 
        (this.currentBatches.openings.get(opening) || 0) + 1);
    }
    if (timeControl) {
      this.currentBatches.timeControls.set(timeControl, 
        (this.currentBatches.timeControls.get(timeControl) || 0) + 1);
    }
    
    // Create unique game ID
    const gameId = `${game.Event || 'Unknown'}_${game.Date || '????'}_${game.White || '?'}_${game.Black || '?'}`;
    this.currentBatches.gameIds.add(gameId);
    
    this.gameCount++;
    this.totalGamesProcessed++;
  }

  extractOpening(moves) {
    const firstMoves = moves.split(/\s+/).slice(0, 10).join(' ');
    
    if (firstMoves.includes('e4')) {
      if (firstMoves.includes('e5')) {
        if (firstMoves.includes('Nf3') && firstMoves.includes('Nc6') && firstMoves.includes('Bb5')) {
          return 'Ruy Lopez';
        } else if (firstMoves.includes('Nf3') && firstMoves.includes('Nc6') && firstMoves.includes('Bc4')) {
          return 'Italian Game';
        }
        return 'Kings Pawn Opening';
      } else if (firstMoves.includes('c5')) {
        return 'Sicilian Defense';
      } else if (firstMoves.includes('e6')) {
        return 'French Defense';
      } else if (firstMoves.includes('c6')) {
        return 'Caro-Kann Defense';
      }
    } else if (firstMoves.includes('d4')) {
      if (firstMoves.includes('d5')) {
        if (firstMoves.includes('c4')) {
          return 'Queens Gambit';
        }
        return 'Queens Pawn Opening';
      } else if (firstMoves.includes('Nf6')) {
        if (firstMoves.includes('g6')) {
          return 'Kings Indian Defense';
        } else if (firstMoves.includes('e6')) {
          return 'Nimzo-Indian Defense';
        }
        return 'Indian Defense';
      }
    } else if (firstMoves.includes('Nf3')) {
      if (firstMoves.includes('d5')) {
        return 'Reti Opening';
      }
      return 'Kings Knight Opening';
    } else if (firstMoves.includes('c4')) {
      return 'English Opening';
    }
    
    return 'Other Opening';
  }

  categorizeTimeControl(timeControl, eventName) {
    if (eventName) {
      const eventLower = eventName.toLowerCase();
      if (eventLower.includes('blitz') || eventLower.includes('bullet')) {
        return 'blitz';
      }
      if (eventLower.includes('rapid')) {
        return 'rapid';
      }
      if (eventLower.includes('classical') || eventLower.includes('standard')) {
        return 'classical';
      }
    }
    
    if (!timeControl || timeControl === '-' || timeControl === '?') {
      return 'classical'; // Default for OTB games without time control
    }
    
    // Parse time control format
    const tcMatch = timeControl.match(/^(\d+)(?:\+(\d+))?$/);
    if (tcMatch) {
      const baseTime = parseInt(tcMatch[1]);
      const increment = parseInt(tcMatch[2] || '0');
      const totalTime = baseTime + (increment * 40);
      
      if (totalTime < 600) return 'blitz';
      if (totalTime < 1800) return 'rapid';
      return 'classical';
    }
    
    return 'classical';
  }

  async saveBatch() {
    const batchData = {
      batchNumber: this.batchNumber,
      gameCount: this.gameCount,
      timestamp: new Date().toISOString()
    };

    // Save each index type
    const saves = [
      this.saveIndex('players', this.currentBatches.players),
      this.saveIndex('events', this.currentBatches.events),
      this.saveIndex('openings', this.currentBatches.openings),
      this.saveIndex('timeControls', this.currentBatches.timeControls),
      this.saveIndex('gameIds', this.currentBatches.gameIds)
    ];

    await Promise.all(saves);

    // Reset for next batch
    this.currentBatches.players.clear();
    this.currentBatches.events.clear();
    this.currentBatches.openings.clear();
    this.currentBatches.timeControls.clear();
    this.currentBatches.gameIds.clear();
    this.gameCount = 0;
    this.batchNumber++;
  }

  async saveIndex(type, data) {
    const filePath = path.join(this.tempDir, `${type}-batch-${this.batchNumber}.json`);
    
    let dataToSave;
    if (data instanceof Set) {
      dataToSave = Array.from(data);
    } else if (data instanceof Map) {
      dataToSave = Object.fromEntries(data);
    } else {
      dataToSave = data;
    }

    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, JSON.stringify(dataToSave), (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

// Run the indexer
const indexer = new ContinuedBatchIndexer(157);
indexer.processFiles().catch(console.error);