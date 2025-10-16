/**
 * Data Visualization Service
 * Generates chart data and statistical visualizations for frontend consumption
 */

const { getPool } = require('./connection-pool');
const logger = require('../utils/logger');

class DataVisualizationService {
  constructor() {
    this.pool = getPool();
    this.cache = new Map();
    this.cacheTimeout = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Generate rating progression chart data
   */
  async generateRatingChart(playerName, options = {}) {
    const cacheKey = `rating_chart:${playerName}:${JSON.stringify(options)}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const { timeframe = '1y', smoothing = true } = options;

      // Time filter
      const timeframes = { '30d': 30, '90d': 90, '1y': 365, '5y': 1825 };
      const days = timeframes[timeframe] || 365;
      const timeFilter = `AND date >= date('now', '-${days} days')`;

      const ratingData = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            date,
            CASE WHEN white_player = ? THEN white_elo ELSE black_elo END as rating,
            CASE WHEN white_player = ? THEN black_elo ELSE white_elo END as opponent_rating,
            CASE 
              WHEN (white_player = ? AND result = '1-0') OR 
                   (black_player = ? AND result = '0-1') THEN 'W'
              WHEN result = '1/2-1/2' THEN 'D'
              ELSE 'L'
            END as game_result,
            eco,
            opening,
            tournament_name
          FROM games 
          WHERE (white_player = ? OR black_player = ?) 
            AND ((white_player = ? AND white_elo IS NOT NULL) OR 
                 (black_player = ? AND black_elo IS NOT NULL))
            ${timeFilter}
          ORDER BY date ASC
        `, Array(8).fill(playerName), (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      // Process data for chart
      const chartData = this.processRatingData(ratingData, { smoothing });

      this.cache.set(cacheKey, {
        data: chartData,
        timestamp: Date.now()
      });

      return chartData;
    } catch (error) {
      logger.error('Rating chart generation error:', error);
      throw error;
    }
  }

  /**
   * Generate performance comparison chart
   */
  async generatePerformanceComparison(players, options = {}) {
    try {
      const { metric = 'win_rate', timeframe = '1y' } = options;

      const performanceData = await Promise.all(
        players.map(async (player) => {
          const stats = await this.getPlayerMetrics(player, metric, timeframe);
          return {
            player,
            data: stats
          };
        })
      );

      return {
        type: 'comparison',
        metric,
        timeframe,
        data: performanceData,
        chartConfig: this.getChartConfig('comparison', metric)
      };
    } catch (error) {
      logger.error('Performance comparison error:', error);
      throw error;
    }
  }

  /**
   * Generate opening distribution pie chart
   */
  async generateOpeningDistribution(playerName, options = {}) {
    const cacheKey = `opening_dist:${playerName}:${JSON.stringify(options)}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const { color = 'both', minGames = 5, timeframe = 'all' } = options;

      // Color filter
      let colorFilter = '';
      if (color === 'white') {
        colorFilter = 'AND white_player = ?';
      } else if (color === 'black') {
        colorFilter = 'AND black_player = ?';
      } else {
        colorFilter = 'AND (white_player = ? OR black_player = ?)';
      }

      // Time filter
      let timeFilter = '';
      if (timeframe !== 'all') {
        const days = { '30d': 30, '90d': 90, '1y': 365 }[timeframe];
        if (days) {
          timeFilter = `AND date >= date('now', '-${days} days')`;
        }
      }

      const params = color === 'both' ? [playerName, playerName] : [playerName];

      const openingData = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            eco,
            opening,
            COUNT(*) as games,
            ROUND(SUM(CASE 
              WHEN (white_player = ? AND result = '1-0') OR 
                   (black_player = ? AND result = '0-1') THEN 1
              WHEN result = '1/2-1/2' THEN 0.5
              ELSE 0
            END) / COUNT(*) * 100, 1) as win_rate
          FROM games 
          WHERE eco IS NOT NULL 
            ${colorFilter} ${timeFilter}
          GROUP BY eco, opening
          HAVING games >= ${minGames}
          ORDER BY games DESC
          LIMIT 20
        `, [...params, ...params], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      // Process for pie chart
      const total = openingData.reduce((sum, item) => sum + item.games, 0);
      const chartData = {
        type: 'pie',
        title: `Opening Distribution - ${playerName}`,
        data: openingData.map(item => ({
          name: `${item.eco}: ${item.opening}`,
          value: item.games,
          percentage: ((item.games / total) * 100).toFixed(1),
          winRate: item.win_rate,
          eco: item.eco
        })),
        summary: {
          totalGames: total,
          uniqueOpenings: openingData.length,
          topOpening: openingData[0]
        }
      };

      this.cache.set(cacheKey, {
        data: chartData,
        timestamp: Date.now()
      });

      return chartData;
    } catch (error) {
      logger.error('Opening distribution error:', error);
      throw error;
    }
  }

