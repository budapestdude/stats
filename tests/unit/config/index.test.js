// Mock environment variables before requiring config
process.env.NODE_ENV = 'test';
process.env.PORT = '3009';
process.env.APP_NAME = 'ChessStats Test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.DATABASE_TYPE = 'sqlite';
process.env.DATABASE_PATH = './test.db';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.LOG_LEVEL = 'debug';
process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001';

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// Mock console methods for validation messages
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

describe('Config Module', () => {
  let config;
  
  beforeEach(() => {
    // Clear module cache to re-import config with different env vars
    jest.resetModules();
    
    // Mock console methods
    console.error = jest.fn();
    console.warn = jest.fn();
    console.log = jest.fn();
  });
  
  afterEach(() => {
    // Restore console methods
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
    
    // Clean up environment variables
    delete process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
  });

  describe('Application Configuration', () => {
    beforeEach(() => {
      config = require('../../../src/config');
    });

    test('should load app configuration from environment variables', () => {
      expect(config.app.name).toBe('ChessStats Test');
      expect(config.app.env).toBe('test');
      expect(config.app.port).toBe(3009);
      expect(config.app.isTest).toBe(true);
      expect(config.app.isDevelopment).toBe(false);
      expect(config.app.isProduction).toBe(false);
    });

    test('should set correct boolean flags based on environment', () => {
      // Test environment
      expect(config.app.isTest).toBe(true);
      expect(config.app.isDevelopment).toBe(false);
      expect(config.app.isProduction).toBe(false);
    });

    test('should parse port as integer', () => {
      expect(typeof config.app.port).toBe('number');
      expect(config.app.port).toBe(3009);
    });
  });

  describe('Database Configuration', () => {
    beforeEach(() => {
      config = require('../../../src/config');
    });

    test('should load SQLite configuration', () => {
      expect(config.database.type).toBe('sqlite');
      expect(config.database.sqlite.path).toBe('./test.db');
    });

    test('should have PostgreSQL configuration structure', () => {
      expect(config.database.postgres).toBeDefined();
      expect(config.database.postgres.host).toBe('localhost');
      expect(config.database.postgres.port).toBe(5432);
      expect(config.database.postgres.database).toBe('chess_stats');
    });
  });

  describe('Security Configuration', () => {
    beforeEach(() => {
      config = require('../../../src/config');
    });

    test('should load JWT configuration', () => {
      expect(config.jwt.secret).toBe('test-jwt-secret');
      expect(config.jwt.refreshSecret).toBeDefined();
      expect(config.jwt.expiresIn).toBe('15m');
      expect(config.jwt.refreshExpiresIn).toBe('7d');
    });

    test('should parse CORS origins', () => {
      expect(config.security.corsOrigins).toEqual([
        'http://localhost:3000',
        'http://localhost:3001'
      ]);
    });

    test('should configure cookie settings', () => {
      expect(config.security.cookie.httpOnly).toBe(true);
      expect(config.security.cookie.sameSite).toBe('lax');
    });

    test('should load session secret', () => {
      expect(config.security.sessionSecret).toBe('test-session-secret');
    });
  });

  describe('Redis Configuration', () => {
    beforeEach(() => {
      config = require('../../../src/config');
    });

    test('should load Redis configuration', () => {
      expect(config.redis.host).toBe('localhost');
      expect(config.redis.port).toBe(6379);
      expect(config.redis.db).toBe(0);
      expect(config.redis.url).toBe('redis://localhost:6379');
    });

    test('should parse Redis port as integer', () => {
      expect(typeof config.redis.port).toBe('number');
    });
  });

  describe('Rate Limiting Configuration', () => {
    beforeEach(() => {
      config = require('../../../src/config');
    });

    test('should load rate limiting configuration', () => {
      expect(config.rateLimit.windowMs).toBe(60000);
      expect(config.rateLimit.maxRequests).toBe(100);
      expect(config.rateLimit.chessComDelay).toBe(500);
      expect(config.rateLimit.lichessDelay).toBe(100);
    });

    test('should parse rate limit values as integers', () => {
      expect(typeof config.rateLimit.windowMs).toBe('number');
      expect(typeof config.rateLimit.maxRequests).toBe('number');
    });
  });

  describe('Logging Configuration', () => {
    beforeEach(() => {
      config = require('../../../src/config');
    });

    test('should load logging configuration', () => {
      expect(config.logging.level).toBe('debug');
      expect(config.logging.format).toBe('json');
      expect(config.logging.dir).toBe('./logs');
      expect(config.logging.maxFiles).toBe('14');
      expect(config.logging.maxSize).toBe('10m');
    });
  });

  describe('External APIs Configuration', () => {
    beforeEach(() => {
      config = require('../../../src/config');
    });

    test('should load Chess.com API configuration', () => {
      expect(config.apis.chesscom.url).toBe('https://api.chess.com/pub');
      expect(config.apis.chesscom.userAgent).toBe('ChessStats/1.0');
    });

    test('should load Lichess API configuration', () => {
      expect(config.apis.lichess.url).toBe('https://lichess.org/api');
    });
  });

  describe('Feature Flags', () => {
    beforeEach(() => {
      config = require('../../../src/config');
    });

    test('should load feature flags with defaults', () => {
      expect(config.features.websocket).toBe(true);
      expect(config.features.emailNotifications).toBe(true);
      expect(config.features.socialLogin).toBe(false);
      expect(config.features.premiumAccounts).toBe(false);
    });
  });

  describe('Email Configuration', () => {
    beforeEach(() => {
      config = require('../../../src/config');
    });

    test('should load email configuration with defaults', () => {
      expect(config.email.service).toBe('smtp');
      expect(config.email.host).toBe('smtp.gmail.com');
      expect(config.email.port).toBe(587);
      expect(config.email.secure).toBe(false);
      expect(config.email.from).toBe('noreply@chessstats.com');
    });
  });

  describe('WebSocket Configuration', () => {
    beforeEach(() => {
      config = require('../../../src/config');
    });

    test('should load WebSocket configuration', () => {
      expect(config.websocket.port).toBe(3009); // Same as app port in test
      expect(config.websocket.pingInterval).toBe(30000);
      expect(config.websocket.pingTimeout).toBe(60000);
    });
  });

  describe('Upload Configuration', () => {
    beforeEach(() => {
      config = require('../../../src/config');
    });

    test('should load upload configuration', () => {
      expect(config.upload.maxSize).toBe(10485760); // 10MB
      expect(config.upload.allowedTypes).toEqual(['.pgn', '.jpg', '.jpeg', '.png', '.gif']);
    });
  });

  describe('Backup Configuration', () => {
    beforeEach(() => {
      config = require('../../../src/config');
    });

    test('should load backup configuration', () => {
      expect(config.backup.enabled).toBe(false);
      expect(config.backup.schedule).toBe('0 2 * * *');
      expect(config.backup.retentionDays).toBe(30);
      expect(config.backup.path).toBe('./backups');
    });
  });

  describe('Test Configuration', () => {
    beforeEach(() => {
      config = require('../../../src/config');
    });

    test('should load test-specific configuration', () => {
      expect(config.test.databasePath).toBe('./test-database.db');
      expect(config.test.port).toBe(3009);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate configuration in test environment', () => {
      // In test environment, validation should pass without errors
      const config = require('../../../src/config');
      
      // Check that config loaded successfully
      expect(config).toBeDefined();
      expect(config.app).toBeDefined();
    });

    test('should handle missing optional environment variables', () => {
      delete process.env.SENTRY_DSN;
      delete process.env.EMAIL_USER;
      
      jest.resetModules();
      const config = require('../../../src/config');
      
      expect(config.sentry.dsn).toBeUndefined();
      expect(config.email.user).toBeUndefined();
    });

    test('should provide default values for missing environment variables', () => {
      delete process.env.APP_NAME;
      delete process.env.LOG_LEVEL;
      
      jest.resetModules();
      const config = require('../../../src/config');
      
      expect(config.app.name).toBe('ChessStats');
      expect(config.logging.level).toBe('debug');
    });
  });

  describe('Environment-specific Configuration', () => {
    test('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      
      jest.resetModules();
      const config = require('../../../src/config');
      
      expect(config.app.isDevelopment).toBe(true);
      expect(config.app.isProduction).toBe(false);
      expect(config.app.isTest).toBe(false);
    });

    test('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'secure-production-secret';
      process.env.SESSION_SECRET = 'secure-session-secret';
      
      jest.resetModules();
      const config = require('../../../src/config');
      
      expect(config.app.isProduction).toBe(true);
      expect(config.app.isDevelopment).toBe(false);
      expect(config.app.isTest).toBe(false);
    });
  });

  describe('URL Configuration', () => {
    test('should construct app URL', () => {
      process.env.APP_URL = 'https://api.chessstats.com';
      
      jest.resetModules();
      const config = require('../../../src/config');
      
      expect(config.app.url).toBe('https://api.chessstats.com');
    });

    test('should construct default app URL from port', () => {
      delete process.env.APP_URL;
      
      jest.resetModules();
      const config = require('../../../src/config');
      
      expect(config.app.url).toContain('http://localhost:');
    });
  });

  describe('Parse Functions', () => {
    test('should parse boolean environment variables correctly', () => {
      process.env.COOKIE_SECURE = 'true';
      process.env.FEATURE_WEBSOCKET = 'false';
      process.env.BACKUP_ENABLED = 'true';
      
      jest.resetModules();
      const config = require('../../../src/config');
      
      expect(config.security.cookie.secure).toBe(true);
      expect(config.features.websocket).toBe(false);
      expect(config.backup.enabled).toBe(true);
    });

    test('should parse numeric environment variables correctly', () => {
      process.env.RATE_LIMIT_WINDOW_MS = '30000';
      process.env.RATE_LIMIT_MAX_REQUESTS = '50';
      process.env.SENTRY_TRACES_SAMPLE_RATE = '0.5';
      
      jest.resetModules();
      const config = require('../../../src/config');
      
      expect(config.rateLimit.windowMs).toBe(30000);
      expect(config.rateLimit.maxRequests).toBe(50);
      expect(config.sentry.tracesSampleRate).toBe(0.5);
    });

    test('should parse array environment variables correctly', () => {
      process.env.ALLOWED_FILE_TYPES = '.pdf,.doc,.docx';
      
      jest.resetModules();
      const config = require('../../../src/config');
      
      expect(config.upload.allowedTypes).toEqual(['.pdf', '.doc', '.docx']);
    });
  });
});