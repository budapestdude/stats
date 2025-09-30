const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Configuration object with defaults
const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT) || 3007,
  
  // Database
  mainDbPath: process.env.MAIN_DB_PATH || path.join(__dirname, '..', 'otb-database', 'complete-tournaments.db'),
  movesDbPath: process.env.MOVES_DB_PATH || path.join(__dirname, '..', 'chess-stats.db'),
  
  // PostgreSQL (future)
  db: {
    type: process.env.DB_TYPE || 'sqlite',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'chess_stats',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    poolMin: parseInt(process.env.DB_POOL_MIN) || 2,
    poolMax: parseInt(process.env.DB_POOL_MAX) || 20,
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 60000
  },
  
  // External APIs
  apis: {
    chessComUrl: process.env.CHESS_COM_API || 'https://api.chess.com/pub',
    lichessUrl: process.env.LICHESS_API || 'https://lichess.org/api',
    userAgent: process.env.USER_AGENT || 'Chess-Stats-Website/1.0',
    chessComApiKey: process.env.CHESS_COM_API_KEY || '',
    lichessApiToken: process.env.LICHESS_API_TOKEN || ''
  },
  
  // Redis
  redis: {
    enabled: process.env.USE_REDIS === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || ''
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    searchMax: parseInt(process.env.SEARCH_RATE_LIMIT_MAX) || 20,
    databaseMax: parseInt(process.env.DATABASE_RATE_LIMIT_MAX) || 10,
    externalApiMax: parseInt(process.env.EXTERNAL_API_RATE_LIMIT) || 30
  },
  
  // Cache TTL (seconds)
  cache: {
    shortTTL: parseInt(process.env.CACHE_SHORT_TTL) || 60,
    mediumTTL: parseInt(process.env.CACHE_MEDIUM_TTL) || 300,
    longTTL: parseInt(process.env.CACHE_LONG_TTL) || 3600,
    dailyTTL: parseInt(process.env.CACHE_DAILY_TTL) || 86400,
    playerTTL: parseInt(process.env.CACHE_TTL_PLAYER) || 3600,
    gamesTTL: parseInt(process.env.CACHE_TTL_GAMES) || 1800,
    statsTTL: parseInt(process.env.CACHE_TTL_STATS) || 7200
  },
  
  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:*',
    credentials: process.env.CORS_CREDENTIALS === 'true'
  },
  
  // Security
  security: {
    compressionLevel: parseInt(process.env.COMPRESSION_LEVEL) || 6,
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
    helmetEnabled: process.env.HELMET_ENABLED !== 'false'
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    errorFile: process.env.LOG_FILE_ERROR || 'error.log',
    combinedFile: process.env.LOG_FILE_COMBINED || 'combined.log',
    toFile: process.env.LOG_TO_FILE !== 'false',
    toConsole: process.env.LOG_TO_CONSOLE !== 'false'
  },
  
  // Helpers
  isDevelopment: () => config.nodeEnv === 'development',
  isProduction: () => config.nodeEnv === 'production',
  isTest: () => config.nodeEnv === 'test'
};

// Validate configuration
function validateConfig() {
  const errors = [];
  
  if (config.port < 1 || config.port > 65535) {
    errors.push(`Invalid port: ${config.port}`);
  }
  
  if (config.rateLimit.windowMs < 1000) {
    errors.push(`Rate limit window too short: ${config.rateLimit.windowMs}ms`);
  }
  
  if (config.cache.shortTTL < 1) {
    errors.push(`Cache TTL too short: ${config.cache.shortTTL}s`);
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Validate on load
try {
  validateConfig();
} catch (error) {
  console.error('Configuration error:', error.message);
  process.exit(1);
}

module.exports = config;