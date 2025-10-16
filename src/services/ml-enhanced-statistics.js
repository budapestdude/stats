const AdvancedRatingPredictor = require('../ml/rating-predictor');
const PlayingStyleClassifier = require('../ml/style-classifier');
const MatchOutcomePredictor = require('../ml/outcome-predictor');
const StatisticalPatternAnalyzer = require('../ml/pattern-analyzer');
const mlUtils = require('../ml/ml-utils');
const logger = require('../utils/logger');

/**
 * ML-Enhanced Statistics Service
 * 
 * Integrates machine learning models with traditional statistics to provide
 * advanced analytics and predictions for chess data.
 */
class MLEnhancedStatisticsService {
  constructor() {
    // Initialize ML models
    this.ratingPredictor = new AdvancedRatingPredictor();
    this.styleClassifier = new PlayingStyleClassifier();
    this.outcomePredictor = new MatchOutcomePredictor();
    this.patternAnalyzer = new StatisticalPatternAnalyzer();
    
    // Cache for expensive ML computations
    this.cache = new Map();
    this.cacheTimeout = 1800000; // 30 minutes
    
    // Service configuration
    this.config = {
      maxConcurrentPredictions: 5,
      defaultConfidenceThreshold: 0.6,
      enablePatternCaching: true,
      performanceMonitoring: true
    };

    // Performance tracking
    this.metrics = {
      predictionsGenerated: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageProcessingTime: 0,
      errorRate: 0
    };
  }

