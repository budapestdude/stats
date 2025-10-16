const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

class SQLiteToPostgresMigrator {
  constructor(sqlitePath, pgConfig) {
    this.sqlitePath = sqlitePath;
    this.pgConfig = {
      host: pgConfig.host || process.env.DB_HOST || 'localhost',
      port: pgConfig.port || process.env.DB_PORT || 5432,
      database: pgConfig.database || process.env.DB_NAME || 'chess_stats',
      user: pgConfig.user || process.env.DB_USER || 'postgres',
      password: pgConfig.password || process.env.DB_PASSWORD || '',
      ...pgConfig
    };
    
    this.sqliteDb = null;
    this.pgClient = null;
    this.batchSize = 1000;
  }

  async connect() {
    // Connect to SQLite
    return new Promise((resolve, reject) => {
      this.sqliteDb = new sqlite3.Database(this.sqlitePath, (err) => {
        if (err) {
          reject(new Error(`SQLite connection failed: ${err.message}`));
        } else {
          console.log('✅ Connected to SQLite database');
          resolve();
        }
      });
    });
  }

  async connectPostgres() {
    try {
      this.pgClient = new Client(this.pgConfig);
      await this.pgClient.connect();
      console.log('✅ Connected to PostgreSQL database');
    } catch (error) {
      throw new Error(`PostgreSQL connection failed: ${error.message}`);
    }
  }

  async disconnect() {
    if (this.sqliteDb) {
      this.sqliteDb.close();
      console.log('📦 SQLite connection closed');
    }
    if (this.pgClient) {
      await this.pgClient.end();
      console.log('📦 PostgreSQL connection closed');
    }
  }

