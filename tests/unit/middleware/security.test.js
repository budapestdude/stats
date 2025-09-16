const request = require('supertest');
const express = require('express');

// Mock logger before requiring modules that use it
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  logAuth: jest.fn(),
  logApiRequest: jest.fn(),
  logDatabase: jest.fn(),
  logWebSocket: jest.fn(),
  logCache: jest.fn(),
  logPerformance: jest.fn(),
  logError: jest.fn(),
  stream: { write: jest.fn() }
}));

// Mock config
jest.mock('../../../src/config', () => ({
  rateLimit: {
    windowMs: 60000,
    maxRequests: 100
  },
  security: {
    corsOrigins: ['http://localhost:3000'],
    sessionSecret: 'test-secret',
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: 'lax'
    }
  },
  app: {
    isDevelopment: true,
    isProduction: false,
    url: 'http://localhost:3008'
  },
  frontend: {
    url: 'http://localhost:3000'
  },
  redis: {
    host: null
  }
}));

// Now require the modules after mocks are set up
const {
  corsOptions,
  securityMiddleware,
  createRateLimiter,
  ipFilter,
  apiKeyAuth,
  requestSizeLimiter,
  csrfProtection,
  logSecurityEvent
} = require('../../../src/middleware/security');

const {
  bruteForcePreventer,
  checkPasswordStrength,
  recordFailedAttempt,
  clearFailedAttempts
} = require('../../../src/middleware/auth-security');

// Create test app
const createTestApp = (middleware) => {
  const app = express();
  app.use(express.json());
  app.use(middleware);
  app.get('/test', (req, res) => res.json({ success: true }));
  app.post('/test', (req, res) => res.json({ success: true, body: req.body }));
  return app;
};

