/**
 * Enhanced Search API Routes
 * High-performance search endpoints with advanced features
 */

const express = require('express');
const router = express.Router();
const enhancedSearch = require('../services/enhanced-search');
const logger = require('../utils/logger');
const { validateSearchParams } = require('../middleware/validation');

/**
 * GET /api/search/v2/games
 * Enhanced game search with performance optimizations
 */
router.get('/games', validateSearchParams, async (req, res) => {
  try {
    const criteria = {
      player: req.query.player,
      whitePlayer: req.query.whitePlayer,
      blackPlayer: req.query.blackPlayer,
      opening: req.query.opening,
      eco: req.query.eco,
      tournament: req.query.tournament,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      result: req.query.result,
      minElo: req.query.minElo ? parseInt(req.query.minElo) : null,
      maxElo: req.query.maxElo ? parseInt(req.query.maxElo) : null,
      minMoves: req.query.minMoves ? parseInt(req.query.minMoves) : null,
      maxMoves: req.query.maxMoves ? parseInt(req.query.maxMoves) : null,
      limit: Math.min(parseInt(req.query.limit) || 50, 200),
      offset: parseInt(req.query.offset) || 0
    };

    // Remove null/undefined values
    Object.keys(criteria).forEach(key => {
      if (criteria[key] === null || criteria[key] === undefined || criteria[key] === '') {
        delete criteria[key];
      }
    });

    const results = await enhancedSearch.searchGames(criteria);

    res.json({
      success: true,
      criteria,
      ...results,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in enhanced game search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search games',
      message: error.message
    });
  }
});

/**
 * GET /api/search/v2/players
 * Enhanced player search with fuzzy matching and statistics
 */
router.get('/players', async (req, res) => {
  try {
    const { 
      q: query, 
      limit = 10,
      includeStats = true,
      minGames = 0 
    } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters long'
      });
    }

    const options = {
      limit: Math.min(parseInt(limit), 50),
      includeStats: includeStats === 'true',
      minGames: parseInt(minGames) || 0
    };

    const results = enhancedSearch.searchPlayersEnhanced(query, options);

    res.json({
      success: true,
      query,
      results,
      count: results.length,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in enhanced player search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search players',
      message: error.message
    });
  }
});

/**
 * GET /api/search/v2/openings
 * Enhanced opening search with variation analysis
 */
router.get('/openings', async (req, res) => {
  try {
    const { q: query, limit = 10, includeAnalysis = false } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters long'
      });
    }

    const options = {
      limit: Math.min(parseInt(limit), 50),
      includeAnalysis: includeAnalysis === 'true'
    };

    const results = enhancedSearch.searchOpeningsEnhanced(query, options);

    res.json({
      success: true,
      query,
      results,
      count: results.length,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in enhanced opening search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search openings',
      message: error.message
    });
  }
});

/**
 * GET /api/search/v2/tournaments
 * Enhanced tournament search with prestige scoring
 */
router.get('/tournaments', async (req, res) => {
  try {
    const { q: query, limit = 10, minPrestige = 0 } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters long'
      });
    }

    const options = {
      limit: Math.min(parseInt(limit), 50),
      minPrestige: parseInt(minPrestige) || 0
    };

    const results = enhancedSearch.searchTournamentsEnhanced(query, options);

    res.json({
      success: true,
      query,
      results,
      count: results.length,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in enhanced tournament search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search tournaments',
      message: error.message
    });
  }
});

/**
 * POST /api/search/v2/natural
 * Natural language search with intent recognition
 */
router.post('/natural', async (req, res) => {
  try {
    const { query, context = {} } = req.body;

    if (!query || query.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 3 characters long'
      });
    }

    const results = await enhancedSearch.searchNatural(query, context);

    res.json({
      success: true,
      query,
      results,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in natural language search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process natural language query',
      message: error.message
    });
  }
});

/**
 * POST /api/search/v2/position
 * Enhanced position search with transposition detection
 */
router.post('/position', async (req, res) => {
  try {
    const { fen, limit = 50, includeTranspositions = false } = req.body;

    if (!fen) {
      return res.status(400).json({
        success: false,
        error: 'FEN string is required'
      });
    }

    const options = {
      limit: Math.min(parseInt(limit), 100),
      includeTranspositions: includeTranspositions === true
    };

    const results = await enhancedSearch.searchByPosition(fen, options);

    res.json({
      success: true,
      fen,
      results,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in position search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search by position',
      message: error.message
    });
  }
});

/**
 * GET /api/search/v2/suggestions
 * Intelligent search suggestions with context awareness
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q: query, userId, previousSearch } = req.query;

    const context = {
      userId,
      previousSearch
    };

    const suggestions = await enhancedSearch.getSuggestions(query || '', context);

    res.json({
      success: true,
      query: query || '',
      suggestions,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting search suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get search suggestions',
      message: error.message
    });
  }
});

/**
 * GET /api/search/v2/opening/:opening/analysis
 * Comprehensive opening analysis
 */
router.get('/opening/:opening/analysis', async (req, res) => {
  try {
    const { opening } = req.params;
    const { dateFrom, dateTo, minElo } = req.query;

    const filters = {
      dateFrom,
      dateTo,
      minElo: minElo ? parseInt(minElo) : null
    };

    const analysis = await enhancedSearch.getOpeningAnalysis(opening, filters);

    res.json({
      success: true,
      opening,
      analysis,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in opening analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze opening',
      message: error.message
    });
  }
});

