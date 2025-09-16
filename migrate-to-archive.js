const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🔄 Starting migration from existing indexed data to tournament archive...\n');

// Open both databases
const sourceDb = new sqlite3.Database(
  path.join(__dirname, 'otb-database', 'chess-stats.db'),
  sqlite3.OPEN_READONLY,
  (err) => {
    if (err) {
      console.error('❌ Error opening source database:', err);
      process.exit(1);
    }
    console.log('✅ Connected to source database (chess-stats.db)');
  }
);

const targetDb = new sqlite3.Database(
  path.join(__dirname, 'otb-database', 'chess-stats.db'),
  sqlite3.OPEN_READWRITE,
  (err) => {
    if (err) {
      console.error('❌ Error opening target database:', err);
      process.exit(1);
    }
    console.log('✅ Connected to target database for archive tables');
  }
);

// Create archive tables if they don't exist
function createArchiveTables() {
  return new Promise((resolve, reject) => {
    const schema = fs.readFileSync(path.join(__dirname, 'tournament-platform', 'sqlite-schema.sql'), 'utf8');
    
    // Extract and run CREATE TABLE statements for archive tables
    const archiveSchema = `
      CREATE TABLE IF NOT EXISTS tournament_archive (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        location TEXT,
        country TEXT,
        federation TEXT,
        start_date DATE,
        end_date DATE,
        tournament_type TEXT,
        category TEXT,
        average_rating INTEGER,
        number_of_players INTEGER,
        number_of_rounds INTEGER,
        number_of_games INTEGER,
        time_control TEXT,
        organizer TEXT,
        chief_arbiter TEXT,
        website TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, start_date, location)
      );

      CREATE TABLE IF NOT EXISTS tournament_standings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id INTEGER,
        rank INTEGER,
        player_name TEXT,
        player_title TEXT,
        player_fide_id INTEGER,
        player_federation TEXT,
        player_rating INTEGER,
        points REAL,
        games_played INTEGER,
        wins INTEGER,
        draws INTEGER,
        losses INTEGER,
        performance_rating INTEGER,
        tb1 REAL,
        FOREIGN KEY (tournament_id) REFERENCES tournament_archive(id)
      );

      CREATE TABLE IF NOT EXISTS game_archive (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id INTEGER,
        round INTEGER,
        board INTEGER,
        white_player TEXT,
        white_title TEXT,
        white_rating INTEGER,
        white_fide_id INTEGER,
        black_player TEXT,
        black_title TEXT,
        black_rating INTEGER,
        black_fide_id INTEGER,
        result TEXT,
        eco TEXT,
        opening TEXT,
        variation TEXT,
        ply_count INTEGER,
        pgn TEXT,
        date_played DATE,
        FOREIGN KEY (tournament_id) REFERENCES tournament_archive(id)
      );

      CREATE TABLE IF NOT EXISTS player_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        fide_id INTEGER UNIQUE,
        peak_rating INTEGER,
        current_rating INTEGER,
        title TEXT,
        federation TEXT,
        birth_year INTEGER,
        total_games INTEGER,
        tournaments_count INTEGER,
        first_game_date DATE,
        last_game_date DATE
      );

      CREATE INDEX IF NOT EXISTS idx_archive_tournament_name ON tournament_archive(name);
      CREATE INDEX IF NOT EXISTS idx_archive_tournament_dates ON tournament_archive(start_date);
      CREATE INDEX IF NOT EXISTS idx_archive_standings_tournament ON tournament_standings(tournament_id);
      CREATE INDEX IF NOT EXISTS idx_archive_game_tournament ON game_archive(tournament_id);
      CREATE INDEX IF NOT EXISTS idx_archive_player_name ON player_index(name);
    `;

    targetDb.exec(archiveSchema, (err) => {
      if (err) {
        console.error('❌ Error creating archive tables:', err);
        reject(err);
      } else {
        console.log('✅ Archive tables created/verified');
        resolve();
      }
    });
  });
}

