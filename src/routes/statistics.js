/**
 * Advanced Statistics Routes
 * Comprehensive chess statistics, analytics, and data visualization endpoints
 */

const express = require('express');
const router = express.Router();
const advancedStats = require('../services/advanced-statistics');
const MLEnhancedStatisticsService = require('../services/ml-enhanced-statistics');
const TimeSeriesForecaster = require('../ml/time-series-forecasting');
const SeasonalPatternDetector = require('../ml/seasonal-pattern-detector');
const VolatilityAnalyzer = require('../ml/volatility-analyzer');
const CorrelationAnalyzer = require('../ml/correlation-analyzer');
const ClusteringAnalyzer = require('../ml/clustering-analyzer');
const AnomalyDetector = require('../ml/anomaly-detector');
const OpeningAnalyzer = require('../services/opening-analyzer');
const { optionalAuth, authenticate, validateBody, userRateLimit } = require('../middleware/auth');
const logger = require('../utils/logger');

// Initialize ML services
const mlStats = new MLEnhancedStatisticsService();
const timeSeriesForecaster = new TimeSeriesForecaster();
const seasonalDetector = new SeasonalPatternDetector();
const volatilityAnalyzer = new VolatilityAnalyzer();
const correlationAnalyzer = new CorrelationAnalyzer();
const clusteringAnalyzer = new ClusteringAnalyzer();
const anomalyDetector = new AnomalyDetector();
const openingAnalyzer = new OpeningAnalyzer();

/**
 * GET /api/statistics/players/:playerName
 * Get comprehensive player statistics and analysis
 */
router.get('/players/:playerName',
  optionalAuth,
  userRateLimit(50, 300000), // 50 requests per 5 minutes
  async (req, res) => {
    try {
      const { playerName } = req.params;
      const {
        timeframe = 'all',
        minRating = 0,
        platform = null,
        includeOpenings = 'true',
        includePerformance = 'true'
      } = req.query;

      if (playerName.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Player name must be at least 2 characters long'
        });
      }

      const options = {
        timeframe,
        minRating: parseInt(minRating),
        platform,
        includeOpenings: includeOpenings === 'true',
        includePerformance: includePerformance === 'true'
      };

      const stats = await advancedStats.getPlayerStatistics(playerName, options);

      // Log activity for authenticated users
      if (req.user) {
        logger.info(`User ${req.user.username} viewed stats for ${playerName}`);
      }

      res.json({
        success: true,
        statistics: stats,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Player statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get player statistics'
      });
    }
  }
);

/**
 * POST /api/statistics/players/compare
 * Compare multiple players with detailed analysis
 */
router.post('/players/compare',
  optionalAuth,
  validateBody({
    players: {
      required: true,
      validate: (value) => {
        if (!Array.isArray(value)) return 'Players must be an array';
        if (value.length < 2) return 'At least 2 players required for comparison';
        if (value.length > 10) return 'Maximum 10 players allowed';
        if (value.some(p => typeof p !== 'string' || p.length < 2)) {
          return 'All player names must be at least 2 characters';
        }
      }
    },
    timeframe: { enum: ['7d', '30d', '90d', '1y', 'all'] },
    minRating: { type: 'number' },
    includeHeadToHead: { type: 'boolean' }
  }),
  userRateLimit(20, 600000), // 20 requests per 10 minutes
  async (req, res) => {
    try {
      const { players, timeframe = 'all', minRating = 0, includeHeadToHead = true } = req.body;

      const options = {
        timeframe,
        minRating,
        includeHeadToHead
      };

      const comparison = await advancedStats.getComparativeAnalysis(players, options);

      res.json({
        success: true,
        comparison,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Player comparison error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to compare players'
      });
    }
  }
);

/**
 * GET /api/statistics/openings
 * Get comprehensive opening statistics and trends
 */
router.get('/openings',
  optionalAuth,
  async (req, res) => {
    try {
      const {
        eco,
        minGames = 100,
        minRating = 1500,
        timeframe = 'all',
        sortBy = 'popularity',
        limit = 50
      } = req.query;

      const options = {
        eco,
        minGames: parseInt(minGames),
        minRating: parseInt(minRating),
        timeframe,
        sortBy,
        limit: Math.min(parseInt(limit), 200)
      };

      const stats = await advancedStats.getOpeningStatistics(options);

      res.json({
        success: true,
        statistics: stats,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Opening statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get opening statistics'
      });
    }
  }
);

/**
 * GET /api/statistics/openings/:eco
 * Get detailed statistics for a specific opening
 */
router.get('/openings/:eco',
  optionalAuth,
  async (req, res) => {
    try {
      const { eco } = req.params;
      const {
        minRating = 1500,
        timeframe = 'all',
        includeVariations = 'true',
        includePlayerStats = 'true'
      } = req.query;

      if (!/^[A-E]\d{2}$/.test(eco)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid ECO code format (should be like A00, B01, etc.)'
        });
      }

      const options = {
        eco,
        minRating: parseInt(minRating),
        timeframe,
        includeVariations: includeVariations === 'true',
        includePlayerStats: includePlayerStats === 'true'
      };

      const stats = await advancedStats.getOpeningDetailedStats(eco, options);

      res.json({
        success: true,
        opening: eco,
        statistics: stats,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Opening detailed statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get opening statistics'
      });
    }
  }
);

/**
 * GET /api/statistics/tournaments
 * Get tournament and event statistics
 */
router.get('/tournaments',
  optionalAuth,
  async (req, res) => {
    try {
      const {
        timeframe = '1y',
        minGames = 50,
        eventType,
        includeRatingStats = 'true'
      } = req.query;

      const options = {
        timeframe,
        minGames: parseInt(minGames),
        eventType,
        includeRatingStats: includeRatingStats === 'true'
      };

      const stats = await advancedStats.getTournamentStatistics(options);

      res.json({
        success: true,
        statistics: stats,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Tournament statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get tournament statistics'
      });
    }
  }
);

/**
 * GET /api/statistics/time-series/:metric
 * Get time series analysis for various metrics
 */