  /**
   * Comprehensive player intelligence analysis
   * @param {string} playerName - Player identifier
   * @param {Object} options - Analysis options
   * @returns {Object} Complete ML-powered player analysis
   */
  async generatePlayerIntelligence(playerName, options = {}) {
    const startTime = Date.now();
    
    try {
      const {
        includeRatingPrediction = true,
        includeStyleAnalysis = true,
        includePatternAnalysis = true,
        includeCompetitiveIntelligence = true,
        timeframe = 'recent',
        confidenceThreshold = this.config.defaultConfidenceThreshold
      } = options;

      // Check cache first
      const cacheKey = this.generateCacheKey('player_intelligence', playerName, options);
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }

      // Gather player data
      const playerData = await this.gatherPlayerData(playerName, timeframe);
      if (!playerData || !this.validatePlayerDataQuality(playerData)) {
        throw new Error(`Insufficient data quality for player: ${playerName}`);
      }

      // Generate ML analyses in parallel
      const analyses = await Promise.allSettled([
        includeRatingPrediction ? this.generateRatingIntelligence(playerData) : null,
        includeStyleAnalysis ? this.generateStyleIntelligence(playerData) : null,
        includePatternAnalysis ? this.generatePatternIntelligence(playerData) : null,
        includeCompetitiveIntelligence ? this.generateCompetitiveIntelligence(playerData) : null
      ]);

      // Process results and handle failures gracefully
      const results = this.processAnalysisResults(analyses, [
        'ratingIntelligence',
        'styleIntelligence', 
        'patternIntelligence',
        'competitiveIntelligence'
      ]);

      // Generate comprehensive insights
      const insights = this.generateComprehensiveInsights(results, playerData);

      // Calculate overall intelligence score
      const intelligenceScore = this.calculateIntelligenceScore(results);

      // Compile final intelligence report
      const intelligence = {
        player: playerName,
        generatedAt: new Date().toISOString(),
        timeframe,
        dataQuality: this.assessDataQuality(playerData),
        
        // Core ML analyses
        ...results,
        
        // Meta-analysis
        insights,
        intelligenceScore,
        
        // Confidence and reliability
        overallConfidence: this.calculateOverallConfidence(results),
        reliability: this.calculateReliabilityScore(playerData, results),
        
        // Recommendations
        recommendations: this.generateActionableRecommendations(results, insights),
        
        // Performance metrics
        processingTime: Date.now() - startTime,
        modelsUsed: Object.keys(results).filter(key => results[key] !== null)
      };

      // Cache results
      this.cacheResult(cacheKey, intelligence);
      this.metrics.cacheMisses++;
      this.updatePerformanceMetrics(startTime);

      return intelligence;
    } catch (error) {
      this.metrics.errorRate++;
      logger.error('Player intelligence generation error:', error);
      throw error;
    }
  }

  /**
   * Advanced match prediction with ML models
   */
  async predictMatchWithML(player1Name, player2Name, matchContext = {}) {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.generateCacheKey('match_prediction', 
        `${player1Name}_vs_${player2Name}`, matchContext);
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }

      // Gather data for both players
      const [player1Data, player2Data] = await Promise.all([
        this.gatherPlayerData(player1Name, 'recent'),
        this.gatherPlayerData(player2Name, 'recent')
      ]);

      // Validate data quality
      if (!this.validatePlayerDataQuality(player1Data) || 
          !this.validatePlayerDataQuality(player2Data)) {
        throw new Error('Insufficient data quality for match prediction');
      }

      // Enhance player data with ML insights
      const [enhancedPlayer1, enhancedPlayer2] = await Promise.all([
        this.enhancePlayerDataForPrediction(player1Data),
        this.enhancePlayerDataForPrediction(player2Data)
      ]);

      // Generate match prediction using ML models
      const prediction = await this.outcomePredictor.predictMatchOutcome(
        enhancedPlayer1,
        enhancedPlayer2,
        matchContext
      );

      // Enhance prediction with additional ML insights
      const enhancedPrediction = await this.enhanceMatchPrediction(
        prediction, 
        enhancedPlayer1, 
        enhancedPlayer2,
        matchContext
      );

      // Cache and return results
      this.cacheResult(cacheKey, enhancedPrediction);
      this.metrics.cacheMisses++;
      this.updatePerformanceMetrics(startTime);

      return enhancedPrediction;
    } catch (error) {
      this.metrics.errorRate++;
      logger.error('ML match prediction error:', error);
      throw error;
    }
  }

  /**
   * Pattern-based performance optimization suggestions
   */
  async generateOptimizationRecommendations(playerName, options = {}) {
    try {
      const {
        focusAreas = 'all', // 'openings', 'tactics', 'endgame', 'psychology', 'all'
        improvementTimeframe = '6months',
        includeTrainingPlan = true
      } = options;

      // Gather comprehensive player data
      const playerData = await this.gatherPlayerData(playerName, 'comprehensive');
      
      // Analyze patterns for optimization opportunities
      const patternAnalysis = await this.patternAnalyzer.analyzePatterns(
        playerData.games, 
        { 
          patternTypes: this.getOptimizationPatternTypes(focusAreas),
          includeVisualizations: false
        }
      );

      // Generate style-based recommendations
      const styleAnalysis = await this.styleClassifier.classifyPlayerStyle(playerData);
      
      // Identify improvement areas using ML
      const improvementAreas = this.identifyImprovementAreas(
        patternAnalysis, 
        styleAnalysis, 
        playerData
      );

      // Generate optimization strategy
      const optimizationStrategy = this.createOptimizationStrategy(
        improvementAreas,
        styleAnalysis,
        improvementTimeframe
      );

      // Create training plan if requested
      const trainingPlan = includeTrainingPlan ? 
        this.generateTrainingPlan(optimizationStrategy, playerData) : null;

      return {
        player: playerName,
        generatedAt: new Date().toISOString(),
        improvementAreas,
        optimizationStrategy,
        trainingPlan,
        expectedImprovement: this.calculateExpectedImprovement(optimizationStrategy),
        timeframe: improvementTimeframe,
        confidence: this.calculateOptimizationConfidence(patternAnalysis, styleAnalysis)
      };
    } catch (error) {
      logger.error('Optimization recommendations error:', error);
      throw error;
    }
  }

  /**
   * Tournament performance prediction and preparation
   */
  async generateTournamentPreparation(playerName, tournamentInfo, options = {}) {
    try {
      const {
        includeOpponentAnalysis = true,
        includeOpeningPreparation = true,
        includePsychologicalPreparation = true
      } = options;

      // Gather player data and tournament context
      const playerData = await this.gatherPlayerData(playerName, 'tournament_focused');
      const tournamentData = await this.gatherTournamentData(tournamentInfo);

      // Predict tournament performance
      const performancePrediction = await this.predictTournamentPerformance(
        playerData, 
        tournamentData
      );

      // Generate opponent-specific strategies
      const opponentStrategies = includeOpponentAnalysis ? 
        await this.generateOpponentStrategies(playerData, tournamentData.expectedOpponents) : 
        null;

      // Create opening preparation recommendations
      const openingPrep = includeOpeningPreparation ?
        await this.generateOpeningPreparation(playerData, tournamentData) : null;

      // Psychological preparation insights
      const psychPrep = includePsychologicalPreparation ?
        this.generatePsychologicalPreparation(playerData, tournamentData) : null;

      return {
        player: playerName,
        tournament: tournamentInfo.name,
        generatedAt: new Date().toISOString(),
        performancePrediction,
        opponentStrategies,
        openingPreparation: openingPrep,
        psychologicalPreparation: psychPrep,
        overallReadiness: this.calculateTournamentReadiness(
          performancePrediction, opponentStrategies, openingPrep, psychPrep
        )
      };
    } catch (error) {
      logger.error('Tournament preparation error:', error);
      throw error;
    }
  }

  // Core ML analysis methods
  async generateRatingIntelligence(playerData) {
    try {
      const prediction = await this.ratingPredictor.predictRating(playerData, {
        horizon: 30,
        includeOpponentStrength: true,
        includeRecentForm: true,
        includeSeasonality: false
      });

      return {
        currentRating: playerData.currentRating,
        prediction,
        volatility: this.calculateRatingVolatility(playerData.ratingHistory),
        trajectory: this.analyzeRatingTrajectory(playerData.ratingHistory),
        stabilityScore: this.calculateRatingStability(playerData.ratingHistory)
      };
    } catch (error) {
      logger.error('Rating intelligence generation error:', error);
      return null;
    }
  }

  async generateStyleIntelligence(playerData) {
    try {
      const styleClassification = await this.styleClassifier.classifyPlayerStyle(playerData, {
        includeEvolution: true,
        timeframe: 'recent',
        minConfidence: 0.5
      });

      return {
        classification: styleClassification,
        strengthsWeaknesses: this.analyzeStyleStrengthsWeaknesses(styleClassification),
        adaptability: this.calculateStyleAdaptability(styleClassification),
        consistency: this.calculateStyleConsistency(styleClassification)
      };
    } catch (error) {
      logger.error('Style intelligence generation error:', error);
      return null;
    }
  }

  async generatePatternIntelligence(playerData) {
    try {
      const patternAnalysis = await this.patternAnalyzer.analyzePatterns(playerData.games, {
        patternTypes: ['opening_sequences', 'tactical_motifs', 'result_patterns'],
        minSupport: 0.05,
        includeVisualizations: false
      });

      return {
        analysis: patternAnalysis,
        keyPatterns: this.extractKeyPatterns(patternAnalysis),
        patternReliability: this.assessPatternReliability(patternAnalysis),
        exploitablePatterns: this.identifyExploitablePatterns(patternAnalysis)
      };
    } catch (error) {
      logger.error('Pattern intelligence generation error:', error);
      return null;
    }
  }

  async generateCompetitiveIntelligence(playerData) {
    try {
      // Analyze competitive factors
      const competitiveFactors = {
        clutchPerformance: this.analyzeClutchPerformance(playerData),
        pressureHandling: this.analyzePressureHandling(playerData),
        adaptationSpeed: this.calculateAdaptationSpeed(playerData),
        consistencyUnderPressure: this.analyzeConsistencyUnderPressure(playerData)
      };

      return {
        factors: competitiveFactors,
        competitiveRating: this.calculateCompetitiveRating(competitiveFactors),
        mentalToughness: this.assessMentalToughness(competitiveFactors),
        tournamentSuitability: this.assessTournamentSuitability(competitiveFactors)
      };
    } catch (error) {
      logger.error('Competitive intelligence generation error:', error);
      return null;
    }
  }

  // Data gathering and validation methods
  async gatherPlayerData(playerName, scope = 'recent') {
    // This would integrate with the existing database and services
    // Placeholder implementation
    return {
      name: playerName,
      currentRating: 2200,
      games: [], // Would be populated from database
      ratingHistory: [], // Would be populated from database
      recentGames: [], // Last 50 games
      playingStyle: null, // Existing style data if available
      tournaments: [], // Tournament participation
      opponents: [] // Recent opponents
    };
  }

  validatePlayerDataQuality(playerData) {
    const requirements = {
      minGames: 20,
      minRatingHistory: 10,
      dataRecency: 90 // days
    };

    return playerData &&
           playerData.games && 
           playerData.games.length >= requirements.minGames &&
           playerData.ratingHistory &&
           playerData.ratingHistory.length >= requirements.minRatingHistory;
  }

  // Enhancement and processing methods
  async enhancePlayerDataForPrediction(playerData) {
    // Add ML-derived features to player data
    const enhanced = { ...playerData };

    // Add style classification if not present
    if (!enhanced.playingStyle) {
      enhanced.playingStyle = await this.styleClassifier.classifyPlayerStyle(playerData);
    }

    // Add pattern analysis features
    enhanced.patterns = await this.patternAnalyzer.analyzePatterns(playerData.games, {
      patternTypes: ['result_patterns', 'opponent_patterns'],
      minSupport: 0.1
    });

    // Add ML-derived performance metrics
    enhanced.mlMetrics = {
      consistency: this.calculateMLConsistency(playerData),
      adaptability: this.calculateMLAdaptability(playerData),
      pressure: this.calculatePressureScore(playerData)
    };

    return enhanced;
  }

  async enhanceMatchPrediction(basePrediction, player1Data, player2Data, matchContext) {
    // Add ML-specific enhancements to the base prediction
    const enhanced = { ...basePrediction };

    // Add style matchup analysis
    enhanced.styleMatchup = this.analyzeDetailedStyleMatchup(
      player1Data.playingStyle, 
      player2Data.playingStyle
    );

    // Add pattern-based insights
    enhanced.patternInsights = this.generatePatternBasedInsights(
      player1Data.patterns,
      player2Data.patterns
    );

    // Add confidence intervals
    enhanced.confidenceIntervals = this.calculatePredictionConfidenceIntervals(
      basePrediction
    );

    // Add scenario analysis
    enhanced.scenarios = this.generateMatchScenarios(player1Data, player2Data, matchContext);

    return enhanced;
  }

  // Analysis and insight generation methods
  generateComprehensiveInsights(results, playerData) {
    const insights = [];

    // Rating insights
    if (results.ratingIntelligence) {
      insights.push(...this.generateRatingInsights(results.ratingIntelligence));
    }

    // Style insights
    if (results.styleIntelligence) {
      insights.push(...this.generateStyleInsights(results.styleIntelligence));
    }

    // Pattern insights
    if (results.patternIntelligence) {
      insights.push(...this.generatePatternInsights(results.patternIntelligence));
    }

    // Cross-model insights
    insights.push(...this.generateCrossModelInsights(results));

    return insights.sort((a, b) => b.importance - a.importance).slice(0, 10);
  }

  generateActionableRecommendations(results, insights) {
    const recommendations = [];

    // Generate recommendations based on insights
    insights.forEach(insight => {
      const recommendation = this.insightToRecommendation(insight);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    });

    // Add ML-specific recommendations
    recommendations.push(...this.generateMLSpecificRecommendations(results));

    return recommendations
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 8);
  }

  // Utility and helper methods
  generateCacheKey(operation, identifier, options = {}) {
    const optionsStr = JSON.stringify(options);
    return `${operation}:${identifier}:${Buffer.from(optionsStr).toString('base64')}`;
  }

  getCachedResult(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  cacheResult(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Clean old cache entries periodically
    if (this.cache.size > 1000) {
      this.cleanCache();
    }
  }

  cleanCache() {
    const now = Date.now();
    const keysToDelete = [];

    this.cache.forEach((value, key) => {
      if (now - value.timestamp > this.cacheTimeout) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  processAnalysisResults(analyses, labels) {
    const results = {};
    
    analyses.forEach((result, index) => {
      const label = labels[index];
      if (result.status === 'fulfilled') {
        results[label] = result.value;
      } else {
        logger.error(`Analysis ${label} failed:`, result.reason);
        results[label] = null;
      }
    });

    return results;
  }

  calculateIntelligenceScore(results) {
    const scores = [];
    
    if (results.ratingIntelligence) {
      scores.push(results.ratingIntelligence.prediction.confidence / 100);
    }
    
    if (results.styleIntelligence) {
      scores.push(results.styleIntelligence.classification.confidence / 100);
    }
    
    if (results.patternIntelligence) {
      scores.push(results.patternIntelligence.patternReliability || 0.5);
    }

    if (results.competitiveIntelligence) {
      scores.push(results.competitiveIntelligence.competitiveRating / 100);
    }

    return scores.length > 0 ? 
      Math.round(mlUtils.mean(scores) * 100) : 50;
  }

  updatePerformanceMetrics(startTime) {
    this.metrics.predictionsGenerated++;
    const processingTime = Date.now() - startTime;
    
    // Update running average
    const totalPredictions = this.metrics.predictionsGenerated;
    this.metrics.averageProcessingTime = 
      ((this.metrics.averageProcessingTime * (totalPredictions - 1)) + processingTime) / 
      totalPredictions;
  }

  // Placeholder methods for complex analyses
  calculateRatingVolatility(ratingHistory) { return 45; }
  analyzeRatingTrajectory(ratingHistory) { return { trend: 'stable', slope: 0.5 }; }
  calculateRatingStability(ratingHistory) { return 0.75; }
  analyzeStyleStrengthsWeaknesses(classification) { return { strengths: [], weaknesses: [] }; }
  calculateStyleAdaptability(classification) { return 0.7; }
  calculateStyleConsistency(classification) { return 0.8; }
  extractKeyPatterns(analysis) { return analysis.significantPatterns?.slice(0, 5) || []; }
  assessPatternReliability(analysis) { return 0.65; }
  identifyExploitablePatterns(analysis) { return []; }
  analyzeClutchPerformance(playerData) { return 0.7; }
  analyzePressureHandling(playerData) { return 0.6; }
  calculateAdaptationSpeed(playerData) { return 0.8; }
  analyzeConsistencyUnderPressure(playerData) { return 0.7; }
  calculateCompetitiveRating(factors) { return 75; }
  assessMentalToughness(factors) { return 0.8; }
  assessTournamentSuitability(factors) { return 0.75; }
  assessDataQuality(playerData) { return { score: 85, factors: ['sufficient_games', 'recent_data'] }; }
  calculateOverallConfidence(results) { return 78; }
  calculateReliabilityScore(playerData, results) { return 82; }
}

module.exports = MLEnhancedStatisticsService;