async function migrateData() {
  await createArchiveTables();

  // Check what tables exist in source database
  sourceDb.all("SELECT name FROM sqlite_master WHERE type='table'", async (err, tables) => {
    if (err) {
      console.error('❌ Error listing tables:', err);
      return;
    }

    console.log('\n📊 Found tables in source database:');
    tables.forEach(t => console.log(`  - ${t.name}`));

    // Check for events (tournaments) table
    if (tables.some(t => t.name === 'events')) {
      await migrateTournaments();
    }

    // Check for games table
    if (tables.some(t => t.name === 'games')) {
      await migrateGames();
    }

    // Check for players table
    if (tables.some(t => t.name === 'players')) {
      await migratePlayers();
    }

    // Get final statistics
    targetDb.get('SELECT COUNT(*) as count FROM tournament_archive', (err, row) => {
      const tournamentCount = row?.count || 0;
      
      targetDb.get('SELECT COUNT(*) as count FROM game_archive', (err, row) => {
        const gameCount = row?.count || 0;
        
        targetDb.get('SELECT COUNT(*) as count FROM player_index', (err, row) => {
          const playerCount = row?.count || 0;
          
          console.log('\n✨ Migration Complete!');
          console.log('=====================================');
          console.log(`📋 Tournaments: ${tournamentCount.toLocaleString()}`);
          console.log(`♟️  Games: ${gameCount.toLocaleString()}`);
          console.log(`👥 Players: ${playerCount.toLocaleString()}`);
          console.log('=====================================\n');
          
          console.log('🚀 You can now access the archive at:');
          console.log('   http://localhost:3002/tournament-archive');
          
          sourceDb.close();
          targetDb.close();
        });
      });
    });
  });
}

function migrateTournaments() {
  return new Promise((resolve) => {
    console.log('\n📁 Migrating tournaments...');
    
    sourceDb.all(`
      SELECT DISTINCT 
        name, 
        location, 
        start_date, 
        end_date,
        games_count
      FROM events 
      WHERE name IS NOT NULL
    `, (err, events) => {
      if (err || !events) {
        console.log('  No events to migrate');
        resolve();
        return;
      }

      console.log(`  Found ${events.length} tournaments to migrate`);
      
      const stmt = targetDb.prepare(`
        INSERT OR IGNORE INTO tournament_archive 
        (name, location, start_date, end_date, number_of_games)
        VALUES (?, ?, ?, ?, ?)
      `);

      events.forEach(event => {
        stmt.run(
          event.name,
          event.location || 'Unknown',
          event.start_date,
          event.end_date,
          event.games_count || 0
        );
      });

      stmt.finalize(() => {
        console.log('  ✅ Tournaments migrated');
        resolve();
      });
    });
  });
}

function migrateGames() {
  return new Promise((resolve) => {
    console.log('\n🎮 Migrating games...');
    
    // First, create a mapping of event names to tournament_archive IDs
    targetDb.all('SELECT id, name FROM tournament_archive', (err, tournaments) => {
      if (err || !tournaments) {
        console.log('  No tournaments found for game mapping');
        resolve();
        return;
      }

      const tournamentMap = {};
      tournaments.forEach(t => {
        tournamentMap[t.name] = t.id;
      });

      // Now migrate games
      sourceDb.all(`
        SELECT 
          g.*,
          e.name as event_name,
          wp.name as white_name,
          bp.name as black_name
        FROM games g
        LEFT JOIN events e ON g.event_id = e.id
        LEFT JOIN players wp ON g.white_player_id = wp.id
        LEFT JOIN players bp ON g.black_player_id = bp.id
        LIMIT 100000
      `, (err, games) => {
        if (err || !games) {
          console.log('  No games to migrate');
          resolve();
          return;
        }

        console.log(`  Found ${games.length} games to migrate`);
        
        const stmt = targetDb.prepare(`
          INSERT OR IGNORE INTO game_archive 
          (tournament_id, white_player, black_player, result, eco, opening, date_played, ply_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let migrated = 0;
        games.forEach(game => {
          const tournamentId = tournamentMap[game.event_name];
          if (tournamentId) {
            stmt.run(
              tournamentId,
              game.white_name || 'Unknown',
              game.black_name || 'Unknown',
              game.result,
              game.eco,
              game.opening,
              game.date,
              game.ply_count
            );
            migrated++;
          }
        });

        stmt.finalize(() => {
          console.log(`  ✅ ${migrated} games migrated`);
          resolve();
        });
      });
    });
  });
}

function migratePlayers() {
  return new Promise((resolve) => {
    console.log('\n👥 Migrating players...');
    
    sourceDb.all(`
      SELECT 
        name,
        games_count,
        wins,
        draws,
        losses,
        rating_peak,
        first_game_date,
        last_game_date
      FROM players
      WHERE name IS NOT NULL
      LIMIT 50000
    `, (err, players) => {
      if (err || !players) {
        console.log('  No players to migrate');
        resolve();
        return;
      }

      console.log(`  Found ${players.length} players to migrate`);
      
      const stmt = targetDb.prepare(`
        INSERT OR IGNORE INTO player_index 
        (name, peak_rating, total_games, first_game_date, last_game_date)
        VALUES (?, ?, ?, ?, ?)
      `);

      players.forEach(player => {
        stmt.run(
          player.name,
          player.rating_peak,
          player.games_count || 0,
          player.first_game_date,
          player.last_game_date
        );
      });

      stmt.finalize(() => {
        console.log('  ✅ Players migrated');
        resolve();
      });
    });
  });
}

// Start migration
migrateData().catch(console.error);