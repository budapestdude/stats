const Redis = require('ioredis');
const NodeCache = require('node-cache');

// Cache configuration from environment
const CACHE_TYPE = process.env.CACHE_TYPE || 'memory'; // 'redis' or 'memory'
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

// TTL settings (in seconds)
const DEFAULT_TTL = 300; // 5 minutes
const TTL_CONFIG = {
  player: parseInt(process.env.CACHE_TTL_PLAYER) || 3600,      // 1 hour
  games: parseInt(process.env.CACHE_TTL_GAMES) || 1800,        // 30 minutes
  stats: parseInt(process.env.CACHE_TTL_STATS) || 7200,        // 2 hours
  openings: parseInt(process.env.CACHE_TTL_OPENINGS) || 86400, // 24 hours
  tournaments: parseInt(process.env.CACHE_TTL_TOURNAMENTS) || 1800, // 30 minutes
  search: parseInt(process.env.CACHE_TTL_SEARCH) || 600,       // 10 minutes
};

// Cache statistics
const cacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  writes: 0,
  deletes: 0,
  startTime: Date.now()
};

// Initialize cache based on configuration
let cache;
let cacheAvailable = false;

if (CACHE_TYPE === 'redis') {
  // Try Redis connection
  try {
    const redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      retryStrategy: (times) => {
        if (times > 3) {
          console.log('⚠️  Redis connection failed, falling back to memory cache');
          initMemoryCache();
          return null;
        }
        return Math.min(times * 100, 2000);
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false
    });

    redis.on('connect', () => {
      console.log('✅ Connected to Redis cache');
      console.log(`   Host: ${REDIS_HOST}:${REDIS_PORT}`);
      cacheAvailable = true;
    });

    redis.on('error', (err) => {
      console.error('Redis cache error:', err.message);
      cacheStats.errors++;
      if (!cacheAvailable) {
        initMemoryCache();
      }
    });

    cache = {
      get: async (key) => {
        try {
          const value = await redis.get(key);
          return value ? JSON.parse(value) : null;
        } catch (err) {
          cacheStats.errors++;
          return null;
        }
      },
      set: async (key, value, ttl = DEFAULT_TTL) => {
        try {
          await redis.set(key, JSON.stringify(value), 'EX', ttl);
          cacheStats.writes++;
          return true;
        } catch (err) {
          cacheStats.errors++;
          return false;
        }
      },
      del: async (key) => {
        try {
          await redis.del(key);
          cacheStats.deletes++;
          return true;
        } catch (err) {
          cacheStats.errors++;
          return false;
        }
      },
      flush: async () => {
        try {
          await redis.flushdb();
          return true;
        } catch (err) {
          return false;
        }
      },
      keys: async (pattern) => {
        try {
          return await redis.keys(pattern);
        } catch (err) {
          return [];
        }
      }
    };
  } catch (err) {
    console.log('Redis not available, using memory cache');
    initMemoryCache();
  }
} else {
  initMemoryCache();
}

function initMemoryCache() {
  const memCache = new NodeCache({
    stdTTL: DEFAULT_TTL,
    checkperiod: 120,
    useClones: false,
    deleteOnExpire: true,
    maxKeys: 10000 // Limit memory usage
  });

  memCache.on('set', () => cacheStats.writes++);
  memCache.on('del', () => cacheStats.deletes++);
  memCache.on('expired', () => cacheStats.deletes++);

  cache = {
    get: async (key) => {
      try {
        const value = memCache.get(key);
        return value === undefined ? null : value;
      } catch (err) {
        cacheStats.errors++;
        return null;
      }
    },
    set: async (key, value, ttl = DEFAULT_TTL) => {
      try {
        memCache.set(key, value, ttl);
        return true;
      } catch (err) {
        cacheStats.errors++;
        return false;
      }
    },
    del: async (key) => {
      try {
        memCache.del(key);
        return true;
      } catch (err) {
        cacheStats.errors++;
        return false;
      }
    },
    flush: async () => {
      memCache.flushAll();
      return true;
    },
    keys: async (pattern) => {
      const allKeys = memCache.keys();
      const regex = new RegExp(pattern.replace('*', '.*'));
      return allKeys.filter(key => regex.test(key));
    }
  };

  console.log('✅ Using in-memory cache');
  cacheAvailable = true;
}

