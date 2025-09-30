const authService = require('../services/authService');
const { logger } = require('./errorHandler');

class AuthMiddleware {
  // Extract JWT token from request
  extractToken(req) {
    let token = null;

    // Check Authorization header (Bearer token)
    if (req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    // Check cookie as fallback
    if (!token && req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    // Check query parameter as last resort (not recommended for production)
    if (!token && req.query.token) {
      token = req.query.token;
    }

    return token;
  }

  // Main authentication middleware
  authenticate(required = true) {
    return async (req, res, next) => {
      try {
        const token = this.extractToken(req);

        if (!token) {
          if (required) {
            return res.status(401).json({
              error: 'Access denied',
              message: 'No token provided',
              code: 'NO_TOKEN'
            });
          } else {
            // Optional authentication - continue without user
            req.user = null;
            return next();
          }
        }

        // Verify token
        const decoded = authService.verifyToken(token);
        
        // Get full user data
        const user = await authService.getUserById(decoded.id);
        
        if (!user) {
          return res.status(401).json({
            error: 'Access denied',
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          });
        }

        if (!user.isActive) {
          return res.status(401).json({
            error: 'Access denied',
            message: 'Account is deactivated',
            code: 'ACCOUNT_INACTIVE'
          });
        }

        // Attach user to request
        req.user = user;
        req.token = token;
        
        // Add user context for logging
        req.userContext = {
          id: user.id,
          username: user.username,
          role: user.role
        };

        next();
      } catch (error) {
        logger.error('Authentication error:', error.message);
        
        let errorCode = 'AUTH_ERROR';
        let message = 'Authentication failed';
        
        if (error.message.includes('expired')) {
          errorCode = 'TOKEN_EXPIRED';
          message = 'Token has expired';
        } else if (error.message.includes('invalid')) {
          errorCode = 'INVALID_TOKEN';
          message = 'Invalid token';
        }

        if (required) {
          return res.status(401).json({
            error: 'Access denied',
            message,
            code: errorCode
          });
        } else {
          // Optional authentication - continue without user
          req.user = null;
          return next();
        }
      }
    };
  }

  // Authorization middleware - check user roles
  authorize(...allowedRoles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Access denied',
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (allowedRoles.length === 0) {
        // No specific roles required, any authenticated user can access
        return next();
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.warn(`Access denied for user ${req.user.username} (role: ${req.user.role}) to endpoint requiring roles: ${allowedRoles.join(', ')}`);
        
        return res.status(403).json({
          error: 'Access denied',
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: allowedRoles,
          current: req.user.role
        });
      }

      next();
    };
  }

  // Middleware to check if user owns resource or is admin
  authorizeOwnerOrAdmin(getResourceOwnerId) {
    return async (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Access denied',
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Admin can access anything
      if (req.user.role === 'admin') {
        return next();
      }

      try {
        // Get the resource owner ID
        const ownerId = typeof getResourceOwnerId === 'function' 
          ? await getResourceOwnerId(req) 
          : req.params.userId || req.params.id;

        if (req.user.id === ownerId) {
          return next();
        }

        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only access your own resources',
          code: 'RESOURCE_ACCESS_DENIED'
        });
      } catch (error) {
        logger.error('Authorization check failed:', error);
        return res.status(500).json({
          error: 'Authorization check failed',
          message: 'Unable to verify resource ownership'
        });
      }
    };
  }

  // Rate limiting by user
  userRateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
    const requestCounts = new Map();

    return (req, res, next) => {
      const userId = req.user?.id || req.ip;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean old entries
      for (const [key, data] of requestCounts.entries()) {
        if (data.lastReset < windowStart) {
          requestCounts.delete(key);
        }
      }

      // Get or create user request count
      let userRequests = requestCounts.get(userId);
      if (!userRequests || userRequests.lastReset < windowStart) {
        userRequests = {
          count: 0,
          lastReset: now
        };
        requestCounts.set(userId, userRequests);
      }

      // Check if limit exceeded
      if (userRequests.count >= maxRequests) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${Math.floor(windowMs / 60000)} minutes.`,
          retryAfter: Math.ceil((windowMs - (now - userRequests.lastReset)) / 1000)
        });
      }

      // Increment request count
      userRequests.count++;

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': Math.max(0, maxRequests - userRequests.count),
        'X-RateLimit-Reset': new Date(userRequests.lastReset + windowMs).toISOString()
      });

      next();
    };
  }

  // Middleware to log user activities
  logActivity(activityType) {
    return (req, res, next) => {
      if (req.user) {
        // In production, this would write to database
        logger.info(`User activity: ${req.user.username} - ${activityType} - ${req.method} ${req.originalUrl}`);
        
        // Attach activity info for potential audit logging
        req.activity = {
          userId: req.user.id,
          username: req.user.username,
          type: activityType,
          endpoint: req.originalUrl,
          method: req.method,
          timestamp: new Date(),
          ip: req.ip,
          userAgent: req.get('User-Agent')
        };
      }
      next();
    };
  }

  // Middleware to ensure email verification (if required)
  requireEmailVerification() {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (!req.user.isVerified) {
        return res.status(403).json({
          error: 'Email verification required',
          message: 'Please verify your email address to access this feature',
          code: 'EMAIL_NOT_VERIFIED'
        });
      }

      next();
    };
  }

  // Health check for auth system
  healthCheck() {
    return (req, res) => {
      const authHealth = authService.healthCheck();
      
      res.json({
        status: 'operational',
        authentication: authHealth,
        middleware: {
          jwtEnabled: true,
          cookieSupport: true,
          roleBasedAccess: true
        }
      });
    };
  }

  // Development helper - bypass authentication
  developmentBypass() {
    if (process.env.NODE_ENV === 'development' && process.env.AUTH_BYPASS === 'true') {
      return (req, res, next) => {
        logger.warn('🚨 AUTH BYPASS ENABLED - FOR DEVELOPMENT ONLY');
        req.user = {
          id: 'dev-user',
          username: 'developer',
          email: 'dev@chessstats.local',
          role: 'admin',
          firstName: 'Dev',
          lastName: 'User',
          isActive: true,
          isVerified: true
        };
        next();
      };
    }
    
    return (req, res, next) => next();
  }
}

// Export singleton instance
const authMiddleware = new AuthMiddleware();
module.exports = authMiddleware;