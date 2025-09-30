/**
 * Extract tournament data from games database
 * Create proper tournament records with metadata
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class TournamentExtractor {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.stats = {
      tournaments: 0,
      processed: 0,
      errors: []
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) reject(err);
        else {
          console.log('Connected to database');
          resolve();
        }
      });
    });
  }

  /**
   * Create tournaments table if it doesn't exist
   */
  async createTournamentTable() {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS tournaments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE,
          site TEXT,
          year INTEGER,
          start_date TEXT,
          end_date TEXT,
          total_games INTEGER DEFAULT 0,
          total_players INTEGER DEFAULT 0,
          total_rounds INTEGER,
          avg_rating REAL,
          winner_white TEXT,
          winner_black TEXT,
          format TEXT,
          time_control TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else {
          console.log('Tournaments table ready');
          resolve();
        }
      });
    });
  }

  /**
   * Extract unique tournaments from games
   */
  async extractTournaments() {
    return new Promise((resolve, reject) => {
      console.log('Extracting tournaments from games...');
      
      const query = `
        SELECT 
          event,
          site,
          MIN(date) as start_date,
          MAX(date) as end_date,
          COUNT(*) as game_count,
          COUNT(DISTINCT white) + COUNT(DISTINCT black) - COUNT(DISTINCT 
            CASE WHEN white = black THEN white ELSE NULL END
          ) as player_count,
          COUNT(DISTINCT round) as round_count,
          AVG(CASE WHEN white_elo > 0 AND black_elo > 0 THEN (white_elo + black_elo) / 2.0 END) as avg_rating,
          GROUP_CONCAT(DISTINCT time_control) as time_controls
        FROM games 
        WHERE event IS NOT NULL AND event != ''
        GROUP BY event, site
        HAVING game_count >= 3
        ORDER BY game_count DESC
      `;
      
      this.db.all(query, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log(`Found ${rows.length} tournaments with 3+ games`);
        
        // Insert tournaments
        const insertStmt = this.db.prepare(`
          INSERT OR REPLACE INTO tournaments (
            name, site, year, start_date, end_date, 
            total_games, total_players, total_rounds, 
            avg_rating, time_control
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        let inserted = 0;
        
        this.db.serialize(() => {
          this.db.run('BEGIN TRANSACTION');
          
          for (const row of rows) {
            try {
              const year = row.start_date ? parseInt(row.start_date.substring(0, 4)) : null;
              
              insertStmt.run(
                row.event,
                row.site,
                year,
                row.start_date,
                row.end_date,
                row.game_count,
                row.player_count,
                row.round_count,
                Math.round(row.avg_rating || 0),
                row.time_controls
              );
              
              inserted++;
            } catch (error) {
              this.stats.errors.push({
                tournament: row.event,
                error: error.message
              });
            }
          }
          
          this.db.run('COMMIT', (err) => {
            insertStmt.finalize();
            
            if (err) reject(err);
            else {
              console.log(`Inserted ${inserted} tournaments`);
              this.stats.tournaments = inserted;
              resolve(inserted);
            }
          });
        });
      });
    });
  }

  /**
   * Get tournament statistics
   */
  async getStatistics() {
    return new Promise((resolve, reject) => {
      const queries = {
        totalTournaments: 'SELECT COUNT(*) as count FROM tournaments',
        byYear: `
          SELECT year, COUNT(*) as count, SUM(total_games) as games
          FROM tournaments 
          WHERE year IS NOT NULL 
          GROUP BY year 
          ORDER BY year DESC 
          LIMIT 20
        `,
        largest: `
          SELECT name, site, year, total_games, total_players, avg_rating
          FROM tournaments 
          ORDER BY total_games DESC 
          LIMIT 10
        `,
        highest_rated: `
          SELECT name, site, year, total_games, total_players, avg_rating
          FROM tournaments 
          WHERE avg_rating > 0
          ORDER BY avg_rating DESC 
          LIMIT 10
        `
      };
      
      const results = {};
      let completed = 0;
      
      for (const [key, query] of Object.entries(queries)) {
        this.db.all(query, (err, rows) => {
          if (err) {
            console.error(`Error in ${key}:`, err);
          } else {
            results[key] = key === 'totalTournaments' ? rows[0]?.count : rows;
          }
          
          completed++;
          if (completed === Object.keys(queries).length) {
            resolve(results);
          }
        });
      }
    });
  }

  close() {
    if (this.db) {
      this.db.close();
      console.log('Database connection closed');
    }
  }

  async run() {
    try {
      await this.connect();
      await this.createTournamentTable();
      await this.extractTournaments();
      
      const stats = await this.getStatistics();
      
      console.log('\n' + '='.repeat(50));
      console.log('Tournament Extraction Complete');
      console.log('='.repeat(50));
      console.log(`Total tournaments: ${stats.totalTournaments}`);
      
      if (stats.byYear && stats.byYear.length > 0) {
        console.log('\nTournaments by year (recent):');
        stats.byYear.slice(0, 5).forEach(year => {
          console.log(`  ${year.year}: ${year.count} tournaments, ${year.games} games`);
        });
      }
      
      if (stats.largest && stats.largest.length > 0) {
        console.log('\nLargest tournaments:');
        stats.largest.slice(0, 5).forEach((t, i) => {
          console.log(`  ${i + 1}. ${t.name} (${t.year}) - ${t.total_games} games, ${t.total_players} players`);
        });
      }
      
      if (stats.highest_rated && stats.highest_rated.length > 0) {
        console.log('\nHighest rated tournaments:');
        stats.highest_rated.slice(0, 5).forEach((t, i) => {
          console.log(`  ${i + 1}. ${t.name} (${t.year}) - avg ${Math.round(t.avg_rating)} rating`);
        });
      }
      
      this.close();
      return this.stats;
      
    } catch (error) {
      console.error('Tournament extraction failed:', error);
      this.close();
      throw error;
    }
  }
}

// Run extraction
async function main() {
  const dbPath = path.join(__dirname, 'chess-stats.db');
  const extractor = new TournamentExtractor(dbPath);
  await extractor.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = TournamentExtractor;