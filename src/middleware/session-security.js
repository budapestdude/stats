const session = require('express-session');
const RedisStore = require('connect-redis').default;
const config = require('../config');
const logger = require('../utils/logger');

// Session configuration
const sessionConfig = {
  name: 'chess_stats_session',
  secret: config.security.sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiration on activity
  cookie: {
    secure: config.security.cookie.secure, // HTTPS only in production
    httpOnly: config.security.cookie.httpOnly, // Prevent XSS
    sameSite: config.security.cookie.sameSite, // CSRF protection
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    domain: config.app.isProduction ? '.chessstats.com' : undefined,
  },
  genid: () => {
    return require('crypto').randomBytes(32).toString('hex');
  },
};

// Create session store
const createSessionStore = () => {
  if (config.redis.host) {
    try {
      const RedisClient = require('../services/redis');
      
      return new RedisStore({
        client: RedisClient,
        prefix: 'sess:',
        ttl: 86400, // 24 hours
        disableTouch: false,
      });
    } catch (error) {
      logger.error('Failed to create Redis session store', error);
    }
  }
  
  logger.warn('Using memory session store (not recommended for production)');
  return undefined; // Falls back to MemoryStore
};

// Session security middleware
const sessionSecurity = (req, res, next) => {
  if (!req.session) {
    return next();
  }
  
  // Regenerate session ID on login to prevent session fixation
  if (req.session.regenerateOnLogin) {
    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration failed', err);
      }
      delete req.session.regenerateOnLogin;
      next();
    });
    return;
  }
  
  // Check session validity
  if (req.session.userId) {
    const now = Date.now();
    const created = req.session.createdAt || now;
    const lastActivity = req.session.lastActivity || now;
    
    // Force logout after 24 hours regardless of activity
    if (now - created > 24 * 60 * 60 * 1000) {
      req.session.destroy((err) => {
        if (err) logger.error('Session destruction failed', err);
      });
      return res.status(401).json({ 
        error: 'Session expired',
        message: 'Please login again',
      });
    }
    
    // Force logout after 2 hours of inactivity
    if (now - lastActivity > 2 * 60 * 60 * 1000) {
      req.session.destroy((err) => {
        if (err) logger.error('Session destruction failed', err);
      });
      return res.status(401).json({ 
        error: 'Session timeout',
        message: 'Session expired due to inactivity',
      });
    }
    
    // Update last activity
    req.session.lastActivity = now;
    
    // Regenerate session ID periodically (every 15 minutes)
    if (now - (req.session.lastRegenerated || created) > 15 * 60 * 1000) {
      req.session.regenerate((err) => {
        if (err) {
          logger.error('Periodic session regeneration failed', err);
        } else {
          req.session.lastRegenerated = now;
        }
      });
    }
  }
  
  next();
};

// Session fingerprinting for additional security
const sessionFingerprint = (req, res, next) => {
  if (!req.session) {
    return next();
  }
  
  const fingerprint = generateFingerprint(req);
  
  if (req.session.fingerprint) {
    if (req.session.fingerprint !== fingerprint) {
      logger.warn('Session fingerprint mismatch', {
        sessionId: req.sessionID,
        expected: req.session.fingerprint,
        actual: fingerprint,
        ip: req.ip,
      });
      
      // Destroy potentially hijacked session
      req.session.destroy((err) => {
        if (err) logger.error('Session destruction failed', err);
      });
      
      return res.status(401).json({ 
        error: 'Session security violation',
        message: 'Your session has been terminated for security reasons',
      });
    }
  } else {
    req.session.fingerprint = fingerprint;
  }
  
  next();
};

// Generate session fingerprint
const generateFingerprint = (req) => {
  const crypto = require('crypto');
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
  ];
  
  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex');
};

// Session activity tracker
const trackSessionActivity = (req, res, next) => {
  if (req.session && req.session.userId) {
    if (!req.session.activityLog) {
      req.session.activityLog = [];
    }
    
    req.session.activityLog.push({
      path: req.path,
      method: req.method,
      timestamp: Date.now(),
    });
    
    // Keep only last 50 activities
    if (req.session.activityLog.length > 50) {
      req.session.activityLog = req.session.activityLog.slice(-50);
    }
  }
  
  next();
};

// Concurrent session limiter
const limitConcurrentSessions = (maxSessions = 3) => {
  const activeSessions = new Map(); // In production, use Redis
  
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return next();
    }
    
    const userId = req.session.userId;
    const sessionId = req.sessionID;
    
    if (!activeSessions.has(userId)) {
      activeSessions.set(userId, new Set());
    }
    
    const userSessions = activeSessions.get(userId);
    userSessions.add(sessionId);
    
    // Clean up old sessions
    userSessions.forEach(sid => {
      if (!req.sessionStore.get(sid)) {
        userSessions.delete(sid);
      }
    });
    
    if (userSessions.size > maxSessions) {
      logger.warn('Concurrent session limit exceeded', {
        userId,
        sessionCount: userSessions.size,
        maxSessions,
      });
      
      // Optionally terminate oldest sessions
      const sessionsArray = Array.from(userSessions);
      const sessionsToRemove = sessionsArray.slice(0, sessionsArray.length - maxSessions);
      
      sessionsToRemove.forEach(sid => {
        req.sessionStore.destroy(sid, (err) => {
          if (err) logger.error('Failed to destroy excess session', err);
        });
        userSessions.delete(sid);
      });
    }
    
    next();
  };
};

// Apply session security
const applySessionSecurity = (app) => {
  // Set up session store
  const store = createSessionStore();
  if (store) {
    sessionConfig.store = store;
  }
  
  // Apply session middleware
  app.use(session(sessionConfig));
  
  // Apply security enhancements
  app.use(sessionSecurity);
  app.use(sessionFingerprint);
  app.use(trackSessionActivity);
  app.use(limitConcurrentSessions(3));
  
  logger.info('Session security middleware applied');
};

module.exports = {
  sessionConfig,
  sessionSecurity,
  sessionFingerprint,
  trackSessionActivity,
  limitConcurrentSessions,
  applySessionSecurity,
};