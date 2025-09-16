const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

console.log('🏗️  BUILDING PRODUCTION DATABASE');
console.log('=====================================');
console.log('This script will create a complete chess database optimized for production');
console.log('Target: 10.5M games, 4.1M players, 1.5M tournaments');
console.log('Estimated final size: 8-12 GB');
console.log('=====================================\n');

// Configuration
const BATCH_DIR = path.join(__dirname, 'otb-database', 'indexes', 'temp');
const PRODUCTION_DB = path.join(__dirname, 'chess-production.db');
const CHECKPOINT_FILE = path.join(__dirname, 'production-checkpoint.json');
const INSERT_BATCH_SIZE = 10000;
const MEMORY_CACHE_SIZE = 500000; // 500MB cache

// Remove existing production database
if (fs.existsSync(PRODUCTION_DB)) {
  console.log('🗑️  Removing existing production database...');
  fs.unlinkSync(PRODUCTION_DB);
}

// Create production database with optimized settings
const db = new sqlite3.Database(PRODUCTION_DB, (err) => {
  if (err) {
    console.error('❌ Error creating production database:', err);
    process.exit(1);
  }
  console.log('✅ Created production database\n');
});

// Optimize database for large imports
db.serialize(() => {
  console.log('⚙️  Configuring database for optimal performance...');
  
  // SQLite optimization pragmas for large imports
  db.run('PRAGMA journal_mode = OFF'); // Disable journaling for speed
  db.run('PRAGMA synchronous = OFF'); // Don't wait for OS to confirm writes
  db.run('PRAGMA cache_size = -' + MEMORY_CACHE_SIZE); // Use more memory
  db.run('PRAGMA locking_mode = EXCLUSIVE'); // Exclusive access
  db.run('PRAGMA temp_store = MEMORY'); // Store temp data in memory
  db.run('PRAGMA page_size = 65536'); // Larger page size for better performance
  
  console.log('✅ Database optimized for import speed\n');
});

// Load or initialize checkpoint
let checkpoint = {
  players: { processed: 0, fileIndex: 0 },
  tournaments: { processed: 0, fileIndex: 0 },
  games: { processed: 0, fileIndex: 0 },
  openings: { processed: 0, fileIndex: 0 },
  indexesCreated: false
};

if (fs.existsSync(CHECKPOINT_FILE)) {
  checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
  console.log('📌 Resuming from checkpoint:', checkpoint);
}

