/**
 * Favorite Players Routes
 * Manages user's favorite players tracking system
 */

const express = require('express');
const router = express.Router();
const { authenticate, validateBody, logActivity } = require('../middleware/auth');
const { getPool } = require('../services/connection-pool');
const logger = require('../utils/logger');

/**
 * GET /api/favorites
 * Get user's favorite players
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, platform } = req.query;
    const offset = (page - 1) * limit;

    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const db = connectionInfo.connection;

    const platformFilter = platform ? 'AND platform = ?' : '';
    const params = [req.user.id];
    if (platform) params.push(platform);
    params.push(parseInt(limit), offset);

    const [favorites, total] = await Promise.all([
      new Promise((resolve, reject) => {
        db.all(
          `SELECT id, player_name, platform, notes, added_at, last_checked,
                  notifications_enabled
           FROM favorite_players 
           WHERE user_id = ? ${platformFilter}
           ORDER BY added_at DESC
           LIMIT ? OFFSET ?`,
          params,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      }),
      new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM favorite_players 
           WHERE user_id = ? ${platformFilter}`,
          params.slice(0, platform ? 2 : 1),
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
      favorites,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get favorite players'
    });
  }
});

/**
 * POST /api/favorites
 * Add a player to favorites
 */
router.post('/',
  authenticate,
  validateBody({
    playerName: { 
      required: true, 
      type: 'string', 
      minLength: 2, 
      maxLength: 50 
    },
    platform: { 
      required: true, 
      enum: ['chess.com', 'lichess', 'fics', 'other'] 
    },
    notes: { 
      type: 'string', 
      maxLength: 500 
    },
    notificationsEnabled: { 
      type: 'boolean' 
    }
  }),
  logActivity('favorite_player_added'),
  async (req, res) => {
    try {
      const { playerName, platform, notes, notificationsEnabled = true } = req.body;

      const pool = getPool();
      const connectionInfo = await pool.acquire();
      const db = connectionInfo.connection;

      // Check if already exists
      const existing = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM favorite_players WHERE user_id = ? AND player_name = ? AND platform = ?',
          [req.user.id, playerName, platform],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (existing) {
        await pool.release(connectionInfo);
        return res.status(400).json({
          success: false,
          error: 'Player is already in your favorites'
        });
      }

      // Add to favorites
      const result = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO favorite_players (user_id, player_name, platform, notes, notifications_enabled)
           VALUES (?, ?, ?, ?, ?)`,
          [req.user.id, playerName, platform, notes || null, notificationsEnabled],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          }
        );
      });

      await pool.release(connectionInfo);

      logger.info(`User ${req.user.username} added favorite player: ${playerName} (${platform})`);

      res.status(201).json({
        success: true,
        message: 'Player added to favorites',
        favorite: {
          id: result.id,
          playerName,
          platform,
          notes,
          notificationsEnabled
        }
      });
    } catch (error) {
      logger.error('Add favorite error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add player to favorites'
      });
    }
  }
);

/**
 * PUT /api/favorites/:id
 * Update favorite player
 */
router.put('/:id',
  authenticate,
  validateBody({
    notes: { type: 'string', maxLength: 500 },
    notificationsEnabled: { type: 'boolean' }
  }),
  logActivity('favorite_player_updated'),
  async (req, res) => {
    try {
      const favoriteId = parseInt(req.params.id);
      const { notes, notificationsEnabled } = req.body;

      const pool = getPool();
      const connectionInfo = await pool.acquire();
      const db = connectionInfo.connection;

      // Verify ownership
      const favorite = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM favorite_players WHERE id = ? AND user_id = ?',
          [favoriteId, req.user.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!favorite) {
        await pool.release(connectionInfo);
        return res.status(404).json({
          success: false,
          error: 'Favorite player not found'
        });
      }

      // Build update query
      const updates = [];
      const values = [];

      if (notes !== undefined) {
        updates.push('notes = ?');
        values.push(notes);
      }

      if (notificationsEnabled !== undefined) {
        updates.push('notifications_enabled = ?');
        values.push(notificationsEnabled);
      }

      if (updates.length === 0) {
        await pool.release(connectionInfo);
        return res.status(400).json({
          success: false,
          error: 'No valid fields to update'
        });
      }

      values.push(favoriteId);

      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE favorite_players SET ${updates.join(', ')} WHERE id = ?`,
          values,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await pool.release(connectionInfo);

      res.json({
        success: true,
        message: 'Favorite player updated'
      });
    } catch (error) {
      logger.error('Update favorite error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update favorite player'
      });
    }
  }
);