// Generate cache key
function getCacheKey(req) {
  const { originalUrl, method } = req;
  return `cache:${method}:${originalUrl}`;
}

// Determine TTL based on route
function getTTL(path) {
  if (path.includes('/players')) return TTL_CONFIG.player;
  if (path.includes('/games')) return TTL_CONFIG.games;
  if (path.includes('/stats')) return TTL_CONFIG.stats;
  if (path.includes('/openings')) return TTL_CONFIG.openings;
  if (path.includes('/tournaments')) return TTL_CONFIG.tournaments;
  if (path.includes('/search')) return TTL_CONFIG.search;
  return DEFAULT_TTL;
}

// Cache middleware
function cacheMiddleware(options = {}) {
  const {
    ttl: customTTL,
    keyGenerator = getCacheKey,
    condition = () => true,
    excludePaths = ['/health', '/api/test']
  } = options;

  return async (req, res, next) => {
    // Skip caching for excluded paths
    if (excludePaths.some(path => req.path === path || req.path.startsWith(path))) {
      return next();
    }

    // Skip caching if condition not met
    if (!condition(req)) {
      return next();
    }

    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = keyGenerator(req);
    const ttl = customTTL || getTTL(req.path);

    try {
      // Try to get from cache
      const cached = await cache.get(key);
      
      if (cached) {
        cacheStats.hits++;
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-TTL', ttl);
        return res.json(cached);
      }

      cacheStats.misses++;
      res.setHeader('X-Cache', 'MISS');

      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache response
      res.json = function(data) {
        // Restore original method
        res.json = originalJson;
        
        // Cache successful responses only
        if (res.statusCode === 200) {
          cache.set(key, data, ttl).catch(err => {
            console.error('Cache write error:', err);
          });
        }
        
        return originalJson.call(this, data);
      };

      next();
    } catch (err) {
      console.error('Cache middleware error:', err);
      cacheStats.errors++;
      next();
    }
  };
}

// Cache invalidation helpers
async function invalidatePattern(pattern) {
  try {
    const keys = await cache.keys(pattern);
    const results = await Promise.all(keys.map(key => cache.del(key)));
    return results.filter(r => r).length;
  } catch (err) {
    console.error('Cache invalidation error:', err);
    return 0;
  }
}

async function invalidatePlayer(username) {
  return invalidatePattern(`cache:*:/api/players/${username}*`);
}

async function invalidateTournament(id) {
  return invalidatePattern(`cache:*:/api/tournaments/${id}*`);
}

async function invalidateAll() {
  return cache.flush();
}

// Get cache statistics
function getStats() {
  const uptime = Date.now() - cacheStats.startTime;
  const hitRate = cacheStats.hits + cacheStats.misses > 0 
    ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100).toFixed(2)
    : 0;

  return {
    ...cacheStats,
    uptime: Math.floor(uptime / 1000), // seconds
    hitRate: parseFloat(hitRate),
    type: CACHE_TYPE,
    available: cacheAvailable
  };
}

// Warmup cache with common requests
async function warmupCache(urls = []) {
  const axios = require('axios');
  const results = [];

  const defaultUrls = [
    '/api/stats/overview',
    '/api/players/top',
    '/api/openings/popular',
    '/api/tournaments'
  ];

  const urlsToWarm = [...defaultUrls, ...urls];

  for (const url of urlsToWarm) {
    try {
      const response = await axios.get(`http://localhost:${process.env.PORT || 3007}${url}`);
      results.push({ url, status: 'warmed', cached: true });
    } catch (err) {
      results.push({ url, status: 'failed', error: err.message });
    }
  }

  return results;
}

module.exports = {
  cache,
  cacheMiddleware,
  invalidatePattern,
  invalidatePlayer,
  invalidateTournament,
  invalidateAll,
  getStats,
  warmupCache,
  getCacheKey,
  getTTL
};