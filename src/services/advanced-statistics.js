/**
 * Advanced Statistical Analysis Service
 * Provides comprehensive chess statistics, analytics, and insights
 */

const { getPool } = require('./connection-pool');
const logger = require('../utils/logger');

class AdvancedStatisticsService {
  constructor() {
    this.pool = getPool();
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Get comprehensive player statistics
   */
  async getPlayerStatistics(playerName, options = {}) {
    const cacheKey = `player_stats:${playerName}:${JSON.stringify(options)}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const { 
        timeframe = 'all',
        minRating = 0,
        platform = null,
        includeOpenings = true,
        includePerformance = true 
      } = options;

      // Build time filter
      let timeFilter = '';
      if (timeframe !== 'all') {
        const timeframes = {
          '7d': 7,
          '30d': 30,
          '90d': 90,
          '1y': 365
        };
        const days = timeframes[timeframe];
        if (days) {
          timeFilter = `AND date >= date('now', '-${days} days')`;
        }
      }

      // Build rating filter
      const ratingFilter = minRating > 0 ? `AND (white_elo >= ${minRating} OR black_elo >= ${minRating})` : '';

      // Basic statistics query
      const basicStats = await new Promise((resolve, reject) => {
        db.get(`
          WITH PlayerGames AS (
            SELECT 
              CASE WHEN white_player = ? THEN 'white' ELSE 'black' END as color,
              CASE WHEN white_player = ? THEN white_elo ELSE black_elo END as player_rating,
              CASE WHEN black_player = ? THEN white_elo ELSE black_elo END as opponent_rating,
              result,
              date,
              ply_count,
              eco,
              opening,
              tournament_name,
              CASE 
                WHEN (white_player = ? AND result = '1-0') OR 
                     (black_player = ? AND result = '0-1') THEN 1
                WHEN result = '1/2-1/2' THEN 0.5
                ELSE 0
              END as score
            FROM games 
            WHERE (white_player = ? OR black_player = ?) ${timeFilter} ${ratingFilter}
          )
          SELECT 
            COUNT(*) as total_games,
            ROUND(AVG(score) * 100, 2) as win_percentage,
            SUM(CASE WHEN score = 1 THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN score = 0.5 THEN 1 ELSE 0 END) as draws,
            SUM(CASE WHEN score = 0 THEN 1 ELSE 0 END) as losses,
            SUM(CASE WHEN color = 'white' THEN 1 ELSE 0 END) as games_as_white,
            SUM(CASE WHEN color = 'black' THEN 1 ELSE 0 END) as games_as_black,
            ROUND(AVG(CASE WHEN color = 'white' AND score = 1 THEN 1 
                          WHEN color = 'white' AND score = 0.5 THEN 0.5 
                          WHEN color = 'white' THEN 0 END) * 100, 2) as white_win_percentage,
            ROUND(AVG(CASE WHEN color = 'black' AND score = 1 THEN 1 
                          WHEN color = 'black' AND score = 0.5 THEN 0.5 
                          WHEN color = 'black' THEN 0 END) * 100, 2) as black_win_percentage,
            ROUND(AVG(ply_count), 1) as avg_game_length,
            ROUND(AVG(player_rating), 0) as avg_rating,
            ROUND(AVG(opponent_rating), 0) as avg_opponent_rating,
            MAX(player_rating) as peak_rating,
            MIN(date) as first_game_date,
            MAX(date) as last_game_date
          FROM PlayerGames
        `, Array(7).fill(playerName), (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      // Performance by time control (if available)
      const timeControlStats = await new Promise((resolve, reject) => {
        db.all(`
          WITH PlayerGames AS (
            SELECT 
              CASE 
                WHEN ply_count < 40 THEN 'Bullet/Blitz'
                WHEN ply_count < 80 THEN 'Rapid'
                ELSE 'Classical'
              END as time_control_estimate,
              CASE 
                WHEN (white_player = ? AND result = '1-0') OR 
                     (black_player = ? AND result = '0-1') THEN 1
                WHEN result = '1/2-1/2' THEN 0.5
                ELSE 0
              END as score
            FROM games 
            WHERE (white_player = ? OR black_player = ?) ${timeFilter} ${ratingFilter}
          )
          SELECT 
            time_control_estimate,
            COUNT(*) as games,
            ROUND(AVG(score) * 100, 2) as win_percentage
          FROM PlayerGames
          GROUP BY time_control_estimate
          ORDER BY games DESC
        `, Array(4).fill(playerName), (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      // Rating progression over time
      const ratingProgression = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            date,
            CASE WHEN white_player = ? THEN white_elo ELSE black_elo END as rating,
            CASE 
              WHEN (white_player = ? AND result = '1-0') OR 
                   (black_player = ? AND result = '0-1') THEN 'W'
              WHEN result = '1/2-1/2' THEN 'D'
              ELSE 'L'
            END as result
          FROM games 
          WHERE (white_player = ? OR black_player = ?) 
            AND ((white_player = ? AND white_elo IS NOT NULL) OR 
                 (black_player = ? AND black_elo IS NOT NULL))
            ${timeFilter} ${ratingFilter}
          ORDER BY date ASC
          LIMIT 1000
        `, Array(7).fill(playerName), (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      // Opening performance (if requested)
      let openingStats = [];
      if (includeOpenings) {
        openingStats = await new Promise((resolve, reject) => {
          db.all(`
            WITH PlayerGames AS (
              SELECT 
                eco,
                opening,
                CASE 
                  WHEN (white_player = ? AND result = '1-0') OR 
                       (black_player = ? AND result = '0-1') THEN 1
                  WHEN result = '1/2-1/2' THEN 0.5
                  ELSE 0
                END as score,
                CASE WHEN white_player = ? THEN 'white' ELSE 'black' END as color
              FROM games 
              WHERE (white_player = ? OR black_player = ?) 
                AND eco IS NOT NULL 
                ${timeFilter} ${ratingFilter}
            )
            SELECT 
              eco,
              opening,
              color,
              COUNT(*) as games,
              ROUND(AVG(score) * 100, 2) as win_percentage,
              SUM(CASE WHEN score = 1 THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN score = 0.5 THEN 1 ELSE 0 END) as draws,
              SUM(CASE WHEN score = 0 THEN 1 ELSE 0 END) as losses
            FROM PlayerGames
            GROUP BY eco, opening, color
            HAVING games >= 3
            ORDER BY games DESC, win_percentage DESC
            LIMIT 50
          `, Array(5).fill(playerName), (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
      }

      // Performance trends (recent vs historical)
      const performanceTrends = await new Promise((resolve, reject) => {
        db.all(`
          WITH RecentGames AS (
            SELECT 
              CASE WHEN date >= date('now', '-90 days') THEN 'recent' ELSE 'historical' END as period,
              CASE 
                WHEN (white_player = ? AND result = '1-0') OR 
                     (black_player = ? AND result = '0-1') THEN 1
                WHEN result = '1/2-1/2' THEN 0.5
                ELSE 0
              END as score
            FROM games 
            WHERE (white_player = ? OR black_player = ?) ${timeFilter} ${ratingFilter}
          )
          SELECT 
            period,
            COUNT(*) as games,
            ROUND(AVG(score) * 100, 2) as win_percentage
          FROM RecentGames
          GROUP BY period
        `, Array(4).fill(playerName), (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      // Process and enhance the data
      const stats = {
        player: playerName,
        timeframe,
        lastUpdated: new Date().toISOString(),
        basic: this.enhanceBasicStats(basicStats),
        timeControls: timeControlStats,
        ratingProgression: this.processRatingProgression(ratingProgression),
        openings: this.processOpeningStats(openingStats),
        trends: this.processTrends(performanceTrends),
        insights: this.generateInsights(basicStats, openingStats, performanceTrends)
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: stats,
        timestamp: Date.now()
      });

      return stats;
    } catch (error) {
      logger.error('Player statistics error:', error);
      throw error;
    }
  }

  /**
   * Get opening statistics and trends
   */
  async getOpeningStatistics(options = {}) {
    const cacheKey = `opening_stats:${JSON.stringify(options)}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const {
        eco = null,
        minGames = 100,
        minRating = 1500,
        timeframe = 'all'
      } = options;

      // Time filter
      let timeFilter = '';
      if (timeframe !== 'all') {
        const timeframes = { '30d': 30, '90d': 90, '1y': 365, '5y': 1825 };
        const days = timeframes[timeframe];
        if (days) {
          timeFilter = `AND date >= date('now', '-${days} days')`;
        }
      }

      // ECO filter
      const ecoFilter = eco ? `AND eco = '${eco}'` : '';

      // Opening popularity and performance
      const openingStats = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            eco,
            opening,
            COUNT(*) as total_games,
            SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) as white_wins,
            SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
            SUM(CASE WHEN result = '0-1' THEN 1 ELSE 0 END) as black_wins,
            ROUND((SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) + 
                   SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) * 0.5) / COUNT(*) * 100, 2) as white_score,
            AVG(ply_count) as avg_length,
            AVG((COALESCE(white_elo, 0) + COALESCE(black_elo, 0)) / 2) as avg_rating_level,
            MIN(date) as first_seen,
            MAX(date) as last_seen
          FROM games 
          WHERE eco IS NOT NULL 
            AND opening IS NOT NULL
            AND (white_elo >= ${minRating} OR black_elo >= ${minRating})
            ${timeFilter} ${ecoFilter}
          GROUP BY eco, opening
          HAVING total_games >= ${minGames}
          ORDER BY total_games DESC
          LIMIT 200
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      // Opening trends over time
      const trendData = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            substr(date, 1, 7) as month,
            eco,
            opening,
            COUNT(*) as games
          FROM games 
          WHERE eco IS NOT NULL 
            AND opening IS NOT NULL
            AND date >= date('now', '-2 years')
            ${ecoFilter}
          GROUP BY substr(date, 1, 7), eco, opening
          HAVING games >= 10
          ORDER BY month DESC, games DESC
          LIMIT 1000
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      // Opening families analysis
      const familyStats = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            substr(eco, 1, 1) as family,
            CASE 
              WHEN substr(eco, 1, 1) = 'A' THEN 'Flank Openings'
              WHEN substr(eco, 1, 1) = 'B' THEN 'Semi-Open Games'
              WHEN substr(eco, 1, 1) = 'C' THEN 'Open Games'
              WHEN substr(eco, 1, 1) = 'D' THEN 'Closed Games'
              WHEN substr(eco, 1, 1) = 'E' THEN 'Indian Defenses'
              ELSE 'Other'
            END as family_name,
            COUNT(*) as total_games,
            ROUND(AVG((SUM(CASE WHEN result = '1-0' THEN 1 ELSE 0 END) + 
                      SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) * 0.5) / COUNT(*) * 100), 2) as avg_white_score,
            COUNT(DISTINCT eco) as variations
          FROM games 
          WHERE eco IS NOT NULL 
            ${timeFilter}
          GROUP BY substr(eco, 1, 1)
          ORDER BY total_games DESC
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      const stats = {
        timeframe,
        lastUpdated: new Date().toISOString(),
        openings: this.enhanceOpeningStats(openingStats),
        trends: this.processOpeningTrends(trendData),
        families: familyStats,
        summary: this.generateOpeningSummary(openingStats, familyStats)
      };

      this.cache.set(cacheKey, {
        data: stats,
        timestamp: Date.now()
      });

      return stats;
    } catch (error) {
      logger.error('Opening statistics error:', error);
      throw error;
    }
  }

  /**
   * Get comparative player analysis
   */
  async getComparativeAnalysis(players, options = {}) {
    try {
      const playerStats = await Promise.all(
        players.map(player => this.getPlayerStatistics(player, options))
      );

      const comparison = {
        players,
        timeframe: options.timeframe || 'all',
        lastUpdated: new Date().toISOString(),
        individual: playerStats,
        comparison: this.generateComparison(playerStats),
        headToHead: await this.getHeadToHeadStats(players)
      };

      return comparison;
    } catch (error) {
      logger.error('Comparative analysis error:', error);
      throw error;
    }
  }

  /**
   * Get tournament and event statistics
   */
  async getTournamentStatistics(options = {}) {
    const cacheKey = `tournament_stats:${JSON.stringify(options)}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const { timeframe = '1y', minGames = 50 } = options;

      // Time filter
      const timeframes = { '30d': 30, '90d': 90, '1y': 365, '5y': 1825 };
      const days = timeframes[timeframe] || 365;
      const timeFilter = `AND date >= date('now', '-${days} days')`;

      // Tournament statistics
      const tournamentStats = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            tournament_name,
            COUNT(*) as total_games,
            COUNT(DISTINCT white_player || '|' || black_player) as unique_players,
            AVG((COALESCE(white_elo, 0) + COALESCE(black_elo, 0)) / 2) as avg_rating,
            MIN(date) as start_date,
            MAX(date) as end_date,
            COUNT(DISTINCT date) as days_duration,
            COUNT(DISTINCT eco) as opening_variety
          FROM games 
          WHERE tournament_name IS NOT NULL 
            AND tournament_name != ''
            ${timeFilter}
          GROUP BY tournament_name
          HAVING total_games >= ${minGames}
          ORDER BY total_games DESC
          LIMIT 100
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      // Event type analysis
      const eventTypeStats = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            CASE 
              WHEN tournament_name LIKE '%World%Championship%' THEN 'World Championship'
              WHEN tournament_name LIKE '%Olympiad%' THEN 'Olympiad'
              WHEN tournament_name LIKE '%Grand%Prix%' OR tournament_name LIKE '%GP%' THEN 'Grand Prix'
              WHEN tournament_name LIKE '%Candidates%' THEN 'Candidates'
              WHEN tournament_name LIKE '%Open%' THEN 'Open Tournament'
              WHEN tournament_name LIKE '%Rapid%' OR tournament_name LIKE '%Blitz%' THEN 'Fast Time Control'
              ELSE 'Other'
            END as event_type,
            COUNT(*) as total_games,
            COUNT(DISTINCT tournament_name) as tournaments,
            AVG((COALESCE(white_elo, 0) + COALESCE(black_elo, 0)) / 2) as avg_rating
          FROM games 
          WHERE tournament_name IS NOT NULL 
            AND tournament_name != ''
            ${timeFilter}
          GROUP BY event_type
          ORDER BY total_games DESC
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      // Monthly tournament activity
      const monthlyActivity = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            substr(date, 1, 7) as month,
            COUNT(DISTINCT tournament_name) as tournaments,
            COUNT(*) as total_games,
            COUNT(DISTINCT white_player || '|' || black_player) as unique_players
          FROM games 
          WHERE tournament_name IS NOT NULL 
            AND tournament_name != ''
            AND date >= date('now', '-2 years')
          GROUP BY substr(date, 1, 7)
          ORDER BY month DESC
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      const stats = {
        timeframe,
        lastUpdated: new Date().toISOString(),
        tournaments: this.enhanceTournamentStats(tournamentStats),
        eventTypes: eventTypeStats,
        monthlyActivity,
        summary: this.generateTournamentSummary(tournamentStats, eventTypeStats)
      };

      this.cache.set(cacheKey, {
        data: stats,
        timestamp: Date.now()
      });

      return stats;
    } catch (error) {
      logger.error('Tournament statistics error:', error);
      throw error;
    }
  }

  /**
   * Get time series analysis
   */
  async getTimeSeriesAnalysis(metric, options = {}) {
    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const { 
        timeframe = '1y', 
        granularity = 'month',
        filters = {} 
      } = options;

      // Build time range
      const timeframes = { '30d': 30, '90d': 90, '1y': 365, '5y': 1825 };
      const days = timeframes[timeframe] || 365;
      
      // Build granularity
      const granularities = {
        'day': "date",
        'week': "strftime('%Y-W%W', date)",
        'month': "substr(date, 1, 7)",
        'year': "substr(date, 1, 4)"
      };
      const timeGroup = granularities[granularity] || granularities['month'];

      // Build filters
      let whereClause = `WHERE date >= date('now', '-${days} days')`;
      const params = [];

      if (filters.minRating) {
        whereClause += ' AND (white_elo >= ? OR black_elo >= ?)';
        params.push(filters.minRating, filters.minRating);
      }

      if (filters.player) {
        whereClause += ' AND (white_player = ? OR black_player = ?)';
        params.push(filters.player, filters.player);
      }

      // Metric-specific queries
      let query;
      switch (metric) {
        case 'game_count':
          query = `
            SELECT ${timeGroup} as period, COUNT(*) as value
            FROM games ${whereClause}
            GROUP BY ${timeGroup}
            ORDER BY period ASC
          `;
          break;

        case 'avg_rating':
          query = `
            SELECT ${timeGroup} as period, 
                   ROUND(AVG((COALESCE(white_elo, 0) + COALESCE(black_elo, 0)) / 2), 0) as value
            FROM games ${whereClause}
            GROUP BY ${timeGroup}
            ORDER BY period ASC
          `;
          break;

        case 'avg_game_length':
          query = `
            SELECT ${timeGroup} as period, ROUND(AVG(ply_count), 1) as value
            FROM games ${whereClause} AND ply_count IS NOT NULL
            GROUP BY ${timeGroup}
            ORDER BY period ASC
          `;
          break;

        case 'decisive_games_pct':
          query = `
            SELECT ${timeGroup} as period, 
                   ROUND(SUM(CASE WHEN result != '1/2-1/2' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as value
            FROM games ${whereClause}
            GROUP BY ${timeGroup}
            ORDER BY period ASC
          `;
          break;

        default:
          throw new Error(`Unsupported metric: ${metric}`);
      }

      const timeSeries = await new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      // Calculate trends and statistics
      const values = timeSeries.map(row => row.value);
      const trend = this.calculateTrend(values);
      const statistics = this.calculateSeriesStatistics(values);

      return {
        metric,
        timeframe,
        granularity,
        lastUpdated: new Date().toISOString(),
        data: timeSeries,
        trend,
        statistics
      };
    } catch (error) {
      logger.error('Time series analysis error:', error);
      throw error;
    }
  }

  /**
   * Helper methods for data processing and enhancement
   */

  enhanceBasicStats(stats) {
    if (!stats || stats.total_games === 0) return stats;

    return {
      ...stats,
      games_per_day: stats.total_games / this.daysBetween(stats.first_game_date, stats.last_game_date),
      performance_rating: this.calculatePerformanceRating(stats),
      activity_level: this.categorizeActivity(stats.total_games, stats.first_game_date),
      strength_category: this.categorizeStrength(stats.avg_rating),
      color_preference: stats.games_as_white > stats.games_as_black ? 'white' : 'black',
      consistency_score: this.calculateConsistency(stats)
    };
  }

  processRatingProgression(progression) {
    if (!progression || progression.length === 0) return [];

    // Add moving averages and trends
    return progression.map((point, index) => {
      const recentGames = progression.slice(Math.max(0, index - 9), index + 1);
      const movingAvg = recentGames.reduce((sum, g) => sum + (g.rating || 0), 0) / recentGames.length;
      
      return {
        ...point,
        movingAverage: Math.round(movingAvg),
        gameNumber: index + 1
      };
    });
  }

  processOpeningStats(openings) {
    return openings.map(opening => ({
      ...opening,
      performance_rating: this.calculateOpeningPerformance(opening),
      reliability_score: this.calculateReliability(opening),
      recommendation: this.getOpeningRecommendation(opening)
    }));
  }

  processTrends(trends) {
    const trendMap = {};
    trends.forEach(trend => {
      trendMap[trend.period] = trend;
    });
    
    return {
      recent: trendMap.recent || { games: 0, win_percentage: 0 },
      historical: trendMap.historical || { games: 0, win_percentage: 0 },
      improvement: this.calculateImprovement(trendMap)
    };
  }

  generateInsights(basicStats, openings, trends) {
    const insights = [];

    // Performance insights
    if (basicStats.win_percentage > 60) {
      insights.push({
        type: 'positive',
        category: 'performance',
        message: `Strong overall performance with ${basicStats.win_percentage}% win rate`
      });
    }

    // Color preference insights
    const colorDiff = Math.abs(basicStats.white_win_percentage - basicStats.black_win_percentage);
    if (colorDiff > 10) {
      const better = basicStats.white_win_percentage > basicStats.black_win_percentage ? 'white' : 'black';
      insights.push({
        type: 'info',
        category: 'color',
        message: `Performs significantly better with ${better} pieces (${colorDiff.toFixed(1)}% difference)`
      });
    }

    // Opening insights
    if (openings && openings.length > 0) {
      const bestOpening = openings.reduce((best, current) => 
        current.win_percentage > best.win_percentage ? current : best
      );
      
      if (bestOpening.games >= 10) {
        insights.push({
          type: 'positive',
          category: 'openings',
          message: `Strong in ${bestOpening.opening} with ${bestOpening.win_percentage}% (${bestOpening.games} games)`
        });
      }
    }

    // Trend insights
    if (trends.recent && trends.historical) {
      const improvement = trends.recent.win_percentage - trends.historical.win_percentage;
      if (Math.abs(improvement) > 5) {
        insights.push({
          type: improvement > 0 ? 'positive' : 'warning',
          category: 'trends',
          message: improvement > 0 
            ? `Recent form is strong - up ${improvement.toFixed(1)}% from historical average`
            : `Recent performance down ${Math.abs(improvement).toFixed(1)}% from historical average`
        });
      }
    }

    return insights;
  }

  // Additional helper methods...
  daysBetween(date1, date2) {
    if (!date1 || !date2) return 1;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.max(1, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
  }

  calculatePerformanceRating(stats) {
    // Simplified performance rating calculation
    const expectedScore = 0.5; // Assuming equal opposition
    const actualScore = stats.win_percentage / 100;
    const scoreDiff = actualScore - expectedScore;
    return Math.round(stats.avg_rating + (scoreDiff * 400));
  }

  categorizeActivity(totalGames, firstGameDate) {
    if (!firstGameDate) return 'unknown';
    const days = this.daysBetween(firstGameDate, new Date().toISOString().split('T')[0]);
    const gamesPerDay = totalGames / days;
    
    if (gamesPerDay > 5) return 'very_active';
    if (gamesPerDay > 2) return 'active';
    if (gamesPerDay > 0.5) return 'moderate';
    return 'casual';
  }

  categorizeStrength(rating) {
    if (rating >= 2700) return 'super_gm';
    if (rating >= 2500) return 'gm';
    if (rating >= 2400) return 'im';
    if (rating >= 2200) return 'master';
    if (rating >= 2000) return 'expert';
    if (rating >= 1800) return 'advanced';
    if (rating >= 1600) return 'intermediate';
    return 'beginner';
  }

  calculateConsistency(stats) {
    // Simplified consistency score based on draw rate and rating stability
    const drawRate = (stats.draws / stats.total_games) * 100;
    return Math.round(50 + (drawRate - 25) * 0.5); // Normalize around 50
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = n * (n - 1) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + (index * val), 0);
    const sumX2 = n * (n - 1) * (2 * n - 1) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  calculateSeriesStatistics(values) {
    if (values.length === 0) return {};
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return {
      count: values.length,
      mean: Math.round(mean * 100) / 100,
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      standardDeviation: Math.round(Math.sqrt(variance) * 100) / 100,
      range: sorted[sorted.length - 1] - sorted[0]
    };
  }

  /**
   * Get rating analysis and predictions
   */
  async getRatingAnalysis(playerName, options = {}) {
    const cacheKey = `rating_analysis:${playerName}:${JSON.stringify(options)}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const { timeframe = '2y', predictions = true } = options;
      const timeframes = { '1y': 365, '2y': 730, '5y': 1825, 'all': 3650 };
      const days = timeframes[timeframe] || 730;

      // Rating progression over time
      const ratingProgression = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            date,
            CASE 
              WHEN white_player = ? THEN white_elo
              WHEN black_player = ? THEN black_elo
            END as rating,
            CASE 
              WHEN white_player = ? THEN result
              WHEN black_player = ? THEN 
                CASE 
                  WHEN result = '1-0' THEN '0-1'
                  WHEN result = '0-1' THEN '1-0'
                  ELSE result
                END
            END as game_result
          FROM games 
          WHERE (white_player = ? OR black_player = ?)
            AND date >= date('now', '-${days} days')
            AND ((white_player = ? AND white_elo IS NOT NULL) OR (black_player = ? AND black_elo IS NOT NULL))
          ORDER BY date ASC
        `, [playerName, playerName, playerName, playerName, playerName, playerName, playerName, playerName], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      if (ratingProgression.length === 0) {
        await this.pool.release(connectionInfo);
        return { error: 'No rating data found for player' };
      }

      // Calculate rating statistics
      const ratings = ratingProgression.map(r => r.rating).filter(r => r);
      const currentRating = ratings[ratings.length - 1];
      const peakRating = Math.max(...ratings);
      const lowestRating = Math.min(...ratings);
      const ratingRange = peakRating - lowestRating;

      // Calculate rating volatility (standard deviation)
      const avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      const volatility = Math.sqrt(ratings.reduce((sum, r) => sum + Math.pow(r - avgRating, 2), 0) / ratings.length);

      // Performance vs rating analysis
      const performanceAnalysis = await this.calculatePerformanceVsRating(db, playerName, days);

      // Rating prediction if requested
      let prediction = null;
      if (predictions && ratingProgression.length >= 10) {
        prediction = this.predictRatingTrend(ratingProgression);
      }

      // Recent form analysis (last 20 games)
      const recentForm = await this.calculateRecentForm(db, playerName, 20);

      await this.pool.release(connectionInfo);

      const analysis = {
        player: playerName,
        timeframe,
        lastUpdated: new Date().toISOString(),
        current: {
          rating: currentRating,
          peakRating,
          lowestRating,
          ratingRange,
          volatility: Math.round(volatility * 10) / 10
        },
        progression: this.smoothRatingProgression(ratingProgression),
        performance: performanceAnalysis,
        recentForm,
        statistics: {
          gamesAnalyzed: ratingProgression.length,
          avgRating: Math.round(avgRating),
          ratingGain: currentRating - ratings[0],
          bestStreak: this.calculateBestRatingStreak(ratingProgression),
          worstStreak: this.calculateWorstRatingStreak(ratingProgression)
        },
        prediction
      };

      this.cache.set(cacheKey, {
        data: analysis,
        timestamp: Date.now()
      });

      return analysis;
    } catch (error) {
      logger.error('Rating analysis error:', error);
      throw error;
    }
  }

  // Rating analysis helper methods
  async calculatePerformanceVsRating(db, playerName, days) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          ROUND((COALESCE(white_elo, black_elo))/100)*100 as rating_range,
          COUNT(*) as games,
          SUM(CASE 
            WHEN (white_player = ? AND result = '1-0') OR (black_player = ? AND result = '0-1') THEN 1 
            ELSE 0 
          END) as wins,
          SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws
        FROM games 
        WHERE (white_player = ? OR black_player = ?)
          AND date >= date('now', '-${days} days')
          AND (white_elo IS NOT NULL OR black_elo IS NOT NULL)
        GROUP BY rating_range
        HAVING games >= 3
        ORDER BY rating_range ASC
      `, [playerName, playerName, playerName, playerName], (err, rows) => {
        if (err) reject(err);
        else {
          const analysis = rows.map(row => ({
            ratingRange: row.rating_range,
            games: row.games,
            winRate: Math.round((row.wins / row.games) * 100),
            drawRate: Math.round((row.draws / row.games) * 100)
          }));
          resolve(analysis);
        }
      });
    });
  }

  predictRatingTrend(progression) {
    if (progression.length < 10) return null;

    const recent = progression.slice(-20); // Last 20 games
    const ratings = recent.map(g => g.rating);
    const trend = this.calculateTrend(ratings);
    
    // Simple linear projection
    const currentRating = ratings[ratings.length - 1];
    const projectedChange = trend * 30; // Project 30 games ahead
    const confidence = Math.max(0, Math.min(100, 100 - Math.abs(trend) * 1000));

    return {
      currentRating,
      projectedRating: Math.round(currentRating + projectedChange),
      trend: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable',
      confidence: Math.round(confidence),
      trendStrength: Math.abs(trend * 1000)
    };
  }

  async calculateRecentForm(db, playerName, gameCount) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          date,
          CASE 
            WHEN white_player = ? THEN white_elo
            WHEN black_player = ? THEN black_elo
          END as rating,
          CASE 
            WHEN (white_player = ? AND result = '1-0') OR (black_player = ? AND result = '0-1') THEN 'win'
            WHEN result = '1/2-1/2' THEN 'draw'
            ELSE 'loss'
          END as result
        FROM games 
        WHERE (white_player = ? OR black_player = ?)
        ORDER BY date DESC
        LIMIT ?
      `, [playerName, playerName, playerName, playerName, playerName, playerName, gameCount], (err, rows) => {
        if (err) reject(err);
        else {
          const wins = rows.filter(r => r.result === 'win').length;
          const draws = rows.filter(r => r.result === 'draw').length;
          const form = {
            games: rows.length,
            wins,
            draws,
            losses: rows.length - wins - draws,
            winRate: Math.round((wins / rows.length) * 100),
            points: wins + (draws * 0.5),
            performance: Math.round(((wins + draws * 0.5) / rows.length) * 100),
            streak: this.calculateCurrentStreak(rows)
          };
          resolve(form);
        }
      });
    });
  }

  smoothRatingProgression(progression) {
    return progression.map((point, index) => {
      const window = Math.min(5, index + 1);
      const start = Math.max(0, index - window + 1);
      const slice = progression.slice(start, index + 1);
      const smoothed = slice.reduce((sum, p) => sum + p.rating, 0) / slice.length;
      
      return {
        ...point,
        smoothedRating: Math.round(smoothed)
      };
    });
  }

  calculateBestRatingStreak(progression) {
    let maxGain = 0;
    let bestStreak = { start: 0, end: 0, gain: 0 };
    
    for (let i = 0; i < progression.length; i++) {
      for (let j = i + 1; j < progression.length; j++) {
        const gain = progression[j].rating - progression[i].rating;
        if (gain > maxGain) {
          maxGain = gain;
          bestStreak = {
            start: progression[i].date,
            end: progression[j].date,
            gain: Math.round(gain)
          };
        }
      }
    }
    
    return bestStreak;
  }

  calculateWorstRatingStreak(progression) {
    let maxLoss = 0;
    let worstStreak = { start: 0, end: 0, loss: 0 };
    
    for (let i = 0; i < progression.length; i++) {
      for (let j = i + 1; j < progression.length; j++) {
        const loss = progression[i].rating - progression[j].rating;
        if (loss > maxLoss) {
          maxLoss = loss;
          worstStreak = {
            start: progression[i].date,
            end: progression[j].date,
            loss: Math.round(loss)
          };
        }
      }
    }
    
    return worstStreak;
  }

  calculateCurrentStreak(recentGames) {
    if (recentGames.length === 0) return { type: 'none', count: 0 };
    
    const latest = recentGames[0].result;
    let count = 0;
    
    for (const game of recentGames) {
      if (game.result === latest) {
        count++;
      } else {
        break;
      }
    }
    
    return { type: latest, count };
  }

  // Placeholder methods for additional functionality
  enhanceOpeningStats(openings) { return openings; }
  processOpeningTrends(trends) { return trends; }
  generateOpeningSummary(openings, families) { return {}; }
  enhanceTournamentStats(tournaments) { return tournaments; }
  generateTournamentSummary(tournaments, types) { return {}; }
  generateComparison(playerStats) {
    if (playerStats.length < 2) return {};

    const comparison = {
      playerCount: playerStats.length,
      metrics: {}
    };

    // Compare key metrics
    const metrics = ['total_games', 'win_percentage', 'avg_rating', 'total_wins', 'total_draws', 'total_losses'];
    
    metrics.forEach(metric => {
      const values = playerStats.map(p => p[metric] || 0);
      const max = Math.max(...values);
      const min = Math.min(...values);
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      
      comparison.metrics[metric] = {
        highest: { value: max, player: playerStats.find(p => p[metric] === max)?.player_name },
        lowest: { value: min, player: playerStats.find(p => p[metric] === min)?.player_name },
        average: Math.round(avg * 100) / 100,
        spread: max - min
      };
    });

    // Performance tiers
    comparison.tiers = this.categorizePlayersByPerformance(playerStats);
    
    // Strengths and weaknesses
    comparison.insights = this.generateComparisonInsights(playerStats);

    return comparison;
  }

  async getHeadToHeadStats(players) {
    if (players.length < 2) return {};

    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const headToHead = {};

      // Get head-to-head records for each player pair
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          const player1 = players[i];
          const player2 = players[j];
          
          const matchup = await new Promise((resolve, reject) => {
            db.all(`
              SELECT 
                result,
                date,
                tournament_name,
                CASE 
                  WHEN white_player = ? THEN 'white'
                  ELSE 'black'
                END as player1_color
              FROM games 
              WHERE ((white_player = ? AND black_player = ?) OR (white_player = ? AND black_player = ?))
              ORDER BY date DESC
              LIMIT 100
            `, [player1, player1, player2, player2, player1], (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            });
          });

          if (matchup.length > 0) {
            const stats = this.calculateHeadToHeadStats(matchup, player1, player2);
            headToHead[`${player1}_vs_${player2}`] = stats;
          }
        }
      }

      await this.pool.release(connectionInfo);
      return headToHead;
    } catch (error) {
      logger.error('Head-to-head stats error:', error);
      return {};
    }
  }

  // Helper methods for comparative statistics
  categorizePlayersByPerformance(playerStats) {
    const tiers = { elite: [], strong: [], average: [], developing: [] };
    
    playerStats.forEach(player => {
      const rating = player.avg_rating || 0;
      const winRate = player.win_percentage || 0;
      
      if (rating >= 2600 || winRate >= 70) {
        tiers.elite.push(player.player_name);
      } else if (rating >= 2400 || winRate >= 60) {
        tiers.strong.push(player.player_name);
      } else if (rating >= 2000 || winRate >= 50) {
        tiers.average.push(player.player_name);
      } else {
        tiers.developing.push(player.player_name);
      }
    });

    return tiers;
  }

  generateComparisonInsights(playerStats) {
    const insights = [];

    // Find the most active player
    const mostActive = playerStats.reduce((max, current) => 
      (current.total_games > max.total_games) ? current : max
    );
    insights.push({
      type: 'activity',
      message: `${mostActive.player_name} is the most active with ${mostActive.total_games} games`
    });

    // Find best performer by win rate
    const bestPerformer = playerStats.reduce((max, current) => 
      (current.win_percentage > max.win_percentage) ? current : max
    );
    insights.push({
      type: 'performance',
      message: `${bestPerformer.player_name} has the highest win rate at ${bestPerformer.win_percentage}%`
    });

    // Rating analysis
    const ratings = playerStats.map(p => p.avg_rating || 0).filter(r => r > 0);
    if (ratings.length > 1) {
      const ratingSpread = Math.max(...ratings) - Math.min(...ratings);
      insights.push({
        type: 'rating',
        message: `Rating spread of ${ratingSpread} points shows ${ratingSpread > 400 ? 'significant' : 'moderate'} skill differences`
      });
    }

    return insights;
  }

  calculateHeadToHeadStats(matchup, player1, player2) {
    let player1Wins = 0;
    let player2Wins = 0;
    let draws = 0;
    let player1AsWhite = 0;
    let player2AsWhite = 0;

    matchup.forEach(game => {
      if (game.result === '1/2-1/2') {
        draws++;
      } else if (game.player1_color === 'white') {
        player1AsWhite++;
        if (game.result === '1-0') {
          player1Wins++;
        } else {
          player2Wins++;
        }
      } else {
        player2AsWhite++;
        if (game.result === '0-1') {
          player1Wins++;
        } else {
          player2Wins++;
        }
      }
    });

    const totalGames = matchup.length;
    const player1Score = player1Wins + (draws * 0.5);
    const player2Score = player2Wins + (draws * 0.5);

    return {
      player1: player1,
      player2: player2,
      totalGames,
      player1Stats: {
        wins: player1Wins,
        losses: player2Wins,
        draws,
        score: player1Score,
        percentage: Math.round((player1Score / totalGames) * 100),
        asWhite: player1AsWhite,
        asBlack: totalGames - player1AsWhite
      },
      player2Stats: {
        wins: player2Wins,
        losses: player1Wins,
        draws,
        score: player2Score,
        percentage: Math.round((player2Score / totalGames) * 100),
        asWhite: player2AsWhite,
        asBlack: totalGames - player2AsWhite
      },
      recentGames: matchup.slice(0, 10).map(game => ({
        date: game.date,
        result: game.result,
        tournament: game.tournament_name,
        player1Color: game.player1_color
      }))
    };
  }

  // Additional methods for new endpoints
  async findSimilarPlayers(playerName, options = {}) {
    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const { ratingRange = 100, limit = 5 } = options;

      // Get player's average rating first
      const playerStats = await new Promise((resolve, reject) => {
        db.get(`
          SELECT AVG((COALESCE(white_elo, 0) + COALESCE(black_elo, 0)) / 2) as avg_rating
          FROM games 
          WHERE (white_player = ? OR black_player = ?)
            AND (white_elo IS NOT NULL OR black_elo IS NOT NULL)
        `, [playerName, playerName], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!playerStats || !playerStats.avg_rating) {
        await this.pool.release(connectionInfo);
        return [];
      }

      const targetRating = playerStats.avg_rating;
      const minRating = targetRating - ratingRange;
      const maxRating = targetRating + ratingRange;

      // Find similar players
      const similarPlayers = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            player_name,
            AVG(rating) as avg_rating,
            COUNT(*) as total_games,
            SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins
          FROM (
            SELECT white_player as player_name, white_elo as rating,
              CASE WHEN result = '1-0' THEN 'win' ELSE 'other' END as result
            FROM games WHERE white_player != ? AND white_elo BETWEEN ? AND ?
            UNION ALL
            SELECT black_player as player_name, black_elo as rating,
              CASE WHEN result = '0-1' THEN 'win' ELSE 'other' END as result
            FROM games WHERE black_player != ? AND black_elo BETWEEN ? AND ?
          )
          GROUP BY player_name
          HAVING total_games >= 10
          ORDER BY ABS(avg_rating - ?) ASC
          LIMIT ?
        `, [playerName, minRating, maxRating, playerName, minRating, maxRating, targetRating, limit], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      return similarPlayers.map(p => ({
        name: p.player_name,
        avgRating: Math.round(p.avg_rating),
        totalGames: p.total_games,
        winRate: Math.round((p.wins / p.total_games) * 100),
        similarity: Math.round((1 - Math.abs(p.avg_rating - targetRating) / ratingRange) * 100)
      }));
    } catch (error) {
      logger.error('Find similar players error:', error);
      return [];
    }
  }

  async getVisualizationData(type, options = {}) {
    try {
      const { player, timeframe = '1y', granularity = 'month', metric = 'rating' } = options;

      switch (type) {
        case 'line_chart':
          return await this.getTimeSeriesAnalysis(metric, { timeframe, granularity, filters: { player } });
        
        case 'heatmap':
          return await this.generateHeatmapData(player, timeframe);
        
        case 'histogram':
          return await this.generateHistogramData(metric, { player, timeframe });
        
        case 'bar_chart':
          return await this.generateBarChartData(metric, { player, timeframe });
        
        default:
          return { error: 'Visualization type not implemented' };
      }
    } catch (error) {
      logger.error('Visualization data error:', error);
      return { error: 'Failed to generate visualization data' };
    }
  }

  async getAdvancedFilteredData(options = {}) {
    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const { filters = {}, groupBy = 'month', aggregations = ['count'], limit = 100 } = options;

      let whereClause = 'WHERE 1=1';
      const params = [];

      // Build dynamic WHERE clause
      if (filters.players && filters.players.length > 0) {
        const playerPlaceholders = filters.players.map(() => '?').join(',');
        whereClause += ` AND (white_player IN (${playerPlaceholders}) OR black_player IN (${playerPlaceholders}))`;
        params.push(...filters.players, ...filters.players);
      }

      if (filters.dateFrom) {
        whereClause += ' AND date >= ?';
        params.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        whereClause += ' AND date <= ?';
        params.push(filters.dateTo);
      }

      if (filters.minRating) {
        whereClause += ' AND (white_elo >= ? OR black_elo >= ?)';
        params.push(filters.minRating, filters.minRating);
      }

      if (filters.maxRating) {
        whereClause += ' AND (white_elo <= ? OR black_elo <= ?)';
        params.push(filters.maxRating, filters.maxRating);
      }

      // Build SELECT and GROUP BY clauses
      let selectClause = '';
      let groupByClause = '';

      switch (groupBy) {
        case 'month':
          selectClause = "substr(date, 1, 7) as period";
          groupByClause = "GROUP BY substr(date, 1, 7)";
          break;
        case 'year':
          selectClause = "substr(date, 1, 4) as period";
          groupByClause = "GROUP BY substr(date, 1, 4)";
          break;
        case 'player':
          selectClause = "COALESCE(white_player, black_player) as period";
          groupByClause = "GROUP BY COALESCE(white_player, black_player)";
          break;
        default:
          selectClause = "date as period";
          groupByClause = "";
      }

      // Build aggregation clauses
      const aggClauses = [];
      if (aggregations.includes('count')) aggClauses.push('COUNT(*) as game_count');
      if (aggregations.includes('avg_rating')) aggClauses.push('ROUND(AVG((COALESCE(white_elo, 0) + COALESCE(black_elo, 0)) / 2), 0) as avg_rating');
      if (aggregations.includes('win_rate')) aggClauses.push('ROUND(SUM(CASE WHEN result != \'1/2-1/2\' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as decisive_rate');

      const query = `
        SELECT ${selectClause}, ${aggClauses.join(', ')}
        FROM games ${whereClause}
        ${groupByClause}
        ORDER BY period DESC
        LIMIT ?
      `;

      params.push(limit);

      const data = await new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      return {
        data,
        summary: {
          totalRecords: data.length,
          filters: Object.keys(filters).length,
          groupBy,
          aggregations
        }
      };
    } catch (error) {
      logger.error('Advanced filtering error:', error);
      return { error: 'Failed to execute advanced filtering' };
    }
  }

  async generateHeatmapData(player, timeframe) {
    // Placeholder - would generate activity heatmap data
    return { data: [], config: { type: 'activity_heatmap' } };
  }

  async generateHistogramData(metric, options) {
    // Placeholder - would generate distribution histograms
    return { data: [], config: { metric, bins: 20 } };
  }

  async generateBarChartData(metric, options) {
    // Placeholder - would generate bar chart data
    return { data: [], config: { metric, orientation: 'vertical' } };
  }

  calculateOpeningPerformance(opening) { return 0; }
  calculateReliability(opening) { return 0; }
  getOpeningRecommendation(opening) { return 'neutral'; }
  calculateImprovement(trendMap) { return 0; }
}

module.exports = new AdvancedStatisticsService();