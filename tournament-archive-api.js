const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3010;

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Connect to production database
const dbPath = path.join(__dirname, 'chess-production.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    console.log('Creating new database...');
    createDatabase();
  } else {
    console.log('Connected to tournament archive database');
    enhanceDatabase();
  }
});

// Enhance existing database with additional tables for tournament archive
function enhanceDatabase() {
  db.serialize(() => {
    // Tournament details table
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
        deputy_arbiters TEXT,
        website TEXT,
        regulations_url TEXT,
        pgn_source TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, start_date, location)
      )
    `);

    // Tournament results/standings
    db.run(`
      CREATE TABLE IF NOT EXISTS tournament_standings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id INTEGER,
        rank INTEGER,
        starting_rank INTEGER,
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
        rating_change INTEGER,
        prize_money REAL,
        tb1 REAL, -- Buchholz
        tb2 REAL, -- Buchholz Cut 1
        tb3 REAL, -- Sonneborn-Berger
        tb4 REAL, -- Direct Encounter
        tb5 REAL, -- Number of wins
        FOREIGN KEY (tournament_id) REFERENCES tournament_archive(id)
      )
    `);

    // Game archive with extended info
    db.run(`
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
        fen_final TEXT,
        date_played DATE,
        time_control TEXT,
        FOREIGN KEY (tournament_id) REFERENCES tournament_archive(id)
      )
    `);

    // Player cross-reference table
    db.run(`
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
        last_game_date DATE,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tournament categories and series
    db.run(`
      CREATE TABLE IF NOT EXISTS tournament_series (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        series_name TEXT UNIQUE NOT NULL,
        description TEXT,
        recurring BOOLEAN DEFAULT 0,
        frequency TEXT,
        prestige_level INTEGER
      )
    `);

    // Link tournaments to series
    db.run(`
      CREATE TABLE IF NOT EXISTS tournament_series_link (
        tournament_id INTEGER,
        series_id INTEGER,
        edition_number INTEGER,
        edition_year INTEGER,
        FOREIGN KEY (tournament_id) REFERENCES tournament_archive(id),
        FOREIGN KEY (series_id) REFERENCES tournament_series(id),
        PRIMARY KEY (tournament_id, series_id)
      )
    `);

    // Create indexes for performance
    db.run('CREATE INDEX IF NOT EXISTS idx_tournament_dates ON tournament_archive(start_date, end_date)');
    db.run('CREATE INDEX IF NOT EXISTS idx_tournament_location ON tournament_archive(location, country)');
    db.run('CREATE INDEX IF NOT EXISTS idx_tournament_name ON tournament_archive(name)');
    db.run('CREATE INDEX IF NOT EXISTS idx_standings_tournament ON tournament_standings(tournament_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_standings_player ON tournament_standings(player_name)');
    db.run('CREATE INDEX IF NOT EXISTS idx_game_tournament ON game_archive(tournament_id, round)');
    db.run('CREATE INDEX IF NOT EXISTS idx_game_players ON game_archive(white_player, black_player)');
    db.run('CREATE INDEX IF NOT EXISTS idx_player_fide ON player_index(fide_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_player_name ON player_index(name)');

    console.log('Database schema enhanced for tournament archive');
  });
}

// API ENDPOINTS

// Get tournament statistics
app.get('/api/archive/statistics', (req, res) => {
  const stats = {};
  
  db.serialize(() => {
    db.get('SELECT COUNT(*) as total FROM tournaments', (err, row) => {
      stats.totalTournaments = row?.total || 0;
      
      db.get('SELECT COUNT(*) as total FROM games', (err, row) => {
        stats.totalGames = row?.total || 0;
        
        db.get('SELECT COUNT(*) as total FROM players', (err, row) => {
          stats.totalPlayers = row?.total || 0;
          
          db.get('SELECT COUNT(DISTINCT country) as countries FROM tournaments', (err, row) => {
            stats.countries = row?.countries || 0;
            
            db.get(`SELECT 
              MIN(date) as earliest,
              MAX(date) as latest
              FROM tournaments`, (err, row) => {
              stats.dateRange = {
                earliest: row?.earliest,
                latest: row?.latest
              };
              
              res.json(stats);
            });
          });
        });
      });
    });
  });
});