// Save checkpoint function
function saveCheckpoint() {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

// Create optimized production schema
function createProductionSchema() {
  return new Promise((resolve, reject) => {
    console.log('📋 Creating optimized production schema...\n');
    
    db.serialize(() => {
      // Players table optimized for 4M+ players
      db.run(`
        CREATE TABLE players (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          name_normalized TEXT, -- For faster searching
          fide_id INTEGER,
          title TEXT,
          federation CHAR(3),
          birth_year INTEGER,
          peak_rating INTEGER,
          current_rating INTEGER,
          total_games INTEGER DEFAULT 0,
          wins INTEGER DEFAULT 0,
          draws INTEGER DEFAULT 0,
          losses INTEGER DEFAULT 0,
          tournaments_count INTEGER DEFAULT 0,
          first_game_date DATE,
          last_game_date DATE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tournaments table optimized for 1.5M+ tournaments
      db.run(`
        CREATE TABLE tournaments (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          name_normalized TEXT,
          location TEXT,
          country CHAR(3),
          federation CHAR(3),
          start_date DATE,
          end_date DATE,
          category TEXT,
          time_control TEXT,
          rounds INTEGER,
          players_count INTEGER DEFAULT 0,
          games_count INTEGER DEFAULT 0,
          average_rating INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Games table optimized for 10M+ games
      db.run(`
        CREATE TABLE games (
          id INTEGER PRIMARY KEY,
          tournament_id INTEGER,
          round_num INTEGER,
          board_num INTEGER,
          white_player_id INTEGER,
          black_player_id INTEGER,
          white_rating INTEGER,
          black_rating INTEGER,
          result CHAR(7) CHECK(result IN ('1-0', '0-1', '1/2-1/2', '*')),
          eco CHAR(3),
          opening_id INTEGER,
          ply_count INTEGER,
          date_played DATE,
          FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
          FOREIGN KEY (white_player_id) REFERENCES players(id),
          FOREIGN KEY (black_player_id) REFERENCES players(id),
          FOREIGN KEY (opening_id) REFERENCES openings(id)
        )
      `);

      // Openings lookup table
      db.run(`
        CREATE TABLE openings (
          id INTEGER PRIMARY KEY,
          eco CHAR(3),
          name TEXT NOT NULL,
          variation TEXT,
          moves TEXT, -- First 10-15 moves
          games_count INTEGER DEFAULT 0,
          white_wins INTEGER DEFAULT 0,
          draws INTEGER DEFAULT 0,
          black_wins INTEGER DEFAULT 0
        )
      `);

      // Tournament standings for complete results
      db.run(`
        CREATE TABLE tournament_results (
          id INTEGER PRIMARY KEY,
          tournament_id INTEGER,
          player_id INTEGER,
          rank INTEGER,
          points REAL,
          games_played INTEGER,
          wins INTEGER,
          draws INTEGER,
          losses INTEGER,
          performance_rating INTEGER,
          rating_change INTEGER,
          tiebreak1 REAL,
          tiebreak2 REAL,
          FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
          FOREIGN KEY (player_id) REFERENCES players(id)
        )
      `);

      // Head-to-head results summary
      db.run(`
        CREATE TABLE head_to_head (
          id INTEGER PRIMARY KEY,
          player1_id INTEGER,
          player2_id INTEGER,
          games_count INTEGER DEFAULT 0,
          wins INTEGER DEFAULT 0,
          draws INTEGER DEFAULT 0,
          losses INTEGER DEFAULT 0,
          last_game_date DATE,
          FOREIGN KEY (player1_id) REFERENCES players(id),
          FOREIGN KEY (player2_id) REFERENCES players(id),
          UNIQUE(player1_id, player2_id)
        )
      `);

      console.log('✅ Schema created successfully\n');
      resolve();
    });
  });
}

// Import players with normalization
async function importPlayers() {
  if (checkpoint.players.fileIndex >= 212) {
    console.log('✅ Players already imported\n');
    return;
  }

  console.log('👥 IMPORTING PLAYERS...');
  console.log(`   Starting from file ${checkpoint.players.fileIndex}\n`);

  const playerFiles = fs.readdirSync(BATCH_DIR)
    .filter(f => f.startsWith('players-batch'))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

  const playerMap = new Map(); // Track unique players
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO players 
    (name, name_normalized, fide_id, title, federation, peak_rating, total_games)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = checkpoint.players.fileIndex; i < playerFiles.length; i++) {
    try {
      const file = playerFiles[i];
      const filePath = path.join(BATCH_DIR, file);
      
      if (!fs.existsSync(filePath)) continue;

      const rawData = fs.readFileSync(filePath, 'utf8');
      if (!rawData.trim()) continue;

      const data = JSON.parse(rawData);
      
      // Extract unique player names from the data structure
      let playersInFile = [];
      if (Array.isArray(data)) {
        // If data is array, extract player names from games
        playersInFile = data.flatMap(game => [game.white, game.black]).filter(Boolean);
      } else if (typeof data === 'object') {
        // If data is object, use keys as player names
        playersInFile = Object.keys(data);
      }

      playersInFile.forEach(playerName => {
        if (!playerName || playerMap.has(playerName)) return;
        
        playerMap.set(playerName, true);
        
        // Normalize name for searching
        const normalized = playerName.toLowerCase().replace(/[^a-z0-9 ]/g, '');
        
        stmt.run(
          playerName,
          normalized,
          null, // fide_id - would need to be populated from FIDE data
          null, // title - would need to be extracted
          null, // federation - would need to be extracted
          null, // peak_rating - to be calculated later
          0     // total_games - to be calculated later
        );
        
        checkpoint.players.processed++;
      });

      checkpoint.players.fileIndex = i + 1;
      
      if ((i + 1) % 10 === 0) {
        console.log(`   ✅ File ${i + 1}/${playerFiles.length} | ${checkpoint.players.processed.toLocaleString()} unique players`);
        saveCheckpoint();
      }

    } catch (error) {
      console.error(`   ❌ Error processing file ${i}:`, error.message);
    }
  }

  stmt.finalize();
  console.log(`\n✅ PLAYERS COMPLETE: ${checkpoint.players.processed.toLocaleString()} players imported\n`);
}

// Import tournaments  
async function importTournaments() {
  if (checkpoint.tournaments.fileIndex >= 212) {
    console.log('✅ Tournaments already imported\n');
    return;
  }

  console.log('🏆 IMPORTING TOURNAMENTS...');
  console.log(`   Starting from file ${checkpoint.tournaments.fileIndex}\n`);

  const eventFiles = fs.readdirSync(BATCH_DIR)
    .filter(f => f.startsWith('events-batch'))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO tournaments 
    (name, name_normalized, location, start_date, end_date, games_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (let i = checkpoint.tournaments.fileIndex; i < eventFiles.length; i++) {
    try {
      const file = eventFiles[i];
      const filePath = path.join(BATCH_DIR, file);
      
      if (!fs.existsSync(filePath)) continue;

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const tournaments = Object.entries(data);

      tournaments.forEach(([name, info]) => {
        if (!name) return;
        
        const normalized = name.toLowerCase().replace(/[^a-z0-9 ]/g, '');
        
        stmt.run(
          name,
          normalized,
          info.location || null,
          info.start_date || info.date || null,
          info.end_date || info.start_date || info.date || null,
          info.games || 0
        );
        
        checkpoint.tournaments.processed++;
      });

      checkpoint.tournaments.fileIndex = i + 1;
      
      if ((i + 1) % 10 === 0) {
        console.log(`   ✅ File ${i + 1}/${eventFiles.length} | ${checkpoint.tournaments.processed.toLocaleString()} tournaments`);
        saveCheckpoint();
      }

    } catch (error) {
      console.error(`   ❌ Error processing file ${i}:`, error.message);
    }
  }

  stmt.finalize();
  console.log(`\n✅ TOURNAMENTS COMPLETE: ${checkpoint.tournaments.processed.toLocaleString()} tournaments imported\n`);
}

// Import games (the big one!)
async function importGames() {
  if (checkpoint.games.fileIndex >= 50) { // Limit to first 50 files for feasibility
    console.log('✅ Games already imported\n');
    return;
  }

  console.log('♟️  IMPORTING GAMES (LIMITED TO FIRST 50 FILES)...');
  console.log(`   Starting from file ${checkpoint.games.fileIndex}\n`);

  const gameFiles = fs.readdirSync(BATCH_DIR)
    .filter(f => f.startsWith('gameIds-batch'))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
    .slice(0, 50); // Limit for feasibility

  // Create player name lookup
  console.log('   📋 Creating player lookup...');
  const playerLookup = new Map();
  const players = await new Promise(resolve => {
    db.all('SELECT id, name FROM players', (err, rows) => {
      if (!err && rows) {
        rows.forEach(p => playerLookup.set(p.name, p.id));
      }
      resolve();
    });
  });

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO games 
    (tournament_id, white_player_id, black_player_id, result, eco, date_played)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (let i = checkpoint.games.fileIndex; i < gameFiles.length; i++) {
    try {
      const file = gameFiles[i];
      const filePath = path.join(BATCH_DIR, file);
      
      if (!fs.existsSync(filePath)) continue;

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const games = Object.entries(data);

      let batchCount = 0;
      games.forEach(([gameId, game]) => {
        if (!game || typeof game !== 'object') return;
        
        const whiteId = playerLookup.get(game.white) || null;
        const blackId = playerLookup.get(game.black) || null;
        
        stmt.run(
          null, // tournament_id - would need tournament lookup
          whiteId,
          blackId,
          game.result || '*',
          game.eco || null,
          game.date || null
        );
        
        checkpoint.games.processed++;
        batchCount++;
      });

      checkpoint.games.fileIndex = i + 1;
      
      console.log(`   ✅ File ${i + 1}/${gameFiles.length} | ${batchCount.toLocaleString()} games | Total: ${checkpoint.games.processed.toLocaleString()}`);
      saveCheckpoint();

    } catch (error) {
      console.error(`   ❌ Error processing file ${i}:`, error.message);
    }
  }

  stmt.finalize();
  console.log(`\n✅ GAMES COMPLETE: ${checkpoint.games.processed.toLocaleString()} games imported\n`);
}

// Create production indexes
async function createIndexes() {
  if (checkpoint.indexesCreated) {
    console.log('✅ Indexes already created\n');
    return;
  }

  console.log('🔍 CREATING PRODUCTION INDEXES...');
  console.log('   This may take 10-30 minutes for large datasets\n');

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_players_name ON players(name)',
    'CREATE INDEX IF NOT EXISTS idx_players_normalized ON players(name_normalized)',
    'CREATE INDEX IF NOT EXISTS idx_players_rating ON players(peak_rating DESC)',
    'CREATE INDEX IF NOT EXISTS idx_players_federation ON players(federation)',
    'CREATE INDEX IF NOT EXISTS idx_tournaments_name ON tournaments(name)',
    'CREATE INDEX IF NOT EXISTS idx_tournaments_normalized ON tournaments(name_normalized)',
    'CREATE INDEX IF NOT EXISTS idx_tournaments_date ON tournaments(start_date)',
    'CREATE INDEX IF NOT EXISTS idx_tournaments_location ON tournaments(location)',
    'CREATE INDEX IF NOT EXISTS idx_games_tournament ON games(tournament_id)',
    'CREATE INDEX IF NOT EXISTS idx_games_players ON games(white_player_id, black_player_id)',
    'CREATE INDEX IF NOT EXISTS idx_games_date ON games(date_played)',
    'CREATE INDEX IF NOT EXISTS idx_games_eco ON games(eco)',
    'CREATE INDEX IF NOT EXISTS idx_games_result ON games(result)'
  ];

  for (const [i, indexSQL] of indexes.entries()) {
    console.log(`   Creating index ${i + 1}/${indexes.length}...`);
    await new Promise(resolve => {
      db.run(indexSQL, resolve);
    });
  }

  checkpoint.indexesCreated = true;
  saveCheckpoint();
  
  console.log('✅ All indexes created\n');
}

// Optimize final database
async function optimizeDatabase() {
  console.log('⚡ OPTIMIZING PRODUCTION DATABASE...\n');

  return new Promise(resolve => {
    db.serialize(() => {
      console.log('   Running ANALYZE...');
      db.run('ANALYZE');
      
      console.log('   Running VACUUM...');
      db.run('VACUUM');
      
      console.log('   Updating statistics...');
      
      // Update player game counts
      db.run(`
        UPDATE players SET total_games = (
          SELECT COUNT(*) FROM games 
          WHERE white_player_id = players.id OR black_player_id = players.id
        )
      `);
      
      // Update tournament game counts  
      db.run(`
        UPDATE tournaments SET games_count = (
          SELECT COUNT(*) FROM games WHERE tournament_id = tournaments.id
        )
      `);

      console.log('✅ Database optimized\n');
      resolve();
    });
  });
}

// Main build function
async function buildProductionDatabase() {
  const startTime = Date.now();
  
  try {
    await createProductionSchema();
    await importPlayers();
    await importTournaments();
    await importGames();
    await createIndexes();
    await optimizeDatabase();

    const duration = Math.round((Date.now() - startTime) / 1000 / 60);
    
    // Get final statistics
    db.serialize(() => {
      db.get('SELECT COUNT(*) as count FROM players', (err, row) => {
        const playerCount = row?.count || 0;
        
        db.get('SELECT COUNT(*) as count FROM tournaments', (err, row) => {
          const tournamentCount = row?.count || 0;
          
          db.get('SELECT COUNT(*) as count FROM games', (err, row) => {
            const gameCount = row?.count || 0;
            
            const stats = fs.statSync(PRODUCTION_DB);
            const sizeGB = (stats.size / 1024 / 1024 / 1024).toFixed(2);

            console.log('='.repeat(70));
            console.log('🎉 PRODUCTION DATABASE COMPLETE!');
            console.log('='.repeat(70));
            console.log(`⏱️  Build time: ${duration} minutes`);
            console.log(`👥 Players: ${playerCount.toLocaleString()}`);
            console.log(`🏆 Tournaments: ${tournamentCount.toLocaleString()}`);
            console.log(`♟️  Games: ${gameCount.toLocaleString()}`);
            console.log(`💾 Database size: ${sizeGB} GB`);
            console.log(`📍 Location: ${PRODUCTION_DB}`);
            console.log('='.repeat(70));
            console.log('\n📦 DEPLOYMENT INSTRUCTIONS:');
            console.log('1. Upload chess-production.db to your server');
            console.log('2. Update your API to use the production database');
            console.log('3. Restart your tournament archive API');
            console.log('4. Your platform will have world-class chess data!\n');
            
            // Clean up
            if (fs.existsSync(CHECKPOINT_FILE)) {
              fs.unlinkSync(CHECKPOINT_FILE);
            }
            
            db.close();
          });
        });
      });
    });

  } catch (error) {
    console.error('\n❌ Build failed:', error);
    console.log('💡 Run the script again to resume from checkpoint');
    db.close();
  }
}

// Start the build
console.log('🚀 Starting production database build...\n');
buildProductionDatabase();