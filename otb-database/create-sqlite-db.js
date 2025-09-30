const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

class DatabaseCreator {
  constructor() {
    this.dbPath = path.join(__dirname, 'chess-stats.db');
    this.tempDir = path.join(__dirname, 'indexes', 'temp');
    
    // Remove existing database
    if (fs.existsSync(this.dbPath)) {
      fs.unlinkSync(this.dbPath);
      console.log('Removed existing database');
    }
    
    this.db = new sqlite3.Database(this.dbPath);
    console.log('Creating new SQLite database...');
  }

  async initialize() {
    await this.createTables();
    await this.createIndexes();
    await this.importData();
    await this.createViews();
    await this.analyzeDatabase();
    
    console.log('\n✅ Database creation complete!');
    this.printStats();
  }

  createTables() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Players table
        this.db.run(`
          CREATE TABLE players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            games_count INTEGER DEFAULT 0,
            wins INTEGER DEFAULT 0,
            draws INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            rating_peak INTEGER,
            first_game_date TEXT,
            last_game_date TEXT
          )
        `);

        // Events table
        this.db.run(`
          CREATE TABLE events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            games_count INTEGER DEFAULT 0,
            location TEXT,
            start_date TEXT,
            end_date TEXT
          )
        `);

        // Games table (lightweight - only essential data)
        this.db.run(`
          CREATE TABLE games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            white_player_id INTEGER,
            black_player_id INTEGER,
            event_id INTEGER,
            result TEXT CHECK(result IN ('1-0', '0-1', '1/2-1/2', '*')),
            date TEXT,
            eco TEXT,
            opening TEXT,
            time_control TEXT,
            ply_count INTEGER,
            FOREIGN KEY (white_player_id) REFERENCES players(id),
            FOREIGN KEY (black_player_id) REFERENCES players(id),
            FOREIGN KEY (event_id) REFERENCES events(id)
          )
        `);

        // Openings table
        this.db.run(`
          CREATE TABLE openings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            eco TEXT,
            name TEXT UNIQUE NOT NULL,
            games_count INTEGER DEFAULT 0,
            white_wins INTEGER DEFAULT 0,
            draws INTEGER DEFAULT 0,
            black_wins INTEGER DEFAULT 0
          )
        `);

        // Player ratings history
        this.db.run(`
          CREATE TABLE ratings (
            player_id INTEGER,
            date TEXT,
            rating INTEGER,
            rating_type TEXT DEFAULT 'standard',
            PRIMARY KEY (player_id, date, rating_type),
            FOREIGN KEY (player_id) REFERENCES players(id)
          )
        `);

        // Head to head results
        this.db.run(`
          CREATE TABLE head_to_head (
            player1_id INTEGER,
            player2_id INTEGER,
            player1_wins INTEGER DEFAULT 0,
            draws INTEGER DEFAULT 0,
            player2_wins INTEGER DEFAULT 0,
            time_control TEXT,
            PRIMARY KEY (player1_id, player2_id, time_control),
            FOREIGN KEY (player1_id) REFERENCES players(id),
            FOREIGN KEY (player2_id) REFERENCES players(id)
          )
        `);

