const { cacheMiddleware, clearCache, getCacheStats, caches } = require('../../../middleware/cache');

describe('Cache Middleware', () => {
  beforeEach(() => {
    // Clear all caches before each test
    Object.values(caches).forEach(cache => cache.flushAll());
  });

  describe('cacheMiddleware', () => {
    it('should cache GET requests', (done) => {
      const middleware = cacheMiddleware('short');
      const req = {
        method: 'GET',
        originalUrl: '/test',
        url: '/test'
      };
      const res = {
        json: jest.fn(function(data) {
          // First call - should be a cache miss
          expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
          
          // Second call - should be a cache hit
          const req2 = { ...req };
          const res2 = {
            setHeader: jest.fn(),
            json: jest.fn((data2) => {
              expect(data2).toEqual(data);
              expect(res2.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
              done();
            })
          };
          
          middleware(req2, res2, () => {});
        }),
        setHeader: jest.fn()
      };

      middleware(req, res, () => {
        res.json({ test: 'data' });
      });
    });

    it('should not cache non-GET requests', (done) => {
      const middleware = cacheMiddleware('short');
      const req = {
        method: 'POST',
        originalUrl: '/test'
      };
      const res = {
        json: jest.fn(),
        setHeader: jest.fn()
      };

      middleware(req, res, () => {
        expect(res.setHeader).not.toHaveBeenCalled();
        done();
      });
    });

    it('should use custom key generator', (done) => {
      const keyGen = (req) => `custom-${req.params.id}`;
      const middleware = cacheMiddleware('short', keyGen);
      const req = {
        method: 'GET',
        params: { id: '123' }
      };
      const res = {
        json: jest.fn(function(data) {
          const cachedData = caches.short.get('custom-123');
          expect(cachedData).toEqual(data);
          done();
        }),
        setHeader: jest.fn()
      };

      middleware(req, res, () => {
        res.json({ id: '123' });
      });
    });
  });

  describe('clearCache', () => {
    beforeEach(() => {
      // Add some test data to caches
      caches.short.set('test1', 'data1');
      caches.medium.set('test2', 'data2');
      caches.long.set('test3', 'data3');
    });

    it('should clear all caches when no pattern provided', () => {
      const result = clearCache();
      expect(result.message).toBe('Cache cleared');
      expect(caches.short.keys().length).toBe(0);
      expect(caches.medium.keys().length).toBe(0);
      expect(caches.long.keys().length).toBe(0);
    });

    it('should clear specific cache duration', () => {
      clearCache(null, 'short');
      expect(caches.short.keys().length).toBe(0);
      expect(caches.medium.keys().length).toBe(1);
      expect(caches.long.keys().length).toBe(1);
    });

    it('should clear entries matching pattern', () => {
      caches.short.set('player:magnus', 'data');
      caches.short.set('player:hikaru', 'data');
      caches.short.set('game:123', 'data');

      const result = clearCache('player');
      expect(result.message).toContain('2');
      expect(caches.short.get('game:123')).toBeDefined();
      expect(caches.short.get('player:magnus')).toBeUndefined();
    });
  });

  describe('getCacheStats', () => {
    it('should return statistics for all cache levels', () => {
      caches.short.set('key1', 'value1');
      caches.medium.set('key2', 'value2');
      
      const stats = getCacheStats();
      
      expect(stats).toHaveProperty('short');
      expect(stats).toHaveProperty('medium');
      expect(stats).toHaveProperty('long');
      expect(stats).toHaveProperty('daily');
      
      expect(stats.short.entries).toBe(1);
      expect(stats.medium.entries).toBe(1);
      expect(stats.long.entries).toBe(0);
    });
  });
});