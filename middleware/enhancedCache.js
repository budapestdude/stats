const redisService = require('../services/redisService');
const { caches } = require('./cache'); // Fallback to in-memory cache
const { logger } = require('./errorHandler');

class EnhancedCacheMiddleware {
  constructor() {
    this.useRedis = false;
    this.fallbackToMemory = true;
  }

  async initialize() {
    try {
      await redisService.initialize();
      this.useRedis = true;
      logger.info('✅ Enhanced caching using Redis');
    } catch (error) {
      logger.warn('⚠️ Redis unavailable, using in-memory cache:', error.message);
      this.useRedis = false;
    }
  }

  // Main cache middleware factory
  createMiddleware(options = {}) {
    const {
      duration = 'medium', // short, medium, long, daily
      keyGenerator = null,
      ttl = this.getTTLSeconds(duration),
      condition = null // Function to determine if caching should be applied
    } = options;

    return async (req, res, next) => {
      // Skip caching for non-GET requests
      if (req.method !== 'GET') {
        return next();
      }

      // Apply conditional caching if specified
      if (condition && !condition(req)) {
        return next();
      }

      // Generate cache key
      const key = keyGenerator 
        ? keyGenerator(req) 
        : this.generateKey(req, duration);

      try {
        // Try to get from cache
        const cachedData = await this.get(key);

        if (cachedData !== null) {
          // Cache hit
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('X-Cache-Source', this.useRedis ? 'redis' : 'memory');
          res.setHeader('X-Cache-Key', key);
          
          // Add TTL header if using Redis
          if (this.useRedis) {
            const remainingTTL = await this.getTTL(key);
            if (remainingTTL > 0) {
              res.setHeader('X-Cache-TTL', remainingTTL);
            }
          }
          
          return res.json(cachedData);
        }

        // Cache miss - store original json method
        const originalJson = res.json;

        // Override json method to cache the response
        res.json = async (data) => {
          // Add cache miss headers
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('X-Cache-Source', this.useRedis ? 'redis' : 'memory');
          res.setHeader('X-Cache-Key', key);
          
          // Cache the response
          await this.set(key, data, ttl);
          
          // Call original json method
          return originalJson.call(res, data);
        };

        next();
      } catch (error) {
        logger.error('Cache middleware error:', error);
        // Continue without caching on error
        next();
      }
    };
  }

  // Cache operations
  async get(key) {
    if (this.useRedis) {
      return await redisService.get(key);
    } else {
      // Use in-memory cache as fallback
      const cache = this.getMemoryCache('medium'); // Default to medium cache
      return cache.get(key) || null;
    }
  }

  async set(key, value, ttlSeconds = 3600) {
    if (this.useRedis) {
      return await redisService.set(key, value, ttlSeconds);
    } else {
      // Use in-memory cache as fallback
      const cache = this.getMemoryCache('medium');
      cache.set(key, value);
      return true;
    }
  }

  async del(key) {
    if (this.useRedis) {
      return await redisService.del(key);
    } else {
      const cache = this.getMemoryCache('medium');
      cache.del(key);
      return true;
    }
  }

  async clear(pattern = '*') {
    if (this.useRedis) {
      return await redisService.deletePattern(pattern);
    } else {
      // Clear all in-memory caches
      Object.values(caches).forEach(cache => {
        if (pattern === '*') {
          cache.flushAll();
        } else {
          // Simple pattern matching for in-memory cache
          const keys = cache.keys();
          keys.forEach(key => {
            if (key.includes(pattern)) {
              cache.del(key);
            }
          });
        }
      });
      return true;
    }
  }

  async getTTL(key) {
    if (this.useRedis) {
      try {
        return await redisService.client.ttl(key);
      } catch {
        return -1;
      }
    } else {
      const cache = this.getMemoryCache('medium');
      return cache.getTtl(key) || -1;
    }
  }

  // Utility methods
  generateKey(req, duration) {
    const base = req.originalUrl || req.url;
    const query = req.query ? JSON.stringify(req.query) : '';
    const user = req.user?.id || 'anonymous';
    
    // Create a hash for long keys
    if (base.length + query.length > 200) {
      const crypto = require('crypto');
      const hash = crypto.createHash('md5').update(base + query + user).digest('hex');
      return `${duration}:${hash}`;
    }
    
    return `${duration}:${user}:${base}:${query}`;
  }

