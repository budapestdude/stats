/**
 * Game Collections Routes
 * Manages user's personal game collections and study sets
 */

const express = require('express');
const router = express.Router();
const { authenticate, validateBody, logActivity } = require('../middleware/auth');
const { getPool } = require('../services/connection-pool');
const logger = require('../utils/logger');

/**
 * GET /api/collections
 * Get user's game collections
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, publicOnly = false } = req.query;
    const offset = (page - 1) * limit;

    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const db = connectionInfo.connection;

    const publicFilter = publicOnly === 'true' ? 'AND is_public = 1' : '';
    const params = [req.user.id, parseInt(limit), offset];

    const [collections, total] = await Promise.all([
      new Promise((resolve, reject) => {
        db.all(
          `SELECT id, name, description, is_public, tags, created_at, updated_at,
                  game_count, view_count
           FROM game_collections 
           WHERE user_id = ? ${publicFilter}
           ORDER BY updated_at DESC
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
          `SELECT COUNT(*) as count FROM game_collections 
           WHERE user_id = ? ${publicFilter}`,
          [req.user.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      })
    ]);

    await pool.release(connectionInfo);

    // Parse tags for each collection
    const collectionsWithTags = collections.map(collection => ({
      ...collection,
      tags: collection.tags ? collection.tags.split(',').map(tag => tag.trim()) : []
    }));

    res.json({
      success: true,
      collections: collectionsWithTags,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get collections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get collections'
    });
  }
});

/**
 * POST /api/collections
 * Create a new game collection
 */
router.post('/',
  authenticate,
  validateBody({
    name: { 
      required: true, 
      type: 'string', 
      minLength: 1, 
      maxLength: 100 
    },
    description: { 
      type: 'string', 
      maxLength: 500 
    },
    isPublic: { 
      type: 'boolean' 
    },
    tags: {
      type: 'string',
      maxLength: 200,
      validate: (value) => {
        if (value && value.split(',').length > 10) {
          return 'Maximum 10 tags allowed';
        }
      }
    }
  }),
  logActivity('collection_created'),
  async (req, res) => {
    try {
      const { name, description, isPublic = false, tags } = req.body;

      const pool = getPool();
      const connectionInfo = await pool.acquire();
      const db = connectionInfo.connection;

      // Check if collection name already exists for this user
      const existing = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM game_collections WHERE user_id = ? AND name = ?',
          [req.user.id, name],
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
          error: 'A collection with this name already exists'
        });
      }

      // Create collection
      const result = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO game_collections (user_id, name, description, is_public, tags)
           VALUES (?, ?, ?, ?, ?)`,
          [req.user.id, name, description || null, isPublic, tags || null],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          }
        );
      });

      await pool.release(connectionInfo);

      logger.info(`User ${req.user.username} created collection: ${name}`);

      res.status(201).json({
        success: true,
        message: 'Collection created successfully',
        collection: {
          id: result.id,
          name,
          description,
          isPublic,
          tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
          gameCount: 0,
          viewCount: 0,
          createdAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Create collection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create collection'
      });
    }
  }
);

/**
 * GET /api/collections/:id
 * Get a specific collection with its games
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const collectionId = parseInt(req.params.id);
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const db = connectionInfo.connection;

    // Get collection info
    const collection = await new Promise((resolve, reject) => {
      db.get(
        `SELECT id, name, description, is_public, tags, created_at, updated_at,
                game_count, view_count, user_id
         FROM game_collections 
         WHERE id = ?`,
        [collectionId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!collection) {
      await pool.release(connectionInfo);
      return res.status(404).json({
        success: false,
        error: 'Collection not found'
      });
    }

    // Check permissions
    if (collection.user_id !== req.user.id && !collection.is_public) {
      await pool.release(connectionInfo);
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get games in collection
    const [games, total] = await Promise.all([
      new Promise((resolve, reject) => {
        db.all(
          `SELECT id, game_id, pgn, white_player, black_player, result, date,
                  event, eco, opening, notes, added_at, position_order
           FROM collection_games 
           WHERE collection_id = ?
           ORDER BY position_order ASC, added_at DESC
           LIMIT ? OFFSET ?`,
          [collectionId, parseInt(limit), offset],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      }),
      new Promise((resolve, reject) => {
        db.get(
          'SELECT COUNT(*) as count FROM collection_games WHERE collection_id = ?',
          [collectionId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      })
    ]);

    // Increment view count if not owner
    if (collection.user_id !== req.user.id) {
      db.run(
        'UPDATE game_collections SET view_count = view_count + 1 WHERE id = ?',
        [collectionId]
      );
    }

    await pool.release(connectionInfo);

    res.json({
      success: true,
      collection: {
        ...collection,
        tags: collection.tags ? collection.tags.split(',').map(tag => tag.trim()) : [],
        isOwner: collection.user_id === req.user.id
      },
      games,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get collection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get collection'
    });
  }
});

/**
 * PUT /api/collections/:id
 * Update collection details
 */
router.put('/:id',
  authenticate,
  validateBody({
    name: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', maxLength: 500 },
    isPublic: { type: 'boolean' },
    tags: { type: 'string', maxLength: 200 }
  }),
  logActivity('collection_updated'),
  async (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const { name, description, isPublic, tags } = req.body;

      const pool = getPool();
      const connectionInfo = await pool.acquire();
      const db = connectionInfo.connection;

      // Verify ownership
      const collection = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM game_collections WHERE id = ? AND user_id = ?',
          [collectionId, req.user.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!collection) {
        await pool.release(connectionInfo);
        return res.status(404).json({
          success: false,
          error: 'Collection not found'
        });
      }

      // Build update query
      const updates = [];
      const values = [];

      if (name !== undefined) {
        // Check for name conflicts
        const nameConflict = await new Promise((resolve, reject) => {
          db.get(
            'SELECT id FROM game_collections WHERE user_id = ? AND name = ? AND id != ?',
            [req.user.id, name, collectionId],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });

        if (nameConflict) {
          await pool.release(connectionInfo);
          return res.status(400).json({
            success: false,
            error: 'A collection with this name already exists'
          });
        }

        updates.push('name = ?');
        values.push(name);
      }

      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
      }

      if (isPublic !== undefined) {
        updates.push('is_public = ?');
        values.push(isPublic);
      }

      if (tags !== undefined) {
        updates.push('tags = ?');
        values.push(tags);
      }

      if (updates.length === 0) {
        await pool.release(connectionInfo);
        return res.status(400).json({
          success: false,
          error: 'No valid fields to update'
        });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(collectionId);

      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE game_collections SET ${updates.join(', ')} WHERE id = ?`,
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
        message: 'Collection updated successfully'
      });
    } catch (error) {
      logger.error('Update collection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update collection'
      });
    }
  }
);

