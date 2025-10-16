const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const compression = require('compression');
const cors = require('cors');

/**
 * Production security middleware configuration
 */

// Content Security Policy configuration
const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'", // Remove in production if possible
      'https://cdn.jsdelivr.net',
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com'
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://fonts.googleapis.com',
      'https://cdn.jsdelivr.net'
    ],
    fontSrc: [
      "'self'",
      'https://fonts.gstatic.com',
      'data:'
    ],
    imgSrc: [
      "'self'",
      'data:',
      'https:',
      'blob:'
    ],
    connectSrc: [
      "'self'",
      'https://api.chess.com',
      'https://lichess.org',
      'https://explorer.lichess.ovh',
      'wss://*.chess.com',
      'wss://lichess.org'
    ],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    childSrc: ["'self'"],
    frameSrc: ["'self'"],
    workerSrc: ["'self'", 'blob:'],
    manifestSrc: ["'self'"],
    upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
  }
};

// CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['https://localhost:3000'];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
  maxAge: 86400 // 24 hours
};

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too Many Requests',
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Different rate limiters for different endpoints
const rateLimiters = {
  // General API rate limit
  general: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // limit each IP to 100 requests per windowMs
    'Too many requests from this IP, please try again later.'
  ),
  
  // Strict rate limit for expensive operations
  strict: createRateLimiter(
    15 * 60 * 1000,
    10,
    'Rate limit exceeded for this operation.'
  ),
  
  // Search endpoint rate limit
  search: createRateLimiter(
    60 * 1000, // 1 minute
    20,
    'Too many search requests, please try again later.'
  ),
  
  // External API proxy rate limit
  externalApi: createRateLimiter(
    60 * 1000,
    30,
    'Too many external API requests.'
  )
};

// XSS sanitization middleware
const xssSanitize = (req, res, next) => {
  // Sanitize request body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
      }
    });
  }
  
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key]);
      }
    });
  }
  
  // Sanitize URL parameters
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = xss(req.params[key]);
      }
    });
  }
  
  next();
};

// API Key validation middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  // Skip validation for public endpoints
  const publicEndpoints = ['/health', '/api/test', '/'];
  if (publicEndpoints.includes(req.path)) {
    return next();
  }
  
  // In production, validate API key for certain endpoints
  const protectedEndpoints = ['/api/admin', '/api/internal'];
  const requiresApiKey = protectedEndpoints.some(endpoint => req.path.startsWith(endpoint));
  
  if (requiresApiKey) {
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }
    
    // Validate API key (implement your validation logic)
    const validApiKeys = [
      process.env.API_KEY,
      process.env.ADMIN_API_KEY
    ].filter(Boolean);
    
    if (!validApiKeys.includes(apiKey)) {
      return res.status(403).json({ error: 'Invalid API key' });
    }
  }
  
  next();
};

// Request size limits
const requestSizeLimits = {
  json: '10mb',
  urlencoded: '10mb',
  raw: '20mb'
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Additional security headers not covered by Helmet
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
};

// Apply all security middleware
const applySecurityMiddleware = (app) => {
  // Enable trust proxy for accurate IP addresses behind reverse proxy
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }
  
  // Compression
  app.use(compression({
    level: 6,
    threshold: 10 * 1024, // 10KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
  
  // Helmet security headers
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? contentSecurityPolicy : false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));
  
  // CORS
  app.use(cors(corsOptions));
  
  // Body parsing with size limits
  app.use(express.json({ limit: requestSizeLimits.json }));
  app.use(express.urlencoded({ 
    extended: true, 
    limit: requestSizeLimits.urlencoded 
  }));
  app.use(express.raw({ 
    type: 'application/octet-stream', 
    limit: requestSizeLimits.raw 
  }));
  
  // MongoDB query injection prevention
  app.use(mongoSanitize());
  
  // XSS sanitization
  app.use(xssSanitize);
  
  // Additional security headers
  app.use(securityHeaders);
  
  // API key validation
  app.use(validateApiKey);
  
  // Apply rate limiting
  app.use('/api/', rateLimiters.general);
  app.use('/api/search', rateLimiters.search);
  app.use('/api/players/:username/games', rateLimiters.externalApi);
  app.use('/api/openings/explorer', rateLimiters.externalApi);
  app.use('/api/otb/database/search', rateLimiters.strict);
  
  // Error handler for security middleware
  app.use((err, req, res, next) => {
    if (err.message === 'Not allowed by CORS') {
      return res.status(403).json({ error: 'CORS policy violation' });
    }
    next(err);
  });
};

module.exports = {
  applySecurityMiddleware,
  rateLimiters,
  corsOptions,
  validateApiKey,
  xssSanitize,
  securityHeaders
};