const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const logger = require('../utils/logger');
const EventEmitter = require('events');

/**
 * Database Connection Pool Manager
 * Manages multiple database connections for improved concurrency
 */
class ConnectionPool extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      database: options.database || './otb-database/complete-tournaments.db',
      minConnections: options.minConnections || 2,
      maxConnections: options.maxConnections || 10,
      acquireTimeout: options.acquireTimeout || 30000, // 30 seconds
      idleTimeout: options.idleTimeout || 60000, // 1 minute
      connectionTimeout: options.connectionTimeout || 5000, // 5 seconds
      ...options
    };
    
    this.pool = [];
    this.activeConnections = new Map();
    this.waitingQueue = [];
    this.stats = {
      created: 0,
      acquired: 0,
      released: 0,
      destroyed: 0,
      timeouts: 0,
      errors: 0,
      currentSize: 0,
      activeCount: 0,
      idleCount: 0,
      waitingCount: 0
    };
    
    this.initialized = false;
    this.closing = false;
  }

  /**
   * Initialize the connection pool
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    logger.info('Initializing connection pool', {
      min: this.options.minConnections,
      max: this.options.maxConnections
    });
    
    // Create minimum connections
    const promises = [];
    for (let i = 0; i < this.options.minConnections; i++) {
      promises.push(this.createConnection());
    }
    
    try {
      await Promise.all(promises);
      this.initialized = true;
      
      // Start idle connection checker
      this.startIdleChecker();
      
      logger.info('Connection pool initialized', {
        connections: this.pool.length
      });
      
      this.emit('initialized', this.stats);
    } catch (error) {
      logger.error('Failed to initialize connection pool', error);
      throw error;
    }
  }

  /**
   * Create a new database connection
   */
  async createConnection() {
    const startTime = Date.now();
    
    try {
      const connection = await open({
        filename: this.options.database,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READWRITE
      });
      
      // Apply optimizations to each connection
      await this.applyConnectionOptimizations(connection);
      
      const connectionInfo = {
        id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        connection,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        useCount: 0,
        inUse: false
      };
      
      this.pool.push(connectionInfo);
      this.stats.created++;
      this.stats.currentSize++;
      this.stats.idleCount++;
      
      const duration = Date.now() - startTime;
      logger.debug(`Connection created in ${duration}ms`, { id: connectionInfo.id });
      
      this.emit('connection-created', connectionInfo.id);
      
      return connectionInfo;
    } catch (error) {
      this.stats.errors++;
      logger.error('Failed to create connection', error);
      throw error;
    }
  }

  /**
   * Apply optimizations to a connection
   */
  async applyConnectionOptimizations(connection) {
    const optimizations = [
      'PRAGMA cache_size = 10000',
      'PRAGMA temp_store = MEMORY',
      'PRAGMA journal_mode = WAL',
      'PRAGMA synchronous = NORMAL',
      'PRAGMA automatic_index = ON'
    ];
    
    for (const pragma of optimizations) {
      await connection.run(pragma);
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire() {
    if (this.closing) {
      throw new Error('Connection pool is closing');
    }
    
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.stats.timeouts++;
        const index = this.waitingQueue.indexOf(request);
        if (index > -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Connection acquisition timeout'));
      }, this.options.acquireTimeout);
      
      const request = {
        resolve: (connection) => {
          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          logger.debug(`Connection acquired in ${duration}ms`, { id: connection.id });
          resolve(connection);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      };
      
      // Try to get an idle connection
      const idleConnection = this.getIdleConnection();
      
      if (idleConnection) {
        this.activateConnection(idleConnection);
        request.resolve(idleConnection);
      } else if (this.pool.length < this.options.maxConnections) {
        // Create a new connection if under limit
        this.createConnection()
          .then(connection => {
            this.activateConnection(connection);
            request.resolve(connection);
          })
          .catch(request.reject);
      } else {
        // Add to waiting queue
        this.waitingQueue.push(request);
        this.stats.waitingCount++;
        logger.debug('Connection request queued', { 
          queueLength: this.waitingQueue.length 
        });
      }
    });
  }

  /**
   * Get an idle connection from the pool
   */
  getIdleConnection() {
    for (const conn of this.pool) {
      if (!conn.inUse && !this.activeConnections.has(conn.id)) {
        return conn;
      }
    }
    return null;
  }

  /**
   * Activate a connection
   */
  activateConnection(connectionInfo) {
    connectionInfo.inUse = true;
    connectionInfo.lastUsed = Date.now();
    connectionInfo.useCount++;
    
    this.activeConnections.set(connectionInfo.id, connectionInfo);
    this.stats.acquired++;
    this.stats.activeCount++;
    this.stats.idleCount--;
    
    this.emit('connection-acquired', connectionInfo.id);
  }

  /**
   * Release a connection back to the pool
   */
  async release(connectionInfo) {
    if (!connectionInfo || !this.activeConnections.has(connectionInfo.id)) {
      logger.warn('Attempted to release invalid connection');
      return;
    }
    
    connectionInfo.inUse = false;
    connectionInfo.lastUsed = Date.now();
    
    this.activeConnections.delete(connectionInfo.id);
    this.stats.released++;
    this.stats.activeCount--;
    this.stats.idleCount++;
    
    logger.debug('Connection released', { id: connectionInfo.id });
    this.emit('connection-released', connectionInfo.id);
    
    // Process waiting queue
    if (this.waitingQueue.length > 0) {
      const request = this.waitingQueue.shift();
      this.stats.waitingCount--;
      this.activateConnection(connectionInfo);
      request.resolve(connectionInfo);
    }
  }

  /**
   * Execute a query with automatic connection management
   */
  async execute(callback) {
    let connection = null;
    
    try {
      connection = await this.acquire();
      const result = await callback(connection.connection);
      await this.release(connection);
      return result;
    } catch (error) {
      if (connection) {
        await this.release(connection);
      }
      throw error;
    }
  }

  /**
   * Execute a query with automatic connection management (convenience method)
   */
  async query(sql, params = []) {
    return this.execute(async (db) => {
      return await db.all(sql, params);
    });
  }

  /**
   * Get a single row
   */
  async get(sql, params = []) {
    return this.execute(async (db) => {
      return await db.get(sql, params);
    });
  }

  /**
   * Run a mutation query
   */
  async run(sql, params = []) {
    return this.execute(async (db) => {
      return await db.run(sql, params);
    });
  }

  /**
   * Destroy a connection
   */
  async destroyConnection(connectionInfo) {
    try {
      await connectionInfo.connection.close();
      
      const index = this.pool.indexOf(connectionInfo);
      if (index > -1) {
        this.pool.splice(index, 1);
      }
      
      this.activeConnections.delete(connectionInfo.id);
      
      this.stats.destroyed++;
      this.stats.currentSize--;
      
      if (connectionInfo.inUse) {
        this.stats.activeCount--;
      } else {
        this.stats.idleCount--;
      }
      
      logger.debug('Connection destroyed', { id: connectionInfo.id });
      this.emit('connection-destroyed', connectionInfo.id);
    } catch (error) {
      logger.error('Error destroying connection', error);
    }
  }

  /**
   * Start idle connection checker
   */
  startIdleChecker() {
    this.idleCheckInterval = setInterval(() => {
      this.checkIdleConnections();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check and remove idle connections
   */
  async checkIdleConnections() {
    const now = Date.now();
    const toDestroy = [];
    
    for (const conn of this.pool) {
      if (!conn.inUse && 
          this.pool.length > this.options.minConnections &&
          now - conn.lastUsed > this.options.idleTimeout) {
        toDestroy.push(conn);
      }
    }
    
    for (const conn of toDestroy) {
      await this.destroyConnection(conn);
      logger.debug('Idle connection removed', { id: conn.id });
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.stats,
      waitingCount: this.waitingQueue.length,
      poolSize: this.pool.length,
      activeConnections: Array.from(this.activeConnections.keys()),
      averageUseCount: this.pool.reduce((sum, c) => sum + c.useCount, 0) / this.pool.length || 0
    };
  }

  /**
   * Close all connections
   */
  async close() {
    this.closing = true;
    
    logger.info('Closing connection pool');
    
    // Clear intervals
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }
    
    // Reject waiting requests
    for (const request of this.waitingQueue) {
      request.reject(new Error('Connection pool is closing'));
    }
    this.waitingQueue = [];
    
    // Wait for active connections to be released
    const maxWait = 5000;
    const startTime = Date.now();
    
    while (this.activeConnections.size > 0 && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Close all connections
    const promises = this.pool.map(conn => this.destroyConnection(conn));
    await Promise.all(promises);
    
    this.initialized = false;
    this.closing = false;
    
    logger.info('Connection pool closed', this.stats);
    this.emit('closed', this.stats);
  }
}

// Create singleton instance
let poolInstance = null;

/**
 * Get or create the connection pool instance
 */
function getPool(options) {
  if (!poolInstance) {
    poolInstance = new ConnectionPool(options);
  }
  return poolInstance;
}

module.exports = {
  ConnectionPool,
  getPool
};