  /**
   * Generate time series heatmap
   */
  async generateActivityHeatmap(playerName, options = {}) {
    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const { timeframe = '1y' } = options;
      const days = { '90d': 90, '1y': 365, '2y': 730 }[timeframe] || 365;

      const activityData = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            date,
            COUNT(*) as games,
            AVG(CASE 
              WHEN (white_player = ? AND result = '1-0') OR 
                   (black_player = ? AND result = '0-1') THEN 1
              WHEN result = '1/2-1/2' THEN 0.5
              ELSE 0
            END) as avg_score
          FROM games 
          WHERE (white_player = ? OR black_player = ?) 
            AND date >= date('now', '-${days} days')
          GROUP BY date
          ORDER BY date ASC
        `, Array(4).fill(playerName), (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      // Process for heatmap
      const heatmapData = this.processHeatmapData(activityData, timeframe);

      return {
        type: 'heatmap',
        title: `Activity Heatmap - ${playerName}`,
        timeframe,
        data: heatmapData,
        config: {
          colorScale: ['#f7f7f7', '#d9f2d9', '#90ee90', '#32cd32', '#228b22'],
          tooltipFormat: 'Date: {date}<br/>Games: {games}<br/>Score: {score}%'
        }
      };
    } catch (error) {
      logger.error('Activity heatmap error:', error);
      throw error;
    }
  }

  /**
   * Generate rating distribution histogram
   */
  async generateRatingDistribution(options = {}) {
    const cacheKey = `rating_dist:${JSON.stringify(options)}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const { bucketSize = 100, timeframe = '1y', platform } = options;

      // Time filter
      const days = { '30d': 30, '90d': 90, '1y': 365, '5y': 1825 }[timeframe] || 365;
      const timeFilter = `AND date >= date('now', '-${days} days')`;

      // Platform filter (placeholder for future implementation)
      const platformFilter = platform ? `AND platform = '${platform}'` : '';

      const distributionData = await new Promise((resolve, reject) => {
        db.all(`
          WITH AllRatings AS (
            SELECT white_elo as rating FROM games 
            WHERE white_elo IS NOT NULL ${timeFilter} ${platformFilter}
            UNION ALL
            SELECT black_elo as rating FROM games 
            WHERE black_elo IS NOT NULL ${timeFilter} ${platformFilter}
          ),
          RatingBuckets AS (
            SELECT 
              (rating / ${bucketSize}) * ${bucketSize} as bucket,
              COUNT(*) as count
            FROM AllRatings
            WHERE rating BETWEEN 800 AND 3000
            GROUP BY (rating / ${bucketSize})
          )
          SELECT 
            bucket,
            count,
            bucket + ${bucketSize} as bucket_end
          FROM RatingBuckets
          ORDER BY bucket
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      // Process for histogram
      const total = distributionData.reduce((sum, item) => sum + item.count, 0);
      const chartData = {
        type: 'histogram',
        title: 'Rating Distribution',
        bucketSize,
        totalPlayers: total,
        data: distributionData.map(item => ({
          range: `${item.bucket}-${item.bucket_end}`,
          count: item.count,
          percentage: ((item.count / total) * 100).toFixed(2),
          bucket: item.bucket
        })),
        statistics: this.calculateDistributionStats(distributionData)
      };

      this.cache.set(cacheKey, {
        data: chartData,
        timestamp: Date.now()
      });

      return chartData;
    } catch (error) {
      logger.error('Rating distribution error:', error);
      throw error;
    }
  }

  /**
   * Generate multi-dimensional scatter plot data
   */
  async generateScatterPlot(options = {}) {
    try {
      const {
        xMetric = 'rating',
        yMetric = 'games_played',
        zMetric = 'win_rate',
        players = null,
        minGames = 100,
        timeframe = '1y'
      } = options;

      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      const days = { '30d': 30, '90d': 90, '1y': 365 }[timeframe] || 365;
      const timeFilter = `AND date >= date('now', '-${days} days')`;

      // Player filter
      const playerFilter = players && players.length > 0 
        ? `AND (white_player IN (${players.map(() => '?').join(',')}) OR black_player IN (${players.map(() => '?').join(',')}))`
        : '';
      
      const playerParams = players ? [...players, ...players] : [];

      const scatterData = await new Promise((resolve, reject) => {
        db.all(`
          WITH PlayerStats AS (
            SELECT 
              player,
              COUNT(*) as games_played,
              AVG(rating) as avg_rating,
              AVG(opponent_rating) as avg_opponent_rating,
              AVG(score) as win_rate,
              AVG(game_length) as avg_game_length
            FROM (
              SELECT 
                white_player as player,
                white_elo as rating,
                black_elo as opponent_rating,
                ply_count as game_length,
                CASE WHEN result = '1-0' THEN 1 WHEN result = '1/2-1/2' THEN 0.5 ELSE 0 END as score
              FROM games 
              WHERE white_player IS NOT NULL AND white_elo IS NOT NULL ${timeFilter} ${playerFilter}
              
              UNION ALL
              
              SELECT 
                black_player as player,
                black_elo as rating,
                white_elo as opponent_rating,
                ply_count as game_length,
                CASE WHEN result = '0-1' THEN 1 WHEN result = '1/2-1/2' THEN 0.5 ELSE 0 END as score
              FROM games 
              WHERE black_player IS NOT NULL AND black_elo IS NOT NULL ${timeFilter} ${playerFilter}
            ) 
            GROUP BY player
            HAVING games_played >= ${minGames}
          )
          SELECT 
            player,
            games_played,
            ROUND(avg_rating, 0) as rating,
            ROUND(avg_opponent_rating, 0) as avg_opponent_rating,
            ROUND(win_rate * 100, 1) as win_rate,
            ROUND(avg_game_length, 1) as avg_game_length
          FROM PlayerStats
          ORDER BY games_played DESC
          LIMIT 500
        `, playerParams, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      // Process for scatter plot
      const chartData = {
        type: 'scatter',
        title: `${yMetric} vs ${xMetric}`,
        axes: {
          x: { metric: xMetric, label: this.getMetricLabel(xMetric) },
          y: { metric: yMetric, label: this.getMetricLabel(yMetric) },
          z: { metric: zMetric, label: this.getMetricLabel(zMetric) }
        },
        data: scatterData.map(item => ({
          player: item.player,
          x: item[xMetric] || 0,
          y: item[yMetric] || 0,
          z: item[zMetric] || 0,
          details: item
        })),
        correlations: this.calculateCorrelations(scatterData, [xMetric, yMetric, zMetric])
      };

      return chartData;
    } catch (error) {
      logger.error('Scatter plot generation error:', error);
      throw error;
    }
  }

  /**
   * Generate trend analysis chart
   */
  async generateTrendChart(metric, options = {}) {
    try {
      const {
        timeframe = '2y',
        granularity = 'month',
        players = null,
        tournaments = null
      } = options;

      const connectionInfo = await this.pool.acquire();
      const db = connectionInfo.connection;

      // Build time grouping
      const granularities = {
        'day': "date",
        'week': "strftime('%Y-W%W', date)",
        'month': "substr(date, 1, 7)",
        'quarter': "substr(date, 1, 4) || '-Q' || ((CAST(substr(date, 6, 2) AS INTEGER) - 1) / 3 + 1)",
        'year': "substr(date, 1, 4)"
      };
      const timeGroup = granularities[granularity] || granularities['month'];

      // Build filters
      let whereClause = 'WHERE 1=1';
      const params = [];

      if (timeframe !== 'all') {
        const days = { '30d': 30, '90d': 90, '1y': 365, '2y': 730, '5y': 1825 }[timeframe];
        if (days) {
          whereClause += ' AND date >= date(\'now\', \'-' + days + ' days\')';
        }
      }

      if (players && players.length > 0) {
        whereClause += ` AND (white_player IN (${players.map(() => '?').join(',')}) OR black_player IN (${players.map(() => '?').join(',')}))`;
        params.push(...players, ...players);
      }

      if (tournaments && tournaments.length > 0) {
        whereClause += ` AND tournament_name IN (${tournaments.map(() => '?').join(',')})`;
        params.push(...tournaments);
      }

      // Metric-specific query
      let metricQuery;
      switch (metric) {
        case 'activity':
          metricQuery = `COUNT(*) as value`;
          break;
        case 'avg_rating':
          metricQuery = `ROUND(AVG((COALESCE(white_elo, 0) + COALESCE(black_elo, 0)) / 2), 0) as value`;
          break;
        case 'decisive_rate':
          metricQuery = `ROUND(SUM(CASE WHEN result != '1/2-1/2' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as value`;
          break;
        case 'avg_length':
          metricQuery = `ROUND(AVG(ply_count), 1) as value`;
          break;
        default:
          metricQuery = `COUNT(*) as value`;
      }

      const trendData = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            ${timeGroup} as period,
            ${metricQuery}
          FROM games 
          ${whereClause}
          GROUP BY ${timeGroup}
          ORDER BY period ASC
        `, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      // Calculate trend statistics
      const values = trendData.map(row => row.value);
      const trendStats = this.calculateTrendStatistics(values);

      return {
        type: 'line',
        title: `${this.getMetricLabel(metric)} Trend`,
        metric,
        timeframe,
        granularity,
        data: trendData,
        trend: trendStats,
        config: this.getChartConfig('trend', metric)
      };
    } catch (error) {
      logger.error('Trend chart generation error:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */

  processRatingData(data, options = {}) {
    if (!data || data.length === 0) return [];

    const { smoothing = true } = options;
    let processed = data.map((item, index) => ({
      date: item.date,
      rating: item.rating,
      opponentRating: item.opponent_rating,
      result: item.game_result,
      gameNumber: index + 1,
      eco: item.eco,
      opening: item.opening,
      tournament: item.tournament_name
    }));

    if (smoothing && processed.length > 10) {
      // Apply moving average smoothing
      processed = processed.map((item, index) => {
        const window = 5;
        const start = Math.max(0, index - Math.floor(window / 2));
        const end = Math.min(processed.length, start + window);
        const windowData = processed.slice(start, end);
        
        const smoothedRating = windowData.reduce((sum, d) => sum + d.rating, 0) / windowData.length;
        
        return {
          ...item,
          smoothedRating: Math.round(smoothedRating)
        };
      });
    }

    return processed;
  }

  processHeatmapData(data, timeframe) {
    const heatmapData = [];
    const startDate = new Date();
    const days = { '90d': 90, '1y': 365, '2y': 730 }[timeframe] || 365;
    startDate.setDate(startDate.getDate() - days);

    // Create a map of dates to data
    const dataMap = new Map();
    data.forEach(item => {
      dataMap.set(item.date, item);
    });

    // Generate full date range with data
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayData = dataMap.get(dateStr);
      
      heatmapData.push({
        date: dateStr,
        games: dayData ? dayData.games : 0,
        score: dayData ? Math.round(dayData.avg_score * 100) : null,
        dayOfWeek: d.getDay(),
        weekOfYear: this.getWeekOfYear(d)
      });
    }

    return heatmapData;
  }

  async getPlayerMetrics(playerName, metric, timeframe) {
    // Implementation would depend on specific metric requirements
    // This is a placeholder structure
    return {
      playerName,
      metric,
      value: 0,
      timeframe
    };
  }

  getChartConfig(type, metric) {
    const configs = {
      comparison: {
        chart: { type: 'bar' },
        colors: ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00']
      },
      trend: {
        chart: { type: 'line' },
        colors: ['#2563eb'],
        smooth: true
      }
    };
    return configs[type] || {};
  }

  getMetricLabel(metric) {
    const labels = {
      rating: 'Rating',
      games_played: 'Games Played',
      win_rate: 'Win Rate (%)',
      avg_game_length: 'Average Game Length',
      avg_opponent_rating: 'Average Opponent Rating',
      activity: 'Activity Level',
      avg_rating: 'Average Rating',
      decisive_rate: 'Decisive Game Rate (%)',
      avg_length: 'Average Game Length'
    };
    return labels[metric] || metric;
  }

  calculateDistributionStats(data) {
    const values = data.flatMap(item => Array(item.count).fill(item.bucket + 50)); // Approximate center
    return this.calculateBasicStats(values);
  }

  calculateCorrelations(data, metrics) {
    const correlations = {};
    
    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        const metric1 = metrics[i];
        const metric2 = metrics[j];
        
        const values1 = data.map(item => item[metric1] || 0);
        const values2 = data.map(item => item[metric2] || 0);
        
        correlations[`${metric1}_${metric2}`] = this.pearsonCorrelation(values1, values2);
      }
    }
    
    return correlations;
  }

  calculateTrendStatistics(values) {
    if (values.length < 2) return { slope: 0, direction: 'stable' };
    
    const slope = this.calculateSlope(values);
    const direction = slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable';
    
    return {
      slope: Math.round(slope * 1000) / 1000,
      direction,
      change: values[values.length - 1] - values[0],
      changePercent: ((values[values.length - 1] / values[0] - 1) * 100).toFixed(2)
    };
  }

  calculateBasicStats(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    
    return {
      count: values.length,
      mean: Math.round(mean),
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      q1: sorted[Math.floor(sorted.length * 0.25)],
      q3: sorted[Math.floor(sorted.length * 0.75)]
    };
  }

  pearsonCorrelation(x, y) {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  calculateSlope(values) {
    const n = values.length;
    const sumX = n * (n - 1) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, val, index) => sum + (index * val), 0);
    const sumX2 = n * (n - 1) * (2 * n - 1) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  getWeekOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date - start;
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
  }
}

module.exports = new DataVisualizationService();