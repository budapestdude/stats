const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening production database:', err);
    process.exit(1);
  } else {
    console.log('✅ Connected to production chess database');
    console.log('Database location:', dbPath);
  }
});

// Get archive statistics
app.get('/api/archive/statistics', (req, res) => {
  const stats = {};
  
  db.serialize(() => {
    db.get('SELECT COUNT(*) as total FROM tournaments', (err, row) => {
      if (err) console.error('Error counting tournaments:', err);
      stats.totalTournaments = row?.total || 0;
      
      db.get('SELECT COUNT(*) as total FROM games', (err, row) => {
        if (err) console.error('Error counting games:', err);
        stats.totalGames = row?.total || 0;
        
        db.get('SELECT COUNT(*) as total FROM players', (err, row) => {
          if (err) console.error('Error counting players:', err);
          stats.totalPlayers = row?.total || 0;
          
          db.get('SELECT COUNT(DISTINCT country) as countries FROM tournaments WHERE country IS NOT NULL', (err, row) => {
            if (err) console.error('Error counting countries:', err);
            stats.countries = row?.countries || 0;
            
            db.get(`SELECT 
              MIN(start_date) as earliest,
              MAX(end_date) as latest
              FROM tournaments
              WHERE start_date IS NOT NULL`, (err, row) => {
              if (err) console.error('Error getting date range:', err);
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

// Search tournaments with basic filtering
app.get('/api/archive/tournaments/search', (req, res) => {
  const {
    q,           // search query
    location,
    country,
    year,
    category,
    minPlayers,
    sortBy = 'start_date',
    order = 'DESC',
    limit = 100,
    offset = 0
  } = req.query;

  let query = `
    SELECT 
      id,
      name,
      location,
      country,
      start_date,
      end_date,
      category,
      time_control,
      rounds,
      players_count,
      games_count,
      average_rating
    FROM tournaments
    WHERE 1=1
  `;
  const params = [];

  if (q) {
    query += ' AND (name LIKE ? OR location LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  if (location) {
    query += ' AND location LIKE ?';
    params.push(`%${location}%`);
  }

  if (country) {
    query += ' AND country = ?';
    params.push(country);
  }

  if (year) {
    query += ' AND strftime("%Y", start_date) = ?';
    params.push(year.toString());
  }

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  if (minPlayers) {
    query += ' AND players_count >= ?';
    params.push(parseInt(minPlayers));
  }

  // Validate sort column
  const validSortColumns = ['start_date', 'name', 'location', 'average_rating', 'players_count'];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'start_date';
  
  query += ` ORDER BY ${sortColumn} ${order === 'ASC' ? 'ASC' : 'DESC'}`;
  query += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Tournament search error:', err);
      res.status(500).json({ error: err.message });
    } else {
      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total FROM tournaments WHERE 1=1
      `;
      const countParams = [];
      let paramIndex = 0;

      if (q) {
        countQuery += ' AND (name LIKE ? OR location LIKE ?)';
        countParams.push(params[paramIndex++], params[paramIndex++]);
      }
      if (location) {
        countQuery += ' AND location LIKE ?';
        countParams.push(params[paramIndex++]);
      }
      if (country) {
        countQuery += ' AND country = ?';
        countParams.push(params[paramIndex++]);
      }
      if (year) {
        countQuery += ' AND strftime("%Y", start_date) = ?';
        countParams.push(params[paramIndex++]);
      }
      if (category) {
        countQuery += ' AND category = ?';
        countParams.push(params[paramIndex++]);
      }
      if (minPlayers) {
        countQuery += ' AND players_count >= ?';
        countParams.push(params[paramIndex++]);
      }
      
      db.get(countQuery, countParams, (err, countRow) => {
        if (err) console.error('Count query error:', err);
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

// Get tournament details
app.get('/api/archive/tournaments/:id', (req, res) => {
  const { id } = req.params;

  db.get(`
    SELECT * FROM tournaments WHERE id = ?
  `, [id], (err, tournament) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!tournament) {
      res.status(404).json({ error: 'Tournament not found' });
    } else {
      // Get additional game statistics
      db.get(`
        SELECT 
          COUNT(*) as total_games,
          COUNT(DISTINCT CASE WHEN result = '1-0' THEN id END) as white_wins,
          COUNT(DISTINCT CASE WHEN result = '0-1' THEN id END) as black_wins,
          COUNT(DISTINCT CASE WHEN result = '1/2-1/2' THEN id END) as draws,
          AVG(ply_count) as avg_ply_count,
          COUNT(DISTINCT eco) as unique_openings
        FROM games
        WHERE tournament_id = ?
      `, [id], (err, stats) => {
        if (err) console.error('Tournament stats error:', err);
        tournament.statistics = stats || {};
        res.json(tournament);
      });
    }
  });
});

// Get tournament games with player names
app.get('/api/archive/tournaments/:id/games', (req, res) => {
  const { id } = req.params;
  const { round, eco, result, limit = 100 } = req.query;

  let query = `
    SELECT 
      g.id,
      g.round_num,
      g.board_num,
      pw.name as white_player,
      pb.name as black_player,
      g.white_rating,
      g.black_rating,
      g.result,
      g.eco,
      o.name as opening_name,
      g.ply_count,
      g.date_played
    FROM games g
    LEFT JOIN players pw ON g.white_player_id = pw.id
    LEFT JOIN players pb ON g.black_player_id = pb.id
    LEFT JOIN openings o ON g.opening_id = o.id
    WHERE g.tournament_id = ?
  `;
  const params = [id];

  if (round) {
    query += ' AND g.round_num = ?';
    params.push(parseInt(round));
  }

  if (eco) {
    query += ' AND g.eco = ?';
    params.push(eco);
  }

  if (result) {
    query += ' AND g.result = ?';
    params.push(result);
  }

  query += ' ORDER BY g.round_num, g.board_num LIMIT ?';
  params.push(parseInt(limit));

  db.all(query, params, (err, games) => {
    if (err) {
      console.error('Tournament games error:', err);
      res.status(500).json({ error: err.message });
    } else {
      res.json(games);
    }
  });
});

// Search players
app.get('/api/archive/players/search', (req, res) => {
  const { q, federation, title, minRating, limit = 100 } = req.query;

  let query = `
    SELECT 
      id,
      name,
      title,
      federation,
      peak_rating,
      total_games,
      tournaments_count,
      first_game_date,
      last_game_date
    FROM players 
    WHERE 1=1
  `;
  const params = [];

  if (q) {
    query += ' AND (name LIKE ? OR name_normalized LIKE ?)';
    params.push(`%${q}%`, `%${q.toLowerCase()}%`);
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

  query += ' ORDER BY peak_rating DESC LIMIT ?';
  params.push(parseInt(limit));

  db.all(query, params, (err, players) => {
    if (err) {
      console.error('Player search error:', err);
      res.status(500).json({ error: err.message });
    } else {
      res.json(players);
    }
  });
});

// Get player details with tournament history
app.get('/api/archive/players/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM players WHERE id = ?', [id], (err, player) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!player) {
      res.status(404).json({ error: 'Player not found' });
    } else {
      // Get recent games sample
      db.all(`
        SELECT 
          g.id,
          t.name as tournament_name,
          t.location,
          t.start_date,
          pw.name as white_player,
          pb.name as black_player,
          g.result,
          g.eco,
          o.name as opening_name
        FROM games g
        JOIN tournaments t ON g.tournament_id = t.id
        LEFT JOIN players pw ON g.white_player_id = pw.id
        LEFT JOIN players pb ON g.black_player_id = pb.id
        LEFT JOIN openings o ON g.opening_id = o.id
        WHERE g.white_player_id = ? OR g.black_player_id = ?
        ORDER BY g.date_played DESC
        LIMIT 20
      `, [id, id], (err, recentGames) => {
        if (err) console.error('Recent games error:', err);
        
        res.json({
          player,
          recentGames: recentGames || []
        });
      });
    }
  });
});

// Get opening statistics
app.get('/api/archive/openings/statistics', (req, res) => {
  const { eco, limit = 50 } = req.query;

  let query = `
    SELECT 
      o.eco,
      o.name,
      o.variation,
      COUNT(g.id) as games,
      SUM(CASE WHEN g.result = '1-0' THEN 1 ELSE 0 END) as white_wins,
      SUM(CASE WHEN g.result = '0-1' THEN 1 ELSE 0 END) as black_wins,
      SUM(CASE WHEN g.result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
      AVG(g.ply_count) as avg_length,
      AVG(g.white_rating) as avg_white_rating,
      AVG(g.black_rating) as avg_black_rating
    FROM openings o
    LEFT JOIN games g ON o.id = g.opening_id
    WHERE g.id IS NOT NULL
  `;

  if (eco) {
    query += ' AND o.eco = ?';
  }

  query += `
    GROUP BY o.id, o.eco, o.name, o.variation
    HAVING games >= 10
    ORDER BY games DESC
    LIMIT ?
  `;

  const params = eco ? [eco, parseInt(limit)] : [parseInt(limit)];

  db.all(query, params, (err, openings) => {
    if (err) {
      console.error('Opening statistics error:', err);
      res.status(500).json({ error: err.message });
    } else {
      // Calculate percentages
      openings.forEach(opening => {
        const total = opening.games;
        if (total > 0) {
          opening.white_win_rate = ((opening.white_wins / total) * 100).toFixed(1);
          opening.draw_rate = ((opening.draws / total) * 100).toFixed(1);
          opening.black_win_rate = ((opening.black_wins / total) * 100).toFixed(1);
        }
      });
      res.json(openings);
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Production Chess Archive API',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Production Chess Archive API running on port ${PORT}`);
  console.log(`📊 Access API at http://localhost:${PORT}`);
  console.log(`💾 Database: ${dbPath}`);
});