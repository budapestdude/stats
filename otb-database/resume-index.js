const fs = require('fs');
const path = require('path');
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();

// Connect to existing database
const db = new sqlite3.Database('./complete-tournaments.db');

class TournamentIndexResumer {
  constructor() {
    this.currentFile = '';
    this.processedGames = 0;
    this.tournamentsFound = new Set();
    this.batchSize = 10000;
    this.gamesBatch = [];
    this.totalGamesProcessed = 0;
  }

  async loadExistingTournaments() {
    console.log('Loading existing tournament names from database...');
    return new Promise((resolve) => {
      db.all(`SELECT DISTINCT tournament_name FROM tournament_index`, (err, rows) => {
        if (!err && rows) {
          rows.forEach(row => {
            this.tournamentsFound.add(row.tournament_name);
          });
          console.log(`Loaded ${this.tournamentsFound.size} existing tournaments`);
        }
        
        // Get total games already processed
        db.get(`SELECT COUNT(*) as count FROM games`, (err2, result) => {
          if (!err2 && result) {
            this.totalGamesProcessed = result.count;
            console.log(`Already processed ${this.totalGamesProcessed.toLocaleString()} games`);
          }
          resolve();
        });
      });
    });
  }

  async getProcessedFiles() {
    return new Promise((resolve) => {
      db.all(`
        SELECT DISTINCT pgn_file 
        FROM games 
        GROUP BY pgn_file 
        HAVING COUNT(*) > 100000
      `, (err, rows) => {
        const processedFiles = new Set();
        if (!err && rows) {
          rows.forEach(row => {
            processedFiles.add(row.pgn_file);
          });
        }
        resolve(processedFiles);
      });
    });
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
    let fileGames = 0;

    for await (const line of rl) {
      if (line.startsWith('[')) {
        const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
        if (match) {
          currentHeaders[match[1]] = match[2];
        }
      } else if (line.trim() === '' && currentHeaders.Event) {
        await this.indexGame(currentHeaders);
        currentHeaders = {};
        fileGames++;
        this.processedGames++;
        this.totalGamesProcessed++;
        
        if (this.processedGames % 10000 === 0) {
          console.log(`  Processed ${this.totalGamesProcessed.toLocaleString()} total games, found ${this.tournamentsFound.size} unique tournaments`);
          
          // Clear tournament set periodically to prevent memory issues
          if (this.tournamentsFound.size > 100000) {
            console.log('  Clearing tournament name cache to free memory...');
            this.tournamentsFound.clear();
            // Reload just recent tournaments to maintain uniqueness check
            await this.loadRecentTournaments();
          }
        }
      }
    }

    if (currentHeaders.Event) {
      await this.indexGame(currentHeaders);
      fileGames++;
    }

    if (this.gamesBatch.length > 0) {
      await this.flushGamesBatch();
    }

    console.log(`  ✓ Completed: ${fileGames} games from this file`);
  }

  async loadRecentTournaments() {
    return new Promise((resolve) => {
      // Only load tournament names from recent games to maintain uniqueness
      db.all(`
        SELECT DISTINCT tournament_name 
        FROM (
          SELECT tournament_name FROM games 
          ORDER BY id DESC 
          LIMIT 100000
        )
      `, (err, rows) => {
        if (!err && rows) {
          rows.forEach(row => {
            this.tournamentsFound.add(row.tournament_name);
          });
        }
        resolve();
      });
    });
  }

  async indexGame(headers) {
    const tournamentName = headers.Event?.trim();
    if (!tournamentName) return;

    if (!this.tournamentsFound.has(tournamentName)) {
      this.tournamentsFound.add(tournamentName);
      
      db.run(`
        INSERT OR IGNORE INTO tournament_index (tournament_name, location, start_date)
        VALUES (?, ?, ?)
      `, [tournamentName, headers.Site || null, headers.Date || null]);
    }

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

  async resumeIndexing() {
    // Load existing data
    await this.loadExistingTournaments();
    
    const pgnDir = path.join(__dirname, 'pgn-files');
    const allFiles = fs.readdirSync(pgnDir)
      .filter(f => f.endsWith('.pgn'))
      .sort();

    // Get list of fully processed files
    const processedFiles = await this.getProcessedFiles();
    
    // Files to process (skip those already done)
    const remainingFiles = allFiles.filter(f => !processedFiles.has(f));

    console.log('\n' + '='.repeat(60));
    console.log('RESUMING TOURNAMENT INDEX');
    console.log('='.repeat(60));
    console.log(`Total files: ${allFiles.length}`);
    console.log(`Already processed: ${processedFiles.size}`);
    console.log(`Remaining files: ${remainingFiles.length}`);
    
    if (remainingFiles.length > 0) {
      console.log('\nFiles to process:');
      remainingFiles.forEach(f => {
        const filePath = path.join(pgnDir, f);
        const stats = fs.statSync(filePath);
        const sizeMB = Math.round(stats.size / (1024 * 1024));
        console.log(`  - ${f} (${sizeMB} MB)`);
      });
    }

    for (const file of remainingFiles) {
      const filePath = path.join(pgnDir, file);
      console.log('\n' + '-'.repeat(60));
      
      try {
        await this.indexFile(filePath);
      } catch (error) {
        console.error(`Error processing ${file}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('INDEX COMPLETE');
    console.log('='.repeat(60));
    
    return new Promise((resolve) => {
      db.get(`
        SELECT 
          COUNT(DISTINCT tournament_name) as total_tournaments,
          COUNT(*) as total_games
        FROM games
      `, (err, stats) => {
        if (!err && stats) {
          console.log(`\nFinal statistics:`);
          console.log(`  ${stats.total_tournaments.toLocaleString()} unique tournaments`);
          console.log(`  ${stats.total_games.toLocaleString()} total games`);
        }
        resolve();
      });
    });
  }
}

async function main() {
  const indexer = new TournamentIndexResumer();
  await indexer.resumeIndexing();
  
  console.log('\nIndex complete!');
  db.close();
}

// Run with increased memory
if (process.execArgv.indexOf('--max-old-space-size=8192') === -1) {
  console.log('Restarting with increased memory...');
  const { spawn } = require('child_process');
  const child = spawn('node', ['--max-old-space-size=8192', __filename], {
    stdio: 'inherit'
  });
  child.on('exit', process.exit);
} else {
  main().catch(console.error);
}