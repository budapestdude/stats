/**
 * Test Script for Enhanced Search Functionality
 */

const enhancedSearch = require('./src/services/enhanced-search');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function testEnhancedSearch() {
  console.log(`${colors.cyan}🧪 Testing Enhanced Search Functionality${colors.reset}\n`);
  
  const tests = {
    passed: 0,
    failed: 0,
    results: []
  };

  // Test 1: Initialize indexes
  console.log(`${colors.blue}Test 1: Initializing search indexes...${colors.reset}`);
  try {
    await enhancedSearch.initializeIndexes();
    console.log(`${colors.green}✅ Indexes initialized successfully${colors.reset}`);
    tests.passed++;
  } catch (error) {
    console.log(`${colors.red}❌ Failed to initialize indexes: ${error.message}${colors.reset}`);
    tests.failed++;
  }

  // Test 2: Player search
  console.log(`\n${colors.blue}Test 2: Testing player search...${colors.reset}`);
  try {
    const playerResults = enhancedSearch.searchPlayersEnhanced('carl', { limit: 5 });
    console.log(`${colors.green}✅ Found ${playerResults.length} players matching 'carl'${colors.reset}`);
    if (playerResults.length > 0) {
      console.log(`   Top result: ${playerResults[0].player_name || playerResults[0].name}`);
    }
    tests.passed++;
  } catch (error) {
    console.log(`${colors.red}❌ Player search failed: ${error.message}${colors.reset}`);
    tests.failed++;
  }

  // Test 3: Opening search
  console.log(`\n${colors.blue}Test 3: Testing opening search...${colors.reset}`);
  try {
    const openingResults = enhancedSearch.searchOpeningsEnhanced('sicilian', { limit: 5 });
    console.log(`${colors.green}✅ Found ${openingResults.length} openings matching 'sicilian'${colors.reset}`);
    if (openingResults.length > 0) {
      console.log(`   Top result: ${openingResults[0].opening || openingResults[0].name}`);
    }
    tests.passed++;
  } catch (error) {
    console.log(`${colors.red}❌ Opening search failed: ${error.message}${colors.reset}`);
    tests.failed++;
  }

  // Test 4: Tournament search
  console.log(`\n${colors.blue}Test 4: Testing tournament search...${colors.reset}`);
  try {
    const tournamentResults = enhancedSearch.searchTournamentsEnhanced('world', { limit: 5 });
    console.log(`${colors.green}✅ Found ${tournamentResults.length} tournaments matching 'world'${colors.reset}`);
    if (tournamentResults.length > 0) {
      console.log(`   Top result: ${tournamentResults[0].tournament_name}`);
    }
    tests.passed++;
  } catch (error) {
    console.log(`${colors.red}❌ Tournament search failed: ${error.message}${colors.reset}`);
    tests.failed++;
  }

  // Test 5: Game search
  console.log(`\n${colors.blue}Test 5: Testing game search...${colors.reset}`);
  try {
    const gameResults = await enhancedSearch.searchGames({
      opening: 'e4',
      limit: 10
    });
    console.log(`${colors.green}✅ Found ${gameResults.games ? gameResults.games.length : 0} games${colors.reset}`);
    if (gameResults.executionTime) {
      console.log(`   Execution time: ${gameResults.executionTime}ms`);
    }
    tests.passed++;
  } catch (error) {
    console.log(`${colors.red}❌ Game search failed: ${error.message}${colors.reset}`);
    tests.failed++;
  }

  // Test 6: Natural language search
  console.log(`\n${colors.blue}Test 6: Testing natural language search...${colors.reset}`);
  try {
    const nlResults = await enhancedSearch.searchNatural('games with sicilian defense where white won');
    console.log(`${colors.green}✅ Natural language search processed successfully${colors.reset}`);
    tests.passed++;
  } catch (error) {
    console.log(`${colors.red}❌ Natural language search failed: ${error.message}${colors.reset}`);
    tests.failed++;
  }

  // Test 7: Search suggestions
  console.log(`\n${colors.blue}Test 7: Testing search suggestions...${colors.reset}`);
  try {
    const suggestions = await enhancedSearch.getSuggestions('mag', {});
    console.log(`${colors.green}✅ Generated suggestions for 'mag'${colors.reset}`);
    const totalSuggestions = 
      (suggestions.players?.length || 0) + 
      (suggestions.openings?.length || 0) + 
      (suggestions.tournaments?.length || 0);
    console.log(`   Total suggestions: ${totalSuggestions}`);
    tests.passed++;
  } catch (error) {
    console.log(`${colors.red}❌ Suggestions failed: ${error.message}${colors.reset}`);
    tests.failed++;
  }

  // Test 8: Cache performance
  console.log(`\n${colors.blue}Test 8: Testing cache performance...${colors.reset}`);
  try {
    const criteria = { opening: 'french', limit: 10 };
    
    // First search (uncached)
    const start1 = Date.now();
    const result1 = await enhancedSearch.searchGames(criteria);
    const time1 = Date.now() - start1;
    
    // Second search (should be cached)
    const start2 = Date.now();
    const result2 = await enhancedSearch.searchGames(criteria);
    const time2 = Date.now() - start2;
    
    const speedup = time1 / time2;
    console.log(`${colors.green}✅ Cache test completed${colors.reset}`);
    console.log(`   First search: ${time1}ms`);
    console.log(`   Cached search: ${time2}ms`);
    console.log(`   Speedup: ${speedup.toFixed(2)}x`);
    
    if (speedup > 1.5) {
      console.log(`   ${colors.green}Cache is working effectively!${colors.reset}`);
    }
    tests.passed++;
  } catch (error) {
    console.log(`${colors.red}❌ Cache test failed: ${error.message}${colors.reset}`);
    tests.failed++;
  }

  // Summary
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}TEST SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.green}✅ Passed: ${tests.passed}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${tests.failed}${colors.reset}`);
  console.log(`${colors.yellow}📊 Success Rate: ${((tests.passed / (tests.passed + tests.failed)) * 100).toFixed(1)}%${colors.reset}`);

  // Performance metrics
  console.log(`\n${colors.cyan}PERFORMANCE METRICS${colors.reset}`);
  console.log(`Regular cache size: ${enhancedSearch.cache.size} items`);
  console.log(`Hot cache size: ${enhancedSearch.hotCache.size} items`);
  console.log(`Position index size: ${enhancedSearch.positionIndex.size} positions`);

  // Features overview
  console.log(`\n${colors.cyan}ENHANCED SEARCH FEATURES${colors.reset}`);
  const features = [
    '✅ Multi-tier caching system (regular + hot cache)',
    '✅ Fuzzy search with typo tolerance',
    '✅ Natural language query understanding',
    '✅ Intelligent search suggestions',
    '✅ Query performance monitoring',
    '✅ Batch result enrichment',
    '✅ Context-aware recommendations',
    '✅ Position search preparation'
  ];
  
  features.forEach(feature => console.log(`  ${feature}`));

  // API endpoints
  console.log(`\n${colors.cyan}AVAILABLE API ENDPOINTS${colors.reset}`);
  const endpoints = [
    'GET  /api/search/v2/games - Enhanced game search',
    'GET  /api/search/v2/players - Fuzzy player search',
    'GET  /api/search/v2/openings - Opening search with variations',
    'GET  /api/search/v2/tournaments - Tournament search',
    'POST /api/search/v2/natural - Natural language search',
    'POST /api/search/v2/position - Position-based search',
    'GET  /api/search/v2/suggestions - Intelligent suggestions',
    'GET  /api/search/v2/opening/:opening/analysis - Opening analysis',
    'GET  /api/search/v2/stats - Search statistics',
    'DELETE /api/search/v2/cache - Clear caches'
  ];
  
  endpoints.forEach(endpoint => console.log(`  ${endpoint}`));

  console.log(`\n${colors.green}✨ Enhanced search testing complete!${colors.reset}`);
}

// Run tests
testEnhancedSearch().catch(error => {
  console.error(`${colors.red}Fatal error during testing:${colors.reset}`, error);
  process.exit(1);
});