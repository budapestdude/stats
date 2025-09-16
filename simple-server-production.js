const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const { getInstance: getDatabase } = require('./services/database-fixed');

const app = express();
const PORT = process.env.PORT || 3007;
const CHESS_COM_API = 'https://api.chess.com/pub';
const LICHESS_API = 'https://lichess.org/api';

// Proper User-Agent header as required by Chess.com API terms
const USER_AGENT = 'Chess-Stats-Website/1.0 (contact: chessstats@example.com; purpose: educational)';

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // In production, replace with specific allowed origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3007'];
    
    if (!origin || allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// Initialize database connection
let db = null;
(async () => {
  try {
    db = await getDatabase();
    console.log('Database service initialized');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
})();

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected'
  };
  
  if (db) {
    try {
      const gameCount = await db.getGameCount();
      health.totalGames = gameCount;
    } catch (error) {
      health.database = 'error';
    }
  }
  
  res.json(health);
});

// API test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!',
    database: db ? 'connected' : 'disconnected'
  });
});

// Statistics Overview - REAL DATA
app.get('/api/stats/overview', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const stats = await db.getDatabaseStats();
    
    res.json({
      totalGames: stats.total_games,
      totalTournaments: stats.total_tournaments,
      totalPlayers: stats.approx_players,
      averageRating: Math.round(stats.avg_rating || 1500),
      earliestGame: stats.earliest_game,
      latestGame: stats.latest_game,
      // These would come from a cache or real-time system in production
      activePlayers24h: 0,
      gamesPlayed24h: 0,
      source: 'OTB Tournament Database'
    });
  } catch (error) {
    next(error);
  }
});

// Rating Distribution - REAL DATA
app.get('/api/stats/rating-distribution', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const distribution = await db.getRatingDistribution();
    res.json({ distribution });
  } catch (error) {
    next(error);
  }
});

// Search Games - REAL DATA
app.get('/api/games/search', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const filters = {
      player: req.query.player,
      event: req.query.event,
      opening: req.query.opening,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      minRating: req.query.minRating,
      page: req.query.page || 1,
      limit: Math.min(req.query.limit || 50, 100)
    };
    
    const result = await db.searchGames(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get Game by ID - REAL DATA
app.get('/api/games/:id', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const game = await db.getGameById(req.params.id);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json(game);
  } catch (error) {
    next(error);
  }
});

// Search Players - REAL DATA
app.get('/api/players/search', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const query = req.query.q || req.query.query || '';
    const limit = Math.min(req.query.limit || 50, 100);
    
    if (query.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }
    
    const players = await db.searchPlayers(query, limit);
    res.json({ players });
  } catch (error) {
    next(error);
  }
});

// Get Top Players - REAL DATA
app.get('/api/players/top', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const limit = Math.min(req.query.limit || 100, 200);
    const players = await db.getTopPlayers(limit);
    
    res.json({ players });
  } catch (error) {
    next(error);
  }
});

// Get Player Stats - REAL DATA from database + Chess.com API
app.get('/api/players/:username', async (req, res, next) => {
  try {
    const username = req.params.username;
    const source = req.query.source || 'auto'; // 'database', 'chesscom', 'lichess', 'auto'
    
    let playerData = null;
    
    // Try database first if available
    if (db && (source === 'database' || source === 'auto')) {
      const stats = await db.getPlayerStats(username);
      
      if (stats && stats.total_games > 0) {
        playerData = {
          username,
          stats: {
            totalGames: stats.total_games,
            wins: stats.wins,
            draws: stats.draws,
            losses: stats.losses,
            winRate: ((stats.wins / stats.total_games) * 100).toFixed(1),
            avgRating: Math.round(stats.avg_rating || 0),
            peakRating: stats.peak_rating || 0,
            firstGame: stats.first_game,
            lastGame: stats.last_game
          },
          source: 'database'
        };
      }
    }
    
    // Try Chess.com API if no database data
    if (!playerData && (source === 'chesscom' || source === 'auto')) {
      try {
        const response = await axios.get(
          `${CHESS_COM_API}/player/${username}`,
          { headers: { 'User-Agent': USER_AGENT } }
        );
        
        playerData = {
          ...response.data,
          source: 'chess.com'
        };
      } catch (error) {
        // Chess.com API failed, continue to try Lichess
      }
    }
    
    // Try Lichess API if still no data
    if (!playerData && (source === 'lichess' || source === 'auto')) {
      try {
        const response = await axios.get(
          `${LICHESS_API}/user/${username}`
        );
        
        playerData = {
          username: response.data.username,
          profile: response.data.profile,
          perfs: response.data.perfs,
          source: 'lichess'
        };
      } catch (error) {
        // Lichess API also failed
      }
    }
    
    if (!playerData) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    res.json(playerData);
  } catch (error) {
    next(error);
  }
});

