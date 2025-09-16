const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { createServer } = require('http');
const socketService = require('./services/socketService');

// Import middleware
const { errorHandler, notFoundHandler, logger } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const { getCacheStats } = require('./middleware/cache');
const sentryMiddleware = require('./middleware/sentryMiddleware');

// Import new security middleware
const { applySecurity, securityMiddleware } = require('./src/middleware/security');
const { applySessionSecurity } = require('./src/middleware/session-security');
const { sanitizeInput } = require('./src/middleware/validation');

// Import routes
const playersRouter = require('./routes/players');
const tournamentsRouter = require('./routes/tournaments');
const openingsRouter = require('./routes/openings');
const statsRouter = require('./routes/stats');
const authRouter = require('./routes/auth');

// Import database manager
const dbManager = require('./config/database');

// Create Express app and HTTP server
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3007;

// Initialize Sentry monitoring (must be first)
sentryMiddleware.initialize(app);

// Apply comprehensive security middleware
applySecurity(app);

// Apply session security
applySessionSecurity(app);

// Apply input sanitization
app.use(sanitizeInput);

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) }
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Swagger documentation (before rate limiting so docs are always accessible)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Chess Stats API Documentation',
  explorer: true
}));

// Serve Swagger JSON spec
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Apply general rate limiting
app.use('/api/', apiLimiter);

// Sentry performance and error tracking middleware
app.use(sentryMiddleware.performanceMiddleware());
app.use(sentryMiddleware.rateLimitErrorMiddleware());
app.use(sentryMiddleware.userContextMiddleware());

// Health check endpoint (no rate limiting)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'Chess Stats API is running!',
    version: '2.0.0',
    uptime: process.uptime()
  });
});

// API test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!',
    version: '2.0.0',
    features: [
      'Modular architecture',
      'Rate limiting',
      'Caching',
      'Input validation',
      'Error handling',
      'Database pooling'
    ]
  });
});

// Cache statistics endpoint
app.get('/api/cache/stats', (req, res) => {
  res.json(getCacheStats());
});

// Sentry health check endpoint
app.get('/api/monitoring/sentry', (req, res) => {
  res.json(sentryMiddleware.healthCheck());
});

// WebSocket connection statistics endpoint
app.get('/api/websocket/stats', (req, res) => {
  res.json(socketService.getConnectionStats());
});

// Mount route modules
app.use('/api/auth', authRouter);
app.use('/api/players', playersRouter);
app.use('/api/tournaments', tournamentsRouter);
app.use('/api/openings', openingsRouter);
app.use('/api/stats', statsRouter);

// OTB Database routes (keeping these in main file for now as they're complex)
app.get('/api/otb/database/search', apiLimiter, async (req, res) => {
  try {
    const { player, tournament, year, opening } = req.query;
    const db = await dbManager.mainDb;
    
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    let query = 'SELECT * FROM games WHERE 1=1';
    const params = [];

    if (player) {
      query += ' AND (White LIKE ? OR Black LIKE ?)';
      params.push(`%${player}%`, `%${player}%`);
    }

    if (tournament) {
      query += ' AND Event LIKE ?';
      params.push(`%${tournament}%`);
    }

    if (year) {
      query += ' AND Date LIKE ?';
      params.push(`${year}%`);
    }

    if (opening) {
      query += ' AND Opening LIKE ?';
      params.push(`%${opening}%`);
    }

    query += ' LIMIT 100';

    const results = await dbManager.getAll(db, query, params);
    res.json(results);
  } catch (error) {
    logger.error('OTB search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/otb/database/tournaments', apiLimiter, async (req, res) => {
  try {
    const db = await dbManager.mainDb;
    
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    const query = `
      SELECT DISTINCT Event as name, Site as location, 
             COUNT(*) as games, MIN(Date) as startDate, MAX(Date) as endDate
      FROM games
      GROUP BY Event, Site
      ORDER BY startDate DESC
      LIMIT 50
    `;

    const tournaments = await dbManager.getAll(db, query);
    res.json(tournaments);
  } catch (error) {
    logger.error('OTB tournaments error:', error);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

app.get('/api/otb/database/players/:name/games', apiLimiter, async (req, res) => {
  try {
    const { name } = req.params;
    const db = await dbManager.mainDb;
    
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    const query = `
      SELECT * FROM games 
      WHERE White = ? OR Black = ?
      ORDER BY Date DESC
      LIMIT 100
    `;

    const games = await dbManager.getAll(db, query, [name, name]);
    res.json(games);
  } catch (error) {
    logger.error('OTB player games error:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

app.get('/api/otb/database/game/:id', apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await dbManager.movesDb || dbManager.mainDb;
    
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    const game = await dbManager.getOne(db, 'SELECT * FROM games WHERE id = ?', [id]);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(game);
  } catch (error) {
    logger.error('OTB game fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Games search endpoint
app.get('/api/games/search', apiLimiter, async (req, res) => {
  try {
    const { white, black, opening, result, limit = 20 } = req.query;
    const db = await dbManager.mainDb;
    
    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    let query = 'SELECT * FROM games WHERE 1=1';
    const params = [];

    if (white) {
      query += ' AND White LIKE ?';
      params.push(`%${white}%`);
    }

    if (black) {
      query += ' AND Black LIKE ?';
      params.push(`%${black}%`);
    }

    if (opening) {
      query += ' AND (Opening LIKE ? OR ECO = ?)';
      params.push(`%${opening}%`, opening);
    }

    if (result) {
      query += ' AND Result = ?';
      params.push(result);
    }

    query += ' ORDER BY Date DESC LIMIT ?';
    params.push(parseInt(limit));

    const games = await dbManager.getAll(db, query, params);
    res.json(games);
  } catch (error) {
    logger.error('Games search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Sentry error handler (must be before other error handlers)
app.use(sentryMiddleware.errorHandler());

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connections
    await dbManager.initialize();
    
    // Initialize WebSocket service
    socketService.initialize(server);
    socketService.startPeriodicUpdates();
    
    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Chess Stats API Server v2.0 running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🌐 WebSocket: Real-time updates enabled`);
      logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
      logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('✨ Features: WebSocket, Modular routes, Rate limiting, Caching, Validation, Logging');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server gracefully');
  dbManager.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, closing server gracefully');
  dbManager.close();
  process.exit(0);
});

// Start the server
startServer();