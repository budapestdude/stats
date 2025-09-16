const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/swagger/swaggerConfig');

// Import the cached server logic
const app = express();
const PORT = process.env.PORT || 3007;

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

// Swagger documentation - serve before other routes
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Chess Stats API Documentation',
  customfavIcon: '/favicon.ico'
}));

// Redirect root to API docs
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

// OpenAPI specification endpoint
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Import all the routes from simple-server-cached.js
// For brevity, just add a message here
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Chess Stats API with documentation',
    documentation: `http://localhost:${PORT}/api-docs`
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Chess Stats API',
    version: '1.0.0',
    documentation: `http://localhost:${PORT}/api-docs`,
    openapi: `http://localhost:${PORT}/api-docs.json`,
    endpoints: {
      health: '/health',
      players: '/api/players',
      games: '/api/games',
      openings: '/api/openings',
      tournaments: '/api/tournaments',
      statistics: '/api/stats',
      cache: '/api/cache',
      otb: '/api/otb'
    },
    features: {
      caching: true,
      rateLimiting: true,
      compression: true,
      cors: true
    },
    externalAPIs: {
      chesscom: 'https://api.chess.com/pub',
      lichess: 'https://lichess.org/api'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(60));
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`📄 OpenAPI Spec: http://localhost:${PORT}/api-docs.json`);
  console.log(`🎯 API Base: http://localhost:${PORT}/api`);
  console.log('='.repeat(60));
  console.log('');
  
  console.log('Available endpoints:');
  console.log('  Health:     GET  /health');
  console.log('  Players:    GET  /api/players/{username}');
  console.log('  Stats:      GET  /api/players/{username}/stats');
  console.log('  Games:      GET  /api/players/{username}/games');
  console.log('  Openings:   GET  /api/openings/explorer');
  console.log('  Tournaments: GET /api/tournaments');
  console.log('  Cache:      GET  /api/cache/stats');
  console.log('');
});