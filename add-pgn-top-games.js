const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Add PGN moves to top N most "important" games only
 * This balances storage vs performance - popular games get instant loading
 */

const dbPath = process.argv[2] || path.join(__dirname, 'otb-database', 'complete-tournaments.db');
const pgnDir = path.join(__dirname, 'otb-database', 'pgn-files');
const topN = parseInt(process.argv[3]) || 100000; // Default: top 100k games

console.log(`🎯 Adding PGN moves to top ${topN.toLocaleString()} games...\n`);
console.log(`Database: ${dbPath}`);
console.log(`PGN Directory: ${pgnDir}\n`);

// Open database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
});

// Add moves column if needed
db.run(`ALTER TABLE games ADD COLUMN pgn_moves TEXT`, (err) => {
  if (err && !err.message.includes('duplicate column')) {
    console.error('❌ Error adding column:', err.message);
    db.close();
    process.exit(1);
  }

  if (!err) {
    console.log('✅ Added pgn_moves column\n');
  }

  selectTopGames();
});

async function selectTopGames() {
  console.log('📊 Selecting top games based on:');
  console.log('   - Player rating/frequency');
  console.log('   - Tournament importance');
  console.log('   - Recent games (2015+)');
  console.log('');

  // Select top games using a scoring system
  const query = `
    SELECT id, white_player, black_player, result, date, pgn_file,
           (
             -- Score based on multiple factors
             CASE WHEN date >= '2020' THEN 50 ELSE 0 END + -- Recent games (2020+)
             CASE WHEN date >= '2015' THEN 20 ELSE 0 END + -- Semi-recent (2015+)
             CASE
               WHEN white_player LIKE '%Carlsen%' OR black_player LIKE '%Carlsen%' THEN 100
               WHEN white_player LIKE '%Kasparov%' OR black_player LIKE '%Kasparov%' THEN 90
               WHEN white_player LIKE '%Fischer%' OR black_player LIKE '%Fischer%' THEN 85
               WHEN white_player LIKE '%Karpov%' OR black_player LIKE '%Karpov%' THEN 80
               WHEN white_player LIKE '%Kramnik%' OR black_player LIKE '%Kramnik%' THEN 75
               WHEN white_player LIKE '%Anand%' OR black_player LIKE '%Anand%' THEN 75
               WHEN white_player LIKE '%Nakamura%' OR black_player LIKE '%Nakamura%' THEN 70
               WHEN white_player LIKE '%Caruana%' OR black_player LIKE '%Caruana%' THEN 70
               WHEN white_player LIKE '%Firouzja%' OR black_player LIKE '%Firouzja%' THEN 65
               WHEN white_player LIKE '%Nepomniachtchi%' OR black_player LIKE '%Nepomniachtchi%' THEN 65
               WHEN white_player LIKE '%Aronian%' OR black_player LIKE '%Aronian%' THEN 60
               WHEN white_player LIKE '%Giri%' OR black_player LIKE '%Giri%' THEN 60
               ELSE 0
             END + -- Famous players
             CASE
               WHEN tournament_name LIKE '%World%Championship%' THEN 50
               WHEN tournament_name LIKE '%Candidates%' THEN 40
               WHEN tournament_name LIKE '%Olympiad%' THEN 30
               WHEN tournament_name LIKE '%Tata Steel%' THEN 25
               WHEN tournament_name LIKE '%Norway Chess%' THEN 25
               ELSE 0
             END -- Important tournaments
           ) as score
    FROM games
    WHERE pgn_moves IS NULL
      AND pgn_file IS NOT NULL
      AND pgn_file != ''
    ORDER BY score DESC, date DESC
    LIMIT ?
  `;

  db.all(query, [topN], async (err, games) => {
    if (err) {
      console.error('❌ Error selecting games:', err);
      db.close();
      process.exit(1);
    }

    console.log(`✅ Selected ${games.length.toLocaleString()} games to process\n`);

    // Group games by PGN file for efficient processing
    const gamesByFile = {};
    games.forEach(game => {
      if (!gamesByFile[game.pgn_file]) {
        gamesByFile[game.pgn_file] = [];
      }
      gamesByFile[game.pgn_file].push(game);
    });

    console.log(`📁 Games spread across ${Object.keys(gamesByFile).length} PGN files\n`);

    // Process each file
    for (const [pgnFile, fileGames] of Object.entries(gamesByFile)) {
      await processPGNFileForGames(pgnFile, fileGames);
    }

    // Show final stats
    db.get(`SELECT COUNT(*) as total, COUNT(pgn_moves) as with_moves FROM games`, (err, row) => {
      if (!err) {
        console.log(`\n📊 Final Statistics:`);
        console.log(`   Total games: ${row.total.toLocaleString()}`);
        console.log(`   Games with PGN: ${row.with_moves.toLocaleString()}`);
        console.log(`   Coverage: ${((row.with_moves / row.total) * 100).toFixed(2)}%`);
      }

      db.close();
      console.log('\n✅ Top games processed successfully!');
      console.log('💡 These games will now load instantly (<50ms)');
      console.log('💡 Other games will use on-demand extraction (10-20s first time, then cached)');
    });
  });
}

function processPGNFileForGames(pgnFileName, targetGames) {
  return new Promise((resolve) => {
    const filePath = path.join(pgnDir, pgnFileName);
    const startTime = Date.now();

    console.log(`📝 Processing: ${pgnFileName} (${targetGames.length} games)`);

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentGame = { white: null, black: null, result: null, date: null, moves: [] };
    let inGame = false;
    let found = 0;
    let gamesRead = 0;

    // Create lookup map for faster matching
    const targetMap = new Map();
    targetGames.forEach(g => {
      const key = `${g.white_player}|${g.black_player}|${g.result}|${g.date}`;
      targetMap.set(key, g);
    });

    rl.on('line', (line) => {
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
        currentGame.moves.push(line.trim());
        gamesRead++;

        // Check if this is one of our target games
        const key = `${currentGame.white}|${currentGame.black}|${currentGame.result}|${currentGame.date}`;
        const targetGame = targetMap.get(key);

        if (targetGame) {
          // Update database with PGN moves
          db.run(
            `UPDATE games SET pgn_moves = ? WHERE id = ?`,
            [currentGame.moves.join(' '), targetGame.id],
            (err) => {
              if (!err) {
                found++;
                if (found % 100 === 0) {
                  process.stdout.write(`\r   Progress: ${found}/${targetGames.length} games found`);
                }

                // Stop early if we found all target games
                if (found >= targetGames.length) {
                  rl.close();
                  fileStream.destroy();
                }
              }
            }
          );
        }

        currentGame = { white: null, black: null, result: null, date: null, moves: [] };
        inGame = false;
      }
    });

    rl.on('close', () => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\r   ✅ Completed: ${found}/${targetGames.length} games found (${elapsed}s)`);
      resolve();
    });

    rl.on('error', (err) => {
      console.error(`\n   ❌ Error:`, err.message);
      resolve();
    });
  });
}
