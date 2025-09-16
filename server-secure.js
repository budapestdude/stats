const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const { body, query, param, validationResult } = require('express-validator');
const axios = require('axios');
const path = require('path');
const morgan = require('morgan');
const compression = require('compression');
const { getInstance: getDatabase } = require('./services/database-fixed');

const app = express();
const PORT = process.env.PORT || 3007;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CHESS_COM_API = 'https://api.chess.com/pub';
const LICHESS_API = 'https://lichess.org/api';
const USER_AGENT = 'Chess-Stats-Website/1.0 (contact: chessstats@example.com; purpose: educational)';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
const corsOptions = {
  origin: function(origin, callback) {
    const allowedOrigins = NODE_ENV === 'production' 
      ? ['https://yourdomain.com'] // Replace with your actual domain
      : ['http://localhost:3000', 'http://localhost:3007'];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for search endpoints
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit to 20 searches per minute
  message: 'Too many search requests, please try again later.'
});

// Apply rate limiting
app.use('/api/', limiter);
app.use('/api/*/search', searchLimiter);
app.use('/api/players/search', searchLimiter);
app.use('/api/games/search', searchLimiter);

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Remove any MongoDB query operators from user input
app.use(mongoSanitize());

// Compression
app.use(compression());

// Logging
if (NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Request ID middleware for tracking
app.use((req, res, next) => {
  req.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array() 
    });
  }
  next();
};

// Initialize database connection
let db = null;
(async () => {
  try {
    db = await getDatabase();
    console.log('✅ Database service initialized');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    // In production, you might want to exit if DB is critical
    if (NODE_ENV === 'production') {
      process.exit(1);
    }
  }
})();

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    database: db ? 'connected' : 'disconnected',
    uptime: process.uptime()
  };
  
  if (db) {
    try {
      const gameCount = await db.getGameCount();
      health.totalGames = gameCount;
    } catch (error) {
      health.database = 'error';
      health.status = 'degraded';
    }
  }
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!',
    database: db ? 'connected' : 'disconnected',
    environment: NODE_ENV
  });
});

// Statistics Overview
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
      source: 'OTB Tournament Database'
    });
  } catch (error) {
    next(error);
  }
});

// Search Games with validation
app.get('/api/games/search', [
  query('player').optional().isString().trim().isLength({ min: 2, max: 100 }),
  query('event').optional().isString().trim().isLength({ max: 200 }),
  query('opening').optional().isString().trim().isLength({ max: 100 }),
  query('startDate').optional().isISO8601().toDate(),
  query('endDate').optional().isISO8601().toDate(),
  query('minRating').optional().isInt({ min: 0, max: 3000 }),
  query('page').optional().isInt({ min: 1, max: 1000 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
], async (req, res, next) => {
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

// Get Game by ID with validation
app.get('/api/games/:id', [
  param('id').isInt({ min: 1 }),
  handleValidationErrors
], async (req, res, next) => {
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

// Search Players with validation
app.get('/api/players/search', [
  query('q').optional().isString().trim().isLength({ min: 2, max: 100 }),
  query('query').optional().isString().trim().isLength({ min: 2, max: 100 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
], async (req, res, next) => {
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

// Get Player Stats with validation
app.get('/api/players/:username', [
  param('username').isString().trim().isLength({ min: 1, max: 100 }).escape(),
  query('source').optional().isIn(['database', 'chesscom', 'lichess', 'auto']),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const username = req.params.username;
    const source = req.query.source || 'auto';
    
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
            winRate: stats.total_games > 0 ? ((stats.wins / stats.total_games) * 100).toFixed(1) : 0,
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
          `${CHESS_COM_API}/player/${encodeURIComponent(username)}`,
          { 
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
          }
        );
        
        playerData = {
          ...response.data,
          source: 'chess.com'
        };
      } catch (error) {
        // Chess.com API failed, continue
      }
    }
    
    // Try Lichess API if still no data
    if (!playerData && (source === 'lichess' || source === 'auto')) {
      try {
        const response = await axios.get(
          `${LICHESS_API}/user/${encodeURIComponent(username)}`,
          { timeout: 5000 }
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

// Get Player Games with validation
app.get('/api/players/:username/games', [
  param('username').isString().trim().isLength({ min: 1, max: 100 }).escape(),
  query('page').optional().isInt({ min: 1, max: 1000 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
], async (req, res, next) => {
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

// Get Tournaments with validation
app.get('/api/tournaments', [
  query('page').optional().isInt({ min: 1, max: 1000 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
], async (req, res, next) => {
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

// Additional endpoints would follow the same pattern...
// (Truncated for brevity, but all endpoints should have validation)

// Global error handler
app.use((err, req, res, next) => {
  // Log error details
  console.error(`[${req.id}] Error:`, {
    message: err.message,
    stack: NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  // Don't leak error details in production
  if (NODE_ENV === 'production') {
    // Known error types
    if (err.message === 'Not allowed by CORS') {
      return res.status(403).json({ error: 'CORS policy violation' });
    }
    
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request entity too large' });
    }
    
    // Generic error response
    return res.status(err.status || 500).json({
      error: 'Internal server error',
      requestId: req.id
    });
  }
  
  // Development: send full error
  res.status(err.status || 500).json({
    error: err.message,
    stack: err.stack,
    requestId: req.id
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    requestId: req.id
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════');
  console.log(`✅ Secure Production Server Started`);
  console.log('═══════════════════════════════════════════════════');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`🔒 Security: Helmet + Rate Limiting + Validation`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🎯 API: http://localhost:${PORT}/api`);
  console.log('═══════════════════════════════════════════════════');
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received, starting graceful shutdown...`);
  
  server.close(() => {
    console.log('HTTP server closed');
    
    if (db) {
      db.close();
      console.log('Database connection closed');
    }
    
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // In production, you might want to send this to a monitoring service
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // In production, you might want to send this to a monitoring service
});

module.exports = app;