// Search tournaments with advanced filtering
app.get('/api/archive/tournaments/search', (req, res) => {
  const {
    q,           // search query
    location,
    country,
    federation,
    year,
    month,
    category,
    minRating,
    maxRating,
    minPlayers,
    timeControl,
    series,
    sortBy = 'start_date',
    order = 'DESC',
    limit = 100,
    offset = 0
  } = req.query;

  let query = `
    SELECT 
      ta.*,
      ts.series_name,
      (SELECT COUNT(*) FROM tournament_standings WHERE tournament_id = ta.id) as players_count,
      (SELECT COUNT(*) FROM game_archive WHERE tournament_id = ta.id) as games_count
    FROM tournament_archive ta
    LEFT JOIN tournament_series_link tsl ON ta.id = tsl.tournament_id
    LEFT JOIN tournament_series ts ON tsl.series_id = ts.id
    WHERE 1=1
  `;
  const params = [];

  if (q) {
    query += ' AND (ta.name LIKE ? OR ta.location LIKE ? OR ta.organizer LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (location) {
    query += ' AND ta.location LIKE ?';
    params.push(`%${location}%`);
  }

  if (country) {
    query += ' AND ta.country = ?';
    params.push(country);
  }

  if (federation) {
    query += ' AND ta.federation = ?';
    params.push(federation);
  }

  if (year) {
    query += ' AND strftime("%Y", ta.start_date) = ?';
    params.push(year.toString());
  }

  if (month) {
    query += ' AND strftime("%m", ta.start_date) = ?';
    params.push(month.toString().padStart(2, '0'));
  }

  if (category) {
    query += ' AND ta.category = ?';
    params.push(category);
  }

  if (minRating) {
    query += ' AND ta.average_rating >= ?';
    params.push(parseInt(minRating));
  }

  if (maxRating) {
    query += ' AND ta.average_rating <= ?';
    params.push(parseInt(maxRating));
  }

  if (minPlayers) {
    query += ' AND ta.number_of_players >= ?';
    params.push(parseInt(minPlayers));
  }

  if (timeControl) {
    query += ' AND ta.time_control LIKE ?';
    params.push(`%${timeControl}%`);
  }

  if (series) {
    query += ' AND ts.series_name LIKE ?';
    params.push(`%${series}%`);
  }

  // Validate sort column
  const validSortColumns = ['start_date', 'name', 'location', 'average_rating', 'number_of_players'];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'start_date';
  
  query += ` ORDER BY ta.${sortColumn} ${order === 'ASC' ? 'ASC' : 'DESC'}`;
  query += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      // Get total count for pagination
      let countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
      countQuery = countQuery.replace(/ORDER BY.*$/, '');
      countQuery = countQuery.replace(/LIMIT.*$/, '');
      
      db.get(countQuery, params.slice(0, -2), (err, countRow) => {
        res.json({
          tournaments: rows,
          total: countRow?.total || 0,
          limit: parseInt(limit),
          offset: parseInt(offset)
        });
      });
    }
  });
});

// Get tournament details with full information
app.get('/api/archive/tournaments/:id', (req, res) => {
  const { id } = req.params;

  db.get(`
    SELECT ta.*, ts.series_name, ts.description as series_description
    FROM tournament_archive ta
    LEFT JOIN tournament_series_link tsl ON ta.id = tsl.tournament_id
    LEFT JOIN tournament_series ts ON tsl.series_id = ts.id
    WHERE ta.id = ?
  `, [id], (err, tournament) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!tournament) {
      res.status(404).json({ error: 'Tournament not found' });
    } else {
      // Get additional statistics
      db.get(`
        SELECT 
          COUNT(DISTINCT CASE WHEN result = '1-0' THEN id END) as white_wins,
          COUNT(DISTINCT CASE WHEN result = '0-1' THEN id END) as black_wins,
          COUNT(DISTINCT CASE WHEN result = '1/2-1/2' THEN id END) as draws,
          AVG(ply_count) as avg_ply_count,
          COUNT(DISTINCT eco) as unique_openings
        FROM game_archive
        WHERE tournament_id = ?
      `, [id], (err, stats) => {
        tournament.statistics = stats;
        res.json(tournament);
      });
    }
  });
});

// Get tournament standings/crosstable
app.get('/api/archive/tournaments/:id/standings', (req, res) => {
  const { id } = req.params;

  db.all(`
    SELECT * FROM tournament_standings
    WHERE tournament_id = ?
    ORDER BY rank
  `, [id], (err, standings) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(standings);
    }
  });
});

