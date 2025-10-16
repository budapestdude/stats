const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Optimized Database Service
 * Provides connection pooling, query optimization, and caching
 */
class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = config.database.sqlite.path;
    this.connectionPool = [];
    this.maxConnections = 10;
    this.queryCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.preparedStatements = new Map();
  }

  /**
   * Initialize database connection with optimizations
   */
  async initialize() {
    try {
      // Open database with sqlite wrapper for better async/await support
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
      });

      // Apply performance optimizations
      await this.applyOptimizations();
      
      // Create indexes if they don't exist
      await this.createIndexes();
      
      // Prepare common statements
      await this.prepareStatements();
      
      logger.info('Database initialized successfully', { path: this.dbPath });
      
      return this.db;
    } catch (error) {
      logger.error('Database initialization failed', error);
      throw error;
    }
  }

  /**
   * Apply SQLite performance optimizations
   */
  async applyOptimizations() {
    const optimizations = [
      // Memory and cache settings
      'PRAGMA cache_size = 10000',        // 10MB cache
      'PRAGMA temp_store = MEMORY',       // Use memory for temp tables
      'PRAGMA mmap_size = 30000000000',   // 30GB memory-mapped I/O
      
      // Write performance
      'PRAGMA journal_mode = WAL',        // Write-Ahead Logging
      'PRAGMA synchronous = NORMAL',      // Balance safety and speed
      'PRAGMA wal_autocheckpoint = 1000', // Auto-checkpoint every 1000 pages
      
      // Query optimization
      'PRAGMA optimize',                  // Run optimizer
      'PRAGMA analysis_limit = 1000',     // Analyze sample size
      'PRAGMA automatic_index = ON',      // Allow automatic indexes
      
      // Foreign keys and constraints
      'PRAGMA foreign_keys = ON',         // Enable foreign key constraints
      'PRAGMA recursive_triggers = ON'    // Enable recursive triggers
    ];

    for (const pragma of optimizations) {
      try {
        await this.db.run(pragma);
        logger.debug(`Applied: ${pragma}`);
      } catch (error) {
        logger.warn(`Failed to apply: ${pragma}`, error);
      }
    }
  }

  /**
   * Create optimized indexes for common queries
   */
  async createIndexes() {
    const indexes = [
      // Games table indexes
      {
        name: 'idx_games_players',
        table: 'games',
        columns: ['White', 'Black'],
        where: null
      },
      {
        name: 'idx_games_date',
        table: 'games',
        columns: ['Date'],
        where: null
      },
      {
        name: 'idx_games_eco',
        table: 'games',
        columns: ['ECO'],
        where: null
      },
      {
        name: 'idx_games_event',
        table: 'games',
        columns: ['Event'],
        where: null
      },
      {
        name: 'idx_games_result',
        table: 'games',
        columns: ['Result'],
        where: null
      },
      {
        name: 'idx_games_white_result',
        table: 'games',
        columns: ['White', 'Result'],
        where: null
      },
      {
        name: 'idx_games_black_result',
        table: 'games',
        columns: ['Black', 'Result'],
        where: null
      },
      
      // Players table indexes
      {
        name: 'idx_players_name',
        table: 'players',
        columns: ['name'],
        where: null
      },
      {
        name: 'idx_players_rating',
        table: 'players',
        columns: ['rating'],
        where: 'rating IS NOT NULL'
      },
      {
        name: 'idx_players_country',
        table: 'players',
        columns: ['country'],
        where: null
      },
      
      // Tournaments table indexes
      {
        name: 'idx_tournaments_dates',
        table: 'tournaments',
        columns: ['start_date', 'end_date'],
        where: null
      },
      {
        name: 'idx_tournaments_name',
        table: 'tournaments',
        columns: ['name'],
        where: null
      },
      {
        name: 'idx_tournaments_location',
        table: 'tournaments',
        columns: ['location'],
        where: null
      },
      
      // Openings table indexes
      {
        name: 'idx_openings_eco',
        table: 'openings',
        columns: ['eco'],
        where: null
      },
      {
        name: 'idx_openings_name',
        table: 'openings',
        columns: ['name'],
        where: null
      }
    ];

    for (const index of indexes) {
      try {
        // Check if table exists first
        const tableExists = await this.db.get(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
          index.table
        );
        
        if (!tableExists) {
          logger.debug(`Table ${index.table} does not exist, skipping index ${index.name}`);
          continue;
        }

        // Check if index already exists
        const indexExists = await this.db.get(
          `SELECT name FROM sqlite_master WHERE type='index' AND name=?`,
          index.name
        );
        
        if (!indexExists) {
          let sql = `CREATE INDEX IF NOT EXISTS ${index.name} ON ${index.table}(${index.columns.join(', ')})`;
          if (index.where) {
            sql += ` WHERE ${index.where}`;
          }
          
          await this.db.run(sql);
          logger.info(`Created index: ${index.name}`);
        }
      } catch (error) {
        logger.warn(`Failed to create index ${index.name}:`, error.message);
      }
    }
  }

  /**
   * Prepare frequently used statements
   */
  async prepareStatements() {
    const statements = {
      getPlayerGames: `
        SELECT * FROM games 
        WHERE White = ? OR Black = ? 
        ORDER BY Date DESC 
        LIMIT ? OFFSET ?
      `,
      getPlayerStats: `
        SELECT 
          COUNT(*) as total_games,
          SUM(CASE WHEN White = ? AND Result = '1-0' THEN 1 ELSE 0 END) +
          SUM(CASE WHEN Black = ? AND Result = '0-1' THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN (White = ? OR Black = ?) AND Result = '1/2-1/2' THEN 1 ELSE 0 END) as draws
        FROM games
      `,
      getGamesByDate: `
        SELECT * FROM games 
        WHERE Date BETWEEN ? AND ? 
        ORDER BY Date DESC 
        LIMIT ? OFFSET ?
      `,
      getGamesByOpening: `
        SELECT * FROM games 
        WHERE ECO = ? 
        LIMIT ? OFFSET ?
      `,
      getTournamentGames: `
        SELECT * FROM games 
        WHERE Event = ? 
        ORDER BY Round, Board
      `,
      searchPlayers: `
        SELECT * FROM players 
        WHERE name LIKE ? 
        ORDER BY rating DESC 
        LIMIT ?
      `,
      getTopPlayers: `
        SELECT * FROM players 
        WHERE rating IS NOT NULL 
        ORDER BY rating DESC 
        LIMIT ?
      `,
      getOpeningStats: `
        SELECT 
          ECO, 
          COUNT(*) as games,
          SUM(CASE WHEN Result = '1-0' THEN 1 ELSE 0 END) as white_wins,
          SUM(CASE WHEN Result = '0-1' THEN 1 ELSE 0 END) as black_wins,
          SUM(CASE WHEN Result = '1/2-1/2' THEN 1 ELSE 0 END) as draws
        FROM games
        WHERE ECO IS NOT NULL
        GROUP BY ECO
        ORDER BY games DESC
        LIMIT ?
      `
    };

    for (const [name, sql] of Object.entries(statements)) {
      try {
        const stmt = await this.db.prepare(sql);
        this.preparedStatements.set(name, stmt);
        logger.debug(`Prepared statement: ${name}`);
      } catch (error) {
        logger.warn(`Failed to prepare statement ${name}:`, error.message);
      }
    }
  }

  /**
   * Execute a prepared statement with caching
   */
  async executePrepared(name, params, options = {}) {
    const { cache = true, cacheKey = null, ttl = this.cacheTimeout } = options;
    
    // Generate cache key
    const key = cacheKey || `${name}:${JSON.stringify(params)}`;
    
    // Check cache
    if (cache && this.queryCache.has(key)) {
      const cached = this.queryCache.get(key);
      if (Date.now() - cached.timestamp < ttl) {
        logger.debug(`Cache hit for: ${name}`);
        return cached.data;
      }
    }
    
    // Execute statement
    const stmt = this.preparedStatements.get(name);
    if (!stmt) {
      throw new Error(`Prepared statement not found: ${name}`);
    }
    
    const startTime = Date.now();
    const result = await stmt.all(...params);
    const duration = Date.now() - startTime;
    
    logger.debug(`Query executed: ${name} (${duration}ms)`);
    
    // Cache result
    if (cache) {
      this.queryCache.set(key, {
        data: result,
        timestamp: Date.now()
      });
      
      // Clean old cache entries
      this.cleanCache();
    }
    
    return result;
  }

  /**
   * Execute a raw query with optional caching
   */
  async query(sql, params = [], options = {}) {
    const { cache = false, cacheKey = null, ttl = this.cacheTimeout } = options;
    
    // Generate cache key
    const key = cacheKey || `${sql}:${JSON.stringify(params)}`;
    
    // Check cache
    if (cache && this.queryCache.has(key)) {
      const cached = this.queryCache.get(key);
      if (Date.now() - cached.timestamp < ttl) {
        logger.debug('Cache hit for query');
        return cached.data;
      }
    }
    
    // Execute query
    const startTime = Date.now();
    const result = await this.db.all(sql, params);
    const duration = Date.now() - startTime;
    
    logger.debug(`Query executed (${duration}ms): ${sql.substring(0, 50)}...`);
    
    // Log slow queries
    if (duration > 1000) {
      logger.warn('Slow query detected', { sql, duration, params });
    }
    
    // Cache result
    if (cache) {
      this.queryCache.set(key, {
        data: result,
        timestamp: Date.now()
      });
    }
    
    return result;
  }

  /**
   * Execute a single row query
   */
  async get(sql, params = [], options = {}) {
    const results = await this.query(sql, params, options);
    return results[0] || null;
  }

  /**
   * Execute an INSERT/UPDATE/DELETE query
   */
  async run(sql, params = []) {
    const startTime = Date.now();
    const result = await this.db.run(sql, params);
    const duration = Date.now() - startTime;
    
    logger.debug(`Mutation executed (${duration}ms): ${sql.substring(0, 50)}...`);
    
    // Clear relevant cache entries
    this.invalidateCache();
    
    return result;
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction(callback) {
    await this.db.run('BEGIN TRANSACTION');
    
    try {
      const result = await callback(this);
      await this.db.run('COMMIT');
      return result;
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Batch insert for better performance
   */
  async batchInsert(table, columns, rows, chunkSize = 500) {
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    const stmt = await this.db.prepare(sql);
    
    let inserted = 0;
    await this.transaction(async () => {
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        
        for (const row of chunk) {
          await stmt.run(...row);
          inserted++;
        }
        
        logger.debug(`Inserted ${inserted}/${rows.length} rows into ${table}`);
      }
    });
    
    await stmt.finalize();
    
    return inserted;
  }

  /**
   * Clean expired cache entries
   */
  cleanCache() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.queryCache.delete(key));
    
    if (expiredKeys.length > 0) {
      logger.debug(`Cleaned ${expiredKeys.length} expired cache entries`);
    }
  }

  /**
   * Invalidate cache entries
   */
  invalidateCache(pattern = null) {
    if (!pattern) {
      this.queryCache.clear();
      logger.debug('Cleared all cache');
      return;
    }
    
    const keysToDelete = [];
    for (const key of this.queryCache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.queryCache.delete(key));
    logger.debug(`Invalidated ${keysToDelete.length} cache entries`);
  }

  /**
   * Get database statistics
   */
  async getStats() {
    const stats = {
      tables: {},
      indexes: [],
      size: 0,
      cache: {
        size: this.queryCache.size,
        maxSize: 1000
      }
    };
    
    // Get table statistics
    const tables = await this.query(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    
    for (const table of tables) {
      const count = await this.get(
        `SELECT COUNT(*) as count FROM ${table.name}`
      );
      stats.tables[table.name] = count.count;
    }
    
    // Get index information
    const indexes = await this.query(
      "SELECT name, tbl_name FROM sqlite_master WHERE type='index'"
    );
    stats.indexes = indexes;
    
    // Get database size
    const pragma = await this.get('PRAGMA page_count');
    const pageSize = await this.get('PRAGMA page_size');
    if (pragma && pageSize) {
      stats.size = pragma.page_count * pageSize.page_size;
    }
    
    return stats;
  }

  /**
   * Close database connection
   */
  async close() {
    // Finalize all prepared statements
    for (const stmt of this.preparedStatements.values()) {
      await stmt.finalize();
    }
    
    // Clear cache
    this.queryCache.clear();
    
    // Close connection
    if (this.db) {
      await this.db.close();
      logger.info('Database connection closed');
    }
  }

  /**
   * Analyze and vacuum database
   */
  async optimize() {
    logger.info('Starting database optimization...');
    
    // Update statistics
    await this.db.run('ANALYZE');
    logger.info('Statistics updated');
    
    // Vacuum to reclaim space
    await this.db.run('VACUUM');
    logger.info('Database vacuumed');
    
    // Re-optimize
    await this.db.run('PRAGMA optimize');
    logger.info('Database optimized');
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

module.exports = databaseService;