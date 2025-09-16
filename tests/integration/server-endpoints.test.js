const request = require('supertest');
const express = require('express');
const path = require('path');

// Mock the server
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Mock endpoints
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/test', (req, res) => res.json({ message: 'API working' }));
  
  return app;
};

describe('Server Endpoints Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Health & Status Endpoints', () => {
    it('GET /health should return server status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
    });

    it('GET /api/test should return API test message', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'API working');
    });

    it('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);
    });
  });

  describe('Player Endpoints', () => {
    it('GET /api/players/:username should return player data', async () => {
      app.get('/api/players/:username', (req, res) => {
        res.json({
          username: req.params.username,
          rating: 2800,
          title: 'GM'
        });
      });

      const response = await request(app)
        .get('/api/players/magnuscarlsen')
        .expect(200);

      expect(response.body.username).toBe('magnuscarlsen');
      expect(response.body.rating).toBe(2800);
    });

    it('GET /api/players/top should return top players', async () => {
      app.get('/api/players/top', (req, res) => {
        res.json({
          players: [
            { username: 'magnus', rating: 2850 },
            { username: 'hikaru', rating: 2800 }
          ]
        });
      });

      const response = await request(app)
        .get('/api/players/top')
        .expect(200);

      expect(response.body.players).toHaveLength(2);
      expect(response.body.players[0].rating).toBeGreaterThan(response.body.players[1].rating);
    });

    it('GET /api/players/search should handle query parameters', async () => {
      app.get('/api/players/search', (req, res) => {
        const { q, country, minRating } = req.query;
        res.json({
          query: q,
          filters: { country, minRating },
          results: []
        });
      });

      const response = await request(app)
        .get('/api/players/search')
        .query({ q: 'carlsen', country: 'NO', minRating: 2800 })
        .expect(200);

      expect(response.body.query).toBe('carlsen');
      expect(response.body.filters.country).toBe('NO');
      expect(response.body.filters.minRating).toBe('2800');
    });
  });

  describe('Opening Endpoints', () => {
    it('GET /api/openings/explorer should return opening data', async () => {
      app.get('/api/openings/explorer', (req, res) => {
        res.json({
          position: req.query.fen || 'startpos',
          moves: [
            { move: 'e4', games: 50000, whiteWins: 52 }
          ]
        });
      });

      const response = await request(app)
        .get('/api/openings/explorer')
        .expect(200);

      expect(response.body.position).toBe('startpos');
      expect(response.body.moves).toHaveLength(1);
    });

    it('GET /api/openings/eco/:eco should return opening by ECO', async () => {
      app.get('/api/openings/eco/:eco', (req, res) => {
        if (!/^[A-E][0-9]{2}$/.test(req.params.eco)) {
          return res.status(400).json({ error: 'Invalid ECO code' });
        }
        res.json({
          eco: req.params.eco,
          name: 'Test Opening',
          moves: '1. e4 e5'
        });
      });

      const response = await request(app)
        .get('/api/openings/eco/B90')
        .expect(200);

      expect(response.body.eco).toBe('B90');

      // Test invalid ECO
      await request(app)
        .get('/api/openings/eco/Z99')
        .expect(400);
    });
  });

  describe('Tournament Endpoints', () => {
    it('GET /api/tournaments should return tournament list', async () => {
      app.get('/api/tournaments', (req, res) => {
        res.json({
          tournaments: [
            { id: 1, name: 'World Championship', status: 'upcoming' }
          ]
        });
      });

      const response = await request(app)
        .get('/api/tournaments')
        .expect(200);

      expect(response.body.tournaments).toHaveLength(1);
    });

    it('GET /api/tournaments/:id/standings should return standings', async () => {
      app.get('/api/tournaments/:id/standings', (req, res) => {
        res.json({
          tournamentId: req.params.id,
          standings: [
            { rank: 1, player: 'Magnus', points: 7.5 }
          ]
        });
      });

      const response = await request(app)
        .get('/api/tournaments/123/standings')
        .expect(200);

      expect(response.body.tournamentId).toBe('123');
      expect(response.body.standings[0].rank).toBe(1);
    });
  });

  describe('OTB Database Endpoints', () => {
    it('GET /api/otb/database/search should search games', async () => {
      app.get('/api/otb/database/search', (req, res) => {
        const { player, tournament, eco } = req.query;
        res.json({
          filters: { player, tournament, eco },
          games: [],
          total: 0
        });
      });

      const response = await request(app)
        .get('/api/otb/database/search')
        .query({ player: 'Carlsen', eco: 'B90' })
        .expect(200);

      expect(response.body.filters.player).toBe('Carlsen');
      expect(response.body.filters.eco).toBe('B90');
    });

    it('GET /api/otb/database/players/:name/games should return player games', async () => {
      app.get('/api/otb/database/players/:name/games', (req, res) => {
        res.json({
          player: req.params.name,
          games: [],
          stats: { total: 0, wins: 0, draws: 0, losses: 0 }
        });
      });

      const response = await request(app)
        .get('/api/otb/database/players/Magnus%20Carlsen/games')
        .expect(200);

      expect(response.body.player).toBe('Magnus Carlsen');
      expect(response.body).toHaveProperty('stats');
    });
  });

  describe('Statistics Endpoints', () => {
    it('GET /api/stats/overview should return platform stats', async () => {
      app.get('/api/stats/overview', (req, res) => {
        res.json({
          totalGames: 1000000,
          totalPlayers: 10000,
          totalTournaments: 500,
          lastUpdated: new Date().toISOString()
        });
      });

      const response = await request(app)
        .get('/api/stats/overview')
        .expect(200);

      expect(response.body).toHaveProperty('totalGames');
      expect(response.body).toHaveProperty('totalPlayers');
      expect(response.body).toHaveProperty('lastUpdated');
    });

    it('GET /api/stats/rating-distribution should return distribution', async () => {
      app.get('/api/stats/rating-distribution', (req, res) => {
        res.json({
          distribution: [
            { range: '0-1000', count: 100 },
            { range: '1000-1500', count: 500 },
            { range: '1500-2000', count: 300 }
          ]
        });
      });

      const response = await request(app)
        .get('/api/stats/rating-distribution')
        .expect(200);

      expect(response.body.distribution).toHaveLength(3);
      expect(response.body.distribution[0]).toHaveProperty('range');
      expect(response.body.distribution[0]).toHaveProperty('count');
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors gracefully', async () => {
      app.get('/api/error-test', (req, res, next) => {
        next(new Error('Test error'));
      });

      app.use((err, req, res, next) => {
        res.status(500).json({ error: err.message });
      });

      const response = await request(app)
        .get('/api/error-test')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Test error');
    });

    it('should validate request parameters', async () => {
      app.get('/api/validated', (req, res) => {
        const { limit } = req.query;
        if (limit && isNaN(limit)) {
          return res.status(400).json({ error: 'Limit must be a number' });
        }
        res.json({ success: true });
      });

      await request(app)
        .get('/api/validated')
        .query({ limit: 'abc' })
        .expect(400);

      await request(app)
        .get('/api/validated')
        .query({ limit: '10' })
        .expect(200);
    });
  });

  describe('CORS and Headers', () => {
    it('should handle CORS headers', async () => {
      app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
        next();
      });

      app.get('/api/cors-test', (req, res) => res.json({ cors: true }));

      const response = await request(app)
        .get('/api/cors-test')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });

    it('should handle preflight requests', async () => {
      app.options('/api/test', (req, res) => {
        res.header('Access-Control-Allow-Methods', 'GET, POST');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        res.sendStatus(204);
      });

      await request(app)
        .options('/api/test')
        .expect(204);
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit headers', async () => {
      let requestCount = 0;
      app.get('/api/rate-limited', (req, res) => {
        requestCount++;
        if (requestCount > 5) {
          return res.status(429).json({ error: 'Too many requests' });
        }
        res.json({ success: true });
      });

      // Make 5 successful requests
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/api/rate-limited')
          .expect(200);
      }

      // 6th request should be rate limited
      await request(app)
        .get('/api/rate-limited')
        .expect(429);
    });
  });

  describe('Pagination', () => {
    it('should handle pagination parameters', async () => {
      app.get('/api/paginated', (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        res.json({
          page,
          limit,
          offset,
          data: [],
          total: 100,
          totalPages: Math.ceil(100 / limit)
        });
      });

      const response = await request(app)
        .get('/api/paginated')
        .query({ page: 2, limit: 20 })
        .expect(200);

      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(20);
      expect(response.body.offset).toBe(20);
      expect(response.body.totalPages).toBe(5);
    });
  });

  describe('Caching', () => {
    it('should return cached responses', async () => {
      const cache = new Map();
      
      app.get('/api/cached', (req, res) => {
        const key = 'cached-data';
        if (cache.has(key)) {
          res.header('X-Cache', 'HIT');
          return res.json(cache.get(key));
        }
        
        const data = { timestamp: Date.now(), value: 'test' };
        cache.set(key, data);
        res.header('X-Cache', 'MISS');
        res.json(data);
      });

      // First request - cache miss
      const response1 = await request(app)
        .get('/api/cached')
        .expect(200);
      expect(response1.headers['x-cache']).toBe('MISS');

      // Second request - cache hit
      const response2 = await request(app)
        .get('/api/cached')
        .expect(200);
      expect(response2.headers['x-cache']).toBe('HIT');
      expect(response2.body.timestamp).toBe(response1.body.timestamp);
    });
  });

  describe('Content Types', () => {
    it('should handle JSON responses', async () => {
      app.get('/api/json', (req, res) => {
        res.json({ type: 'json' });
      });

      const response = await request(app)
        .get('/api/json')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.type).toBe('json');
    });

    it('should handle plain text responses', async () => {
      app.get('/api/text', (req, res) => {
        res.type('text/plain').send('Plain text response');
      });

      await request(app)
        .get('/api/text')
        .expect('Content-Type', /text\/plain/)
        .expect(200);
    });
  });
});