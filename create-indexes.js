const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

/**
 * Script to create optimized indexes on the database
 */
class IndexCreator {
  constructor() {
    this.dbPath = path.join(__dirname, 'otb-database', 'complete-tournaments.db');
  }

  async createIndexes() {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.dbPath)) {
        console.error('Database not found:', this.dbPath);
        return reject(new Error('Database not found'));
      }

      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          return reject(err);
        }
        
        console.log('✅ Connected to database');
        console.log('📊 Creating indexes for optimal performance...\n');

        const indexes = [
          // Games table indexes - using correct column names
          {
            name: 'idx_games_players',
            sql: 'CREATE INDEX IF NOT EXISTS idx_games_players ON games(white_player, black_player)',
            description: 'Composite index for player searches'
          },
          {
            name: 'idx_games_white',
            sql: 'CREATE INDEX IF NOT EXISTS idx_games_white ON games(white_player)',
            description: 'Index for white player searches'
          },
          {
            name: 'idx_games_black',
            sql: 'CREATE INDEX IF NOT EXISTS idx_games_black ON games(black_player)',
            description: 'Index for black player searches'
          },
          {
            name: 'idx_games_date',
            sql: 'CREATE INDEX IF NOT EXISTS idx_games_date ON games(date)',
            description: 'Index for date range queries'
          },
          {
            name: 'idx_games_eco',
            sql: 'CREATE INDEX IF NOT EXISTS idx_games_eco ON games(eco)',
            description: 'Index for opening searches'
          },
          {
            name: 'idx_games_tournament',
            sql: 'CREATE INDEX IF NOT EXISTS idx_games_tournament ON games(tournament_name)',
            description: 'Index for tournament queries'
          },
          {
            name: 'idx_games_result',
            sql: 'CREATE INDEX IF NOT EXISTS idx_games_result ON games(result)',
            description: 'Index for result filtering'
          },
          {
            name: 'idx_games_white_result',
            sql: 'CREATE INDEX IF NOT EXISTS idx_games_white_result ON games(white_player, result)',
            description: 'Composite index for white player results'
          },
          {
            name: 'idx_games_black_result',
            sql: 'CREATE INDEX IF NOT EXISTS idx_games_black_result ON games(black_player, result)',
            description: 'Composite index for black player results'
          },
          {
            name: 'idx_games_opening',
            sql: 'CREATE INDEX IF NOT EXISTS idx_games_opening ON games(opening)',
            description: 'Index for opening name searches'
          },
          {
            name: 'idx_games_tournament_date',
            sql: 'CREATE INDEX IF NOT EXISTS idx_games_tournament_date ON games(tournament_name, date)',
            description: 'Composite index for tournament date queries'
          },
          {
            name: 'idx_games_ply_count',
            sql: 'CREATE INDEX IF NOT EXISTS idx_games_ply_count ON games(ply_count)',
            description: 'Index for game length queries'
          }
        ];

        // Additional indexes for other tables if they exist
        const conditionalIndexes = [
          // Players table
          {
            table: 'players',
            indexes: [
              {
                name: 'idx_players_name',
                sql: 'CREATE INDEX IF NOT EXISTS idx_players_name ON players(name)',
                description: 'Index for player name searches'
              },
              {
                name: 'idx_players_rating',
                sql: 'CREATE INDEX IF NOT EXISTS idx_players_rating ON players(rating) WHERE rating IS NOT NULL',
                description: 'Partial index for rated players'
              },
              {
                name: 'idx_players_country',
                sql: 'CREATE INDEX IF NOT EXISTS idx_players_country ON players(country)',
                description: 'Index for country searches'
              }
            ]
          },
          // Tournaments table
          {
            table: 'tournaments',
            indexes: [
              {
                name: 'idx_tournaments_dates',
                sql: 'CREATE INDEX IF NOT EXISTS idx_tournaments_dates ON tournaments(start_date, end_date)',
                description: 'Index for tournament date ranges'
              },
              {
                name: 'idx_tournaments_name',
                sql: 'CREATE INDEX IF NOT EXISTS idx_tournaments_name ON tournaments(name)',
                description: 'Index for tournament name searches'
              },
              {
                name: 'idx_tournaments_location',
                sql: 'CREATE INDEX IF NOT EXISTS idx_tournaments_location ON tournaments(location)',
                description: 'Index for location searches'
              }
            ]
          },
          // Openings table
          {
            table: 'openings',
            indexes: [
              {
                name: 'idx_openings_eco',
                sql: 'CREATE INDEX IF NOT EXISTS idx_openings_eco ON openings(eco)',
                description: 'Index for ECO code searches'
              },
              {
                name: 'idx_openings_name',
                sql: 'CREATE INDEX IF NOT EXISTS idx_openings_name ON openings(name)',
                description: 'Index for opening name searches'
              }
            ]
          }
        ];

        let completed = 0;
        let failed = 0;
        const startTime = Date.now();

        // Function to create an index
        const createIndex = (index, callback) => {
          console.log(`Creating: ${index.name}`);
          console.log(`  ${index.description}`);
          
          db.run(index.sql, (err) => {
            if (err) {
              console.log(`  ❌ Failed: ${err.message}\n`);
              failed++;
            } else {
              console.log(`  ✅ Success\n`);
              completed++;
            }
            callback();
          });
        };

        // Create main indexes
        const processIndexes = () => {
          let currentIndex = 0;
          
          const processNext = () => {
            if (currentIndex < indexes.length) {
              createIndex(indexes[currentIndex], () => {
                currentIndex++;
                processNext();
              });
            } else {
              // Process conditional indexes
              processConditionalIndexes();
            }
          };
          
          processNext();
        };

        // Process conditional indexes (check if table exists first)
        const processConditionalIndexes = () => {
          let tableIndex = 0;
          
          const processNextTable = () => {
            if (tableIndex < conditionalIndexes.length) {
              const tableInfo = conditionalIndexes[tableIndex];
              
              // Check if table exists
              db.get(
                `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
                [tableInfo.table],
                (err, row) => {
                  if (err || !row) {
                    console.log(`Table '${tableInfo.table}' not found, skipping indexes\n`);
                    tableIndex++;
                    processNextTable();
                  } else {
                    console.log(`Processing indexes for table: ${tableInfo.table}`);
                    
                    let indexIdx = 0;
                    const processTableIndex = () => {
                      if (indexIdx < tableInfo.indexes.length) {
                        createIndex(tableInfo.indexes[indexIdx], () => {
                          indexIdx++;
                          processTableIndex();
                        });
                      } else {
                        tableIndex++;
                        processNextTable();
                      }
                    };
                    
                    processTableIndex();
                  }
                }
              );
            } else {
              // All done
              finalize();
            }
          };
          
          processNextTable();
        };

        // Finalize and report
        const finalize = () => {
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          
          console.log('='.repeat(50));
          console.log('📊 INDEX CREATION SUMMARY');
          console.log('='.repeat(50));
          console.log(`✅ Successful: ${completed}`);
          console.log(`❌ Failed: ${failed}`);
          console.log(`⏱️ Duration: ${duration} seconds`);
          
          // Run ANALYZE to update statistics
          console.log('\n📈 Updating database statistics...');
          db.run('ANALYZE', (err) => {
            if (err) {
              console.log('❌ Failed to update statistics:', err.message);
            } else {
              console.log('✅ Statistics updated successfully');
            }
            
            // Get database size
            db.get('PRAGMA page_count', (err, row1) => {
              db.get('PRAGMA page_size', (err2, row2) => {
                if (!err && !err2 && row1 && row2) {
                  const sizeInMB = (row1.page_count * row2.page_size / (1024 * 1024)).toFixed(2);
                  console.log(`\n📦 Database size: ${sizeInMB} MB`);
                }
                
                db.close((err) => {
                  if (err) {
                    console.error('Error closing database:', err);
                  } else {
                    console.log('\n✅ Index creation complete!');
                  }
                  resolve({ completed, failed, duration });
                });
              });
            });
          });
        };

        // Start processing
        processIndexes();
      });
    });
  }
}

// Run if executed directly
if (require.main === module) {
  const creator = new IndexCreator();
  creator.createIndexes()
    .then(result => {
      console.log('\nProcess completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nProcess failed:', error);
      process.exit(1);
    });
}

module.exports = IndexCreator;