const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
  // Application
  app: {
    name: process.env.APP_NAME || 'ChessStats',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3008'),
    url: process.env.APP_URL || 'http://localhost:3008',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test'
  },

  // Frontend
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000'
  },

  // Database
  database: {
    type: process.env.DATABASE_TYPE || 'sqlite',
    sqlite: {
      path: process.env.DATABASE_PATH || './complete-tournaments.db'
    },
    postgres: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'chess_stats',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || '',
      url: process.env.DATABASE_URL
    }
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },

  // Email
  email: {
    service: process.env.EMAIL_SERVICE || 'smtp',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || 'noreply@chessstats.com',
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY
    }
  },

  // External APIs
  apis: {
    chesscom: {
      url: process.env.CHESS_COM_API_URL || 'https://api.chess.com/pub',
      userAgent: process.env.CHESS_COM_USER_AGENT || 'ChessStats/1.0'
    },
    lichess: {
      url: process.env.LICHESS_API_URL || 'https://lichess.org/api'
    }
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    chessComDelay: parseInt(process.env.RATE_LIMIT_CHESS_COM_DELAY || '500'),
    lichessDelay: parseInt(process.env.RATE_LIMIT_LICHESS_DELAY || '100')
  },

  // Sentry
  sentry: {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || 'development',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0')
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    format: process.env.LOG_FORMAT || 'json',
    dir: process.env.LOG_DIR || './logs',
    maxFiles: process.env.LOG_MAX_FILES || '14',
    maxSize: process.env.LOG_MAX_SIZE || '10m'
  },

  // Security
  security: {
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
    sessionSecret: process.env.SESSION_SECRET || 'change-this-session-secret',
    cookie: {
      secure: process.env.COOKIE_SECURE === 'true',
      httpOnly: process.env.COOKIE_HTTP_ONLY !== 'false',
      sameSite: process.env.COOKIE_SAME_SITE || 'lax'
    }
  },

  // WebSocket
  websocket: {
    port: parseInt(process.env.WS_PORT || '3008'),
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '30000'),
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000')
  },

  // File Upload
  upload: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || '.pgn,.jpg,.jpeg,.png,.gif').split(',')
  },

  // Analytics
  analytics: {
    googleAnalyticsId: process.env.GOOGLE_ANALYTICS_ID,
    mixpanelToken: process.env.MIXPANEL_TOKEN
  },

  // Backup
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
    path: process.env.BACKUP_PATH || './backups'
  },

  // Feature Flags
  features: {
    websocket: process.env.FEATURE_WEBSOCKET !== 'false',
    emailNotifications: process.env.FEATURE_EMAIL_NOTIFICATIONS !== 'false',
    socialLogin: process.env.FEATURE_SOCIAL_LOGIN === 'true',
    premiumAccounts: process.env.FEATURE_PREMIUM_ACCOUNTS === 'true'
  },

  // Testing
  test: {
    databasePath: process.env.TEST_DATABASE_PATH || './test-database.db',
    port: parseInt(process.env.TEST_PORT || '3009')
  },

  // Debug
  debug: process.env.DEBUG === 'true'
};

// Validate required environment variables
const validateConfig = () => {
  const required = [];
  const warnings = [];

  // Check for production requirements
  if (config.app.isProduction) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change-this')) {
      required.push('JWT_SECRET must be set to a secure value in production');
    }
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes('change-this')) {
      required.push('SESSION_SECRET must be set to a secure value in production');
    }
    if (config.database.type === 'postgres' && !process.env.DATABASE_URL) {
      required.push('DATABASE_URL must be set for PostgreSQL in production');
    }
  }

  // Warnings
  if (!process.env.SENTRY_DSN && config.app.isProduction) {
    warnings.push('SENTRY_DSN not set - error tracking will be disabled');
  }
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    warnings.push('Email configuration incomplete - email notifications will be disabled');
  }

  // Log validation results
  if (required.length > 0) {
    console.error('❌ Configuration validation failed:');
    required.forEach(msg => console.error(`  - ${msg}`));
    if (config.app.isProduction) {
      process.exit(1);
    }
  }

  if (warnings.length > 0) {
    console.warn('⚠️ Configuration warnings:');
    warnings.forEach(msg => console.warn(`  - ${msg}`));
  }

  if (required.length === 0 && warnings.length === 0) {
    console.log('✅ Configuration validated successfully');
  }
};

// Run validation
if (!config.app.isTest) {
  validateConfig();
}

module.exports = config;