/**
 * DELETE /api/collections/:id
 * Delete a collection
 */
router.delete('/:id', authenticate, logActivity('collection_deleted'), async (req, res) => {
  try {
    const collectionId = parseInt(req.params.id);

    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const db = connectionInfo.connection;

    // Verify ownership and get collection info
    const collection = await new Promise((resolve, reject) => {
      db.get(
        'SELECT name FROM game_collections WHERE id = ? AND user_id = ?',
        [collectionId, req.user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!collection) {
      await pool.release(connectionInfo);
      return res.status(404).json({
        success: false,
        error: 'Collection not found'
      });
    }

    // Delete collection (cascade will handle collection_games)
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM game_collections WHERE id = ?',
        [collectionId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await pool.release(connectionInfo);

    logger.info(`User ${req.user.username} deleted collection: ${collection.name}`);

    res.json({
      success: true,
      message: 'Collection deleted successfully'
    });
  } catch (error) {
    logger.error('Delete collection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete collection'
    });
  }
});

/**
 * POST /api/collections/:id/games
 * Add a game to collection
 */
router.post('/:id/games',
  authenticate,
  validateBody({
    gameId: { type: 'number' },
    pgn: { type: 'string', maxLength: 10000 },
    whitePlayer: { type: 'string', maxLength: 100 },
    blackPlayer: { type: 'string', maxLength: 100 },
    result: { enum: ['1-0', '0-1', '1/2-1/2', '*'] },
    date: { type: 'string' },
    event: { type: 'string', maxLength: 200 },
    eco: { type: 'string', maxLength: 3 },
    opening: { type: 'string', maxLength: 200 },
    notes: { type: 'string', maxLength: 1000 },
    positionOrder: { type: 'number' }
  }),
  logActivity('game_added_to_collection'),
  async (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const gameData = req.body;

      // Validate that at least gameId or pgn is provided
      if (!gameData.gameId && !gameData.pgn) {
        return res.status(400).json({
          success: false,
          error: 'Either gameId or PGN must be provided'
        });
      }

      const pool = getPool();
      const connectionInfo = await pool.acquire();
      const db = connectionInfo.connection;

      // Verify collection ownership
      const collection = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM game_collections WHERE id = ? AND user_id = ?',
          [collectionId, req.user.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!collection) {
        await pool.release(connectionInfo);
        return res.status(404).json({
          success: false,
          error: 'Collection not found'
        });
      }

      // Add game to collection
      const result = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO collection_games (
             collection_id, game_id, pgn, white_player, black_player,
             result, date, event, eco, opening, notes, position_order
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            collectionId,
            gameData.gameId || null,
            gameData.pgn || null,
            gameData.whitePlayer || null,
            gameData.blackPlayer || null,
            gameData.result || null,
            gameData.date || null,
            gameData.event || null,
            gameData.eco || null,
            gameData.opening || null,
            gameData.notes || null,
            gameData.positionOrder || null
          ],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          }
        );
      });

      // Update collection game count
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE game_collections SET game_count = game_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [collectionId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await pool.release(connectionInfo);

      res.status(201).json({
        success: true,
        message: 'Game added to collection',
        gameId: result.id
      });
    } catch (error) {
      logger.error('Add game to collection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add game to collection'
      });
    }
  }
);

