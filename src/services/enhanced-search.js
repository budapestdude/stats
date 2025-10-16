/**
 * Enhanced Search Service with Advanced Features
 * Provides high-performance search with caching, pagination, and intelligent query optimization
 */

const Fuse = require('fuse.js');
const { Chess } = require('chess.js');
const { getPool } = require('./connection-pool');
const { QueryBuilder } = require('../utils/query-builder');
const logger = require('../utils/logger');
const crypto = require('crypto');

class EnhancedSearchService {
  constructor() {
    this.pool = getPool();
    
    // Multi-tier caching system
    this.cache = new Map();
    this.hotCache = new Map(); // Frequently accessed items
    this.cacheTimeout = 15 * 60 * 1000; // 15 minutes
    this.hotCacheTimeout = 60 * 60 * 1000; // 1 hour for hot cache
    
    // Search indexes
    this.playerIndex = null;
    this.openingIndex = null;
    this.tournamentIndex = null;
    this.positionIndex = new Map(); // Position hash index
    
    // Performance monitoring
    this.queryStats = new Map();
    this.slowQueryThreshold = 1000; // 1 second
    
    // Prepared statement cache
    this.preparedStatements = new Map();
  }

  /**
   * Initialize all search indexes with optimizations
   */
  async initializeIndexes() {
    const startTime = Date.now();
    try {
      logger.info('Initializing enhanced search indexes...');
      
      // Parallel index building
      await Promise.all([
        this.buildPlayerIndex(),
        this.buildOpeningIndex(),
        this.buildTournamentIndex(),
        this.buildPositionIndex()
      ]);
      
      const duration = Date.now() - startTime;
      logger.info(`Search indexes initialized in ${duration}ms`);
      
      // Schedule periodic index refresh
      this.scheduleIndexRefresh();
    } catch (error) {
      logger.error('Failed to initialize enhanced search indexes:', error);
      throw error;
    }
  }

