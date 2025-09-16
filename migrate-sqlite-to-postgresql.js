const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Configuration
const BATCH_SIZE = 10000; // Process games in batches
const SQLITE_PATH = process.env.SQLITE_DB_PATH || './otb-database/chess-stats.db';

// PostgreSQL connection
const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'chess_stats',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

// Progress tracking
let progress = {
  players: { total: 0, migrated: 0 },
  tournaments: { total: 0, migrated: 0 },
  games: { total: 0, migrated: 0 },
  startTime: Date.now()
};

// ID mapping for foreign keys
const playerIdMap = new Map();
const tournamentIdMap = new Map();

async function connectPostgreSQL() {
  const client = new Client(pgConfig);
  await client.connect();
  console.log('✅ Connected to PostgreSQL');
  return client;
}

function connectSQLite() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(SQLITE_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('✅ Connected to SQLite database');
        resolve(db);
      }
    });
  });
}

async function getCount(sqliteDb, table) {
  return new Promise((resolve, reject) => {
    sqliteDb.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
      if (err) reject(err);
      else resolve(row.count);
    });
  });
}

async function migratePlayers(sqliteDb, pgClient) {
  console.log('\n📋 Migrating players...');
  
  return new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM players', async (err, players) => {
      if (err) {
        reject(err);
        return;
      }

      progress.players.total = players.length;
      console.log(`Found ${players.length} players to migrate`);

      for (const player of players) {
        try {
          // Insert player into PostgreSQL
          const result = await pgClient.query(`
            INSERT INTO players (
              username, full_name, country, title, fide_id,
              chess_com_username, lichess_username,
              current_ratings, peak_ratings, total_games
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
          `, [
            player.name || player.username,
            player.full_name,
            player.country,
            player.title,
            player.fide_id,
            player.chess_com_username,
            player.lichess_username,
            player.current_rating ? JSON.stringify({ classical: player.current_rating }) : '{}',
            player.peak_rating ? JSON.stringify({ classical: player.peak_rating }) : '{}',
            player.total_games || 0
          ]);

          // Map old ID to new ID
          playerIdMap.set(player.id, result.rows[0].id);
          
          progress.players.migrated++;
          if (progress.players.migrated % 100 === 0) {
            console.log(`  Migrated ${progress.players.migrated}/${progress.players.total} players`);
          }
        } catch (error) {
          console.error(`Error migrating player ${player.name}:`, error.message);
        }
      }

      console.log(`✅ Migrated ${progress.players.migrated} players`);
      resolve();
    });
  });
}

async function migrateTournaments(sqliteDb, pgClient) {
  console.log('\n🏆 Migrating tournaments...');
  
  return new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM tournaments', async (err, tournaments) => {
      if (err) {
        reject(err);
        return;
      }

      progress.tournaments.total = tournaments.length;
      console.log(`Found ${tournaments.length} tournaments to migrate`);

      for (const tournament of tournaments) {
        try {
          const result = await pgClient.query(`
            INSERT INTO tournaments (
              name, location, format, start_date, end_date,
              rounds, time_control, participants, category, site
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
          `, [
            tournament.name,
            tournament.location || tournament.site,
            tournament.format,
            tournament.date || tournament.start_date,
            tournament.end_date || tournament.date,
            tournament.rounds,
            tournament.time_control,
            tournament.participants || tournament.player_count,
            tournament.category,
            tournament.site
          ]);

          tournamentIdMap.set(tournament.id, result.rows[0].id);
          
          progress.tournaments.migrated++;
          if (progress.tournaments.migrated % 50 === 0) {
            console.log(`  Migrated ${progress.tournaments.migrated}/${progress.tournaments.total} tournaments`);
          }
        } catch (error) {
          console.error(`Error migrating tournament ${tournament.name}:`, error.message);
        }
      }

      console.log(`✅ Migrated ${progress.tournaments.migrated} tournaments`);
      resolve();
    });
  });
}

