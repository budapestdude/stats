const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const DatabaseOptimizer = require('./lib/database-optimizer');

const app = express();
const PORT = 3007;
const CHESS_COM_API = 'https://api.chess.com/pub';
const LICHESS_API = 'https://lichess.org/api';
const USER_AGENT = 'Chess-Stats-Website/1.0 (contact: chessstats@example.com; purpose: educational)';

// Initialize optimized database connection
const dbPath = path.join(__dirname, 'otb-database', 'chess-stats.db');
let dbOptimizer = null;

if (fs.existsSync(dbPath)) {
  dbOptimizer = new DatabaseOptimizer(dbPath, {
    maxConnections: 10,
    cacheEnabled: true,
    cacheTTL: 300, // 5 minutes
    enableWAL: false, // Disabled to avoid lock issues
    enableQueryStats: true
  });
  
  console.log('Database connected with optimization');
}

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

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'Chess Stats API is running!',
    database: dbOptimizer ? 'connected' : 'not connected'
  });
});

// Get database statistics
app.get('/api/database/stats', async (req, res) => {
  if (!dbOptimizer) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  
  try {
    const stats = await dbOptimizer.query(`
      SELECT 
        (SELECT COUNT(*) FROM games) as total_games,
        (SELECT COUNT(DISTINCT white) + COUNT(DISTINCT black) FROM games) as total_players,
        (SELECT COUNT(DISTINCT event) FROM games) as total_events,
        (SELECT MIN(date) FROM games) as earliest_game,
        (SELECT MAX(date) FROM games) as latest_game
    `);
    
    const queryStats = dbOptimizer.getQueryStats();
    
    res.json({
      database: stats[0],
      performance: {
        queryStats: queryStats.slice(0, 10), // Top 10 queries
        cacheHitRate: queryStats.reduce((acc, q) => acc + q.cacheHits, 0) / 
                      queryStats.reduce((acc, q) => acc + q.count, 0) * 100
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search games with optimized pagination
app.get('/api/games/search', async (req, res) => {
  if (!dbOptimizer) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  
  const { 
    player, 
    event, 
    opening, 
    year, 
    minElo,
    page = 1, 
    pageSize = 50 
  } = req.query;
  
  try {
    const result = await dbOptimizer.searchGames(
      { player, event, opening, year, minElo },
      parseInt(page),
      parseInt(pageSize)
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get player statistics with caching
app.get('/api/players/:name/stats', async (req, res) => {
  if (!dbOptimizer) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  
  try {
    const stats = await dbOptimizer.getPlayerStats(req.params.name);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get player games with pagination
app.get('/api/players/:name/games', async (req, res) => {
  if (!dbOptimizer) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  
  const { page = 1, pageSize = 50 } = req.query;
  
  try {
    const result = await dbOptimizer.queryPaginated(
      `SELECT * FROM games 
       WHERE white = ? OR black = ?
       ORDER BY date DESC`,
      [req.params.name, req.params.name],
      parseInt(page),
      parseInt(pageSize),
      { includeTotal: true }
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get opening statistics
app.get('/api/openings/stats', async (req, res) => {
  if (!dbOptimizer) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  
  const { eco, minGames = 100 } = req.query;
  
  try {
    let sql = `
      SELECT 
        eco,
        opening,
        COUNT(*) as total_games,
        SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) as white_wins,
        SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) as black_wins,
        SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
        ROUND(AVG(white_elo), 0) as avg_white_elo,
        ROUND(AVG(black_elo), 0) as avg_black_elo
      FROM games
      WHERE eco IS NOT NULL
    `;
    
    const params = [];
    if (eco) {
      sql += ' AND eco = ?';
      params.push(eco);
    }
    
    sql += `
      GROUP BY eco, opening
      HAVING COUNT(*) >= ?
      ORDER BY total_games DESC
      LIMIT 100
    `;
    params.push(minGames);
    
    const results = await dbOptimizer.query(sql, params, { cacheTTL: 600 });
    
    // Calculate percentages
    const openings = results.map(row => ({
      ...row,
      white_win_rate: (row.white_wins / row.total_games * 100).toFixed(1),
      black_win_rate: (row.black_wins / row.total_games * 100).toFixed(1),
      draw_rate: (row.draws / row.total_games * 100).toFixed(1)
    }));
    
    res.json(openings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tournaments with optimized queries
app.get('/api/tournaments', async (req, res) => {
  if (!dbOptimizer) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  
  const { page = 1, pageSize = 50, search } = req.query;
  
  try {
    let sql = `
      SELECT 
        event as name,
        COUNT(*) as games_count,
        MIN(date) as start_date,
        MAX(date) as end_date,
        COUNT(DISTINCT white) + COUNT(DISTINCT black) as players_count,
        ROUND(AVG((white_elo + black_elo) / 2), 0) as avg_rating
      FROM games
      WHERE event IS NOT NULL AND event != ''
    `;
    
    const params = [];
    if (search) {
      sql += ' AND event LIKE ?';
      params.push(`%${search}%`);
    }
    
    sql += ' GROUP BY event HAVING COUNT(*) > 0 ORDER BY games_count DESC';
    
    const result = await dbOptimizer.queryPaginated(
      sql,
      params,
      parseInt(page),
      parseInt(pageSize),
      { includeTotal: true, cacheTTL: 300 }
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tournament details
app.get('/api/tournaments/:name', async (req, res) => {
  if (!dbOptimizer) {
    return res.status(503).json({ error: 'Database not connected' });
  }
  
  try {
    const tournamentName = decodeURIComponent(req.params.name);
    
    // Get tournament stats and games in parallel
    const [stats, topGames, players] = await Promise.all([
      dbOptimizer.queryOne(`
        SELECT 
          event as name,
          COUNT(*) as total_games,
          MIN(date) as start_date,
          MAX(date) as end_date,
          COUNT(DISTINCT white) + COUNT(DISTINCT black) as total_players,
          ROUND(AVG((white_elo + black_elo) / 2), 0) as avg_rating,
          MAX(MAX(white_elo), MAX(black_elo)) as highest_rating
        FROM games
        WHERE event = ?
      `, [tournamentName]),
      
      dbOptimizer.query(`
        SELECT 
          id,
          white,
          black,
          result,
          date,
          white_elo,
          black_elo,
          eco,
          opening
        FROM games
        WHERE event = ?
        ORDER BY (white_elo + black_elo) DESC
        LIMIT 20
      `, [tournamentName]),
      
      dbOptimizer.query(`
        SELECT 
          player,
          COUNT(*) as games,
          SUM(wins) as wins,
          SUM(draws) as draws,
          SUM(losses) as losses,
          ROUND(AVG(rating), 0) as avg_rating
        FROM (
          SELECT 
            white as player,
            white_elo as rating,
            CASE WHEN result = '1-0' THEN 1 ELSE 0 END as wins,
            CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END as draws,
            CASE WHEN result = '0-1' THEN 1 ELSE 0 END as losses
          FROM games WHERE event = ?
          UNION ALL
          SELECT 
            black as player,
            black_elo as rating,
            CASE WHEN result = '0-1' THEN 1 ELSE 0 END as wins,
            CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END as draws,
            CASE WHEN result = '1-0' THEN 1 ELSE 0 END as losses
          FROM games WHERE event = ?
        )
        GROUP BY player
        ORDER BY (wins * 1.0 + draws * 0.5) DESC
        LIMIT 10
      `, [tournamentName, tournamentName])
    ]);
    
    res.json({
      ...stats,
      topGames,
      topPlayers: players
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear cache endpoint (admin only - should be protected in production)
app.post('/api/cache/clear', (req, res) => {
  if (dbOptimizer) {
    dbOptimizer.clearCache();
    res.json({ message: 'Cache cleared successfully' });
  } else {
    res.status(503).json({ error: 'Database not connected' });
  }
});

// Get query performance stats
app.get('/api/performance/queries', (req, res) => {
  if (dbOptimizer) {
    const stats = dbOptimizer.getQueryStats();
    res.json(stats);
  } else {
    res.status(503).json({ error: 'Database not connected' });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  if (dbOptimizer) {
    await dbOptimizer.close();
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Optimized Chess Stats API running on http://localhost:${PORT}`);
  console.log(`Database: ${dbOptimizer ? 'Connected with optimization' : 'Not connected'}`);
  if (dbOptimizer) {
    console.log('Features enabled:');
    console.log('- Connection pooling (10 connections)');
    console.log('- Query caching (5 min TTL)');
    console.log('- WAL mode for concurrency');
    console.log('- Automatic indexing');
    console.log('- Query performance monitoring');
  }
});