const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const mongoSanitize = require('express-mongo-sanitize');
const config = require('../config');
const logger = require('../utils/logger');

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = config.security.corsOrigins;
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin) || 
        allowedOrigins.includes('*') ||
        (config.app.isDevelopment && origin.includes('localhost'))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'X-Current-Page', 'X-Rate-Limit-Remaining'],
};

// Rate limiting configurations
const createRateLimiter = (options = {}) => {
  const defaults = {
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
      });
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: options.message || 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000),
      });
    },
  };

  return rateLimit({ ...defaults, ...options });
};

// Create different rate limiters for different endpoints
const generalLimiter = createRateLimiter();

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
});

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'API rate limit exceeded, please slow down your requests.',
});

const strictLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 requests per hour
  message: 'Strict rate limit exceeded for this endpoint.',
});

// Redis-based rate limiter for distributed systems
const createRedisRateLimiter = (options = {}) => {
  if (!config.redis.host) {
    logger.warn('Redis not configured, falling back to memory store for rate limiting');
    return createRateLimiter(options);
  }

  try {
    const RedisClient = require('../services/redis');
    
    return rateLimit({
      store: new RedisStore({
        client: RedisClient,
        prefix: 'rl:',
      }),
      windowMs: options.windowMs || config.rateLimit.windowMs,
      max: options.max || config.rateLimit.maxRequests,
      message: options.message || 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
  } catch (error) {
    logger.error('Failed to create Redis rate limiter', error);
    return createRateLimiter(options);
  }
};

// Helmet configuration for security headers
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'",
        "https://api.chess.com",
        "https://lichess.org",
        "wss://lichess.org",
        config.app.url,
        config.frontend.url,
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
    },
    reportOnly: config.app.isDevelopment,
  },
  crossOriginEmbedderPolicy: !config.app.isDevelopment,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: true },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
});

// Custom security middleware
const securityMiddleware = (req, res, next) => {
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Add request ID for tracing
  req.id = require('crypto').randomBytes(16).toString('hex');
  res.setHeader('X-Request-ID', req.id);
  
  // Log security events
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    logger.debug('Security middleware processing request', {
      id: req.id,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }
  
  next();
};

// IP filtering middleware
const ipFilter = (allowedIPs = []) => {
  return (req, res, next) => {
    if (allowedIPs.length === 0) return next();
    
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!allowedIPs.includes(clientIP)) {
      logger.warn('Blocked request from unauthorized IP', { 
        ip: clientIP,
        path: req.path,
      });
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Access denied from your IP address',
      });
    }
    
    next();
  };
};

// API key validation middleware
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'API key required',
    });
  }
  
  // In production, validate against database or secure storage
  // This is a placeholder implementation
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    logger.warn('Invalid API key attempt', { 
      ip: req.ip,
      path: req.path,
    });
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
  }
  
  next();
};

// Request size limiting
const requestSizeLimiter = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = req.headers['content-length'];
    const maxBytes = parseSize(maxSize);
    
    if (contentLength && parseInt(contentLength) > maxBytes) {
      return res.status(413).json({ 
        error: 'Payload too large',
        message: `Request body must not exceed ${maxSize}`,
      });
    }
    
    next();
  };
};

// Helper function to parse size strings
const parseSize = (size) => {
  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };
  
  const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)$/);
  if (!match) return 10 * 1024 * 1024; // Default 10MB
  
  return parseInt(match[1]) * units[match[2]];
};

// Security event logger
const logSecurityEvent = (event, details = {}) => {
  logger.warn(`Security Event: ${event}`, {
    ...details,
    timestamp: new Date().toISOString(),
  });
};

// CSRF protection (for forms)
const csrfProtection = (req, res, next) => {
  // Skip CSRF for API routes (they use JWT)
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // Implement CSRF token validation for form submissions
  const token = req.body._csrf || req.query._csrf || req.headers['x-csrf-token'];
  
  if (!token || !validateCSRFToken(token, req.session)) {
    return res.status(403).json({ 
      error: 'Invalid CSRF token',
      message: 'Form submission rejected',
    });
  }
  
  next();
};

// CSRF token validation (placeholder)
const validateCSRFToken = (token, session) => {
  // In production, implement proper CSRF token validation
  return true;
};

// Apply all security middleware
const applySecurity = (app) => {
  // Basic security headers
  app.use(helmetConfig);
  
  // CORS
  app.use(cors(corsOptions));
  
  // Custom security middleware
  app.use(securityMiddleware);
  
  // Request sanitization
  app.use(mongoSanitize({
    allowDots: true,
    replaceWith: '_',
  }));
  
  // Rate limiting - apply to all routes
  app.use('/api/', apiLimiter);
  app.use('/auth/', authLimiter);
  
  logger.info('Security middleware applied successfully');
};

module.exports = {
  corsOptions,
  helmetConfig,
  securityMiddleware,
  createRateLimiter,
  createRedisRateLimiter,
  generalLimiter,
  authLimiter,
  apiLimiter,
  strictLimiter,
  ipFilter,
  apiKeyAuth,
  requestSizeLimiter,
  csrfProtection,
  logSecurityEvent,
  applySecurity,
};