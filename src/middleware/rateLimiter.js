const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const PQueue = require('p-queue').default;

// Rate limiting configuration
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 15; // minutes
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

// External API rate limits
const API_LIMITS = {
  chesscom: {
    requests: 100,  // Chess.com allows 100 requests per minute
    window: 60,     // seconds
    concurrent: 5   // Max concurrent requests
  },
  lichess: {
    requests: 20,   // Lichess allows 20 requests per second
    window: 1,      // seconds
    concurrent: 10  // Max concurrent requests
  }
};

// Queue for external API requests
const apiQueues = {
  chesscom: new PQueue({ 
    concurrency: API_LIMITS.chesscom.concurrent,
    interval: API_LIMITS.chesscom.window * 1000,
    intervalCap: API_LIMITS.chesscom.requests
  }),
  lichess: new PQueue({ 
    concurrency: API_LIMITS.lichess.concurrent,
    interval: API_LIMITS.lichess.window * 1000,
    intervalCap: API_LIMITS.lichess.requests
  })
};

// Statistics tracking
const rateLimitStats = {
  blocked: 0,
  passed: 0,
  queued: 0,
  apiCalls: {
    chesscom: { success: 0, failed: 0, queued: 0 },
    lichess: { success: 0, failed: 0, queued: 0 }
  }
};

// Create Redis client for rate limiting
let redisClient;
let useRedisStore = false;

if (process.env.REDIS_HOST) {
  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || '',
      enableOfflineQueue: false
    });

    redisClient.on('connect', () => {
      console.log('✅ Rate limiter connected to Redis');
      useRedisStore = true;
    });

    redisClient.on('error', (err) => {
      console.error('Rate limiter Redis error:', err.message);
      useRedisStore = false;
    });
  } catch (err) {
    console.log('Rate limiter using memory store');
  }
}

// Create rate limiter middleware
function createRateLimiter(options = {}) {
  const config = {
    windowMs: (options.windowMinutes || RATE_LIMIT_WINDOW) * 60 * 1000,
    max: options.max || RATE_LIMIT_MAX,
    message: options.message || 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      rateLimitStats.blocked++;
      res.status(429).json({
        error: 'Too many requests',
        message: config.message,
        retryAfter: Math.ceil(config.windowMs / 1000),
        limit: config.max
      });
    },
    skip: (req) => {
      // Skip rate limiting for health checks only
      return req.path === '/health';
    }
  };

  // Use Redis store if available
  if (useRedisStore && redisClient) {
    config.store = new RedisStore({
      client: redisClient,
      prefix: 'rate-limit:',
    });
  }

  const limiter = rateLimit(config);

  // Wrap to track statistics
  return (req, res, next) => {
    limiter(req, res, (err) => {
      if (!err) {
        rateLimitStats.passed++;
      }
      next(err);
    });
  };
}

// Different rate limits for different routes
const rateLimiters = {
  // General API rate limit
  general: createRateLimiter({
    windowMinutes: 15,
    max: 100,
    message: 'Too many API requests'
  }),

  // Stricter limit for search
  search: createRateLimiter({
    windowMinutes: 1,
    max: 20,
    message: 'Too many search requests'
  }),

  // Very strict for data export
  export: createRateLimiter({
    windowMinutes: 60,
    max: 10,
    message: 'Export limit exceeded'
  }),

  // Lenient for static content
  static: createRateLimiter({
    windowMinutes: 15,
    max: 500,
    message: 'Too many requests for static content'
  })
};

// Queue external API requests
async function queueApiRequest(apiType, requestFn, options = {}) {
  const queue = apiQueues[apiType];
  
  if (!queue) {
    throw new Error(`Unknown API type: ${apiType}`);
  }

  rateLimitStats.apiCalls[apiType].queued++;
  rateLimitStats.queued++;

  try {
    const result = await queue.add(async () => {
      const startTime = Date.now();
      
      try {
        const response = await requestFn();
        
        rateLimitStats.apiCalls[apiType].success++;
        
        // Log slow requests
        const duration = Date.now() - startTime;
        if (duration > 5000) {
          console.warn(`Slow ${apiType} API request: ${duration}ms`);
        }
        
        return response;
      } catch (err) {
        rateLimitStats.apiCalls[apiType].failed++;
        
        // Handle rate limit errors
        if (err.response?.status === 429) {
          const retryAfter = err.response.headers['retry-after'] || 60;
          console.warn(`${apiType} rate limit hit, retry after ${retryAfter}s`);
          
          // Pause the queue
          queue.pause();
          setTimeout(() => queue.start(), retryAfter * 1000);
        }
        
        throw err;
      }
    }, options);

    return result;
  } catch (err) {
    throw err;
  }
}