/**
 * POST /api/search/v2/initialize
 * Initialize or refresh search indexes
 */
router.post('/initialize', async (req, res) => {
  try {
    const { force = false } = req.body;
    
    logger.info('Initializing enhanced search indexes...');
    
    await enhancedSearch.initializeIndexes();

    res.json({
      success: true,
      message: 'Enhanced search indexes initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error initializing enhanced search indexes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize search indexes',
      message: error.message
    });
  }
});

/**
 * GET /api/search/v2/stats
 * Get enhanced search statistics and performance metrics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      indexesInitialized: {
        players: !!enhancedSearch.playerIndex,
        openings: !!enhancedSearch.openingIndex,
        tournaments: !!enhancedSearch.tournamentIndex,
        positions: enhancedSearch.positionIndex.size > 0
      },
      cacheStats: {
        regularCache: enhancedSearch.cache.size,
        hotCache: enhancedSearch.hotCache.size,
        positionCache: enhancedSearch.positionIndex.size
      },
      queryStats: Array.from(enhancedSearch.queryStats.entries()).map(([hash, stats]) => ({
        hash: hash.substring(0, 8),
        hits: stats.hits,
        sources: stats.sources
      })).slice(0, 10),
      capabilities: [
        'Advanced game search with query optimization',
        'Enhanced fuzzy search with typo tolerance',
        'Natural language query understanding',
        'Position search with transposition detection',
        'Intelligent context-aware suggestions',
        'Multi-tier caching system',
        'Performance monitoring and optimization'
      ],
      performance: {
        slowQueryThreshold: `${enhancedSearch.slowQueryThreshold}ms`,
        cacheTimeout: `${enhancedSearch.cacheTimeout / 1000}s`,
        hotCacheTimeout: `${enhancedSearch.hotCacheTimeout / 1000}s`
      }
    };

    res.json({
      success: true,
      stats,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting enhanced search stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get search statistics',
      message: error.message
    });
  }
});

/**
 * DELETE /api/search/v2/cache
 * Clear search caches
 */
router.delete('/cache', async (req, res) => {
  try {
    const { type = 'all' } = req.query;
    
    let cleared = [];
    
    if (type === 'all' || type === 'regular') {
      enhancedSearch.cache.clear();
      cleared.push('regular');
    }
    
    if (type === 'all' || type === 'hot') {
      enhancedSearch.hotCache.clear();
      cleared.push('hot');
    }
    
    if (type === 'all' || type === 'position') {
      enhancedSearch.positionIndex.clear();
      cleared.push('position');
    }

    res.json({
      success: true,
      message: `Cleared ${cleared.join(', ')} cache(s)`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

/**
 * GET /api/search/v2/examples
 * Get enhanced search examples and documentation
 */
router.get('/examples', (req, res) => {
  res.json({
    success: true,
    examples: {
      gameSearch: {
        description: 'Enhanced game search with performance optimizations',
        endpoint: 'GET /api/search/v2/games',
        examples: [
          {
            description: 'Search with multiple criteria',
            url: '/api/search/v2/games?player=Magnus%20Carlsen&opening=Sicilian&minElo=2600&limit=20'
          },
          {
            description: 'Date range search',
            url: '/api/search/v2/games?dateFrom=2024-01-01&dateTo=2024-12-31&result=1-0'
          }
        ]
      },
      naturalLanguage: {
        description: 'Natural language search with intent recognition',
        endpoint: 'POST /api/search/v2/natural',
        examples: [
          {
            body: { query: 'Magnus Carlsen games with Sicilian Defense in 2024' }
          },
          {
            body: { query: 'White wins in under 20 moves with Queen\'s Gambit' }
          },
          {
            body: { 
              query: 'Tournament games from World Championship',
              context: { previousSearch: 'Carlsen' }
            }
          }
        ]
      },
      intelligentSuggestions: {
        description: 'Context-aware search suggestions',
        endpoint: 'GET /api/search/v2/suggestions',
        examples: [
          {
            description: 'Get suggestions for partial query',
            url: '/api/search/v2/suggestions?q=carl'
          },
          {
            description: 'Suggestions with context',
            url: '/api/search/v2/suggestions?q=sicilian&previousSearch=e4%20e5'
          }
        ]
      },
      openingAnalysis: {
        description: 'Comprehensive opening analysis',
        endpoint: 'GET /api/search/v2/opening/:opening/analysis',
        example: '/api/search/v2/opening/Sicilian/analysis?minElo=2400&dateFrom=2023-01-01'
      },
      positionSearch: {
        description: 'Enhanced position search',
        endpoint: 'POST /api/search/v2/position',
        example: {
          body: {
            fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
            limit: 20,
            includeTranspositions: true
          }
        }
      }
    },
    improvements: [
      'Multi-tier caching (hot cache for frequently accessed data)',
      'Query optimization with proper index utilization',
      'Natural language understanding with intent recognition',
      'Fuzzy search with typo tolerance and phonetic matching',
      'Context-aware suggestions based on search history',
      'Performance monitoring with slow query detection',
      'Batch processing for result enrichment',
      'Transposition detection in position search'
    ]
  });
});

module.exports = router;