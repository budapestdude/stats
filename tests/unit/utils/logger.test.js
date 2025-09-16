// Mock winston-daily-rotate-file before requiring any modules
jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    write: jest.fn(),
    end: jest.fn()
  }));
});

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn()
}));

// Mock config
jest.mock('../../../src/config', () => ({
  logging: {
    level: 'debug',
    dir: './logs',
    maxSize: '10m',
    maxFiles: '14'
  },
  app: {
    isDevelopment: true,
    isProduction: false
  }
}));

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const logger = require('../../../src/utils/logger');

describe('Logger Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Logging Methods', () => {
    test('should log error messages', () => {
      const errorSpy = jest.spyOn(logger, 'error');
      const testError = new Error('Test error');
      
      logger.error('Test error message', testError);
      
      expect(errorSpy).toHaveBeenCalledWith('Test error message', testError);
    });

    test('should log warning messages', () => {
      const warnSpy = jest.spyOn(logger, 'warn');
      
      logger.warn('Test warning message');
      
      expect(warnSpy).toHaveBeenCalledWith('Test warning message');
    });

    test('should log info messages', () => {
      const infoSpy = jest.spyOn(logger, 'info');
      
      logger.info('Test info message');
      
      expect(infoSpy).toHaveBeenCalledWith('Test info message');
    });

    test('should log debug messages', () => {
      const debugSpy = jest.spyOn(logger, 'debug');
      
      logger.debug('Test debug message');
      
      expect(debugSpy).toHaveBeenCalledWith('Test debug message');
    });
  });

  describe('Enhanced Error Logging', () => {
    test('should log error with context', () => {
      const errorSpy = jest.spyOn(logger, 'error');
      const testError = new Error('Database connection failed');
      testError.code = 'ECONNREFUSED';
      
      const context = {
        userId: '123',
        operation: 'fetchPlayer',
        timestamp: new Date().toISOString()
      };
      
      const errorInfo = logger.logError(testError, context);
      
      expect(errorInfo).toMatchObject({
        message: 'Database connection failed',
        code: 'ECONNREFUSED',
        name: 'Error',
        ...context
      });
      
      expect(errorSpy).toHaveBeenCalled();
    });

    test('should categorize errors by status code', () => {
      const errorSpy = jest.spyOn(logger, 'error');
      const warnSpy = jest.spyOn(logger, 'warn');
      const infoSpy = jest.spyOn(logger, 'info');
      
      // Server error (500+)
      const serverError = new Error('Internal server error');
      serverError.statusCode = 500;
      logger.logError(serverError);
      expect(errorSpy).toHaveBeenCalledWith('Server Error', expect.any(Object));
      
      // Client error (400-499)
      const clientError = new Error('Bad request');
      clientError.statusCode = 400;
      logger.logError(clientError);
      expect(warnSpy).toHaveBeenCalledWith('Client Error', expect.any(Object));
      
      // Other errors
      const otherError = new Error('Redirect');
      otherError.statusCode = 302;
      logger.logError(otherError);
      expect(infoSpy).toHaveBeenCalledWith('Handled Error', expect.any(Object));
    });
  });

  describe('API Request Logging', () => {
    test('should log successful API requests', () => {
      const infoSpy = jest.spyOn(logger, 'info');
      
      const response = {
        status: 200,
        data: { players: [] }
      };
      
      logger.logApiRequest('chess.com', '/player/magnus', { type: 'rapid' }, response);
      
      expect(infoSpy).toHaveBeenCalledWith(
        'API Request Success: chess.com',
        expect.objectContaining({
          service: 'chess.com',
          endpoint: '/player/magnus',
          params: { type: 'rapid' },
          response: expect.objectContaining({
            status: 200
          })
        })
      );
    });

    test('should log failed API requests', () => {
      const errorSpy = jest.spyOn(logger, 'error');
      
      const error = new Error('Rate limit exceeded');
      error.response = { status: 429 };
      
      logger.logApiRequest('lichess', '/api/user', {}, null, error);
      
      expect(errorSpy).toHaveBeenCalledWith(
        'API Request Failed: lichess',
        expect.objectContaining({
          service: 'lichess',
          endpoint: '/api/user',
          error: expect.objectContaining({
            message: 'Rate limit exceeded',
            statusCode: 429
          })
        })
      );
    });
  });

  describe('Database Operation Logging', () => {
    test('should log successful database operations', () => {
      const debugSpy = jest.spyOn(logger, 'debug');
      
      logger.logDatabase('INSERT', 'players', { username: 'magnus' });
      
      expect(debugSpy).toHaveBeenCalledWith(
        'Database Operation: INSERT on players',
        expect.objectContaining({
          operation: 'INSERT',
          table: 'players',
          params: { username: 'magnus' }
        })
      );
    });

    test('should log database errors', () => {
      const errorSpy = jest.spyOn(logger, 'error');
      
      const dbError = new Error('Unique constraint violation');
      dbError.code = 'SQLITE_CONSTRAINT';
      
      logger.logDatabase('INSERT', 'games', { id: '123' }, dbError);
      
      expect(errorSpy).toHaveBeenCalledWith(
        'Database Error: INSERT on games',
        expect.objectContaining({
          operation: 'INSERT',
          table: 'games',
          error: expect.objectContaining({
            message: 'Unique constraint violation',
            code: 'SQLITE_CONSTRAINT'
          })
        })
      );
    });
  });

  describe('WebSocket Event Logging', () => {
    test('should log WebSocket events', () => {
      const debugSpy = jest.spyOn(logger, 'debug');
      
      logger.logWebSocket('connection', { userId: '123', socketId: 'abc' });
      
      expect(debugSpy).toHaveBeenCalledWith(
        'WebSocket Event: connection',
        expect.objectContaining({
          event: 'connection',
          data: { userId: '123', socketId: 'abc' }
        })
      );
    });

    test('should log WebSocket errors', () => {
      const errorSpy = jest.spyOn(logger, 'error');
      
      const wsError = new Error('Connection lost');
      logger.logWebSocket('disconnect', { userId: '123' }, wsError);
      
      expect(errorSpy).toHaveBeenCalledWith(
        'WebSocket Error: disconnect',
        expect.objectContaining({
          event: 'disconnect',
          error: expect.objectContaining({
            message: 'Connection lost'
          })
        })
      );
    });
  });

  describe('Cache Operation Logging', () => {
    test('should log cache hits', () => {
      const debugSpy = jest.spyOn(logger, 'debug');
      
      logger.logCache('get', 'player:magnus', true);
      
      expect(debugSpy).toHaveBeenCalledWith(
        'Cache Hit: player:magnus',
        expect.objectContaining({
          operation: 'get',
          key: 'player:magnus',
          hit: true
        })
      );
    });

    test('should log cache misses', () => {
      const debugSpy = jest.spyOn(logger, 'debug');
      
      logger.logCache('get', 'player:hikaru', false);
      
      expect(debugSpy).toHaveBeenCalledWith(
        'Cache Miss: player:hikaru',
        expect.objectContaining({
          operation: 'get',
          key: 'player:hikaru',
          hit: false
        })
      );
    });

    test('should log cache errors', () => {
      const errorSpy = jest.spyOn(logger, 'error');
      
      const cacheError = new Error('Redis connection failed');
      logger.logCache('set', 'player:data', null, cacheError);
      
      expect(errorSpy).toHaveBeenCalledWith(
        'Cache Error: set',
        expect.objectContaining({
          operation: 'set',
          key: 'player:data',
          error: expect.objectContaining({
            message: 'Redis connection failed'
          })
        })
      );
    });
  });

  describe('Authentication Logging', () => {
    test('should log successful authentication', () => {
      const infoSpy = jest.spyOn(logger, 'info');
      
      logger.logAuth('login', 'user123', true, { method: 'email' });
      
      expect(infoSpy).toHaveBeenCalledWith(
        'Authentication Success: login',
        expect.objectContaining({
          event: 'login',
          userId: 'user123',
          success: true,
          details: { method: 'email' }
        })
      );
    });

    test('should log failed authentication', () => {
      const warnSpy = jest.spyOn(logger, 'warn');
      
      logger.logAuth('login', null, false, { reason: 'Invalid credentials' });
      
      expect(warnSpy).toHaveBeenCalledWith(
        'Authentication Failed: login',
        expect.objectContaining({
          event: 'login',
          success: false,
          details: { reason: 'Invalid credentials' }
        })
      );
    });
  });

  describe('Performance Logging', () => {
    test('should log normal performance metrics', () => {
      const debugSpy = jest.spyOn(logger, 'debug');
      
      logger.logPerformance('API call', 250, { endpoint: '/api/players' });
      
      expect(debugSpy).toHaveBeenCalledWith(
        'Performance: API call',
        expect.objectContaining({
          operation: 'API call',
          duration: '250ms',
          details: { endpoint: '/api/players' }
        })
      );
    });

    test('should warn about slow operations', () => {
      const warnSpy = jest.spyOn(logger, 'warn');
      
      logger.logPerformance('Database query', 3500, { query: 'SELECT * FROM games' });
      
      expect(warnSpy).toHaveBeenCalledWith(
        'Slow Operation: Database query',
        expect.objectContaining({
          operation: 'Database query',
          duration: '3500ms'
        })
      );
    });
  });

  describe('Child Logger', () => {
    test('should create child logger with metadata', () => {
      const childLogger = logger.child({ service: 'auth', requestId: '123' });
      
      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
      expect(typeof childLogger.error).toBe('function');
    });
  });

  describe('Stream Interface', () => {
    test('should provide stream interface for Morgan', () => {
      const infoSpy = jest.spyOn(logger, 'info');
      
      logger.stream.write('GET /api/players 200 - 45ms\n');
      
      expect(infoSpy).toHaveBeenCalledWith('GET /api/players 200 - 45ms');
    });
  });
});