router.get('/time-series/:metric',
  optionalAuth,
  async (req, res) => {
    try {
      const { metric } = req.params;
      const {
        timeframe = '1y',
        granularity = 'month',
        player,
        minRating,
        tournament
      } = req.query;

      const validMetrics = [
        'game_count', 'avg_rating', 'avg_game_length', 
        'decisive_games_pct', 'white_win_pct', 'draw_rate'
      ];

      if (!validMetrics.includes(metric)) {
        return res.status(400).json({
          success: false,
          error: `Invalid metric. Valid options: ${validMetrics.join(', ')}`
        });
      }

      const options = {
        timeframe,
        granularity,
        filters: {}
      };

      if (player) options.filters.player = player;
      if (minRating) options.filters.minRating = parseInt(minRating);
      if (tournament) options.filters.tournament = tournament;

      const analysis = await advancedStats.getTimeSeriesAnalysis(metric, options);

      res.json({
        success: true,
        analysis,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Time series analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform time series analysis'
      });
    }
  }
);

/**
 * GET /api/statistics/rating-distribution
 * Get rating distribution analysis
 */
router.get('/rating-distribution',
  optionalAuth,
  async (req, res) => {
    try {
      const {
        timeframe = '1y',
        bucketSize = 100,
        platform,
        includeHistory = 'false'
      } = req.query;

      const stats = await advancedStats.getRatingDistribution({
        timeframe,
        bucketSize: parseInt(bucketSize),
        platform,
        includeHistory: includeHistory === 'true'
      });

      res.json({
        success: true,
        distribution: stats,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Rating distribution error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get rating distribution'
      });
    }
  }
);

/**
 * GET /api/statistics/trends
 * Get overall chess trends and patterns
 */
router.get('/trends',
  optionalAuth,
  async (req, res) => {
    try {
      const {
        category = 'all',
        timeframe = '5y',
        minGames = 1000
      } = req.query;

      const validCategories = ['all', 'openings', 'time_controls', 'results', 'activity'];
      
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category. Valid options: ${validCategories.join(', ')}`
        });
      }

      const trends = await advancedStats.getTrends({
        category,
        timeframe,
        minGames: parseInt(minGames)
      });

      res.json({
        success: true,
        trends,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Trends analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get trends analysis'
      });
    }
  }
);

/**
 * GET /api/statistics/insights
 * Get AI-powered insights and recommendations
 */
router.get('/insights',
  optionalAuth,
  async (req, res) => {
    try {
      const {
        player,
        timeframe = '90d',
        categories = 'performance,openings,trends'
      } = req.query;

      const insightCategories = categories.split(',');
      const validCategories = ['performance', 'openings', 'trends', 'opponents', 'time_management'];

      const invalidCategories = insightCategories.filter(cat => !validCategories.includes(cat));
      if (invalidCategories.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid categories: ${invalidCategories.join(', ')}`
        });
      }

      const insights = await advancedStats.generateInsights({
        player,
        timeframe,
        categories: insightCategories
      });

      res.json({
        success: true,
        insights,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Insights generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate insights'
      });
    }
  }
);

/**
 * POST /api/statistics/custom-query
 * Execute custom statistical queries (authenticated users only)
 */
router.post('/custom-query',
  authenticate,
  validateBody({
    query: { required: true, type: 'string', maxLength: 1000 },
    parameters: { type: 'object' },
    cacheKey: { type: 'string', maxLength: 100 }
  }),
  userRateLimit(10, 600000), // 10 requests per 10 minutes
  async (req, res) => {
    try {
      const { query, parameters = {}, cacheKey } = req.body;

      // Security check - only allow SELECT queries
      if (!query.trim().toLowerCase().startsWith('select')) {
        return res.status(400).json({
          success: false,
          error: 'Only SELECT queries are allowed'
        });
      }

      // Check for potentially dangerous keywords
      const dangerousKeywords = ['drop', 'delete', 'update', 'insert', 'create', 'alter'];
      const lowercaseQuery = query.toLowerCase();
      
      if (dangerousKeywords.some(keyword => lowercaseQuery.includes(keyword))) {
        return res.status(400).json({
          success: false,
          error: 'Query contains prohibited keywords'
        });
      }

      const result = await advancedStats.executeCustomQuery(query, parameters, {
        cacheKey,
        userId: req.user.id,
        maxRows: 1000
      });

      logger.info(`Custom query executed by ${req.user.username}`, { query: query.substring(0, 100) });

      res.json({
        success: true,
        result,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Custom query error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute custom query'
      });
    }
  }
);

/**
 * GET /api/statistics/reports/:reportType
 * Generate comprehensive statistical reports
 */
router.get('/reports/:reportType',
  authenticate,
  userRateLimit(5, 600000), // 5 requests per 10 minutes
  async (req, res) => {
    try {
      const { reportType } = req.params;
      const {
        format = 'json',
        timeframe = '1y',
        players,
        tournaments,
        detailed = 'true'
      } = req.query;

      const validReports = [
        'player_performance', 'opening_analysis', 'tournament_summary',
        'comparative_analysis', 'trend_report', 'custom_dashboard'
      ];

      const validFormats = ['json', 'csv', 'pdf'];

      if (!validReports.includes(reportType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid report type. Valid options: ${validReports.join(', ')}`
        });
      }

      if (!validFormats.includes(format)) {
        return res.status(400).json({
          success: false,
          error: `Invalid format. Valid options: ${validFormats.join(', ')}`
        });
      }

      const reportOptions = {
        format,
        timeframe,
        players: players ? players.split(',') : null,
        tournaments: tournaments ? tournaments.split(',') : null,
        detailed: detailed === 'true',
        userId: req.user.id
      };

      const report = await advancedStats.generateReport(reportType, reportOptions);

      if (format === 'json') {
        res.json({
          success: true,
          report,
          generated: new Date().toISOString()
        });
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${reportType}_${Date.now()}.csv"`);
        res.send(report);
      } else if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${reportType}_${Date.now()}.pdf"`);
        res.send(report);
      }

      logger.info(`Report generated: ${reportType} by ${req.user.username}`);
    } catch (error) {
      logger.error('Report generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate report'
      });
    }
  }
);

/**
 * GET /api/statistics/leaderboards/:category
 * Get various leaderboards and rankings
 */
