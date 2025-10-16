/**
 * Authentication Middleware
 * Protects routes and validates JWT tokens
 */

const authService = require('../services/auth');
const logger = require('../utils/logger');

/**
 * Verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify token
      const decoded = await authService.verifyToken(token);
      
      // Attach user info to request
      req.user = {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        subscriptionTier: decoded.subscriptionTier
      };
      req.token = token;

      next();
    } catch (error) {
      logger.warn('Invalid token attempt:', error.message);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = await authService.verifyToken(token);
        req.user = {
          id: decoded.id,
          username: decoded.username,
          email: decoded.email,
          subscriptionTier: decoded.subscriptionTier
        };
        req.token = token;
      } catch (error) {
        // Token is invalid but we don't fail the request
        logger.debug('Optional auth - invalid token:', error.message);
      }
    }
    
    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next(); // Continue even if there's an error
  }
};

/**
 * Check if user has required subscription tier
 */
const requireSubscription = (requiredTier) => {
  const tierLevels = {
    'free': 0,
    'basic': 1,
    'pro': 2,
    'premium': 3
  };

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userTier = req.user.subscriptionTier || 'free';
    const userLevel = tierLevels[userTier] || 0;
    const requiredLevel = tierLevels[requiredTier] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        success: false,
        error: `This feature requires ${requiredTier} subscription or higher`,
        requiredTier,
        userTier
      });
    }

    next();
  };
};

/**
 * Rate limiting per user
 */
const userRateLimit = (maxRequests = 100, windowMs = 60000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next(); // Skip rate limiting for unauthenticated requests
    }

    const userId = req.user.id;
    const now = Date.now();
    
    // Clean up old entries
    for (const [key, data] of userRequests.entries()) {
      if (now - data.windowStart > windowMs) {
        userRequests.delete(key);
      }
    }

    if (!userRequests.has(userId)) {
      userRequests.set(userId, {
        count: 1,
        windowStart: now
      });
      return next();
    }

    const userData = userRequests.get(userId);
    
    if (now - userData.windowStart > windowMs) {
      // Reset window
      userData.count = 1;
      userData.windowStart = now;
      return next();
    }

    if (userData.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil((userData.windowStart + windowMs - now) / 1000)
      });
    }

    userData.count++;
    next();
  };
};

/**
 * Validate user owns the resource
 */
const requireOwnership = (getResourceOwnerId) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    try {
      const ownerId = await getResourceOwnerId(req);
      
      if (ownerId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to access this resource'
        });
      }

      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify ownership'
      });
    }
  };
};

/**
 * Log user activity
 */
const logActivity = (activityType) => {
  return async (req, res, next) => {
    if (req.user) {
      try {
        const { getPool } = require('../services/connection-pool');
        const pool = getPool();
        const connectionInfo = await pool.acquire();
        const db = connectionInfo.connection;

        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO user_activity (user_id, activity_type, activity_data, ip_address) VALUES (?, ?, ?, ?)',
            [
              req.user.id,
              activityType,
              JSON.stringify({
                method: req.method,
                path: req.path,
                query: req.query,
                body: req.body ? Object.keys(req.body) : []
              }),
              req.ip
            ],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        await pool.release(connectionInfo);
      } catch (error) {
        logger.warn('Failed to log activity:', error);
      }
    }
    next();
  };
};

/**
 * Validate request body
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    const errors = [];

    for (const field in schema) {
      const rules = schema[field];
      const value = req.body[field];

      // Check required
      if (rules.required && !value) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value !== undefined) {
        // Check type
        if (rules.type && typeof value !== rules.type) {
          errors.push(`${field} must be of type ${rules.type}`);
        }

        // Check min length
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`${field} must be at least ${rules.minLength} characters long`);
        }

        // Check max length
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`${field} must be at most ${rules.maxLength} characters long`);
        }

        // Check pattern
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`${field} has invalid format`);
        }

        // Check enum
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
        }

        // Custom validation
        if (rules.validate) {
          const error = rules.validate(value);
          if (error) {
            errors.push(error);
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  optionalAuth,
  requireSubscription,
  userRateLimit,
  requireOwnership,
  logActivity,
  validateBody
};