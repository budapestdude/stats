const axios = require('axios');

/**
 * Test performance of optimized server
 */
async function testPerformance() {
  const baseURL = 'http://localhost:3009';
  
  console.log('🔬 PERFORMANCE TEST - OPTIMIZED SERVER');
  console.log('='.repeat(50));
  
  // Test queries
  const tests = [
    {
      name: 'Health Check',
      endpoint: '/health'
    },
    {
      name: 'Search Games - Player',
      endpoint: '/api/games/search?player=Carlsen'
    },
    {
      name: 'Search Games - Date Range',
      endpoint: '/api/games/search?dateFrom=2020-01-01&dateTo=2020-12-31&limit=50'
    },
    {
      name: 'Top Players',
      endpoint: '/api/players/top?limit=20'
    },
    {
      name: 'Player Stats',
      endpoint: '/api/players/Carlsen/stats'
    },
    {
      name: 'Opening Statistics',
      endpoint: '/api/openings/stats?limit=10'
    },
    {
      name: 'Recent Games',
      endpoint: '/api/games/recent?limit=10'
    },
    {
      name: 'Database Stats',
      endpoint: '/api/stats/database'
    }
  ];
  
  const results = [];
  
  // First run - cold cache
  console.log('\n📊 FIRST RUN (Cold Cache)');
  console.log('-'.repeat(50));
  
  for (const test of tests) {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${baseURL}${test.endpoint}`);
      const duration = Date.now() - startTime;
      
      console.log(`✅ ${test.name}: ${duration}ms`);
      
      results.push({
        test: test.name,
        coldCache: duration,
        status: response.status,
        dataSize: JSON.stringify(response.data).length
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ ${test.name}: Failed (${duration}ms) - ${error.message}`);
      
      results.push({
        test: test.name,
        coldCache: duration,
        status: error.response?.status || 0,
        error: error.message
      });
    }
  }
  
  // Second run - warm cache
  console.log('\n🔥 SECOND RUN (Warm Cache)');
  console.log('-'.repeat(50));
  
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${baseURL}${test.endpoint}`);
      const duration = Date.now() - startTime;
      
      console.log(`✅ ${test.name}: ${duration}ms`);
      
      results[i].warmCache = duration;
      
      // Calculate improvement
      if (results[i].coldCache && results[i].warmCache) {
        const improvement = ((results[i].coldCache - results[i].warmCache) / results[i].coldCache * 100).toFixed(1);
        results[i].improvement = `${improvement}%`;
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ ${test.name}: Failed (${duration}ms)`);
      results[i].warmCache = duration;
    }
  }
  
  // Summary
  console.log('\n📈 PERFORMANCE SUMMARY');
  console.log('='.repeat(50));
  console.table(results.map(r => ({
    'Test': r.test,
    'Cold Cache (ms)': r.coldCache,
    'Warm Cache (ms)': r.warmCache || '-',
    'Improvement': r.improvement || '-',
    'Data Size': r.dataSize ? `${(r.dataSize/1024).toFixed(1)}KB` : '-'
  })));
  
  // Average improvements
  const validImprovements = results.filter(r => r.improvement);
  if (validImprovements.length > 0) {
    const avgImprovement = validImprovements.reduce((sum, r) => 
      sum + parseFloat(r.improvement), 0) / validImprovements.length;
    
    console.log(`\n🎯 Average Cache Performance Improvement: ${avgImprovement.toFixed(1)}%`);
  }
  
  // Test cache clear
  console.log('\n🔄 Testing Cache Clear');
  try {
    const response = await axios.post(`${baseURL}/api/cache/clear`);
    console.log(`✅ Cache cleared: ${response.data.entriesCleared} entries removed`);
  } catch (error) {
    console.log(`❌ Failed to clear cache: ${error.message}`);
  }
  
  // Parallel request test
  console.log('\n⚡ PARALLEL REQUEST TEST');
  console.log('-'.repeat(50));
  
  const parallelRequests = 10;
  const parallelEndpoint = '/api/games/search?limit=10';
  
  console.log(`Sending ${parallelRequests} parallel requests to ${parallelEndpoint}`);
  
  const parallelStartTime = Date.now();
  const promises = [];
  
  for (let i = 0; i < parallelRequests; i++) {
    promises.push(axios.get(`${baseURL}${parallelEndpoint}`));
  }
  
  try {
    await Promise.all(promises);
    const totalDuration = Date.now() - parallelStartTime;
    const avgDuration = totalDuration / parallelRequests;
    
    console.log(`✅ All requests completed`);
    console.log(`  Total time: ${totalDuration}ms`);
    console.log(`  Average per request: ${avgDuration.toFixed(1)}ms`);
    
  } catch (error) {
    console.log(`❌ Parallel requests failed: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ PERFORMANCE TEST COMPLETE');
}

// Run test
testPerformance().catch(console.error);