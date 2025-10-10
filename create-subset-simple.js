// Simple database subset creator for Railway
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const SOURCE_DB = path.join(__dirname, 'otb-database', 'complete-tournaments.db');
const TARGET_DB = path.join(__dirname, 'otb-database', 'railway-subset.db');

console.log('Creating Railway subset database...\n');

// Remove target if exists
if (fs.existsSync(TARGET_DB)) {
  fs.unlinkSync(TARGET_DB);
}

const db = new sqlite3.Database(SOURCE_DB, sqlite3.OPEN_READONLY);

// Create export using SQLite CLI approach
const exportSql = `
.output '${TARGET_DB.replace(/\\/g, '/')}'
.mode insert games
SELECT * FROM games ORDER BY date DESC LIMIT 500000;
`;

// Better approach: Use ATTACH and INSERT
const targetDb = new sqlite3.Database(TARGET_DB);

targetDb.serialize(() => {
  // Create games table with actual schema
  targetDb.run(`
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
      pgn_file TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creating table:', err);
      process.exit(1);
    }

    console.log('✓ Created games table');
    console.log('Copying 500,000 most recent games (this will take a few minutes)...\n');

    // Attach source database
    targetDb.run(`ATTACH DATABASE '${SOURCE_DB}' AS source`, (err) => {
      if (err) {
        console.error('Error attaching database:', err);
        process.exit(1);
      }

      // Copy games
      targetDb.run(`
        INSERT INTO games (tournament_name, white_player, black_player, result, date, round, eco, opening, ply_count, pgn_file)
        SELECT tournament_name, white_player, black_player, result, date, round, eco, opening, ply_count, pgn_file
        FROM source.games
        ORDER BY date DESC
        LIMIT 500000
      `, function(err) {
        if (err) {
          console.error('Error copying games:', err);
          targetDb.close();
          db.close();
          process.exit(1);
        }

        console.log(`✓ Copied ${this.changes} games`);
        console.log('Creating indexes...');

        // Create indexes
        const indexes = [
          'CREATE INDEX idx_white_player ON games(white_player)',
          'CREATE INDEX idx_black_player ON games(black_player)',
          'CREATE INDEX idx_eco ON games(eco)',
          'CREATE INDEX idx_date ON games(date)',
          'CREATE INDEX idx_tournament ON games(tournament_name)'
        ];

        let completed = 0;
        indexes.forEach(sql => {
          targetDb.run(sql, (err) => {
            if (err) console.warn('Warning:', err.message);
            completed++;

            if (completed === indexes.length) {
              console.log('✓ Indexes created');
              console.log('Optimizing database...');

              targetDb.run('VACUUM', (err) => {
                if (err) console.warn('Warning:', err.message);

                targetDb.run('ANALYZE', (err) => {
                  if (err) console.warn('Warning:', err.message);

                  targetDb.close();
                  db.close();

                  const stats = fs.statSync(TARGET_DB);
                  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

                  console.log('\n✅ Success! Subset database created');
                  console.log(`   Location: ${TARGET_DB}`);
                  console.log(`   Size: ${sizeMB} MB`);
                  console.log(`   Games: 500,000`);
                  console.log('\nReady for Railway deployment!\n');
                });
              });
            }
          });
        });
      });
    });
  });
});