  async getTableCount(tableName) {
    return new Promise((resolve, reject) => {
      this.sqliteDb.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  }

  async migratePlayers() {
    console.log('🔄 Migrating players...');
    
    const count = await this.getTableCount('players');
    console.log(`📊 Found ${count} players to migrate`);
    
    if (count === 0) return;
    
    // Clear existing data
    await this.pgClient.query('TRUNCATE TABLE players RESTART IDENTITY CASCADE');
    
    let offset = 0;
    let migrated = 0;
    
    while (offset < count) {
      const players = await new Promise((resolve, reject) => {
        const query = `SELECT * FROM players LIMIT ${this.batchSize} OFFSET ${offset}`;
        this.sqliteDb.all(query, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      if (players.length === 0) break;
      
      // Prepare batch insert
      const values = [];
      const placeholders = [];
      let paramIndex = 1;
      
      for (const player of players) {
        placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6})`);
        values.push(
          player.name,
          player.title,
          player.country,
          player.rating_standard,
          player.rating_rapid,
          player.rating_blitz,
          player.rating_bullet
        );
        paramIndex += 7;
      }
      
      const insertQuery = `
        INSERT INTO players (name, title, country, rating_standard, rating_rapid, rating_blitz, rating_bullet)
        VALUES ${placeholders.join(', ')}
      `;
      
      await this.pgClient.query(insertQuery, values);
      
      migrated += players.length;
      offset += this.batchSize;
      
      const progress = Math.round((migrated / count) * 100);
      console.log(`  📈 Progress: ${migrated}/${count} (${progress}%)`);
    }
    
    console.log('✅ Players migration completed');
  }

  async migrateTournaments() {
    console.log('🔄 Migrating tournaments...');
    
    const count = await this.getTableCount('tournaments');
    console.log(`📊 Found ${count} tournaments to migrate`);
    
    if (count === 0) return;
    
    // Clear existing data
    await this.pgClient.query('TRUNCATE TABLE tournaments RESTART IDENTITY CASCADE');
    
    let offset = 0;
    let migrated = 0;
    
    while (offset < count) {
      const tournaments = await new Promise((resolve, reject) => {
        const query = `SELECT * FROM tournaments LIMIT ${this.batchSize} OFFSET ${offset}`;
        this.sqliteDb.all(query, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      if (tournaments.length === 0) break;
      
      // Prepare batch insert
      const values = [];
      const placeholders = [];
      let paramIndex = 1;
      
      for (const tournament of tournaments) {
        placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6})`);
        values.push(
          tournament.name,
          tournament.location,
          tournament.start_date,
          tournament.end_date,
          tournament.time_control,
          tournament.rounds,
          tournament.players_count || 0
        );
        paramIndex += 7;
      }
      
      const insertQuery = `
        INSERT INTO tournaments (name, location, start_date, end_date, time_control, rounds, players_count)
        VALUES ${placeholders.join(', ')}
      `;
      
      await this.pgClient.query(insertQuery, values);
      
      migrated += tournaments.length;
      offset += this.batchSize;
      
      const progress = Math.round((migrated / count) * 100);
      console.log(`  📈 Progress: ${migrated}/${count} (${progress}%)`);
    }
    
    console.log('✅ Tournaments migration completed');
  }

  async migrateGames() {
    console.log('🔄 Migrating games...');
    
    const count = await this.getTableCount('games');
    console.log(`📊 Found ${count} games to migrate`);
    
    if (count === 0) return;
    
    // Clear existing data
    await this.pgClient.query('TRUNCATE TABLE games RESTART IDENTITY CASCADE');
    
    let offset = 0;
    let migrated = 0;
    const startTime = Date.now();
    
    while (offset < count) {
      const games = await new Promise((resolve, reject) => {
        const query = `SELECT * FROM games LIMIT ${this.batchSize} OFFSET ${offset}`;
        this.sqliteDb.all(query, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      if (games.length === 0) break;
      
      // Prepare batch insert
      const values = [];
      const placeholders = [];
      let paramIndex = 1;
      
      for (const game of games) {
        placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12})`);
        values.push(
          game.tournament_id,
          game.round,
          game.white_player,
          game.black_player,
          game.result,
          game.eco,
          game.opening,
          game.moves,
          game.game_date,
          game.white_elo,
          game.black_elo,
          game.ply_count,
          game.time_control
        );
        paramIndex += 13;
      }
      
      const insertQuery = `
        INSERT INTO games (tournament_id, round, white_player, black_player, result, eco, opening, moves, game_date, white_elo, black_elo, ply_count, time_control)
        VALUES ${placeholders.join(', ')}
      `;
      
      await this.pgClient.query(insertQuery, values);
      
      migrated += games.length;
      offset += this.batchSize;
      
      const progress = Math.round((migrated / count) * 100);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const rate = Math.round(migrated / elapsed);
      console.log(`  📈 Progress: ${migrated}/${count} (${progress}%) - ${rate} games/sec`);
    }
    
    console.log('✅ Games migration completed');
  }

  async migrateOpenings() {
    console.log('🔄 Migrating openings...');
    
    // Check if openings table exists in SQLite
    const tableExists = await new Promise((resolve, reject) => {
      const query = "SELECT name FROM sqlite_master WHERE type='table' AND name='openings'";
      this.sqliteDb.get(query, (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      });
    });
    
    if (!tableExists) {
      console.log('ℹ️ No openings table found in SQLite, skipping...');
      return;
    }
    
    const count = await this.getTableCount('openings');
    console.log(`📊 Found ${count} openings to migrate`);
    
    if (count === 0) return;
    
    // Clear existing non-default data
    await this.pgClient.query('DELETE FROM openings WHERE eco NOT IN (\'A00\', \'A04\', \'A45\', \'B00\', \'B12\', \'C20\', \'C45\', \'D00\', \'D20\', \'E60\')');
    
    let offset = 0;
    let migrated = 0;
    
    while (offset < count) {
      const openings = await new Promise((resolve, reject) => {
        const query = `SELECT * FROM openings LIMIT ${this.batchSize} OFFSET ${offset}`;
        this.sqliteDb.all(query, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      if (openings.length === 0) break;
      
      for (const opening of openings) {
        const insertQuery = `
          INSERT INTO openings (eco, name, moves, fen, games_count, white_wins, black_wins, draws)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (eco) DO UPDATE SET
            name = EXCLUDED.name,
            moves = EXCLUDED.moves,
            fen = EXCLUDED.fen,
            games_count = EXCLUDED.games_count,
            white_wins = EXCLUDED.white_wins,
            black_wins = EXCLUDED.black_wins,
            draws = EXCLUDED.draws,
            updated_at = CURRENT_TIMESTAMP
        `;
        
        await this.pgClient.query(insertQuery, [
          opening.eco,
          opening.name,
          opening.moves,
          opening.fen,
          opening.games_count || 0,
          opening.white_wins || 0,
          opening.black_wins || 0,
          opening.draws || 0
        ]);
      }
      
      migrated += openings.length;
      offset += this.batchSize;
      
      const progress = Math.round((migrated / count) * 100);
      console.log(`  📈 Progress: ${migrated}/${count} (${progress}%)`);
    }
    
    console.log('✅ Openings migration completed');
  }

  async refreshStatistics() {
    console.log('🔄 Refreshing materialized views...');
    
    try {
      await this.pgClient.query('REFRESH MATERIALIZED VIEW player_statistics');
      await this.pgClient.query('REFRESH MATERIALIZED VIEW tournament_statistics');
      console.log('✅ Materialized views refreshed');
    } catch (error) {
      console.warn('⚠️ Failed to refresh materialized views:', error.message);
    }
  }

  async validateMigration() {
    console.log('🔍 Validating migration...');
    
    const tables = ['players', 'tournaments', 'games'];
    const validation = {};
    
    for (const table of tables) {
      // Count in SQLite
      const sqliteCount = await this.getTableCount(table);
      
      // Count in PostgreSQL
      const pgResult = await this.pgClient.query(`SELECT COUNT(*) FROM ${table}`);
      const pgCount = parseInt(pgResult.rows[0].count);
      
      validation[table] = {
        sqlite: sqliteCount,
        postgres: pgCount,
        match: sqliteCount === pgCount
      };
      
      if (validation[table].match) {
        console.log(`✅ ${table}: ${pgCount} records migrated successfully`);
      } else {
        console.log(`❌ ${table}: SQLite=${sqliteCount}, PostgreSQL=${pgCount}`);
      }
    }
    
    return validation;
  }

  async migrate() {
    const startTime = Date.now();
    
    try {
      console.log('🚀 Starting SQLite to PostgreSQL migration...');
      
      await this.connect();
      await this.connectPostgres();
      
      // Migrate tables in order (respecting foreign keys)
      await this.migrateTournaments();
      await this.migratePlayers();
      await this.migrateGames();
      await this.migrateOpenings();
      
      // Refresh statistics
      await this.refreshStatistics();
      
      // Validate migration
      const validation = await this.validateMigration();
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`🎉 Migration completed in ${duration} seconds!`);
      
      return validation;
      
    } catch (error) {
      console.error('💥 Migration failed:', error.message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// CLI interface
if (require.main === module) {
  const sqlitePath = process.argv[2] || path.join(__dirname, '..', 'complete-tournaments.db');
  
  if (!fs.existsSync(sqlitePath)) {
    console.error(`❌ SQLite database not found: ${sqlitePath}`);
    console.log('Usage: node scripts/sqlite-to-postgres.js [sqlite_path]');
    process.exit(1);
  }
  
  const migrator = new SQLiteToPostgresMigrator(sqlitePath, {});
  
  migrator.migrate()
    .then((validation) => {
      console.log('\n📊 Migration Summary:');
      console.log('=====================');
      Object.entries(validation).forEach(([table, stats]) => {
        const status = stats.match ? '✅' : '❌';
        console.log(`${status} ${table}: ${stats.postgres} records`);
      });
    })
    .catch(error => {
      console.error('Migration failed:', error.message);
      process.exit(1);
    });
}

module.exports = SQLiteToPostgresMigrator;