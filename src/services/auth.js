/**
 * Authentication Service
 * Handles user authentication, JWT tokens, and session management
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getPool } = require('./connection-pool');
const logger = require('../utils/logger');

class AuthService {
  constructor() {
    this.pool = getPool();
    this.jwtSecret = process.env.JWT_SECRET || 'chess-stats-secret-key-change-in-production';
    this.jwtExpiry = process.env.JWT_EXPIRY || '24h';
    this.refreshTokenExpiry = '7d';
    this.saltRounds = 10;
  }

  /**
   * Register a new user
   */
  async register(userData) {
    const { username, email, password, displayName, country } = userData;

    try {
      // Validate input
      if (!username || !email || !password) {
        throw new Error('Username, email, and password are required');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      if (!this.isValidEmail(email)) {
        throw new Error('Invalid email address');
      }

      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      // Check if user already exists
      const existingUser = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM users WHERE username = ? OR email = ?',
          [username, email],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (existingUser) {
        await this.pool.release(connectionInfo);
        throw new Error('Username or email already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, this.saltRounds);

      // Generate verification token
      const verificationToken = this.generateToken();

      // Create user
      const result = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO users (username, email, password_hash, display_name, country, verification_token)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [username, email, passwordHash, displayName || username, country || null, verificationToken],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          }
        );
      });

      // Create default preferences
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO user_preferences (user_id) VALUES (?)',
          [result.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Log activity
      await this.logActivity(result.id, 'registration', { username, email }, db);

      await this.pool.release(connectionInfo);

      // Return user data (without sensitive info)
      return {
        id: result.id,
        username,
        email,
        displayName: displayName || username,
        verificationToken
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(credentials, ipAddress = null, userAgent = null) {
    const { username, password } = credentials;

    try {
      if (!username || !password) {
        throw new Error('Username and password are required');
      }

      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      // Find user by username or email
      const user = await new Promise((resolve, reject) => {
        db.get(
          `SELECT id, username, email, password_hash, display_name, avatar_url, 
                  rating, country, is_active, is_verified, subscription_tier
           FROM users 
           WHERE (username = ? OR email = ?) AND is_active = 1`,
          [username, username],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!user) {
        await this.pool.release(connectionInfo);
        throw new Error('Invalid username or password');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        await this.logActivity(user.id, 'failed_login', { username }, db);
        await this.pool.release(connectionInfo);
        throw new Error('Invalid username or password');
      }

      // Check if user is verified
      if (!user.is_verified) {
        await this.pool.release(connectionInfo);
        throw new Error('Please verify your email address before logging in');
      }

      // Generate tokens
      const accessToken = this.generateJWT(user);
      const refreshToken = this.generateRefreshToken();

      // Create session
      const sessionId = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO user_sessions (user_id, token, refresh_token, ip_address, user_agent, expires_at)
           VALUES (?, ?, ?, ?, ?, datetime('now', '+1 day'))`,
          [user.id, accessToken, refreshToken, ipAddress, userAgent],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      // Update last login
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
          [user.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Log activity
      await this.logActivity(user.id, 'login', { ipAddress, userAgent }, db);

      // Get user preferences
      const preferences = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM user_preferences WHERE user_id = ?',
          [user.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row || {});
          }
        );
      });

      await this.pool.release(connectionInfo);

      // Return user data with tokens
      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          rating: user.rating,
          country: user.country,
          subscriptionTier: user.subscription_tier,
          preferences
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: this.jwtExpiry
        },
        sessionId
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(token) {
    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      await new Promise((resolve, reject) => {
        db.run(
          'DELETE FROM user_sessions WHERE token = ?',
          [token],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await this.pool.release(connectionInfo);
      return { success: true };
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      
      // Check if session exists
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const session = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM user_sessions WHERE token = ? AND expires_at > datetime("now")',
          [token],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      await this.pool.release(connectionInfo);

      if (!session) {
        throw new Error('Invalid or expired session');
      }

      return decoded;
    } catch (error) {
      logger.error('Token verification error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      // Find session by refresh token
      const session = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM user_sessions WHERE refresh_token = ?',
          [refreshToken],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!session) {
        await this.pool.release(connectionInfo);
        throw new Error('Invalid refresh token');
      }

      // Get user data
      const user = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id, username, email, display_name, rating, subscription_tier FROM users WHERE id = ?',
          [session.user_id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!user) {
        await this.pool.release(connectionInfo);
        throw new Error('User not found');
      }

      // Generate new access token
      const newAccessToken = this.generateJWT(user);

      // Update session
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE user_sessions SET token = ?, expires_at = datetime("now", "+1 day") WHERE id = ?',
          [newAccessToken, session.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await this.pool.release(connectionInfo);

      return {
        accessToken: newAccessToken,
        expiresIn: this.jwtExpiry
      };
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(token) {
    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const user = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM users WHERE verification_token = ?',
          [token],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!user) {
        await this.pool.release(connectionInfo);
        throw new Error('Invalid verification token');
      }

      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?',
          [user.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await this.logActivity(user.id, 'email_verified', {}, db);
      await this.pool.release(connectionInfo);

      return { success: true, userId: user.id };
    } catch (error) {
      logger.error('Email verification error:', error);
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const user = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id, username FROM users WHERE email = ?',
          [email],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!user) {
        await this.pool.release(connectionInfo);
        // Don't reveal if email exists
        return { success: true, message: 'If the email exists, a reset link has been sent' };
      }

      const resetToken = this.generateToken();
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
          [resetToken, expiresAt.toISOString(), user.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await this.logActivity(user.id, 'password_reset_requested', { email }, db);
      await this.pool.release(connectionInfo);

      return {
        success: true,
        resetToken,
        username: user.username,
        message: 'Password reset token generated'
      };
    } catch (error) {
      logger.error('Password reset request error:', error);
      throw error;
    }
  }

  /**
   * Reset password
   */
  async resetPassword(token, newPassword) {
    try {
      if (newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const user = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > datetime("now")',
          [token],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!user) {
        await this.pool.release(connectionInfo);
        throw new Error('Invalid or expired reset token');
      }

      const passwordHash = await bcrypt.hash(newPassword, this.saltRounds);

      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
          [passwordHash, user.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Invalidate all existing sessions
      await new Promise((resolve, reject) => {
        db.run(
          'DELETE FROM user_sessions WHERE user_id = ?',
          [user.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await this.logActivity(user.id, 'password_reset', {}, db);
      await this.pool.release(connectionInfo);

      return { success: true, message: 'Password reset successfully' };
    } catch (error) {
      logger.error('Password reset error:', error);
      throw error;
    }
  }

  /**
   * Change password (for logged-in users)
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      if (newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const user = await new Promise((resolve, reject) => {
        db.get(
          'SELECT password_hash FROM users WHERE id = ?',
          [userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!user) {
        await this.pool.release(connectionInfo);
        throw new Error('User not found');
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        await this.pool.release(connectionInfo);
        throw new Error('Current password is incorrect');
      }

      const newPasswordHash = await bcrypt.hash(newPassword, this.saltRounds);

      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET password_hash = ? WHERE id = ?',
          [newPasswordHash, userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await this.logActivity(userId, 'password_changed', {}, db);
      await this.pool.release(connectionInfo);

      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      logger.error('Password change error:', error);
      throw error;
    }
  }

  /**
   * Helper functions
   */

  generateJWT(user) {
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        subscriptionTier: user.subscription_tier || 'free'
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiry }
    );
  }

  generateRefreshToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async logActivity(userId, activityType, data, db) {
    try {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES (?, ?, ?)',
          [userId, activityType, JSON.stringify(data)],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } catch (error) {
      logger.warn('Failed to log activity:', error);
    }
  }
}

module.exports = new AuthService();