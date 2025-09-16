const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3010'; // Using the production pooled server
const TEST_PLAYER = 'Carlsen, Magnus'; // Known player in OTB database

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

class StatisticsTestSuite {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      total: 0
    };
    this.startTime = Date.now();
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async test(name, testFn) {
    this.results.total++;
    try {
      this.log(`\n📊 Testing: ${name}`, 'cyan');
      const result = await testFn();
      
      if (result.success !== false) {
        this.results.passed++;
        this.log(`✅ PASS: ${name}`, 'green');
        
        // Log interesting data points
        if (result.data) {
          this.log(`   📈 Data points: ${this.getDataSummary(result.data)}`, 'blue');
        }
      } else {
        throw new Error(result.error || 'Test returned success: false');
      }
    } catch (error) {
      this.results.failed++;
      this.log(`❌ FAIL: ${name}`, 'red');
      this.log(`   Error: ${error.message}`, 'red');
    }
  }

  getDataSummary(data) {
    if (Array.isArray(data)) {
      return `${data.length} items`;
    } else if (typeof data === 'object' && data !== null) {
      return Object.keys(data).join(', ');
    }
    return 'N/A';
  }

  async makeRequest(endpoint, options = {}) {
    try {
      const response = await axios({
        method: options.method || 'GET',
        url: `${BASE_URL}${endpoint}`,
        data: options.data,
        timeout: 30000,
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

  // Core Statistics Tests
  async testPlayerStatistics() {
    return await this.makeRequest(`/api/statistics/player/${TEST_PLAYER}?detailed=true`);
  }

  async testOpeningStatistics() {
    return await this.makeRequest('/api/statistics/openings?category=all&limit=20');
  }

  async testTournamentStatistics() {
    return await this.makeRequest('/api/statistics/tournaments?timeframe=2y&minGames=100');
  }

  // Advanced Analytics Tests
  async testRatingAnalysis() {
    return await this.makeRequest(`/api/statistics/rating-analysis/${TEST_PLAYER}?timeframe=5y&predictions=true`);
  }

  async testPlayerComparison() {
    const players = ['Carlsen, Magnus', 'Caruana, Fabiano'];
    return await this.makeRequest('/api/statistics/compare-players', {
      method: 'POST',
      data: {
        players,
        options: {
          timeframe: '2y',
          includeHeadToHead: true,
          includeOpenings: true
        }
      }
    });
  }

  async testTimeSeriesAnalysis() {
    return await this.makeRequest(`/api/statistics/time-series/game_count?timeframe=2y&granularity=month&player=${TEST_PLAYER}`);
  }

  // Visualization Tests
  async testVisualizationData() {
    return await this.makeRequest(`/api/statistics/visualization/line_chart?player=${TEST_PLAYER}&metric=rating&timeframe=1y`);
  }

  async testAdvancedFiltering() {
    const params = new URLSearchParams({
      players: 'Carlsen, Magnus,Caruana, Fabiano',
      minRating: 2600,
      dateFrom: '2020-01-01',
      dateTo: '2024-12-31',
      groupBy: 'year',
      aggregations: 'count,avg_rating,win_rate',
      limit: 10
    });
    
    return await this.makeRequest(`/api/statistics/advanced-filtering?${params}`);
  }

  // Database and Performance Tests  
  async testDatabaseHealth() {
    return await this.makeRequest('/api/statistics/database/health');
  }

  async testPerformanceMetrics() {
    return await this.makeRequest('/api/pool/stats');
  }

  // Integration Tests
  async testFullPlayerProfile() {
    // Test comprehensive player data aggregation
    const [basic, rating, openings] = await Promise.all([
      this.makeRequest(`/api/statistics/player/${TEST_PLAYER}`),
      this.makeRequest(`/api/statistics/rating-analysis/${TEST_PLAYER}`),
      this.makeRequest(`/api/statistics/openings/player/${TEST_PLAYER}?limit=10`)
    ]);

    return {
      success: true,
      data: {
        basic: basic.statistics || basic,
        rating: rating.analysis || rating,
        openings: openings.statistics || openings
      }
    };
  }

  async testStatisticalReports() {
    // Test comprehensive reporting functionality
    const reports = await Promise.all([
      this.makeRequest('/api/statistics/trends?category=openings&timeframe=2y'),
      this.makeRequest('/api/statistics/rating-distribution?timeframe=1y&bucketSize=100'),
      this.makeRequest('/api/statistics/insights?timeframe=90d&categories=performance,trends')
    ]);

    return {
      success: true,
      data: {
        trends: reports[0],
        distribution: reports[1],
        insights: reports[2]
      }
    };
  }

  // Main test runner
  async runAllTests() {
    this.log('🚀 Starting Advanced Statistics Test Suite', 'bright');
    this.log(`📡 Testing server: ${BASE_URL}`, 'yellow');
    this.log(`🎯 Test player: ${TEST_PLAYER}`, 'yellow');

    // Core functionality tests
    await this.test('Player Statistics', () => this.testPlayerStatistics());
    await this.test('Opening Statistics', () => this.testOpeningStatistics());
    await this.test('Tournament Statistics', () => this.testTournamentStatistics());

    // Advanced analytics tests
    await this.test('Rating Analysis & Predictions', () => this.testRatingAnalysis());
    await this.test('Player Comparison', () => this.testPlayerComparison());
    await this.test('Time Series Analysis', () => this.testTimeSeriesAnalysis());

    // Visualization tests
    await this.test('Visualization Data Generation', () => this.testVisualizationData());
    await this.test('Advanced Filtering & Aggregation', () => this.testAdvancedFiltering());

    // System tests
    await this.test('Database Health Check', () => this.testDatabaseHealth());
    await this.test('Connection Pool Performance', () => this.testPerformanceMetrics());

    // Integration tests
    await this.test('Full Player Profile Integration', () => this.testFullPlayerProfile());
    await this.test('Statistical Reports Generation', () => this.testStatisticalReports());

    this.printSummary();
  }

  printSummary() {
    const duration = (Date.now() - this.startTime) / 1000;
    const passRate = ((this.results.passed / this.results.total) * 100).toFixed(1);

    this.log('\n' + '='.repeat(60), 'bright');
    this.log('🏁 TEST SUITE COMPLETE', 'bright');
    this.log('='.repeat(60), 'bright');
    
    this.log(`📊 Total Tests: ${this.results.total}`, 'cyan');
    this.log(`✅ Passed: ${this.results.passed}`, 'green');
    this.log(`❌ Failed: ${this.results.failed}`, this.results.failed > 0 ? 'red' : 'green');
    this.log(`🎯 Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : 'red');
    this.log(`⏱️  Duration: ${duration.toFixed(2)}s`, 'blue');

    if (this.results.failed > 0) {
      this.log('\n⚠️  Some tests failed. Check server logs for details.', 'yellow');
      this.log('💡 Ensure the server is running on port 3010 with OTB database', 'yellow');
    } else {
      this.log('\n🎉 All tests passed! Statistics system is working correctly.', 'green');
    }

    this.log('\n📝 Test Coverage:');
    this.log('   • Player performance analytics ✓');
    this.log('   • Opening statistics & trends ✓');  
    this.log('   • Tournament & event analytics ✓');
    this.log('   • Rating analysis & predictions ✓');
    this.log('   • Comparative player analysis ✓');
    this.log('   • Time series analysis ✓');
    this.log('   • Data visualization endpoints ✓');
    this.log('   • Advanced filtering & aggregation ✓');
    this.log('   • Database health & performance ✓');
    this.log('   • Integration & reporting ✓');
  }
}

// Run the test suite
async function main() {
  const testSuite = new StatisticsTestSuite();
  
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

module.exports = StatisticsTestSuite;