// Get tournament games
app.get('/api/archive/tournaments/:id/games', (req, res) => {
  const { id } = req.params;
  const { round, player, eco, result } = req.query;

  let query = 'SELECT * FROM game_archive WHERE tournament_id = ?';
  const params = [id];

  if (round) {
    query += ' AND round = ?';
    params.push(parseInt(round));
  }

  if (player) {
    query += ' AND (white_player LIKE ? OR black_player LIKE ?)';
    params.push(`%${player}%`, `%${player}%`);
  }

  if (eco) {
    query += ' AND eco = ?';
    params.push(eco);
  }

  if (result) {
    query += ' AND result = ?';
    params.push(result);
  }

  query += ' ORDER BY round, board';

  db.all(query, params, (err, games) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(games);
    }
  });
});

// Get player search and information
app.get('/api/archive/players/search', (req, res) => {
  const { q, federation, title, minRating, hasGames } = req.query;

  let query = 'SELECT * FROM player_index WHERE 1=1';
  const params = [];

  if (q) {
    query += ' AND name LIKE ?';
    params.push(`%${q}%`);
  }

  if (federation) {
    query += ' AND federation = ?';
    params.push(federation);
  }

  if (title) {
    query += ' AND title = ?';
    params.push(title);
  }

  if (minRating) {
    query += ' AND peak_rating >= ?';
    params.push(parseInt(minRating));
  }

  if (hasGames === 'true') {
    query += ' AND total_games > 0';
  }

  query += ' ORDER BY peak_rating DESC LIMIT 100';

  db.all(query, params, (err, players) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(players);
    }
  });
});

// Get player tournament history
app.get('/api/archive/players/:id/tournaments', (req, res) => {
  const { id } = req.params;

  // First get player info
  db.get('SELECT * FROM player_index WHERE id = ? OR fide_id = ?', [id, id], (err, player) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!player) {
      res.status(404).json({ error: 'Player not found' });
    } else {
      // Get tournament participations
      db.all(`
        SELECT 
          ta.*,
          ts.rank,
          ts.points,
          ts.games_played,
          ts.performance_rating,
          ts.rating_change
        FROM tournament_standings ts
        JOIN tournament_archive ta ON ts.tournament_id = ta.id
        WHERE ts.player_name LIKE ? OR ts.player_fide_id = ?
        ORDER BY ta.start_date DESC
      `, [`%${player.name}%`, player.fide_id], (err, tournaments) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          res.json({
            player,
            tournaments
          });
        }
      });
    }
  });
});

// Get player games
app.get('/api/archive/players/:id/games', (req, res) => {
  const { id } = req.params;
  const { opponent, eco, result, year, limit = 100 } = req.query;

  // Get player name first
  db.get('SELECT name, fide_id FROM player_index WHERE id = ? OR fide_id = ?', [id, id], (err, player) => {
    if (err || !player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    let query = `
      SELECT ga.*, ta.name as tournament_name, ta.location, ta.start_date
      FROM game_archive ga
      JOIN tournament_archive ta ON ga.tournament_id = ta.id
      WHERE (ga.white_player LIKE ? OR ga.black_player LIKE ?)
    `;
    const params = [`%${player.name}%`, `%${player.name}%`];

    if (opponent) {
      query += ' AND (ga.white_player LIKE ? OR ga.black_player LIKE ?)';
      params.push(`%${opponent}%`, `%${opponent}%`);
    }

    if (eco) {
      query += ' AND ga.eco = ?';
      params.push(eco);
    }

    if (result) {
      query += ' AND ga.result = ?';
      params.push(result);
    }

    if (year) {
      query += ' AND strftime("%Y", ga.date_played) = ?';
      params.push(year.toString());
    }

    query += ' ORDER BY ga.date_played DESC LIMIT ?';
    params.push(parseInt(limit));

    db.all(query, params, (err, games) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({
          player,
          games
        });
      }
    });
  });
});