  /**
   * Build enhanced player index with ratings and statistics
   */
  async buildPlayerIndex() {
    const connectionInfo = await this.pool.acquire();
    const connection = connectionInfo.connection;

    try {
      const query = `
        WITH PlayerStats AS (
          SELECT 
            player_name,
            COUNT(*) as total_games,
            SUM(CASE WHEN color = 'white' AND result = '1-0' THEN 1
                     WHEN color = 'black' AND result = '0-1' THEN 1
                     ELSE 0 END) as wins,
            SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
            MAX(date) as last_game_date,
            MIN(date) as first_game_date,
            AVG(CASE WHEN white_elo IS NOT NULL THEN white_elo 
                     WHEN black_elo IS NOT NULL THEN black_elo 
                     ELSE NULL END) as avg_rating
          FROM (
            SELECT white_player as player_name, 'white' as color, result, date, white_elo, black_elo
            FROM games WHERE white_player IS NOT NULL
            UNION ALL
            SELECT black_player as player_name, 'black' as color, result, date, white_elo, black_elo
            FROM games WHERE black_player IS NOT NULL
          )
          GROUP BY player_name
          HAVING total_games >= 5
        )
        SELECT 
          player_name,
          total_games,
          wins,
          draws,
          (total_games - wins - draws) as losses,
          ROUND(100.0 * wins / total_games, 2) as win_rate,
          ROUND(100.0 * (wins + 0.5 * draws) / total_games, 2) as performance_score,
          avg_rating,
          last_game_date,
          first_game_date
        FROM PlayerStats
        ORDER BY total_games DESC
        LIMIT 20000
      `;

      const players = await new Promise((resolve, reject) => {
        connection.all(query, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      // Create enriched player data
      const playerData = players.map(player => ({
        ...player,
        searchTerms: this.generateEnhancedSearchTerms(player.player_name),
        activity: this.calculateActivityScore(player),
        strength: this.calculateStrengthScore(player)
      }));

      // Build Fuse index with weighted fields
      this.playerIndex = new Fuse(playerData, {
        keys: [
          { name: 'player_name', weight: 0.5 },
          { name: 'searchTerms', weight: 0.3 },
          { name: 'avg_rating', weight: 0.2 }
        ],
        threshold: 0.3,
        includeScore: true,
        includeMatches: true,
        minMatchCharLength: 2,
        useExtendedSearch: true
      });

      logger.info(`Enhanced player index built with ${playerData.length} players`);
    } finally {
      await this.pool.release(connectionInfo);
    }
  }

  /**
   * Build enhanced opening index with variation tree
   */
  async buildOpeningIndex() {
    const connectionInfo = await this.pool.acquire();
    const connection = connectionInfo.connection;

    try {
      const query = `
        SELECT 
          eco,
          opening,
          variation,
          COUNT(*) as frequency,
          SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) as white_wins,
          SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
          SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) as black_wins,
          AVG(ply_count) as avg_length,
          GROUP_CONCAT(DISTINCT substr(pgn, 1, 50)) as sample_moves
        FROM games 
        WHERE eco IS NOT NULL
        GROUP BY eco, opening, variation
        HAVING frequency >= 10
        ORDER BY frequency DESC
        LIMIT 10000
      `;

      const openings = await new Promise((resolve, reject) => {
        connection.all(query, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      // Build opening tree structure
      const openingTree = this.buildOpeningTree(openings);
      
      const openingData = openings.map(opening => ({
        ...opening,
        fullName: `${opening.eco}: ${opening.opening}${opening.variation ? ' - ' + opening.variation : ''}`,
        whiteScore: this.calculateWhiteScore(opening),
        popularity: this.calculatePopularityScore(opening.frequency),
        searchTerms: this.generateOpeningSearchTerms(opening)
      }));

      this.openingIndex = new Fuse(openingData, {
        keys: [
          { name: 'eco', weight: 0.3 },
          { name: 'opening', weight: 0.3 },
          { name: 'variation', weight: 0.2 },
          { name: 'searchTerms', weight: 0.2 }
        ],
        threshold: 0.4,
        includeScore: true,
        includeMatches: true
      });

      this.openingTree = openingTree;
      logger.info(`Enhanced opening index built with ${openingData.length} openings`);
    } finally {
      await this.pool.release(connectionInfo);
    }
  }

  /**
   * Build tournament index with hierarchical structure
   */
  async buildTournamentIndex() {
    const connectionInfo = await this.pool.acquire();
    const connection = connectionInfo.connection;

    try {
      const query = `
        SELECT 
          tournament_name,
          COUNT(*) as total_games,
          COUNT(DISTINCT white_player || '|' || black_player) as unique_players,
          MIN(date) as start_date,
          MAX(date) as end_date,
          AVG(CASE WHEN white_elo IS NOT NULL THEN white_elo ELSE NULL END) as avg_white_elo,
          AVG(CASE WHEN black_elo IS NOT NULL THEN black_elo ELSE NULL END) as avg_black_elo,
          COUNT(DISTINCT round) as total_rounds
        FROM games 
        WHERE tournament_name IS NOT NULL
        GROUP BY tournament_name
        HAVING total_games >= 20
        ORDER BY total_games DESC
        LIMIT 5000
      `;

      const tournaments = await new Promise((resolve, reject) => {
        connection.all(query, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      const tournamentData = tournaments.map(tournament => ({
        ...tournament,
        avg_elo: (tournament.avg_white_elo + tournament.avg_black_elo) / 2,
        duration_days: this.calculateDuration(tournament.start_date, tournament.end_date),
        prestige_score: this.calculatePrestigeScore(tournament),
        searchTerms: this.generateTournamentSearchTerms(tournament.tournament_name)
      }));

      this.tournamentIndex = new Fuse(tournamentData, {
        keys: [
          { name: 'tournament_name', weight: 0.6 },
          { name: 'searchTerms', weight: 0.4 }
        ],
        threshold: 0.3,
        includeScore: true
      });

      logger.info(`Enhanced tournament index built with ${tournamentData.length} tournaments`);
    } finally {
      await this.pool.release(connectionInfo);
    }
  }

  /**
   * Build position index for fast position searching
   */
  async buildPositionIndex() {
    // This would ideally process games and store position hashes
    // For now, we'll implement a basic structure
    this.positionIndex = new Map();
    logger.info('Position index initialized (lazy loading enabled)');
  }

  /**
   * Advanced game search with query optimization
   */
  async searchGames(criteria, options = {}) {
    const queryHash = this.generateQueryHash(criteria);
    
    // Check hot cache first
    if (this.hotCache.has(queryHash)) {
      const cached = this.hotCache.get(queryHash);
      if (Date.now() - cached.timestamp < this.hotCacheTimeout) {
        this.recordQueryHit(queryHash, 'hot_cache');
        return cached.data;
      }
    }
    
    // Check regular cache
    if (this.cache.has(queryHash)) {
      const cached = this.cache.get(queryHash);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.promoteToHotCache(queryHash, cached);
        this.recordQueryHit(queryHash, 'cache');
        return cached.data;
      }
    }

    const startTime = Date.now();
    
    try {
      const connectionInfo = await this.pool.acquire();
      const connection = connectionInfo.connection;

      // Build optimized query
      const { query, params } = this.buildOptimizedGameQuery(criteria);
      
      // Execute main query and count query in parallel
      const [games, totalResult] = await Promise.all([
        new Promise((resolve, reject) => {
          connection.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        }),
        new Promise((resolve, reject) => {
          const countQuery = this.buildCountQuery(criteria);
          connection.get(countQuery.query, countQuery.params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        })
      ]);

      await this.pool.release(connectionInfo);

      // Process and enrich results
      const enrichedGames = await this.enrichGamesBatch(games);

      const result = {
        games: enrichedGames,
        total: totalResult.total,
        page: Math.floor((criteria.offset || 0) / (criteria.limit || 100)) + 1,
        totalPages: Math.ceil(totalResult.total / (criteria.limit || 100)),
        executionTime: Date.now() - startTime,
        cached: false
      };

      // Cache the result
      this.cacheResult(queryHash, result);
      
      // Monitor slow queries
      if (result.executionTime > this.slowQueryThreshold) {
        this.logSlowQuery(criteria, result.executionTime);
      }

      return result;
    } catch (error) {
      logger.error('Error in enhanced game search:', error);
      throw error;
    }
  }

  /**
   * Build optimized query with proper indexing hints
   */
  buildOptimizedGameQuery(criteria) {
    const conditions = [];
    const params = [];
    const joins = [];
    
    // Use indexed columns efficiently
    if (criteria.player) {
      // Use UNION for better index utilization
      conditions.push(`(
        white_player = ? OR black_player = ?
      )`);
      params.push(criteria.player, criteria.player);
    }

    if (criteria.opening) {
      if (criteria.opening.length <= 3) {
        // ECO code search
        conditions.push('eco = ?');
        params.push(criteria.opening.toUpperCase());
      } else {
        // Opening name search
        conditions.push('opening LIKE ?');
        params.push(`%${criteria.opening}%`);
      }
    }

    if (criteria.dateFrom && criteria.dateTo) {
      conditions.push('date BETWEEN ? AND ?');
      params.push(criteria.dateFrom, criteria.dateTo);
    } else if (criteria.dateFrom) {
      conditions.push('date >= ?');
      params.push(criteria.dateFrom);
    } else if (criteria.dateTo) {
      conditions.push('date <= ?');
      params.push(criteria.dateTo);
    }

    if (criteria.result) {
      conditions.push('result = ?');
      params.push(criteria.result);
    }

    if (criteria.minElo) {
      conditions.push('(white_elo >= ? OR black_elo >= ?)');
      params.push(criteria.minElo, criteria.minElo);
    }

    // Build final query with optimizer hints
    let query = 'SELECT * FROM games';
    
    if (joins.length > 0) {
      query += ' ' + joins.join(' ');
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Add ordering and pagination
    query += ' ORDER BY date DESC, id DESC';
    query += ` LIMIT ${criteria.limit || 100} OFFSET ${criteria.offset || 0}`;

    return { query, params };
  }

  /**
   * Build count query for pagination
   */
  buildCountQuery(criteria) {
    const conditions = [];
    const params = [];

    // Same conditions as main query but simplified
    if (criteria.player) {
      conditions.push('(white_player = ? OR black_player = ?)');
      params.push(criteria.player, criteria.player);
    }

    if (criteria.opening) {
      if (criteria.opening.length <= 3) {
        conditions.push('eco = ?');
        params.push(criteria.opening.toUpperCase());
      } else {
        conditions.push('opening LIKE ?');
        params.push(`%${criteria.opening}%`);
      }
    }

    if (criteria.dateFrom) {
      conditions.push('date >= ?');
      params.push(criteria.dateFrom);
    }

    if (criteria.dateTo) {
      conditions.push('date <= ?');
      params.push(criteria.dateTo);
    }

    if (criteria.result) {
      conditions.push('result = ?');
      params.push(criteria.result);
    }

    let query = 'SELECT COUNT(*) as total FROM games';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    return { query, params };
  }

  /**
   * Batch enrich games with additional data
   */
  async enrichGamesBatch(games) {
    return games.map(game => ({
      ...game,
      moveCount: game.ply_count ? Math.ceil(game.ply_count / 2) : null,
      gameLength: this.categorizeGameLength(game.ply_count),
      resultText: this.getResultText(game.result),
      year: game.date ? new Date(game.date).getFullYear() : null,
      openingFamily: this.getOpeningFamily(game.eco),
      timeControl: this.inferTimeControl(game)
    }));
  }

  /**
   * Enhanced fuzzy search with typo tolerance
   */
  searchPlayersEnhanced(query, options = {}) {
    if (!this.playerIndex) {
      throw new Error('Player index not initialized');
    }

    const { limit = 10, includeStats = true, minGames = 0 } = options;
    
    // Use extended search syntax for better matching
    const searchQuery = this.prepareSearchQuery(query);
    const results = this.playerIndex.search(searchQuery, { limit: limit * 2 });
    
    // Filter and enhance results
    const enhanced = results
      .filter(result => result.item.total_games >= minGames)
      .slice(0, limit)
      .map(result => ({
        ...result.item,
        relevanceScore: (1 - result.score) * 100,
        matches: result.matches
      }));

    if (includeStats) {
      return this.addPlayerStatistics(enhanced);
    }

    return enhanced;
  }

  /**
   * Search with natural language understanding
   */
  async searchNatural(query) {
    const intent = this.parseSearchIntent(query);
    
    switch (intent.type) {
      case 'player_games':
        return this.searchGames({ player: intent.player, ...intent.filters });
      
      case 'opening_analysis':
        return this.getOpeningAnalysis(intent.opening, intent.filters);
      
      case 'tournament_games':
        return this.searchGames({ tournament: intent.tournament, ...intent.filters });
      
      case 'position_search':
        return this.searchByPosition(intent.fen, intent.filters);
      
      case 'statistical_query':
        return this.executeStatisticalQuery(intent);
      
      default:
        return this.searchGames(this.extractBasicCriteria(query));
    }
  }

  /**
   * Parse natural language search intent
   */
  parseSearchIntent(query) {
    const normalized = query.toLowerCase();
    const intent = { type: 'general', filters: {} };

    // Player search patterns
    const playerPatterns = [
      /games?\s+(?:by|of|from)\s+([a-zA-Z\s,]+?)(?:\s+(?:in|where|with)|$)/i,
      /([a-zA-Z\s,]+?)\s+games?/i
    ];

    for (const pattern of playerPatterns) {
      const match = query.match(pattern);
      if (match) {
        intent.type = 'player_games';
        intent.player = match[1].trim();
        break;
      }
    }

    // Opening search patterns
    if (normalized.includes('opening') || normalized.match(/\b(sicilian|french|italian|spanish|english)\b/)) {
      intent.type = 'opening_analysis';
      const openingMatch = normalized.match(/(?:opening\s+)?([a-zA-Z\s]+?)(?:\s+(?:games?|analysis|statistics)|$)/);
      if (openingMatch) {
        intent.opening = openingMatch[1].trim();
      }
    }

    // Extract filters
    if (normalized.includes('win') || normalized.includes('won')) {
      if (normalized.includes('white')) {
        intent.filters.result = '1-0';
      } else if (normalized.includes('black')) {
        intent.filters.result = '0-1';
      }
    }

    if (normalized.includes('draw')) {
      intent.filters.result = '1/2-1/2';
    }

    // Date filters
    const yearMatch = normalized.match(/(?:in|from|year)\s+(\d{4})/);
    if (yearMatch) {
      intent.filters.dateFrom = `${yearMatch[1]}-01-01`;
      intent.filters.dateTo = `${yearMatch[1]}-12-31`;
    }

    // Move count filters
    const moveMatch = normalized.match(/(?:under|less than|within)\s+(\d+)\s+moves?/);
    if (moveMatch) {
      intent.filters.maxMoves = parseInt(moveMatch[1]);
    }

    return intent;
  }

  /**
   * Get comprehensive opening analysis
   */
  async getOpeningAnalysis(opening, filters = {}) {
    const connectionInfo = await this.pool.acquire();
    const connection = connectionInfo.connection;

    try {
      const query = `
        WITH OpeningGames AS (
          SELECT *
          FROM games
          WHERE (eco LIKE ? OR opening LIKE ?)
          ${filters.dateFrom ? 'AND date >= ?' : ''}
          ${filters.dateTo ? 'AND date <= ?' : ''}
          LIMIT 1000
        )
        SELECT 
          eco,
          opening,
          variation,
          COUNT(*) as total_games,
          SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) as white_wins,
          SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
          SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) as black_wins,
          AVG(ply_count) as avg_length,
          AVG(white_elo) as avg_white_elo,
          AVG(black_elo) as avg_black_elo
        FROM OpeningGames
        GROUP BY eco, opening, variation
        ORDER BY total_games DESC
      `;

      const params = [`%${opening}%`, `%${opening}%`];
      if (filters.dateFrom) params.push(filters.dateFrom);
      if (filters.dateTo) params.push(filters.dateTo);

      const analysis = await new Promise((resolve, reject) => {
        connection.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      // Get top games
      const topGamesQuery = `
        SELECT *
        FROM games
        WHERE (eco LIKE ? OR opening LIKE ?)
        AND (white_elo > 2400 OR black_elo > 2400)
        ORDER BY (white_elo + black_elo) DESC
        LIMIT 10
      `;

      const topGames = await new Promise((resolve, reject) => {
        connection.all(topGamesQuery, [`%${opening}%`, `%${opening}%`], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      return {
        opening,
        analysis: analysis.map(row => ({
          ...row,
          whiteScore: ((row.white_wins + row.draws * 0.5) / row.total_games * 100).toFixed(1),
          popularityTrend: this.calculatePopularityTrend(row)
        })),
        topGames: this.enrichGamesBatch(topGames),
        recommendations: this.generateOpeningRecommendations(analysis)
      };
    } catch (error) {
      logger.error('Error in opening analysis:', error);
      throw error;
    }
  }

  /**
   * Search by position with transposition detection
   */
  async searchByPosition(fen, options = {}) {
    const positionHash = this.hashPosition(fen);
    
    // Check position cache
    if (this.positionIndex.has(positionHash)) {
      return this.positionIndex.get(positionHash);
    }

    try {
      const chess = new Chess();
      chess.load(fen);
      
      // Generate position signature
      const signature = this.generatePositionSignature(chess);
      
      const connectionInfo = await this.pool.acquire();
      const connection = connectionInfo.connection;

      // Search for similar positions
      const query = `
        SELECT *
        FROM games
        WHERE pgn LIKE ?
        ORDER BY (white_elo + black_elo) DESC
        LIMIT ${options.limit || 50}
      `;

      const games = await new Promise((resolve, reject) => {
        connection.all(query, [`%${signature}%`], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      const result = {
        position: fen,
        signature,
        games: this.enrichGamesBatch(games),
        transpositions: this.findTranspositions(fen)
      };

      // Cache the result
      this.positionIndex.set(positionHash, result);
      
      return result;
    } catch (error) {
      logger.error('Error in position search:', error);
      throw error;
    }
  }

  /**
   * Get intelligent search suggestions
   */
  async getSuggestions(query, context = {}) {
    const suggestions = {
      players: [],
      openings: [],
      tournaments: [],
      queries: [],
      recent: []
    };

    if (query.length < 2) {
      // Return popular/recent searches
      suggestions.recent = this.getRecentSearches(context.userId);
      suggestions.queries = this.getPopularQueries();
      return suggestions;
    }

    // Get suggestions from indexes
    try {
      suggestions.players = this.searchPlayersEnhanced(query, { limit: 5 });
    } catch (err) {
      logger.warn('Player suggestions failed:', err);
    }

    try {
      suggestions.openings = this.searchOpeningsEnhanced(query, { limit: 5 });
    } catch (err) {
      logger.warn('Opening suggestions failed:', err);
    }

    try {
      suggestions.tournaments = this.searchTournamentsEnhanced(query, { limit: 5 });
    } catch (err) {
      logger.warn('Tournament suggestions failed:', err);
    }

    // Generate intelligent query suggestions
    suggestions.queries = this.generateQuerySuggestions(query, context);

    return suggestions;
  }

  /**
   * Generate intelligent query suggestions based on context
   */
  generateQuerySuggestions(query, context) {
    const suggestions = [];
    const normalized = query.toLowerCase();

    // Player-based suggestions
    if (normalized.match(/^[a-z]+\s+[a-z]+$/)) {
      suggestions.push(`${query} games`);
      suggestions.push(`${query} white wins`);
      suggestions.push(`${query} vs`);
    }

    // Opening-based suggestions
    if (normalized.includes('sicilian') || normalized.includes('french')) {
      suggestions.push(`${query} defense`);
      suggestions.push(`${query} variation`);
      suggestions.push(`${query} main line`);
    }

    // Date-based suggestions
    if (normalized.match(/\d{4}/)) {
      const year = normalized.match(/\d{4}/)[0];
      suggestions.push(`world championship ${year}`);
      suggestions.push(`best games ${year}`);
    }

    // Context-aware suggestions
    if (context.previousSearch) {
      suggestions.push(`${query} ${context.previousSearch}`);
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Helper methods
   */
  
  generateQueryHash(criteria) {
    return crypto.createHash('md5').update(JSON.stringify(criteria)).digest('hex');
  }

  generateEnhancedSearchTerms(name) {
    const terms = [
      name.toLowerCase(),
      ...name.split(/[\s,.-]+/).map(part => part.toLowerCase()),
      // Add phonetic variations
      this.generatePhoneticVariation(name)
    ];
    return [...new Set(terms)].join(' ');
  }

  generatePhoneticVariation(name) {
    // Simple phonetic mapping for common variations
    return name.toLowerCase()
      .replace(/ph/g, 'f')
      .replace(/ck/g, 'k')
      .replace(/[aeiou]/g, '');
  }

  calculateActivityScore(player) {
    const daysSinceLastGame = (Date.now() - new Date(player.last_game_date)) / (1000 * 60 * 60 * 24);
    if (daysSinceLastGame < 30) return 'very_active';
    if (daysSinceLastGame < 90) return 'active';
    if (daysSinceLastGame < 365) return 'occasional';
    return 'inactive';
  }

  calculateStrengthScore(player) {
    const rating = player.avg_rating || 1500;
    if (rating >= 2700) return 'super_gm';
    if (rating >= 2500) return 'gm';
    if (rating >= 2400) return 'im';
    if (rating >= 2200) return 'master';
    if (rating >= 2000) return 'expert';
    if (rating >= 1800) return 'advanced';
    if (rating >= 1600) return 'intermediate';
    return 'beginner';
  }

  calculateWhiteScore(opening) {
    const total = opening.white_wins + opening.draws + opening.black_wins;
    if (total === 0) return 50;
    return ((opening.white_wins + opening.draws * 0.5) / total * 100).toFixed(1);
  }

  calculatePopularityScore(frequency) {
    if (frequency > 10000) return 'very_popular';
    if (frequency > 1000) return 'popular';
    if (frequency > 100) return 'common';
    if (frequency > 10) return 'uncommon';
    return 'rare';
  }

  calculatePrestigeScore(tournament) {
    let score = 0;
    if (tournament.avg_elo > 2600) score += 3;
    else if (tournament.avg_elo > 2400) score += 2;
    else if (tournament.avg_elo > 2200) score += 1;
    
    if (tournament.unique_players > 100) score += 2;
    else if (tournament.unique_players > 50) score += 1;
    
    if (tournament.total_games > 500) score += 2;
    else if (tournament.total_games > 100) score += 1;
    
    return score;
  }

  calculateDuration(startDate, endDate) {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  }

  categorizeGameLength(plyCount) {
    if (!plyCount) return 'unknown';
    const moves = Math.ceil(plyCount / 2);
    if (moves < 20) return 'miniature';
    if (moves < 40) return 'short';
    if (moves < 60) return 'medium';
    if (moves < 80) return 'long';
    return 'very_long';
  }

  getResultText(result) {
    const resultMap = {
      '1-0': 'White wins',
      '0-1': 'Black wins',
      '1/2-1/2': 'Draw',
      '*': 'Ongoing'
    };
    return resultMap[result] || 'Unknown';
  }

  getOpeningFamily(eco) {
    if (!eco) return 'Unknown';
    const letter = eco[0];
    const families = {
      'A': 'Flank',
      'B': 'Semi-Open',
      'C': 'Open',
      'D': 'Closed',
      'E': 'Indian'
    };
    return families[letter] || 'Other';
  }

  inferTimeControl(game) {
    // This would ideally use actual time control data
    // For now, infer from game length and date
    if (game.ply_count < 40) return 'rapid';
    if (game.ply_count > 100) return 'classical';
    return 'standard';
  }

  buildOpeningTree(openings) {
    const tree = {};
    openings.forEach(opening => {
      if (!tree[opening.eco]) {
        tree[opening.eco] = {
          name: opening.opening,
          variations: []
        };
      }
      if (opening.variation) {
        tree[opening.eco].variations.push(opening.variation);
      }
    });
    return tree;
  }

  hashPosition(fen) {
    return crypto.createHash('md5').update(fen).digest('hex');
  }

  generatePositionSignature(chess) {
    // Generate a signature based on piece placement
    const board = chess.board();
    let signature = '';
    
    for (let row of board) {
      for (let square of row) {
        if (square) {
          signature += square.type + square.color;
        }
      }
    }
    
    return signature;
  }

  findTranspositions(fen) {
    // This would search for positions that can transpose to the given position
    // Simplified implementation
    return [];
  }

  prepareSearchQuery(query) {
    // Prepare query for Fuse.js extended search
    return query.trim().toLowerCase();
  }

  addPlayerStatistics(players) {
    // Add additional statistics to player results
    return players.map(player => ({
      ...player,
      recentForm: this.calculateRecentForm(player),
      specialties: this.identifySpecialties(player)
    }));
  }

  calculateRecentForm(player) {
    // Calculate recent performance trend
    return 'stable'; // Simplified
  }

  identifySpecialties(player) {
    // Identify player's strengths
    const specialties = [];
    if (player.win_rate > 60) specialties.push('aggressive');
    if (player.avg_game_length > 50) specialties.push('positional');
    return specialties;
  }

  searchOpeningsEnhanced(query, options = {}) {
    if (!this.openingIndex) {
      throw new Error('Opening index not initialized');
    }
    
    const results = this.openingIndex.search(query, { limit: options.limit || 10 });
    return results.map(result => ({
      ...result.item,
      relevanceScore: (1 - result.score) * 100
    }));
  }

  searchTournamentsEnhanced(query, options = {}) {
    if (!this.tournamentIndex) {
      throw new Error('Tournament index not initialized');
    }
    
    const results = this.tournamentIndex.search(query, { limit: options.limit || 10 });
    return results.map(result => ({
      ...result.item,
      relevanceScore: (1 - result.score) * 100
    }));
  }

  generateOpeningSearchTerms(opening) {
    const terms = [
      opening.eco.toLowerCase(),
      opening.opening.toLowerCase()
    ];
    if (opening.variation) {
      terms.push(opening.variation.toLowerCase());
    }
    return terms.join(' ');
  }

  generateTournamentSearchTerms(name) {
    return name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  }

  generateOpeningRecommendations(analysis) {
    // Generate recommendations based on opening statistics
    const recommendations = [];
    
    analysis.forEach(variant => {
      const whiteScore = parseFloat(variant.whiteScore);
      if (whiteScore > 55) {
        recommendations.push({
          eco: variant.eco,
          opening: variant.opening,
          reason: 'High white win rate',
          score: whiteScore
        });
      }
    });
    
    return recommendations.slice(0, 3);
  }

  calculatePopularityTrend(opening) {
    // Simplified trend calculation
    return 'stable';
  }

  cacheResult(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Limit cache size
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  promoteToHotCache(key, cached) {
    this.hotCache.set(key, cached);
    
    // Limit hot cache size
    if (this.hotCache.size > 100) {
      const firstKey = this.hotCache.keys().next().value;
      this.hotCache.delete(firstKey);
    }
  }

  recordQueryHit(queryHash, source) {
    if (!this.queryStats.has(queryHash)) {
      this.queryStats.set(queryHash, {
        hits: 0,
        sources: {}
      });
    }
    
    const stats = this.queryStats.get(queryHash);
    stats.hits++;
    stats.sources[source] = (stats.sources[source] || 0) + 1;
  }

  logSlowQuery(criteria, executionTime) {
    logger.warn('Slow query detected', {
      criteria,
      executionTime,
      timestamp: new Date().toISOString()
    });
  }

  getRecentSearches(userId) {
    // Return user's recent searches (would need user tracking)
    return [];
  }

  getPopularQueries() {
    // Return most popular queries
    return [
      'Magnus Carlsen games',
      'Sicilian Defense',
      'World Championship 2023',
      'Queen\'s Gambit',
      'Endgame studies'
    ];
  }

  extractBasicCriteria(query) {
    // Extract basic search criteria from natural language
    const criteria = {};
    const normalized = query.toLowerCase();
    
    // Simple extraction logic
    if (normalized.includes('2024')) {
      criteria.dateFrom = '2024-01-01';
      criteria.dateTo = '2024-12-31';
    }
    
    if (normalized.includes('white wins')) {
      criteria.result = '1-0';
    } else if (normalized.includes('black wins')) {
      criteria.result = '0-1';
    } else if (normalized.includes('draws')) {
      criteria.result = '1/2-1/2';
    }
    
    return criteria;
  }

  executeStatisticalQuery(intent) {
    // Execute statistical queries
    return {
      type: 'statistical',
      query: intent,
      message: 'Statistical queries coming soon'
    };
  }

  scheduleIndexRefresh() {
    // Refresh indexes periodically
    setInterval(() => {
      logger.info('Refreshing search indexes...');
      this.initializeIndexes().catch(err => {
        logger.error('Failed to refresh indexes:', err);
      });
    }, 60 * 60 * 1000); // Every hour
  }
}

module.exports = new EnhancedSearchService();