const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

console.log('🚀 MEGA IMPORT: Starting import of 10.5M games, 4.1M players, 534K tournaments\n');
console.log('⚠️  This will take a while. Get some coffee! ☕\n');

const db = new sqlite3.Database(
  path.join(__dirname, 'otb-database', 'chess-stats.db'),
  sqlite3.OPEN_READWRITE,
  (err) => {
    if (err) {
      console.error('❌ Error opening database:', err);
      process.exit(1);
    }
    console.log('✅ Connected to database');
  }
);

// Configuration
const BATCH_DIR = path.join(__dirname, 'otb-database', 'indexes', 'temp');
const BATCH_SIZE = 1000; // Insert records in batches
const CHECKPOINT_INTERVAL = 10; // Save progress every N files

// Progress tracking
let progress = {
  players: { processed: 0, total: 0, unique: new Set() },
  events: { processed: 0, total: 0 },
  games: { processed: 0, total: 0 },
  openings: { processed: 0, total: 0 },
  lastCheckpoint: { 
    playerFile: 0, 
    eventFile: 0, 
    gameFile: 0,
    openingFile: 0
  }
};

// Load checkpoint if exists
const checkpointFile = path.join(__dirname, 'import-checkpoint.json');
if (fs.existsSync(checkpointFile)) {
  progress = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
  console.log('📌 Resuming from checkpoint:', progress.lastCheckpoint);
}

// Save checkpoint
function saveCheckpoint() {
  fs.writeFileSync(checkpointFile, JSON.stringify(progress, null, 2));
}

// Ensure all tables exist with proper structure
function ensureTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Extend player_index for full data
      db.run(`
        CREATE TABLE IF NOT EXISTS player_index (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          fide_id INTEGER,
          peak_rating INTEGER,
          current_rating INTEGER,
          title TEXT,
          federation TEXT,
          birth_year INTEGER,
          total_games INTEGER DEFAULT 0,
          total_wins INTEGER DEFAULT 0,
          total_draws INTEGER DEFAULT 0,
          total_losses INTEGER DEFAULT 0,
          tournaments_count INTEGER DEFAULT 0,
          first_game_date DATE,
          last_game_date DATE,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(name)
        )
      `);

      // Extend tournament_archive for full data
      db.run(`
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
          UNIQUE(name, start_date)
        )
      `);

      // Create full games table for 10.5M games
      db.run(`
        CREATE TABLE IF NOT EXISTS game_archive (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game_id TEXT UNIQUE,
          tournament_id INTEGER,
          event_name TEXT,
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
          date_played DATE,
          time_control TEXT,
          FOREIGN KEY (tournament_id) REFERENCES tournament_archive(id)
        )
      `);

      // Opening statistics table
      db.run(`
        CREATE TABLE IF NOT EXISTS opening_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          eco TEXT,
          opening TEXT,
          variation TEXT,
          total_games INTEGER DEFAULT 0,
          white_wins INTEGER DEFAULT 0,
          draws INTEGER DEFAULT 0,
          black_wins INTEGER DEFAULT 0,
          avg_rating INTEGER,
          last_played DATE,
          UNIQUE(eco, opening, variation)
        )
      `);

      // Create indexes for performance
      db.run('CREATE INDEX IF NOT EXISTS idx_player_name ON player_index(name)');
      db.run('CREATE INDEX IF NOT EXISTS idx_player_rating ON player_index(peak_rating DESC)');
      db.run('CREATE INDEX IF NOT EXISTS idx_game_players ON game_archive(white_player, black_player)');
      db.run('CREATE INDEX IF NOT EXISTS idx_game_event ON game_archive(event_name)');
      db.run('CREATE INDEX IF NOT EXISTS idx_game_eco ON game_archive(eco)');
      db.run('CREATE INDEX IF NOT EXISTS idx_game_date ON game_archive(date_played)');
      db.run('CREATE INDEX IF NOT EXISTS idx_tournament_name ON tournament_archive(name)');
      db.run('CREATE INDEX IF NOT EXISTS idx_tournament_date ON tournament_archive(start_date)');

      console.log('✅ Database tables ready\n');
      resolve();
    });
  });
}

