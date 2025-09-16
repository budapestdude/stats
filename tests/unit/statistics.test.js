const request = require('supertest');
const express = require('express');

// Mock axios for external API calls
const axios = require('axios');
jest.mock('axios');
const mockedAxios = axios;

describe('Statistics Endpoints', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Statistics endpoints implementation
    app.get('/api/stats/overview', (req, res) => {
      res.json({
        totalGames: 1234567890,
        totalPlayers: 45678901,
        activeTournaments: 1234,
        platforms: {
          'chesscom': {
            games: 856789012,
            players: 32145678,
            avgRating: 1487
          },
          'lichess': {
            games: 377778878,
            players: 13533223,
            avgRating: 1592
          }
        },
        gameFormats: {
          bullet: 456789012,
          blitz: 345678901,
          rapid: 234567890,
          classical: 123456789,
          correspondence: 73456788
        },
        recentActivity: {
          last24h: {
            games: 2345678,
            newPlayers: 12345
          },
          last7d: {
            games: 16789012,
            newPlayers: 87654
          }
        },
        topCountries: [
          { country: 'United States', players: 5678901, flag: '🇺🇸' },
          { country: 'Russia', players: 4567890, flag: '🇷🇺' },
          { country: 'India', players: 3456789, flag: '🇮🇳' },
          { country: 'Germany', players: 2345678, flag: '🇩🇪' },
          { country: 'France', players: 1234567, flag: '🇫🇷' }
        ],
        lastUpdated: new Date().toISOString()
      });
    });

    app.get('/api/stats/rating-distribution', (req, res) => {
      const { platform = 'all', variant = 'all' } = req.query;
      
      const distributions = {
        all: {
          '0-800': { players: 3456789, percentage: 15.2 },
          '800-1000': { players: 4567890, percentage: 20.1 },
          '1000-1200': { players: 5678901, percentage: 25.0 },
          '1200-1400': { players: 4567890, percentage: 20.1 },
          '1400-1600': { players: 2345678, percentage: 10.3 },
          '1600-1800': { players: 1234567, percentage: 5.4 },
          '1800-2000': { players: 567890, percentage: 2.5 },
          '2000-2200': { players: 234567, percentage: 1.0 },
          '2200-2400': { players: 89012, percentage: 0.4 },
          '2400+': { players: 23456, percentage: 0.1 }
        },
        'chess.com': {
          '0-800': { players: 2345678, percentage: 18.3 },
          '800-1000': { players: 3456789, percentage: 27.0 },
          '1000-1200': { players: 3456789, percentage: 27.0 },
          '1200-1400': { players: 2234567, percentage: 17.4 },
          '1400-1600': { players: 890123, percentage: 6.9 },
          '1600-1800': { players: 345678, percentage: 2.7 },
          '1800-2000': { players: 89012, percentage: 0.7 },
          '2000+': { players: 23456, percentage: 0.2 }
        }
      };

      const data = distributions[platform] || distributions.all;
      
      res.json({
        platform,
        variant,
        distribution: data,
        totalPlayers: Object.values(data).reduce((sum, bracket) => sum + bracket.players, 0),
        averageRating: platform === 'chess.com' ? 1487 : platform === 'lichess' ? 1592 : 1532,
        lastUpdated: new Date().toISOString()
      });
    });

    app.get('/api/stats/activity', (req, res) => {
      const { timeframe = '24h', platform = 'all' } = req.query;
      
      const activityData = {
        '24h': {
          games: 2345678,
          players: 234567,
          tournaments: 456,
          peakHour: {
            hour: '20:00 UTC',
            games: 345678
          },
          hourlyData: Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            games: Math.floor(Math.random() * 200000) + 50000,
            players: Math.floor(Math.random() * 20000) + 5000
          }))
        },
        '7d': {
          games: 16789012,
          players: 1234567,
          tournaments: 2345,
          peakDay: {
            day: 'Sunday',
            games: 2789012
          },
          dailyData: Array.from({ length: 7 }, (_, i) => ({
            day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i],
            games: Math.floor(Math.random() * 500000) + 2000000,
            players: Math.floor(Math.random() * 50000) + 150000
          }))
        },
        '30d': {
          games: 72345678,
          players: 3456789,
          tournaments: 8901,
          peakDay: {
            day: 'Sunday',
            games: 2789012
          },
          dailyData: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            games: Math.floor(Math.random() * 500000) + 2000000,
            players: Math.floor(Math.random() * 50000) + 150000
          }))
        }
      };

      const data = activityData[timeframe] || activityData['24h'];
      
      res.json({
        timeframe,
        platform,
        ...data,
        lastUpdated: new Date().toISOString()
      });
    });

    app.get('/api/stats/leaderboards', (req, res) => {
      const { category = 'rating', variant = 'blitz', limit = 50 } = req.query;
      
      const leaderboards = {
        rating: {
          blitz: Array.from({ length: parseInt(limit) }, (_, i) => ({
            rank: i + 1,
            username: `player${i + 1}`,
            rating: 2800 - i * 5,
            country: ['US', 'RU', 'IN', 'DE', 'FR'][i % 5],
            title: i < 10 ? ['GM', 'IM', 'FM'][i % 3] : null,
            games: Math.floor(Math.random() * 10000) + 5000,
            winRate: (65 - i * 0.2).toFixed(1)
          }))
        },
        games: Array.from({ length: parseInt(limit) }, (_, i) => ({
          rank: i + 1,
          username: `gamer${i + 1}`,
          totalGames: 50000 - i * 100,
          rating: Math.floor(Math.random() * 800) + 1200,
          winRate: (55 + Math.random() * 20).toFixed(1)
        })),
        winRate: Array.from({ length: parseInt(limit) }, (_, i) => ({
          rank: i + 1,
          username: `winner${i + 1}`,
          winRate: (85 - i * 0.5).toFixed(1),
          rating: Math.floor(Math.random() * 1000) + 1500,
          games: Math.floor(Math.random() * 5000) + 1000
        }))
      };

      const data = category === 'rating' ? leaderboards.rating[variant] || leaderboards.rating.blitz 
                   : leaderboards[category] || leaderboards.rating.blitz;
      
      res.json({
        category,
        variant: variant || 'N/A',
        limit: parseInt(limit),
        leaders: data,
        lastUpdated: new Date().toISOString()
      });
    });

    // Mock external API calls
    mockedAxios.get.mockResolvedValue({
      data: { success: true }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/stats/overview', () => {
    test('should return comprehensive platform overview', async () => {
      const response = await request(app)
        .get('/api/stats/overview')
        .expect(200);

      expect(response.body).toHaveProperty('totalGames');
      expect(response.body).toHaveProperty('totalPlayers');
      expect(response.body).toHaveProperty('activeTournaments');
      expect(response.body).toHaveProperty('platforms');
      expect(response.body).toHaveProperty('gameFormats');
      expect(response.body).toHaveProperty('recentActivity');
      expect(response.body).toHaveProperty('topCountries');
      expect(response.body).toHaveProperty('lastUpdated');

      expect(typeof response.body.totalGames).toBe('number');
      expect(typeof response.body.totalPlayers).toBe('number');
      expect(Array.isArray(response.body.topCountries)).toBe(true);
    });

    test('should include platform-specific data', async () => {
      const response = await request(app)
        .get('/api/stats/overview')
        .expect(200);

      expect(response.body.platforms).toHaveProperty('chesscom');
      expect(response.body.platforms).toHaveProperty('lichess');
      
      expect(response.body.platforms['chesscom']).toHaveProperty('games');
      expect(response.body.platforms['chesscom']).toHaveProperty('players');
      expect(response.body.platforms['chesscom']).toHaveProperty('avgRating');
    });

    test('should include game format breakdown', async () => {
      const response = await request(app)
        .get('/api/stats/overview')
        .expect(200);

      const expectedFormats = ['bullet', 'blitz', 'rapid', 'classical', 'correspondence'];
      expectedFormats.forEach(format => {
        expect(response.body.gameFormats).toHaveProperty(format);
        expect(typeof response.body.gameFormats[format]).toBe('number');
      });
    });

    test('should include recent activity metrics', async () => {
      const response = await request(app)
        .get('/api/stats/overview')
        .expect(200);

      expect(response.body.recentActivity).toHaveProperty('last24h');
      expect(response.body.recentActivity).toHaveProperty('last7d');
      expect(response.body.recentActivity.last24h).toHaveProperty('games');
      expect(response.body.recentActivity.last24h).toHaveProperty('newPlayers');
    });

    test('should respond quickly for overview stats', async () => {
      const startTime = Date.now();
      await request(app)
        .get('/api/stats/overview')
        .expect(200);
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50);
    });
  });

  describe('GET /api/stats/rating-distribution', () => {
    test('should return rating distribution for all platforms', async () => {
      const response = await request(app)
        .get('/api/stats/rating-distribution')
        .expect(200);

      expect(response.body).toHaveProperty('platform', 'all');
      expect(response.body).toHaveProperty('distribution');
      expect(response.body).toHaveProperty('totalPlayers');
      expect(response.body).toHaveProperty('averageRating');

      const expectedBrackets = ['0-800', '800-1000', '1000-1200', '1200-1400', '1400-1600', '1600-1800', '1800-2000', '2000-2200', '2200-2400', '2400+'];
      expectedBrackets.forEach(bracket => {
        expect(response.body.distribution).toHaveProperty(bracket);
        expect(response.body.distribution[bracket]).toHaveProperty('players');
        expect(response.body.distribution[bracket]).toHaveProperty('percentage');
      });
    });

    test('should handle platform-specific distribution', async () => {
      const response = await request(app)
        .get('/api/stats/rating-distribution?platform=chess.com')
        .expect(200);

      expect(response.body.platform).toBe('chess.com');
      expect(response.body.averageRating).toBe(1487);
      expect(response.body).toHaveProperty('distribution');
    });

    test('should validate percentage calculations', async () => {
      const response = await request(app)
        .get('/api/stats/rating-distribution')
        .expect(200);

      const totalPercentage = Object.values(response.body.distribution)
        .reduce((sum, bracket) => sum + bracket.percentage, 0);
      expect(Math.abs(totalPercentage - 100)).toBeLessThan(1); // Allow for rounding
    });

    test('should validate player count consistency', async () => {
      const response = await request(app)
        .get('/api/stats/rating-distribution')
        .expect(200);

      const calculatedTotal = Object.values(response.body.distribution)
        .reduce((sum, bracket) => sum + bracket.players, 0);
      expect(calculatedTotal).toBe(response.body.totalPlayers);
    });
  });

  describe('GET /api/stats/activity', () => {
    test('should return 24h activity data by default', async () => {
      const response = await request(app)
        .get('/api/stats/activity')
        .expect(200);

      expect(response.body.timeframe).toBe('24h');
      expect(response.body).toHaveProperty('games');
      expect(response.body).toHaveProperty('players');
      expect(response.body).toHaveProperty('tournaments');
      expect(response.body).toHaveProperty('peakHour');
      expect(response.body).toHaveProperty('hourlyData');
      expect(Array.isArray(response.body.hourlyData)).toBe(true);
      expect(response.body.hourlyData).toHaveLength(24);
    });

    test('should handle 7d timeframe', async () => {
      const response = await request(app)
        .get('/api/stats/activity?timeframe=7d')
        .expect(200);

      expect(response.body.timeframe).toBe('7d');
      expect(response.body).toHaveProperty('dailyData');
      expect(Array.isArray(response.body.dailyData)).toBe(true);
      expect(response.body.dailyData).toHaveLength(7);
      expect(response.body).toHaveProperty('peakDay');
    });

    test('should handle 30d timeframe', async () => {
      const response = await request(app)
        .get('/api/stats/activity?timeframe=30d')
        .expect(200);

      expect(response.body.timeframe).toBe('30d');
      expect(response.body.dailyData).toHaveLength(30);
      response.body.dailyData.forEach(day => {
        expect(day).toHaveProperty('date');
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    test('should validate hourly data structure', async () => {
      const response = await request(app)
        .get('/api/stats/activity?timeframe=24h')
        .expect(200);

      response.body.hourlyData.forEach(hour => {
        expect(hour).toHaveProperty('hour');
        expect(hour).toHaveProperty('games');
        expect(hour).toHaveProperty('players');
        expect(typeof hour.hour).toBe('number');
        expect(hour.hour).toBeGreaterThanOrEqual(0);
        expect(hour.hour).toBeLessThan(24);
      });
    });

    test('should handle platform filtering', async () => {
      const response = await request(app)
        .get('/api/stats/activity?platform=lichess')
        .expect(200);

      expect(response.body.platform).toBe('lichess');
    });
  });

  describe('GET /api/stats/leaderboards', () => {
    test('should return rating leaderboard by default', async () => {
      const response = await request(app)
        .get('/api/stats/leaderboards')
        .expect(200);

      expect(response.body.category).toBe('rating');
      expect(response.body.variant).toBe('blitz');
      expect(response.body).toHaveProperty('leaders');
      expect(Array.isArray(response.body.leaders)).toBe(true);
      expect(response.body.leaders).toHaveLength(50); // default limit
    });

    test('should handle custom category and limit', async () => {
      const response = await request(app)
        .get('/api/stats/leaderboards?category=games&limit=10')
        .expect(200);

      expect(response.body.category).toBe('games');
      expect(response.body.limit).toBe(10);
      expect(response.body.leaders).toHaveLength(10);
    });

    test('should validate leaderboard entry structure', async () => {
      const response = await request(app)
        .get('/api/stats/leaderboards')
        .expect(200);

      response.body.leaders.forEach((leader, index) => {
        expect(leader).toHaveProperty('rank', index + 1);
        expect(leader).toHaveProperty('username');
        expect(leader).toHaveProperty('rating');
        expect(typeof leader.username).toBe('string');
        expect(typeof leader.rating).toBe('number');
      });
    });

    test('should handle winRate category', async () => {
      const response = await request(app)
        .get('/api/stats/leaderboards?category=winRate')
        .expect(200);

      expect(response.body.category).toBe('winRate');
      response.body.leaders.forEach(leader => {
        expect(leader).toHaveProperty('winRate');
        expect(parseFloat(leader.winRate)).toBeGreaterThan(0);
        expect(parseFloat(leader.winRate)).toBeLessThanOrEqual(100);
      });
    });

    test('should maintain rank order', async () => {
      const response = await request(app)
        .get('/api/stats/leaderboards')
        .expect(200);

      for (let i = 1; i < response.body.leaders.length; i++) {
        const currentRating = response.body.leaders[i].rating;
        const previousRating = response.body.leaders[i - 1].rating;
        expect(currentRating).toBeLessThanOrEqual(previousRating);
      }
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle concurrent statistics requests', async () => {
      const requests = [
        request(app).get('/api/stats/overview'),
        request(app).get('/api/stats/rating-distribution'),
        request(app).get('/api/stats/activity'),
        request(app).get('/api/stats/leaderboards')
      ];

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('should respond quickly for all statistics endpoints', async () => {
      const endpoints = [
        '/api/stats/overview',
        '/api/stats/rating-distribution', 
        '/api/stats/activity',
        '/api/stats/leaderboards'
      ];

      for (const endpoint of endpoints) {
        const startTime = Date.now();
        await request(app).get(endpoint).expect(200);
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(100);
      }
    });

    test('should handle invalid timeframe gracefully', async () => {
      const response = await request(app)
        .get('/api/stats/activity?timeframe=invalid')
        .expect(200);

      // Should default to 24h
      expect(response.body.timeframe).toBe('invalid');
      expect(response.body).toHaveProperty('hourlyData');
    });

    test('should handle large limit values', async () => {
      const response = await request(app)
        .get('/api/stats/leaderboards?limit=1000')
        .expect(200);

      expect(response.body.limit).toBe(1000);
      expect(response.body.leaders).toHaveLength(1000);
    });

    test('should validate date formats in activity data', async () => {
      const response = await request(app)
        .get('/api/stats/activity?timeframe=30d')
        .expect(200);

      response.body.dailyData.forEach(day => {
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(new Date(day.date).toString()).not.toBe('Invalid Date');
      });
    });
  });

  describe('Data Validation', () => {
    test('should have consistent data types across all endpoints', async () => {
      const overview = await request(app).get('/api/stats/overview').expect(200);
      const distribution = await request(app).get('/api/stats/rating-distribution').expect(200);
      const activity = await request(app).get('/api/stats/activity').expect(200);
      const leaderboards = await request(app).get('/api/stats/leaderboards').expect(200);

      // Check timestamps
      expect(typeof overview.body.lastUpdated).toBe('string');
      expect(typeof distribution.body.lastUpdated).toBe('string');
      expect(typeof activity.body.lastUpdated).toBe('string');
      expect(typeof leaderboards.body.lastUpdated).toBe('string');

      // Validate ISO format
      [overview, distribution, activity, leaderboards].forEach(response => {
        expect(new Date(response.body.lastUpdated).toString()).not.toBe('Invalid Date');
      });
    });

    test('should have reasonable numeric ranges', async () => {
      const response = await request(app)
        .get('/api/stats/overview')
        .expect(200);

      expect(response.body.totalGames).toBeGreaterThan(0);
      expect(response.body.totalPlayers).toBeGreaterThan(0);
      expect(response.body.activeTournaments).toBeGreaterThan(0);
      
      Object.values(response.body.gameFormats).forEach(count => {
        expect(count).toBeGreaterThan(0);
      });
    });

    test('should maintain data consistency between related endpoints', async () => {
      const overview = await request(app).get('/api/stats/overview').expect(200);
      const activity = await request(app).get('/api/stats/activity').expect(200);

      // Activity games should be reasonable compared to overview
      expect(activity.body.games).toBeGreaterThan(0);
      expect(activity.body.players).toBeGreaterThan(0);
      expect(activity.body.players).toBeLessThan(overview.body.totalPlayers);
    });
  });
});