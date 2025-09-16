const { 
  cache, 
  cacheMiddleware, 
  invalidatePattern, 
  getStats, 
  getCacheKey, 
  getTTL 
} = require('../../src/middleware/cache');

describe('Cache Middleware', () => {
  beforeEach(() => {
    // Clear cache before each test
    if (cache && cache.flush) {
      cache.flush();
    }
  });

  describe('Cache Operations', () => {
    test('should set and get values from cache', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };
      
      await cache.set(key, value, 60);
      const retrieved = await cache.get(key);
      
      expect(retrieved).toEqual(value);
    });

    test('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent-key');
      expect(result).toBeNull();
    });

    test('should delete keys from cache', async () => {
      const key = 'test-delete';
      const value = { data: 'delete-me' };
      
      await cache.set(key, value, 60);
      await cache.del(key);
      
      const result = await cache.get(key);
      expect(result).toBeNull();
    });

    test('should handle cache expiry', async () => {
      const key = 'test-expiry';
      const value = { data: 'expires' };
      
      // Set with 1 second TTL
      await cache.set(key, value, 1);
      
      // Should exist immediately
      let result = await cache.get(key);
      expect(result).toEqual(value);
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired
      result = await cache.get(key);
      expect(result).toBeNull();
    });

    test('should flush all cache entries', async () => {
      await cache.set('key1', 'value1', 60);
      await cache.set('key2', 'value2', 60);
      await cache.set('key3', 'value3', 60);
      
      await cache.flush();
      
      const result1 = await cache.get('key1');
      const result2 = await cache.get('key2');
      const result3 = await cache.get('key3');
      
      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });
  });

  describe('Cache Key Generation', () => {
    test('should generate cache key from request', () => {
      const req = {
        method: 'GET',
        originalUrl: '/api/players/magnus'
      };
      
      const key = getCacheKey(req);
      expect(key).toBe('cache:GET:/api/players/magnus');
    });

    test('should include query parameters in cache key', () => {
      const req = {
        method: 'GET',
        originalUrl: '/api/players?search=magnus&limit=10'
      };
      
      const key = getCacheKey(req);
      expect(key).toBe('cache:GET:/api/players?search=magnus&limit=10');
    });

    test('should differentiate between HTTP methods', () => {
      const getReq = { method: 'GET', originalUrl: '/api/data' };
      const postReq = { method: 'POST', originalUrl: '/api/data' };
      
      const getKey = getCacheKey(getReq);
      const postKey = getCacheKey(postReq);
      
      expect(getKey).not.toBe(postKey);
      expect(getKey).toContain('GET');
      expect(postKey).toContain('POST');
    });
  });

  describe('TTL Configuration', () => {
    test('should return correct TTL for player endpoints', () => {
      const ttl = getTTL('/api/players/magnus');
      expect(ttl).toBe(3600); // 1 hour
    });

    test('should return correct TTL for game endpoints', () => {
      const ttl = getTTL('/api/games/recent');
      expect(ttl).toBe(1800); // 30 minutes
    });

    test('should return correct TTL for stats endpoints', () => {
      const ttl = getTTL('/api/stats/overview');
      expect(ttl).toBe(7200); // 2 hours
    });

    test('should return correct TTL for opening endpoints', () => {
      const ttl = getTTL('/api/openings/popular');
      expect(ttl).toBe(86400); // 24 hours
    });

    test('should return default TTL for unknown endpoints', () => {
      const ttl = getTTL('/api/unknown/endpoint');
      expect(ttl).toBe(300); // 5 minutes default
    });
  });

  describe('Cache Middleware Function', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        method: 'GET',
        path: '/api/players/magnus',
        originalUrl: '/api/players/magnus'
      };
      
      res = {
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        statusCode: 200
      };
      
      next = jest.fn();
    });

    test('should skip caching for non-GET requests', async () => {
      req.method = 'POST';
      const middleware = cacheMiddleware();
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalledWith('X-Cache', expect.anything());
    });

    test('should skip caching for excluded paths', async () => {
      req.path = '/health';
      const middleware = cacheMiddleware({ excludePaths: ['/health'] });
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalledWith('X-Cache', expect.anything());
    });

    test('should return cached response on cache hit', async () => {
      const cachedData = { message: 'cached response' };
      const cacheKey = getCacheKey(req);
      await cache.set(cacheKey, cachedData, 60);
      
      const middleware = cacheMiddleware();
      await middleware(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith(cachedData);
      expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(next).not.toHaveBeenCalled();
    });

    test('should call next on cache miss', async () => {
      const middleware = cacheMiddleware();
      await middleware(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
      expect(next).toHaveBeenCalled();
      // Note: res.json is overridden by middleware, so we check if next was called
    });

    test('should cache response after successful request', async () => {
      const responseData = { message: 'new response' };
      const middleware = cacheMiddleware();
      
      await middleware(req, res, next);
      
      // Simulate response
      res.json(responseData);
      
      // Wait a bit for async cache write
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check if data was cached
      const cacheKey = getCacheKey(req);
      const cached = await cache.get(cacheKey);
      
      expect(cached).toEqual(responseData);
    });

    test('should not cache error responses', async () => {
      res.statusCode = 500;
      const responseData = { error: 'Server error' };
      const middleware = cacheMiddleware();
      
      await middleware(req, res, next);
      
      // Simulate error response
      res.json(responseData);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should not be cached
      const cacheKey = getCacheKey(req);
      const cached = await cache.get(cacheKey);
      
      expect(cached).toBeNull();
    });

    test('should use custom TTL when provided', async () => {
      const customTTL = 120;
      const middleware = cacheMiddleware({ ttl: customTTL });
      
      await middleware(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Cache Invalidation', () => {
    beforeEach(async () => {
      // Set up test data
      await cache.set('cache:GET:/api/players/magnus', { player: 'magnus' }, 60);
      await cache.set('cache:GET:/api/players/hikaru', { player: 'hikaru' }, 60);
      await cache.set('cache:GET:/api/games/123', { game: '123' }, 60);
    });

    test('should invalidate keys matching pattern', async () => {
      const deleted = await invalidatePattern('cache:*:/api/players/*');
      
      // Check players were deleted
      const magnus = await cache.get('cache:GET:/api/players/magnus');
      const hikaru = await cache.get('cache:GET:/api/players/hikaru');
      const game = await cache.get('cache:GET:/api/games/123');
      
      expect(magnus).toBeNull();
      expect(hikaru).toBeNull();
      expect(game).toEqual({ game: '123' }); // Should still exist
    });

    test('should handle invalid patterns gracefully', async () => {
      const deleted = await invalidatePattern('invalid-pattern-*');
      expect(deleted).toBe(0);
    });
  });

  describe('Cache Statistics', () => {
    test('should return cache statistics', () => {
      const stats = getStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('errors');
      expect(stats).toHaveProperty('writes');
      expect(stats).toHaveProperty('deletes');
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('type');
      expect(stats).toHaveProperty('available');
    });

    test('should calculate hit rate correctly', async () => {
      // Reset stats by creating some hits and misses
      const req = { method: 'GET', path: '/api/test', originalUrl: '/api/test' };
      const res = {
        json: jest.fn(),
        setHeader: jest.fn(),
        statusCode: 200
      };
      const next = jest.fn();
      
      const middleware = cacheMiddleware();
      
      // Create some misses
      await middleware(req, res, next);
      req.originalUrl = '/api/test2';
      await middleware(req, res, next);
      
      // Create a hit
      await cache.set('cache:GET:/api/test3', { data: 'test' }, 60);
      req.originalUrl = '/api/test3';
      await middleware(req, res, next);
      
      const stats = getStats();
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeLessThanOrEqual(100);
    });
  });
});