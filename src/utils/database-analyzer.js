const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

/**
 * Database Performance Analyzer
 * Analyzes database structure, indexes, and query performance
 */
class DatabaseAnalyzer {
  constructor(dbPath = './complete-tournaments.db') {
    this.dbPath = dbPath;
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error connecting to database:', err);
          reject(err);
        } else {
          console.log('✅ Connected to database:', this.dbPath);
          resolve();
        }
      });
    });
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(() => {
          console.log('Database connection closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Get database statistics
  async getDatabaseStats() {
    console.log('\n📊 DATABASE STATISTICS');
    console.log('='.repeat(50));

    try {
      // Get database size
      const stats = await fs.stat(this.dbPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`Database Size: ${sizeInMB} MB`);

      // Get page count and size
      const pragma = await this.runQuery('PRAGMA page_count; PRAGMA page_size;');
      
      // Get cache statistics
      const cacheSize = await this.runQuery('PRAGMA cache_size;');
      console.log(`Cache Size: ${cacheSize} pages`);

      // Get journal mode
      const journalMode = await this.runQuery('PRAGMA journal_mode;');
      console.log(`Journal Mode: ${journalMode}`);

      // Get synchronous mode
      const syncMode = await this.runQuery('PRAGMA synchronous;');
      console.log(`Synchronous Mode: ${syncMode}`);

    } catch (error) {
      console.error('Error getting database stats:', error);
    }
  }

  // Analyze tables and their structure
  async analyzeTables() {
    console.log('\n📋 TABLE ANALYSIS');
    console.log('='.repeat(50));

    try {
      // Get all tables
      const tables = await this.allQuery(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );

      for (const table of tables) {
        const tableName = table.name;
        console.log(`\nTable: ${tableName}`);
        console.log('-'.repeat(30));

        // Get row count
        const countResult = await this.getQuery(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`  Rows: ${countResult.count.toLocaleString()}`);

        // Get table info
        const columns = await this.allQuery(`PRAGMA table_info(${tableName})`);
        console.log(`  Columns: ${columns.length}`);
        
        // List columns with types
        columns.forEach(col => {
          const pk = col.pk ? ' [PK]' : '';
          const notNull = col.notnull ? ' NOT NULL' : '';
          console.log(`    - ${col.name}: ${col.type}${pk}${notNull}`);
        });

        // Get indexes
        const indexes = await this.allQuery(
          `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='${tableName}'`
        );
        if (indexes.length > 0) {
          console.log(`  Indexes: ${indexes.length}`);
          indexes.forEach(idx => {
            console.log(`    - ${idx.name}`);
          });
        }
      }
    } catch (error) {
      console.error('Error analyzing tables:', error);
    }
  }

  // Analyze existing indexes
  async analyzeIndexes() {
    console.log('\n🔍 INDEX ANALYSIS');
    console.log('='.repeat(50));

    try {
      const indexes = await this.allQuery(
        "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY tbl_name, name"
      );

      const indexByTable = {};
      indexes.forEach(idx => {
        if (!indexByTable[idx.tbl_name]) {
          indexByTable[idx.tbl_name] = [];
        }
        indexByTable[idx.tbl_name].push(idx);
      });

      for (const [table, tableIndexes] of Object.entries(indexByTable)) {
        console.log(`\nTable: ${table}`);
        tableIndexes.forEach(idx => {
          console.log(`  ${idx.name}:`);
          console.log(`    ${idx.sql}`);
          
          // Analyze index usage
          this.analyzeIndexUsage(table, idx.name);
        });
      }

      // Check for missing indexes
      await this.suggestIndexes();

    } catch (error) {
      console.error('Error analyzing indexes:', error);
    }
  }

  // Analyze index usage
  async analyzeIndexUsage(table, indexName) {
    try {
      // This would require EXPLAIN QUERY PLAN on actual queries
      // For now, we'll check index statistics if available
      const stats = await this.allQuery(`PRAGMA index_info(${indexName})`);
      if (stats.length > 0) {
        console.log(`    Columns: ${stats.map(s => s.name).join(', ')}`);
      }
    } catch (error) {
      // Silently continue if index info not available
    }
  }

  // Suggest missing indexes based on common query patterns
  async suggestIndexes() {
    console.log('\n💡 SUGGESTED INDEXES');
    console.log('='.repeat(50));

    const suggestions = [];

    try {
      // Check games table
      const gamesIndexes = await this.allQuery(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='games'"
      );
      const indexNames = gamesIndexes.map(i => i.name.toLowerCase());

      // Suggest common indexes if not present
      if (!indexNames.some(n => n.includes('white') && n.includes('black'))) {
        suggestions.push({
          table: 'games',
          columns: ['White', 'Black'],
          reason: 'Optimize player game searches'
        });
      }

      if (!indexNames.some(n => n.includes('date'))) {
        suggestions.push({
          table: 'games',
          columns: ['Date'],
          reason: 'Optimize date-range queries'
        });
      }

      if (!indexNames.some(n => n.includes('eco'))) {
        suggestions.push({
          table: 'games',
          columns: ['ECO'],
          reason: 'Optimize opening searches'
        });
      }

      if (!indexNames.some(n => n.includes('event'))) {
        suggestions.push({
          table: 'games',
          columns: ['Event'],
          reason: 'Optimize tournament queries'
        });
      }

      // Check tournaments table
      const tournamentIndexes = await this.allQuery(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='tournaments'"
      );
      
      if (tournamentIndexes.length === 0) {
        suggestions.push({
          table: 'tournaments',
          columns: ['start_date', 'end_date'],
          reason: 'Optimize date-range tournament searches'
        });
      }

      // Output suggestions
      if (suggestions.length > 0) {
        suggestions.forEach(suggestion => {
          console.log(`\n📌 ${suggestion.table}.${suggestion.columns.join(', ')}`);
          console.log(`   Reason: ${suggestion.reason}`);
          console.log(`   SQL: CREATE INDEX idx_${suggestion.table}_${suggestion.columns.join('_').toLowerCase()}`);
          console.log(`        ON ${suggestion.table}(${suggestion.columns.join(', ')});`);
        });
      } else {
        console.log('No immediate index suggestions. Database appears well-indexed.');
      }

    } catch (error) {
      console.error('Error suggesting indexes:', error);
    }

    return suggestions;
  }

  // Analyze query performance
  async analyzeQueryPerformance() {
    console.log('\n⚡ QUERY PERFORMANCE ANALYSIS');
    console.log('='.repeat(50));

    const testQueries = [
      {
        name: 'Player Games Query',
        sql: "SELECT * FROM games WHERE White = 'Carlsen, Magnus' OR Black = 'Carlsen, Magnus' LIMIT 100"
      },
      {
        name: 'Date Range Query',
        sql: "SELECT COUNT(*) FROM games WHERE Date >= '2020-01-01' AND Date <= '2020-12-31'"
      },
      {
        name: 'Opening Query',
        sql: "SELECT COUNT(*) FROM games WHERE ECO LIKE 'B%'"
      },
      {
        name: 'Tournament Games',
        sql: "SELECT * FROM games WHERE Event LIKE '%Championship%' LIMIT 100"
      },
      {
        name: 'Top Players Query',
        sql: "SELECT White, COUNT(*) as games FROM games GROUP BY White ORDER BY games DESC LIMIT 10"
      }
    ];

    for (const query of testQueries) {
      console.log(`\n📊 ${query.name}`);
      console.log(`SQL: ${query.sql}`);
      
      const startTime = Date.now();
      
      try {
        // Run EXPLAIN QUERY PLAN
        const plan = await this.allQuery(`EXPLAIN QUERY PLAN ${query.sql}`);
        
        // Execute the query
        await this.allQuery(query.sql);
        
        const duration = Date.now() - startTime;
        console.log(`⏱️ Duration: ${duration}ms`);
        
        // Show query plan
        console.log('Query Plan:');
        plan.forEach(step => {
          console.log(`  ${step.detail}`);
        });
        
        // Performance assessment
        if (duration > 1000) {
          console.log('⚠️ SLOW QUERY - Needs optimization');
        } else if (duration > 100) {
          console.log('⚡ Moderate performance - Could be optimized');
        } else {
          console.log('✅ Good performance');
        }
        
      } catch (error) {
        console.log('❌ Query failed:', error.message);
      }
    }
  }

  // Optimize database settings
  async optimizeSettings() {
    console.log('\n⚙️ DATABASE OPTIMIZATION SETTINGS');
    console.log('='.repeat(50));

    try {
      // Set optimal PRAGMA settings
      const optimizations = [
        { pragma: 'PRAGMA cache_size = 10000', description: 'Increase cache to 10MB' },
        { pragma: 'PRAGMA temp_store = MEMORY', description: 'Use memory for temp tables' },
        { pragma: 'PRAGMA journal_mode = WAL', description: 'Use Write-Ahead Logging' },
        { pragma: 'PRAGMA synchronous = NORMAL', description: 'Balance safety and speed' },
        { pragma: 'PRAGMA optimize', description: 'Run query optimizer' },
        { pragma: 'PRAGMA analysis_limit = 1000', description: 'Analyze sample size' }
      ];

      for (const opt of optimizations) {
        try {
          await this.runQuery(opt.pragma);
          console.log(`✅ ${opt.description}`);
          console.log(`   ${opt.pragma}`);
        } catch (error) {
          console.log(`⚠️ Failed: ${opt.description}`);
          console.log(`   ${error.message}`);
        }
      }

      // Run ANALYZE to update statistics
      console.log('\n📊 Updating table statistics...');
      await this.runQuery('ANALYZE');
      console.log('✅ Statistics updated');

    } catch (error) {
      console.error('Error optimizing settings:', error);
    }
  }

  // Helper methods for database queries
  runQuery(sql) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  getQuery(sql) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  allQuery(sql) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Run full analysis
  async runFullAnalysis() {
    try {
      await this.connect();
      
      await this.getDatabaseStats();
      await this.analyzeTables();
      await this.analyzeIndexes();
      await this.analyzeQueryPerformance();
      await this.optimizeSettings();
      
      console.log('\n' + '='.repeat(50));
      console.log('✅ DATABASE ANALYSIS COMPLETE');
      console.log('='.repeat(50));
      
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      await this.close();
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const analyzer = new DatabaseAnalyzer();
  analyzer.runFullAnalysis().catch(console.error);
}

module.exports = DatabaseAnalyzer;