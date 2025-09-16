const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
require('dotenv').config();

// Import middleware
const { cacheMiddleware, getStats: getCacheStats, invalidatePattern, warmupCache } = require('./src/middleware/cache');
const { 
  rateLimiters, 
  rateLimitInfo, 
  queueApiRequest, 
  getStats: getRateLimitStats,
  ipThrottle 
} = require('./src/middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3007;
const CHESS_COM_API = 'https://api.chess.com/pub';
const LICHESS_API = 'https://lichess.org/api';

// Proper User-Agent header as required by Chess.com API terms
const USER_AGENT = 'Chess-Stats-Website/1.0 (contact: chessstats@example.com; purpose: educational)';

// Middleware setup
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

// Apply IP throttling to all routes
app.use(ipThrottle({ maxRequestsPerSecond: 20 }));

// Apply general rate limiting
app.use('/api', rateLimiters.general);
app.use('/api/search', rateLimiters.search);
app.use('/api/export', rateLimiters.export);

// Add rate limit info to all responses
app.use(rateLimitInfo);

// Apply caching to API routes
app.use('/api', cacheMiddleware({
  excludePaths: ['/health', '/api/test', '/api/cache/stats']
}));

// Connect to SQLite database if it exists
let db = null;
const dbPath = path.join(__dirname, 'otb-database', 'chess-stats.db');
if (fs.existsSync(dbPath)) {
  db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Error opening database:', err);
    } else {
      console.log('✅ Connected to SQLite database');
    }
  });
}

// Health endpoint (no caching)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'Chess Stats API is running with caching!',
    cache: getCacheStats().available ? 'enabled' : 'disabled',
    rateLimit: 'enabled'
  });
});

// Cache statistics endpoint
app.get('/api/cache/stats', (req, res) => {
  const cacheStats = getCacheStats();
  const rateLimitStats = getRateLimitStats();
  
  res.json({
    cache: {
      ...cacheStats,
      hitRateFormatted: `${cacheStats.hitRate}%`,
      uptimeFormatted: `${Math.floor(cacheStats.uptime / 60)} minutes`
    },
    rateLimit: {
      ...rateLimitStats,
      blockRate: rateLimitStats.passed > 0 
        ? `${(rateLimitStats.blocked / (rateLimitStats.blocked + rateLimitStats.passed) * 100).toFixed(2)}%`
        : '0%'
    }
  });
});

// Cache management endpoints
app.post('/api/cache/invalidate', async (req, res) => {
  const { pattern } = req.body;
  
  if (!pattern) {
    return res.status(400).json({ error: 'Pattern required' });
  }
  
  const deleted = await invalidatePattern(pattern);
  res.json({ deleted, pattern });
});

app.post('/api/cache/warmup', async (req, res) => {
  const { urls = [] } = req.body;
  
  // Run warmup in background
  warmupCache(urls).then(results => {
    console.log('Cache warmup complete:', results);
  });
  
  res.json({ message: 'Cache warmup started', urlCount: urls.length });
});

// Chess.com API proxy with caching and rate limiting
app.get('/api/players/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Queue the request to respect Chess.com rate limits
    const data = await queueApiRequest('chesscom', async () => {
      const response = await axios.get(`${CHESS_COM_API}/player/${username}`, {
        headers: { 'User-Agent': USER_AGENT }
      });
      return response.data;
    });
    
    res.json(data);
  } catch (error) {
    console.error('Chess.com API error:', error.message);
    
    if (error.response?.status === 429) {
      res.status(429).json({ 
        error: 'Chess.com rate limit exceeded',
        retryAfter: error.response.headers['retry-after'] || 60
      });
    } else if (error.response?.status === 404) {
      res.status(404).json({ error: 'Player not found' });
    } else {
      res.status(500).json({ error: 'Failed to fetch player data' });
    }
  }
});

