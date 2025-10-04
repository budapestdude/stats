// Test the new player openings endpoint
const axios = require('axios');

const BASE_URL = 'http://localhost:3007';

async function testOpeningsEndpoint() {
  console.log('Testing /api/players/:username/openings endpoint\n');
  console.log('Make sure simple-server.js is running on port 3007!\n');

  try {
    // Test 1: Basic request
    console.log('Test 1: Fetching openings for magnuscarlsen...');
    const response1 = await axios.get(`${BASE_URL}/api/players/magnuscarlsen/openings`);
    console.log('✅ Success!');
    console.log(`Total games analyzed: ${response1.data.totalGames}`);
    console.log(`Total openings: ${response1.data.summary.totalOpenings}`);
    console.log(`Most played: ${response1.data.summary.mostPlayedOpening?.name} (${response1.data.summary.mostPlayedOpening?.games} games)`);
    console.log(`Best performing: ${response1.data.summary.bestPerformingOpening?.name} (${response1.data.summary.bestPerformingOpening?.performance}% score)\n`);

    // Test 2: With time class filter
    console.log('Test 2: Fetching blitz openings only...');
    const response2 = await axios.get(`${BASE_URL}/api/players/magnuscarlsen/openings?timeClass=blitz`);
    console.log('✅ Success!');
    console.log(`Blitz games analyzed: ${response2.data.totalGames}`);
    console.log(`Time class filter: ${response2.data.timeClass}\n`);

    // Test 3: Limited games
    console.log('Test 3: Fetching with limit of 50 games...');
    const response3 = await axios.get(`${BASE_URL}/api/players/magnuscarlsen/openings?limit=50`);
    console.log('✅ Success!');
    console.log(`Games analyzed: ${response3.data.totalGames} (max 50)\n`);

    // Test 4: Check data structure
    console.log('Test 4: Validating response structure...');
    const data = response1.data;

    if (!data.username) throw new Error('Missing username');
    if (!data.overall || !Array.isArray(data.overall)) throw new Error('Missing overall stats');
    if (!data.asWhite || !Array.isArray(data.asWhite)) throw new Error('Missing white stats');
    if (!data.asBlack || !Array.isArray(data.asBlack)) throw new Error('Missing black stats');
    if (!data.summary) throw new Error('Missing summary');

    console.log('✅ All required fields present!\n');

    // Test 5: Display sample opening data
    console.log('Test 5: Sample opening statistics (top 3 overall):');
    data.overall.slice(0, 3).forEach((opening, index) => {
      console.log(`${index + 1}. ${opening.name} (${opening.eco})`);
      console.log(`   Games: ${opening.games}, Win Rate: ${opening.winRate}%, Performance: ${opening.performance}%`);
    });
    console.log('\n✅ All tests passed!\n');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Error: Server not running!');
      console.log('Please start the server with: node simple-server.js\n');
    } else if (error.response) {
      console.log(`❌ API Error (${error.response.status}):`, error.response.data);
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

testOpeningsEndpoint();
