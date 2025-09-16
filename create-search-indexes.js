const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

/**
 * Optimized Search Index Creation Script
 * Creates specialized indexes for enhanced search performance
 */
class SearchIndexCreator {
  constructor() {
    // Try to find the database with games table
    const possibleDbs = [
      'chess-production.db',
      'chess-stats.db', 
      'complete-tournaments.db',
      path.join('otb-database', 'complete-tournaments.db')
    ];
    
    for (const db of possibleDbs) {
      const dbPath = path.join(__dirname, db);
      if (fs.existsSync(dbPath)) {
        this.dbPath = dbPath;
        console.log(`📁 Using database: ${db}`);
        break;
      }
    }
    
    if (!this.dbPath) {
      this.dbPath = path.join(__dirname, 'chess-production.db');
    }
    
    this.createdIndexes = [];
    this.failedIndexes = [];
  }

  async createSearchIndexes() {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.dbPath)) {
        console.error('❌ Database not found:', this.dbPath);
        return reject(new Error('Database not found'));
      }

      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Error opening database:', err);
          return reject(err);
        }
        
        console.log('✅ Connected to database');
        console.log('🔍 Creating optimized search indexes...\n');

        // Define search-optimized indexes
        const searchIndexes = [
          // Player search indexes
          {
            name: 'idx_search_white_player',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_white_player ON games(white_player COLLATE NOCASE)',
            description: 'Case-insensitive white player search'
          },
          {
            name: 'idx_search_black_player',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_black_player ON games(black_player COLLATE NOCASE)',
            description: 'Case-insensitive black player search'
          },
          {
            name: 'idx_search_players_combined',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_players_combined ON games(white_player, black_player)',
            description: 'Combined player search for head-to-head'
          },
          
          // Opening search indexes
          {
            name: 'idx_search_eco',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_eco ON games(eco)',
            description: 'ECO code search'
          },
          {
            name: 'idx_search_opening',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_opening ON games(opening COLLATE NOCASE)',
            description: 'Case-insensitive opening name search'
          },
          {
            name: 'idx_search_eco_opening',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_eco_opening ON games(eco, opening)',
            description: 'Combined ECO and opening search'
          },
          
          // Date-based indexes
          {
            name: 'idx_search_date',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_date ON games(date)',
            description: 'Date range queries'
          },
          {
            name: 'idx_search_year',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_year ON games(substr(date, 1, 4))',
            description: 'Year-based search optimization'
          },
          
          // Tournament search indexes
          {
            name: 'idx_search_tournament',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_tournament ON games(tournament_name COLLATE NOCASE)',
            description: 'Case-insensitive tournament search'
          },
          {
            name: 'idx_search_tournament_date',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_tournament_date ON games(tournament_name, date)',
            description: 'Tournament chronological search'
          },
          
          // Result and rating indexes
          {
            name: 'idx_search_result',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_result ON games(result)',
            description: 'Result filtering'
          },
          {
            name: 'idx_search_white_elo',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_white_elo ON games(white_elo)',
            description: 'White rating search'
          },
          {
            name: 'idx_search_black_elo',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_black_elo ON games(black_elo)',
            description: 'Black rating search'
          },
          {
            name: 'idx_search_avg_elo',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_avg_elo ON games((white_elo + black_elo) / 2)',
            description: 'Average rating search'
          },
          
          // Game length indexes
          {
            name: 'idx_search_ply_count',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_ply_count ON games(ply_count)',
            description: 'Game length queries'
          },
          
          // Composite indexes for common queries
          {
            name: 'idx_search_player_date',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_player_date ON games(white_player, date)',
            description: 'Player games chronologically'
          },
          {
            name: 'idx_search_player_result',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_player_result ON games(white_player, result)',
            description: 'Player result statistics'
          },
          {
            name: 'idx_search_opening_result',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_opening_result ON games(eco, result)',
            description: 'Opening performance statistics'
          },
          {
            name: 'idx_search_full_composite',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_full_composite ON games(date, white_player, black_player, eco, result)',
            description: 'Full composite for complex queries'
          }
        ];

        // Additional full-text search preparation
        const fullTextIndexes = [
          {
            name: 'idx_search_pgn_moves',
            sql: 'CREATE INDEX IF NOT EXISTS idx_search_pgn_moves ON games(substr(pgn, 1, 100))',
            description: 'Opening moves pattern search'
          }
        ];

        const allIndexes = [...searchIndexes, ...fullTextIndexes];
        let completed = 0;

        // Create indexes sequentially with progress tracking
        const createNextIndex = (index) => {
          if (index >= allIndexes.length) {
            // Analyze tables for query optimization
            console.log('\n📊 Analyzing tables for query optimization...');
            db.run('ANALYZE', (err) => {
              if (err) {
                console.error('❌ Error analyzing tables:', err);
              } else {
                console.log('✅ Table analysis complete');
              }
              
              // Generate summary
              this.printSummary();
              db.close();
              resolve({
                created: this.createdIndexes,
                failed: this.failedIndexes
              });
            });
            return;
          }

          const indexDef = allIndexes[index];
          const startTime = Date.now();
          
          console.log(`\n[${index + 1}/${allIndexes.length}] Creating: ${indexDef.name}`);
          console.log(`   📝 ${indexDef.description}`);
          
          db.run(indexDef.sql, (err) => {
            const duration = Date.now() - startTime;
            
            if (err) {
              console.error(`   ❌ Failed (${duration}ms):`, err.message);
              this.failedIndexes.push({
                name: indexDef.name,
                error: err.message
              });
            } else {
              console.log(`   ✅ Success (${duration}ms)`);
              this.createdIndexes.push({
                name: indexDef.name,
                duration
              });
              completed++;
            }
            
            // Progress bar
            const progress = Math.floor((index + 1) / allIndexes.length * 100);
            const progressBar = '█'.repeat(Math.floor(progress / 2)) + '░'.repeat(50 - Math.floor(progress / 2));
            console.log(`   Progress: [${progressBar}] ${progress}%`);
            
            // Create next index
            createNextIndex(index + 1);
          });
        };

        // Start creating indexes
        createNextIndex(0);
      });
    });
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 INDEX CREATION SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n✅ Successfully created: ${this.createdIndexes.length} indexes`);
    if (this.createdIndexes.length > 0) {
      const totalTime = this.createdIndexes.reduce((sum, idx) => sum + idx.duration, 0);
      console.log(`   Total time: ${(totalTime / 1000).toFixed(2)} seconds`);
      console.log(`   Average time per index: ${(totalTime / this.createdIndexes.length / 1000).toFixed(2)} seconds`);
    }
    
    if (this.failedIndexes.length > 0) {
      console.log(`\n❌ Failed: ${this.failedIndexes.length} indexes`);
      this.failedIndexes.forEach(idx => {
        console.log(`   - ${idx.name}: ${idx.error}`);
      });
    }
    
    console.log('\n🎯 OPTIMIZATION RECOMMENDATIONS:');
    console.log('   1. Run VACUUM to optimize database file size');
    console.log('   2. Set PRAGMA cache_size = 10000 for better performance');
    console.log('   3. Use PRAGMA journal_mode = WAL for concurrent access');
    console.log('   4. Consider partitioning large tables by date');
    console.log('   5. Monitor slow queries and create additional indexes as needed');
    
    console.log('\n💡 SEARCH OPTIMIZATION TIPS:');
    console.log('   - Use exact player names when possible');
    console.log('   - Provide date ranges to narrow search scope');
    console.log('   - Use ECO codes for opening searches when known');
    console.log('   - Combine filters for faster results');
    console.log('   - Enable search result caching in production');
  }

  async verifyIndexes() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          return reject(err);
        }
        
        console.log('\n🔍 Verifying indexes...');
        
        db.all("SELECT name FROM sqlite_master WHERE type='index'", (err, rows) => {
          if (err) {
            console.error('❌ Error retrieving indexes:', err);
            db.close();
            return reject(err);
          }
          
          console.log(`\n📋 Total indexes in database: ${rows.length}`);
          console.log('\nSearch-related indexes:');
          
          const searchIndexes = rows.filter(row => 
            row.name.includes('search') || 
            row.name.includes('player') || 
            row.name.includes('opening') ||
            row.name.includes('eco') ||
            row.name.includes('tournament')
          );
          
          searchIndexes.forEach(idx => {
            console.log(`   ✓ ${idx.name}`);
          });
          
          db.close();
          resolve(searchIndexes);
        });
      });
    });
  }
}

// Run the script
async function main() {
  const creator = new SearchIndexCreator();
  
  try {
    console.log('🚀 Starting enhanced search index creation...\n');
    
    // Create indexes
    await creator.createSearchIndexes();
    
    // Verify indexes
    console.log('\n' + '='.repeat(60));
    await creator.verifyIndexes();
    
    console.log('\n✨ Search index optimization complete!');
    console.log('🔄 Remember to restart your server to benefit from the new indexes.');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = SearchIndexCreator;