router.get('/leaderboards/:category',
  optionalAuth,
  async (req, res) => {
    try {
      const { category } = req.params;
      const {
        timeframe = '1y',
        minGames = 50,
        limit = 100
      } = req.query;

      const validCategories = [
        'rating', 'games_played', 'win_rate', 'most_active',
        'best_openings', 'tournament_winners', 'rapid_improvers'
      ];

      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category. Valid options: ${validCategories.join(', ')}`
        });
      }

      const leaderboard = await advancedStats.getLeaderboard(category, {
        timeframe,
        minGames: parseInt(minGames),
        limit: Math.min(parseInt(limit), 500)
      });

      res.json({
        success: true,
        category,
        leaderboard,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Leaderboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get leaderboard'
      });
    }
  }
);

/**
 * GET /api/statistics/health
 * Get statistics service health and performance metrics
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      cacheSize: advancedStats.cache.size,
      cacheHitRate: 'N/A', // Would need to track this
      lastUpdate: new Date().toISOString(),
      availableMetrics: [
        'player_statistics',
        'opening_analysis',
        'tournament_data',
        'time_series',
        'comparative_analysis',
        'rating_distribution',
        'trend_analysis'
      ],
      supportedTimeframes: ['7d', '30d', '90d', '1y', '5y', 'all'],
      supportedGranularities: ['day', 'week', 'month', 'year']
    };

    res.json({
      success: true,
      health
    });
  } catch (error) {
    logger.error('Statistics health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Statistics service unhealthy'
    });
  }
});

/**
 * GET /api/statistics/rating-analysis/:playerName
 * Get comprehensive rating analysis and predictions for a player
 */
router.get('/rating-analysis/:playerName',
  optionalAuth,
  userRateLimit(10, 300000), // 10 requests per 5 minutes
  async (req, res) => {
    try {
      const { playerName } = req.params;
      const {
        timeframe = '2y',
        predictions = 'true',
        includeComparisons = 'false'
      } = req.query;

      const options = {
        timeframe,
        predictions: predictions === 'true'
      };

      const analysis = await advancedStats.getRatingAnalysis(playerName, options);

      if (analysis.error) {
        return res.status(404).json({
          success: false,
          error: analysis.error
        });
      }

      // Add comparative analysis if requested
      if (includeComparisons === 'true' && analysis.current.rating) {
        const similarPlayers = await advancedStats.findSimilarPlayers(playerName, {
          ratingRange: 100,
          limit: 5
        });
        analysis.comparisons = similarPlayers;
      }

      res.json({
        success: true,
        analysis,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Rating analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze player ratings'
      });
    }
  }
);

/**
 * POST /api/statistics/compare-players
 * Compare multiple players across various statistics
 */
router.post('/compare-players',
  optionalAuth,
  userRateLimit(5, 300000), // 5 requests per 5 minutes
  async (req, res) => {
    try {
      const { players, options = {} } = req.body;

      if (!players || !Array.isArray(players) || players.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Please provide at least 2 players to compare'
        });
      }

      if (players.length > 10) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 10 players can be compared at once'
        });
      }

      const analysis = await advancedStats.getComparativeAnalysis(players, {
        timeframe: options.timeframe || '1y',
        includeHeadToHead: options.includeHeadToHead !== false,
        includeOpenings: options.includeOpenings !== false,
        minGames: options.minGames || 10
      });

      res.json({
        success: true,
        comparison: analysis,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Player comparison error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to compare players'
      });
    }
  }
);

/**
 * GET /api/statistics/visualization/:type
 * Get data formatted for specific visualization types
 */
router.get('/visualization/:type',
  optionalAuth,
  async (req, res) => {
    try {
      const { type } = req.params;
      const {
        player,
        timeframe = '1y',
        granularity = 'month',
        metric = 'rating'
      } = req.query;

      const validTypes = [
        'line_chart', 'bar_chart', 'heatmap', 'scatter_plot', 
        'histogram', 'pie_chart', 'radar_chart'
      ];

      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid visualization type. Valid options: ${validTypes.join(', ')}`
        });
      }

      const visualizationData = await advancedStats.getVisualizationData(type, {
        player,
        timeframe,
        granularity,
        metric
      });

      res.json({
        success: true,
        visualization: {
          type,
          data: visualizationData,
          config: {
            player,
            timeframe,
            granularity,
            metric
          }
        },
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Visualization data error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate visualization data'
      });
    }
  }
);

/**
 * GET /api/statistics/advanced-filtering
 * Advanced database filtering and aggregation endpoint
 */
router.get('/advanced-filtering',
  optionalAuth,
  userRateLimit(20, 300000), // 20 requests per 5 minutes
  async (req, res) => {
    try {
      const {
        players,
        dateFrom,
        dateTo,
        minRating,
        maxRating,
        openings,
        tournaments,
        results,
        timeControls,
        groupBy = 'month',
        aggregations = 'count,avg_rating,win_rate',
        limit = 100
      } = req.query;

      const filters = {};
      const aggs = aggregations.split(',');

      if (players) filters.players = players.split(',');
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      if (minRating) filters.minRating = parseInt(minRating);
      if (maxRating) filters.maxRating = parseInt(maxRating);
      if (openings) filters.openings = openings.split(',');
      if (tournaments) filters.tournaments = tournaments.split(',');
      if (results) filters.results = results.split(',');
      if (timeControls) filters.timeControls = timeControls.split(',');

      const data = await advancedStats.getAdvancedFilteredData({
        filters,
        groupBy,
        aggregations: aggs,
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data,
        filters,
        aggregations: aggs,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Advanced filtering error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute advanced filtering'
      });
    }
  }
);

/**
 * GET /api/statistics/ml/player-intelligence/:playerName
 * Generate comprehensive ML-powered player intelligence
 */
