/**
 * Advanced Search API Routes
 * Provides comprehensive search and discovery endpoints
 */

const express = require('express');
const router = express.Router();
const advancedSearch = require('../services/advanced-search');
const logger = require('../utils/logger');

/**
 * GET /api/search/games
 * Advanced game search with multiple criteria
 */
router.get('/games', async (req, res) => {
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
      minMoves: req.query.minMoves ? parseInt(req.query.minMoves) : null,
      maxMoves: req.query.maxMoves ? parseInt(req.query.maxMoves) : null,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };

    // Remove null/undefined values
    Object.keys(criteria).forEach(key => {
      if (criteria[key] === null || criteria[key] === undefined || criteria[key] === '') {
        delete criteria[key];
      }
    });

    const results = await advancedSearch.searchGames(criteria);

    res.json({
      success: true,
      criteria,
      results,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in game search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search games',
      message: error.message
    });
  }
});

/**
 * GET /api/search/players
 * Fuzzy search for players
 */
router.get('/players', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters long'
      });
    }

    const results = advancedSearch.searchPlayers(query, parseInt(limit));

    res.json({
      success: true,
      query,
      results,
      count: results.length
    });
  } catch (error) {
    logger.error('Error in player search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search players',
      message: error.message
    });
  }
});

/**
 * GET /api/search/openings
 * Fuzzy search for openings
 */
router.get('/openings', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters long'
      });
    }

    const results = advancedSearch.searchOpenings(query, parseInt(limit));

    res.json({
      success: true,
      query,
      results,
      count: results.length
    });
  } catch (error) {
    logger.error('Error in opening search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search openings',
      message: error.message
    });
  }
});

/**
 * GET /api/search/tournaments
 * Fuzzy search for tournaments
 */
router.get('/tournaments', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters long'
      });
    }

    const results = advancedSearch.searchTournaments(query, parseInt(limit));

    res.json({
      success: true,
      query,
      results,
      count: results.length
    });
  } catch (error) {
    logger.error('Error in tournament search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search tournaments',
      message: error.message
    });
  }
});

/**
 * GET /api/search/similar/:gameId
 * Find games similar to a specific game
 */
router.get('/similar/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const criteria = {
      includePlayers: req.query.includePlayers !== 'false',
      includeOpening: req.query.includeOpening !== 'false',
      includeLength: req.query.includeLength !== 'false',
      includeResult: req.query.includeResult !== 'false',
      lengthTolerance: req.query.lengthTolerance ? parseInt(req.query.lengthTolerance) : 10,
      limit: req.query.limit ? parseInt(req.query.limit) : 50
    };

    const results = await advancedSearch.findSimilarGames(gameId, criteria);

    res.json({
      success: true,
      gameId,
      criteria,
      results,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error finding similar games:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find similar games',
      message: error.message
    });
  }
});

/**
 * POST /api/search/position
 * Search games by chess position (FEN)
 */
router.post('/position', async (req, res) => {
  try {
    const { fen, limit = 50 } = req.body;

    if (!fen) {
      return res.status(400).json({
        success: false,
        error: 'FEN string is required'
      });
    }

    const criteria = { limit: parseInt(limit) };
    const results = await advancedSearch.searchByPosition(fen, criteria);

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
 * POST /api/search/natural
 * Natural language query processing
 */
router.post('/natural', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || query.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 5 characters long'
      });
    }

    const results = await advancedSearch.processNaturalQuery(query);

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
 * GET /api/search/suggestions
 * Get search suggestions and auto-complete
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        query: query || '',
        suggestions: {
          players: [],
          openings: [],
          tournaments: [],
          natural: []
        }
      });
    }

    const suggestions = await advancedSearch.getSearchSuggestions(query);

    res.json({
      success: true,
      query,
      suggestions
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
 * GET /api/search/stats
 * Get search index statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      indexesInitialized: {
        players: !!advancedSearch.playerIndex,
        openings: !!advancedSearch.openingIndex,
        tournaments: !!advancedSearch.tournamentIndex
      },
      cacheSize: advancedSearch.cache.size,
      capabilities: [
        'Advanced game search',
        'Fuzzy player/opening/tournament search',
        'Similar games finder',
        'Position search (basic)',
        'Natural language queries'
      ]
    };

    res.json({
      success: true,
      stats,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting search stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get search statistics',
      message: error.message
    });
  }
});

/**
 * POST /api/search/initialize
 * Initialize or refresh search indexes
 */
router.post('/initialize', async (req, res) => {
  try {
    logger.info('Initializing search indexes...');
    
    await advancedSearch.initializeIndexes();

    res.json({
      success: true,
      message: 'Search indexes initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error initializing search indexes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize search indexes',
      message: error.message
    });
  }
});

/**
 * GET /api/search/examples
 * Get search examples and documentation
 */
router.get('/examples', (req, res) => {
  res.json({
    success: true,
    examples: {
      gameSearch: {
        description: 'Search games with multiple criteria',
        endpoint: 'GET /api/search/games',
        examples: [
          {
            description: 'Games by Magnus Carlsen',
            url: '/api/search/games?player=Magnus%20Carlsen&limit=10'
          },
          {
            description: 'Sicilian Defense games',
            url: '/api/search/games?opening=Sicilian&limit=10'
          },
          {
            description: 'Short games (under 20 moves)',
            url: '/api/search/games?maxMoves=20&limit=10'
          },
          {
            description: 'Games from 2023',
            url: '/api/search/games?dateFrom=2023-01-01&dateTo=2023-12-31&limit=10'
          }
        ]
      },
      fuzzySearch: {
        description: 'Fuzzy search for players, openings, tournaments',
        examples: [
          {
            description: 'Find players with "carl" in name',
            url: '/api/search/players?q=carl&limit=5'
          },
          {
            description: 'Find openings containing "french"',
            url: '/api/search/openings?q=french&limit=5'
          },
          {
            description: 'Find tournaments containing "world"',
            url: '/api/search/tournaments?q=world&limit=5'
          }
        ]
      },
      naturalLanguage: {
        description: 'Natural language queries',
        endpoint: 'POST /api/search/natural',
        examples: [
          'Games by Magnus Carlsen where white won in under 30 moves',
          'Sicilian Defense games with draws',
          'French opening games from 2023',
          'Games where black won in over 50 moves'
        ]
      },
      similarGames: {
        description: 'Find games similar to a specific game',
        endpoint: 'GET /api/search/similar/:gameId',
        example: '/api/search/similar/12345?includePlayers=true&includeOpening=true'
      },
      positionSearch: {
        description: 'Search by chess position (FEN)',
        endpoint: 'POST /api/search/position',
        example: {
          body: {
            fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
            limit: 10
          }
        }
      }
    }
  });
});

module.exports = router;