/**
 * DELETE /api/favorites/:id
 * Remove player from favorites
 */
router.delete('/:id', authenticate, logActivity('favorite_player_removed'), async (req, res) => {
  try {
    const favoriteId = parseInt(req.params.id);

    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const db = connectionInfo.connection;

    // Verify ownership and get player info for logging
    const favorite = await new Promise((resolve, reject) => {
      db.get(
        'SELECT player_name, platform FROM favorite_players WHERE id = ? AND user_id = ?',
        [favoriteId, req.user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!favorite) {
      await pool.release(connectionInfo);
      return res.status(404).json({
        success: false,
        error: 'Favorite player not found'
      });
    }

    // Remove from favorites
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM favorite_players WHERE id = ?',
        [favoriteId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await pool.release(connectionInfo);

    logger.info(`User ${req.user.username} removed favorite: ${favorite.player_name} (${favorite.platform})`);

    res.json({
      success: true,
      message: 'Player removed from favorites'
    });
  } catch (error) {
    logger.error('Remove favorite error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove player from favorites'
    });
  }
});

/**
 * GET /api/favorites/:id/stats
 * Get statistics for a favorite player
 */
router.get('/:id/stats', authenticate, async (req, res) => {
  try {
    const favoriteId = parseInt(req.params.id);

    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const db = connectionInfo.connection;

    // Verify ownership and get player info
    const favorite = await new Promise((resolve, reject) => {
      db.get(
        'SELECT player_name, platform FROM favorite_players WHERE id = ? AND user_id = ?',
        [favoriteId, req.user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!favorite) {
      await pool.release(connectionInfo);
      return res.status(404).json({
        success: false,
        error: 'Favorite player not found'
      });
    }

    await pool.release(connectionInfo);

    // This would integrate with your game search to get player stats
    // For now, return placeholder data structure
    const stats = {
      playerName: favorite.player_name,
      platform: favorite.platform,
      totalGames: 0,
      recentGames: [],
      openingPreferences: {},
      ratingHistory: [],
      lastUpdated: new Date().toISOString(),
      // TODO: Integrate with actual game data
      placeholder: true
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Get favorite stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get player statistics'
    });
  }
});

/**
 * POST /api/favorites/check-updates
 * Check for updates on all favorite players
 */
router.post('/check-updates', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const db = connectionInfo.connection;

    // Get all favorites for this user
    const favorites = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, player_name, platform, last_checked FROM favorite_players WHERE user_id = ?',
        [req.user.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    // Update last_checked timestamp for all
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE favorite_players SET last_checked = CURRENT_TIMESTAMP WHERE user_id = ?',
        [req.user.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await pool.release(connectionInfo);

    // TODO: Implement actual checking logic with external APIs
    // For now, simulate the process
    const updates = favorites.map(fav => ({
      id: fav.id,
      playerName: fav.player_name,
      platform: fav.platform,
      hasUpdates: Math.random() > 0.7, // Random for demonstration
      lastChecked: new Date().toISOString()
    }));

    logger.info(`Checked updates for ${favorites.length} favorite players for user ${req.user.username}`);

    res.json({
      success: true,
      message: 'Updates checked for all favorite players',
      updates,
      totalChecked: favorites.length
    });
  } catch (error) {
    logger.error('Check updates error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check for updates'
    });
  }
});

/**
 * GET /api/favorites/search/:platform/:query
 * Search for players to add to favorites
 */
router.get('/search/:platform/:query', authenticate, async (req, res) => {
  try {
    const { platform, query } = req.params;
    const { limit = 10 } = req.query;

    if (query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters long'
      });
    }

    // TODO: Integrate with actual player search APIs
    // For now, return mock results
    const mockResults = [
      {
        username: `${query}_player1`,
        displayName: `${query.charAt(0).toUpperCase() + query.slice(1)} Player 1`,
        rating: 1800,
        country: 'US',
        lastOnline: new Date().toISOString(),
        verified: true
      },
      {
        username: `${query}_player2`,
        displayName: `${query.charAt(0).toUpperCase() + query.slice(1)} Player 2`,
        rating: 2100,
        country: 'GB',
        lastOnline: new Date(Date.now() - 86400000).toISOString(),
        verified: false
      }
    ].slice(0, parseInt(limit));

    res.json({
      success: true,
      query,
      platform,
      results: mockResults,
      count: mockResults.length
    });
  } catch (error) {
    logger.error('Player search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search for players'
    });
  }
});

module.exports = router;