/**
 * DELETE /api/collections/:id/games/:gameId
 * Remove game from collection
 */
router.delete('/:id/games/:gameId', authenticate, async (req, res) => {
  try {
    const collectionId = parseInt(req.params.id);
    const gameId = parseInt(req.params.gameId);

    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const db = connectionInfo.connection;

    // Verify collection ownership
    const collection = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM game_collections WHERE id = ? AND user_id = ?',
        [collectionId, req.user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!collection) {
      await pool.release(connectionInfo);
      return res.status(404).json({
        success: false,
        error: 'Collection not found'
      });
    }

    // Remove game from collection
    const result = await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM collection_games WHERE id = ? AND collection_id = ?',
        [gameId, collectionId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });

    if (result === 0) {
      await pool.release(connectionInfo);
      return res.status(404).json({
        success: false,
        error: 'Game not found in collection'
      });
    }

    // Update collection game count
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE game_collections SET game_count = game_count - 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [collectionId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await pool.release(connectionInfo);

    res.json({
      success: true,
      message: 'Game removed from collection'
    });
  } catch (error) {
    logger.error('Remove game from collection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove game from collection'
    });
  }
});

/**
 * GET /api/collections/public
 * Get public collections from all users
 */
router.get('/browse/public', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const db = connectionInfo.connection;

    const searchFilter = search ? 'AND (name LIKE ? OR description LIKE ? OR tags LIKE ?)' : '';
    const params = [parseInt(limit), offset];
    
    if (search) {
      const searchTerm = `%${search}%`;
      params.unshift(searchTerm, searchTerm, searchTerm);
    }

    const [collections, total] = await Promise.all([
      new Promise((resolve, reject) => {
        db.all(
          `SELECT gc.id, gc.name, gc.description, gc.tags, gc.created_at,
                  gc.game_count, gc.view_count,
                  u.username, u.display_name
           FROM game_collections gc
           JOIN users u ON gc.user_id = u.id
           WHERE gc.is_public = 1 ${searchFilter}
           ORDER BY gc.view_count DESC, gc.created_at DESC
           LIMIT ? OFFSET ?`,
          params,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      }),
      new Promise((resolve, reject) => {
        const countParams = search ? params.slice(0, -2) : [];
        db.get(
          `SELECT COUNT(*) as count FROM game_collections gc
           JOIN users u ON gc.user_id = u.id
           WHERE gc.is_public = 1 ${searchFilter}`,
          countParams,
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      })
    ]);

    await pool.release(connectionInfo);

    const collectionsWithTags = collections.map(collection => ({
      ...collection,
      tags: collection.tags ? collection.tags.split(',').map(tag => tag.trim()) : []
    }));

    res.json({
      success: true,
      collections: collectionsWithTags,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Browse public collections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to browse collections'
    });
  }
});

module.exports = router;