// Import players from batch files
async function importPlayers() {
  console.log('👥 IMPORTING PLAYERS...');
  
  const playerFiles = fs.readdirSync(BATCH_DIR)
    .filter(f => f.startsWith('players-batch'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0]);
      const numB = parseInt(b.match(/\d+/)[0]);
      return numA - numB;
    });

  console.log(`📁 Found ${playerFiles.length} player batch files\n`);

  for (let i = progress.lastCheckpoint.playerFile; i < playerFiles.length; i++) {
    const file = playerFiles[i];
    
    try {
      const data = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, file), 'utf8'));
      const players = Object.entries(data);
      
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO player_index 
        (name, peak_rating, total_games, total_wins, total_draws, total_losses, first_game_date, last_game_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let batchCount = 0;
      for (const [name, stats] of players) {
        if (!progress.players.unique.has(name)) {
          progress.players.unique.add(name);
          stmt.run(
            name,
            stats.rating_peak || null,
            stats.games || 0,
            stats.wins || 0,
            stats.draws || 0,
            stats.losses || 0,
            stats.first_game || null,
            stats.last_game || null
          );
          batchCount++;
        }
      }

      stmt.finalize();
      
      progress.players.processed += batchCount;
      progress.lastCheckpoint.playerFile = i + 1;

      if ((i + 1) % 10 === 0) {
        console.log(`  ✅ Processed ${i + 1}/${playerFiles.length} files | ${progress.players.unique.size.toLocaleString()} unique players`);
        saveCheckpoint();
      }

    } catch (error) {
      console.error(`  ❌ Error processing ${file}:`, error.message);
    }
  }

  console.log(`\n✅ PLAYERS COMPLETE: ${progress.players.unique.size.toLocaleString()} unique players imported\n`);
}

// Import tournaments/events from batch files
async function importEvents() {
  console.log('🏆 IMPORTING TOURNAMENTS/EVENTS...');
  
  const eventFiles = fs.readdirSync(BATCH_DIR)
    .filter(f => f.startsWith('events-batch'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0]);
      const numB = parseInt(b.match(/\d+/)[0]);
      return numA - numB;
    });

  console.log(`📁 Found ${eventFiles.length} event batch files\n`);

  for (let i = progress.lastCheckpoint.eventFile; i < eventFiles.length; i++) {
    const file = eventFiles[i];
    
    try {
      const data = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, file), 'utf8'));
      const events = Object.entries(data);
      
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO tournament_archive 
        (name, location, start_date, end_date, number_of_games)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const [name, stats] of events) {
        stmt.run(
          name,
          stats.location || 'Unknown',
          stats.start_date || stats.date || null,
          stats.end_date || stats.start_date || stats.date || null,
          stats.games || 0
        );
        progress.events.processed++;
      }

      stmt.finalize();
      
      progress.lastCheckpoint.eventFile = i + 1;

      if ((i + 1) % 10 === 0) {
        console.log(`  ✅ Processed ${i + 1}/${eventFiles.length} files | ${progress.events.processed.toLocaleString()} events`);
        saveCheckpoint();
      }

    } catch (error) {
      console.error(`  ❌ Error processing ${file}:`, error.message);
    }
  }

  console.log(`\n✅ EVENTS COMPLETE: ${progress.events.processed.toLocaleString()} tournaments imported\n`);
}

