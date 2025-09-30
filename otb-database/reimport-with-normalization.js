/**
 * Re-import all PGN files with name normalization
 * This will properly capture all Bobby Fischer games and other players with name variations
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const EnhancedPGNParser = require('./enhanced-pgn-parser');

class DatabaseReimporter {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.parser = new EnhancedPGNParser();
    this.stats = {
      filesProcessed: 0,
      totalGames: 0,
      gamesImported: 0,
      errors: [],
      playerStats: {}
    };
  }

  /**
   * Initialize database connection and tables
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      // Backup existing database
      const backupPath = this.dbPath.replace('.db', `-backup-${Date.now()}.db`);
      if (fs.existsSync(this.dbPath)) {
        console.log(`Creating backup at ${backupPath}`);
        fs.copyFileSync(this.dbPath, backupPath);
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  /**
   * Create or update database tables
   */
  async createTables() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Drop existing tables for clean reimport
        console.log('Dropping existing tables...');
        this.db.run('DROP TABLE IF EXISTS games');
        this.db.run('DROP TABLE IF EXISTS players');
        this.db.run('DROP TABLE IF EXISTS player_aliases');
        this.db.run('DROP TABLE IF EXISTS tournaments');

        // Create games table with normalized names
        this.db.run(`
          CREATE TABLE games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event TEXT,
            site TEXT,
            date TEXT,
            round TEXT,
            white TEXT,
            white_original TEXT,
            black TEXT,
            black_original TEXT,
            result TEXT,
            white_elo INTEGER,
            black_elo INTEGER,
            eco TEXT,
            opening TEXT,
            variation TEXT,
            moves TEXT,
            ply_count INTEGER,
            time_control TEXT,
            termination TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create players table
        this.db.run(`
          CREATE TABLE players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            canonical_name TEXT UNIQUE,
            first_game_date TEXT,
            last_game_date TEXT,
            total_games INTEGER DEFAULT 0,
            wins_as_white INTEGER DEFAULT 0,
            wins_as_black INTEGER DEFAULT 0,
            draws INTEGER DEFAULT 0,
            peak_elo INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create player aliases table
        this.db.run(`
          CREATE TABLE player_aliases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            canonical_name TEXT,
            alias TEXT UNIQUE,
            occurrences INTEGER DEFAULT 1,
            FOREIGN KEY (canonical_name) REFERENCES players(canonical_name)
          )
        `);

        // Create tournaments table
        this.db.run(`
          CREATE TABLE tournaments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            site TEXT,
            start_date TEXT,
            end_date TEXT,
            total_games INTEGER DEFAULT 0,
            total_rounds INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create indexes for performance
        console.log('Creating indexes...');
        this.db.run('CREATE INDEX idx_games_white ON games(white)');
        this.db.run('CREATE INDEX idx_games_black ON games(black)');
        this.db.run('CREATE INDEX idx_games_date ON games(date)');
        this.db.run('CREATE INDEX idx_games_event ON games(event)');
        this.db.run('CREATE INDEX idx_games_eco ON games(eco)');
        this.db.run('CREATE INDEX idx_player_aliases_canonical ON player_aliases(canonical_name)');
        this.db.run('CREATE INDEX idx_player_aliases_alias ON player_aliases(alias)', (err) => {
          if (err) reject(err);
          else {
            console.log('Database tables created successfully');
            resolve();
          }
        });
      });
    });
  }

  /**
   * Import games into database
   */
  async importGames(games) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO games (
          event, site, date, round, 
          white, white_original, black, black_original,
          result, white_elo, black_elo, 
          eco, opening, variation, moves, 
          ply_count, time_control, termination
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const playerStmt = this.db.prepare(`
        INSERT OR IGNORE INTO players (canonical_name) VALUES (?)
      `);

      const aliasStmt = this.db.prepare(`
        INSERT OR REPLACE INTO player_aliases (canonical_name, alias, occurrences)
        VALUES (?, ?, COALESCE((SELECT occurrences FROM player_aliases WHERE alias = ?) + 1, 1))
      `);

      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        let imported = 0;
        for (const game of games) {
          try {
            // Import game
            stmt.run(
              game.event, game.site, game.date, game.round,
              game.white, game.whiteOriginal, game.black, game.blackOriginal,
              game.result, game.whiteElo, game.blackElo,
              game.eco, game.opening, game.variation, game.moves,
              game.plyCount, game.timeControl, game.termination
            );

            // Add players and aliases
            playerStmt.run(game.white);
            playerStmt.run(game.black);
            
            if (game.whiteOriginal !== game.white) {
              aliasStmt.run(game.white, game.whiteOriginal, game.whiteOriginal);
            }
            if (game.blackOriginal !== game.black) {
              aliasStmt.run(game.black, game.blackOriginal, game.blackOriginal);
            }

            // Track player statistics
            if (!this.stats.playerStats[game.white]) {
              this.stats.playerStats[game.white] = { games: 0, asWhite: 0, asBlack: 0 };
            }
            if (!this.stats.playerStats[game.black]) {
              this.stats.playerStats[game.black] = { games: 0, asWhite: 0, asBlack: 0 };
            }
            
            this.stats.playerStats[game.white].games++;
            this.stats.playerStats[game.white].asWhite++;
            this.stats.playerStats[game.black].games++;
            this.stats.playerStats[game.black].asBlack++;

            imported++;
          } catch (error) {
            this.stats.errors.push({
              game: `${game.white} vs ${game.black}`,
              error: error.message
            });
          }
        }

        this.db.run('COMMIT', (err) => {
          stmt.finalize();
          playerStmt.finalize();
          aliasStmt.finalize();
          
          if (err) reject(err);
          else {
            this.stats.gamesImported += imported;
            console.log(`Imported ${imported} games`);
            resolve(imported);
          }
        });
      });
    });
  }

  /**
   * Process a single PGN file
   */
  async processFile(filePath) {
    console.log(`\nProcessing ${path.basename(filePath)}...`);
    
    try {
      const result = await this.parser.parseFile(filePath);
      
      console.log(`Parsed ${result.stats.totalGames} games from ${path.basename(filePath)}`);
      console.log(`Unique players: ${result.stats.uniquePlayers}`);
      
      // Show Fischer games if found
      const fischerGames = result.games.filter(g => 
        g.White === 'Fischer, Robert James' || g.Black === 'Fischer, Robert James'
      );
      if (fischerGames.length > 0) {
        console.log(`Found ${fischerGames.length} Fischer games in this file!`);
      }
      
      // Import to database
      if (result.games.length > 0) {
        const dbReady = this.parser.exportForDatabase.call({ games: result.games });
        await this.importGames(dbReady);
      }
      
      this.stats.filesProcessed++;
      this.stats.totalGames += result.stats.totalGames;
      
      return result.stats;
    } catch (error) {
      console.error(`Error processing ${filePath}: ${error.message}`);
      this.stats.errors.push({
        file: filePath,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Process all PGN files in a directory
   */
  async processDirectory(dirPath) {
    const files = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.pgn'))
      .map(f => path.join(dirPath, f));
    
    console.log(`Found ${files.length} PGN files to process`);
    
    for (const file of files) {
      await this.processFile(file);
    }
  }

  /**
   * Update player statistics
   */
  async updatePlayerStats() {
    return new Promise((resolve, reject) => {
      console.log('\nUpdating player statistics...');
      
      this.db.serialize(() => {
        // Update game counts
        this.db.run(`
          UPDATE players
          SET total_games = (
            SELECT COUNT(*) FROM games 
            WHERE white = players.canonical_name 
               OR black = players.canonical_name
          )
        `);
        
        // Update wins as white
        this.db.run(`
          UPDATE players
          SET wins_as_white = (
            SELECT COUNT(*) FROM games 
            WHERE white = players.canonical_name 
              AND result = '1-0'
          )
        `);
        
        // Update wins as black
        this.db.run(`
          UPDATE players
          SET wins_as_black = (
            SELECT COUNT(*) FROM games 
            WHERE black = players.canonical_name 
              AND result = '0-1'
          )
        `);
        
        // Update draws
        this.db.run(`
          UPDATE players
          SET draws = (
            SELECT COUNT(*) FROM games 
            WHERE (white = players.canonical_name OR black = players.canonical_name)
              AND result = '1/2-1/2'
          )
        `);
        
        // Update date ranges
        this.db.run(`
          UPDATE players
          SET first_game_date = (
            SELECT MIN(date) FROM games 
            WHERE white = players.canonical_name 
               OR black = players.canonical_name
          ),
          last_game_date = (
            SELECT MAX(date) FROM games 
            WHERE white = players.canonical_name 
               OR black = players.canonical_name
          )
        `);
        
        // Update peak ELO
        this.db.run(`
          UPDATE players
          SET peak_elo = (
            SELECT MAX(elo) FROM (
              SELECT MAX(white_elo) as elo FROM games WHERE white = players.canonical_name
              UNION ALL
              SELECT MAX(black_elo) as elo FROM games WHERE black = players.canonical_name
            )
          )
        `, (err) => {
          if (err) reject(err);
          else {
            console.log('Player statistics updated');
            resolve();
          }
        });
      });
    });
  }

  /**
   * Verify import results
   */
  async verifyImport() {
    return new Promise((resolve, reject) => {
      console.log('\nVerifying import results...');
      
      // Check total games
      this.db.get('SELECT COUNT(*) as count FROM games', (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        console.log(`Total games in database: ${row.count}`);
        
        // Check Fischer games specifically
        this.db.get(`
          SELECT COUNT(*) as count FROM games 
          WHERE white = 'Fischer, Robert James' 
             OR black = 'Fischer, Robert James'
        `, (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          console.log(`Bobby Fischer games: ${row.count}`);
          
          // Check top players
          this.db.all(`
            SELECT canonical_name, total_games 
            FROM players 
            ORDER BY total_games DESC 
            LIMIT 10
          `, (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            
            console.log('\nTop 10 players by game count:');
            rows.forEach(row => {
              console.log(`  ${row.canonical_name}: ${row.total_games} games`);
            });
            
            // Check aliases for Fischer
            this.db.all(`
              SELECT alias, occurrences 
              FROM player_aliases 
              WHERE canonical_name = 'Fischer, Robert James'
              ORDER BY occurrences DESC
            `, (err, rows) => {
              if (err) {
                reject(err);
                return;
              }
              
              if (rows.length > 0) {
                console.log('\nFischer name variations found:');
                rows.forEach(row => {
                  console.log(`  "${row.alias}" (${row.occurrences} times)`);
                });
              }
              
              resolve();
            });
          });
        });
      });
    });
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      console.log('\nDatabase connection closed');
    }
  }

  /**
   * Main import process
   */
  async run(pgnDirectory) {
    try {
      console.log('Starting database reimport with name normalization');
      console.log('=' . repeat(60));
      
      await this.initialize();
      await this.processDirectory(pgnDirectory);
      await this.updatePlayerStats();
      await this.verifyImport();
      
      console.log('\n' + '=' . repeat(60));
      console.log('Import Summary:');
      console.log(`Files processed: ${this.stats.filesProcessed}`);
      console.log(`Total games parsed: ${this.stats.totalGames}`);
      console.log(`Games imported: ${this.stats.gamesImported}`);
      console.log(`Errors: ${this.stats.errors.length}`);
      
      if (this.stats.errors.length > 0) {
        console.log('\nErrors:');
        this.stats.errors.slice(0, 10).forEach(e => {
          console.log(`  ${e.file || e.game}: ${e.error}`);
        });
      }
      
      this.close();
      return this.stats;
    } catch (error) {
      console.error('Import failed:', error);
      this.close();
      throw error;
    }
  }
}

// Run the reimport
async function main() {
  const dbPath = path.join(__dirname, 'chess-stats.db');
  const pgnDir = path.join(__dirname, 'pgn-files');
  
  const importer = new DatabaseReimporter(dbPath);
  await importer.run(pgnDir);
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = DatabaseReimporter;