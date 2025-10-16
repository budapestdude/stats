/**
 * Authentication Routes
 * Handles user registration, login, logout, and password management
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/auth');
const { authenticate, validateBody, logActivity } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', 
  validateBody({
    username: {
      required: true,
      type: 'string',
      minLength: 3,
      maxLength: 30,
      pattern: /^[a-zA-Z0-9_]+$/,
      validate: (value) => {
        if (!/^[a-zA-Z0-9_]+$/.test(value)) {
          return 'Username can only contain letters, numbers, and underscores';
        }
      }
    },
    email: {
      required: true,
      type: 'string',
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      validate: (value) => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Invalid email address';
        }
      }
    },
    password: {
      required: true,
      type: 'string',
      minLength: 6,
      maxLength: 100
    },
    displayName: {
      type: 'string',
      maxLength: 50
    },
    country: {
      type: 'string',
      maxLength: 2
    }
  }),
  async (req, res) => {
    try {
      const { username, email, password, displayName, country } = req.body;

      const result = await authService.register({
        username,
        email,
        password,
        displayName,
        country
      });

      logger.info(`New user registered: ${username} (${email})`);

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email for verification.',
        user: {
          id: result.id,
          username: result.username,
          email: result.email,
          displayName: result.displayName
        }
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login',
  validateBody({
    username: {
      required: true,
      type: 'string'
    },
    password: {
      required: true,
      type: 'string'
    }
  }),
  async (req, res) => {
    try {
      const { username, password } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await authService.login(
        { username, password },
        ipAddress,
        userAgent
      );

      logger.info(`User logged in: ${result.user.username} from ${ipAddress}`);

      res.json({
        success: true,
        message: 'Login successful',
        ...result
      });
    } catch (error) {
      logger.warn('Login failed:', error.message);
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    await authService.logout(req.token);
    
    logger.info(`User logged out: ${req.user.username}`);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh',
  validateBody({
    refreshToken: {
      required: true,
      type: 'string'
    }
  }),
  async (req, res) => {
    try {
      const { refreshToken } = req.body;

      const result = await authService.refreshAccessToken(refreshToken);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.warn('Token refresh failed:', error.message);
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/auth/verify-email
 * Verify email address
 */
router.post('/verify-email',
  validateBody({
    token: {
      required: true,
      type: 'string'
    }
  }),
  async (req, res) => {
    try {
      const { token } = req.body;

      const result = await authService.verifyEmail(token);

      logger.info(`Email verified for user ID: ${result.userId}`);

      res.json({
        success: true,
        message: 'Email verified successfully'
      });
    } catch (error) {
      logger.error('Email verification error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password',
  validateBody({
    email: {
      required: true,
      type: 'string',
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    }
  }),
  async (req, res) => {
    try {
      const { email } = req.body;

      const result = await authService.requestPasswordReset(email);

      logger.info(`Password reset requested for: ${email}`);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      logger.error('Password reset request error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process password reset request'
      });
    }
  }
);

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password',
  validateBody({
    token: {
      required: true,
      type: 'string'
    },
    password: {
      required: true,
      type: 'string',
      minLength: 6,
      maxLength: 100
    }
  }),
  async (req, res) => {
    try {
      const { token, password } = req.body;

      const result = await authService.resetPassword(token, password);

      logger.info('Password reset completed');

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      logger.error('Password reset error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 */
router.post('/change-password',
  authenticate,
  validateBody({
    currentPassword: {
      required: true,
      type: 'string'
    },
    newPassword: {
      required: true,
      type: 'string',
      minLength: 6,
      maxLength: 100
    }
  }),
  logActivity('password_change_attempt'),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const result = await authService.changePassword(
        req.user.id,
        currentPassword,
        newPassword
      );

      logger.info(`Password changed for user: ${req.user.username}`);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      logger.error('Password change error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const { getPool } = require('../services/connection-pool');
    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const db = connectionInfo.connection;

    // Get user details
    const user = await new Promise((resolve, reject) => {
      db.get(
        `SELECT id, username, email, display_name, avatar_url, rating, country, 
                created_at, last_login, subscription_tier, subscription_expires
         FROM users WHERE id = ?`,
        [req.user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      await pool.release(connectionInfo);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get preferences
    const preferences = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM user_preferences WHERE user_id = ?',
        [req.user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || {});
        }
      );
    });

    // Get statistics
    const stats = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
           COUNT(*) FILTER (WHERE activity_type = 'login') as total_logins,
           COUNT(*) FILTER (WHERE activity_type = 'search') as total_searches,
           COUNT(DISTINCT DATE(created_at)) as active_days,
           MAX(created_at) as last_activity
         FROM user_activity 
         WHERE user_id = ?`,
        [req.user.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0] || {});
        }
      );
    });

    await pool.release(connectionInfo);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        rating: user.rating,
        country: user.country,
        subscriptionTier: user.subscription_tier,
        subscriptionExpires: user.subscription_expires,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        preferences,
        stats
      }
    });
  } catch (error) {
    logger.error('Get user info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user information'
    });
  }
});

/**
 * GET /api/auth/sessions
 * Get user's active sessions
 */
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const { getPool } = require('../services/connection-pool');
    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const db = connectionInfo.connection;

    const sessions = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, ip_address, user_agent, created_at, expires_at,
                CASE WHEN token = ? THEN 1 ELSE 0 END as is_current
         FROM user_sessions 
         WHERE user_id = ? AND expires_at > datetime('now')
         ORDER BY created_at DESC`,
        [req.token, req.user.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    await pool.release(connectionInfo);

    res.json({
      success: true,
      sessions: sessions.map(session => ({
        id: session.id,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        createdAt: session.created_at,
        expiresAt: session.expires_at,
        isCurrent: session.is_current === 1
      }))
    });
  } catch (error) {
    logger.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sessions'
    });
  }
});

/**
 * DELETE /api/auth/sessions/:id
 * Terminate a specific session
 */
router.delete('/sessions/:id', authenticate, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    
    const { getPool } = require('../services/connection-pool');
    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const db = connectionInfo.connection;

    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM user_sessions WHERE id = ? AND user_id = ?',
        [sessionId, req.user.id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });

    await pool.release(connectionInfo);

    logger.info(`Session terminated: ${sessionId} for user ${req.user.username}`);

    res.json({
      success: true,
      message: 'Session terminated'
    });
  } catch (error) {
    logger.error('Session termination error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to terminate session'
    });
  }
});

/**
 * POST /api/auth/check-username
 * Check if username is available
 */
router.post('/check-username',
  validateBody({
    username: {
      required: true,
      type: 'string',
      minLength: 3,
      maxLength: 30
    }
  }),
  async (req, res) => {
    try {
      const { username } = req.body;
      
      const { getPool } = require('../services/connection-pool');
      const pool = getPool();
      const connectionInfo = await pool.acquire();
      const db = connectionInfo.connection;

      const existingUser = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM users WHERE username = ?',
          [username],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      await pool.release(connectionInfo);

      res.json({
        success: true,
        available: !existingUser
      });
    } catch (error) {
      logger.error('Username check error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check username availability'
      });
    }
  }
);

module.exports = router;