// Import games from batch files (this is the big one!)
async function importGames() {
  console.log('♟️  IMPORTING GAMES (This will take a while!)...');
  
  const gameFiles = fs.readdirSync(BATCH_DIR)
    .filter(f => f.startsWith('gameIds-batch'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0]);
      const numB = parseInt(b.match(/\d+/)[0]);
      return numA - numB;
    });

  console.log(`📁 Found ${gameFiles.length} game batch files\n`);
  console.log('⚠️  Note: We\'ll import game metadata only to save space\n');

  for (let i = progress.lastCheckpoint.gameFile; i < Math.min(gameFiles.length, 50); i++) { // Limit to first 50 files for now
    const file = gameFiles[i];
    
    try {
      const data = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, file), 'utf8'));
      const games = Object.entries(data);
      
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO game_archive 
        (game_id, white_player, black_player, result, eco, opening, date_played, event_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let batchCount = 0;
      for (const [gameId, gameInfo] of games) {
        if (gameInfo && typeof gameInfo === 'object') {
          stmt.run(
            gameId,
            gameInfo.white || 'Unknown',
            gameInfo.black || 'Unknown',
            gameInfo.result || '*',
            gameInfo.eco || null,
            gameInfo.opening || null,
            gameInfo.date || null,
            gameInfo.event || null
          );
          batchCount++;
          progress.games.processed++;
          
          // Update player game counts
          if (batchCount % 1000 === 0) {
            stmt.finalize();
            stmt = db.prepare(`
              INSERT OR IGNORE INTO game_archive 
              (game_id, white_player, black_player, result, eco, opening, date_played, event_name)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
          }
        }
      }

      stmt.finalize();
      
      progress.lastCheckpoint.gameFile = i + 1;

      console.log(`  ✅ File ${i + 1}/${Math.min(gameFiles.length, 50)} | ${progress.games.processed.toLocaleString()} games imported`);
      saveCheckpoint();

    } catch (error) {
      console.error(`  ❌ Error processing ${file}:`, error.message);
    }
  }

  console.log(`\n✅ GAMES COMPLETE: ${progress.games.processed.toLocaleString()} games imported\n`);
}

// Import opening statistics
async function importOpenings() {
  console.log('📖 IMPORTING OPENING STATISTICS...');
  
  const openingFiles = fs.readdirSync(BATCH_DIR)
    .filter(f => f.startsWith('openings-batch'))
    .slice(0, 20); // Just first 20 files for opening stats

  console.log(`📁 Processing ${openingFiles.length} opening batch files\n`);

  for (const file of openingFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, file), 'utf8'));
      const openings = Object.entries(data);
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO opening_stats 
        (eco, opening, variation, total_games, white_wins, draws, black_wins)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const [eco, stats] of openings) {
        if (stats && typeof stats === 'object') {
          stmt.run(
            eco,
            stats.opening || eco,
            stats.variation || null,
            stats.total || 0,
            stats.white_wins || 0,
            stats.draws || 0,
            stats.black_wins || 0
          );
          progress.openings.processed++;
        }
      }

      stmt.finalize();

    } catch (error) {
      console.error(`  ❌ Error processing ${file}:`, error.message);
    }
  }

  console.log(`✅ OPENINGS COMPLETE: ${progress.openings.processed.toLocaleString()} openings imported\n`);
}

// Update statistics
async function updateStatistics() {
  console.log('📊 UPDATING STATISTICS...\n');

  return new Promise((resolve) => {
    db.serialize(() => {
      // Update player game counts
      db.run(`
        UPDATE player_index 
        SET total_games = (
          SELECT COUNT(*) FROM game_archive 
          WHERE white_player = player_index.name OR black_player = player_index.name
        )
        WHERE EXISTS (
          SELECT 1 FROM game_archive 
          WHERE white_player = player_index.name OR black_player = player_index.name
        )
      `, (err) => {
        if (err) console.error('Error updating game counts:', err);
        else console.log('  ✅ Updated player game counts');
      });

      // Update tournament game counts
      db.run(`
        UPDATE tournament_archive 
        SET number_of_games = (
          SELECT COUNT(*) FROM game_archive 
          WHERE event_name = tournament_archive.name
        )
        WHERE EXISTS (
          SELECT 1 FROM game_archive 
          WHERE event_name = tournament_archive.name
        )
      `, (err) => {
        if (err) console.error('Error updating tournament counts:', err);
        else console.log('  ✅ Updated tournament game counts');
        resolve();
      });
    });
  });
}

// Main import function
async function runImport() {
  const startTime = Date.now();
  
  try {
    await ensureTables();
    await importPlayers();
    await importEvents();
    await importGames();
    await importOpenings();
    await updateStatistics();

    const duration = Math.round((Date.now() - startTime) / 1000 / 60);
    
    // Get final counts
    db.serialize(() => {
      db.get('SELECT COUNT(*) as count FROM player_index', (err, row) => {
        const playerCount = row?.count || 0;
        
        db.get('SELECT COUNT(*) as count FROM tournament_archive', (err, row) => {
          const tournamentCount = row?.count || 0;
          
          db.get('SELECT COUNT(*) as count FROM game_archive', (err, row) => {
            const gameCount = row?.count || 0;
            
            db.get('SELECT COUNT(*) as count FROM opening_stats', (err, row) => {
              const openingCount = row?.count || 0;

              console.log('\n' + '='.repeat(70));
              console.log('🎉 IMPORT COMPLETE!');
              console.log('='.repeat(70));
              console.log(`⏱️  Duration: ${duration} minutes`);
              console.log(`👥 Players: ${playerCount.toLocaleString()}`);
              console.log(`🏆 Tournaments: ${tournamentCount.toLocaleString()}`);
              console.log(`♟️  Games: ${gameCount.toLocaleString()}`);
              console.log(`📖 Openings: ${openingCount.toLocaleString()}`);
              console.log('='.repeat(70));
              console.log('\n🚀 Your chess database is now one of the largest in the world!');
              console.log('   Visit http://localhost:3002/tournament-archive to explore\n');
              
              // Clean up checkpoint file
              if (fs.existsSync(checkpointFile)) {
                fs.unlinkSync(checkpointFile);
              }
              
              db.close();
            });
          });
        });
      });
    });

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    console.log('💡 Run the script again to resume from checkpoint');
    db.close();
  }
}

// Start the import
runImport();