        console.log('✓ Tables created');
        resolve();
      });
    });
  }

  createIndexes() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Player indexes
        this.db.run('CREATE INDEX idx_players_name ON players(name)');
        this.db.run('CREATE INDEX idx_players_games ON players(games_count DESC)');
        this.db.run('CREATE INDEX idx_players_rating ON players(rating_peak DESC)');
        
        // Event indexes
        this.db.run('CREATE INDEX idx_events_name ON events(name)');
        this.db.run('CREATE INDEX idx_events_date ON events(start_date)');
        
        // Game indexes
        this.db.run('CREATE INDEX idx_games_white ON games(white_player_id)');
        this.db.run('CREATE INDEX idx_games_black ON games(black_player_id)');
        this.db.run('CREATE INDEX idx_games_event ON games(event_id)');
        this.db.run('CREATE INDEX idx_games_date ON games(date)');
        this.db.run('CREATE INDEX idx_games_opening ON games(opening)');
        this.db.run('CREATE INDEX idx_games_eco ON games(eco)');
        
        // Opening indexes
        this.db.run('CREATE INDEX idx_openings_eco ON openings(eco)');
        this.db.run('CREATE INDEX idx_openings_count ON openings(games_count DESC)');
        
        // Rating indexes
        this.db.run('CREATE INDEX idx_ratings_player ON ratings(player_id)');
        this.db.run('CREATE INDEX idx_ratings_date ON ratings(date)');
        
        // Head to head indexes
        this.db.run('CREATE INDEX idx_h2h_players ON head_to_head(player1_id, player2_id)');
        
        console.log('✓ Indexes created');
        resolve();
      });
    });
  }

  async importData() {
    console.log('\nImporting data from batch files...');
    
    // Import players
    await this.importPlayers();
    
    // Import events
    await this.importEvents();
    
    // Import openings
    await this.importOpenings();
    
    console.log('✓ Data import complete');
  }

  importPlayers() {
    return new Promise((resolve, reject) => {
      console.log('Importing players...');
      
      const stmt = this.db.prepare('INSERT OR IGNORE INTO players (name, games_count) VALUES (?, ?)');
      
      let totalPlayers = 0;
      let processedFiles = 0;
      
      // Read all player batch files
      const files = fs.readdirSync(this.tempDir)
        .filter(f => f.startsWith('players-batch-'))
        .slice(0, 50); // Process first 50 batches for speed
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        Object.entries(data).forEach(([name, count]) => {
          stmt.run(name, count);
          totalPlayers++;
        });
        
        processedFiles++;
        if (processedFiles % 10 === 0) {
          console.log(`  Processed ${processedFiles}/${files.length} player batches...`);
        }
      }
      
      stmt.finalize();
      console.log(`  Imported ${totalPlayers.toLocaleString()} players`);
      resolve();
    });
  }

  importEvents() {
    return new Promise((resolve, reject) => {
      console.log('Importing events...');
      
      const stmt = this.db.prepare('INSERT OR IGNORE INTO events (name, games_count) VALUES (?, ?)');
      
      let totalEvents = 0;
      let processedFiles = 0;
      
      // Read all event batch files
      const files = fs.readdirSync(this.tempDir)
        .filter(f => f.startsWith('events-batch-'))
        .slice(0, 50); // Process first 50 batches
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        Object.entries(data).forEach(([name, count]) => {
          stmt.run(name, count);
          totalEvents++;
        });
        
        processedFiles++;
        if (processedFiles % 10 === 0) {
          console.log(`  Processed ${processedFiles}/${files.length} event batches...`);
        }
      }
      
      stmt.finalize();
      console.log(`  Imported ${totalEvents.toLocaleString()} events`);
      resolve();
    });
  }

  importOpenings() {
    return new Promise((resolve, reject) => {
      console.log('Importing openings...');
      
      const stmt = this.db.prepare('INSERT OR IGNORE INTO openings (name, games_count) VALUES (?, ?)');
      
      let totalOpenings = 0;
      let processedFiles = 0;
      
      // Read all opening batch files
      const files = fs.readdirSync(this.tempDir)
        .filter(f => f.startsWith('openings-batch-'))
        .slice(0, 50); // Process first 50 batches
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        Object.entries(data).forEach(([name, count]) => {
          stmt.run(name, count);
          totalOpenings++;
        });
        
        processedFiles++;
        if (processedFiles % 10 === 0) {
          console.log(`  Processed ${processedFiles}/${files.length} opening batches...`);
        }
      }
      
      stmt.finalize();
      console.log(`  Imported ${totalOpenings.toLocaleString()} openings`);
      resolve();
    });
  }

  createViews() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Top players view
        this.db.run(`
          CREATE VIEW top_players AS
          SELECT * FROM players
          ORDER BY games_count DESC
          LIMIT 100
        `);

        // Popular openings view
        this.db.run(`
          CREATE VIEW popular_openings AS
          SELECT * FROM openings
          ORDER BY games_count DESC
          LIMIT 50
        `);

        // Major events view
        this.db.run(`
          CREATE VIEW major_events AS
          SELECT * FROM events
          WHERE games_count > 100
          ORDER BY games_count DESC
        `);

        console.log('✓ Views created');
        resolve();
      });
    });
  }

  analyzeDatabase() {
    return new Promise((resolve, reject) => {
      console.log('Analyzing database for optimization...');
      this.db.run('ANALYZE', () => {
        console.log('✓ Database analyzed');
        resolve();
      });
    });
  }

  printStats() {
    this.db.serialize(() => {
      this.db.get('SELECT COUNT(*) as count FROM players', (err, row) => {
        console.log(`Players: ${row.count.toLocaleString()}`);
      });
      
      this.db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
        console.log(`Events: ${row.count.toLocaleString()}`);
      });
      
      this.db.get('SELECT COUNT(*) as count FROM openings', (err, row) => {
        console.log(`Openings: ${row.count.toLocaleString()}`);
      });
      
      // Get database file size
      const stats = fs.statSync(this.dbPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`\nDatabase size: ${sizeMB} MB`);
      console.log(`Database location: ${this.dbPath}`);
      
      // Show top 5 players
      console.log('\nTop 5 Players by Game Count:');
      this.db.all('SELECT name, games_count FROM top_players LIMIT 5', (err, rows) => {
        rows.forEach((row, i) => {
          console.log(`  ${i + 1}. ${row.name}: ${row.games_count} games`);
        });
        
        this.db.close();
      });
    });
  }
}

// Check if sqlite3 is installed
try {
  require.resolve('sqlite3');
} catch(e) {
  console.log('Installing sqlite3...');
  require('child_process').execSync('npm install sqlite3', { stdio: 'inherit' });
}

// Run the database creator
const creator = new DatabaseCreator();
creator.initialize().catch(console.error);