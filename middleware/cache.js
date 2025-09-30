const NodeCache = require('node-cache');

// Create cache instances with different TTLs
const caches = {
  short: new NodeCache({ stdTTL: 60, checkperiod: 120 }), // 1 minute
  medium: new NodeCache({ stdTTL: 300, checkperiod: 600 }), // 5 minutes
  long: new NodeCache({ stdTTL: 3600, checkperiod: 3600 }), // 1 hour
  daily: new NodeCache({ stdTTL: 86400, checkperiod: 86400 }) // 24 hours
};

// Cache middleware factory
const cacheMiddleware = (duration = 'medium', keyGenerator = null) => {
  return (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const key = keyGenerator 
      ? keyGenerator(req) 
      : `${req.originalUrl || req.url}`;

    // Try to get from cache
    const cache = caches[duration] || caches.medium;
    const cachedData = cache.get(key);

    if (cachedData) {
      // Add cache hit header
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-TTL', cache.getTtl(key));
      return res.json(cachedData);
    }

    // Store original json method
    const originalJson = res.json;

    // Override json method to cache the response
    res.json = function(data) {
      // Add cache miss header
      res.setHeader('X-Cache', 'MISS');
      
      // Cache the response
      cache.set(key, data);
      
      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
};

// Clear cache for specific pattern
const clearCache = (pattern = null, duration = null) => {
  if (!pattern) {
    // Clear all caches
    if (duration) {
      caches[duration].flushAll();
    } else {
      Object.values(caches).forEach(cache => cache.flushAll());
    }
    return { message: 'Cache cleared' };
  }

  // Clear specific keys matching pattern
  let cleared = 0;
  const cachesToClear = duration ? [caches[duration]] : Object.values(caches);
  
  cachesToClear.forEach(cache => {
    const keys = cache.keys();
    keys.forEach(key => {
      if (key.includes(pattern)) {
        cache.del(key);
        cleared++;
      }
    });
  });

  return { message: `Cleared ${cleared} cache entries` };
};

// Cache stats
const getCacheStats = () => {
  const stats = {};
  
  for (const [name, cache] of Object.entries(caches)) {
    const keys = cache.keys();
    stats[name] = {
      entries: keys.length,
      hits: cache.getStats().hits,
      misses: cache.getStats().misses,
      hitRate: cache.getStats().hits / (cache.getStats().hits + cache.getStats().misses || 1)
    };
  }
  
  return stats;
};

// Specific cache strategies for different data types
const cacheStrategies = {
  // Player data changes infrequently
  player: cacheMiddleware('long', (req) => `player:${req.params.username || req.params.id}`),
  
  // Top players list updates daily
  topPlayers: cacheMiddleware('daily', (req) => `top:${req.query.category || 'all'}`),
  
  // Search results cached briefly
  search: cacheMiddleware('short', (req) => `search:${req.query.q}`),
  
  // Opening explorer data is static
  openings: cacheMiddleware('daily', (req) => `opening:${req.query.fen || req.params.eco}`),
  
  // Tournament data
  tournaments: cacheMiddleware('medium', (req) => `tournament:${req.params.id || 'list'}`),
  
  // Stats overview
  stats: cacheMiddleware('long', (req) => `stats:${req.path}`),
  
  // Database queries
  database: cacheMiddleware('medium', (req) => `db:${req.originalUrl}`)
};

module.exports = {
  cacheMiddleware,
  clearCache,
  getCacheStats,
  cacheStrategies,
  caches
};