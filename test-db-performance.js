const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3007';

class PerformanceTester {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {}
    };
  }
  
  async runTest(name, fn, iterations = 10) {
    console.log(`\nRunning test: ${name}`);
    const times = [];
    let errors = 0;
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        await fn();
        const duration = Date.now() - start;
        times.push(duration);
        process.stdout.write(`✓`);
      } catch (error) {
        errors++;
        process.stdout.write(`✗`);
      }
    }
    
    console.log('');
    
    const result = {
      name,
      iterations,
      errors,
      times,
      min: Math.min(...times),
      max: Math.max(...times),
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      median: this.getMedian(times)
    };
    
    this.results.tests.push(result);
    this.printTestResult(result);
    return result;
  }
  
  getMedian(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  
  printTestResult(result) {
    console.log(`  Min: ${result.min}ms`);
    console.log(`  Max: ${result.max}ms`);
    console.log(`  Avg: ${result.avg.toFixed(2)}ms`);
    console.log(`  Median: ${result.median}ms`);
    if (result.errors > 0) {
      console.log(`  Errors: ${result.errors}/${result.iterations}`);
    }
  }
  
  async runAllTests() {
    console.log('🚀 Starting Database Performance Tests');
    console.log('=====================================');
    
    // Test 1: Simple query
    await this.runTest('Simple Player Search', async () => {
      await axios.get(`${API_BASE}/api/games/search?player=Carlsen&pageSize=10`);
    });
    
    // Test 2: Complex search with multiple filters
    await this.runTest('Complex Multi-Filter Search', async () => {
      await axios.get(`${API_BASE}/api/games/search?player=Carlsen&year=2023&minElo=2700&pageSize=50`);
    });
    
    // Test 3: Large pagination
    await this.runTest('Large Pagination Request', async () => {
      await axios.get(`${API_BASE}/api/games/search?pageSize=100&page=1`);
    });
    
    // Test 4: Player statistics (should be cached after first call)
    await this.runTest('Player Statistics (with caching)', async () => {
      await axios.get(`${API_BASE}/api/players/Magnus Carlsen/stats`);
    });
    
    // Test 5: Opening statistics
    await this.runTest('Opening Statistics', async () => {
      await axios.get(`${API_BASE}/api/openings/stats?minGames=500`);
    });
    
    // Test 6: Tournament listing
    await this.runTest('Tournament Listing', async () => {
      await axios.get(`${API_BASE}/api/tournaments?pageSize=20`);
    });
    
    // Test 7: Concurrent requests
    await this.runTest('Concurrent Requests (5 parallel)', async () => {
      await Promise.all([
        axios.get(`${API_BASE}/api/games/search?player=Kasparov&pageSize=10`),
        axios.get(`${API_BASE}/api/games/search?player=Fischer&pageSize=10`),
        axios.get(`${API_BASE}/api/games/search?player=Karpov&pageSize=10`),
        axios.get(`${API_BASE}/api/games/search?player=Anand&pageSize=10`),
        axios.get(`${API_BASE}/api/games/search?player=Kramnik&pageSize=10`)
      ]);
    }, 5);
    
    // Test 8: Cache effectiveness
    console.log('\n📊 Testing Cache Effectiveness');
    const uncachedStart = Date.now();
    await axios.get(`${API_BASE}/api/players/Garry Kasparov/stats`);
    const uncachedTime = Date.now() - uncachedStart;
    
    const cachedStart = Date.now();
    await axios.get(`${API_BASE}/api/players/Garry Kasparov/stats`);
    const cachedTime = Date.now() - cachedStart;
    
    console.log(`  Uncached: ${uncachedTime}ms`);
    console.log(`  Cached: ${cachedTime}ms`);
    console.log(`  Speed improvement: ${((uncachedTime / cachedTime - 1) * 100).toFixed(1)}%`);
    
    // Get database stats
    try {
      const dbStats = await axios.get(`${API_BASE}/api/database/stats`);
      this.results.databaseStats = dbStats.data;
      
      console.log('\n📈 Database Statistics');
      console.log(`  Total Games: ${dbStats.data.database.total_games?.toLocaleString() || 'N/A'}`);
      console.log(`  Total Players: ${dbStats.data.database.total_players?.toLocaleString() || 'N/A'}`);
      console.log(`  Total Events: ${dbStats.data.database.total_events?.toLocaleString() || 'N/A'}`);
      
      if (dbStats.data.performance) {
        console.log(`  Cache Hit Rate: ${dbStats.data.performance.cacheHitRate?.toFixed(1) || 0}%`);
      }
    } catch (error) {
      console.log('Could not fetch database stats');
    }
    
    // Get query performance stats
    try {
      const perfStats = await axios.get(`${API_BASE}/api/performance/queries`);
      this.results.queryStats = perfStats.data;
      
      console.log('\n🔍 Top Queries by Frequency');
      perfStats.data.slice(0, 5).forEach((q, i) => {
        console.log(`  ${i + 1}. ${q.query.substring(0, 50)}...`);
        console.log(`     Calls: ${q.count}, Cache Hits: ${q.cacheHits}, Avg Time: ${q.avgDuration?.toFixed(2) || 0}ms`);
      });
    } catch (error) {
      console.log('Could not fetch query performance stats');
    }
    
    // Calculate summary
    this.calculateSummary();
    
    // Save results
    this.saveResults();
    
    console.log('\n✅ Performance Testing Complete!');
    console.log('Results saved to: performance-results.json');
  }
  
  calculateSummary() {
    const allTimes = this.results.tests.flatMap(t => t.times);
    const totalErrors = this.results.tests.reduce((sum, t) => sum + t.errors, 0);
    
    this.results.summary = {
      totalTests: this.results.tests.length,
      totalIterations: this.results.tests.reduce((sum, t) => sum + t.iterations, 0),
      totalErrors,
      overallMin: Math.min(...allTimes),
      overallMax: Math.max(...allTimes),
      overallAvg: allTimes.reduce((a, b) => a + b, 0) / allTimes.length,
      overallMedian: this.getMedian(allTimes),
      successRate: ((1 - totalErrors / this.results.tests.reduce((sum, t) => sum + t.iterations, 0)) * 100).toFixed(1)
    };
    
    console.log('\n📊 Overall Performance Summary');
    console.log('==============================');
    console.log(`  Total Tests: ${this.results.summary.totalTests}`);
    console.log(`  Total Iterations: ${this.results.summary.totalIterations}`);
    console.log(`  Success Rate: ${this.results.summary.successRate}%`);
    console.log(`  Overall Min: ${this.results.summary.overallMin}ms`);
    console.log(`  Overall Max: ${this.results.summary.overallMax}ms`);
    console.log(`  Overall Avg: ${this.results.summary.overallAvg.toFixed(2)}ms`);
    console.log(`  Overall Median: ${this.results.summary.overallMedian}ms`);
  }
  
  saveResults() {
    const filename = `performance-results-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
    
    // Also save a summary CSV
    const csvContent = [
      'Test Name,Min (ms),Max (ms),Avg (ms),Median (ms),Errors',
      ...this.results.tests.map(t => 
        `"${t.name}",${t.min},${t.max},${t.avg.toFixed(2)},${t.median},${t.errors}`
      )
    ].join('\n');
    
    fs.writeFileSync(filename.replace('.json', '.csv'), csvContent);
  }
}

// Run tests
async function main() {
  const tester = new PerformanceTester();
  
  // Check if server is running
  try {
    await axios.get(`${API_BASE}/health`);
  } catch (error) {
    console.error('❌ Server is not running on port 3007');
    console.error('Please start the optimized server first:');
    console.error('  node optimized-server.js');
    process.exit(1);
  }
  
  await tester.runAllTests();
}

main().catch(console.error);