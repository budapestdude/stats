const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseManager {
  constructor() {
    this.mainDb = null;
    this.movesDb = null;
    this.connections = new Map();
  }

  async initialize() {
    const mainDbPath = path.join(__dirname, '..', 'otb-database', 'complete-tournaments.db');
    const movesDbPath = path.join(__dirname, '..', 'chess-stats.db');

    // Initialize main database
    if (fs.existsSync(mainDbPath)) {
      this.mainDb = await this.openDatabase(mainDbPath, 'main');
      await this.applyOptimizations(this.mainDb);
      const count = await this.getGameCount(this.mainDb);
      console.log(`✓ Main database connected: ${count.toLocaleString()} games`);
    }

    // Initialize moves database
    if (fs.existsSync(movesDbPath)) {
      this.movesDb = await this.openDatabase(movesDbPath, 'moves');
      await this.applyOptimizations(this.movesDb);
      const count = await this.getGameCount(this.movesDb);
      console.log(`✓ Moves database connected: ${count.toLocaleString()} games with moves`);
    }

    return { mainDb: this.mainDb, movesDb: this.movesDb };
  }

  openDatabase(dbPath, name) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          console.error(`Error opening ${name} database:`, err);
          reject(err);
        } else {
          this.connections.set(name, db);
          resolve(db);
        }
      });
    });
  }

  async applyOptimizations(db) {
    if (!db) return;
    
    // Read-only optimizations that don't require write access
    const readOnlyOptimizations = [
      'PRAGMA cache_size = -64000', // 64MB cache
      'PRAGMA temp_store = MEMORY',
      'PRAGMA mmap_size = 268435456', // 256MB memory-mapped I/O
      'PRAGMA threads = 4'
    ];

    for (const pragma of readOnlyOptimizations) {
      try {
        await this.runQuery(db, pragma);
      } catch (err) {
        // Silently ignore PRAGMA errors for read-only databases
        console.log(`Note: Could not apply optimization: ${pragma}`);
      }
    }
  }

  runQuery(db, sql, params = []) {
    return new Promise((resolve, reject) => {
      // Use db.exec for PRAGMA statements (read-only)
      if (sql.trim().toUpperCase().startsWith('PRAGMA')) {
        try {
          db.exec(sql);
          resolve({ success: true });
        } catch (err) {
          reject(err);
        }
      } else {
        // Use db.run for actual write operations
        db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve(this);
        });
      }
    });
  }

  getOne(db, sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  getAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getGameCount(db) {
    const result = await this.getOne(db, 'SELECT COUNT(*) as count FROM games');
    return result ? result.count : 0;
  }

  close() {
    for (const [name, db] of this.connections) {
      db.close((err) => {
        if (err) console.error(`Error closing ${name} database:`, err);
        else console.log(`Closed ${name} database`);
      });
    }
    this.connections.clear();
  }
}

// Singleton instance
const dbManager = new DatabaseManager();

module.exports = dbManager;