// Middleware to add rate limit info to response headers
function rateLimitInfo(req, res, next) {
  const remaining = res.getHeader('X-RateLimit-Remaining');
  const limit = res.getHeader('X-RateLimit-Limit');
  
  if (remaining !== undefined && limit !== undefined) {
    const used = limit - remaining;
    const percentage = (used / limit * 100).toFixed(1);
    
    res.setHeader('X-RateLimit-Used', used);
    res.setHeader('X-RateLimit-Percentage', percentage);
  }
  
  next();
}

// Get rate limit statistics
function getStats() {
  const queueStats = {};
  
  for (const [api, queue] of Object.entries(apiQueues)) {
    queueStats[api] = {
      size: queue.size,
      pending: queue.pending,
      isPaused: queue.isPaused
    };
  }
  
  return {
    ...rateLimitStats,
    queues: queueStats,
    redisConnected: useRedisStore
  };
}

// Reset statistics
function resetStats() {
  rateLimitStats.blocked = 0;
  rateLimitStats.passed = 0;
  rateLimitStats.queued = 0;
  
  for (const api of Object.keys(rateLimitStats.apiCalls)) {
    rateLimitStats.apiCalls[api] = { success: 0, failed: 0, queued: 0 };
  }
}

// Middleware to protect against brute force
function bruteForcePrevention(options = {}) {
  const maxAttempts = options.maxAttempts || 5;
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
  const blockDuration = options.blockDuration || 60 * 60 * 1000; // 1 hour
  
  const attempts = new Map();
  
  return (req, res, next) => {
    const key = req.ip + ':' + req.path;
    const now = Date.now();
    
    // Clean old entries
    for (const [k, v] of attempts.entries()) {
      if (now - v.firstAttempt > windowMs) {
        attempts.delete(k);
      }
    }
    
    const record = attempts.get(key) || { count: 0, firstAttempt: now, blocked: false };
    
    if (record.blocked && now - record.blockedAt < blockDuration) {
      return res.status(429).json({
        error: 'Too many failed attempts',
        retryAfter: Math.ceil((blockDuration - (now - record.blockedAt)) / 1000)
      });
    }
    
    // Track failed attempts (you need to set req.failed = true in your auth logic)
    const originalJson = res.json;
    res.json = function(data) {
      if (res.statusCode === 401 || res.statusCode === 403) {
        record.count++;
        
        if (record.count >= maxAttempts) {
          record.blocked = true;
          record.blockedAt = now;
        }
        
        attempts.set(key, record);
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
}

// IP-based throttling
function ipThrottle(options = {}) {
  const requests = new Map();
  const maxRequestsPerSecond = options.maxRequestsPerSecond || 10;
  
  return (req, res, next) => {
    const now = Date.now();
    const second = Math.floor(now / 1000);
    const key = `${req.ip}:${second}`;
    
    const count = requests.get(key) || 0;
    
    if (count >= maxRequestsPerSecond) {
      return res.status(429).json({
        error: 'Request rate too high',
        message: 'Please slow down your requests'
      });
    }
    
    requests.set(key, count + 1);
    
    // Clean old entries
    for (const [k] of requests.entries()) {
      const keySecond = parseInt(k.split(':')[1]);
      if (second - keySecond > 5) {
        requests.delete(k);
      }
    }
    
    next();
  };
}

module.exports = {
  createRateLimiter,
  rateLimiters,
  queueApiRequest,
  rateLimitInfo,
  getStats,
  resetStats,
  bruteForcePrevention,
  ipThrottle,
  apiQueues
};