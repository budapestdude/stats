const axios = require('axios');

/**
 * Test connection pool performance
 */
async function testConnectionPool() {
  const baseURL = 'http://localhost:3010';
  
  console.log('🔬 CONNECTION POOL PERFORMANCE TEST');
  console.log('='.repeat(50));
  
  // Get initial pool stats
  try {
    const poolStats = await axios.get(`${baseURL}/api/pool/stats`);
    console.log('\n📊 Initial Pool Stats:');
    console.log(`  Connections: ${poolStats.data.pool.currentSize}`);
    console.log(`  Active: ${poolStats.data.pool.activeCount}`);
    console.log(`  Idle: ${poolStats.data.pool.idleCount}`);
  } catch (error) {
    console.error('Failed to get pool stats:', error.message);
  }
  
  // Test 1: Sequential requests
  console.log('\n📈 TEST 1: Sequential Requests (10 queries)');
  console.log('-'.repeat(50));
  
  const sequentialStart = Date.now();
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    await axios.get(`${baseURL}/api/games/search?limit=5`);
    const duration = Date.now() - start;
    console.log(`  Request ${i + 1}: ${duration}ms`);
  }
  const sequentialDuration = Date.now() - sequentialStart;
  console.log(`Total time: ${sequentialDuration}ms`);
  console.log(`Average: ${(sequentialDuration / 10).toFixed(1)}ms per request`);
  
  // Test 2: Parallel requests
  console.log('\n⚡ TEST 2: Parallel Requests (50 concurrent)');
  console.log('-'.repeat(50));
  
  const parallelStart = Date.now();
  const promises = [];
  
  for (let i = 0; i < 50; i++) {
    promises.push(
      axios.get(`${baseURL}/api/games/search?limit=10&offset=${i * 10}`)
    );
  }
  
  try {
    await Promise.all(promises);
    const parallelDuration = Date.now() - parallelStart;
    
    console.log(`✅ All 50 requests completed`);
    console.log(`Total time: ${parallelDuration}ms`);
    console.log(`Average: ${(parallelDuration / 50).toFixed(1)}ms per request`);
    console.log(`Throughput: ${(50000 / parallelDuration).toFixed(1)} req/sec`);
  } catch (error) {
    console.error('Parallel requests failed:', error.message);
  }
  
  // Test 3: Stress test with different query complexities
  console.log('\n💪 TEST 3: Stress Test (100 mixed queries)');
  console.log('-'.repeat(50));
  
  const stressTests = [
    { name: 'Simple', endpoint: '/api/stress-test?requests=100&query=simple' },
    { name: 'Medium', endpoint: '/api/stress-test?requests=100&query=medium' },
    { name: 'Complex', endpoint: '/api/stress-test?requests=100&query=complex' }
  ];
  
  for (const test of stressTests) {
    try {
      console.log(`\nRunning ${test.name} query test...`);
      const response = await axios.get(`${baseURL}${test.endpoint}`);
      const data = response.data;
      
      console.log(`  Requests: ${data.test.requests}`);
      console.log(`  Total time: ${data.test.totalTime}ms`);
      console.log(`  Avg time: ${data.test.avgTime}ms`);
      console.log(`  Throughput: ${data.test.requestsPerSecond} req/sec`);
      console.log(`  Pool stats:`);
      console.log(`    - Created: ${data.poolStats.created}`);
      console.log(`    - Active: ${data.poolStats.activeCount}`);
      console.log(`    - Idle: ${data.poolStats.idleCount}`);
      console.log(`    - Pool size: ${data.poolStats.currentSize}`);
    } catch (error) {
      console.error(`${test.name} test failed:`, error.message);
    }
  }
  
  // Test 4: Connection pool efficiency
  console.log('\n🎯 TEST 4: Pool Efficiency Test');
  console.log('-'.repeat(50));
  
  // Clear cache first
  await axios.post(`${baseURL}/api/cache/clear`);
  console.log('Cache cleared');
  
  // Make requests that should reuse connections
  const efficiencyStart = Date.now();
  const efficiencyPromises = [];
  
  for (let i = 0; i < 30; i++) {
    efficiencyPromises.push(
      axios.get(`${baseURL}/api/players/Carlsen/stats`)
    );
  }
  
  await Promise.all(efficiencyPromises);
  const efficiencyDuration = Date.now() - efficiencyStart;
  
  // Get final pool stats
  const finalStats = await axios.get(`${baseURL}/api/pool/stats`);
  
  console.log(`\n30 identical requests completed in ${efficiencyDuration}ms`);
  console.log(`Pool performance:`);
  console.log(`  Hit rate: ${finalStats.data.performance.hitRate}`);
  console.log(`  Efficiency: ${finalStats.data.performance.efficiency}`);
  console.log(`  Connections created: ${finalStats.data.pool.created}`);
  console.log(`  Connections reused: ${finalStats.data.pool.acquired - finalStats.data.pool.created}`);
  
  // Test 5: Database stats with parallel queries
  console.log('\n📊 TEST 5: Database Stats (Parallel Queries)');
  console.log('-'.repeat(50));
  
  const dbStatsStart = Date.now();
  const dbStatsResponse = await axios.get(`${baseURL}/api/stats/database`);
  const dbStatsDuration = Date.now() - dbStatsStart;
  
  console.log(`Database stats retrieved in ${dbStatsDuration}ms`);
  console.log(`  Games: ${dbStatsResponse.data.games.count.toLocaleString()}`);
  console.log(`  Tournaments: ${dbStatsResponse.data.tournaments.count.toLocaleString()}`);
  console.log(`  Players: ${dbStatsResponse.data.players.count.toLocaleString()}`);
  console.log(`  Pool connections used: ${dbStatsResponse.data.pool.activeCount}`);
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📈 FINAL POOL STATISTICS');
  console.log('='.repeat(50));
  
  const summary = await axios.get(`${baseURL}/api/pool/stats`);
  const pool = summary.data.pool;
  
  console.table({
    'Total Connections Created': pool.created,
    'Current Pool Size': pool.currentSize,
    'Total Acquisitions': pool.acquired,
    'Total Releases': pool.released,
    'Connection Reuse Rate': ((pool.acquired - pool.created) / pool.acquired * 100).toFixed(1) + '%',
    'Average Use Count': pool.averageUseCount.toFixed(1),
    'Timeouts': pool.timeouts,
    'Errors': pool.errors
  });
  
  console.log('\n✅ CONNECTION POOL TEST COMPLETE');
}

// Run test
testConnectionPool().catch(console.error);