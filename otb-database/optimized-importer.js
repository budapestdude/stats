const fs = require('fs');
const path = require('path');
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

class OptimizedPGNImporter {
  constructor(dbPath, options = {}) {
    this.dbPath = dbPath;
    this.options = {
      batchSize: options.batchSize || 1000,
      checkpointInterval: options.checkpointInterval || 10000,
      maxMemory: options.maxMemory || 512 * 1024 * 1024, // 512MB
      skipDuplicates: options.skipDuplicates !== false,
      verbose: options.verbose || false,
      ...options
    };
    
    this.stats = {
      totalGames: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
      startTime: null,
      checkpoints: []
    };
    
    this.currentBatch = [];
    this.gameBuffer = [];
    this.isProcessing = false;
  }
  
  async initialize() {
    return new Promise((resolve, reject) => {
      // Open database with optimized settings
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Enable optimizations for bulk insert
        this.db.serialize(() => {
          this.db.run('PRAGMA journal_mode = WAL');
          this.db.run('PRAGMA synchronous = NORMAL');
          this.db.run('PRAGMA cache_size = -128000'); // 128MB cache
          this.db.run('PRAGMA temp_store = MEMORY');
          this.db.run('PRAGMA page_size = 4096');
          this.db.run('PRAGMA mmap_size = 536870912'); // 512MB mmap
          this.db.run('PRAGMA threads = 4');
          
          // Create tables if they don't exist
          this.db.run(`
            CREATE TABLE IF NOT EXISTS games (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              event TEXT,
              site TEXT,
              date TEXT,
              round TEXT,
              white TEXT,
              white_original TEXT,
              black TEXT,
              black_original TEXT,
              result TEXT,
              white_elo INTEGER,
              black_elo INTEGER,
              eco TEXT,
              opening TEXT,
              variation TEXT,
              moves TEXT,
              ply_count INTEGER,
              time_control TEXT,
              termination TEXT,
              game_hash TEXT UNIQUE,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `, (err) => {
            if (err) {
              reject(err);
            } else {
              // Create indexes for fast lookups
              this.createIndexes().then(resolve).catch(reject);
            }
          });
        });
      });
    });
  }
  
  async createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_games_hash ON games(game_hash)',
      'CREATE INDEX IF NOT EXISTS idx_games_white ON games(white)',
      'CREATE INDEX IF NOT EXISTS idx_games_black ON games(black)',
      'CREATE INDEX IF NOT EXISTS idx_games_date ON games(date)',
      'CREATE INDEX IF NOT EXISTS idx_games_event ON games(event)',
      'CREATE INDEX IF NOT EXISTS idx_games_eco ON games(eco)'
    ];
    
    for (const index of indexes) {
      await this.runQuery(index);
    }
  }
  
  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }
  
  generateGameHash(game) {
    // Create unique hash based on key game attributes
    const hashStr = `${game.white}|${game.black}|${game.date}|${game.event}|${game.moves?.substring(0, 50)}`;
    return crypto.createHash('md5').update(hashStr).digest('hex');
  }
  
  normalizePlayerName(name) {
    if (!name) return '';
    // Remove titles and normalize
    return name.replace(/^(GM|IM|FM|WGM|WIM|WFM|CM|WCM|NM)\s+/i, '')
               .trim()
               .replace(/\s+/g, ' ');
  }
  
  parseGame(gameText) {
    const game = {
      headers: {},
      moves: ''
    };
    
    // Parse headers
    const headerRegex = /\[(\w+)\s+"([^"]+)"\]/g;
    let match;
    while ((match = headerRegex.exec(gameText)) !== null) {
      game.headers[match[1]] = match[2];
    }
    
    // Parse moves (everything after headers)
    const movesStart = gameText.lastIndexOf(']');
    if (movesStart !== -1) {
      game.moves = gameText.substring(movesStart + 1)
        .replace(/\{[^}]*\}/g, '') // Remove comments
        .replace(/\([^)]*\)/g, '') // Remove variations
        .replace(/\d+\./g, '') // Remove move numbers
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    return game;
  }
  
  async processGame(gameText) {
    try {
      const parsed = this.parseGame(gameText);
      const headers = parsed.headers;
      
      // Extract and normalize data
      const game = {
        event: headers.Event || '',
        site: headers.Site || '',
        date: headers.Date || '',
        round: headers.Round || '',
        white: this.normalizePlayerName(headers.White),
        white_original: headers.White || '',
        black: this.normalizePlayerName(headers.Black),
        black_original: headers.Black || '',
        result: headers.Result || '',
        white_elo: parseInt(headers.WhiteElo) || null,
        black_elo: parseInt(headers.BlackElo) || null,
        eco: headers.ECO || '',
        opening: headers.Opening || '',
        variation: headers.Variation || '',
        moves: parsed.moves,
        ply_count: parseInt(headers.PlyCount) || null,
        time_control: headers.TimeControl || '',
        termination: headers.Termination || '',
        game_hash: null
      };
      
      // Generate hash for duplicate detection
      game.game_hash = this.generateGameHash(game);
      
      // Add to batch
      this.currentBatch.push(game);
      
      // Process batch if full
      if (this.currentBatch.length >= this.options.batchSize) {
        await this.processBatch();
      }
      
      this.stats.totalGames++;
      
      // Checkpoint progress
      if (this.stats.totalGames % this.options.checkpointInterval === 0) {
        await this.checkpoint();
      }
      
    } catch (err) {
      this.stats.errors++;
      if (this.options.verbose) {
        console.error('Error processing game:', err.message);
      }
    }
  }
  
  async processBatch() {
    if (this.currentBatch.length === 0) return;
    
    const batch = this.currentBatch;
    this.currentBatch = [];
    
    return new Promise((resolve) => {
      this.db.serialize(() => {
        const stmt = this.db.prepare(`
          INSERT OR IGNORE INTO games (
            event, site, date, round, white, white_original, black, black_original,
            result, white_elo, black_elo, eco, opening, variation, moves,
            ply_count, time_control, termination, game_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        let imported = 0;
        
        for (const game of batch) {
          stmt.run([
            game.event, game.site, game.date, game.round,
            game.white, game.white_original, game.black, game.black_original,
            game.result, game.white_elo, game.black_elo,
            game.eco, game.opening, game.variation, game.moves,
            game.ply_count, game.time_control, game.termination, game.game_hash
          ], function(err) {
            if (!err && this.changes > 0) {
              imported++;
            }
          });
        }
        
        stmt.finalize(() => {
          this.stats.imported += imported;
          this.stats.skipped += batch.length - imported;
          resolve();
        });
      });
    });
  }
  
  async checkpoint() {
    const elapsed = Date.now() - this.stats.startTime;
    const gamesPerSecond = Math.round(this.stats.totalGames / (elapsed / 1000));
    
    const checkpoint = {
      timestamp: new Date().toISOString(),
      totalGames: this.stats.totalGames,
      imported: this.stats.imported,
      skipped: this.stats.skipped,
      errors: this.stats.errors,
      elapsed: elapsed,
      gamesPerSecond: gamesPerSecond
    };
    
    this.stats.checkpoints.push(checkpoint);
    
    console.log(`[Checkpoint] Games: ${this.stats.totalGames.toLocaleString()} | Imported: ${this.stats.imported.toLocaleString()} | Speed: ${gamesPerSecond}/sec`);
    
    // Save checkpoint to file
    const checkpointFile = path.join(path.dirname(this.dbPath), 'import-checkpoint.json');
    fs.writeFileSync(checkpointFile, JSON.stringify(this.stats, null, 2));
  }
  
  async importPGNFile(filePath) {
    console.log(`\n📂 Importing: ${path.basename(filePath)}`);
    const fileSize = fs.statSync(filePath).size;
    console.log(`   File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
      });
      
      let currentGame = [];
      let isInGame = false;
      
      rl.on('line', async (line) => {
        // Check if line starts a new game
        if (line.startsWith('[Event ')) {
          // Process previous game if exists
          if (currentGame.length > 0) {
            await this.processGame(currentGame.join('\n'));
          }
          currentGame = [line];
          isInGame = true;
        } else if (isInGame) {
          currentGame.push(line);
        }
      });
      
      rl.on('close', async () => {
        // Process last game
        if (currentGame.length > 0) {
          await this.processGame(currentGame.join('\n'));
        }
        
        // Process remaining batch
        await this.processBatch();
        
        console.log(`   ✓ Completed: ${path.basename(filePath)}`);
        resolve();
      });
      
      rl.on('error', reject);
    });
  }
  
  async importDirectory(dirPath) {
    await this.initialize();
    
    this.stats.startTime = Date.now();
    
    const files = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.pgn'))
      .map(f => path.join(dirPath, f))
      .sort();
    
    console.log(`\n🚀 Starting import of ${files.length} PGN files`);
    console.log('=' .repeat(50));
    
    for (const file of files) {
      await this.importPGNFile(file);
    }
    
    // Final checkpoint
    await this.checkpoint();
    
    // Run ANALYZE to update statistics
    console.log('\n📊 Updating database statistics...');
    await this.runQuery('ANALYZE');
    
    const elapsed = Date.now() - this.stats.startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ Import Complete!');
    console.log(`   Total games processed: ${this.stats.totalGames.toLocaleString()}`);
    console.log(`   Games imported: ${this.stats.imported.toLocaleString()}`);
    console.log(`   Duplicates skipped: ${this.stats.skipped.toLocaleString()}`);
    console.log(`   Errors: ${this.stats.errors}`);
    console.log(`   Time: ${minutes}m ${seconds}s`);
    console.log(`   Average speed: ${Math.round(this.stats.totalGames / (elapsed / 1000))} games/sec`);
    
    this.close();
  }
  
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

// Usage
if (require.main === module) {
  const importer = new OptimizedPGNImporter(
    path.join(__dirname, 'chess-stats-10m.db'),
    {
      batchSize: 1000,
      checkpointInterval: 50000,
      verbose: true
    }
  );
  
  const pgnDir = path.join(__dirname, 'pgn-files');
  
  importer.importDirectory(pgnDir).catch(console.error);
}

module.exports = OptimizedPGNImporter;