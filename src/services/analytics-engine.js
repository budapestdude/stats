/**
 * Advanced Analytics Engine for Chess Stats
 * Provides statistical analysis, ELO predictions, and player metrics
 */

const { getPool } = require('./connection-pool');
const { QueryBuilder } = require('../utils/query-builder');
const logger = require('../utils/logger');

class AnalyticsEngine {
  constructor() {
    this.pool = getPool();
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Calculate ELO rating changes and predictions
   */
  calculateELO(playerRating, opponentRating, result, kFactor = 32) {
    // Expected score calculation
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    
    // Actual score (1 for win, 0.5 for draw, 0 for loss)
    const actualScore = result === '1-0' ? 1 : result === '1/2-1/2' ? 0.5 : 0;
    
    // Rating change
    const ratingChange = Math.round(kFactor * (actualScore - expectedScore));
    const newRating = playerRating + ratingChange;
    
    return {
      expectedScore,
      actualScore,
      ratingChange,
      newRating,
      performance: actualScore - expectedScore,
      winProbability: expectedScore
    };
  }

  /**
   * Predict match outcome based on ELO ratings
   */
  predictMatch(player1Rating, player2Rating) {
    const player1Expected = 1 / (1 + Math.pow(10, (player2Rating - player1Rating) / 400));
    const player2Expected = 1 - player1Expected;
    
    return {
      player1: {
        winProbability: player1Expected,
        drawProbability: 0.2 * (1 - Math.abs(player1Expected - player2Expected)),
        lossProbability: player2Expected
      },
      player2: {
        winProbability: player2Expected,
        drawProbability: 0.2 * (1 - Math.abs(player1Expected - player2Expected)),
        lossProbability: player1Expected
      },
      favoriteMargin: Math.abs(player1Rating - player2Rating),
      expectedScore: {
        player1: player1Expected,
        player2: player2Expected
      }
    };
  }

  /**
   * Calculate advanced player metrics
   */
  async getPlayerMetrics(playerName) {
    const cacheKey = `metrics:${playerName}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const connectionInfo = await this.pool.acquire();
      const connection = connectionInfo.connection;
      
      // Get all games for the player
      const gamesQuery = new QueryBuilder('games')
        .select([
          'white_player', 'black_player', 'result', 'eco', 'opening',
          'date', 'tournament_name', 'ply_count'
        ])
        .where('white_player', '=', playerName)
        .orWhere('black_player', '=', playerName)
        .orderBy('date', 'DESC')
        .limit(1000)
        .build();

      const games = await new Promise((resolve, reject) => {
        connection.all(gamesQuery.sql, gamesQuery.params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      // Calculate metrics
      const metrics = this.calculateDetailedMetrics(games, playerName);
      
      // Cache results
      this.cache.set(cacheKey, {
        data: metrics,
        timestamp: Date.now()
      });

      return metrics;
    } catch (error) {
      logger.error('Error getting player metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate detailed metrics from games
   */
  calculateDetailedMetrics(games, playerName) {
    const stats = {
      totalGames: games.length,
      gamesAsWhite: 0,
      gamesAsBlack: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      winStreak: { current: 0, max: 0 },
      lossStreak: { current: 0, max: 0 },
      averageGameLength: 0,
      openingStats: new Map(),
      performanceByColor: { white: { wins: 0, draws: 0, losses: 0 }, black: { wins: 0, draws: 0, losses: 0 } },
      tournamentPerformance: new Map(),
      timeProgression: [],
      consistency: 0,
      aggression: 0,
      endgameConversion: 0
    };

    let currentStreak = { type: null, count: 0 };
    let totalPlyCount = 0;
    let validPlyGames = 0;

    games.forEach(game => {
      const isWhite = game.white_player === playerName;
      const color = isWhite ? 'white' : 'black';
      
      // Count by color
      if (isWhite) stats.gamesAsWhite++;
      else stats.gamesAsBlack++;

      // Determine result from player's perspective
      let playerResult;
      if (isWhite) {
        playerResult = game.result === '1-0' ? 'win' : game.result === '1/2-1/2' ? 'draw' : 'loss';
      } else {
        playerResult = game.result === '0-1' ? 'win' : game.result === '1/2-1/2' ? 'draw' : 'loss';
      }

      // Update totals
      if (playerResult === 'win') {
        stats.wins++;
        stats.performanceByColor[color].wins++;
        
        // Update streak
        if (currentStreak.type === 'win') {
          currentStreak.count++;
        } else {
          currentStreak = { type: 'win', count: 1 };
        }
        stats.winStreak.current = currentStreak.count;
        stats.winStreak.max = Math.max(stats.winStreak.max, currentStreak.count);
        
      } else if (playerResult === 'draw') {
        stats.draws++;
        stats.performanceByColor[color].draws++;
        currentStreak = { type: 'draw', count: 1 };
        
      } else {
        stats.losses++;
        stats.performanceByColor[color].losses++;
        
        // Update loss streak
        if (currentStreak.type === 'loss') {
          currentStreak.count++;
        } else {
          currentStreak = { type: 'loss', count: 1 };
        }
        stats.lossStreak.current = currentStreak.count;
        stats.lossStreak.max = Math.max(stats.lossStreak.max, currentStreak.count);
      }

      // Opening statistics
      if (game.opening) {
        const opening = game.eco + ' - ' + game.opening;
        if (!stats.openingStats.has(opening)) {
          stats.openingStats.set(opening, { 
            games: 0, wins: 0, draws: 0, losses: 0, 
            asWhite: 0, asBlack: 0 
          });
        }
        const openingData = stats.openingStats.get(opening);
        openingData.games++;
        if (playerResult === 'win') openingData.wins++;
        else if (playerResult === 'draw') openingData.draws++;
        else openingData.losses++;
        if (isWhite) openingData.asWhite++;
        else openingData.asBlack++;
      }

      // Tournament performance
      if (game.tournament_name) {
        if (!stats.tournamentPerformance.has(game.tournament_name)) {
          stats.tournamentPerformance.set(game.tournament_name, {
            games: 0, wins: 0, draws: 0, losses: 0, score: 0
          });
        }
        const tournData = stats.tournamentPerformance.get(game.tournament_name);
        tournData.games++;
        if (playerResult === 'win') {
          tournData.wins++;
          tournData.score += 1;
        } else if (playerResult === 'draw') {
          tournData.draws++;
          tournData.score += 0.5;
        } else {
          tournData.losses++;
        }
      }

      // Game length
      if (game.ply_count && game.ply_count > 0) {
        totalPlyCount += game.ply_count;
        validPlyGames++;
      }
    });

    // Calculate derived metrics
    stats.averageGameLength = validPlyGames > 0 ? Math.round(totalPlyCount / validPlyGames) : 0;
    stats.winRate = stats.totalGames > 0 ? (stats.wins / stats.totalGames * 100).toFixed(1) : 0;
    stats.drawRate = stats.totalGames > 0 ? (stats.draws / stats.totalGames * 100).toFixed(1) : 0;
    stats.lossRate = stats.totalGames > 0 ? (stats.losses / stats.totalGames * 100).toFixed(1) : 0;
    
    // Performance rating calculation (simplified)
    const performanceRating = this.calculatePerformanceRating(stats);
    
    // Aggression index (wins vs draws ratio)
    stats.aggression = stats.wins + stats.draws > 0 
      ? ((stats.wins / (stats.wins + stats.draws)) * 100).toFixed(1)
      : 0;
    
    // Consistency score (based on streak patterns)
    stats.consistency = this.calculateConsistency(stats);
    
    // Convert opening stats to array
    stats.topOpenings = Array.from(stats.openingStats.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        winRate: data.games > 0 ? (data.wins / data.games * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 10);
    
    // Convert tournament performance to array
    stats.tournaments = Array.from(stats.tournamentPerformance.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        performance: data.games > 0 ? (data.score / data.games * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 10);
    
    stats.performanceRating = performanceRating;
    
    return stats;
  }

  /**
   * Calculate performance rating based on results
   */
  calculatePerformanceRating(stats) {
    // Simplified performance rating calculation
    const baseRating = 1500;
    const winBonus = stats.wins * 20;
    const drawBonus = stats.draws * 5;
    const lossePenalty = stats.losses * 10;
    const streakBonus = stats.winStreak.max * 15;
    
    return Math.round(baseRating + winBonus + drawBonus - lossePenalty + streakBonus);
  }

  /**
   * Calculate consistency score
   */
  calculateConsistency(stats) {
    if (stats.totalGames === 0) return 0;
    
    // Lower streak values indicate more consistency
    const streakFactor = 1 - (
      (stats.winStreak.max + stats.lossStreak.max) / 
      (stats.totalGames * 2)
    );
    
    // Higher draw rate can indicate consistency
    const drawFactor = parseFloat(stats.drawRate) / 100;
    
    // Combine factors
    const consistency = (streakFactor * 0.7 + drawFactor * 0.3) * 100;
    
    return Math.max(0, Math.min(100, consistency)).toFixed(1);
  }

  /**
   * Get opening success rates by player
   */
  async getOpeningAnalysis(playerName) {
    const cacheKey = `openings:${playerName}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const connectionInfo = await this.pool.acquire();
      const connection = connectionInfo.connection;
      
      const query = `
        SELECT 
          eco,
          opening,
          COUNT(*) as games_played,
          SUM(CASE 
            WHEN (white_player = ? AND result = '1-0') OR 
                 (black_player = ? AND result = '0-1') 
            THEN 1 ELSE 0 
          END) as wins,
          SUM(CASE 
            WHEN result = '1/2-1/2' 
            THEN 1 ELSE 0 
          END) as draws,
          SUM(CASE 
            WHEN (white_player = ? AND result = '0-1') OR 
                 (black_player = ? AND result = '1-0') 
            THEN 1 ELSE 0 
          END) as losses,
          AVG(ply_count) as avg_length
        FROM games
        WHERE white_player = ? OR black_player = ?
        GROUP BY eco, opening
        HAVING games_played >= 5
        ORDER BY games_played DESC
        LIMIT 50
      `;

      const openings = await new Promise((resolve, reject) => {
        connection.all(query, [
          playerName, playerName, playerName, playerName, playerName, playerName
        ], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      // Calculate success rates and advanced metrics
      const analysis = openings.map(opening => ({
        ...opening,
        winRate: (opening.wins / opening.games_played * 100).toFixed(1),
        drawRate: (opening.draws / opening.games_played * 100).toFixed(1),
        lossRate: (opening.losses / opening.games_played * 100).toFixed(1),
        score: ((opening.wins + opening.draws * 0.5) / opening.games_played * 100).toFixed(1),
        performance: this.calculateOpeningPerformance(opening),
        complexity: this.calculateOpeningComplexity(opening.avg_length),
        recommendation: this.getOpeningRecommendation(opening)
      }));

      const result = {
        openings: analysis,
        bestPerforming: analysis.slice(0, 5),
        mostPlayed: analysis.sort((a, b) => b.games_played - a.games_played).slice(0, 5),
        needsImprovement: analysis.filter(o => parseFloat(o.winRate) < 40).slice(0, 5),
        statistics: this.calculateOpeningStatistics(analysis)
      };

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      logger.error('Error analyzing openings:', error);
      throw error;
    }
  }

  /**
   * Calculate opening performance score
   */
  calculateOpeningPerformance(opening) {
    const winWeight = 3;
    const drawWeight = 1;
    const score = (opening.wins * winWeight + opening.draws * drawWeight) / 
                  (opening.games_played * winWeight);
    return (score * 100).toFixed(1);
  }

  /**
   * Calculate opening complexity based on game length
   */
  calculateOpeningComplexity(avgLength) {
    if (!avgLength) return 'Unknown';
    if (avgLength < 40) return 'Tactical';
    if (avgLength < 60) return 'Balanced';
    return 'Strategic';
  }

  /**
   * Get recommendation for opening
   */
  getOpeningRecommendation(opening) {
    const winRate = parseFloat(opening.wins / opening.games_played * 100);
    const games = opening.games_played;
    
    if (winRate >= 60 && games >= 10) return 'Excellent - Keep playing';
    if (winRate >= 50 && games >= 10) return 'Good - Reliable choice';
    if (winRate >= 40) return 'Average - Room for improvement';
    if (games < 10) return 'More games needed for assessment';
    return 'Consider alternatives or deeper study';
  }

  /**
   * Calculate overall opening statistics
   */
  calculateOpeningStatistics(openings) {
    if (openings.length === 0) return null;
    
    const totalGames = openings.reduce((sum, o) => sum + o.games_played, 0);
    const totalWins = openings.reduce((sum, o) => sum + o.wins, 0);
    const totalDraws = openings.reduce((sum, o) => sum + o.draws, 0);
    const totalLosses = openings.reduce((sum, o) => sum + o.losses, 0);
    
    return {
      uniqueOpenings: openings.length,
      totalGames,
      overallWinRate: (totalWins / totalGames * 100).toFixed(1),
      overallDrawRate: (totalDraws / totalGames * 100).toFixed(1),
      overallLossRate: (totalLosses / totalGames * 100).toFixed(1),
      averageScore: ((totalWins + totalDraws * 0.5) / totalGames * 100).toFixed(1),
      diversity: this.calculateDiversity(openings, totalGames)
    };
  }

  /**
   * Calculate opening diversity (how varied the repertoire is)
   */
  calculateDiversity(openings, totalGames) {
    if (openings.length === 0) return 0;
    
    // Calculate entropy-based diversity
    let entropy = 0;
    openings.forEach(opening => {
      const probability = opening.games_played / totalGames;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    });
    
    // Normalize to 0-100 scale
    const maxEntropy = Math.log2(openings.length);
    const diversity = maxEntropy > 0 ? (entropy / maxEntropy * 100) : 0;
    
    return diversity.toFixed(1);
  }

  /**
   * Get player style classification
   */
  async classifyPlayerStyle(playerName) {
    try {
      const metrics = await this.getPlayerMetrics(playerName);
      const openingAnalysis = await this.getOpeningAnalysis(playerName);
      
      const style = {
        type: '',
        characteristics: [],
        strengths: [],
        weaknesses: [],
        recommendations: [],
        scores: {}
      };

      // Calculate style scores
      const aggression = parseFloat(metrics.aggression);
      const consistency = parseFloat(metrics.consistency);
      const diversity = parseFloat(openingAnalysis.statistics?.diversity || 0);
      const winRate = parseFloat(metrics.winRate);
      const drawRate = parseFloat(metrics.drawRate);
      const avgGameLength = metrics.averageGameLength;

      style.scores = {
        aggression,
        consistency,
        diversity,
        tactical: avgGameLength < 50 ? 80 : avgGameLength < 70 ? 50 : 20,
        positional: avgGameLength > 70 ? 80 : avgGameLength > 50 ? 50 : 20,
        solid: drawRate > 35 ? 80 : drawRate > 25 ? 50 : 20,
        dynamic: aggression > 70 ? 80 : aggression > 50 ? 50 : 20
      };

      // Determine primary style
      if (aggression > 70 && winRate > 50) {
        style.type = 'Aggressive Attacker';
        style.characteristics = ['High win rate', 'Few draws', 'Direct play', 'Tactical orientation'];
        style.strengths = ['Creating winning chances', 'Tactical combinations', 'Time pressure'];
        style.weaknesses = ['Risk of overextension', 'Positional subtleties'];
      } else if (consistency > 70 && drawRate > 35) {
        style.type = 'Solid Defender';
        style.characteristics = ['Consistent results', 'Many draws', 'Risk-averse', 'Strong defense'];
        style.strengths = ['Difficult to beat', 'Endgame technique', 'Positional understanding'];
        style.weaknesses = ['Creating winning chances', 'Dynamic positions'];
      } else if (diversity > 70) {
        style.type = 'Universal Player';
        style.characteristics = ['Varied repertoire', 'Adaptable', 'Well-rounded', 'Unpredictable'];
        style.strengths = ['Flexibility', 'Preparation advantage', 'All position types'];
        style.weaknesses = ['May lack specialization', 'Depth in specific lines'];
      } else if (avgGameLength > 70 && style.scores.positional > 60) {
        style.type = 'Strategic Player';
        style.characteristics = ['Long games', 'Positional play', 'Patient approach', 'Endgame focus'];
        style.strengths = ['Long-term planning', 'Endgames', 'Positional advantages'];
        style.weaknesses = ['Sharp tactical positions', 'Time scrambles'];
      } else {
        style.type = 'Balanced Player';
        style.characteristics = ['Mixed approach', 'Flexible style', 'Situation-dependent'];
        style.strengths = ['Adaptability', 'No clear weaknesses'];
        style.weaknesses = ['May lack distinctive strengths'];
      }

      // Generate recommendations
      if (aggression < 50) {
        style.recommendations.push('Consider more aggressive openings to create winning chances');
      }
      if (consistency < 50) {
        style.recommendations.push('Work on consistency to reduce variance in results');
      }
      if (diversity < 30) {
        style.recommendations.push('Expand opening repertoire for unpredictability');
      }
      if (winRate < 45) {
        style.recommendations.push('Focus on converting advantages and tactical training');
      }
      if (drawRate > 40) {
        style.recommendations.push('Practice creating imbalances and winning techniques');
      }

      return style;
    } catch (error) {
      logger.error('Error classifying player style:', error);
      throw error;
    }
  }

  /**
   * Generate rating progression timeline
   */
  async getRatingProgression(playerName, period = 'year') {
    try {
      const connectionInfo = await this.pool.acquire();
      const connection = connectionInfo.connection;
      
      // Get games with dates for timeline
      const query = `
        SELECT 
          date,
          result,
          white_player,
          black_player,
          tournament_name
        FROM games
        WHERE (white_player = ? OR black_player = ?)
          AND date IS NOT NULL
          AND date != ''
        ORDER BY date ASC
        LIMIT 1000
      `;

      const games = await new Promise((resolve, reject) => {
        connection.all(query, [playerName, playerName], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      // Simulate rating progression
      let currentRating = 1500;
      const progression = [];
      const monthlyData = new Map();

      games.forEach(game => {
        const isWhite = game.white_player === playerName;
        const result = isWhite ? game.result : 
                       game.result === '1-0' ? '0-1' : 
                       game.result === '0-1' ? '1-0' : '1/2-1/2';
        
        // Simulate opponent rating (random between 1400-1600 for demo)
        const opponentRating = 1400 + Math.random() * 200;
        
        const eloChange = this.calculateELO(currentRating, opponentRating, result);
        currentRating = eloChange.newRating;
        
        // Group by month
        const date = new Date(game.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, {
            date: monthKey,
            games: 0,
            rating: currentRating,
            wins: 0,
            draws: 0,
            losses: 0,
            tournaments: new Set()
          });
        }
        
        const monthData = monthlyData.get(monthKey);
        monthData.games++;
        monthData.rating = currentRating; // Last rating of the month
        
        if (result === '1-0' || result === '0-1' && !isWhite) monthData.wins++;
        else if (result === '1/2-1/2') monthData.draws++;
        else monthData.losses++;
        
        if (game.tournament_name) {
          monthData.tournaments.add(game.tournament_name);
        }
      });

      // Convert to array and add statistics
      const timeline = Array.from(monthlyData.values()).map(month => ({
        ...month,
        winRate: month.games > 0 ? (month.wins / month.games * 100).toFixed(1) : 0,
        performance: ((month.wins + month.draws * 0.5) / month.games * 100).toFixed(1),
        tournaments: month.tournaments.size
      }));

      // Calculate trend
      const trend = this.calculateTrend(timeline);

      return {
        timeline,
        currentRating: Math.round(currentRating),
        peakRating: Math.max(...timeline.map(t => t.rating)),
        lowestRating: Math.min(...timeline.map(t => t.rating)),
        trend,
        volatility: this.calculateVolatility(timeline),
        improvement: timeline.length > 0 ? 
          Math.round(currentRating - timeline[0].rating) : 0
      };
    } catch (error) {
      logger.error('Error getting rating progression:', error);
      throw error;
    }
  }

  /**
   * Calculate rating trend
   */
  calculateTrend(timeline) {
    if (timeline.length < 2) return 'insufficient_data';
    
    const recentMonths = timeline.slice(-6);
    if (recentMonths.length < 2) return 'insufficient_data';
    
    const startRating = recentMonths[0].rating;
    const endRating = recentMonths[recentMonths.length - 1].rating;
    const change = endRating - startRating;
    
    if (change > 50) return 'strong_upward';
    if (change > 20) return 'upward';
    if (change > -20) return 'stable';
    if (change > -50) return 'downward';
    return 'strong_downward';
  }

  /**
   * Calculate rating volatility
   */
  calculateVolatility(timeline) {
    if (timeline.length < 2) return 0;
    
    const ratings = timeline.map(t => t.rating);
    const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const variance = ratings.reduce((sum, rating) => {
      return sum + Math.pow(rating - mean, 2);
    }, 0) / ratings.length;
    
    return Math.round(Math.sqrt(variance));
  }

  /**
   * Get tournament performance analytics
   */
  async getTournamentAnalytics(tournamentName) {
    try {
      const connectionInfo = await this.pool.acquire();
      const connection = connectionInfo.connection;
      
      // Get all games from the tournament
      const query = `
        SELECT 
          white_player,
          black_player,
          result,
          round,
          date,
          eco,
          opening,
          ply_count
        FROM games
        WHERE tournament_name = ?
        ORDER BY date, round
      `;

      const games = await new Promise((resolve, reject) => {
        connection.all(query, [tournamentName], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      await this.pool.release(connectionInfo);

      // Calculate tournament statistics
      const playerStats = new Map();
      const roundStats = new Map();
      const openingStats = new Map();

      games.forEach(game => {
        // Update player statistics
        [game.white_player, game.black_player].forEach((player, idx) => {
          if (!player) return;
          
          if (!playerStats.has(player)) {
            playerStats.set(player, {
              games: 0, wins: 0, draws: 0, losses: 0, 
              score: 0, performance: 0
            });
          }
          
          const stats = playerStats.get(player);
          stats.games++;
          
          const isWhite = idx === 0;
          if (game.result === '1-0' && isWhite || game.result === '0-1' && !isWhite) {
            stats.wins++;
            stats.score += 1;
          } else if (game.result === '1/2-1/2') {
            stats.draws++;
            stats.score += 0.5;
          } else {
            stats.losses++;
          }
        });

        // Round statistics
        if (game.round) {
          if (!roundStats.has(game.round)) {
            roundStats.set(game.round, {
              games: 0, decisive: 0, draws: 0, avgLength: 0, totalLength: 0
            });
          }
          
          const round = roundStats.get(game.round);
          round.games++;
          if (game.result !== '1/2-1/2') round.decisive++;
          else round.draws++;
          if (game.ply_count) {
            round.totalLength += game.ply_count;
            round.avgLength = round.totalLength / round.games;
          }
        }

        // Opening statistics
        if (game.opening) {
          const key = `${game.eco} - ${game.opening}`;
          if (!openingStats.has(key)) {
            openingStats.set(key, { games: 0, white: 0, draws: 0, black: 0 });
          }
          
          const opening = openingStats.get(key);
          opening.games++;
          if (game.result === '1-0') opening.white++;
          else if (game.result === '1/2-1/2') opening.draws++;
          else opening.black++;
        }
      });

      // Calculate standings
      const standings = Array.from(playerStats.entries())
        .map(([name, stats]) => ({
          player: name,
          ...stats,
          percentage: stats.games > 0 ? (stats.score / stats.games * 100).toFixed(1) : 0
        }))
        .sort((a, b) => b.score - a.score);

      // Top performers
      const topPerformers = {
        winner: standings[0],
        topScorers: standings.slice(0, 5),
        mostWins: [...standings].sort((a, b) => b.wins - a.wins).slice(0, 3),
        undefeated: standings.filter(p => p.losses === 0 && p.games >= 3)
      };

      // Round analysis
      const rounds = Array.from(roundStats.entries())
        .map(([round, stats]) => ({
          round,
          ...stats,
          decisiveRate: stats.games > 0 ? (stats.decisive / stats.games * 100).toFixed(1) : 0
        }))
        .sort((a, b) => parseInt(a.round) - parseInt(b.round));

      // Opening trends
      const openings = Array.from(openingStats.entries())
        .map(([name, stats]) => ({
          name,
          ...stats,
          whiteScore: stats.games > 0 ? 
            ((stats.white + stats.draws * 0.5) / stats.games * 100).toFixed(1) : 0
        }))
        .sort((a, b) => b.games - a.games)
        .slice(0, 10);

      return {
        overview: {
          totalGames: games.length,
          totalPlayers: playerStats.size,
          totalRounds: roundStats.size,
          decisiveGames: games.filter(g => g.result !== '1/2-1/2').length,
          drawRate: (games.filter(g => g.result === '1/2-1/2').length / games.length * 100).toFixed(1),
          averageGameLength: games.reduce((sum, g) => sum + (g.ply_count || 0), 0) / 
                            games.filter(g => g.ply_count).length || 0
        },
        standings,
        topPerformers,
        rounds,
        openings,
        statistics: {
          mostPopularOpening: openings[0],
          longestGame: Math.max(...games.map(g => g.ply_count || 0)),
          shortestGame: Math.min(...games.filter(g => g.ply_count).map(g => g.ply_count)),
          upsets: this.findUpsets(standings, games)
        }
      };
    } catch (error) {
      logger.error('Error analyzing tournament:', error);
      throw error;
    }
  }

  /**
   * Find tournament upsets (lower-rated players beating higher-rated)
   */
  findUpsets(standings, games) {
    // Create a simple rating estimation based on final standings
    const ratingMap = new Map();
    standings.forEach((player, idx) => {
      ratingMap.set(player.player, 2000 - idx * 20);
    });

    const upsets = [];
    games.forEach(game => {
      if (game.result === '1/2-1/2') return;
      
      const whiteRating = ratingMap.get(game.white_player) || 1500;
      const blackRating = ratingMap.get(game.black_player) || 1500;
      
      if (game.result === '1-0' && blackRating > whiteRating + 100) {
        upsets.push({
          winner: game.white_player,
          loser: game.black_player,
          ratingDiff: Math.round(blackRating - whiteRating)
        });
      } else if (game.result === '0-1' && whiteRating > blackRating + 100) {
        upsets.push({
          winner: game.black_player,
          loser: game.white_player,
          ratingDiff: Math.round(whiteRating - blackRating)
        });
      }
    });

    return upsets.sort((a, b) => b.ratingDiff - a.ratingDiff).slice(0, 5);
  }
}

module.exports = new AnalyticsEngine();