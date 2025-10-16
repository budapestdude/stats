/**
 * Opening Tree Explorer Service
 * Creates an interactive tree of opening variations with statistics
 */

const { Chess } = require('chess.js');
const { getPool } = require('./connection-pool');
const logger = require('../utils/logger');

class OpeningTreeService {
  constructor() {
    this.pool = getPool();
    this.cache = new Map();
    this.cacheTimeout = 20 * 60 * 1000; // 20 minutes
    this.openingTree = null;
  }

  /**
   * Build opening tree from database
   */
  async buildOpeningTree(maxDepth = 15, minGames = 5) {
    const cacheKey = `tree:${maxDepth}:${minGames}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      logger.info(`Building opening tree (depth: ${maxDepth}, minGames: ${minGames})`);
      
      const connectionInfo = await this.pool.acquire();
      const connection = connectionInfo.connection;

      // Get games with PGN data for tree building
      const games = await new Promise((resolve, reject) => {
        connection.all(`
          SELECT id, white_player, black_player, result, eco, opening, pgn, ply_count
          FROM games 
          WHERE pgn IS NOT NULL 
            AND pgn != '' 
            AND ply_count >= ${maxDepth * 2}
          ORDER BY RANDOM()
          LIMIT 50000
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      logger.info(`Processing ${games.length} games for opening tree`);

      const tree = this.buildTreeFromGames(games, maxDepth, minGames);
      
      this.cache.set(cacheKey, {
        data: tree,
        timestamp: Date.now()
      });

      this.openingTree = tree;
      return tree;
    } catch (error) {
      logger.error('Error building opening tree:', error);
      throw error;
    }
  }

  /**
   * Process games to build tree structure
   */
  buildTreeFromGames(games, maxDepth, minGames) {
    const moveTree = new Map();
    let processedGames = 0;

    for (const game of games) {
      try {
        if (!game.pgn) continue;

        const chess = new Chess();
        const moves = this.parsePGN(game.pgn);
        let currentNode = moveTree;
        let position = '';

        for (let i = 0; i < Math.min(moves.length, maxDepth); i++) {
          const move = moves[i];
          
          try {
            chess.move(move);
            position = chess.fen();
          } catch (err) {
            break; // Invalid move, skip rest of game
          }

          const moveKey = `${move}`;
          
          if (!currentNode.has(moveKey)) {
            currentNode.set(moveKey, {
              move: move,
              san: move,
              position: position,
              games: 0,
              white: 0,
              draws: 0,
              black: 0,
              children: new Map(),
              eco: game.eco || null,
              opening: game.opening || null,
              popularity: 0,
              whiteWinRate: 0,
              drawRate: 0,
              blackWinRate: 0
            });
          }

          const node = currentNode.get(moveKey);
          node.games++;
          
          // Update statistics
          if (game.result === '1-0') node.white++;
          else if (game.result === '1/2-1/2') node.draws++;
          else if (game.result === '0-1') node.black++;

          // Update ECO and opening info (use most common)
          if (game.eco && !node.eco) node.eco = game.eco;
          if (game.opening && !node.opening) node.opening = game.opening;

          currentNode = node.children;
        }

        processedGames++;
        if (processedGames % 5000 === 0) {
          logger.info(`Processed ${processedGames}/${games.length} games`);
        }
      } catch (err) {
        continue; // Skip malformed games
      }
    }

    // Calculate statistics and filter by minimum games
    const rootTree = this.calculateStatisticsAndFilter(moveTree, minGames);
    
    logger.info(`Opening tree built with ${this.countNodes(rootTree)} nodes`);
    
    return {
      root: rootTree,
      stats: {
        totalGames: processedGames,
        maxDepth,
        minGames,
        nodeCount: this.countNodes(rootTree),
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Parse PGN string to extract moves
   */
  parsePGN(pgn) {
    if (!pgn) return [];
    
    // Remove comments and annotations
    let cleanPgn = pgn.replace(/\{[^}]*\}/g, '')  // Remove comments
                     .replace(/\([^)]*\)/g, '')   // Remove variations
                     .replace(/\$\d+/g, '')       // Remove numeric annotations
                     .replace(/[!?]+/g, '')       // Remove move annotations
                     .trim();
    
    // Extract just the moves, removing move numbers
    const moveMatches = cleanPgn.match(/(?:\d+\.+\s*)?([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O(?:-O)?)/g);
    
    return moveMatches || [];
  }

  /**
   * Calculate statistics and filter nodes
   */
  calculateStatisticsAndFilter(nodeMap, minGames) {
    const filtered = new Map();

    for (const [key, node] of nodeMap) {
      if (node.games >= minGames) {
        // Calculate percentages
        node.whiteWinRate = ((node.white / node.games) * 100).toFixed(1);
        node.drawRate = ((node.draws / node.games) * 100).toFixed(1);
        node.blackWinRate = ((node.black / node.games) * 100).toFixed(1);
        node.popularity = node.games; // Will be normalized later

        // Recursively process children
        node.children = this.calculateStatisticsAndFilter(node.children, minGames);
        
        // Convert children Map to Array for easier frontend handling
        node.childrenArray = Array.from(node.children.entries()).map(([moveKey, child]) => ({
          move: moveKey,
          ...child
        })).sort((a, b) => b.games - a.games);

        filtered.set(key, node);
      }
    }

    return filtered;
  }

  /**
   * Count total nodes in tree
   */
  countNodes(nodeMap) {
    let count = nodeMap.size;
    for (const [, node] of nodeMap) {
      count += this.countNodes(node.children);
    }
    return count;
  }

  /**
   * Get opening tree branch starting from a position
   */
  async getTreeBranch(moves = [], depth = 10) {
    if (!this.openingTree) {
      await this.buildOpeningTree();
    }

    let currentNode = this.openingTree.root;
    let path = [];

    // Navigate to the requested position
    for (const move of moves) {
      if (currentNode.has(move)) {
        const node = currentNode.get(move);
        path.push({
          move: move,
          ...node,
          childrenArray: undefined // Don't include in path
        });
        currentNode = node.children;
      } else {
        return {
          success: false,
          error: 'Position not found in opening tree',
          path: path
        };
      }
    }

    // Get children up to specified depth
    const children = this.getChildrenWithDepth(currentNode, depth);

    return {
      success: true,
      position: {
        moves: moves,
        path: path
      },
      children: children,
      stats: this.openingTree.stats
    };
  }

  /**
   * Get children nodes with depth limit
   */
  getChildrenWithDepth(nodeMap, maxDepth) {
    if (maxDepth <= 0) return [];

    const children = [];
    for (const [moveKey, node] of nodeMap) {
      const childNode = {
        move: moveKey,
        san: node.san,
        games: node.games,
        white: node.white,
        draws: node.draws,
        black: node.black,
        whiteWinRate: node.whiteWinRate,
        drawRate: node.drawRate,
        blackWinRate: node.blackWinRate,
        eco: node.eco,
        opening: node.opening,
        hasChildren: node.children.size > 0
      };

      if (maxDepth > 1 && node.children.size > 0) {
        childNode.children = this.getChildrenWithDepth(node.children, maxDepth - 1);
      }

      children.push(childNode);
    }

    return children.sort((a, b) => b.games - a.games);
  }

  /**
   * Get popular opening lines
   */
  async getPopularLines(minGames = 100, limit = 20) {
    const cacheKey = `popular:${minGames}:${limit}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const connectionInfo = await this.pool.acquire();
      const connection = connectionInfo.connection;

      const lines = await new Promise((resolve, reject) => {
        connection.all(`
          SELECT 
            eco,
            opening,
            COUNT(*) as games,
            SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) as white_wins,
            SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
            SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) as black_wins,
            AVG(ply_count) as avg_length
          FROM games 
          WHERE eco IS NOT NULL AND opening IS NOT NULL
          GROUP BY eco, opening
          HAVING games >= ?
          ORDER BY games DESC
          LIMIT ?
        `, [minGames, limit], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      const result = lines.map(line => ({
        ...line,
        name: `${line.eco} - ${line.opening}`,
        whiteWinRate: ((line.white_wins / line.games) * 100).toFixed(1),
        drawRate: ((line.draws / line.games) * 100).toFixed(1),
        blackWinRate: ((line.black_wins / line.games) * 100).toFixed(1),
        avgLength: Math.round(line.avg_length / 2) // Convert ply to moves
      }));

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      logger.error('Error getting popular lines:', error);
      throw error;
    }
  }

  /**
   * Get opening statistics by ECO code
   */
  async getOpeningStats(eco) {
    const cacheKey = `eco:${eco}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const connectionInfo = await this.pool.acquire();
      const connection = connectionInfo.connection;

      // Get main statistics
      const stats = await new Promise((resolve, reject) => {
        connection.get(`
          SELECT 
            eco,
            opening,
            COUNT(*) as games,
            SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) as white_wins,
            SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
            SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) as black_wins,
            AVG(ply_count) as avg_length,
            MIN(date) as earliest_game,
            MAX(date) as latest_game
          FROM games 
          WHERE eco = ?
          GROUP BY eco, opening
          ORDER BY games DESC
          LIMIT 1
        `, [eco], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!stats) {
        await this.pool.release(connectionInfo);
        return null;
      }

      // Get top players in this opening
      const topPlayers = await new Promise((resolve, reject) => {
        connection.all(`
          SELECT 
            player_name,
            COUNT(*) as games,
            SUM(wins) as wins,
            SUM(draws) as draws,
            SUM(losses) as losses
          FROM (
            SELECT 
              white_player as player_name,
              CASE WHEN result = '1-0' THEN 1 ELSE 0 END as wins,
              CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END as draws,
              CASE WHEN result = '0-1' THEN 1 ELSE 0 END as losses
            FROM games WHERE eco = ?
            UNION ALL
            SELECT 
              black_player as player_name,
              CASE WHEN result = '0-1' THEN 1 ELSE 0 END as wins,
              CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END as draws,
              CASE WHEN result = '1-0' THEN 1 ELSE 0 END as losses
            FROM games WHERE eco = ?
          ) combined
          WHERE player_name IS NOT NULL
          GROUP BY player_name
          HAVING games >= 5
          ORDER BY games DESC
          LIMIT 10
        `, [eco, eco], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      const result = {
        ...stats,
        whiteWinRate: ((stats.white_wins / stats.games) * 100).toFixed(1),
        drawRate: ((stats.draws / stats.games) * 100).toFixed(1),
        blackWinRate: ((stats.black_wins / stats.games) * 100).toFixed(1),
        avgMoves: Math.round(stats.avg_length / 2),
        topPlayers: topPlayers.map(player => ({
          ...player,
          winRate: ((player.wins / player.games) * 100).toFixed(1),
          score: ((player.wins + player.draws * 0.5) / player.games * 100).toFixed(1)
        }))
      };

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      logger.error('Error getting opening stats:', error);
      throw error;
    }
  }

  /**
   * Search opening variations
   */
  async searchVariations(query, limit = 20) {
    try {
      const connectionInfo = await this.pool.acquire();
      const connection = connectionInfo.connection;

      const variations = await new Promise((resolve, reject) => {
        connection.all(`
          SELECT DISTINCT
            eco,
            opening,
            COUNT(*) as games,
            SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) as white_wins,
            SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
            SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) as black_wins
          FROM games 
          WHERE (eco LIKE ? OR opening LIKE ?)
            AND eco IS NOT NULL 
            AND opening IS NOT NULL
          GROUP BY eco, opening
          HAVING games >= 5
          ORDER BY games DESC
          LIMIT ?
        `, [`%${query}%`, `%${query}%`, limit], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      return variations.map(variation => ({
        ...variation,
        name: `${variation.eco} - ${variation.opening}`,
        whiteWinRate: ((variation.white_wins / variation.games) * 100).toFixed(1),
        drawRate: ((variation.draws / variation.games) * 100).toFixed(1),
        blackWinRate: ((variation.black_wins / variation.games) * 100).toFixed(1)
      }));
    } catch (error) {
      logger.error('Error searching variations:', error);
      throw error;
    }
  }
}

module.exports = new OpeningTreeService();