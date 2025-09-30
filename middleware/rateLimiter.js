const rateLimit = require('express-rate-limit');
const { RateLimitError } = require('./errorHandler');

// Create different rate limiters for different endpoints
const createRateLimiter = (options = {}) => {
  const defaults = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      throw new RateLimitError('Too many requests, please try again later');
    }
  };

  return rateLimit({ ...defaults, ...options });
};

// General API rate limiter
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many API requests, please try again later'
});

// Strict rate limiter for search endpoints
const searchLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 searches per minute
  message: 'Too many search requests, please try again later',
  skipSuccessfulRequests: false
});

// Lenient rate limiter for static data
const staticLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200, // More lenient for static data
  message: 'Too many requests for static data'
});

// Very strict rate limiter for database-heavy operations
const databaseLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000,
  max: 10, // Only 10 heavy queries per minute
  message: 'Too many database requests, please wait a moment',
  skipFailedRequests: true
});

// External API rate limiter (Chess.com/Lichess)
const externalAPILimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000,
  max: 30, // Respect external API limits
  message: 'Too many external API requests'
});

module.exports = {
  apiLimiter,
  searchLimiter,
  staticLimiter,
  databaseLimiter,
  externalAPILimiter,
  createRateLimiter
};