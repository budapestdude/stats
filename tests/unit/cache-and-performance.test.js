const NodeCache = require('node-cache');

describe('Cache and Performance Tests', () => {
  describe('NodeCache Implementation', () => {
    let cache;

    beforeEach(() => {
      cache = new NodeCache({ stdTTL: 100, checkperiod: 120 });
    });

    afterEach(() => {
      cache.flushAll();
    });

    it('should store and retrieve values', () => {
      const key = 'test-key';
      const value = { data: 'test-value' };
      
      cache.set(key, value);
      const retrieved = cache.get(key);
      
      expect(retrieved).toEqual(value);
    });

    it('should handle cache expiration', (done) => {
      const cache = new NodeCache({ stdTTL: 0.1 }); // 100ms TTL
      cache.set('expire-key', 'value');
      
      expect(cache.get('expire-key')).toBe('value');
      
      setTimeout(() => {
        expect(cache.get('expire-key')).toBeUndefined();
        done();
      }, 150);
    });

    it('should handle multiple values', () => {
      const values = {
        key1: 'value1',
        key2: 'value2',
        key3: 'value3'
      };
      
      cache.mset(Object.entries(values).map(([k, v]) => ({ key: k, val: v })));
      
      const retrieved = cache.mget(['key1', 'key2', 'key3']);
      expect(retrieved).toEqual(values);
    });

    it('should track cache statistics', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // hit
      cache.get('key2'); // miss
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should delete cached values', () => {
      cache.set('delete-key', 'value');
      expect(cache.has('delete-key')).toBe(true);
      
      cache.del('delete-key');
      expect(cache.has('delete-key')).toBe(false);
    });

    it('should flush all cache', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.flushAll();
      
      expect(cache.keys()).toHaveLength(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should measure function execution time', () => {
      const measureTime = (fn) => {
        const start = process.hrtime.bigint();
        fn();
        const end = process.hrtime.bigint();
        return Number(end - start) / 1000000; // Convert to milliseconds
      };

      const slowFunction = () => {
        let sum = 0;
        for (let i = 0; i < 1000000; i++) {
          sum += i;
        }
        return sum;
      };

      const executionTime = measureTime(slowFunction);
      expect(executionTime).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should track memory usage', () => {
      const getMemoryUsage = () => {
        const usage = process.memoryUsage();
        return {
          heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
          rss: Math.round(usage.rss / 1024 / 1024) // MB
        };
      };

      const memoryBefore = getMemoryUsage();
      
      // Allocate some memory
      const bigArray = new Array(1000000).fill('test');
      
      const memoryAfter = getMemoryUsage();
      
      expect(memoryAfter.heapUsed).toBeGreaterThanOrEqual(memoryBefore.heapUsed);
    });

    it('should implement request throttling', (done) => {
      const throttle = (fn, limit) => {
        let inThrottle;
        return function() {
          const args = arguments;
          const context = this;
          if (!inThrottle) {
            fn.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
          }
        };
      };

      let callCount = 0;
      const throttledFn = throttle(() => callCount++, 100);

      // Call multiple times rapidly
      throttledFn();
      throttledFn();
      throttledFn();
      throttledFn();

      expect(callCount).toBe(1); // Only first call executes

      setTimeout(() => {
        throttledFn();
        expect(callCount).toBe(2); // Second call after throttle period
        done();
      }, 150);
    });

    it('should implement request debouncing', (done) => {
      const debounce = (fn, delay) => {
        let timeoutId;
        return function() {
          const args = arguments;
          const context = this;
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => fn.apply(context, args), delay);
        };
      };

      let callCount = 0;
      const debouncedFn = debounce(() => callCount++, 100);

      // Call multiple times rapidly
      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(callCount).toBe(0); // No calls yet

      setTimeout(() => {
        expect(callCount).toBe(1); // Only one call after delay
        done();
      }, 150);
    });
  });

  describe('Query Result Caching', () => {
    it('should cache database query results', () => {
      const queryCache = new Map();
      
      const executeQuery = (query) => {
        if (queryCache.has(query)) {
          return { data: queryCache.get(query), cached: true };
        }
        
        const result = `Result for: ${query}`;
        queryCache.set(query, result);
        return { data: result, cached: false };
      };

      const result1 = executeQuery('SELECT * FROM games');
      expect(result1.cached).toBe(false);

      const result2 = executeQuery('SELECT * FROM games');
      expect(result2.cached).toBe(true);
      expect(result2.data).toBe(result1.data);
    });

    it('should invalidate cache on data changes', () => {
      const cache = new Map();
      
      const getPlayers = () => {
        if (cache.has('players')) {
          return cache.get('players');
        }
        const players = ['player1', 'player2'];
        cache.set('players', players);
        return players;
      };

      const updatePlayer = () => {
        // Invalidate cache on update
        cache.delete('players');
      };

      const players1 = getPlayers();
      expect(cache.has('players')).toBe(true);

      updatePlayer();
      expect(cache.has('players')).toBe(false);
    });

    it('should implement LRU cache', () => {
      class LRUCache {
        constructor(capacity) {
          this.capacity = capacity;
          this.cache = new Map();
        }

        get(key) {
          if (!this.cache.has(key)) return undefined;
          
          const value = this.cache.get(key);
          this.cache.delete(key);
          this.cache.set(key, value); // Move to end
          return value;
        }

        set(key, value) {
          if (this.cache.has(key)) {
            this.cache.delete(key);
          } else if (this.cache.size >= this.capacity) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey); // Remove least recently used
          }
          this.cache.set(key, value);
        }
      }

      const lru = new LRUCache(3);
      lru.set('a', 1);
      lru.set('b', 2);
      lru.set('c', 3);
      
      expect(lru.get('a')).toBe(1); // Access 'a'
      
      lru.set('d', 4); // This should evict 'b'
      
      expect(lru.get('b')).toBeUndefined(); // 'b' was evicted
      expect(lru.get('c')).toBe(3);
      expect(lru.get('d')).toBe(4);
    });
  });

  describe('Connection Pooling', () => {
    it('should manage connection pool', () => {
      class ConnectionPool {
        constructor(maxSize) {
          this.maxSize = maxSize;
          this.connections = [];
          this.available = [];
          this.inUse = new Set();
        }

        async getConnection() {
          if (this.available.length > 0) {
            const conn = this.available.pop();
            this.inUse.add(conn);
            return conn;
          }

          if (this.connections.length < this.maxSize) {
            const conn = { id: this.connections.length + 1 };
            this.connections.push(conn);
            this.inUse.add(conn);
            return conn;
          }

          throw new Error('No connections available');
        }

        releaseConnection(conn) {
          this.inUse.delete(conn);
          this.available.push(conn);
        }

        getStats() {
          return {
            total: this.connections.length,
            inUse: this.inUse.size,
            available: this.available.length
          };
        }
      }

      const pool = new ConnectionPool(3);
      
      const conn1 = pool.getConnection();
      const conn2 = pool.getConnection();
      
      let stats = pool.getStats();
      expect(stats.total).toBe(2);
      expect(stats.inUse).toBe(2);
      expect(stats.available).toBe(0);

      pool.releaseConnection(conn1);
      
      stats = pool.getStats();
      expect(stats.inUse).toBe(1);
      expect(stats.available).toBe(1);
    });
  });

  describe('Rate Limiting', () => {
    it('should implement token bucket algorithm', () => {
      class TokenBucket {
        constructor(capacity, refillRate) {
          this.capacity = capacity;
          this.tokens = capacity;
          this.refillRate = refillRate;
          this.lastRefill = Date.now();
        }

        consume(tokens = 1) {
          this.refill();
          
          if (this.tokens >= tokens) {
            this.tokens -= tokens;
            return true;
          }
          return false;
        }

        refill() {
          const now = Date.now();
          const timePassed = (now - this.lastRefill) / 1000;
          const tokensToAdd = timePassed * this.refillRate;
          
          this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
          this.lastRefill = now;
        }
      }

      const bucket = new TokenBucket(10, 1); // 10 tokens, 1 per second
      
      // Consume 5 tokens
      expect(bucket.consume(5)).toBe(true);
      expect(bucket.tokens).toBe(5);
      
      // Try to consume 6 more (should fail)
      expect(bucket.consume(6)).toBe(false);
      
      // Consume remaining 5
      expect(bucket.consume(5)).toBe(true);
      expect(bucket.tokens).toBe(0);
    });

    it('should implement sliding window rate limiter', () => {
      class SlidingWindowRateLimiter {
        constructor(windowSize, maxRequests) {
          this.windowSize = windowSize; // in milliseconds
          this.maxRequests = maxRequests;
          this.requests = [];
        }

        allowRequest() {
          const now = Date.now();
          const windowStart = now - this.windowSize;
          
          // Remove old requests outside the window
          this.requests = this.requests.filter(time => time > windowStart);
          
          if (this.requests.length < this.maxRequests) {
            this.requests.push(now);
            return true;
          }
          return false;
        }
      }

      const limiter = new SlidingWindowRateLimiter(1000, 3); // 3 requests per second
      
      expect(limiter.allowRequest()).toBe(true);
      expect(limiter.allowRequest()).toBe(true);
      expect(limiter.allowRequest()).toBe(true);
      expect(limiter.allowRequest()).toBe(false); // 4th request blocked
    });
  });

  describe('Metrics Collection', () => {
    it('should collect response time metrics', () => {
      class MetricsCollector {
        constructor() {
          this.metrics = [];
        }

        recordResponseTime(endpoint, duration) {
          this.metrics.push({ endpoint, duration, timestamp: Date.now() });
        }

        getStats(endpoint) {
          const endpointMetrics = this.metrics.filter(m => m.endpoint === endpoint);
          if (endpointMetrics.length === 0) return null;

          const durations = endpointMetrics.map(m => m.duration);
          return {
            count: durations.length,
            avg: durations.reduce((a, b) => a + b) / durations.length,
            min: Math.min(...durations),
            max: Math.max(...durations),
            p95: this.percentile(durations, 0.95)
          };
        }

        percentile(arr, p) {
          const sorted = arr.slice().sort((a, b) => a - b);
          const index = Math.ceil(sorted.length * p) - 1;
          return sorted[index];
        }
      }

      const metrics = new MetricsCollector();
      
      metrics.recordResponseTime('/api/players', 120);
      metrics.recordResponseTime('/api/players', 150);
      metrics.recordResponseTime('/api/players', 130);
      metrics.recordResponseTime('/api/players', 180);
      metrics.recordResponseTime('/api/players', 140);

      const stats = metrics.getStats('/api/players');
      expect(stats.count).toBe(5);
      expect(stats.avg).toBe(144);
      expect(stats.min).toBe(120);
      expect(stats.max).toBe(180);
      expect(stats.p95).toBe(180);
    });
  });
});