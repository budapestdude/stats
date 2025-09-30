const fs = require('fs');
const path = require('path');
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

class SingleFileImporter {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.stats = {
      imported: 0,
      skipped: 0,
      errors: 0
    };
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.db.serialize(() => {
          // Enable optimizations
          this.db.run('PRAGMA journal_mode = WAL');
          this.db.run('PRAGMA synchronous = NORMAL');
          this.db.run('PRAGMA cache_size = -64000');
          this.db.run('PRAGMA temp_store = MEMORY');
          
          // Create tables
          this.db.run(`
            CREATE TABLE IF NOT EXISTS games (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              event TEXT,
              site TEXT,
              date TEXT,
              round TEXT,
              white TEXT,
              black TEXT,
              result TEXT,
              white_elo INTEGER,
              black_elo INTEGER,
              eco TEXT,
              opening TEXT,
              moves TEXT,
              ply_count INTEGER,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
          
          // Create basic indexes
          this.db.run('CREATE INDEX IF NOT EXISTS idx_games_white ON games(white)');
          this.db.run('CREATE INDEX IF NOT EXISTS idx_games_black ON games(black)');
          this.db.run('CREATE INDEX IF NOT EXISTS idx_games_date ON games(date)');
          this.db.run('CREATE INDEX IF NOT EXISTS idx_games_event ON games(event)', resolve);
        });
      });
    });
  }

  parsePGNGame(gameText) {
    const game = {};
    const tagRegex = /\[(\w+)\s+"([^"]*)"\]/g;
    let match;
    
    while ((match = tagRegex.exec(gameText)) !== null) {
      game[match[1].toLowerCase()] = match[2];
    }
    
    // Extract moves (everything after the last tag)
    const movesMatch = gameText.match(/\n\n([\s\S]+?)(?:\n\n|\s*$)/);
    if (movesMatch) {
      game.moves = movesMatch[1].replace(/\s+/g, ' ').trim();
      // Count ply (half-moves)
      const moveNumbers = game.moves.match(/\d+\./g);
      game.ply_count = moveNumbers ? moveNumbers.length * 2 : 0;
    }
    
    return game;
  }

  async importFile(filePath) {
    console.log(`\nImporting: ${path.basename(filePath)}`);
    const startTime = Date.now();
    
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentGame = '';
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO games (
        event, site, date, round, white, black, result,
        white_elo, black_elo, eco, opening, moves, ply_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for await (const line of rl) {
      if (line.startsWith('[Event ') && currentGame) {
        // Process previous game
        try {
          const game = this.parsePGNGame(currentGame);
          stmt.run(
            game.event || '',
            game.site || '',
            game.date || '',
            game.round || '',
            game.white || '',
            game.black || '',
            game.result || '',
            parseInt(game.whiteelo) || null,
            parseInt(game.blackelo) || null,
            game.eco || '',
            game.opening || '',
            game.moves || '',
            game.ply_count || 0
          );
          this.stats.imported++;
          
          if (this.stats.imported % 100 === 0) {
            process.stdout.write(`\rImported: ${this.stats.imported} games`);
          }
        } catch (err) {
          this.stats.errors++;
        }
        currentGame = '';
      }
      currentGame += line + '\n';
    }

    // Process last game
    if (currentGame.trim()) {
      try {
        const game = this.parsePGNGame(currentGame);
        stmt.run(
          game.event || '',
          game.site || '',
          game.date || '',
          game.round || '',
          game.white || '',
          game.black || '',
          game.result || '',
          parseInt(game.whiteelo) || null,
          parseInt(game.blackelo) || null,
          game.eco || '',
          game.opening || '',
          game.moves || '',
          game.ply_count || 0
        );
        this.stats.imported++;
      } catch (err) {
        this.stats.errors++;
      }
    }

    stmt.finalize();
    
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Import complete!`);
    console.log(`   Games imported: ${this.stats.imported}`);
    console.log(`   Errors: ${this.stats.errors}`);
    console.log(`   Time: ${elapsed.toFixed(1)}s`);
    console.log(`   Speed: ${(this.stats.imported / elapsed).toFixed(0)} games/sec`);
  }

  close() {
    this.db.close();
  }
}

// Usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node import-single-file.js <pgn-file>');
    process.exit(1);
  }
  
  const pgnFile = args[0];
  const dbPath = path.join(__dirname, '..', 'chess-stats.db');
  
  if (!fs.existsSync(pgnFile)) {
    console.error(`File not found: ${pgnFile}`);
    process.exit(1);
  }
  
  const importer = new SingleFileImporter(dbPath);
  
  importer.initialize()
    .then(() => importer.importFile(pgnFile))
    .then(() => importer.close())
    .catch(console.error);
}

module.exports = SingleFileImporter;