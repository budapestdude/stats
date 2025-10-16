/**
 * Analytics API Routes
 * Provides advanced statistical analysis and metrics
 */

const express = require('express');
const router = express.Router();
const analyticsEngine = require('../services/analytics-engine');
const logger = require('../utils/logger');

/**
 * GET /api/analytics/player/:name/metrics
 * Get comprehensive player metrics
 */
router.get('/player/:name/metrics', async (req, res) => {
  try {
    const { name } = req.params;
    const metrics = await analyticsEngine.getPlayerMetrics(name);
    
    res.json({
      success: true,
      player: name,
      metrics,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching player metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch player metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/analytics/player/:name/style
 * Classify player style based on games
 */
router.get('/player/:name/style', async (req, res) => {
  try {
    const { name } = req.params;
    const style = await analyticsEngine.classifyPlayerStyle(name);
    
    res.json({
      success: true,
      player: name,
      style,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error classifying player style:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to classify player style',
      message: error.message
    });
  }
});

/**
 * GET /api/analytics/player/:name/openings
 * Get opening analysis and success rates
 */
router.get('/player/:name/openings', async (req, res) => {
  try {
    const { name } = req.params;
    const analysis = await analyticsEngine.getOpeningAnalysis(name);
    
    res.json({
      success: true,
      player: name,
      analysis,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error analyzing openings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze openings',
      message: error.message
    });
  }
});

/**
 * GET /api/analytics/player/:name/progression
 * Get rating progression timeline
 */
router.get('/player/:name/progression', async (req, res) => {
  try {
    const { name } = req.params;
    const { period = 'year' } = req.query;
    const progression = await analyticsEngine.getRatingProgression(name, period);
    
    res.json({
      success: true,
      player: name,
      progression,
      period,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching rating progression:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rating progression',
      message: error.message
    });
  }
});

/**
 * POST /api/analytics/predict
 * Predict match outcome based on ratings
 */
router.post('/predict', async (req, res) => {
  try {
    const { player1Rating, player2Rating, player1Name, player2Name } = req.body;
    
    if (!player1Rating || !player2Rating) {
      return res.status(400).json({
        success: false,
        error: 'Player ratings are required'
      });
    }
    
    const prediction = analyticsEngine.predictMatch(
      parseInt(player1Rating),
      parseInt(player2Rating)
    );
    
    res.json({
      success: true,
      players: {
        player1: player1Name || 'Player 1',
        player2: player2Name || 'Player 2'
      },
      ratings: {
        player1: player1Rating,
        player2: player2Rating
      },
      prediction,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error predicting match:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to predict match outcome',
      message: error.message
    });
  }
});

/**
 * GET /api/analytics/tournament/:name
 * Get tournament performance analytics
 */
router.get('/tournament/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const analytics = await analyticsEngine.getTournamentAnalytics(decodeURIComponent(name));
    
    res.json({
      success: true,
      tournament: name,
      analytics,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error analyzing tournament:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze tournament',
      message: error.message
    });
  }
});

/**
 * POST /api/analytics/elo/calculate
 * Calculate ELO rating change
 */
router.post('/elo/calculate', async (req, res) => {
  try {
    const { playerRating, opponentRating, result, kFactor = 32 } = req.body;
    
    if (!playerRating || !opponentRating || !result) {
      return res.status(400).json({
        success: false,
        error: 'playerRating, opponentRating, and result are required'
      });
    }
    
    const calculation = analyticsEngine.calculateELO(
      parseInt(playerRating),
      parseInt(opponentRating),
      result,
      parseInt(kFactor)
    );
    
    res.json({
      success: true,
      input: {
        playerRating,
        opponentRating,
        result,
        kFactor
      },
      calculation,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error calculating ELO:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate ELO',
      message: error.message
    });
  }
});

/**
 * GET /api/analytics/compare
 * Compare two players
 */
router.get('/compare', async (req, res) => {
  try {
    const { player1, player2 } = req.query;
    
    if (!player1 || !player2) {
      return res.status(400).json({
        success: false,
        error: 'Both player1 and player2 parameters are required'
      });
    }
    
    // Get metrics for both players in parallel
    const [metrics1, metrics2, style1, style2] = await Promise.all([
      analyticsEngine.getPlayerMetrics(player1),
      analyticsEngine.getPlayerMetrics(player2),
      analyticsEngine.classifyPlayerStyle(player1),
      analyticsEngine.classifyPlayerStyle(player2)
    ]);
    
    // Compare metrics
    const comparison = {
      players: {
        player1: { name: player1, style: style1.type },
        player2: { name: player2, style: style2.type }
      },
      metrics: {
        totalGames: {
          player1: metrics1.totalGames,
          player2: metrics2.totalGames,
          advantage: metrics1.totalGames > metrics2.totalGames ? player1 : player2
        },
        winRate: {
          player1: parseFloat(metrics1.winRate),
          player2: parseFloat(metrics2.winRate),
          advantage: parseFloat(metrics1.winRate) > parseFloat(metrics2.winRate) ? player1 : player2
        },
        consistency: {
          player1: parseFloat(metrics1.consistency),
          player2: parseFloat(metrics2.consistency),
          advantage: parseFloat(metrics1.consistency) > parseFloat(metrics2.consistency) ? player1 : player2
        },
        aggression: {
          player1: parseFloat(metrics1.aggression),
          player2: parseFloat(metrics2.aggression),
          advantage: parseFloat(metrics1.aggression) > parseFloat(metrics2.aggression) ? player1 : player2
        },
        performanceRating: {
          player1: metrics1.performanceRating,
          player2: metrics2.performanceRating,
          advantage: metrics1.performanceRating > metrics2.performanceRating ? player1 : player2
        }
      },
      headToHead: await getHeadToHead(player1, player2),
      styleMismatch: analyzeStyleMismatch(style1, style2)
    };
    
    res.json({
      success: true,
      comparison,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error comparing players:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare players',
      message: error.message
    });
  }
});

/**
 * GET /api/analytics/trends
 * Get global trends and statistics
 */
router.get('/trends', async (req, res) => {
  try {
    const { period = '2024' } = req.query;
    
    // This would typically query the database for trends
    // For now, returning sample trend data
    const trends = {
      period,
      openingTrends: {
        mostPopular: [
          { eco: 'B90', name: 'Sicilian Najdorf', frequency: 15.2, trend: 'rising' },
          { eco: 'C42', name: 'Russian Game', frequency: 12.1, trend: 'stable' },
          { eco: 'D85', name: 'Grünfeld Defense', frequency: 10.8, trend: 'rising' },
          { eco: 'E60', name: "King's Indian", frequency: 9.5, trend: 'falling' },
          { eco: 'A45', name: 'Indian Game', frequency: 8.3, trend: 'stable' }
        ],
        emerging: [
          { eco: 'B12', name: 'Caro-Kann Advance', growth: 45 },
          { eco: 'C54', name: 'Italian Game', growth: 38 },
          { eco: 'D02', name: 'London System', growth: 32 }
        ]
      },
      gameStatistics: {
        averageLength: 42.3,
        drawRate: 31.2,
        whiteWinRate: 37.8,
        blackWinRate: 31.0,
        decisiveGameRate: 68.8
      },
      playerActivity: {
        totalGames: 9160700,
        activePlayers: 15234,
        tournamentsCompleted: 847,
        averageGamesPerPlayer: 601
      }
    };
    
    res.json({
      success: true,
      trends,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trends',
      message: error.message
    });
  }
});

// Helper function to get head-to-head record
async function getHeadToHead(player1, player2) {
  try {
    const { getPool } = require('../services/connection-pool');
    const pool = getPool();
    const connectionInfo = await pool.acquire();
    const connection = connectionInfo.connection;
    
    const query = `
      SELECT 
        COUNT(*) as total_games,
        SUM(CASE WHEN white_player = ? AND result = '1-0' THEN 1
                 WHEN black_player = ? AND result = '0-1' THEN 1
                 ELSE 0 END) as player1_wins,
        SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
        SUM(CASE WHEN white_player = ? AND result = '1-0' THEN 1
                 WHEN black_player = ? AND result = '0-1' THEN 1
                 ELSE 0 END) as player2_wins
      FROM games
      WHERE (white_player = ? AND black_player = ?)
         OR (white_player = ? AND black_player = ?)
    `;
    
    const result = await new Promise((resolve, reject) => {
      connection.get(query, [
        player1, player1, player2, player2,
        player1, player2, player2, player1
      ], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    await pool.release(connectionInfo);
    
    return {
      totalGames: result.total_games || 0,
      player1Wins: result.player1_wins || 0,
      draws: result.draws || 0,
      player2Wins: result.player2_wins || 0,
      player1Score: result.total_games > 0 ? 
        ((result.player1_wins + result.draws * 0.5) / result.total_games * 100).toFixed(1) : 0
    };
  } catch (error) {
    logger.error('Error getting head-to-head:', error);
    return null;
  }
}

// Helper function to analyze style mismatch
function analyzeStyleMismatch(style1, style2) {
  const advantages = [];
  const disadvantages = [];
  
  // Analyze style matchup
  if (style1.type === 'Aggressive Attacker' && style2.type === 'Solid Defender') {
    advantages.push('Player 2 may neutralize Player 1\'s attacking chances');
    disadvantages.push('Player 1 may struggle to create winning chances');
  } else if (style1.type === 'Strategic Player' && style2.type === 'Aggressive Attacker') {
    advantages.push('Player 1 may exploit overextension');
    disadvantages.push('Player 1 may face time pressure');
  } else if (style1.type === 'Universal Player') {
    advantages.push('Player 1 can adapt to opponent\'s style');
  }
  
  return {
    player1Advantages: advantages,
    player1Disadvantages: disadvantages,
    recommendation: generateMatchupRecommendation(style1, style2)
  };
}

// Generate matchup recommendation
function generateMatchupRecommendation(style1, style2) {
  if (style1.scores.aggression > 70 && style2.scores.solid > 70) {
    return 'Expect a clash of styles - aggressive play vs solid defense';
  } else if (style1.scores.tactical > 70 && style2.scores.positional > 70) {
    return 'Tactical complications likely - sharp positions expected';
  } else if (style1.scores.diversity > 70 || style2.scores.diversity > 70) {
    return 'Unpredictable game - varied opening choices possible';
  }
  return 'Balanced matchup - result will depend on preparation and form';
}

module.exports = router;