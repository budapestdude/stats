// Test retry mechanism and rate limiting
const axios = require('axios');

// Helper function for API calls with retry logic and rate limiting
async function fetchWithRetry(url, options = {}, retries = 3) {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.get(url, options);

      // Validate response
      if (!response.data) {
        throw new Error('Invalid API response: empty data');
      }

      return response;
    } catch (error) {
      lastError = error;

      // Handle rate limiting (429)
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
        console.warn(`Rate limited. Retrying after ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      // Handle server errors (500-599) with exponential backoff
      if (error.response?.status >= 500 && attempt < retries - 1) {
        const backoffTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(`Server error. Retrying in ${backoffTime}ms... (attempt ${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        continue;
      }

      // Don't retry client errors (400-499, except 429)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        console.error(`Client error (${error.response.status}): Not retrying`);
        throw error;
      }

      // Network errors - retry with backoff
      if (attempt < retries - 1) {
        const backoffTime = Math.pow(2, attempt) * 1000;
        console.warn(`Network error. Retrying in ${backoffTime}ms... (attempt ${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        continue;
      }
    }
  }

  console.error(`API request failed after ${retries} attempts:`, lastError.message);
  throw lastError;
}

async function runTests() {
  console.log('Testing retry mechanism and rate limiting...\n');

  // Test 1: Successful API call
  console.log('Test 1: Successful API call to Chess.com');
  try {
    const response = await fetchWithRetry('https://api.chess.com/pub/player/magnuscarlsen', {
      headers: { 'User-Agent': 'Chess-Stats-Test/1.0' }
    });
    console.log('✅ Success! Player:', response.data.username);
  } catch (error) {
    console.log('❌ Failed:', error.message);
  }

  console.log('\n---\n');

  // Test 2: Test with invalid endpoint (404)
  console.log('Test 2: Invalid endpoint (should fail without retry)');
  try {
    const response = await fetchWithRetry('https://api.chess.com/pub/player/thisuserdoesnotexist123456789', {
      headers: { 'User-Agent': 'Chess-Stats-Test/1.0' }
    });
    console.log('✅ Success:', response.data);
  } catch (error) {
    console.log('✅ Expected failure (404 - no retry):', error.response?.status || error.message);
  }

  console.log('\n---\n');

  // Test 3: Test Lichess API
  console.log('Test 3: Successful API call to Lichess');
  try {
    const response = await fetchWithRetry('https://lichess.org/api/user/magnuscarlsen', {
      headers: { 'Accept': 'application/json' }
    });
    console.log('✅ Success! Player:', response.data.username);
  } catch (error) {
    console.log('❌ Failed:', error.message);
  }

  console.log('\n---\n');

  // Test 4: Response validation
  console.log('Test 4: Response data validation');
  try {
    const response = await fetchWithRetry('https://api.chess.com/pub/player/magnuscarlsen', {
      headers: { 'User-Agent': 'Chess-Stats-Test/1.0' }
    });

    if (!response.data.username) {
      throw new Error('Invalid player data: missing username');
    }

    console.log('✅ Validation passed! Username:', response.data.username);
  } catch (error) {
    console.log('❌ Validation failed:', error.message);
  }

  console.log('\n---\n');
  console.log('All tests completed!');
}

runTests().catch(console.error);
