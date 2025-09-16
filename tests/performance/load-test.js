import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTrend = new Trend('response_time');

// Test configuration
export const options = {
  stages: [
    // Ramp up
    { duration: '2m', target: 10 }, // Ramp up to 10 users over 2 minutes
    { duration: '5m', target: 10 }, // Stay at 10 users for 5 minutes
    { duration: '2m', target: 20 }, // Ramp up to 20 users over 2 minutes
    { duration: '5m', target: 20 }, // Stay at 20 users for 5 minutes
    { duration: '2m', target: 0 },  // Ramp down to 0 users over 2 minutes
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
    http_req_failed: ['rate<0.05'],     // Error rate should be less than 5%
    errors: ['rate<0.05'],
  },
};

const BASE_URL = 'http://localhost:3007';

// Test scenarios
export default function () {
  const scenarios = [
    healthCheck,
    apiTest,
    statsOverview,
    topPlayers,
    playerSearch,
    openingsPopular,
    tournaments,
    cacheStats
  ];

  // Randomly select a scenario
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  scenario();
  
  sleep(1); // Wait 1 second between requests
}

function healthCheck() {
  const response = http.get(`${BASE_URL}/health`);
  
  const success = check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check has status field': (r) => r.json('status') === 'healthy',
    'health check response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!success);
  responseTrend.add(response.timings.duration);
}

function apiTest() {
  const response = http.get(`${BASE_URL}/api/test`);
  
  const success = check(response, {
    'api test status is 200': (r) => r.status === 200,
    'api test has message': (r) => r.json('message') === 'API is working!',
    'api test response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  errorRate.add(!success);
  responseTrend.add(response.timings.duration);
}

function statsOverview() {
  const response = http.get(`${BASE_URL}/api/stats/overview`);
  
  const success = check(response, {
    'stats overview status is 200': (r) => r.status === 200,
    'stats has totalGames': (r) => r.json('totalGames') > 0,
    'stats has totalPlayers': (r) => r.json('totalPlayers') > 0,
    'stats response time < 2000ms': (r) => r.timings.duration < 2000,
  });

  errorRate.add(!success);
  responseTrend.add(response.timings.duration);
}

function topPlayers() {
  const categories = ['blitz', 'rapid', 'classical', 'bullet'];
  const category = categories[Math.floor(Math.random() * categories.length)];
  
  const response = http.get(`${BASE_URL}/api/players/top?category=${category}&limit=5`);
  
  const success = check(response, {
    'top players status is 200': (r) => r.status === 200,
    'top players returns array': (r) => Array.isArray(r.json()),
    'top players response time < 3000ms': (r) => r.timings.duration < 3000,
  });

  errorRate.add(!success);
  responseTrend.add(response.timings.duration);
}

function playerSearch() {
  const queries = ['magnus', 'hikaru', 'fabiano', 'ding', 'ian'];
  const query = queries[Math.floor(Math.random() * queries.length)];
  
  const response = http.get(`${BASE_URL}/api/players/search?q=${query}`);
  
  const success = check(response, {
    'player search status is 200': (r) => r.status === 200,
    'player search returns array': (r) => Array.isArray(r.json()),
    'player search response time < 3000ms': (r) => r.timings.duration < 3000,
  });

  errorRate.add(!success);
  responseTrend.add(response.timings.duration);
}

function openingsPopular() {
  const response = http.get(`${BASE_URL}/api/openings/popular?limit=10`);
  
  const success = check(response, {
    'popular openings status is 200': (r) => r.status === 200,
    'popular openings returns array': (r) => Array.isArray(r.json()),
    'popular openings has eco codes': (r) => {
      const data = r.json();
      return data.length > 0 && data[0].eco;
    },
    'popular openings response time < 2000ms': (r) => r.timings.duration < 2000,
  });

  errorRate.add(!success);
  responseTrend.add(response.timings.duration);
}

function tournaments() {
  const response = http.get(`${BASE_URL}/api/tournaments?page=1&limit=10`);
  
  const success = check(response, {
    'tournaments status is 200': (r) => r.status === 200,
    'tournaments has tournaments array': (r) => r.json('tournaments') !== undefined,
    'tournaments has pagination': (r) => r.json('total') !== undefined,
    'tournaments response time < 3000ms': (r) => r.timings.duration < 3000,
  });

  errorRate.add(!success);
  responseTrend.add(response.timings.duration);
}

function cacheStats() {
  const response = http.get(`${BASE_URL}/api/cache/stats`);
  
  const success = check(response, {
    'cache stats status is 200': (r) => r.status === 200,
    'cache stats is object': (r) => typeof r.json() === 'object',
    'cache stats response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  errorRate.add(!success);
  responseTrend.add(response.timings.duration);
}

// Setup function (runs once before all iterations)
export function setup() {
  console.log('🚀 Starting Chess Stats API performance tests');
  
  // Warm up the application
  const warmupResponse = http.get(`${BASE_URL}/health`);
  check(warmupResponse, {
    'warmup successful': (r) => r.status === 200,
  });
  
  return { startTime: new Date() };
}

// Teardown function (runs once after all iterations)
export function teardown(data) {
  const duration = (new Date() - data.startTime) / 1000;
  console.log(`✅ Performance tests completed in ${duration} seconds`);
}