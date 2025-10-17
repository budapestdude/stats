// Create a smaller subset database for Railway deployment
// This creates a ~500MB database with most recent and popular games

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const SOURCE_DB = path.join(__dirname, 'otb-database', 'complete-tournaments.db');
const TARGET_DB = path.join(__dirname, 'otb-database', 'railway-subset.db');
const GAMES_LIMIT = 500000; // 500k games (~500MB)

console.log('Creating Railway-optimized subset database...\n');

// Check if source exists
if (!fs.existsSync(SOURCE_DB)) {
  console.error('Error: Source database not found at:', SOURCE_DB);
  process.exit(1);
}

// Remove target if exists
if (fs.existsSync(TARGET_DB)) {
  console.log('Removing existing subset database...');
  fs.unlinkSync(TARGET_DB);
}

const sourceDb = new sqlite3.Database(SOURCE_DB, sqlite3.OPEN_READONLY);
const targetDb = new sqlite3.Database(TARGET_DB);

async function createSubset() {
  return new Promise((resolve, reject) => {
    console.log('Step 1: Creating tables structure...');

    // Get table schema from source (exclude internal tables)
    sourceDb.all("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", (err, tables) => {
      if (err) return reject(err);

      targetDb.serialize(() => {
        // Create tables
        tables.forEach(table => {
          if (table.sql) {
            targetDb.run(table.sql, (err) => {
              if (err) console.warn(`Warning creating table: ${err.message}`);
            });
          }
        });

        console.log('Step 2: Copying games (this may take a few minutes)...');

        // Copy most recent and highest-rated games
        const copyQuery = `
          INSERT INTO games
          SELECT * FROM (
            -- Recent games (last 3 years)
            SELECT * FROM games
            WHERE date >= '2022-01-01'
            ORDER BY date DESC
            LIMIT ${Math.floor(GAMES_LIMIT * 0.7)}

            UNION ALL

            -- High-rated games (2600+ average rating)
            SELECT * FROM games
            WHERE (white_rating + black_rating) / 2 >= 2600
            ORDER BY date DESC
            LIMIT ${Math.floor(GAMES_LIMIT * 0.2)}

            UNION ALL

            -- Popular openings (diverse coverage)
            SELECT * FROM games
            WHERE eco IN ('C50', 'B10', 'E60', 'D02', 'B01', 'C01', 'B07', 'A04')
            ORDER BY date DESC
            LIMIT ${Math.floor(GAMES_LIMIT * 0.1)}
          )
          LIMIT ${GAMES_LIMIT};
        `;

        targetDb.run(`ATTACH DATABASE '${SOURCE_DB}' AS source`, (err) => {
          if (err) return reject(err);

          targetDb.run(copyQuery, function(err) {
            if (err) {
              console.error('Error copying games:', err);
              return reject(err);
            }

            console.log(`Step 3: Copied ${this.changes} games`);
            console.log('Step 4: Creating indexes...');

            // Create indexes
            targetDb.run('CREATE INDEX IF NOT EXISTS idx_white_player ON games(white_player)', (err) => {
              if (err) console.warn('Warning: Could not create white_player index');

              targetDb.run('CREATE INDEX IF NOT EXISTS idx_black_player ON games(black_player)', (err) => {
                if (err) console.warn('Warning: Could not create black_player index');

                targetDb.run('CREATE INDEX IF NOT EXISTS idx_eco ON games(eco)', (err) => {
                  if (err) console.warn('Warning: Could not create eco index');

                  targetDb.run('CREATE INDEX IF NOT EXISTS idx_date ON games(date)', (err) => {
                    if (err) console.warn('Warning: Could not create date index');

                    console.log('Step 5: Optimizing database...');

                    targetDb.run('VACUUM', (err) => {
                      if (err) console.warn('Warning: Could not vacuum database');

                      targetDb.run('ANALYZE', (err) => {
                        if (err) console.warn('Warning: Could not analyze database');

                        resolve();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

createSubset()
  .then(() => {
    sourceDb.close();
    targetDb.close();

    console.log('\n✅ Subset database created successfully!');
    console.log('\nDatabase info:');

    const stats = fs.statSync(TARGET_DB);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`  Location: ${TARGET_DB}`);
    console.log(`  Size: ${sizeMB} MB`);
    console.log(`  Games: ~${GAMES_LIMIT.toLocaleString()}`);
    console.log('\nThis database is optimized for Railway deployment.');
    console.log('Update simple-server.js to use: railway-subset.db\n');
  })
  .catch(err => {
    console.error('\n❌ Error creating subset:', err);
    sourceDb.close();
    targetDb.close();

    // Clean up partial database
    if (fs.existsSync(TARGET_DB)) {
      fs.unlinkSync(TARGET_DB);
    }

    process.exit(1);
  });