// Get Player Games - REAL DATA
app.get('/api/players/:username/games', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const username = req.params.username;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    
    const result = await db.getPlayerGames(username, page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get Tournaments - REAL DATA
app.get('/api/tournaments', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    
    const result = await db.getTournaments(page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get Tournament Details - REAL DATA
app.get('/api/tournaments/:id', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const eventName = decodeURIComponent(req.params.id);
    const details = await db.getTournamentDetails(eventName);
    
    if (!details) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    res.json(details);
  } catch (error) {
    next(error);
  }
});

// Get Tournament Games - REAL DATA
app.get('/api/tournaments/:id/games', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const eventName = decodeURIComponent(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    
    const result = await db.getTournamentGames(eventName, page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get Tournament Standings - REAL DATA
app.get('/api/tournaments/:id/standings', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const eventName = decodeURIComponent(req.params.id);
    const standings = await db.getTournamentStandings(eventName);
    
    res.json({ standings });
  } catch (error) {
    next(error);
  }
});

// Get Opening Statistics - REAL DATA
app.get('/api/openings', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const openings = await db.getOpeningStats();
    res.json({ openings });
  } catch (error) {
    next(error);
  }
});

// Get Popular Openings - REAL DATA
app.get('/api/openings/popular', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const openings = await db.getOpeningStats();
    
    // Calculate win rates and format response
    const formatted = openings.map(opening => ({
      name: opening.opening,
      eco: opening.eco,
      games: opening.games_count,
      whiteWinRate: ((opening.white_wins / opening.games_count) * 100).toFixed(1),
      blackWinRate: ((opening.black_wins / opening.games_count) * 100).toFixed(1),
      drawRate: ((opening.draws / opening.games_count) * 100).toFixed(1),
      avgRating: Math.round(opening.avg_rating || 0)
    }));
    
    res.json({ openings: formatted });
  } catch (error) {
    next(error);
  }
});

// Get Opening by ECO - REAL DATA
app.get('/api/openings/eco/:eco', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const opening = await db.getOpeningByEco(req.params.eco.toUpperCase());
    
    if (!opening) {
      return res.status(404).json({ error: 'Opening not found' });
    }
    
    res.json({
      ...opening,
      whiteWinRate: ((opening.white_wins / opening.games_count) * 100).toFixed(1),
      blackWinRate: ((opening.black_wins / opening.games_count) * 100).toFixed(1),
      drawRate: ((opening.draws / opening.games_count) * 100).toFixed(1)
    });
  } catch (error) {
    next(error);
  }
});

// Lichess Opening Explorer - Keep for real-time analysis
app.get('/api/openings/explorer', async (req, res, next) => {
  try {
    const { 
      fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      play = '',
      variant = 'standard',
      speeds = 'blitz,rapid,classical',
      ratings = '1600,1800,2000,2200,2500'
    } = req.query;

    const params = new URLSearchParams({
      variant,
      speeds,
      ratings,
      ...(play ? { play } : { fen })
    });

    const response = await axios.get(
      `${LICHESS_API}/masters?${params}`,
      { timeout: 5000 }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Lichess API error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch opening data',
      message: error.message 
    });
  }
});

// OTB Database endpoints - Already using real data
app.get('/api/otb/database/search', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const result = await db.searchGames(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/api/otb/database/tournaments', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const result = await db.getTournaments(
      req.query.page || 1,
      req.query.limit || 50
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/api/otb/database/players/:name/games', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const result = await db.getPlayerGames(
      req.params.name,
      req.query.page || 1,
      req.query.limit || 50
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/api/otb/database/game/:id', async (req, res, next) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    
    const game = await db.getGameById(req.params.id);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json(game);
  } catch (error) {
    next(error);
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Production server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎯 API endpoints: http://localhost:${PORT}/api`);
  console.log(`🔒 CORS enabled for: ${process.env.ALLOWED_ORIGINS || 'localhost'}`);
  console.log(`📈 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  
  if (db) {
    db.close();
  }
  
  process.exit(0);
});

module.exports = app;