router.get('/ml/player-intelligence/:playerName',
  optionalAuth,
  userRateLimit(10, 900000), // 10 requests per 15 minutes (expensive operation)
  async (req, res) => {
    try {
      const { playerName } = req.params;
      const {
        includeRatingPrediction = 'true',
        includeStyleAnalysis = 'true',
        includePatternAnalysis = 'true',
        includeCompetitiveIntelligence = 'true',
        timeframe = 'recent',
        confidenceThreshold = 0.6
      } = req.query;

      if (playerName.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Player name must be at least 2 characters long'
        });
      }

      const options = {
        includeRatingPrediction: includeRatingPrediction === 'true',
        includeStyleAnalysis: includeStyleAnalysis === 'true',
        includePatternAnalysis: includePatternAnalysis === 'true',
        includeCompetitiveIntelligence: includeCompetitiveIntelligence === 'true',
        timeframe,
        confidenceThreshold: parseFloat(confidenceThreshold)
      };

      const intelligence = await mlStats.generatePlayerIntelligence(playerName, options);

      res.json({
        success: true,
        intelligence,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('ML player intelligence error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate player intelligence',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/statistics/ml/match-prediction
 * Predict match outcome using ML models
 */
router.post('/ml/match-prediction',
  optionalAuth,
  userRateLimit(20, 600000), // 20 requests per 10 minutes
  async (req, res) => {
    try {
      const { player1, player2, matchContext = {} } = req.body;

      if (!player1 || !player2) {
        return res.status(400).json({
          success: false,
          error: 'Both player1 and player2 are required'
        });
      }

      if (typeof player1 !== 'string' || typeof player2 !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Player names must be strings'
        });
      }

      const prediction = await mlStats.predictMatchWithML(player1, player2, matchContext);

      res.json({
        success: true,
        prediction,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('ML match prediction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to predict match outcome',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/statistics/ml/rating-prediction/:playerName
 * Advanced rating prediction using ML models
 */
router.get('/ml/rating-prediction/:playerName',
  optionalAuth,
  userRateLimit(30, 600000), // 30 requests per 10 minutes
  async (req, res) => {
    try {
      const { playerName } = req.params;
      const {
        horizon = 30,
        includeOpponentStrength = 'true',
        includeRecentForm = 'true',
        includeSeasonality = 'false'
      } = req.query;

      if (playerName.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Player name must be at least 2 characters long'
        });
      }

      // Gather player data
      const playerData = await mlStats.gatherPlayerData(playerName, 'recent');
      if (!mlStats.validatePlayerDataQuality(playerData)) {
        return res.status(404).json({
          success: false,
          error: 'Insufficient player data for rating prediction'
        });
      }

      const options = {
        horizon: parseInt(horizon),
        includeOpponentStrength: includeOpponentStrength === 'true',
        includeRecentForm: includeRecentForm === 'true',
        includeSeasonality: includeSeasonality === 'true'
      };

      const prediction = await mlStats.ratingPredictor.predictRating(playerData, options);

      res.json({
        success: true,
        prediction,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('ML rating prediction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to predict rating',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/statistics/ml/style-classification/:playerName
 * Classify player's playing style using ML
 */
router.get('/ml/style-classification/:playerName',
  optionalAuth,
  userRateLimit(25, 600000), // 25 requests per 10 minutes
  async (req, res) => {
    try {
      const { playerName } = req.params;
      const {
        includeEvolution = 'false',
        timeframe = 'recent',
        minConfidence = 0.6
      } = req.query;

      if (playerName.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Player name must be at least 2 characters long'
        });
      }

      // Gather player data
      const playerData = await mlStats.gatherPlayerData(playerName, timeframe);
      if (!mlStats.validatePlayerDataQuality(playerData)) {
        return res.status(404).json({
          success: false,
          error: 'Insufficient player data for style classification'
        });
      }

      const options = {
        includeEvolution: includeEvolution === 'true',
        timeframe,
        minConfidence: parseFloat(minConfidence)
      };

      const classification = await mlStats.styleClassifier.classifyPlayerStyle(playerData, options);

      res.json({
        success: true,
        classification,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('ML style classification error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to classify playing style',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/statistics/ml/pattern-analysis/:playerName
 * Analyze statistical patterns in player's games
 */
router.get('/ml/pattern-analysis/:playerName',
  optionalAuth,
  userRateLimit(15, 900000), // 15 requests per 15 minutes (expensive operation)
  async (req, res) => {
    try {
      const { playerName } = req.params;
      const {
        patternTypes = 'opening_sequences,tactical_motifs,result_patterns',
        minSupport = 0.05,
        includeVisualizations = 'false',
        timeframe = 'all'
      } = req.query;

      if (playerName.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Player name must be at least 2 characters long'
        });
      }

      // Gather player data
      const playerData = await mlStats.gatherPlayerData(playerName, timeframe);
      if (!playerData || !playerData.games || playerData.games.length < 10) {
        return res.status(404).json({
          success: false,
          error: 'Insufficient game data for pattern analysis'
        });
      }

      const options = {
        patternTypes: patternTypes.split(','),
        minSupport: parseFloat(minSupport),
        includeVisualizations: includeVisualizations === 'true',
        timeframe
      };

      const analysis = await mlStats.patternAnalyzer.analyzePatterns(playerData.games, options);

      res.json({
        success: true,
        analysis,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('ML pattern analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze patterns',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/statistics/ml/optimization-recommendations/:playerName
 * Generate ML-powered optimization recommendations
 */
router.get('/ml/optimization-recommendations/:playerName',
  optionalAuth,
  userRateLimit(8, 1800000), // 8 requests per 30 minutes (very expensive operation)
  async (req, res) => {
    try {
      const { playerName } = req.params;
      const {
        focusAreas = 'all',
        improvementTimeframe = '6months',
        includeTrainingPlan = 'true'
      } = req.query;

      if (playerName.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Player name must be at least 2 characters long'
        });
      }

      const validFocusAreas = ['all', 'openings', 'tactics', 'endgame', 'psychology'];
      if (!validFocusAreas.includes(focusAreas)) {
        return res.status(400).json({
          success: false,
          error: `Invalid focus area. Valid options: ${validFocusAreas.join(', ')}`
        });
      }

      const options = {
        focusAreas,
        improvementTimeframe,
        includeTrainingPlan: includeTrainingPlan === 'true'
      };

      const recommendations = await mlStats.generateOptimizationRecommendations(playerName, options);

      res.json({
        success: true,
        recommendations,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('ML optimization recommendations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate optimization recommendations',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/statistics/ml/tournament-preparation
 * Generate tournament preparation using ML analysis
 */
router.post('/ml/tournament-preparation',
  authenticate,
  userRateLimit(5, 3600000), // 5 requests per hour (premium feature)
  async (req, res) => {
    try {
      const { playerName, tournamentInfo, options = {} } = req.body;

      if (!playerName || !tournamentInfo) {
        return res.status(400).json({
          success: false,
          error: 'Player name and tournament info are required'
        });
      }

      if (!tournamentInfo.name) {
        return res.status(400).json({
          success: false,
          error: 'Tournament name is required'
        });
      }

      const preparation = await mlStats.generateTournamentPreparation(
        playerName, 
        tournamentInfo, 
        options
      );

      res.json({
        success: true,
        preparation,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('ML tournament preparation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate tournament preparation',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/statistics/ml/batch-analysis
 * Batch ML analysis for multiple players
 */
router.post('/ml/batch-analysis',
  authenticate,
  userRateLimit(3, 3600000), // 3 requests per hour (premium feature)
  async (req, res) => {
    try {
      const { players, analysisTypes, options = {} } = req.body;

      if (!players || !Array.isArray(players) || players.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Players array is required and must not be empty'
        });
      }

      if (players.length > 10) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 10 players can be analyzed in batch'
        });
      }

      if (!analysisTypes || !Array.isArray(analysisTypes)) {
        return res.status(400).json({
          success: false,
          error: 'Analysis types array is required'
        });
      }

      const validAnalysisTypes = [
        'rating_prediction', 
        'style_classification', 
        'pattern_analysis',
        'player_intelligence'
      ];

      const invalidTypes = analysisTypes.filter(type => !validAnalysisTypes.includes(type));
      if (invalidTypes.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid analysis types: ${invalidTypes.join(', ')}`
        });
      }

      // Process batch analysis
      const results = {};
      
      for (const player of players) {
        try {
          results[player] = {};
          
          for (const analysisType of analysisTypes) {
            switch (analysisType) {
              case 'player_intelligence':
                results[player][analysisType] = await mlStats.generatePlayerIntelligence(player, options);
                break;
              case 'rating_prediction':
                const playerData = await mlStats.gatherPlayerData(player);
                results[player][analysisType] = await mlStats.ratingPredictor.predictRating(playerData);
                break;
              case 'style_classification':
                const styleData = await mlStats.gatherPlayerData(player);
                results[player][analysisType] = await mlStats.styleClassifier.classifyPlayerStyle(styleData);
                break;
              case 'pattern_analysis':
                const patternData = await mlStats.gatherPlayerData(player);
                results[player][analysisType] = await mlStats.patternAnalyzer.analyzePatterns(patternData.games);
                break;
            }
          }
        } catch (error) {
          logger.error(`Batch analysis error for player ${player}:`, error);
          results[player] = { error: error.message };
        }
      }

      res.json({
        success: true,
        results,
        summary: {
          playersAnalyzed: players.length,
          analysisTypes,
          completedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('ML batch analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform batch analysis',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/statistics/ml/models/performance
 * Get ML model performance metrics and statistics
 */
router.get('/ml/models/performance',
  authenticate,
  async (req, res) => {
    try {
      const performance = {
        ratingPredictor: {
          predictionsGenerated: mlStats.metrics.predictionsGenerated,
          averageProcessingTime: Math.round(mlStats.metrics.averageProcessingTime),
          errorRate: Math.round(mlStats.metrics.errorRate * 100) / 100,
          cacheHitRate: mlStats.metrics.cacheHits > 0 ? 
            Math.round((mlStats.metrics.cacheHits / (mlStats.metrics.cacheHits + mlStats.metrics.cacheMisses)) * 100) : 0
        },
        system: {
          cacheSize: mlStats.cache.size,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version
        },
        lastUpdated: new Date().toISOString()
      };

      res.json({
        success: true,
        performance
      });
    } catch (error) {
      logger.error('ML performance metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance metrics'
      });
    }
  }
);

// =============================================================================
// TIME SERIES FORECASTING & TREND ANALYSIS ENDPOINTS
// =============================================================================

/**
 * POST /api/statistics/time-series/forecast
 * Generate comprehensive time series forecasts for chess performance data
 */
router.post('/time-series/forecast',
  optionalAuth,
  userRateLimit(20, 3600000), // 20 requests per hour
  validateBody(['timeSeries']),
  async (req, res) => {
    try {
      const { 
        timeSeries, 
        models = ['arima', 'exponential', 'holt-winters'],
        horizon = 30,
        includeConfidenceIntervals = true,
        seasonalPeriod = null,
        includeDecomposition = false
      } = req.body;

      if (!Array.isArray(timeSeries) || timeSeries.length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Time series must be an array with at least 10 data points'
        });
      }

      const options = {
        models,
        horizon,
        includeConfidenceIntervals,
        seasonalPeriod,
        includeDecomposition,
        validationSplit: 0.2
      };

      const forecast = await timeSeriesForecaster.generateForecast(timeSeries, options);

      res.json({
        success: true,
        forecast,
        metadata: {
          inputLength: timeSeries.length,
          forecastHorizon: horizon,
          modelsUsed: models,
          requestedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Time series forecast error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate forecast',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/statistics/time-series/patterns
 * Detect seasonal patterns and cyclical behavior in chess performance
 */
router.post('/time-series/patterns',
  optionalAuth,
  userRateLimit(30, 3600000), // 30 requests per hour
  validateBody(['timeSeries']),
  async (req, res) => {
    try {
      const { 
        timeSeries,
        method = 'autocorrelation',
        patternTypes = ['weekly', 'monthly', 'yearly'],
        minStrength = 0.1,
        confidenceLevel = 0.95
      } = req.body;

      if (!Array.isArray(timeSeries) || timeSeries.length < 20) {
        return res.status(400).json({
          success: false,
          error: 'Time series must be an array with at least 20 data points for pattern detection'
        });
      }

      const options = {
        method,
        patternTypes,
        minStrength,
        confidenceLevel,
        removeOutliers: true
      };

      const patterns = await seasonalDetector.detectPatterns(timeSeries, options);

      res.json({
        success: true,
        patterns,
        insights: {
          totalPatterns: patterns.patterns.length,
          strongestPattern: patterns.patterns.length > 0 ? 
            patterns.patterns.reduce((max, p) => p.strength > max.strength ? p : max) : null,
          seasonalityPresent: patterns.patterns.some(p => ['weekly', 'monthly', 'yearly'].includes(p.type))
        }
      });
    } catch (error) {
      logger.error('Seasonal pattern detection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to detect patterns',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/statistics/volatility/analyze
 * Comprehensive volatility analysis for chess performance consistency
 */
router.post('/volatility/analyze',
  optionalAuth,
  userRateLimit(25, 3600000), // 25 requests per hour
  validateBody(['timeSeries']),
  async (req, res) => {
    try {
      const { 
        timeSeries,
        model = 'ewma',
        horizon = 30,
        includeRisk = true,
        includeRegimes = true,
        confidenceLevel = 0.95
      } = req.body;

      if (!Array.isArray(timeSeries) || timeSeries.length < 30) {
        return res.status(400).json({
          success: false,
          error: 'Time series must be an array with at least 30 data points for volatility analysis'
        });
      }

      const options = {
        model,
        horizon,
        includeRisk,
        includeRegimes,
        includeForecasting: true,
        confidenceLevel
      };

      const analysis = await volatilityAnalyzer.analyzeVolatility(timeSeries, options);

      res.json({
        success: true,
        volatility: analysis,
        insights: {
          currentVolatility: analysis.volatility.summary.current,
          riskLevel: categorizeRiskLevel(analysis.risk?.var?.var95 || 0),
          volatilityTrend: analysis.patterns?.persistence?.persistence || 'unknown',
          averageVolatility: analysis.volatility.summary.mean
        }
      });
    } catch (error) {
      logger.error('Volatility analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze volatility',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/statistics/correlation/analyze
 * Multi-dimensional correlation and dependency analysis
 */
router.post('/correlation/analyze',
  optionalAuth,
  userRateLimit(20, 3600000), // 20 requests per hour
  validateBody(['data']),
  async (req, res) => {
    try {
      const { 
        data,
        method = 'pearson',
        analysisType = 'pairwise',
        includePartial = true,
        includeNonlinear = true,
        minCorrelation = 0.1
      } = req.body;

      if (!Array.isArray(data) || data.length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Data must be an array with at least 10 observations'
        });
      }

      const options = {
        method,
        analysisType,
        includePartial,
        includeNonlinear,
        minCorrelation,
        maxPValue: 0.05
      };

      const correlations = await correlationAnalyzer.analyzeCorrelations(data, options);

      res.json({
        success: true,
        correlations,
        summary: {
          totalVariables: correlations.metadata.dimensions,
          significantPairs: correlations.analysis.significantPairs?.length || 0,
          strongestCorrelation: correlations.correlationMatrix.summary.maxCorrelation,
          networkDensity: correlations.analysis.summary?.density || 0
        }
      });
    } catch (error) {
      logger.error('Correlation analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze correlations',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/statistics/clustering/analyze
 * Advanced clustering analysis for player grouping and pattern discovery
 */
router.post('/clustering/analyze',
  optionalAuth,
  userRateLimit(15, 3600000), // 15 requests per hour  
  validateBody(['data']),
  async (req, res) => {
    try {
      const { 
        data,
        algorithm = 'kmeans',
        k = null,
        maxK = 10,
        includeValidation = true,
        normalizeData = true
      } = req.body;

      if (!Array.isArray(data) || data.length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Data must be an array with at least 10 data points'
        });
      }

      const options = {
        algorithm,
        k,
        maxK,
        includeValidation,
        includeVisualization: false,
        normalizeData,
        removeOutliers: true
      };

      const clustering = await clusteringAnalyzer.performClustering(data, options);

      res.json({
        success: true,
        clustering,
        insights: {
          optimalClusters: clustering.k,
          clusterQuality: clustering.validation?.summary?.overallQuality || 'unknown',
          largestCluster: Math.max(...clustering.clusters.map(c => c.size)),
          smallestCluster: Math.min(...clustering.clusters.map(c => c.size)),
          clusterBalance: clustering.analysis?.sizeStats?.balance || 0
        }
      });
    } catch (error) {
      logger.error('Clustering analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform clustering analysis',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/statistics/anomalies/detect
 * Comprehensive anomaly detection for unusual chess performance patterns
 */
router.post('/anomalies/detect',
  optionalAuth,
  userRateLimit(30, 3600000), // 30 requests per hour
  validateBody(['data']),
  async (req, res) => {
    try {
      const { 
        data,
        method = 'ensemble',
        contamination = 0.1,
        sensitivity = 'medium',
        includeContextual = true,
        includeCollective = true
      } = req.body;

      if (!Array.isArray(data) || data.length < 20) {
        return res.status(400).json({
          success: false,
          error: 'Data must be an array with at least 20 data points for anomaly detection'
        });
      }

      const options = {
        method,
        contamination,
        sensitivity,
        includeContextual,
        includeCollective,
        windowSize: Math.min(30, Math.floor(data.length / 4)),
        confidenceLevel: 0.95
      };

      const anomalies = await anomalyDetector.detectAnomalies(data, options);

      res.json({
        success: true,
        anomalies,
        summary: {
          totalAnomalies: anomalies.statistics.totalAnomalies,
          anomalyRate: anomalies.statistics.anomalyRate,
          severityDistribution: anomalies.patternAnalysis?.severity?.distribution || {},
          mostAnomalousPoints: anomalies.combinedAnomalies.slice(0, 5).map(a => ({
            index: a.index,
            score: a.score,
            severity: a.severity,
            type: a.type
          }))
        }
      });
    } catch (error) {
      logger.error('Anomaly detection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to detect anomalies',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/statistics/time-series/player/:playerName
 * Generate time series analysis for a specific player's performance
 */
router.get('/time-series/player/:playerName',
  optionalAuth,
  userRateLimit(40, 3600000), // 40 requests per hour
  async (req, res) => {
    try {
      const { playerName } = req.params;
      const { 
        timeframe = '1year',
        analysisTypes = 'forecast,patterns,volatility',
        gameType = 'all'
      } = req.query;

      if (playerName.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Player name must be at least 2 characters long'
        });
      }

      // Get player's historical data
      const playerData = await advancedStats.getPlayerStatistics(playerName, {
        timeframe,
        includePerformance: true,
        includeRatingHistory: true
      });

      if (!playerData.ratingHistory || playerData.ratingHistory.length < 20) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient historical data for time series analysis'
        });
      }

      const timeSeries = playerData.ratingHistory.map(entry => ({
        timestamp: entry.date,
        value: entry.rating
      }));

      const results = {};
      const requestedTypes = analysisTypes.split(',').map(t => t.trim());

      // Perform requested analyses
      if (requestedTypes.includes('forecast')) {
        results.forecast = await timeSeriesForecaster.generateForecast(timeSeries, {
          models: ['arima', 'exponential'],
          horizon: 30,
          includeConfidenceIntervals: true
        });
      }

      if (requestedTypes.includes('patterns')) {
        results.patterns = await seasonalDetector.detectPatterns(timeSeries, {
          method: 'autocorrelation',
          patternTypes: ['weekly', 'monthly'],
          minStrength: 0.1
        });
      }

      if (requestedTypes.includes('volatility')) {
        results.volatility = await volatilityAnalyzer.analyzeVolatility(timeSeries, {
          model: 'ewma',
          includeRisk: true,
          includeRegimes: true
        });
      }

      if (requestedTypes.includes('anomalies')) {
        results.anomalies = await anomalyDetector.detectAnomalies(timeSeries, {
          method: 'ensemble',
          includeContextual: true,
          sensitivity: 'medium'
        });
      }

      res.json({
        success: true,
        player: playerName,
        timeframe,
        analysis: results,
        metadata: {
          dataPoints: timeSeries.length,
          analysisTypes: requestedTypes,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Player time series analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate player time series analysis',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/statistics/trends/batch-analyze
 * Batch analysis of multiple players for comparative trend analysis
 */
router.post('/trends/batch-analyze',
  authenticate,
  userRateLimit(10, 3600000), // 10 requests per hour (expensive operation)
  validateBody(['players']),
  async (req, res) => {
    try {
      const { 
        players,
        analysisTypes = ['forecast', 'volatility'],
        timeframe = '6months',
        compareMode = true
      } = req.body;

      if (!Array.isArray(players) || players.length < 2 || players.length > 10) {
        return res.status(400).json({
          success: false,
          error: 'Players array must contain between 2 and 10 players'
        });
      }

      const results = {};
      const comparisons = {};

      // Analyze each player
      for (const player of players) {
        try {
          const playerData = await advancedStats.getPlayerStatistics(player, {
            timeframe,
            includeRatingHistory: true
          });

          if (!playerData.ratingHistory || playerData.ratingHistory.length < 10) {
            results[player] = { error: 'Insufficient data' };
            continue;
          }

          const timeSeries = playerData.ratingHistory.map(entry => ({
            timestamp: entry.date,
            value: entry.rating
          }));

          results[player] = {};

          if (analysisTypes.includes('forecast')) {
            results[player].forecast = await timeSeriesForecaster.generateForecast(timeSeries, {
              models: ['exponential'],
              horizon: 15
            });
          }

          if (analysisTypes.includes('volatility')) {
            results[player].volatility = await volatilityAnalyzer.analyzeVolatility(timeSeries, {
              model: 'ewma',
              includeRisk: true
            });
          }

          if (analysisTypes.includes('patterns')) {
            results[player].patterns = await seasonalDetector.detectPatterns(timeSeries, {
              method: 'autocorrelation',
              minStrength: 0.15
            });
          }

        } catch (error) {
          logger.error(`Batch trend analysis error for ${player}:`, error);
          results[player] = { error: error.message };
        }
      }

      // Generate comparisons if requested
      if (compareMode) {
        const validPlayers = players.filter(p => !results[p].error);
        
        if (validPlayers.length >= 2) {
          // Compare volatility levels
          if (analysisTypes.includes('volatility')) {
            comparisons.volatility = {
              ranking: validPlayers
                .map(p => ({
                  player: p,
                  avgVolatility: results[p].volatility?.volatility?.summary?.mean || 0
                }))
                .sort((a, b) => b.avgVolatility - a.avgVolatility),
              highestVolatility: null,
              lowestVolatility: null
            };
            
            comparisons.volatility.highestVolatility = comparisons.volatility.ranking[0];
            comparisons.volatility.lowestVolatility = comparisons.volatility.ranking[comparisons.volatility.ranking.length - 1];
          }

          // Compare forecast trends
          if (analysisTypes.includes('forecast')) {
            comparisons.forecast = {
              trendDirection: validPlayers.reduce((acc, p) => {
                const forecast = results[p].forecast?.ensemble?.forecast;
                if (forecast && forecast.length > 0) {
                  const firstValue = forecast[0].value;
                  const lastValue = forecast[forecast.length - 1].value;
                  acc[p] = lastValue > firstValue ? 'upward' : 'downward';
                }
                return acc;
              }, {}),
              mostOptimistic: null,
              mostPessimistic: null
            };
          }
        }
      }

      res.json({
        success: true,
        results,
        comparisons,
        summary: {
          playersAnalyzed: players.length,
          successfulAnalyses: Object.keys(results).filter(p => !results[p].error).length,
          analysisTypes,
          timeframe,
          completedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Batch trend analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform batch trend analysis',
        details: error.message
      });
    }
  }
);

// =============================================================================
// UTILITY AND HELPER ENDPOINTS
// =============================================================================

/**
 * GET /api/statistics/models/status
 * Get status and performance of all time series models
 */
router.get('/models/status',
  optionalAuth,
  async (req, res) => {
    try {
      const status = {
        timeSeriesForecaster: {
          available: true,
          models: ['arima', 'exponential', 'holt-winters', 'seasonal-arima', 'trend-analysis'],
          lastUsed: null,
          performance: 'operational'
        },
        seasonalPatternDetector: {
          available: true,
          methods: ['fft', 'autocorrelation', 'stl'],
          lastUsed: null,
          performance: 'operational'
        },
        volatilityAnalyzer: {
          available: true,
          models: ['garch', 'ewma', 'historical'],
          lastUsed: null,
          performance: 'operational'
        },
        correlationAnalyzer: {
          available: true,
          methods: ['pearson', 'spearman', 'kendall'],
          analysisTypes: ['pairwise', 'network', 'hierarchical', 'factor'],
          performance: 'operational'
        },
        clusteringAnalyzer: {
          available: true,
          algorithms: ['kmeans', 'hierarchical', 'dbscan', 'gaussian-mixture'],
          performance: 'operational'
        },
        anomalyDetector: {
          available: true,
          methods: ['isolation-forest', 'local-outlier-factor', 'statistical', 'ensemble'],
          performance: 'operational'
        },
        system: {
          uptime: Math.round(process.uptime()),
          memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
          nodeVersion: process.version,
          lastHealthCheck: new Date().toISOString()
        }
      };

      res.json({
        success: true,
        status
      });
    } catch (error) {
      logger.error('Model status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get model status'
      });
    }
  }
);

// =============================================================================
// OPENING ANALYSIS ENDPOINTS
// =============================================================================

/**
 * POST /api/statistics/openings/analyze
 * Comprehensive opening analysis from moves
 */
router.post('/openings/analyze',
  optionalAuth,
  validateBody({
    moves: {
      required: true,
      validate: (value) => {
        if (!Array.isArray(value) && typeof value !== 'string') {
          return 'Moves must be an array or PGN string';
        }
      }
    }
  }),
  async (req, res) => {
    try {
      const { moves, options = {} } = req.body;
      
      const analysis = await openingAnalyzer.analyzeOpening(moves, {
        depth: options.depth || 20,
        includeTranspositions: options.includeTranspositions !== false,
        includeStatistics: options.includeStatistics !== false,
        includeRecommendations: options.includeRecommendations !== false
      });

      res.json({
        success: true,
        analysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Opening analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze opening',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/statistics/openings/repertoire
 * Analyze player's opening repertoire
 */
router.post('/openings/repertoire',
  optionalAuth,
  validateBody({
    games: {
      required: true,
      validate: (value) => {
        if (!Array.isArray(value)) return 'Games must be an array';
        if (value.length === 0) return 'At least one game required';
      }
    }
  }),
  async (req, res) => {
    try {
      const { games, options = {} } = req.body;
      
      const repertoire = await openingAnalyzer.analyzeRepertoire(games, {
        minGames: options.minGames || 3,
        includeTranspositions: options.includeTranspositions !== false,
        calculateSuccess: options.calculateSuccess !== false
      });

      res.json({
        success: true,
        repertoire,
        summary: {
          totalOpenings: Object.keys(repertoire.asWhite).length + Object.keys(repertoire.asBlack).length,
          gamesAnalyzed: games.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Repertoire analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze repertoire',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/statistics/openings/prepare/:opponent
 * Get preparation package against specific opponent
 */
router.get('/openings/prepare/:opponent',
  optionalAuth,
  userRateLimit(20, 300000), // 20 requests per 5 minutes
  async (req, res) => {
    try {
      const { opponent } = req.params;
      const { 
        depth = 15,
        recentGames = 50,
        includeCounterprep = true 
      } = req.query;

      const preparation = await openingAnalyzer.prepareAgainstOpponent(opponent, {
        depth: parseInt(depth),
        recentGames: parseInt(recentGames),
        includeCounterprep: includeCounterprep === 'true'
      });

      res.json({
        success: true,
        opponent,
        preparation,
        generated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Opponent preparation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate preparation',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/statistics/openings/novelty
 * Detect novelties in games
 */
router.post('/openings/novelty',
  optionalAuth,
  validateBody({
    games: {
      required: true,
      validate: (value) => {
        if (!Array.isArray(value)) return 'Games must be an array';
      }
    }
  }),
  async (req, res) => {
    try {
      const { games, referenceDatabase } = req.body;
      
      const novelties = await openingAnalyzer.detectNovelties(games, referenceDatabase);

      res.json({
        success: true,
        novelties,
        summary: {
          totalNovelties: novelties.length,
          gamesAnalyzed: games.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Novelty detection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to detect novelties',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/statistics/openings/trends
 * Analyze opening trends over time
 */
router.post('/openings/trends',
  optionalAuth,
  validateBody({
    games: {
      required: true,
      validate: (value) => {
        if (!Array.isArray(value)) return 'Games must be an array';
      }
    }
  }),
  async (req, res) => {
    try {
      const { games, options = {} } = req.body;
      
      const trends = await openingAnalyzer.analyzeOpeningTrends(games, {
        timeWindow: options.timeWindow || 'month',
        minGames: options.minGames || 5,
        includePerformance: options.includePerformance !== false
      });

      res.json({
        success: true,
        trends,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Opening trends error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze opening trends',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/statistics/openings/tree/:eco
 * Get opening tree for specific ECO code
 */
router.get('/openings/tree/:eco',
  optionalAuth,
  async (req, res) => {
    try {
      const { eco } = req.params;
      const { depth = 10, includeStatistics = true } = req.query;

      const tree = await openingAnalyzer.buildOpeningTree([], {
        maxDepth: parseInt(depth),
        filterByEco: eco,
        includeStatistics: includeStatistics === 'true'
      });

      res.json({
        success: true,
        eco,
        tree,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Opening tree error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to build opening tree',
        details: error.message
      });
    }
  }
);

/**
 * POST /api/statistics/openings/recommendation
 * Get opening recommendations based on style
 */
router.post('/openings/recommendation',
  optionalAuth,
  validateBody({
    playerStyle: {
      required: true,
      validate: (value) => {
        if (typeof value !== 'object') return 'Player style must be an object';
      }
    }
  }),
  async (req, res) => {
    try {
      const { playerStyle, currentRepertoire = [], constraints = {} } = req.body;
      
      const recommendations = await openingAnalyzer.recommendOpenings(
        playerStyle,
        currentRepertoire,
        constraints
      );

      res.json({
        success: true,
        recommendations,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Opening recommendation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate recommendations',
        details: error.message
      });
    }
  }
);

/**
 * GET /api/statistics/openings/performance/:playerName
 * Get opening performance metrics for a player
 */
router.get('/openings/performance/:playerName',
  optionalAuth,
  userRateLimit(30, 300000),
  async (req, res) => {
    try {
      const { playerName } = req.params;
      const { 
        minGames = 5,
        timeframe = 'all'
      } = req.query;

      // Fetch player games (mock implementation - replace with actual data source)
      const games = []; // This would fetch from your database
      
      const performance = await openingAnalyzer.calculateOpeningPerformance(games, {
        minGames: parseInt(minGames),
        timeframe
      });

      res.json({
        success: true,
        player: playerName,
        performance,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Opening performance error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate opening performance',
        details: error.message
      });
    }
  }
);

// Helper function for risk categorization
function categorizeRiskLevel(var95) {
  if (var95 > 0.2) return 'high';
  if (var95 > 0.1) return 'medium';
  return 'low';
}

module.exports = router;