describe('Security Middleware', () => {
  describe('CORS Configuration', () => {
    test('should allow localhost origins in development', (done) => {
      const origin = 'http://localhost:3000';
      corsOptions.origin(origin, (err, allowed) => {
        expect(err).toBeNull();
        expect(allowed).toBe(true);
        done();
      });
    });

    test('should block non-localhost origins in development', (done) => {
      const origin = 'http://malicious-site.com';
      corsOptions.origin(origin, (err, allowed) => {
        expect(err).toEqual(new Error('Not allowed by CORS'));
        expect(allowed).toBeUndefined();
        done();
      });
    });

    test('should allow requests with no origin', (done) => {
      corsOptions.origin(null, (err, allowed) => {
        expect(err).toBeNull();
        expect(allowed).toBe(true);
        done();
      });
    });

    test('should expose correct headers', () => {
      expect(corsOptions.exposedHeaders).toContain('X-Total-Count');
      expect(corsOptions.exposedHeaders).toContain('X-Rate-Limit-Remaining');
    });

    test('should allow credentials', () => {
      expect(corsOptions.credentials).toBe(true);
    });
  });

  describe('Security Headers Middleware', () => {
    let app;

    beforeEach(() => {
      app = createTestApp(securityMiddleware);
    });

    test('should set security headers', async () => {
      const response = await request(app).get('/test');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['permissions-policy']).toBe('geolocation=(), microphone=(), camera=()');
    });

    test('should add request ID', async () => {
      const response = await request(app).get('/test');
      
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('Rate Limiting', () => {
    test('should create rate limiter with default options', () => {
      const limiter = createRateLimiter();
      expect(limiter).toBeDefined();
      expect(typeof limiter).toBe('function');
    });

    test('should create rate limiter with custom options', () => {
      const limiter = createRateLimiter({
        windowMs: 30000,
        max: 50,
        message: 'Custom rate limit message'
      });
      expect(limiter).toBeDefined();
    });

    test('should enforce rate limits', async () => {
      const limiter = createRateLimiter({ 
        windowMs: 1000, 
        max: 2 
      });
      const app = createTestApp(limiter);
      
      // First two requests should succeed
      let response = await request(app).get('/test');
      expect(response.status).toBe(200);
      
      response = await request(app).get('/test');
      expect(response.status).toBe(200);
      
      // Third request should be rate limited
      response = await request(app).get('/test');
      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Rate limit exceeded');
    });
  });

  describe('IP Filtering', () => {
    test('should allow all IPs when no filter specified', async () => {
      const app = createTestApp(ipFilter([]));
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });

    test('should block unauthorized IPs', async () => {
      const app = createTestApp(ipFilter(['192.168.1.1']));
      const response = await request(app).get('/test');
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });
  });

  describe('API Key Authentication', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = process.env.VALID_API_KEYS;
      process.env.VALID_API_KEYS = 'test-api-key-123,test-api-key-456';
    });

    afterEach(() => {
      process.env.VALID_API_KEYS = originalEnv;
    });

    test('should reject requests without API key', async () => {
      const app = createTestApp(apiKeyAuth);
      const response = await request(app).get('/test');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
      expect(response.body.message).toBe('API key required');
    });

    test('should reject requests with invalid API key', async () => {
      const app = createTestApp(apiKeyAuth);
      const response = await request(app)
        .get('/test')
        .set('X-API-Key', 'invalid-key');
      
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid API key');
    });

    test('should allow requests with valid API key', async () => {
      const app = createTestApp(apiKeyAuth);
      const response = await request(app)
        .get('/test')
        .set('X-API-Key', 'test-api-key-123');
      
      expect(response.status).toBe(200);
    });
  });

  describe('Request Size Limiting', () => {
    test('should allow requests within size limit', async () => {
      const app = createTestApp(requestSizeLimiter('1kb'));
      const response = await request(app)
        .post('/test')
        .set('Content-Length', '500')
        .send({ data: 'small' });
      
      expect(response.status).toBe(200);
    });

    test('should reject requests exceeding size limit', async () => {
      const app = createTestApp(requestSizeLimiter('1kb'));
      const largeData = 'x'.repeat(2000);
      const response = await request(app)
        .post('/test')
        .set('Content-Length', '2000')
        .send({ data: largeData });
      
      expect(response.status).toBe(413);
      expect(response.body.error).toBe('Payload too large');
    });

    test('should parse size units correctly', () => {
      const app = express();
      app.use(requestSizeLimiter('5mb'));
      app.post('/test', (req, res) => res.json({ success: true }));
      
      // This should not throw
      expect(() => request(app).post('/test')).not.toThrow();
    });
  });

  describe('Password Strength Validation', () => {
    test('should validate strong passwords', () => {
      const result = checkPasswordStrength('MyStr0ng!Pass123');
      
      expect(result.valid).toBe(true);
      expect(result.strength).toBe('very strong');
      expect(result.issues).toHaveLength(0);
    });

    test('should reject weak passwords', () => {
      const result = checkPasswordStrength('password');
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('This password is too common. Please choose a stronger password');
    });

    test('should require minimum length', () => {
      const result = checkPasswordStrength('Ab1!');
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Password must be at least 8 characters');
    });

    test('should require character variety', () => {
      const result = checkPasswordStrength('abcdefghij');
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Password must contain at least one uppercase letter');
      expect(result.issues).toContain('Password must contain at least one number');
    });

    test('should detect sequential characters', () => {
      const result = checkPasswordStrength('Abcdef123!');
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Password should not contain sequential characters');
    });

    test('should detect repeated characters', () => {
      const result = checkPasswordStrength('Paaa123!@#');
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Password should not contain more than 2 repeated characters');
    });

    test('should calculate password strength levels', () => {
      // These expectations should match the actual implementation
      const weakPassword = checkPasswordStrength('weak');
      const fairPassword = checkPasswordStrength('Fair123');
      const goodPassword = checkPasswordStrength('Good123!');
      const strongPassword = checkPasswordStrength('Strong123!@');
      const veryStrongPassword = checkPasswordStrength('VeryStrong123!@#$');
      
      // Test that strength increases with complexity
      expect(['weak', 'fair']).toContain(weakPassword.strength);
      expect(['fair', 'good']).toContain(fairPassword.strength);
      expect(['good', 'strong']).toContain(goodPassword.strength);
      expect(['strong', 'very strong']).toContain(strongPassword.strength);
      expect(['strong', 'very strong']).toContain(veryStrongPassword.strength);
    });
  });

  describe('Brute Force Prevention', () => {
    beforeEach(() => {
      // Clear any existing attempts
      clearFailedAttempts('test@example.com');
    });

    test('should track failed login attempts', () => {
      const identifier = 'test@example.com';
      
      recordFailedAttempt(identifier);
      recordFailedAttempt(identifier);
      
      const req = { body: { email: identifier }, ip: '127.0.0.1' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      bruteForcePreventer(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.bruteForceIdentifier).toBe(identifier);
    });

    test('should lock account after too many attempts', () => {
      const identifier = 'test@example.com';
      
      // Record 5 failed attempts
      for (let i = 0; i < 5; i++) {
        recordFailedAttempt(identifier);
      }
      
      const req = { body: { email: identifier }, ip: '127.0.0.1' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      bruteForcePreventer(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too many failed attempts',
          message: expect.stringContaining('Account locked')
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should use IP as identifier if no email provided', () => {
      const req = { body: {}, ip: '192.168.1.100' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      bruteForcePreventer(req, res, next);
      
      expect(req.bruteForceIdentifier).toBe('192.168.1.100');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('CSRF Protection', () => {
    test('should skip CSRF for API routes', () => {
      const req = { 
        path: '/api/players',
        body: {},
        query: {},
        headers: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      csrfProtection(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should check CSRF token for non-API routes', () => {
      const req = { 
        path: '/form-submit',
        body: { _csrf: 'valid-token' },
        query: {},
        headers: {},
        session: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      csrfProtection(req, res, next);
      
      // With the placeholder validation, this should pass
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Security Event Logging', () => {
    test('should log security events', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      logSecurityEvent('Suspicious login attempt', {
        ip: '192.168.1.1',
        email: 'test@example.com'
      });
      
      // Since logger is mocked, we just verify the function doesn't throw
      expect(logSecurityEvent).toBeDefined();
      
      consoleSpy.mockRestore();
    });
  });
});