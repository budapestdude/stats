const request = require('supertest');
const axios = require('axios');
const express = require('express');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('Player Endpoints', () => {
  let app;
  
  beforeEach(() => {
    // Create a minimal Express app for testing
    app = express();
    app.use(express.json());
    
    // Mock the player endpoints from simple-server.js
    const CHESS_COM_API = 'https://api.chess.com/pub';
    const USER_AGENT = 'Chess Stats (https://github.com/chess-stats)';
    
    // Get top players (must come before /:username route)
    app.get('/api/players/top', async (req, res) => {
      const { category = 'blitz', limit = 10 } = req.query;
      
      try {
        
        // Fetch leaderboards data
        const response = await axios.get(`${CHESS_COM_API}/leaderboards`, {
          headers: { 'User-Agent': USER_AGENT }
        });
        
        // Map category to Chess.com leaderboard names
        const categoryMap = {
          'classical': 'live_rapid',
          'rapid': 'live_rapid',
          'blitz': 'live_blitz',
          'bullet': 'live_bullet'
        };
        
        const leaderboardKey = categoryMap[category] || 'live_rapid';
        
        // Get top players from selected leaderboard
        const topPlayers = response.data[leaderboardKey]?.slice(0, limit) || [];
        
        // Format the data
        const formatted = topPlayers.map((player, index) => ({
          id: String(index + 1),
          username: player.username,
          title: player.title || null,
          country: player.country?.split('/').pop() || null,
          current_ratings: {
            [category]: player.score,
            win_count: player.win_count,
            loss_count: player.loss_count,
            draw_count: player.draw_count
          }
        }));
        
        res.json(formatted);
      } catch (error) {
        console.error('Error fetching leaderboards:', error);
        // Fallback to mock data if API fails
        const mockRatings = {
          rapid: [2839, 2805, 2802],
          blitz: [2882, 2854, 2847],
          bullet: [3034, 2991, 2976]
        };
        
        const ratings = mockRatings[category] || mockRatings.blitz;
        
        res.json([
          { id: '1', username: 'MagnusCarlsen', title: 'GM', country: 'NO', current_ratings: { [category]: ratings[0] } },
          { id: '2', username: 'FabianoCaruana', title: 'GM', country: 'US', current_ratings: { [category]: ratings[1] } },
          { id: '3', username: 'Hikaru', title: 'GM', country: 'US', current_ratings: { [category]: ratings[2] } }
        ]);
      }
    });

    // Player search endpoint (must come before /:username route)
    app.get('/api/players/search', async (req, res) => {
      try {
        const { q: query } = req.query;
        
        if (!query) {
          return res.status(400).json({ error: 'Query parameter is required' });
        }
        
        // Mock search results
        const searchResults = [
          { username: 'magnuscarlsen', title: 'GM', country: 'NO' },
          { username: 'magnus123', title: null, country: 'US' }
        ].filter(player => player.username.toLowerCase().includes(query.toLowerCase()));
        
        res.json({ players: searchResults });
      } catch (error) {
        console.error('Error searching players:', error.message);
        res.status(500).json({ error: 'Search failed' });
      }
    });
    
    // Get individual player
    app.get('/api/players/:username', async (req, res) => {
      try {
        const { username } = req.params;
        
        // Fetch player profile and stats
        const [profileResponse, statsResponse] = await Promise.all([
          axios.get(`${CHESS_COM_API}/player/${username}`, {
            headers: { 'User-Agent': USER_AGENT }
          }),
          axios.get(`${CHESS_COM_API}/player/${username}/stats`, {
            headers: { 'User-Agent': USER_AGENT }
          })
        ]);
        
        const profile = profileResponse.data;
        const stats = statsResponse.data;
        
        // Format the response
        const playerData = {
          username: profile.username,
          title: profile.title || null,
          name: profile.name || null,
          country: profile.country?.split('/').pop() || null,
          followers: profile.followers,
          joined: new Date(profile.joined * 1000).toISOString(),
          last_online: new Date(profile.last_online * 1000).toISOString(),
          status: profile.status,
          ratings: {
            rapid: stats.chess_rapid?.last?.rating || null,
            blitz: stats.chess_blitz?.last?.rating || null,
            bullet: stats.chess_bullet?.last?.rating || null,
            daily: stats.chess_daily?.last?.rating || null
          },
          peak_ratings: {
            rapid: stats.chess_rapid?.best?.rating || null,
            blitz: stats.chess_blitz?.best?.rating || null,
            bullet: stats.chess_bullet?.best?.rating || null,
            daily: stats.chess_daily?.best?.rating || null
          },
          stats: {
            rapid: stats.chess_rapid?.record || null,
            blitz: stats.chess_blitz?.record || null,
            bullet: stats.chess_bullet?.record || null,
            daily: stats.chess_daily?.record || null
          }
        };
        
        res.json(playerData);
      } catch (error) {
        console.error('Error fetching player:', error.message);
        res.status(404).json({ error: 'Player not found' });
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/players/:username', () => {
    test('should return player data for valid username', async () => {
      const mockProfile = {
        username: 'magnuscarlsen',
        title: 'GM',
        name: 'Magnus Carlsen',
        country: 'https://api.chess.com/pub/country/NO',
        followers: 50000,
        joined: 1357077600,
        last_online: 1698768000,
        status: 'premium'
      };
      
      const mockStats = {
        chess_rapid: {
          last: { rating: 2839 },
          best: { rating: 2882 },
          record: { win: 1200, loss: 150, draw: 300 }
        },
        chess_blitz: {
          last: { rating: 2954 },
          best: { rating: 3021 },
          record: { win: 2500, loss: 400, draw: 800 }
        }
      };
      
      mockedAxios.get.mockImplementation((url) => {
        if (url.includes('/player/magnuscarlsen/stats')) {
          return Promise.resolve({ data: mockStats });
        }
        return Promise.resolve({ data: mockProfile });
      });
      
      const response = await request(app)
        .get('/api/players/magnuscarlsen')
        .expect(200);
      
      expect(response.body).toHaveProperty('username', 'magnuscarlsen');
      expect(response.body).toHaveProperty('title', 'GM');
      expect(response.body).toHaveProperty('name', 'Magnus Carlsen');
      expect(response.body).toHaveProperty('country', 'NO');
      expect(response.body).toHaveProperty('ratings');
      expect(response.body.ratings).toHaveProperty('rapid', 2839);
      expect(response.body.ratings).toHaveProperty('blitz', 2954);
      expect(response.body).toHaveProperty('peak_ratings');
      expect(response.body).toHaveProperty('stats');
      
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    test('should handle player not found', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Player not found'));
      
      const response = await request(app)
        .get('/api/players/nonexistentplayer')
        .expect(404);
      
      expect(response.body).toHaveProperty('error', 'Player not found');
    });

    test('should handle API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));
      
      const response = await request(app)
        .get('/api/players/testplayer')
        .expect(404);
      
      expect(response.body).toHaveProperty('error', 'Player not found');
    });

    test('should format timestamps correctly', async () => {
      const mockProfile = {
        username: 'testplayer',
        joined: 1357077600,
        last_online: 1698768000,
        followers: 100
      };
      
      const mockStats = {};
      
      mockedAxios.get.mockImplementation((url) => {
        if (url.includes('/stats')) {
          return Promise.resolve({ data: mockStats });
        }
        return Promise.resolve({ data: mockProfile });
      });
      
      const response = await request(app)
        .get('/api/players/testplayer')
        .expect(200);
      
      expect(response.body.joined).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
      expect(response.body.last_online).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    test('should handle missing optional fields', async () => {
      const mockProfile = {
        username: 'simpleplayer',
        joined: 1357077600,
        last_online: 1698768000,
        followers: 50
        // Missing title, name, country, status
      };
      
      const mockStats = {
        // Missing some game modes
        chess_rapid: {
          last: { rating: 1500 }
        }
      };
      
      mockedAxios.get.mockImplementation((url) => {
        if (url.includes('/stats')) {
          return Promise.resolve({ data: mockStats });
        }
        return Promise.resolve({ data: mockProfile });
      });
      
      const response = await request(app)
        .get('/api/players/simpleplayer')
        .expect(200);
      
      expect(response.body.title).toBeNull();
      expect(response.body.name).toBeNull();
      expect(response.body.country).toBeNull();
      expect(response.body.ratings.blitz).toBeNull();
      expect(response.body.ratings.rapid).toBe(1500);
    });
  });

  describe('GET /api/players/top', () => {
    test('should return top players with default settings', async () => {
      const mockLeaderboard = {
        live_blitz: [
          { username: 'MagnusCarlsen', title: 'GM', score: 2954, country: 'https://api.chess.com/pub/country/NO', win_count: 100, loss_count: 20, draw_count: 30 },
          { username: 'FabianoCaruana', title: 'GM', score: 2901, country: 'https://api.chess.com/pub/country/US', win_count: 95, loss_count: 25, draw_count: 20 },
          { username: 'Hikaru', title: 'GM', score: 2889, country: 'https://api.chess.com/pub/country/US', win_count: 150, loss_count: 30, draw_count: 40 }
        ]
      };
      
      mockedAxios.get.mockResolvedValue({ data: mockLeaderboard });
      
      const response = await request(app)
        .get('/api/players/top')
        .expect(200);
      
      expect(response.body).toHaveLength(3);
      expect(response.body[0]).toHaveProperty('username', 'MagnusCarlsen');
      expect(response.body[0]).toHaveProperty('title', 'GM');
      expect(response.body[0]).toHaveProperty('country', 'NO');
      expect(response.body[0].current_ratings).toHaveProperty('blitz', 2954);
      expect(response.body[0].current_ratings).toHaveProperty('win_count', 100);
    });

    test('should handle different categories', async () => {
      const mockLeaderboard = {
        live_rapid: [
          { username: 'MagnusCarlsen', title: 'GM', score: 2839, country: 'https://api.chess.com/pub/country/NO', win_count: 80, loss_count: 10, draw_count: 25 }
        ]
      };
      
      mockedAxios.get.mockResolvedValue({ data: mockLeaderboard });
      
      const response = await request(app)
        .get('/api/players/top?category=rapid')
        .expect(200);
      
      expect(response.body[0].current_ratings).toHaveProperty('rapid', 2839);
    });

    test('should respect limit parameter', async () => {
      const mockLeaderboard = {
        live_blitz: Array(20).fill().map((_, i) => ({
          username: `player${i}`,
          title: 'GM',
          score: 2500 + i,
          country: 'https://api.chess.com/pub/country/US',
          win_count: 50,
          loss_count: 10,
          draw_count: 15
        }))
      };
      
      mockedAxios.get.mockResolvedValue({ data: mockLeaderboard });
      
      const response = await request(app)
        .get('/api/players/top?limit=5')
        .expect(200);
      
      expect(response.body).toHaveLength(5);
    });

    test('should fallback to mock data on API failure', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));
      
      const response = await request(app)
        .get('/api/players/top?category=rapid');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      expect(response.body[0]).toHaveProperty('username', 'MagnusCarlsen');
      expect(response.body[0].current_ratings).toHaveProperty('rapid');
    });

    test('should handle invalid category with fallback', async () => {
      const mockLeaderboard = {
        live_rapid: [
          { username: 'MagnusCarlsen', score: 2839, win_count: 80, loss_count: 10, draw_count: 25 }
        ]
      };
      
      mockedAxios.get.mockResolvedValue({ data: mockLeaderboard });
      
      const response = await request(app)
        .get('/api/players/top?category=invalid')
        .expect(200);
      
      expect(response.body[0].current_ratings).toHaveProperty('invalid');
    });
  });

  describe('GET /api/players/search', () => {
    test('should search players with query', async () => {
      const response = await request(app)
        .get('/api/players/search?q=magnus')
        .expect(200);
      
      expect(response.body).toHaveProperty('players');
      expect(response.body.players).toHaveLength(2);
      expect(response.body.players[0]).toHaveProperty('username', 'magnuscarlsen');
      expect(response.body.players[0]).toHaveProperty('title', 'GM');
    });

    test('should require query parameter', async () => {
      const response = await request(app)
        .get('/api/players/search')
        .expect(400);
      
      expect(response.body).toHaveProperty('error', 'Query parameter is required');
    });

    test('should handle case insensitive search', async () => {
      const response = await request(app)
        .get('/api/players/search?q=MAGNUS')
        .expect(200);
      
      expect(response.body.players).toHaveLength(2);
    });

    test('should return empty results for no matches', async () => {
      const response = await request(app)
        .get('/api/players/search?q=xyznomatch')
        .expect(200);
      
      expect(response.body.players).toHaveLength(0);
    });
  });

  describe('Player Data Validation', () => {
    test('should validate required fields in player response', async () => {
      const mockProfile = {
        username: 'testplayer',
        joined: 1357077600,
        last_online: 1698768000,
        followers: 100
      };
      
      const mockStats = {};
      
      mockedAxios.get.mockImplementation((url) => {
        if (url.includes('/stats')) {
          return Promise.resolve({ data: mockStats });
        }
        return Promise.resolve({ data: mockProfile });
      });
      
      const response = await request(app)
        .get('/api/players/testplayer')
        .expect(200);
      
      // Check required fields exist
      const requiredFields = ['username', 'joined', 'last_online', 'followers', 'ratings', 'peak_ratings', 'stats'];
      requiredFields.forEach(field => {
        expect(response.body).toHaveProperty(field);
      });
      
      // Check rating structure
      const ratingFields = ['rapid', 'blitz', 'bullet', 'daily'];
      ratingFields.forEach(field => {
        expect(response.body.ratings).toHaveProperty(field);
        expect(response.body.peak_ratings).toHaveProperty(field);
        expect(response.body.stats).toHaveProperty(field);
      });
    });

    test('should handle country URL parsing correctly', async () => {
      const mockProfile = {
        username: 'testplayer',
        country: 'https://api.chess.com/pub/country/NO',
        joined: 1357077600,
        last_online: 1698768000,
        followers: 100
      };
      
      const mockStats = {};
      
      mockedAxios.get.mockImplementation((url) => {
        if (url.includes('/stats')) {
          return Promise.resolve({ data: mockStats });
        }
        return Promise.resolve({ data: mockProfile });
      });
      
      const response = await request(app)
        .get('/api/players/testplayer')
        .expect(200);
      
      expect(response.body.country).toBe('NO');
    });
  });

  describe('Performance and Rate Limiting', () => {
    test('should handle concurrent requests efficiently', async () => {
      const mockProfile = { username: 'testplayer', joined: 1357077600, last_online: 1698768000, followers: 100 };
      const mockStats = {};
      
      mockedAxios.get.mockImplementation((url) => {
        if (url.includes('/stats')) {
          return Promise.resolve({ data: mockStats });
        }
        return Promise.resolve({ data: mockProfile });
      });
      
      const requests = Array(5).fill().map(() => 
        request(app).get('/api/players/testplayer')
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.username).toBe('testplayer');
      });
    });

    test('should handle API timeout gracefully', async () => {
      mockedAxios.get.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );
      
      const response = await request(app)
        .get('/api/players/timeoutplayer')
        .expect(404);
      
      expect(response.body).toHaveProperty('error', 'Player not found');
    });
  });
});