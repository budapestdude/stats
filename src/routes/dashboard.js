/**
 * User Dashboard Routes
 * Provides personalized dashboard data, preferences, and user management
 */

const express = require('express');
const router = express.Router();
const dashboardService = require('../services/dashboard');
const { authenticate, validateBody, logActivity } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * GET /api/dashboard
 * Get comprehensive dashboard data for authenticated user
 */
router.get('/', authenticate, logActivity('dashboard_view'), async (req, res) => {
  try {
    const dashboardData = await dashboardService.getDashboardData(req.user.id);

    res.json({
      success: true,
      dashboard: dashboardData,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Dashboard data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard data'
    });
  }
});

/**
 * GET /api/dashboard/notifications
 * Get user's notifications with pagination
 */
router.get('/notifications', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const offset = (page - 1) * limit;

    const { getPool } = require('../services/connection-pool');
    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const db = connectionInfo.connection;

    const whereClause = unreadOnly === 'true' ? 'AND is_read = 0' : '';
    
    const [notifications, total] = await Promise.all([
      new Promise((resolve, reject) => {
        db.all(
          `SELECT id, type, title, message, data, is_read, created_at, read_at
           FROM user_notifications 
           WHERE user_id = ? ${whereClause}
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
          [req.user.id, limit, offset],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      }),
      new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM user_notifications 
           WHERE user_id = ? ${whereClause}`,
          [req.user.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      })
    ]);

    await pool.release(connectionInfo);

    res.json({
      success: true,
      notifications: notifications.map(n => ({
        ...n,
        data: n.data ? JSON.parse(n.data) : {}
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notifications'
    });
  }
});

/**
 * POST /api/dashboard/notifications/:id/read
 * Mark notification as read
 */
router.post('/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    
    await dashboardService.markNotificationRead(req.user.id, notificationId);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

/**
 * POST /api/dashboard/notifications/read-all
 * Mark all notifications as read
 */
router.post('/notifications/read-all', authenticate, async (req, res) => {
  try {
    const { getPool } = require('../services/connection-pool');
    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const db = connectionInfo.connection;

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE user_notifications 
         SET is_read = 1, read_at = CURRENT_TIMESTAMP 
         WHERE user_id = ? AND is_read = 0`,
        [req.user.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await pool.release(connectionInfo);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('Mark all notifications read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notifications as read'
    });
  }
});

/**
 * GET /api/dashboard/preferences
 * Get user preferences
 */
router.get('/preferences', authenticate, async (req, res) => {
  try {
    const { getPool } = require('../services/connection-pool');
    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const db = connectionInfo.connection;

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

    await pool.release(connectionInfo);

    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    logger.error('Get preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get preferences'
    });
  }
});

/**
 * PUT /api/dashboard/preferences
 * Update user preferences
 */
router.put('/preferences', 
  authenticate,
  validateBody({
    theme: { enum: ['light', 'dark', 'auto'] },
    board_style: { type: 'string', maxLength: 50 },
    piece_set: { type: 'string', maxLength: 50 },
    sound_enabled: { type: 'boolean' },
    email_notifications: { type: 'boolean' },
    push_notifications: { type: 'boolean' },
    language: { type: 'string', maxLength: 10 },
    timezone: { type: 'string', maxLength: 50 },
    default_time_control: { type: 'string', maxLength: 20 },
    auto_analysis: { type: 'boolean' },
    show_coordinates: { type: 'boolean' },
    show_legal_moves: { type: 'boolean' },
    animation_speed: { enum: ['slow', 'normal', 'fast'] }
  }),
  logActivity('preferences_update'),
  async (req, res) => {
    try {
      await dashboardService.updatePreferences(req.user.id, req.body);

      res.json({
        success: true,
        message: 'Preferences updated successfully'
      });
    } catch (error) {
      logger.error('Update preferences error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update preferences'
      });
    }
  }
);

/**
 * GET /api/dashboard/activity
 * Get user activity statistics
 */
router.get('/activity', authenticate, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const maxDays = Math.min(parseInt(days), 365); // Limit to 1 year

    const activityStats = await dashboardService.getActivityStats(req.user.id, maxDays);

    res.json({
      success: true,
      activity: activityStats,
      period: {
        days: maxDays,
        from: new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
      }
    });
  } catch (error) {
    logger.error('Get activity stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get activity statistics'
    });
  }
});

/**
 * POST /api/dashboard/quick-action
 * Log quick action usage for analytics
 */
router.post('/quick-action',
  authenticate,
  validateBody({
    actionId: { required: true, type: 'string' },
    actionData: { type: 'object' }
  }),
  async (req, res) => {
    try {
      const { actionId, actionData } = req.body;

      // Log the quick action
      const { getPool } = require('../services/connection-pool');
      const pool = getPool();
      const connectionInfo = await pool.acquire();
      const db = connectionInfo.connection;

      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO user_activity (user_id, activity_type, activity_data) VALUES (?, ?, ?)',
          [req.user.id, 'quick_action', JSON.stringify({ actionId, ...actionData })],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await pool.release(connectionInfo);

      res.json({
        success: true,
        message: 'Quick action logged'
      });
    } catch (error) {
      logger.error('Quick action log error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to log quick action'
      });
    }
  }
);

/**
 * GET /api/dashboard/stats
 * Get comprehensive user statistics
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { getPool } = require('../services/connection-pool');
    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const db = connectionInfo.connection;

    const stats = await Promise.all([
      // Total activity count
      new Promise((resolve, reject) => {
        db.get(
          'SELECT COUNT(*) as total FROM user_activity WHERE user_id = ?',
          [req.user.id],
          (err, row) => {
            if (err) reject(err);
            else resolve({ totalActivity: row.total });
          }
        );
      }),

      // Activity breakdown
      new Promise((resolve, reject) => {
        db.all(
          `SELECT activity_type, COUNT(*) as count 
           FROM user_activity 
           WHERE user_id = ?
           GROUP BY activity_type
           ORDER BY count DESC`,
          [req.user.id],
          (err, rows) => {
            if (err) reject(err);
            else resolve({ activityBreakdown: rows || [] });
          }
        );
      }),

      // Recent login streak
      new Promise((resolve, reject) => {
        db.all(
          `SELECT DISTINCT DATE(created_at) as date
           FROM user_activity 
           WHERE user_id = ? AND activity_type = 'login'
           ORDER BY date DESC
           LIMIT 30`,
          [req.user.id],
          (err, rows) => {
            if (err) reject(err);
            else {
              // Calculate login streak
              let streak = 0;
              const today = new Date().toISOString().split('T')[0];
              const dates = rows.map(r => r.date);
              
              for (let i = 0; i < dates.length; i++) {
                const checkDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
                  .toISOString().split('T')[0];
                if (dates.includes(checkDate)) {
                  streak++;
                } else {
                  break;
                }
              }
              
              resolve({ loginStreak: streak, recentLogins: dates.length });
            }
          }
        );
      }),

      // Collections stats
      new Promise((resolve, reject) => {
        db.get(
          `SELECT 
             COUNT(*) as total_collections,
             SUM(game_count) as total_games_collected,
             SUM(view_count) as total_views
           FROM game_collections 
           WHERE user_id = ?`,
          [req.user.id],
          (err, row) => {
            if (err) reject(err);
            else resolve({ 
              collections: row.total_collections || 0,
              gamesCollected: row.total_games_collected || 0,
              collectionViews: row.total_views || 0
            });
          }
        );
      }),

      // Goals stats
      new Promise((resolve, reject) => {
        db.all(
          `SELECT status, COUNT(*) as count
           FROM user_goals 
           WHERE user_id = ?
           GROUP BY status`,
          [req.user.id],
          (err, rows) => {
            if (err) reject(err);
            else {
              const goalStats = { active: 0, completed: 0, paused: 0, failed: 0 };
              rows.forEach(row => {
                goalStats[row.status] = row.count;
              });
              resolve({ goals: goalStats });
            }
          }
        );
      })
    ]);

    await pool.release(connectionInfo);

    // Combine all stats
    const combinedStats = stats.reduce((acc, stat) => ({ ...acc, ...stat }), {});

    res.json({
      success: true,
      stats: combinedStats,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user statistics'
    });
  }
});

/**
 * PUT /api/dashboard/profile
 * Update user profile information
 */
router.put('/profile',
  authenticate,
  validateBody({
    displayName: { type: 'string', maxLength: 50 },
    country: { type: 'string', maxLength: 2 },
    avatarUrl: { type: 'string', maxLength: 500 }
  }),
  logActivity('profile_update'),
  async (req, res) => {
    try {
      const { displayName, country, avatarUrl } = req.body;
      const updates = [];
      const values = [];

      if (displayName !== undefined) {
        updates.push('display_name = ?');
        values.push(displayName);
      }

      if (country !== undefined) {
        updates.push('country = ?');
        values.push(country);
      }

      if (avatarUrl !== undefined) {
        updates.push('avatar_url = ?');
        values.push(avatarUrl);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields to update'
        });
      }

      const { getPool } = require('../services/connection-pool');
      const pool = getPool();
      const connectionInfo = await pool.acquire();
      const db = connectionInfo.connection;

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(req.user.id);

      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
          values,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await pool.release(connectionInfo);

      logger.info(`Profile updated for user: ${req.user.username}`);

      res.json({
        success: true,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      logger.error('Profile update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  }
);

module.exports = router;