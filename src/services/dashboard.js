/**
 * User Dashboard Service
 * Handles user dashboard data, preferences, and personalization features
 */

const { getPool } = require('./connection-pool');
const logger = require('../utils/logger');

class DashboardService {
  constructor() {
    this.pool = getPool();
  }

  /**
   * Get comprehensive dashboard data for user
   */
  async getDashboardData(userId) {
    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      // Get all dashboard data in parallel
      const [
        userInfo,
        favoriteStats,
        collections,
        repertoire,
        goals,
        recentActivity,
        notifications,
        studyPlans
      ] = await Promise.all([
        this.getUserInfo(userId, db),
        this.getFavoritePlayersStats(userId, db),
        this.getCollectionsSummary(userId, db),
        this.getRepertoireSummary(userId, db),
        this.getGoalsSummary(userId, db),
        this.getRecentActivity(userId, db),
        this.getUnreadNotifications(userId, db),
        this.getStudyPlansSummary(userId, db)
      ]);

      await this.pool.release(connectionInfo);

      return {
        user: userInfo,
        stats: {
          favoritePlayersCount: favoriteStats.count,
          collectionsCount: collections.total,
          publicCollectionsCount: collections.public,
          repertoireCount: repertoire.total,
          goalsActive: goals.active,
          goalsCompleted: goals.completed,
          totalActivity: recentActivity.length,
          unreadNotifications: notifications.length
        },
        favoritePlayerStats: favoriteStats.players,
        recentCollections: collections.recent,
        repertoireSummary: repertoire.summary,
        activeGoals: goals.goals,
        recentActivity: recentActivity.slice(0, 10),
        notifications: notifications.slice(0, 5),
        studyPlans: studyPlans.plans,
        quickActions: this.getQuickActions(userId),
        recommendations: await this.getRecommendations(userId)
      };
    } catch (error) {
      logger.error('Dashboard data error:', error);
      throw error;
    }
  }

  /**
   * Get user basic info
   */
  async getUserInfo(userId, db) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id, username, display_name, rating, country, created_at, 
                last_login, subscription_tier, subscription_expires
         FROM users WHERE id = ?`,
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  /**
   * Get favorite players statistics
   */
  async getFavoritePlayersStats(userId, db) {
    const players = await new Promise((resolve, reject) => {
      db.all(
        `SELECT player_name, platform, notes, added_at, last_checked,
                notifications_enabled
         FROM favorite_players 
         WHERE user_id = ?
         ORDER BY added_at DESC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    return {
      count: players.length,
      players: players.slice(0, 5) // Top 5 for dashboard
    };
  }

  /**
   * Get collections summary
   */
  async getCollectionsSummary(userId, db) {
    const collections = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, description, is_public, game_count, view_count,
                created_at, updated_at
         FROM game_collections 
         WHERE user_id = ?
         ORDER BY updated_at DESC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    return {
      total: collections.length,
      public: collections.filter(c => c.is_public).length,
      recent: collections.slice(0, 3)
    };
  }

  /**
   * Get opening repertoire summary
   */
  async getRepertoireSummary(userId, db) {
    const repertoire = await new Promise((resolve, reject) => {
      db.all(
        `SELECT color, eco, opening_name, variation, confidence_level,
                times_played, win_rate, last_practiced
         FROM opening_repertoire 
         WHERE user_id = ?
         ORDER BY confidence_level DESC, times_played DESC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const summary = {
      white: repertoire.filter(r => r.color === 'white' || r.color === 'both').length,
      black: repertoire.filter(r => r.color === 'black' || r.color === 'both').length,
      highConfidence: repertoire.filter(r => r.confidence_level >= 4).length,
      needsPractice: repertoire.filter(r => {
        if (!r.last_practiced) return true;
        const daysSince = (Date.now() - new Date(r.last_practiced)) / (1000 * 60 * 60 * 24);
        return daysSince > 30;
      }).length
    };

    return {
      total: repertoire.length,
      summary,
      topOpenings: repertoire.slice(0, 5)
    };
  }

  /**
   * Get goals summary
   */
  async getGoalsSummary(userId, db) {
    const goals = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, goal_type, title, description, target_value, current_value,
                deadline, status, created_at
         FROM user_goals 
         WHERE user_id = ?
         ORDER BY 
           CASE WHEN status = 'active' THEN 0 ELSE 1 END,
           deadline ASC NULLS LAST`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    return {
      active: goals.filter(g => g.status === 'active').length,
      completed: goals.filter(g => g.status === 'completed').length,
      goals: goals.slice(0, 5)
    };
  }

  /**
   * Get recent user activity
   */
  async getRecentActivity(userId, db) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT activity_type, activity_data, created_at
         FROM user_activity 
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 20`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get unread notifications
   */
  async getUnreadNotifications(userId, db) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, type, title, message, data, created_at
         FROM user_notifications 
         WHERE user_id = ? AND is_read = 0
         ORDER BY created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get study plans summary
   */
  async getStudyPlansSummary(userId, db) {
    const plans = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, description, difficulty_level, estimated_hours,
                completed_hours, status, created_at, started_at
         FROM study_plans 
         WHERE user_id = ?
         ORDER BY 
           CASE WHEN status = 'in_progress' THEN 0 
                WHEN status = 'not_started' THEN 1 
                ELSE 2 END,
           created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    return {
      total: plans.length,
      inProgress: plans.filter(p => p.status === 'in_progress').length,
      plans: plans.slice(0, 3)
    };
  }

  /**
   * Get quick actions for dashboard
   */
  getQuickActions(userId) {
    return [
      {
        id: 'search_games',
        title: 'Search Games',
        description: 'Find games by player, opening, or position',
        icon: 'search',
        path: '/search'
      },
      {
        id: 'add_favorite',
        title: 'Follow Player',
        description: 'Add a player to your favorites',
        icon: 'user-plus',
        path: '/players/search'
      },
      {
        id: 'create_collection',
        title: 'New Collection',
        description: 'Create a game collection',
        icon: 'folder-plus',
        path: '/collections/new'
      },
      {
        id: 'analyze_game',
        title: 'Analyze Game',
        description: 'Get computer analysis of a game',
        icon: 'activity',
        path: '/analyze'
      },
      {
        id: 'opening_practice',
        title: 'Practice Openings',
        description: 'Study your opening repertoire',
        icon: 'book-open',
        path: '/repertoire/practice'
      },
      {
        id: 'set_goal',
        title: 'Set Goal',
        description: 'Create a new improvement goal',
        icon: 'target',
        path: '/goals/new'
      }
    ];
  }

  /**
   * Get personalized recommendations
   */
  async getRecommendations(userId) {
    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const recommendations = [];

      // Check for inactive goals
      const inactiveGoals = await new Promise((resolve, reject) => {
        db.get(
          'SELECT COUNT(*) as count FROM user_goals WHERE user_id = ? AND status = "active"',
          [userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (inactiveGoals.count === 0) {
        recommendations.push({
          type: 'goal',
          title: 'Set Your First Goal',
          description: 'Setting goals helps track your chess improvement progress',
          action: 'Create Goal',
          priority: 'high'
        });
      }

      // Check for empty repertoire
      const repertoireCount = await new Promise((resolve, reject) => {
        db.get(
          'SELECT COUNT(*) as count FROM opening_repertoire WHERE user_id = ?',
          [userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (repertoireCount.count === 0) {
        recommendations.push({
          type: 'repertoire',
          title: 'Build Your Opening Repertoire',
          description: 'Add your favorite openings to track and improve them',
          action: 'Add Opening',
          priority: 'medium'
        });
      }

      // Check for no favorite players
      const favoritesCount = await new Promise((resolve, reject) => {
        db.get(
          'SELECT COUNT(*) as count FROM favorite_players WHERE user_id = ?',
          [userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (favoritesCount.count === 0) {
        recommendations.push({
          type: 'players',
          title: 'Follow Your Favorite Players',
          description: 'Track games and statistics of players you admire',
          action: 'Add Player',
          priority: 'medium'
        });
      }

      await this.pool.release(connectionInfo);
      return recommendations;
    } catch (error) {
      logger.error('Recommendations error:', error);
      return [];
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId, preferences) {
    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      // Build update query dynamically
      const allowedFields = [
        'theme', 'board_style', 'piece_set', 'sound_enabled',
        'email_notifications', 'push_notifications', 'language',
        'timezone', 'default_time_control', 'auto_analysis',
        'show_coordinates', 'show_legal_moves', 'animation_speed'
      ];

      const updates = [];
      const values = [];

      for (const [key, value] of Object.entries(preferences)) {
        if (allowedFields.includes(key)) {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }

      if (updates.length === 0) {
        throw new Error('No valid preferences to update');
      }

      values.push(userId);

      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE user_preferences 
           SET ${updates.join(', ')} 
           WHERE user_id = ?`,
          values,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await this.pool.release(connectionInfo);

      logger.info(`Preferences updated for user ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error('Update preferences error:', error);
      throw error;
    }
  }

  /**
   * Add notification
   */
  async addNotification(userId, notification) {
    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const { type, title, message, data } = notification;

      const result = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO user_notifications (user_id, type, title, message, data)
           VALUES (?, ?, ?, ?, ?)`,
          [userId, type, title, message, JSON.stringify(data || {})],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          }
        );
      });

      await this.pool.release(connectionInfo);

      return result;
    } catch (error) {
      logger.error('Add notification error:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(userId, notificationId) {
    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE user_notifications 
           SET is_read = 1, read_at = CURRENT_TIMESTAMP 
           WHERE id = ? AND user_id = ?`,
          [notificationId, userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await this.pool.release(connectionInfo);

      return { success: true };
    } catch (error) {
      logger.error('Mark notification read error:', error);
      throw error;
    }
  }

  /**
   * Get user activity stats
   */
  async getActivityStats(userId, days = 30) {
    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const stats = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
             DATE(created_at) as date,
             activity_type,
             COUNT(*) as count
           FROM user_activity 
           WHERE user_id = ? 
             AND created_at >= date('now', '-${days} days')
           GROUP BY DATE(created_at), activity_type
           ORDER BY date DESC`,
          [userId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      await this.pool.release(connectionInfo);

      // Process stats into daily activity
      const dailyActivity = {};
      stats.forEach(stat => {
        if (!dailyActivity[stat.date]) {
          dailyActivity[stat.date] = {};
        }
        dailyActivity[stat.date][stat.activity_type] = stat.count;
      });

      return { dailyActivity, raw: stats };
    } catch (error) {
      logger.error('Activity stats error:', error);
      throw error;
    }
  }
}

module.exports = new DashboardService();