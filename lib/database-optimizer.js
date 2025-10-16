const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const NodeCache = require('node-cache');

class DatabaseOptimizer {
  constructor(dbPath, options = {}) {
    this.dbPath = dbPath;
    this.options = {
      maxConnections: options.maxConnections || 10,
      cacheEnabled: options.cacheEnabled !== false,
      cacheTTL: options.cacheTTL || 300, // 5 minutes default
      cacheCheckPeriod: options.cacheCheckPeriod || 60,
      enableWAL: options.enableWAL !== false,
      enableQueryStats: options.enableQueryStats || false,
      ...options
    };
    
    this.connections = [];
    this.availableConnections = [];
    this.waitingQueue = [];
    this.queryStats = new Map();
    
    // Initialize cache with TTL
    if (this.options.cacheEnabled) {
      this.cache = new NodeCache({
        stdTTL: this.options.cacheTTL,
        checkperiod: this.options.cacheCheckPeriod,
        useClones: false // Don't clone for better performance
      });
    }
    
    this.initializePool();
  }
  
  initializePool() {
    for (let i = 0; i < this.options.maxConnections; i++) {
      this.createConnection();
    }
  }
  
  createConnection() {
    const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error('Error opening database connection:', err);
        return;
      }
      
      // Performance optimizations (don't modify journal mode for read-only)
      db.serialize(() => {
        db.run('PRAGMA cache_size = -64000'); // 64MB cache
        db.run('PRAGMA temp_store = MEMORY');
        db.run('PRAGMA mmap_size = 268435456'); // 256MB memory-mapped I/O
        db.run('PRAGMA threads = 4'); // Multi-threading for sorting
      });
    });
    
    const connection = {
      db,
      inUse: false,
      lastUsed: Date.now()
    };
    
    this.connections.push(connection);
    this.availableConnections.push(connection);
    return connection;
  }
  
  async getConnection() {
    // Try to get an available connection
    let connection = this.availableConnections.pop();
    
    if (!connection) {
      // Wait for a connection to become available
      return new Promise((resolve) => {
        this.waitingQueue.push(resolve);
      });
    }
    
    connection.inUse = true;
    connection.lastUsed = Date.now();
    return connection;
  }
  
  releaseConnection(connection) {
    connection.inUse = false;
    
    // Check if anyone is waiting
    if (this.waitingQueue.length > 0) {
      const resolve = this.waitingQueue.shift();
      connection.inUse = true;
      connection.lastUsed = Date.now();
      resolve(connection);
    } else {
      this.availableConnections.push(connection);
    }
  }
  
  getCacheKey(query, params) {
    return `${query}_${JSON.stringify(params || [])}`;
  }
  
  async query(sql, params = [], options = {}) {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(sql, params);
    
    // Check cache first
    if (this.options.cacheEnabled && !options.skipCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        if (this.options.enableQueryStats) {
          this.updateQueryStats(sql, Date.now() - startTime, true);
        }
        return cached;
      }
    }
    
    const connection = await this.getConnection();
    
    return new Promise((resolve, reject) => {
      const method = sql.trim().toUpperCase().startsWith('SELECT') ? 'all' : 'run';
      
      connection.db[method](sql, params, (err, result) => {
        this.releaseConnection(connection);
        
        if (err) {
          reject(err);
          return;
        }
        
        // Cache the result
        if (this.options.cacheEnabled && method === 'all' && !options.skipCache) {
          const ttl = options.cacheTTL || this.options.cacheTTL;
          this.cache.set(cacheKey, result, ttl);
        }
        
        if (this.options.enableQueryStats) {
          this.updateQueryStats(sql, Date.now() - startTime, false);
        }
        
        resolve(result);
      });
    });
  }
  
  async queryOne(sql, params = [], options = {}) {
    const results = await this.query(sql, params, options);
    return Array.isArray(results) ? results[0] : results;
  }
  
  // Optimized pagination query
  async queryPaginated(sql, params = [], page = 1, pageSize = 50, options = {}) {
    const offset = (page - 1) * pageSize;
    const paginatedSql = `${sql} LIMIT ? OFFSET ?`;
    const paginatedParams = [...params, pageSize, offset];
    
    // Get total count if requested
    if (options.includeTotal) {
      const countSql = sql.replace(/SELECT.*?FROM/i, 'SELECT COUNT(*) as total FROM')
                          .replace(/ORDER BY.*$/i, '');
      const [results, countResult] = await Promise.all([
        this.query(paginatedSql, paginatedParams, options),
        this.queryOne(countSql, params, { ...options, cacheTTL: 60 })
      ]);
      
      return {
        data: results,
        total: countResult?.total || 0,
        page,
        pageSize,
        totalPages: Math.ceil((countResult?.total || 0) / pageSize)
      };
    }
    
    return this.query(paginatedSql, paginatedParams, options);
  }
  
  // Batch query execution for better performance
  async batchQuery(queries) {
    const connection = await this.getConnection();
    
    return new Promise((resolve, reject) => {
      const results = [];
      
      connection.db.serialize(() => {
        connection.db.run('BEGIN TRANSACTION');
        
        for (const { sql, params } of queries) {
          connection.db.all(sql, params || [], (err, rows) => {
            if (err) {
              connection.db.run('ROLLBACK');
              this.releaseConnection(connection);
              reject(err);
              return;
            }
            results.push(rows);
          });
        }
        
        connection.db.run('COMMIT', (err) => {
          this.releaseConnection(connection);
          if (err) {
            reject(err);
          } else {
            resolve(results);
          }
        });
      });
    });
  }
  
  // Full-text search optimization
  async searchGames(searchParams, page = 1, pageSize = 50) {
    const conditions = [];
    const params = [];
    
    if (searchParams.player) {
      conditions.push('(white LIKE ? OR black LIKE ?)');
      params.push(`%${searchParams.player}%`, `%${searchParams.player}%`);
    }
    
    if (searchParams.event) {
      conditions.push('event LIKE ?');
      params.push(`%${searchParams.event}%`);
    }
    
    if (searchParams.opening) {
      conditions.push('(eco LIKE ? OR opening LIKE ?)');
      params.push(`%${searchParams.opening}%`, `%${searchParams.opening}%`);
    }
    
    if (searchParams.year) {
      conditions.push('SUBSTR(date, 1, 4) = ?');
      params.push(searchParams.year);
    }
    
    if (searchParams.minElo) {
      conditions.push('(white_elo >= ? OR black_elo >= ?)');
      params.push(searchParams.minElo, searchParams.minElo);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const sql = `
      SELECT 
        id,
        white,
        black,
        result,
        date,
        event,
        eco,
        opening,
        white_elo,
        black_elo,
        time_control
      FROM games
      ${whereClause}
      ORDER BY date DESC
    `;
    
    return this.queryPaginated(sql, params, page, pageSize, { includeTotal: true });
  }
  
  // Get player statistics with caching
  async getPlayerStats(playerName) {
    const cacheKey = `player_stats_${playerName}`;
    
    // Check cache with longer TTL for player stats
    if (this.options.cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }
    
    const queries = [
      {
        sql: `
          SELECT 
            COUNT(*) as total_games,
            SUM(CASE WHEN white = ? AND result = '1-0' THEN 1
                     WHEN black = ? AND result = '0-1' THEN 1
                     ELSE 0 END) as wins,
            SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
            SUM(CASE WHEN white = ? AND result = '0-1' THEN 1
                     WHEN black = ? AND result = '1-0' THEN 1
                     ELSE 0 END) as losses,
            AVG(CASE WHEN white = ? THEN white_elo
                     WHEN black = ? THEN black_elo
                     END) as avg_rating,
            MAX(CASE WHEN white = ? THEN white_elo
                     WHEN black = ? THEN black_elo
                     END) as peak_rating
          FROM games
          WHERE white = ? OR black = ?
        `,
        params: Array(10).fill(playerName)
      },
      {
        sql: `
          SELECT 
            eco,
            opening,
            COUNT(*) as count,
            SUM(CASE WHEN (white = ? AND result = '1-0') OR 
                          (black = ? AND result = '0-1') THEN 1 ELSE 0 END) as wins
          FROM games
          WHERE white = ? OR black = ?
          GROUP BY eco, opening
          ORDER BY count DESC
          LIMIT 10
        `,
        params: [playerName, playerName, playerName, playerName]
      }
    ];
    
    const [basicStats, openings] = await this.batchQuery(queries);
    
    const stats = {
      ...basicStats[0],
      topOpenings: openings,
      winRate: basicStats[0] ? (basicStats[0].wins / basicStats[0].total_games * 100).toFixed(1) : 0
    };
    
    // Cache with longer TTL
    if (this.options.cacheEnabled) {
      this.cache.set(cacheKey, stats, 600); // 10 minutes
    }
    
    return stats;
  }
  
  updateQueryStats(sql, duration, fromCache) {
    if (!this.options.enableQueryStats) return;
    
    const key = sql.substring(0, 100); // Truncate for key
    const stats = this.queryStats.get(key) || {
      count: 0,
      totalDuration: 0,
      cacheHits: 0,
      avgDuration: 0
    };
    
    stats.count++;
    if (fromCache) {
      stats.cacheHits++;
    } else {
      stats.totalDuration += duration;
      stats.avgDuration = stats.totalDuration / (stats.count - stats.cacheHits);
    }
    
    this.queryStats.set(key, stats);
  }
  
  getQueryStats() {
    return Array.from(this.queryStats.entries())
      .map(([query, stats]) => ({ query, ...stats }))
      .sort((a, b) => b.count - a.count);
  }
  
  clearCache() {
    if (this.cache) {
      this.cache.flushAll();
    }
  }
  
  async createIndexes() {
    // Indexes already created by create-indexes.js
    console.log('Using existing database indexes');
  }
  
  async close() {
    // Close all connections
    for (const connection of this.connections) {
      connection.db.close();
    }
    
    // Clear cache
    if (this.cache) {
      this.cache.flushAll();
      this.cache.close();
    }
  }
}

module.exports = DatabaseOptimizer;