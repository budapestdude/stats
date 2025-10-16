const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'otb-database', 'complete-tournaments.db');

class DatabaseOptimizer {
  constructor() {
    this.db = null;
    this.indexes = [];
    this.stats = {
      tablesAnalyzed: 0,
      indexesCreated: 0,
      indexesSkipped: 0,
      vacuumPerformed: false,
      analyzePerformed: false,
      beforeSize: 0,
      afterSize: 0
    };
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('❌ Failed to connect to database:', err);
          reject(err);
        } else {
          console.log('✅ Connected to database');
          
          // Get initial database size
          const stats = fs.statSync(DB_PATH);
          this.stats.beforeSize = stats.size;
          
          resolve();
        }
      });
    });
  }

  // Create all necessary indexes
  async createIndexes() {
    console.log('\n📊 Creating database indexes...');
    
    const indexDefinitions = [
      // Player indexes
      {
        name: 'idx_white_player',
        table: 'games',
        columns: 'white_player',
        description: 'Index for white player searches'
      },
      {
        name: 'idx_black_player',
        table: 'games',
        columns: 'black_player',
        description: 'Index for black player searches'
      },
      {
        name: 'idx_players_combined',
        table: 'games',
        columns: 'white_player, black_player',
        description: 'Combined index for player vs player queries'
      },
      
      // Date indexes
      {
        name: 'idx_date',
        table: 'games',
        columns: 'date',
        description: 'Index for date-based queries'
      },
      {
        name: 'idx_date_desc',
        table: 'games',
        columns: 'date DESC',
        description: 'Index for recent games queries'
      },
      
      // Tournament indexes
      {
        name: 'idx_tournament',
        table: 'games',
        columns: 'tournament_name',
        description: 'Index for tournament searches'
      },
      {
        name: 'idx_tournament_date',
        table: 'games',
        columns: 'tournament_name, date',
        description: 'Combined index for tournament timeline'
      },
      
      // Opening indexes
      {
        name: 'idx_eco',
        table: 'games',
        columns: 'eco',
        description: 'Index for ECO code searches'
      },
      {
        name: 'idx_opening',
        table: 'games',
        columns: 'opening',
        description: 'Index for opening name searches'
      },
      
      // Result index
      {
        name: 'idx_result',
        table: 'games',
        columns: 'result',
        description: 'Index for result filtering'
      },
      
      // Composite indexes for common queries
      {
        name: 'idx_player_date',
        table: 'games',
        columns: 'white_player, date',
        description: 'Index for player timeline queries'
      },
      {
        name: 'idx_player_result',
        table: 'games',
        columns: 'white_player, result',
        description: 'Index for player statistics'
      },
      {
        name: 'idx_tournament_round',
        table: 'games',
        columns: 'tournament_name, round',
        description: 'Index for tournament round queries'
      },
      
      // Full-text search indexes (if FTS5 is available)
      {
        name: 'idx_player_fulltext',
        table: 'games',
        columns: 'white_player, black_player',
        type: 'FULLTEXT',
        description: 'Full-text search for player names'
      }
    ];
    
    for (const indexDef of indexDefinitions) {
      await this.createIndex(indexDef);
    }
    
    console.log(`\n✅ Index creation complete:`);
    console.log(`   - Created: ${this.stats.indexesCreated} indexes`);
    console.log(`   - Skipped: ${this.stats.indexesSkipped} existing indexes`);
  }

  createIndex(indexDef) {
    return new Promise((resolve) => {
      const { name, table, columns, description, type = '' } = indexDef;
      
      // Check if index exists
      this.db.get(
        `SELECT name FROM sqlite_master WHERE type='index' AND name=?`,
        [name],
        (err, row) => {
          if (row) {
            console.log(`   ⏭️  Skipping ${name} (already exists)`);
            this.stats.indexesSkipped++;
            resolve();
          } else {
            // Create index
            const sql = type === 'FULLTEXT'
              ? `CREATE VIRTUAL TABLE IF NOT EXISTS ${name} USING fts5(${columns})`
              : `CREATE INDEX IF NOT EXISTS ${name} ON ${table}(${columns})`;
            
            console.log(`   🔨 Creating ${name}: ${description}`);
            
            this.db.run(sql, (err) => {
              if (err) {
                console.error(`   ❌ Failed to create ${name}:`, err.message);
              } else {
                console.log(`   ✅ Created ${name}`);
                this.stats.indexesCreated++;
              }
              resolve();
            });
          }
        }
      );
    });
  }

  // Analyze tables for query optimization
  analyzeTables() {
    return new Promise((resolve) => {
      console.log('\n📈 Analyzing tables for optimization...');
      
      this.db.run('ANALYZE', (err) => {
        if (err) {
          console.error('❌ Failed to analyze tables:', err);
        } else {
          console.log('✅ Table analysis complete');
          this.stats.analyzePerformed = true;
        }
        resolve();
      });
    });
  }

  // Vacuum database to reclaim space
  vacuumDatabase() {
    return new Promise((resolve) => {
      console.log('\n🧹 Vacuuming database to reclaim space...');
      console.log('   This may take a few minutes for large databases...');
      
      this.db.run('VACUUM', (err) => {
        if (err) {
          console.error('❌ Failed to vacuum database:', err);
        } else {
          console.log('✅ Database vacuum complete');
          this.stats.vacuumPerformed = true;
        }
        resolve();
      });
    });
  }

  // Get database statistics
  async getDatabaseStats() {
    return new Promise((resolve) => {
      console.log('\n📊 Gathering database statistics...');
      
      const queries = [
        {
          name: 'Total games',
          sql: 'SELECT COUNT(*) as count FROM games'
        },
        {
          name: 'Unique players',
          sql: 'SELECT COUNT(DISTINCT white_player) + COUNT(DISTINCT black_player) as count FROM games'
        },
        {
          name: 'Unique tournaments',
          sql: 'SELECT COUNT(DISTINCT tournament_name) as count FROM games'
        },
        {
          name: 'Date range',
          sql: 'SELECT MIN(date) as min_date, MAX(date) as max_date FROM games'
        },
        {
          name: 'Index count',
          sql: "SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'"
        },
        {
          name: 'Database page count',
          sql: 'PRAGMA page_count'
        },
        {
          name: 'Database page size',
          sql: 'PRAGMA page_size'
        }
      ];
      
      Promise.all(
        queries.map(query => 
          new Promise((resolveQuery) => {
            this.db.get(query.sql, (err, row) => {
              if (err) {
                console.error(`   ❌ Failed to get ${query.name}:`, err.message);
                resolveQuery(null);
              } else {
                if (query.name === 'Date range' && row) {
                  console.log(`   • ${query.name}: ${row.min_date} to ${row.max_date}`);
                } else if (row) {
                  const value = row.count || row[Object.keys(row)[0]];
                  console.log(`   • ${query.name}: ${value.toLocaleString()}`);
                }
                resolveQuery(row);
              }
            });
          })
        )
      ).then(() => resolve());
    });
  }

  // Configure optimal PRAGMA settings
  configurePragmas() {
    return new Promise((resolve) => {
      console.log('\n⚙️  Configuring database pragmas...');
      
      const pragmas = [
        { name: 'journal_mode', value: 'WAL', description: 'Write-Ahead Logging for better concurrency' },
        { name: 'synchronous', value: 'NORMAL', description: 'Balance between safety and speed' },
        { name: 'cache_size', value: '-64000', description: '64MB cache size' },
        { name: 'temp_store', value: 'MEMORY', description: 'Use memory for temp tables' },
        { name: 'mmap_size', value: '30000000000', description: 'Memory-mapped I/O for better performance' },
        { name: 'optimize', value: null, description: 'Run optimization' }
      ];
      
      Promise.all(
        pragmas.map(pragma => 
          new Promise((resolvePragma) => {
            const sql = pragma.value !== null 
              ? `PRAGMA ${pragma.name} = ${pragma.value}`
              : `PRAGMA ${pragma.name}`;
            
            this.db.run(sql, (err) => {
              if (err) {
                console.error(`   ❌ Failed to set ${pragma.name}:`, err.message);
              } else {
                console.log(`   ✅ ${pragma.description}`);
              }
              resolvePragma();
            });
          })
        )
      ).then(() => resolve());
    });
  }

  // Close database connection
  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('❌ Error closing database:', err);
          } else {
            // Get final database size
            const stats = fs.statSync(DB_PATH);
            this.stats.afterSize = stats.size;
            
            console.log('\n✅ Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Print optimization summary
  printSummary() {
    console.log('\n' + '═'.repeat(55));
    console.log('📊 OPTIMIZATION SUMMARY');
    console.log('═'.repeat(55));
    
    console.log(`Indexes created:    ${this.stats.indexesCreated}`);
    console.log(`Indexes skipped:    ${this.stats.indexesSkipped}`);
    console.log(`Analyze performed:  ${this.stats.analyzePerformed ? 'Yes' : 'No'}`);
    console.log(`Vacuum performed:   ${this.stats.vacuumPerformed ? 'Yes' : 'No'}`);
    
    if (this.stats.beforeSize && this.stats.afterSize) {
      const sizeDiff = this.stats.beforeSize - this.stats.afterSize;
      const sizePercent = ((sizeDiff / this.stats.beforeSize) * 100).toFixed(2);
      
      console.log(`\nDatabase size:`);
      console.log(`  Before: ${(this.stats.beforeSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  After:  ${(this.stats.afterSize / 1024 / 1024).toFixed(2)} MB`);
      
      if (sizeDiff > 0) {
        console.log(`  Saved:  ${(sizeDiff / 1024 / 1024).toFixed(2)} MB (${sizePercent}%)`);
      }
    }
    
    console.log('═'.repeat(55));
  }

  // Main optimization process
  async optimize() {
    try {
      console.log('🚀 Starting database optimization...\n');
      
      await this.connect();
      await this.getDatabaseStats();
      await this.configurePragmas();
      await this.createIndexes();
      await this.analyzeTables();
      
      // Ask user before vacuum (it can take time)
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      await new Promise((resolve) => {
        rl.question('\n🤔 Vacuum database? This may take several minutes (y/n): ', async (answer) => {
          if (answer.toLowerCase() === 'y') {
            await this.vacuumDatabase();
          } else {
            console.log('⏭️  Skipping vacuum');
          }
          rl.close();
          resolve();
        });
      });
      
      await this.close();
      this.printSummary();
      
      console.log('\n✅ Database optimization complete!');
      
    } catch (error) {
      console.error('❌ Optimization failed:', error);
      process.exit(1);
    }
  }
}

// Run optimization
if (require.main === module) {
  const optimizer = new DatabaseOptimizer();
  optimizer.optimize();
}

module.exports = DatabaseOptimizer;