app.get('/api/players/:username/stats', async (req, res) => {
  try {
    const { username } = req.params;
    
    const data = await queueApiRequest('chesscom', async () => {
      const response = await axios.get(`${CHESS_COM_API}/player/${username}/stats`, {
        headers: { 'User-Agent': USER_AGENT }
      });
      return response.data;
    });
    
    res.json(data);
  } catch (error) {
    console.error('Chess.com stats error:', error.message);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

app.get('/api/players/:username/games', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Get archives list
    const archives = await queueApiRequest('chesscom', async () => {
      const response = await axios.get(`${CHESS_COM_API}/player/${username}/games/archives`, {
        headers: { 'User-Agent': USER_AGENT }
      });
      return response.data;
    });
    
    // Get games from most recent archive
    if (archives.archives && archives.archives.length > 0) {
      const recentArchive = archives.archives[archives.archives.length - 1];
      
      const games = await queueApiRequest('chesscom', async () => {
        const response = await axios.get(recentArchive, {
          headers: { 'User-Agent': USER_AGENT }
        });
        return response.data;
      });
      
      res.json(games);
    } else {
      res.json({ games: [] });
    }
  } catch (error) {
    console.error('Chess.com games error:', error.message);
    res.status(500).json({ error: 'Failed to fetch player games' });
  }
});

// Lichess API proxy with caching and rate limiting
app.get('/api/openings/explorer', async (req, res) => {
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
      ...(fen && { fen }),
      ...(play && { play })
    });

    const data = await queueApiRequest('lichess', async () => {
      const response = await axios.get(`${LICHESS_API}/opening/explorer?${params}`, {
        headers: { 
          'Accept': 'application/json'
        }
      });
      return response.data;
    });

    res.json(data);
  } catch (error) {
    console.error('Lichess API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch opening data' });
  }
});

app.get('/api/players/top', async (req, res) => {
  try {
    const { category = 'blitz', count = 10 } = req.query;
    
    const data = await queueApiRequest('lichess', async () => {
      const response = await axios.get(`${LICHESS_API}/player/top/${count}/${category}`, {
        headers: { 
          'Accept': 'application/json'
        }
      });
      return response.data;
    });

    res.json(data);
  } catch (error) {
    console.error('Top players error:', error.message);
    res.status(500).json({ error: 'Failed to fetch top players' });
  }
});

// Stats overview with database integration
app.get('/api/stats/overview', async (req, res) => {
  if (db) {
    try {
      const stats = await new Promise((resolve, reject) => {
        db.get(`
          SELECT 
            (SELECT COUNT(*) FROM games) as totalGames,
            (SELECT COUNT(*) FROM players) as totalPlayers,
            (SELECT COUNT(*) FROM tournaments) as totalTournaments
        `, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      res.json({
        ...stats,
        averageRating: 1500,
        activePlayers24h: Math.floor(stats.totalPlayers * 0.1),
        gamesPlayed24h: Math.floor(stats.totalGames * 0.01),
        source: 'database'
      });
      return;
    } catch (err) {
      console.error('Database error:', err);
    }
  }
  
  // Fallback to mock data
  res.json({
    totalPlayers: 2547893,
    totalGames: 100000000,
    totalTournaments: 5432,
    averageRating: 1485,
    activePlayers24h: 487291,
    gamesPlayed24h: 2847193,
    source: 'mock'
  });
});

// Rating distribution
app.get('/api/stats/rating-distribution', (req, res) => {
  res.json({
    distribution: [
      { range: '0-800', count: 45782, percentage: 1.8 },
      { range: '800-1000', count: 178293, percentage: 7.0 },
      { range: '1000-1200', count: 432871, percentage: 17.0 },
      { range: '1200-1400', count: 611234, percentage: 24.0 },
      { range: '1400-1600', count: 535789, percentage: 21.0 },
      { range: '1600-1800', count: 382947, percentage: 15.0 },
      { range: '1800-2000', count: 229384, percentage: 9.0 },
      { range: '2000-2200', count: 101893, percentage: 4.0 },
      { range: '2200-2400', count: 25478, percentage: 1.0 },
      { range: '2400-2600', count: 3894, percentage: 0.15 },
      { range: '2600+', count: 328, percentage: 0.05 }
    ]
  });
});

// OTB Database endpoints
app.get('/api/otb/database/tournaments', async (req, res) => {
  if (!db) {
    return res.json([]);
  }
  
  try {
    const tournaments = await new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM tournaments 
        ORDER BY date DESC 
        LIMIT 100
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json(tournaments);
  } catch (error) {
    console.error('Tournament fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const server = app.listen(PORT, async () => {
  console.log('');
  console.log('='.repeat(60));
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Cache: ${getCacheStats().available ? 'Enabled' : 'Disabled'}`);
  console.log(`🛡️  Rate Limiting: Enabled`);
  console.log(`📈 Cache Stats: http://localhost:${PORT}/api/cache/stats`);
  console.log(`🎯 Frontend should connect to http://localhost:${PORT}/api`);
  console.log('='.repeat(60));
  console.log('');
  
  // Warmup cache with common endpoints
  if (getCacheStats().available) {
    console.log('🔥 Warming up cache...');
    setTimeout(() => {
      warmupCache().then(results => {
        console.log(`✅ Cache warmup complete: ${results.filter(r => r.status === 'warmed').length} endpoints cached`);
      });
    }, 2000);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully...');
  server.close(() => {
    if (db) {
      db.close();
    }
    process.exit(0);
  });
});