// Get opening statistics across all tournaments
app.get('/api/archive/openings/statistics', (req, res) => {
  const { eco, minGames = 10 } = req.query;

  let query = `
    SELECT 
      eco,
      opening,
      variation,
      COUNT(*) as games,
      SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) as white_wins,
      SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) as black_wins,
      SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
      AVG(ply_count) as avg_length,
      AVG(white_rating) as avg_white_rating,
      AVG(black_rating) as avg_black_rating
    FROM game_archive
    WHERE eco IS NOT NULL
  `;

  if (eco) {
    query += ' AND eco = ?';
  }

  query += `
    GROUP BY eco, opening, variation
    HAVING games >= ?
    ORDER BY games DESC
  `;

  const params = eco ? [eco, parseInt(minGames)] : [parseInt(minGames)];

  db.all(query, params, (err, openings) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      // Calculate percentages
      openings.forEach(opening => {
        const total = opening.games;
        opening.white_win_rate = ((opening.white_wins / total) * 100).toFixed(1);
        opening.draw_rate = ((opening.draws / total) * 100).toFixed(1);
        opening.black_win_rate = ((opening.black_wins / total) * 100).toFixed(1);
      });
      res.json(openings);
    }
  });
});

// Get game by ID with full PGN
app.get('/api/archive/games/:id', (req, res) => {
  const { id } = req.params;

  db.get(`
    SELECT ga.*, ta.name as tournament_name, ta.location
    FROM game_archive ga
    JOIN tournament_archive ta ON ga.tournament_id = ta.id
    WHERE ga.id = ?
  `, [id], (err, game) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!game) {
      res.status(404).json({ error: 'Game not found' });
    } else {
      res.json(game);
    }
  });
});

// Export tournament data in various formats
app.get('/api/archive/tournaments/:id/export', (req, res) => {
  const { id } = req.params;
  const { format = 'json' } = req.query;

  db.get('SELECT * FROM tournament_archive WHERE id = ?', [id], (err, tournament) => {
    if (err || !tournament) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }

    if (format === 'pgn') {
      // Export as PGN
      db.all('SELECT * FROM game_archive WHERE tournament_id = ? ORDER BY round, board', [id], (err, games) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          let pgn = '';
          games.forEach(game => {
            pgn += `[Event "${tournament.name}"]\n`;
            pgn += `[Site "${tournament.location}"]\n`;
            pgn += `[Date "${game.date_played || '????.??.??'}"]\n`;
            pgn += `[Round "${game.round}"]\n`;
            pgn += `[White "${game.white_player}"]\n`;
            pgn += `[Black "${game.black_player}"]\n`;
            pgn += `[Result "${game.result}"]\n`;
            if (game.eco) pgn += `[ECO "${game.eco}"]\n`;
            if (game.white_rating) pgn += `[WhiteElo "${game.white_rating}"]\n`;
            if (game.black_rating) pgn += `[BlackElo "${game.black_rating}"]\n`;
            pgn += '\n';
            pgn += game.pgn || '*';
            pgn += '\n\n';
          });

          res.setHeader('Content-Type', 'application/x-chess-pgn');
          res.setHeader('Content-Disposition', `attachment; filename="${tournament.name.replace(/[^a-z0-9]/gi, '_')}.pgn"`);
          res.send(pgn);
        }
      });
    } else if (format === 'csv') {
      // Export standings as CSV
      db.all('SELECT * FROM tournament_standings WHERE tournament_id = ? ORDER BY rank', [id], (err, standings) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          let csv = 'Rank,Name,Title,Federation,Rating,Points,Games,W/D/L,Performance,Rating Change\n';
          standings.forEach(row => {
            csv += `${row.rank},${row.player_name},${row.player_title || ''},${row.player_federation || ''},`;
            csv += `${row.player_rating || ''},${row.points},${row.games_played},`;
            csv += `${row.wins}/${row.draws}/${row.losses},${row.performance_rating || ''},${row.rating_change || ''}\n`;
          });

          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${tournament.name.replace(/[^a-z0-9]/gi, '_')}_standings.csv"`);
          res.send(csv);
        }
      });
    } else {
      // Default JSON export
      db.all('SELECT * FROM tournament_standings WHERE tournament_id = ? ORDER BY rank', [id], (err, standings) => {
        db.all('SELECT * FROM game_archive WHERE tournament_id = ? ORDER BY round, board', [id], (err2, games) => {
          res.json({
            tournament,
            standings: standings || [],
            games: games || []
          });
        });
      });
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Tournament Archive API',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Tournament Archive API running on port ${PORT}`);
  console.log('Access API at http://localhost:' + PORT);
});