  getTTLSeconds(duration) {
    const ttls = {
      short: 60,     // 1 minute
      medium: 300,   // 5 minutes
      long: 3600,    // 1 hour
      daily: 86400   // 24 hours
    };
    
    return ttls[duration] || ttls.medium;
  }

  getMemoryCache(duration) {
    return caches[duration] || caches.medium;
  }

  // Specific cache strategies
  playerCache(options = {}) {
    return this.createMiddleware({
      duration: 'long',
      ttl: 3600, // 1 hour for player data
      keyGenerator: (req) => `player:${req.params.username || req.params.id}`,
      ...options
    });
  }

  searchCache(options = {}) {
    return this.createMiddleware({
      duration: 'short',
      ttl: 300, // 5 minutes for search results
      keyGenerator: (req) => `search:${req.query.q}:${JSON.stringify(req.query)}`,
      condition: (req) => req.query.q && req.query.q.length >= 2,
      ...options
    });
  }

  statsCache(options = {}) {
    return this.createMiddleware({
      duration: 'long',
      ttl: 1800, // 30 minutes for stats
      keyGenerator: (req) => `stats:${req.path}`,
      ...options
    });
  }

  tournamentCache(options = {}) {
    return this.createMiddleware({
      duration: 'medium',
      ttl: 600, // 10 minutes for tournament data
      keyGenerator: (req) => `tournament:${req.params.id || 'list'}:${JSON.stringify(req.query)}`,
      ...options
    });
  }

  openingCache(options = {}) {
    return this.createMiddleware({
      duration: 'daily',
      ttl: 86400, // 24 hours for opening data (rarely changes)
      keyGenerator: (req) => `opening:${req.params.eco || req.query.fen || 'popular'}`,
      ...options
    });
  }

  gameCache(options = {}) {
    return this.createMiddleware({
      duration: 'long',
      ttl: 7200, // 2 hours for game data
      keyGenerator: (req) => `game:${JSON.stringify(req.query)}`,
      ...options
    });
  }

  // Cache warming - preload frequently accessed data
  async warmCache() {
    if (!this.useRedis) {
      logger.info('Skipping cache warming (not using Redis)');
      return;
    }

    logger.info('🔥 Starting cache warming...');
    
    try {
      // Warm up popular openings
      await this.warmPopularOpenings();
      
      // Warm up stats overview
      await this.warmStatsOverview();
      
      logger.info('✅ Cache warming completed');
    } catch (error) {
      logger.error('Cache warming failed:', error);
    }
  }

  async warmPopularOpenings() {
    try {
      // Mock warming - in production, fetch actual data
      const popularOpenings = [
        { eco: 'B12', name: 'Caro-Kann Defense' },
        { eco: 'C45', name: 'Scotch Game' },
        { eco: 'E60', name: "King's Indian Defense" }
      ];
      
      await this.set('opening:popular', popularOpenings, 86400);
      logger.info('🔥 Warmed popular openings cache');
    } catch (error) {
      logger.error('Failed to warm popular openings:', error);
    }
  }

  async warmStatsOverview() {
    try {
      const stats = {
        totalGames: 9160700,
        totalPlayers: 442516,
        totalTournaments: 18254,
        timestamp: new Date().toISOString()
      };
      
      await this.set('stats:overview', stats, 1800);
      logger.info('🔥 Warmed stats overview cache');
    } catch (error) {
      logger.error('Failed to warm stats overview:', error);
    }
  }

  // Get cache statistics
  async getStats() {
    const stats = {
      enabled: this.useRedis ? 'redis' : 'memory',
      redis: this.useRedis
    };

    if (this.useRedis) {
      const redisStats = await redisService.getStats();
      stats.redis = redisStats;
    } else {
      // Get in-memory cache stats
      stats.memory = {};
      for (const [name, cache] of Object.entries(caches)) {
        const keys = cache.keys();
        stats.memory[name] = {
          entries: keys.length,
          hits: cache.getStats().hits,
          misses: cache.getStats().misses
        };
      }
    }

    return stats;
  }
}

// Export singleton instance
const enhancedCache = new EnhancedCacheMiddleware();
module.exports = enhancedCache;