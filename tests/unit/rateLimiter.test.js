const {
  createRateLimiter,
  rateLimiters,
  queueApiRequest,
  getStats,
  resetStats,
  ipThrottle
} = require('../../src/middleware/rateLimiter');
const express = require('express');
const request = require('supertest');

describe('Rate Limiter', () => {
  beforeEach(() => {
    resetStats();
  });

  describe('Rate Limiter Middleware', () => {
    let app;

    beforeEach(() => {
      app = express();
      
      // Test endpoint
      app.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });
    });

    test('should allow requests within limit', async () => {
      const limiter = createRateLimiter({
        windowMinutes: 1,
        max: 5
      });
      
      app.use(limiter);
      
      // Make 3 requests (within limit)
      for (let i = 0; i < 3; i++) {
        await request(app)
          .get('/test')
          .expect(200);
      }
    });

    test('should block requests exceeding limit', async () => {
      const limiter = createRateLimiter({
        windowMinutes: 1,
        max: 3
      });
      
      app.use(limiter);
      
      // Make 3 requests (at limit)
      for (let i = 0; i < 3; i++) {
        await request(app)
          .get('/test')
          .expect(200);
      }
      
      // 4th request should be blocked
      const response = await request(app)
        .get('/test')
        .expect(429);
      
      expect(response.body).toHaveProperty('error', 'Too many requests');
      expect(response.body).toHaveProperty('retryAfter');
      expect(response.body).toHaveProperty('limit');
    });

    test('should include rate limit headers', async () => {
      const limiter = createRateLimiter({
        windowMinutes: 1,
        max: 5
      });
      
      app.use(limiter);
      
      const response = await request(app)
        .get('/test')
        .expect(200);
      
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
      expect(response.headers).toHaveProperty('ratelimit-reset');
    });

    test('should use IP-based rate limiting', async () => {
      const limiter = createRateLimiter({
        windowMinutes: 1,
        max: 2
      });
      
      app.use(limiter);
      
      // Make 2 requests (within limit)
      await request(app)
        .get('/test')
        .expect(200);
      
      await request(app)
        .get('/test')
        .expect(200);
      
      // 3rd request should be blocked
      await request(app)
        .get('/test')
        .expect(429);
    });

    test('should skip rate limiting for specified paths', async () => {
      const limiter = createRateLimiter({
        windowMinutes: 1,
        max: 1,
        skip: (req) => req.path === '/health'
      });
      
      app.use(limiter);
      app.get('/health', (req, res) => res.json({ status: 'ok' }));
      
      // Make multiple requests to /health (should not be rate limited)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/health')
          .expect(200);
      }
      
      // Regular endpoint should still be rate limited
      await request(app)
        .get('/test')
        .expect(200);
      
      await request(app)
        .get('/test')
        .expect(429);
    });
  });

  describe('Pre-configured Rate Limiters', () => {
    test('should have general rate limiter configured', () => {
      expect(rateLimiters).toHaveProperty('general');
      expect(typeof rateLimiters.general).toBe('function');
    });

    test('should have search rate limiter configured', () => {
      expect(rateLimiters).toHaveProperty('search');
      expect(typeof rateLimiters.search).toBe('function');
    });

    test('should have export rate limiter configured', () => {
      expect(rateLimiters).toHaveProperty('export');
      expect(typeof rateLimiters.export).toBe('function');
    });

    test('should have static rate limiter configured', () => {
      expect(rateLimiters).toHaveProperty('static');
      expect(typeof rateLimiters.static).toBe('function');
    });
  });

  describe('API Request Queue', () => {
    test('should queue and execute API requests', async () => {
      const mockApiCall = jest.fn().mockResolvedValue({ data: 'success' });
      
      const result = await queueApiRequest('chesscom', mockApiCall);
      
      expect(result).toEqual({ data: 'success' });
      expect(mockApiCall).toHaveBeenCalledTimes(1);
    });

    test('should handle API request failures', async () => {
      const mockApiCall = jest.fn().mockRejectedValue(new Error('API Error'));
      
      await expect(queueApiRequest('chesscom', mockApiCall))
        .rejects
        .toThrow('API Error');
    });

    test('should handle rate limit errors from external APIs', async () => {
      const rateLimitError = new Error('Rate Limited');
      rateLimitError.response = {
        status: 429,
        headers: { 'retry-after': '60' }
      };
      
      const mockApiCall = jest.fn().mockRejectedValue(rateLimitError);
      
      await expect(queueApiRequest('chesscom', mockApiCall))
        .rejects
        .toThrow('Rate Limited');
      
      const stats = getStats();
      expect(stats.apiCalls.chesscom.failed).toBe(1);
    });

    test('should throw error for unknown API types', async () => {
      const mockApiCall = jest.fn();
      
      await expect(queueApiRequest('unknown', mockApiCall))
        .rejects
        .toThrow('Unknown API type: unknown');
    });

    test('should track API call statistics', async () => {
      const mockApiCall = jest.fn().mockResolvedValue({ data: 'success' });
      
      await queueApiRequest('chesscom', mockApiCall);
      
      const stats = getStats();
      expect(stats.apiCalls.chesscom.success).toBe(1);
      expect(stats.apiCalls.chesscom.queued).toBe(1);
    });
  });

  describe('IP Throttling', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(ipThrottle({ maxRequestsPerSecond: 2 }));
      app.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });
    });

    test('should allow requests within per-second limit', async () => {
      // Make 2 requests (within limit)
      await request(app)
        .get('/test')
        .expect(200);
      
      await request(app)
        .get('/test')
        .expect(200);
    });

    test('should block requests exceeding per-second limit', async () => {
      // Make requests at the limit
      await request(app).get('/test').expect(200);
      await request(app).get('/test').expect(200);
      
      // 3rd request should be blocked
      const response = await request(app)
        .get('/test')
        .expect(429);
      
      expect(response.body).toHaveProperty('error', 'Request rate too high');
    });

    test('should reset limit after time window', async () => {
      // Make requests at the limit
      await request(app).get('/test').expect(200);
      await request(app).get('/test').expect(200);
      await request(app).get('/test').expect(429);
      
      // Wait for next second
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be allowed again
      await request(app).get('/test').expect(200);
    });
  });

  describe('Statistics', () => {
    test('should return rate limit statistics', () => {
      const stats = getStats();
      
      expect(stats).toHaveProperty('blocked');
      expect(stats).toHaveProperty('passed');
      expect(stats).toHaveProperty('queued');
      expect(stats).toHaveProperty('apiCalls');
      expect(stats).toHaveProperty('queues');
      expect(stats).toHaveProperty('redisConnected');
      
      expect(stats.apiCalls).toHaveProperty('chesscom');
      expect(stats.apiCalls).toHaveProperty('lichess');
      
      expect(stats.queues).toHaveProperty('chesscom');
      expect(stats.queues).toHaveProperty('lichess');
    });

    test('should reset statistics', () => {
      // Add some stats
      getStats(); // This might increment some counters
      
      resetStats();
      
      const stats = getStats();
      expect(stats.blocked).toBe(0);
      expect(stats.passed).toBe(0);
      expect(stats.queued).toBe(0);
      expect(stats.apiCalls.chesscom.success).toBe(0);
      expect(stats.apiCalls.chesscom.failed).toBe(0);
      expect(stats.apiCalls.lichess.success).toBe(0);
      expect(stats.apiCalls.lichess.failed).toBe(0);
    });
  });

  describe('Concurrent Requests', () => {
    test('should handle multiple concurrent API requests', async () => {
      const mockApiCall = jest.fn().mockResolvedValue({ data: 'success' });
      
      const promises = Array(5).fill().map(() => 
        queueApiRequest('lichess', mockApiCall)
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toEqual({ data: 'success' });
      });
      
      expect(mockApiCall).toHaveBeenCalledTimes(5);
    });

    test('should respect queue concurrency limits', async () => {
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      
      const mockApiCall = jest.fn().mockImplementation(async () => {
        await delay(100); // Simulate API delay
        return { data: 'success' };
      });
      
      // Queue many requests
      const promises = Array(20).fill().map(() => 
        queueApiRequest('chesscom', mockApiCall)
      );
      
      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      // Should take some time due to concurrency limits
      expect(duration).toBeGreaterThan(200); // At least some queuing happened
      expect(mockApiCall).toHaveBeenCalledTimes(20);
    });
  });
});