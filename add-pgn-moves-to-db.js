const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Add PGN moves to the complete-tournaments.db database
 * This will process all PGN files and add moves to each game
 */

const dbPath = process.argv[2] || path.join(__dirname, 'otb-database', 'complete-tournaments.db');
const pgnDir = path.join(__dirname, 'otb-database', 'pgn-files');

console.log('🚀 Adding PGN moves to database...\n');
console.log(`Database: ${dbPath}`);
console.log(`PGN Directory: ${pgnDir}\n`);

// Check database exists
if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found: ${dbPath}`);
  process.exit(1);
}

// Open database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
});

// Add moves column if it doesn't exist
db.run(`ALTER TABLE games ADD COLUMN pgn_moves TEXT`, (err) => {
  if (err && !err.message.includes('duplicate column')) {
    console.error('❌ Error adding column:', err.message);
    db.close();
    process.exit(1);
  }

  if (err && err.message.includes('duplicate column')) {
    console.log('ℹ️  Column pgn_moves already exists\n');
  } else {
    console.log('✅ Added pgn_moves column to games table\n');
  }

  // Create index for faster updates
  db.run(`CREATE INDEX IF NOT EXISTS idx_games_pgn_file ON games(pgn_file)`, (err) => {
    if (err) {
      console.warn('⚠️  Could not create index:', err.message);
    }

    startProcessing();
  });
});

async function startProcessing() {
  // Get list of PGN files
  const pgnFiles = fs.readdirSync(pgnDir).filter(f => f.endsWith('.pgn'));

  console.log(`Found ${pgnFiles.length} PGN files to process:\n`);
  pgnFiles.forEach(f => {
    const stats = fs.statSync(path.join(pgnDir, f));
    const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
    console.log(`  - ${f} (${sizeMB} MB)`);
  });
  console.log('');

  // Process each PGN file
  for (const pgnFile of pgnFiles) {
    await processPGNFile(pgnFile);
  }

  // Show final stats
  db.get(`SELECT COUNT(*) as total, COUNT(pgn_moves) as with_moves FROM games`, (err, row) => {
    if (err) {
      console.error('Error getting stats:', err);
    } else {
      console.log(`\n📊 Final Statistics:`);
      console.log(`   Total games: ${row.total.toLocaleString()}`);
      console.log(`   Games with PGN: ${row.with_moves.toLocaleString()}`);
      console.log(`   Coverage: ${((row.with_moves / row.total) * 100).toFixed(2)}%`);
    }

    db.close();
    console.log('\n✅ Database updated successfully!');
  });
}

function processPGNFile(pgnFileName) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(pgnDir, pgnFileName);
    const startTime = Date.now();

    console.log(`\n📝 Processing: ${pgnFileName}`);

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentGame = {
      white: null,
      black: null,
      result: null,
      date: null,
      moves: []
    };
    let inGame = false;
    let gamesProcessed = 0;
    let gamesUpdated = 0;
    let batch = [];
    const BATCH_SIZE = 1000;

    rl.on('line', (line) => {
      // Parse headers
      if (line.startsWith('[White ')) {
        const match = line.match(/\[White "(.+)"\]/);
        currentGame.white = match ? match[1] : null;
      } else if (line.startsWith('[Black ')) {
        const match = line.match(/\[Black "(.+)"\]/);
        currentGame.black = match ? match[1] : null;
      } else if (line.startsWith('[Result ')) {
        const match = line.match(/\[Result "(.+)"\]/);
        currentGame.result = match ? match[1] : null;
      } else if (line.startsWith('[Date ')) {
        const match = line.match(/\[Date "(.+)"\]/);
        currentGame.date = match ? match[1] : null;
      } else if (line.trim() === '') {
        inGame = true;
      } else if (inGame && line.trim() !== '') {
        // This is the moves line
        currentGame.moves.push(line.trim());

        // Add to batch for database update
        batch.push({
          white: currentGame.white,
          black: currentGame.black,
          result: currentGame.result,
          date: currentGame.date,
          moves: currentGame.moves.join(' '),
          pgnFile: pgnFileName
        });

        gamesProcessed++;

        // Process batch
        if (batch.length >= BATCH_SIZE) {
          processBatch(batch).then(updated => {
            gamesUpdated += updated;
          });
          batch = [];
        }

        // Reset for next game
        currentGame = {
          white: null,
          black: null,
          result: null,
          date: null,
          moves: []
        };
        inGame = false;

        // Progress update every 10k games
        if (gamesProcessed % 10000 === 0) {
          process.stdout.write(`\r   Processed: ${gamesProcessed.toLocaleString()} games, Updated: ${gamesUpdated.toLocaleString()}`);
        }
      }
    });

    rl.on('close', async () => {
      // Process remaining batch
      if (batch.length > 0) {
        const updated = await processBatch(batch);
        gamesUpdated += updated;
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\r   ✅ Completed: ${gamesProcessed.toLocaleString()} games, Updated: ${gamesUpdated.toLocaleString()} (${elapsed}s)`);
      resolve();
    });

    rl.on('error', (err) => {
      console.error(`\n   ❌ Error processing ${pgnFileName}:`, err.message);
      reject(err);
    });
  });
}

function processBatch(games) {
  return new Promise((resolve) => {
    let updated = 0;
    let processed = 0;

    db.serialize(() => {
      const stmt = db.prepare(`
        UPDATE games
        SET pgn_moves = ?
        WHERE white_player = ?
          AND black_player = ?
          AND result = ?
          AND date = ?
          AND pgn_file = ?
          AND pgn_moves IS NULL
      `);

      games.forEach(game => {
        stmt.run(
          game.moves,
          game.white,
          game.black,
          game.result,
          game.date,
          game.pgnFile,
          function(err) {
            if (err) {
              console.error('\n   ⚠️  Error updating game:', err.message);
            } else if (this.changes > 0) {
              updated += this.changes;
            }

            processed++;
            if (processed === games.length) {
              stmt.finalize();
              resolve(updated);
            }
          }
        );
      });
    });
  });
}

// Handle errors
process.on('unhandledRejection', (err) => {
  console.error('\n❌ Unhandled error:', err);
  db.close();
  process.exit(1);
});
