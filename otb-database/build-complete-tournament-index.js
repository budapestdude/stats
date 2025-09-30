const fs = require('fs');
const path = require('path');
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();

// Create new database for complete tournament data
const db = new sqlite3.Database('./complete-tournaments.db');

// Create tables
db.serialize(() => {
  // Tournament index table - tracks all tournaments across all files
  db.run(`
    CREATE TABLE IF NOT EXISTS tournament_index (
      tournament_name TEXT PRIMARY KEY,
      total_games INTEGER DEFAULT 0,
      total_players INTEGER DEFAULT 0,
      files_found_in TEXT,
      location TEXT,
      start_date TEXT,
      end_date TEXT,
      processed BOOLEAN DEFAULT 0
    )
  `);

  // Games table - stores all games for processing
  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_name TEXT,
      white_player TEXT,
      black_player TEXT,
      result TEXT,
      date TEXT,
      round TEXT,
      eco TEXT,
      opening TEXT,
      ply_count INTEGER,
      pgn_file TEXT,
      FOREIGN KEY (tournament_name) REFERENCES tournament_index(tournament_name)
    )
  `);

  // Create indexes for performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_games_tournament ON games(tournament_name)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_games_players ON games(white_player, black_player)`);
});

class TournamentIndexBuilder {
  constructor() {
    this.currentFile = '';
    this.processedGames = 0;
    this.tournamentsFound = new Set();
    this.batchSize = 10000;
    this.gamesBatch = [];
  }

  async indexFile(filePath) {
    this.currentFile = path.basename(filePath);
    console.log(`\nIndexing: ${this.currentFile}`);
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentHeaders = {};
    let lineCount = 0;

    for await (const line of rl) {
      lineCount++;
      
      if (line.startsWith('[')) {
        const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
        if (match) {
          currentHeaders[match[1]] = match[2];
        }
      } else if (line.trim() === '' && currentHeaders.Event) {
        // End of headers, we have a complete game
        await this.indexGame(currentHeaders);
        currentHeaders = {};
        
        if (this.processedGames % 10000 === 0) {
          console.log(`  Processed ${this.processedGames} games, found ${this.tournamentsFound.size} unique tournaments`);
        }
      }
    }

    // Process last game if exists
    if (currentHeaders.Event) {
      await this.indexGame(currentHeaders);
    }

    // Flush remaining batch
    if (this.gamesBatch.length > 0) {
      await this.flushGamesBatch();
    }

    console.log(`  ✓ Completed: ${this.processedGames} games indexed`);
  }

  async indexGame(headers) {
    const tournamentName = headers.Event?.trim();
    if (!tournamentName) return;

    // Add to tournament index
    if (!this.tournamentsFound.has(tournamentName)) {
      this.tournamentsFound.add(tournamentName);
      
      // Update or insert tournament in index
      db.run(`
        INSERT OR IGNORE INTO tournament_index (tournament_name, location, start_date)
        VALUES (?, ?, ?)
      `, [tournamentName, headers.Site || null, headers.Date || null]);
    }

    // Update tournament stats
    db.run(`
      UPDATE tournament_index 
      SET 
        total_games = total_games + 1,
        files_found_in = CASE 
          WHEN files_found_in IS NULL THEN ?
          WHEN files_found_in NOT LIKE '%' || ? || '%' THEN files_found_in || ',' || ?
          ELSE files_found_in
        END
      WHERE tournament_name = ?
    `, [this.currentFile, this.currentFile, this.currentFile, tournamentName]);

    // Add game to batch
    this.gamesBatch.push([
      tournamentName,
      headers.White || null,
      headers.Black || null,
      headers.Result || '*',
      headers.Date || null,
      headers.Round || null,
      headers.ECO || null,
      headers.Opening || null,
      parseInt(headers.PlyCount) || null,
      this.currentFile
    ]);

    this.processedGames++;

    // Flush batch if it's full
    if (this.gamesBatch.length >= this.batchSize) {
      await this.flushGamesBatch();
    }
  }

  async flushGamesBatch() {
    if (this.gamesBatch.length === 0) return;

    return new Promise((resolve) => {
      const stmt = db.prepare(`
        INSERT INTO games (tournament_name, white_player, black_player, result, date, round, eco, opening, ply_count, pgn_file)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        this.gamesBatch.forEach(game => {
          stmt.run(...game);
        });
        
        db.run('COMMIT', () => {
          stmt.finalize();
          this.gamesBatch = [];
          resolve();
        });
      });
    });
  }

  async buildIndex() {
    const pgnDir = path.join(__dirname, 'pgn-files');
    const pgnFiles = fs.readdirSync(pgnDir)
      .filter(f => f.endsWith('.pgn'))
      .sort(); // Process in order

    console.log('='.repeat(60));
    console.log('BUILDING COMPLETE TOURNAMENT INDEX');
    console.log('='.repeat(60));
    console.log(`Found ${pgnFiles.length} PGN files to index\n`);

    for (const file of pgnFiles) {
      const filePath = path.join(pgnDir, file);
      const stats = fs.statSync(filePath);
      const sizeMB = Math.round(stats.size / (1024 * 1024));
      
      console.log(`File: ${file} (${sizeMB} MB)`);
      
      try {
        await this.indexFile(filePath);
      } catch (error) {
        console.error(`Error processing ${file}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('INDEX BUILDING COMPLETE');
    console.log('='.repeat(60));
    
    // Get statistics
    return new Promise((resolve) => {
      db.get(`
        SELECT 
          COUNT(DISTINCT tournament_name) as total_tournaments,
          COUNT(*) as total_games
        FROM games
      `, (err, stats) => {
        if (!err && stats) {
          console.log(`\nIndexed:`);
          console.log(`  ${stats.total_tournaments} unique tournaments`);
          console.log(`  ${stats.total_games} total games`);
          
          // Show distribution
          db.all(`
            SELECT 
              CASE 
                WHEN total_games < 50 THEN '< 50'
                WHEN total_games < 100 THEN '50-99'
                WHEN total_games < 500 THEN '100-499'
                WHEN total_games < 1000 THEN '500-999'
                WHEN total_games < 5000 THEN '1000-4999'
                ELSE '5000+'
              END as range,
              COUNT(*) as count
            FROM tournament_index
            GROUP BY range
            ORDER BY MIN(total_games)
          `, (err2, dist) => {
            if (!err2 && dist) {
              console.log('\nTournament size distribution:');
              dist.forEach(d => {
                console.log(`  ${d.range.padEnd(10)} games: ${d.count} tournaments`);
              });
            }
            resolve();
          });
        } else {
          resolve();
        }
      });
    });
  }
}

// Run the indexer
async function main() {
  const indexer = new TournamentIndexBuilder();
  await indexer.buildIndex();
  
  console.log('\nIndex database created: complete-tournaments.db');
  console.log('Next step: Process tournaments to build complete crosstables');
  
  db.close();
}

main().catch(console.error);