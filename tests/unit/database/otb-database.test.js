const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

describe('OTB Database Operations', () => {
  let db;
  const testDbPath = path.join(__dirname, 'test-otb.db');

  beforeAll((done) => {
    // Create test database
    db = new sqlite3.Database(':memory:', (err) => {
      if (err) return done(err);
      
      // Create tables
      db.serialize(() => {
        db.run(`CREATE TABLE games (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tournament_name TEXT,
          white_player TEXT,
          black_player TEXT,
          result TEXT,
          date TEXT,
          round TEXT,
          eco TEXT,
          opening TEXT,
          ply_count INTEGER,
          moves TEXT,
          pgn_file TEXT
        )`);

        db.run(`CREATE TABLE tournaments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE,
          start_date TEXT,
          end_date TEXT,
          location TEXT,
          total_games INTEGER
        )`);

        db.run(`CREATE TABLE players (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE,
          rating INTEGER,
          title TEXT,
          country TEXT,
          games_played INTEGER
        )`);

        done();
      });
    });
  });

  afterAll((done) => {
    if (db) {
      db.close((err) => {
        if (err) console.error('Error closing database:', err);
        done();
      });
    } else {
      done();
    }
  });

  describe('Game Operations', () => {
    it('should insert a game record', (done) => {
      const game = {
        tournament_name: 'World Championship 2024',
        white_player: 'Magnus Carlsen',
        black_player: 'Ian Nepomniachtchi',
        result: '1-0',
        date: '2024-01-15',
        round: '1',
        eco: 'C42',
        opening: 'Russian Game',
        ply_count: 45,
        moves: '1.e4 e5 2.Nf3 Nf6',
        pgn_file: 'wch2024.pgn'
      };

      const stmt = db.prepare(`INSERT INTO games 
        (tournament_name, white_player, black_player, result, date, round, eco, opening, ply_count, moves, pgn_file) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

      stmt.run([
        game.tournament_name, game.white_player, game.black_player,
        game.result, game.date, game.round, game.eco, game.opening,
        game.ply_count, game.moves, game.pgn_file
      ], function(err) {
        expect(err).toBeNull();
        expect(this.lastID).toBe(1);
        stmt.finalize();
        done();
      });
    });

    it('should query games by player', (done) => {
      db.all(
        "SELECT * FROM games WHERE white_player = ? OR black_player = ?",
        ['Magnus Carlsen', 'Magnus Carlsen'],
        (err, rows) => {
          expect(err).toBeNull();
          expect(rows.length).toBe(1);
          expect(rows[0].white_player).toBe('Magnus Carlsen');
          done();
        }
      );
    });

    it('should query games by tournament', (done) => {
      db.all(
        "SELECT * FROM games WHERE tournament_name = ?",
        ['World Championship 2024'],
        (err, rows) => {
          expect(err).toBeNull();
          expect(rows.length).toBe(1);
          done();
        }
      );
    });

    it('should query games by ECO code', (done) => {
      db.all(
        "SELECT * FROM games WHERE eco = ?",
        ['C42'],
        (err, rows) => {
          expect(err).toBeNull();
          expect(rows.length).toBe(1);
          expect(rows[0].opening).toBe('Russian Game');
          done();
        }
      );
    });

    it('should count total games', (done) => {
      db.get("SELECT COUNT(*) as count FROM games", (err, row) => {
        expect(err).toBeNull();
        expect(row.count).toBe(1);
        done();
      });
    });
  });

  describe('Tournament Operations', () => {
    it('should insert tournament record', (done) => {
      const tournament = {
        name: 'World Championship 2024',
        start_date: '2024-01-15',
        end_date: '2024-02-01',
        location: 'Dubai, UAE',
        total_games: 14
      };

      db.run(
        `INSERT INTO tournaments (name, start_date, end_date, location, total_games) 
         VALUES (?, ?, ?, ?, ?)`,
        [tournament.name, tournament.start_date, tournament.end_date, tournament.location, tournament.total_games],
        function(err) {
          expect(err).toBeNull();
          expect(this.lastID).toBe(1);
          done();
        }
      );
    });

    it('should query tournaments by date range', (done) => {
      db.all(
        "SELECT * FROM tournaments WHERE start_date >= ? AND end_date <= ?",
        ['2024-01-01', '2024-12-31'],
        (err, rows) => {
          expect(err).toBeNull();
          expect(rows.length).toBe(1);
          expect(rows[0].name).toBe('World Championship 2024');
          done();
        }
      );
    });

    it('should update tournament game count', (done) => {
      db.run(
        "UPDATE tournaments SET total_games = ? WHERE name = ?",
        [15, 'World Championship 2024'],
        function(err) {
          expect(err).toBeNull();
          expect(this.changes).toBe(1);
          
          db.get(
            "SELECT total_games FROM tournaments WHERE name = ?",
            ['World Championship 2024'],
            (err, row) => {
              expect(row.total_games).toBe(15);
              done();
            }
          );
        }
      );
    });
  });

  describe('Player Operations', () => {
    it('should insert player record', (done) => {
      const player = {
        name: 'Magnus Carlsen',
        rating: 2830,
        title: 'GM',
        country: 'Norway',
        games_played: 5000
      };

      db.run(
        `INSERT OR IGNORE INTO players (name, rating, title, country, games_played) 
         VALUES (?, ?, ?, ?, ?)`,
        [player.name, player.rating, player.title, player.country, player.games_played],
        function(err) {
          expect(err).toBeNull();
          done();
        }
      );
    });

    it('should query top players by rating', (done) => {
      // Insert more players
      const players = [
        ['Hikaru Nakamura', 2790, 'GM', 'USA', 4500],
        ['Fabiano Caruana', 2795, 'GM', 'USA', 4800]
      ];

      let inserted = 0;
      players.forEach(player => {
        db.run(
          `INSERT OR IGNORE INTO players (name, rating, title, country, games_played) 
           VALUES (?, ?, ?, ?, ?)`,
          player,
          () => {
            inserted++;
            if (inserted === players.length) {
              db.all(
                "SELECT * FROM players ORDER BY rating DESC LIMIT 3",
                (err, rows) => {
                  expect(err).toBeNull();
                  expect(rows[0].name).toBe('Magnus Carlsen');
                  expect(rows[0].rating).toBe(2830);
                  done();
                }
              );
            }
          }
        );
      });
    });

    it('should update player rating', (done) => {
      db.run(
        "UPDATE players SET rating = ? WHERE name = ?",
        [2835, 'Magnus Carlsen'],
        function(err) {
          expect(err).toBeNull();
          expect(this.changes).toBe(1);
          
          db.get(
            "SELECT rating FROM players WHERE name = ?",
            ['Magnus Carlsen'],
            (err, row) => {
              expect(row.rating).toBe(2835);
              done();
            }
          );
        }
      );
    });

    it('should query players by country', (done) => {
      db.all(
        "SELECT * FROM players WHERE country = ?",
        ['USA'],
        (err, rows) => {
          expect(err).toBeNull();
          expect(rows.length).toBe(2);
          done();
        }
      );
    });
  });

  describe('Complex Queries', () => {
    it('should get player statistics', (done) => {
      // Add more games for statistics
      const games = [
        ['World Cup 2024', 'Magnus Carlsen', 'Hikaru Nakamura', '1-0', '2024-02-01'],
        ['World Cup 2024', 'Fabiano Caruana', 'Magnus Carlsen', '1/2-1/2', '2024-02-02'],
        ['World Cup 2024', 'Magnus Carlsen', 'Fabiano Caruana', '1-0', '2024-02-03']
      ];

      let inserted = 0;
      games.forEach(game => {
        db.run(
          `INSERT INTO games (tournament_name, white_player, black_player, result, date) 
           VALUES (?, ?, ?, ?, ?)`,
          game,
          () => {
            inserted++;
            if (inserted === games.length) {
              // Query player statistics
              const query = `
                SELECT 
                  COUNT(*) as total_games,
                  SUM(CASE 
                    WHEN (white_player = ? AND result = '1-0') OR 
                         (black_player = ? AND result = '0-1') 
                    THEN 1 ELSE 0 END) as wins,
                  SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws
                FROM games 
                WHERE white_player = ? OR black_player = ?
              `;

              db.get(
                query,
                ['Magnus Carlsen', 'Magnus Carlsen', 'Magnus Carlsen', 'Magnus Carlsen'],
                (err, row) => {
                  expect(err).toBeNull();
                  expect(row.total_games).toBe(4);
                  expect(row.wins).toBe(3);
                  expect(row.draws).toBe(1);
                  done();
                }
              );
            }
          }
        );
      });
    });

    it('should get opening statistics', (done) => {
      db.all(
        `SELECT eco, opening, COUNT(*) as count, 
         AVG(CASE WHEN result = '1-0' THEN 1 WHEN result = '1/2-1/2' THEN 0.5 ELSE 0 END) as white_score
         FROM games 
         WHERE eco IS NOT NULL 
         GROUP BY eco, opening`,
        (err, rows) => {
          expect(err).toBeNull();
          expect(rows.length).toBeGreaterThan(0);
          expect(rows[0].eco).toBe('C42');
          done();
        }
      );
    });

    it('should get tournament standings', (done) => {
      const query = `
        SELECT 
          player,
          COUNT(*) as games,
          SUM(score) as total_score
        FROM (
          SELECT white_player as player,
                 CASE result 
                   WHEN '1-0' THEN 1 
                   WHEN '1/2-1/2' THEN 0.5 
                   ELSE 0 
                 END as score
          FROM games
          WHERE tournament_name = ?
          UNION ALL
          SELECT black_player as player,
                 CASE result 
                   WHEN '0-1' THEN 1 
                   WHEN '1/2-1/2' THEN 0.5 
                   ELSE 0 
                 END as score
          FROM games
          WHERE tournament_name = ?
        )
        GROUP BY player
        ORDER BY total_score DESC
      `;

      db.all(
        query,
        ['World Cup 2024', 'World Cup 2024'],
        (err, rows) => {
          expect(err).toBeNull();
          expect(rows.length).toBeGreaterThan(0);
          expect(rows[0].player).toBe('Magnus Carlsen');
          done();
        }
      );
    });
  });

  describe('Database Indexes', () => {
    it('should create indexes for performance', (done) => {
      const indexes = [
        "CREATE INDEX IF NOT EXISTS idx_games_players ON games(white_player, black_player)",
        "CREATE INDEX IF NOT EXISTS idx_games_tournament ON games(tournament_name)",
        "CREATE INDEX IF NOT EXISTS idx_games_date ON games(date)",
        "CREATE INDEX IF NOT EXISTS idx_games_eco ON games(eco)",
        "CREATE INDEX IF NOT EXISTS idx_players_rating ON players(rating DESC)",
        "CREATE INDEX IF NOT EXISTS idx_tournaments_dates ON tournaments(start_date, end_date)"
      ];

      let created = 0;
      indexes.forEach(index => {
        db.run(index, (err) => {
          expect(err).toBeNull();
          created++;
          if (created === indexes.length) {
            done();
          }
        });
      });
    });

    it('should verify index existence', (done) => {
      db.all(
        "SELECT name FROM sqlite_master WHERE type = 'index'",
        (err, rows) => {
          expect(err).toBeNull();
          expect(rows.length).toBeGreaterThanOrEqual(6);
          const indexNames = rows.map(r => r.name);
          expect(indexNames).toContain('idx_games_players');
          expect(indexNames).toContain('idx_games_tournament');
          done();
        }
      );
    });
  });

  describe('Batch Operations', () => {
    it('should insert multiple games in batch', (done) => {
      const games = [
        ['Batch Tournament', 'Player1', 'Player2', '1-0', '2024-03-01'],
        ['Batch Tournament', 'Player3', 'Player4', '0-1', '2024-03-01'],
        ['Batch Tournament', 'Player1', 'Player3', '1/2-1/2', '2024-03-02']
      ];

      db.serialize(() => {
        const stmt = db.prepare(
          `INSERT INTO games (tournament_name, white_player, black_player, result, date) 
           VALUES (?, ?, ?, ?, ?)`
        );

        games.forEach(game => {
          stmt.run(game);
        });

        stmt.finalize((err) => {
          expect(err).toBeNull();
          
          db.get(
            "SELECT COUNT(*) as count FROM games WHERE tournament_name = 'Batch Tournament'",
            (err, row) => {
              expect(row.count).toBe(3);
              done();
            }
          );
        });
      });
    });
  });
});