/**
 * Advanced Search and Discovery Service
 * Provides powerful search capabilities for chess data
 */

const Fuse = require('fuse.js');
const { Chess } = require('chess.js');
const { getPool } = require('./connection-pool');
const { QueryBuilder } = require('../utils/query-builder');
const logger = require('../utils/logger');

class AdvancedSearchService {
  constructor() {
    this.pool = getPool();
    this.cache = new Map();
    this.cacheTimeout = 15 * 60 * 1000; // 15 minutes
    this.playerIndex = null;
    this.openingIndex = null;
    this.tournamentIndex = null;
  }

  /**
   * Initialize search indexes
   */
  async initializeIndexes() {
    try {
      logger.info('Initializing search indexes...');
      
      // Build player index
      await this.buildPlayerIndex();
      
      // Build opening index
      await this.buildOpeningIndex();
      
      // Build tournament index
      await this.buildTournamentIndex();
      
      logger.info('Search indexes initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize search indexes:', error);
      throw error;
    }
  }

  /**
   * Build player search index
   */
  async buildPlayerIndex() {
    const connectionInfo = await this.pool.acquire();
    const connection = connectionInfo.connection;

    try {
      const players = await new Promise((resolve, reject) => {
        connection.all(`
          SELECT 
            white_player as name,
            COUNT(*) as games,
            SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
            SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) as losses,
            AVG(ply_count) as avg_game_length
          FROM games 
          WHERE white_player IS NOT NULL 
          GROUP BY white_player
          HAVING games >= 3
          
          UNION ALL
          
          SELECT 
            black_player as name,
            COUNT(*) as games,
            SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
            SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) as losses,
            AVG(ply_count) as avg_game_length
          FROM games 
          WHERE black_player IS NOT NULL 
          GROUP BY black_player
          HAVING games >= 3
          
          ORDER BY games DESC
          LIMIT 10000
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      // Aggregate player data
      const playerMap = new Map();
      players.forEach(player => {
        if (playerMap.has(player.name)) {
          const existing = playerMap.get(player.name);
          existing.games += player.games;
          existing.wins += player.wins;
          existing.draws += player.draws;
          existing.losses += player.losses;
          existing.avg_game_length = (existing.avg_game_length + player.avg_game_length) / 2;
        } else {
          playerMap.set(player.name, {
            ...player,
            winRate: player.games > 0 ? (player.wins / player.games * 100).toFixed(1) : 0,
            searchTerms: this.generatePlayerSearchTerms(player.name)
          });
        }
      });

      const playerData = Array.from(playerMap.values());

      this.playerIndex = new Fuse(playerData, {
        keys: [
          { name: 'name', weight: 0.7 },
          { name: 'searchTerms', weight: 0.3 }
        ],
        threshold: 0.3,
        includeScore: true
      });

      logger.info(`Player index built with ${playerData.length} players`);
    } finally {
      await this.pool.release(connectionInfo);
    }
  }

  /**
   * Build opening search index
   */
  async buildOpeningIndex() {
    const connectionInfo = await this.pool.acquire();
    const connection = connectionInfo.connection;

    try {
      const openings = await new Promise((resolve, reject) => {
        connection.all(`
          SELECT 
            eco,
            opening,
            COUNT(*) as frequency,
            SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) as white_wins,
            SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
            SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) as black_wins,
            AVG(ply_count) as avg_length
          FROM games 
          WHERE eco IS NOT NULL AND opening IS NOT NULL
          GROUP BY eco, opening
          HAVING frequency >= 5
          ORDER BY frequency DESC
          LIMIT 5000
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      const openingData = openings.map(opening => ({
        ...opening,
        name: `${opening.eco} - ${opening.opening}`,
        whiteScore: opening.frequency > 0 ? 
          ((opening.white_wins + opening.draws * 0.5) / opening.frequency * 100).toFixed(1) : 0,
        searchTerms: this.generateOpeningSearchTerms(opening)
      }));

      this.openingIndex = new Fuse(openingData, {
        keys: [
          { name: 'eco', weight: 0.4 },
          { name: 'opening', weight: 0.4 },
          { name: 'searchTerms', weight: 0.2 }
        ],
        threshold: 0.4,
        includeScore: true
      });

      logger.info(`Opening index built with ${openingData.length} openings`);
    } finally {
      await this.pool.release(connectionInfo);
    }
  }

  /**
   * Build tournament search index
   */
  async buildTournamentIndex() {
    const connectionInfo = await this.pool.acquire();
    const connection = connectionInfo.connection;

    try {
      const tournaments = await new Promise((resolve, reject) => {
        connection.all(`
          SELECT 
            tournament_name,
            COUNT(*) as games,
            COUNT(DISTINCT white_player) + COUNT(DISTINCT black_player) as participants,
            MIN(date) as start_date,
            MAX(date) as end_date
          FROM games 
          WHERE tournament_name IS NOT NULL
          GROUP BY tournament_name
          HAVING games >= 10
          ORDER BY games DESC
          LIMIT 1000
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      const tournamentData = tournaments.map(tournament => ({
        ...tournament,
        searchTerms: this.generateTournamentSearchTerms(tournament.tournament_name)
      }));

      this.tournamentIndex = new Fuse(tournamentData, {
        keys: [
          { name: 'tournament_name', weight: 0.8 },
          { name: 'searchTerms', weight: 0.2 }
        ],
        threshold: 0.3,
        includeScore: true
      });

      logger.info(`Tournament index built with ${tournamentData.length} tournaments`);
    } finally {
      await this.pool.release(connectionInfo);
    }
  }

  /**
   * Generate search terms for players
   */
  generatePlayerSearchTerms(name) {
    const terms = [
      name.toLowerCase(),
      ...name.split(' ').map(part => part.toLowerCase()),
      ...name.split(',').map(part => part.trim().toLowerCase())
    ];
    return terms.join(' ');
  }

  /**
   * Generate search terms for openings
   */
  generateOpeningSearchTerms(opening) {
    const terms = [
      opening.eco.toLowerCase(),
      opening.opening.toLowerCase(),
      ...opening.opening.split(/[,:\-\s]+/).map(part => part.toLowerCase())
    ];
    return terms.join(' ');
  }

  /**
   * Generate search terms for tournaments
   */
  generateTournamentSearchTerms(name) {
    const terms = [
      name.toLowerCase(),
      ...name.split(/[\s\-_]+/).map(part => part.toLowerCase())
    ];
    return terms.join(' ');
  }

  /**
   * Advanced game search with multiple criteria
   */
  async searchGames(criteria) {
    const cacheKey = `search:${JSON.stringify(criteria)}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const connectionInfo = await this.pool.acquire();
      const connection = connectionInfo.connection;

      const queryBuilder = new QueryBuilder('games').select('*');
      const conditions = [];
      const params = [];

      // Player search
      if (criteria.player) {
        conditions.push('(white_player LIKE ? OR black_player LIKE ?)');
        params.push(`%${criteria.player}%`, `%${criteria.player}%`);
      }

      if (criteria.whitePlayer) {
        conditions.push('white_player LIKE ?');
        params.push(`%${criteria.whitePlayer}%`);
      }

      if (criteria.blackPlayer) {
        conditions.push('black_player LIKE ?');
        params.push(`%${criteria.blackPlayer}%`);
      }

      // Opening search
      if (criteria.opening) {
        conditions.push('(eco LIKE ? OR opening LIKE ?)');
        params.push(`%${criteria.opening}%`, `%${criteria.opening}%`);
      }

      if (criteria.eco) {
        conditions.push('eco = ?');
        params.push(criteria.eco);
      }

      // Tournament search
      if (criteria.tournament) {
        conditions.push('tournament_name LIKE ?');
        params.push(`%${criteria.tournament}%`);
      }

      // Date range
      if (criteria.dateFrom) {
        conditions.push('date >= ?');
        params.push(criteria.dateFrom);
      }

      if (criteria.dateTo) {
        conditions.push('date <= ?');
        params.push(criteria.dateTo);
      }

      // Result filter
      if (criteria.result) {
        conditions.push('result = ?');
        params.push(criteria.result);
      }

      // Game length filter
      if (criteria.minMoves) {
        conditions.push('ply_count >= ?');
        params.push(criteria.minMoves * 2);
      }

      if (criteria.maxMoves) {
        conditions.push('ply_count <= ?');
        params.push(criteria.maxMoves * 2);
      }

      // Build final query
      let query = queryBuilder.build().sql;
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ` ORDER BY date DESC LIMIT ${criteria.limit || 100} OFFSET ${criteria.offset || 0}`;

      const games = await new Promise((resolve, reject) => {
        connection.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM games';
      if (conditions.length > 0) {
        countQuery += ` WHERE ${conditions.join(' AND ')}`;
      }

      const totalResult = await new Promise((resolve, reject) => {
        connection.get(countQuery, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      await this.pool.release(connectionInfo);

      const result = {
        games: games.map(game => this.enrichGameData(game)),
        total: totalResult.total,
        page: Math.floor((criteria.offset || 0) / (criteria.limit || 100)) + 1,
        totalPages: Math.ceil(totalResult.total / (criteria.limit || 100))
      };

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      logger.error('Error in advanced search:', error);
      throw error;
    }
  }

  /**
   * Search players with fuzzy matching
   */
  searchPlayers(query, limit = 10) {
    if (!this.playerIndex) {
      throw new Error('Player index not initialized');
    }

    const results = this.playerIndex.search(query, { limit });
    return results.map(result => ({
      ...result.item,
      score: result.score
    }));
  }

  /**
   * Search openings with fuzzy matching
   */
  searchOpenings(query, limit = 10) {
    if (!this.openingIndex) {
      throw new Error('Opening index not initialized');
    }

    const results = this.openingIndex.search(query, { limit });
    return results.map(result => ({
      ...result.item,
      score: result.score
    }));
  }

  /**
   * Search tournaments with fuzzy matching
   */
  searchTournaments(query, limit = 10) {
    if (!this.tournamentIndex) {
      throw new Error('Tournament index not initialized');
    }

    const results = this.tournamentIndex.search(query, { limit });
    return results.map(result => ({
      ...result.item,
      score: result.score
    }));
  }

  /**
   * Find similar games based on various criteria
   */
  async findSimilarGames(gameId, criteria = {}) {
    try {
      const connectionInfo = await this.pool.acquire();
      const connection = connectionInfo.connection;

      // Get the reference game
      const referenceGame = await new Promise((resolve, reject) => {
        connection.get(
          'SELECT * FROM games WHERE id = ?',
          [gameId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!referenceGame) {
        throw new Error('Reference game not found');
      }

      // Build similarity query
      const conditions = [];
      const params = [];

      // Similar players (if requested)
      if (criteria.includePlayers !== false) {
        conditions.push(`(
          white_player = ? OR black_player = ? OR 
          white_player = ? OR black_player = ?
        )`);
        params.push(
          referenceGame.white_player,
          referenceGame.white_player,
          referenceGame.black_player,
          referenceGame.black_player
        );
      }

      // Similar opening
      if (criteria.includeOpening !== false && referenceGame.eco) {
        if (conditions.length > 0) conditions.push('OR');
        conditions.push('eco = ?');
        params.push(referenceGame.eco);
      }

      // Similar game length
      if (criteria.includeLength !== false && referenceGame.ply_count) {
        if (conditions.length > 0) conditions.push('OR');
        const lengthTolerance = criteria.lengthTolerance || 10;
        conditions.push('ply_count BETWEEN ? AND ?');
        params.push(
          referenceGame.ply_count - lengthTolerance,
          referenceGame.ply_count + lengthTolerance
        );
      }

      // Similar result
      if (criteria.includeResult !== false) {
        if (conditions.length > 0) conditions.push('OR');
        conditions.push('result = ?');
        params.push(referenceGame.result);
      }

      let query = `
        SELECT *, 
        CASE 
          WHEN white_player = ? OR black_player = ? OR 
               white_player = ? OR black_player = ? THEN 3
          WHEN eco = ? THEN 2
          WHEN result = ? THEN 1
          ELSE 0
        END as similarity_score
        FROM games 
        WHERE id != ? AND (${conditions.join(' ')})
        ORDER BY similarity_score DESC, date DESC
        LIMIT ${criteria.limit || 50}
      `;

      const similarGames = await new Promise((resolve, reject) => {
        connection.all(query, [
          referenceGame.white_player,
          referenceGame.white_player,
          referenceGame.black_player,
          referenceGame.black_player,
          referenceGame.eco,
          referenceGame.result,
          gameId,
          ...params
        ], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      return {
        referenceGame: this.enrichGameData(referenceGame),
        similarGames: similarGames.map(game => this.enrichGameData(game))
      };
    } catch (error) {
      logger.error('Error finding similar games:', error);
      throw error;
    }
  }

  /**
   * Position search using FEN patterns
   */
  async searchByPosition(fen, criteria = {}) {
    try {
      // This is a simplified version - full position search would require
      // storing position data or using a chess engine
      const connectionInfo = await this.pool.acquire();
      const connection = connectionInfo.connection;

      // For now, search by similar opening structure
      const chess = new Chess();
      try {
        chess.load(fen);
        const moves = chess.history({ verbose: true });
        
        if (moves.length >= 5) {
          // Get opening moves
          const openingMoves = moves.slice(0, 5).map(move => move.san).join(' ');
          
          // Search for games with similar opening sequences
          const query = `
            SELECT * FROM games 
            WHERE pgn LIKE ?
            ORDER BY date DESC
            LIMIT ${criteria.limit || 50}
          `;

          const games = await new Promise((resolve, reject) => {
            connection.all(query, [`%${openingMoves}%`], (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            });
          });

          await this.pool.release(connectionInfo);

          return {
            position: fen,
            matchingGames: games.map(game => this.enrichGameData(game))
          };
        }
      } catch (chesErr) {
        logger.warn('Invalid FEN provided:', fen);
      }

      await this.pool.release(connectionInfo);
      return { position: fen, matchingGames: [] };
    } catch (error) {
      logger.error('Error in position search:', error);
      throw error;
    }
  }

  /**
   * Natural language query processing
   */
  async processNaturalQuery(query) {
    const normalizedQuery = query.toLowerCase();
    const criteria = {};

    // Extract players
    const playerMatch = normalizedQuery.match(/(?:games? (?:by|with|of) |player )([a-zA-Z\s]+?)(?:\s|$|,|\.|where|and|or)/);
    if (playerMatch) {
      criteria.player = playerMatch[1].trim();
    }

    // Extract colors
    if (normalizedQuery.includes('white') && normalizedQuery.includes('won')) {
      criteria.result = '1-0';
    } else if (normalizedQuery.includes('black') && normalizedQuery.includes('won')) {
      criteria.result = '0-1';
    } else if (normalizedQuery.includes('draw')) {
      criteria.result = '1/2-1/2';
    }

    // Extract openings
    const openingMatch = normalizedQuery.match(/(?:opening |in )(sicilian|ruy lopez|french|english|italian|spanish|queens gambit|kings indian)/i);
    if (openingMatch) {
      criteria.opening = openingMatch[1];
    }

    // Extract move count
    const movesMatch = normalizedQuery.match(/(?:in |under |less than |within )(\d+) moves?/);
    if (movesMatch) {
      criteria.maxMoves = parseInt(movesMatch[1]);
    }

    const moreThanMovesMatch = normalizedQuery.match(/(?:more than |over |above )(\d+) moves?/);
    if (moreThanMovesMatch) {
      criteria.minMoves = parseInt(moreThanMovesMatch[1]);
    }

    // Extract years
    const yearMatch = normalizedQuery.match(/(?:in |from |year )(\d{4})/);
    if (yearMatch) {
      criteria.dateFrom = `${yearMatch[1]}-01-01`;
      criteria.dateTo = `${yearMatch[1]}-12-31`;
    }

    return this.searchGames(criteria);
  }

  /**
   * Enrich game data with additional computed fields
   */
  enrichGameData(game) {
    return {
      ...game,
      moveCount: game.ply_count ? Math.ceil(game.ply_count / 2) : null,
      gameLength: this.categorizeGameLength(game.ply_count),
      resultText: this.getResultText(game.result),
      year: game.date ? new Date(game.date).getFullYear() : null
    };
  }

  /**
   * Categorize game length
   */
  categorizeGameLength(plyCount) {
    if (!plyCount) return 'Unknown';
    if (plyCount < 40) return 'Short';
    if (plyCount < 80) return 'Medium';
    return 'Long';
  }

  /**
   * Get human-readable result text
   */
  getResultText(result) {
    switch (result) {
      case '1-0': return 'White wins';
      case '0-1': return 'Black wins';
      case '1/2-1/2': return 'Draw';
      default: return 'Unknown';
    }
  }

  /**
   * Get search suggestions
   */
  async getSearchSuggestions(query) {
    const suggestions = {
      players: [],
      openings: [],
      tournaments: [],
      natural: []
    };

    if (query.length >= 2) {
      // Player suggestions
      try {
        suggestions.players = this.searchPlayers(query, 5);
      } catch (err) {
        logger.warn('Player suggestions failed:', err);
      }

      // Opening suggestions
      try {
        suggestions.openings = this.searchOpenings(query, 5);
      } catch (err) {
        logger.warn('Opening suggestions failed:', err);
      }

      // Tournament suggestions
      try {
        suggestions.tournaments = this.searchTournaments(query, 5);
      } catch (err) {
        logger.warn('Tournament suggestions failed:', err);
      }

      // Natural language suggestions
      suggestions.natural = this.generateNaturalSuggestions(query);
    }

    return suggestions;
  }

  /**
   * Generate natural language search suggestions
   */
  generateNaturalSuggestions(query) {
    const suggestions = [];
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('games')) {
      suggestions.push(`games by ${query}`);
      suggestions.push(`${query} games won by white`);
      suggestions.push(`${query} games won by black`);
    }

    if (lowerQuery.includes('opening') || lowerQuery.includes('sicilian') || lowerQuery.includes('french')) {
      suggestions.push(`${query} opening games`);
      suggestions.push(`${query} games in under 30 moves`);
    }

    return suggestions.slice(0, 3);
  }
}

module.exports = new AdvancedSearchService();