async function migrateGames(sqliteDb, pgClient) {
  console.log('\n♟️ Migrating games...');
  
  const totalGames = await getCount(sqliteDb, 'games');
  progress.games.total = totalGames;
  console.log(`Found ${totalGames} games to migrate`);

  let offset = 0;
  
  while (offset < totalGames) {
    await new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM games 
        LIMIT ${BATCH_SIZE} OFFSET ${offset}
      `;
      
      sqliteDb.all(query, async (err, games) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`  Processing batch: ${offset} to ${offset + games.length}`);
        
        // Prepare batch insert
        const values = [];
        const placeholders = [];
        let paramIndex = 1;

        for (const game of games) {
          // Parse date
          let playedAt = new Date();
          if (game.date) {
            try {
              // Handle various date formats
              if (game.date.includes('.')) {
                // Format: YYYY.MM.DD
                const [year, month, day] = game.date.split('.');
                playedAt = new Date(year, month - 1, day);
              } else if (game.date.includes('-')) {
                // Format: YYYY-MM-DD
                playedAt = new Date(game.date);
              } else {
                // Try parsing as-is
                playedAt = new Date(game.date);
              }
            } catch (e) {
              console.warn(`Invalid date format for game ${game.id}: ${game.date}`);
            }
          }

          // Map player IDs
          const whitePlayerId = playerIdMap.get(game.white_player_id) || null;
          const blackPlayerId = playerIdMap.get(game.black_player_id) || null;
          const tournamentId = tournamentIdMap.get(game.tournament_id) || null;

          values.push(
            whitePlayerId,
            blackPlayerId,
            tournamentId,
            null, // opening_id
            game.pgn || game.moves,
            game.moves,
            game.eco,
            game.opening,
            game.result || '1/2-1/2',
            game.white_elo,
            game.black_elo,
            game.time_control,
            game.termination,
            game.round,
            null, // board
            game.ply_count || (game.moves ? game.moves.split(' ').length : null),
            true, // rated
            playedAt.toISOString(),
            game.site || 'OTB',
            game.event || tournamentIdMap.get(game.tournament_id)
          );

          const params = [];
          for (let i = 0; i < 19; i++) {
            params.push(`$${paramIndex++}`);
          }
          placeholders.push(`(${params.join(', ')})`);
        }

        if (values.length > 0) {
          try {
            const insertQuery = `
              INSERT INTO games (
                white_player_id, black_player_id, tournament_id, opening_id,
                pgn, moves, eco, opening_name, result,
                white_elo, black_elo, time_control, termination,
                round, board, ply_count, rated, played_at, site, event_name
              ) VALUES ${placeholders.join(', ')}
            `;
            
            await pgClient.query(insertQuery, values);
            progress.games.migrated += games.length;
            
            const percentage = Math.round((progress.games.migrated / progress.games.total) * 100);
            console.log(`  ✓ Migrated ${progress.games.migrated}/${progress.games.total} games (${percentage}%)`);
          } catch (error) {
            console.error(`Error in batch insert:`, error.message);
            // Try individual inserts for this batch
            for (let i = 0; i < games.length; i++) {
              try {
                const gameValues = values.slice(i * 19, (i + 1) * 19);
                await pgClient.query(`
                  INSERT INTO games (
                    white_player_id, black_player_id, tournament_id, opening_id,
                    pgn, moves, eco, opening_name, result,
                    white_elo, black_elo, time_control, termination,
                    round, board, ply_count, rated, played_at, site, event_name
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                `, gameValues);
                progress.games.migrated++;
              } catch (individualError) {
                console.error(`Failed to insert game:`, individualError.message);
              }
            }
          }
        }

        resolve();
      });
    });

    offset += BATCH_SIZE;
    
    // Small delay to prevent overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`✅ Migrated ${progress.games.migrated} games`);
}

async function updateStatistics(pgClient) {
  console.log('\n📊 Updating statistics and indexes...');
  
  try {
    // Update player game counts
    console.log('  Updating player game counts...');
    await pgClient.query(`
      UPDATE players p
      SET total_games = (
        SELECT COUNT(*)
        FROM games g
        WHERE g.white_player_id = p.id OR g.black_player_id = p.id
      )
    `);

    // Analyze tables for query optimizer
    console.log('  Analyzing tables...');
    await pgClient.query('ANALYZE players');
    await pgClient.query('ANALYZE tournaments');
    await pgClient.query('ANALYZE games');

    // Refresh materialized views if they exist
    console.log('  Refreshing materialized views...');
    try {
      await pgClient.query('REFRESH MATERIALIZED VIEW player_stats');
      await pgClient.query('REFRESH MATERIALIZED VIEW opening_stats');
      await pgClient.query('REFRESH MATERIALIZED VIEW monthly_activity');
    } catch (e) {
      console.log('  (Materialized views not yet created)');
    }

    console.log('✅ Statistics updated');
  } catch (error) {
    console.error('Error updating statistics:', error.message);
  }
}

async function generateReport() {
  const duration = Date.now() - progress.startTime;
  const minutes = Math.floor(duration / 60000);
  const seconds = ((duration % 60000) / 1000).toFixed(0);

  console.log('\n' + '='.repeat(50));
  console.log('MIGRATION COMPLETE');
  console.log('='.repeat(50));
  console.log(`Duration: ${minutes}m ${seconds}s`);
  console.log(`Players: ${progress.players.migrated}/${progress.players.total}`);
  console.log(`Tournaments: ${progress.tournaments.migrated}/${progress.tournaments.total}`);
  console.log(`Games: ${progress.games.migrated}/${progress.games.total}`);
  console.log('='.repeat(50));

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    duration: `${minutes}m ${seconds}s`,
    results: progress,
    playerIdMapping: Array.from(playerIdMap.entries()),
    tournamentIdMapping: Array.from(tournamentIdMap.entries())
  };

  fs.writeFileSync('migration-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Detailed report saved to migration-report.json');
}

async function migrate() {
  console.log('🚀 Starting SQLite to PostgreSQL migration...');
  console.log(`SQLite source: ${SQLITE_PATH}`);
  console.log(`PostgreSQL target: ${pgConfig.database}@${pgConfig.host}:${pgConfig.port}`);
  
  let sqliteDb;
  let pgClient;

  try {
    // Check if SQLite database exists
    if (!fs.existsSync(SQLITE_PATH)) {
      throw new Error(`SQLite database not found at ${SQLITE_PATH}`);
    }

    // Connect to databases
    sqliteDb = await connectSQLite();
    pgClient = await connectPostgreSQL();

    // Check if PostgreSQL is empty (avoid duplicate migration)
    const existingGames = await pgClient.query('SELECT COUNT(*) as count FROM games');
    if (existingGames.rows[0].count > 0) {
      console.log('⚠️  Warning: PostgreSQL database already contains data!');
      console.log(`   Found ${existingGames.rows[0].count} existing games`);
      console.log('   To proceed, clear the PostgreSQL database first.');
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      await new Promise(resolve => {
        readline.question('Continue anyway? (yes/no): ', (answer) => {
          readline.close();
          if (answer.toLowerCase() !== 'yes') {
            console.log('Migration cancelled');
            process.exit(0);
          }
          resolve();
        });
      });
    }

    // Start migration
    await migratePlayers(sqliteDb, pgClient);
    await migrateTournaments(sqliteDb, pgClient);
    await migrateGames(sqliteDb, pgClient);
    await updateStatistics(pgClient);
    await generateReport();

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Clean up connections
    if (sqliteDb) {
      sqliteDb.close();
    }
    if (pgClient) {
      await pgClient.end();
    }
  }
}

// Run migration
if (require.main === module) {
  migrate().catch(console.error);
}

module.exports = { migrate };