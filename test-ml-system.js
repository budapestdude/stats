const axios = require('axios');
const AdvancedRatingPredictor = require('./src/ml/rating-predictor');
const PlayingStyleClassifier = require('./src/ml/style-classifier');
const MatchOutcomePredictor = require('./src/ml/outcome-predictor');
const StatisticalPatternAnalyzer = require('./src/ml/pattern-analyzer');
const MLEnhancedStatisticsService = require('./src/services/ml-enhanced-statistics');
const mlUtils = require('./src/ml/ml-utils');

// Test configuration
const BASE_URL = 'http://localhost:3010';
const TEST_PLAYERS = ['Carlsen, Magnus', 'Caruana, Fabiano', 'Nepomniachtchi, Ian'];

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class MLSystemTestSuite {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
    this.startTime = Date.now();

    // Initialize ML components for unit testing
    this.ratingPredictor = new AdvancedRatingPredictor();
    this.styleClassifier = new PlayingStyleClassifier();
    this.outcomePredictor = new MatchOutcomePredictor();
    this.patternAnalyzer = new StatisticalPatternAnalyzer();
    this.mlStats = new MLEnhancedStatisticsService();
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async test(name, testFn) {
    this.results.total++;
    const startTime = Date.now();
    
    try {
      this.log(`\n🧪 Testing: ${name}`, 'cyan');
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      if (result.success !== false) {
        this.results.passed++;
        this.log(`✅ PASS: ${name} (${duration}ms)`, 'green');
        
        if (result.details) {
          this.log(`   ${result.details}`, 'blue');
        }
      } else {
        throw new Error(result.error || 'Test returned success: false');
      }

      this.results.details.push({
        name,
        status: 'passed',
        duration,
        details: result.details
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.failed++;
      this.log(`❌ FAIL: ${name} (${duration}ms)`, 'red');
      this.log(`   Error: ${error.message}`, 'red');

      this.results.details.push({
        name,
        status: 'failed',
        duration,
        error: error.message
      });
    }
  }

  async makeRequest(endpoint, options = {}) {
    try {
      const response = await axios({
        method: options.method || 'GET',
        url: `${BASE_URL}${endpoint}`,
        data: options.data,
        timeout: 60000, // ML operations can take longer
        ...options
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${error.response.data?.error || 'Request failed'}`);
      }
      throw error;
    }
  }

  // Unit Tests for ML Models
  async testRatingPredictorUnit() {
    const mockPlayerData = {
      name: 'Test Player',
      currentRating: 2200,
      ratingHistory: [2150, 2160, 2170, 2180, 2190, 2200, 2195, 2205, 2210, 2200],
      games: Array(30).fill().map((_, i) => ({
        result: i % 3 === 0 ? 'win' : i % 3 === 1 ? 'draw' : 'loss',
        opponent: 'Opponent',
        opponentRating: 2180 + (Math.random() * 40 - 20),
        date: `2024-01-${String(i + 1).padStart(2, '0')}`
      })),
      recentGames: Array(20).fill().map((_, i) => ({
        result: i % 3 === 0 ? 'win' : 'draw',
        date: `2024-02-${String(i + 1).padStart(2, '0')}`
      }))
    };

    const prediction = await this.ratingPredictor.predictRating(mockPlayerData, {
      horizon: 20,
      includeOpponentStrength: true,
      includeRecentForm: true
    });

    if (!prediction || typeof prediction.predictedRating !== 'number') {
      throw new Error('Invalid prediction result');
    }

    if (prediction.confidence < 10 || prediction.confidence > 100) {
      throw new Error(`Invalid confidence range: ${prediction.confidence}`);
    }

    return {
      success: true,
      details: `Predicted rating: ${prediction.predictedRating}, Confidence: ${prediction.confidence}%`
    };
  }

  async testStyleClassifierUnit() {
    const mockPlayerData = {
      name: 'Test Player',
      games: Array(50).fill().map((_, i) => ({
        eco: i % 5 === 0 ? 'B10' : 'E20',
        opening: i % 5 === 0 ? 'Caro-Kann' : 'King\'s Indian',
        result: i % 3 === 0 ? 'win' : 'draw',
        ply_count: 40 + (i % 40),
        moves: ['e4', 'e5', 'Nf3'], // Simplified
        player_rating: 2200,
        opponent_rating: 2180
      })),
      currentRating: 2200
    };

    const classification = await this.styleClassifier.classifyPlayerStyle(mockPlayerData, {
      includeEvolution: false,
      timeframe: 'all'
    });

    if (!classification || !classification.primaryStyle) {
      throw new Error('Invalid classification result');
    }

    if (!['tactical', 'positional', 'aggressive', 'defensive', 'endgame'].includes(classification.primaryStyle.style)) {
      throw new Error(`Unknown style: ${classification.primaryStyle.style}`);
    }

    return {
      success: true,
      details: `Primary style: ${classification.primaryStyle.style}, Confidence: ${classification.confidence}%`
    };
  }

  async testMatchOutcomePredictorUnit() {
    const player1Data = {
      name: 'Player 1',
      currentRating: 2250,
      recentGames: Array(20).fill().map(() => ({
        result: Math.random() > 0.4 ? 'win' : 'draw',
        date: '2024-01-15'
      })),
      playingStyle: { primaryStyle: { style: 'tactical' } }
    };

    const player2Data = {
      name: 'Player 2',
      currentRating: 2230,
      recentGames: Array(20).fill().map(() => ({
        result: Math.random() > 0.5 ? 'win' : 'loss',
        date: '2024-01-15'
      })),
      playingStyle: { primaryStyle: { style: 'positional' } }
    };

    const prediction = await this.outcomePredictor.predictMatchOutcome(
      player1Data, 
      player2Data, 
      { player1Color: 'white' }
    );

    if (!prediction || !prediction.player1 || !prediction.player2) {
      throw new Error('Invalid prediction result');
    }

    const totalProb = prediction.player1.winProbability + 
                     prediction.player2.winProbability + 
                     prediction.drawProbability;

    if (Math.abs(totalProb - 100) > 1) {
      throw new Error(`Probabilities don't sum to 100: ${totalProb}`);
    }

    return {
      success: true,
      details: `P1 win: ${prediction.player1.winProbability}%, Draw: ${prediction.drawProbability}%`
    };
  }

  async testPatternAnalyzerUnit() {
    const mockGames = Array(100).fill().map((_, i) => ({
      eco: ['B10', 'E20', 'C20', 'D30', 'A40'][i % 5],
      opening: 'Test Opening',
      result: ['win', 'draw', 'loss'][i % 3],
      ply_count: 40 + (i % 40),
      date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
      white_player: i % 2 === 0 ? 'Test Player' : 'Opponent',
      black_player: i % 2 === 0 ? 'Opponent' : 'Test Player',
      player_rating: 2200,
      opponent_rating: 2180
    }));

    const analysis = await this.patternAnalyzer.analyzePatterns(mockGames, {
      patternTypes: ['opening_sequences', 'result_patterns'],
      minSupport: 0.05,
      includeVisualizations: false
    });

    if (!analysis || !analysis.summary) {
      throw new Error('Invalid analysis result');
    }

    if (analysis.summary.totalPatternsFound < 0) {
      throw new Error('Invalid pattern count');
    }

    return {
      success: true,
      details: `Found ${analysis.summary.totalPatternsFound} patterns, ${analysis.significantPatterns.length} significant`
    };
  }

  async testMLUtilsUnit() {
    // Test normalization
    const testData = [10, 20, 30, 40, 50];
    const normalized = mlUtils.normalize(testData);
    
    if (normalized.length !== testData.length) {
      throw new Error('Normalization length mismatch');
    }

    if (Math.abs(Math.min(...normalized) - 0) > 0.001 || Math.abs(Math.max(...normalized) - 1) > 0.001) {
      throw new Error('Normalization range invalid');
    }

    // Test correlation
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    const correlation = mlUtils.pearsonCorrelation(x, y);
    
    if (Math.abs(correlation - 1.0) > 0.001) {
      throw new Error(`Perfect correlation should be 1.0, got ${correlation}`);
    }

    // Test linear regression
    const regression = mlUtils.linearRegression(x, y);
    
    if (Math.abs(regression.slope - 2.0) > 0.001) {
      throw new Error(`Slope should be 2.0, got ${regression.slope}`);
    }

    return {
      success: true,
      details: `Normalization, correlation (${correlation.toFixed(3)}), regression (slope: ${regression.slope.toFixed(3)}) tests passed`
    };
  }

  // API Integration Tests
  async testPlayerIntelligenceAPI() {
    const response = await this.makeRequest(`/api/statistics/ml/player-intelligence/${TEST_PLAYERS[0]}?includeRatingPrediction=true&includeStyleAnalysis=true`);

    if (!response.success || !response.intelligence) {
      throw new Error('Invalid API response structure');
    }

    const intelligence = response.intelligence;
    
    if (!intelligence.player || !intelligence.generatedAt) {
      throw new Error('Missing required intelligence fields');
    }

    return {
      success: true,
      details: `Intelligence generated for ${intelligence.player}, confidence: ${intelligence.overallConfidence}%`
    };
  }

  async testRatingPredictionAPI() {
    const response = await this.makeRequest(`/api/statistics/ml/rating-prediction/${TEST_PLAYERS[0]}?horizon=30&includeOpponentStrength=true`);

    if (!response.success || !response.prediction) {
      throw new Error('Invalid API response structure');
    }

    const prediction = response.prediction;
    
    if (typeof prediction.predictedRating !== 'number' || typeof prediction.confidence !== 'number') {
      throw new Error('Invalid prediction data types');
    }

    return {
      success: true,
      details: `Rating prediction: ${prediction.predictedRating}, confidence: ${prediction.confidence}%`
    };
  }

  async testStyleClassificationAPI() {
    const response = await this.makeRequest(`/api/statistics/ml/style-classification/${TEST_PLAYERS[0]}?includeEvolution=true&timeframe=recent`);

    if (!response.success || !response.classification) {
      throw new Error('Invalid API response structure');
    }

    const classification = response.classification;
    
    if (!classification.primaryStyle || !classification.styleProfile) {
      throw new Error('Missing classification components');
    }

    return {
      success: true,
      details: `Primary style: ${classification.primaryStyle.style}, confidence: ${classification.confidence}%`
    };
  }

  async testMatchPredictionAPI() {
    const response = await this.makeRequest('/api/statistics/ml/match-prediction', {
      method: 'POST',
      data: {
        player1: TEST_PLAYERS[0],
        player2: TEST_PLAYERS[1],
        matchContext: {
          timeControl: 'classical',
          player1Color: 'white'
        }
      }
    });

    if (!response.success || !response.prediction) {
      throw new Error('Invalid API response structure');
    }

    const prediction = response.prediction;
    
    if (!prediction.player1 || !prediction.player2) {
      throw new Error('Missing player prediction data');
    }

    const totalProb = prediction.player1.winProbability + 
                     prediction.player2.winProbability + 
                     prediction.drawProbability;

    if (Math.abs(totalProb - 100) > 2) {
      throw new Error(`Probabilities should sum to ~100, got ${totalProb}`);
    }

    return {
      success: true,
      details: `Match prediction: ${prediction.player1.name} ${prediction.player1.winProbability}% vs ${prediction.player2.name} ${prediction.player2.winProbability}%`
    };
  }

  async testPatternAnalysisAPI() {
    const response = await this.makeRequest(`/api/statistics/ml/pattern-analysis/${TEST_PLAYERS[0]}?patternTypes=opening_sequences,result_patterns&minSupport=0.05`);

    if (!response.success || !response.analysis) {
      throw new Error('Invalid API response structure');
    }

    const analysis = response.analysis;
    
    if (!analysis.summary || typeof analysis.summary.totalPatternsFound !== 'number') {
      throw new Error('Invalid analysis structure');
    }

    return {
      success: true,
      details: `Pattern analysis: ${analysis.summary.totalPatternsFound} total patterns, ${analysis.significantPatterns.length} significant`
    };
  }

  async testBatchAnalysisAPI() {
    const response = await this.makeRequest('/api/statistics/ml/batch-analysis', {
      method: 'POST',
      data: {
        players: TEST_PLAYERS.slice(0, 2),
        analysisTypes: ['rating_prediction', 'style_classification'],
        options: { timeframe: 'recent' }
      }
    });

    if (!response.success || !response.results) {
      throw new Error('Invalid API response structure');
    }

    const results = response.results;
    const playerCount = Object.keys(results).length;
    
    if (playerCount !== 2) {
      throw new Error(`Expected 2 players, got ${playerCount}`);
    }

    return {
      success: true,
      details: `Batch analysis completed for ${playerCount} players`
    };
  }

  async testMLPerformanceAPI() {
    const response = await this.makeRequest('/api/statistics/ml/models/performance');

    if (!response.success || !response.performance) {
      throw new Error('Invalid API response structure');
    }

    const perf = response.performance;
    
    if (!perf.ratingPredictor || !perf.system) {
      throw new Error('Missing performance metrics');
    }

    return {
      success: true,
      details: `Performance metrics: ${perf.ratingPredictor.predictionsGenerated} predictions, ${perf.system.cacheSize} cache entries`
    };
  }

  // Integration and Load Tests
  async testMLSystemIntegration() {
    // Test complete ML pipeline
    const playerName = TEST_PLAYERS[0];
    
    // Step 1: Get player intelligence
    const intelligence = await this.makeRequest(`/api/statistics/ml/player-intelligence/${playerName}`);
    
    // Step 2: Use intelligence for match prediction
    const matchPrediction = await this.makeRequest('/api/statistics/ml/match-prediction', {
      method: 'POST',
      data: {
        player1: playerName,
        player2: TEST_PLAYERS[1],
        matchContext: { timeControl: 'rapid' }
      }
    });

    // Step 3: Verify data consistency
    if (!intelligence.success || !matchPrediction.success) {
      throw new Error('Pipeline step failed');
    }

    return {
      success: true,
      details: 'Full ML pipeline integration test passed'
    };
  }

  async testMLSystemPerformance() {
    const startTime = Date.now();
    const concurrentRequests = 5;
    
    // Test concurrent ML requests
    const promises = Array(concurrentRequests).fill().map((_, i) => 
      this.makeRequest(`/api/statistics/ml/rating-prediction/${TEST_PLAYERS[i % TEST_PLAYERS.length]}?horizon=20`)
    );

    const results = await Promise.allSettled(promises);
    const duration = Date.now() - startTime;
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const avgTimePerRequest = duration / concurrentRequests;

    if (successful < concurrentRequests * 0.8) {
      throw new Error(`Only ${successful}/${concurrentRequests} requests succeeded`);
    }

    if (avgTimePerRequest > 10000) { // 10 seconds
      throw new Error(`Average response time too high: ${avgTimePerRequest}ms`);
    }

    return {
      success: true,
      details: `${successful}/${concurrentRequests} requests succeeded in ${duration}ms (avg: ${Math.round(avgTimePerRequest)}ms per request)`
    };
  }

  async testMLSystemResilience() {
    // Test error handling
    try {
      await this.makeRequest('/api/statistics/ml/player-intelligence/InvalidPlayer123');
      throw new Error('Should have failed for invalid player');
    } catch (error) {
      if (!error.message.includes('HTTP 404') && !error.message.includes('HTTP 500')) {
        throw new Error(`Unexpected error type: ${error.message}`);
      }
    }

    // Test malformed request
    try {
      await this.makeRequest('/api/statistics/ml/match-prediction', {
        method: 'POST',
        data: { player1: 'Test' } // Missing player2
      });
      throw new Error('Should have failed for malformed request');
    } catch (error) {
      if (!error.message.includes('HTTP 400')) {
        throw new Error(`Expected 400 error, got: ${error.message}`);
      }
    }

    return {
      success: true,
      details: 'Error handling and resilience tests passed'
    };
  }

  // Main test runner
  async runAllTests() {
    this.log('🚀 Starting ML System Test Suite', 'bright');
    this.log(`🔗 Testing server: ${BASE_URL}`, 'yellow');
    this.log(`🎯 Test players: ${TEST_PLAYERS.join(', ')}`, 'yellow');

    // Unit tests for ML models
    this.log('\n📦 Unit Tests', 'magenta');
    await this.test('Rating Predictor Unit Test', () => this.testRatingPredictorUnit());
    await this.test('Style Classifier Unit Test', () => this.testStyleClassifierUnit());
    await this.test('Match Outcome Predictor Unit Test', () => this.testMatchOutcomePredictorUnit());
    await this.test('Pattern Analyzer Unit Test', () => this.testPatternAnalyzerUnit());
    await this.test('ML Utils Unit Test', () => this.testMLUtilsUnit());

    // API integration tests
    this.log('\n🌐 API Integration Tests', 'magenta');
    await this.test('Player Intelligence API', () => this.testPlayerIntelligenceAPI());
    await this.test('Rating Prediction API', () => this.testRatingPredictionAPI());
    await this.test('Style Classification API', () => this.testStyleClassificationAPI());
    await this.test('Match Prediction API', () => this.testMatchPredictionAPI());
    await this.test('Pattern Analysis API', () => this.testPatternAnalysisAPI());
    await this.test('Batch Analysis API', () => this.testBatchAnalysisAPI());
    await this.test('ML Performance Metrics API', () => this.testMLPerformanceAPI());

    // System tests
    this.log('\n🔧 System Integration Tests', 'magenta');
    await this.test('ML System Integration', () => this.testMLSystemIntegration());
    await this.test('ML System Performance', () => this.testMLSystemPerformance());
    await this.test('ML System Resilience', () => this.testMLSystemResilience());

    this.printSummary();
  }

  printSummary() {
    const duration = (Date.now() - this.startTime) / 1000;
    const passRate = ((this.results.passed / this.results.total) * 100).toFixed(1);

    this.log('\n' + '='.repeat(70), 'bright');
    this.log('🏁 ML SYSTEM TEST SUITE COMPLETE', 'bright');
    this.log('='.repeat(70), 'bright');
    
    this.log(`📊 Total Tests: ${this.results.total}`, 'cyan');
    this.log(`✅ Passed: ${this.results.passed}`, 'green');
    this.log(`❌ Failed: ${this.results.failed}`, this.results.failed > 0 ? 'red' : 'green');
    this.log(`🎯 Pass Rate: ${passRate}%`, passRate >= 85 ? 'green' : passRate >= 70 ? 'yellow' : 'red');
    this.log(`⏱️  Duration: ${duration.toFixed(2)}s`, 'blue');

    if (this.results.failed > 0) {
      this.log('\n⚠️  Failed Tests:', 'yellow');
      this.results.details
        .filter(test => test.status === 'failed')
        .forEach(test => {
          this.log(`   • ${test.name}: ${test.error}`, 'red');
        });
      
      this.log('\n💡 Check server logs and ensure ML models are properly initialized', 'yellow');
    } else {
      this.log('\n🎉 All tests passed! ML system is working correctly.', 'green');
    }

    this.log('\n📝 Test Coverage:', 'cyan');
    this.log('   • ML Model Unit Tests ✓');
    this.log('   • API Integration Tests ✓');  
    this.log('   • Performance Tests ✓');
    this.log('   • Error Handling Tests ✓');
    this.log('   • System Integration Tests ✓');

    if (passRate >= 95) {
      this.log('\n🏆 EXCELLENT: ML system ready for production!', 'green');
    } else if (passRate >= 85) {
      this.log('\n👍 GOOD: ML system functional with minor issues', 'yellow');
    } else {
      this.log('\n⚠️  NEEDS WORK: ML system requires attention before production', 'red');
    }
  }
}

// Run the test suite
async function main() {
  const testSuite = new MLSystemTestSuite();
  
  try {
    await testSuite.runAllTests();
    process.exit(testSuite.results.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Test suite failed to run:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = MLSystemTestSuite;