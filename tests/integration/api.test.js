const request = require('supertest');
const express = require('express');
const path = require('path');

// Mock the database manager
jest.mock('../../config/database', () => ({
  mainDb: null,
  movesDb: null,
  initialize: jest.fn().mockResolvedValue({ mainDb: null, movesDb: null }),
  getOne: jest.fn(),
  getAll: jest.fn(),
  runQuery: jest.fn(),
  close: jest.fn()
}));

// Import routes after mocking
const playersRouter = require('../../routes/players');
const tournamentsRouter = require('../../routes/tournaments');
const openingsRouter = require('../../routes/openings');
const statsRouter = require('../../routes/stats');

describe('API Integration Tests', () => {
  let app;

  beforeAll(() => {
    // Create test app
    app = express();
    app.use(express.json());
    
    // Mount routes
    app.use('/api/players', playersRouter);
    app.use('/api/tournaments', tournamentsRouter);
    app.use('/api/openings', openingsRouter);
    app.use('/api/stats', statsRouter);
    
    // Error handler
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({ error: err.message });
    });
  });

  describe('GET /api/players/search', () => {
    it('should return empty array for short queries', async () => {
      const response = await request(app)
        .get('/api/players/search')
        .query({ q: 'a' });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should search for players with valid query', async () => {
      const response = await request(app)
        .get('/api/players/search')
        .query({ q: 'magnus' });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    }, 10000);
  });

  describe('GET /api/players/top', () => {
    it('should return top players', async () => {
      const response = await request(app)
        .get('/api/players/top')
        .query({ category: 'blitz', limit: 5 });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    }, 10000);

    it('should validate category parameter', async () => {
      const response = await request(app)
        .get('/api/players/top')
        .query({ category: 'invalid' });
      
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/stats/overview', () => {
    it('should return platform statistics', async () => {
      const response = await request(app)
        .get('/api/stats/overview');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalGames');
      expect(response.body).toHaveProperty('totalPlayers');
      expect(response.body).toHaveProperty('totalTournaments');
    });
  });

  describe('GET /api/stats/rating-distribution', () => {
    it('should return rating distribution data', async () => {
      const response = await request(app)
        .get('/api/stats/rating-distribution');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('distribution');
      expect(Array.isArray(response.body.distribution)).toBe(true);
      
      if (response.body.distribution.length > 0) {
        expect(response.body.distribution[0]).toHaveProperty('range');
        expect(response.body.distribution[0]).toHaveProperty('count');
        expect(response.body.distribution[0]).toHaveProperty('percentage');
      }
    });
  });

  describe('GET /api/openings/popular', () => {
    it('should return popular openings', async () => {
      const response = await request(app)
        .get('/api/openings/popular')
        .query({ limit: 10 });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('eco');
        expect(response.body[0]).toHaveProperty('name');
        expect(response.body[0]).toHaveProperty('count');
        expect(response.body[0]).toHaveProperty('winRate');
      }
    });
  });

  describe('GET /api/tournaments', () => {
    it('should return paginated tournaments', async () => {
      const dbManager = require('../../config/database');
      dbManager.getAll.mockResolvedValue([
        { Event: 'Test Tournament', Site: 'Test', Date: '2024.01.01' }
      ]);
      dbManager.getOne.mockResolvedValue({ total: 1 });
      dbManager.mainDb = {}; // Mock db exists

      const response = await request(app)
        .get('/api/tournaments')
        .query({ page: 1, limit: 20 });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tournaments');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('totalPages');
    });

    it('should handle missing database gracefully', async () => {
      const dbManager = require('../../config/database');
      dbManager.mainDb = null; // No database

      const response = await request(app)
        .get('/api/tournaments');
      
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/tournaments/upcoming', () => {
    it('should return upcoming tournaments', async () => {
      const response = await request(app)
        .get('/api/tournaments/upcoming');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('name');
        expect(response.body[0]).toHaveProperty('location');
        expect(response.body[0]).toHaveProperty('startDate');
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should handle multiple requests gracefully', async () => {
      const promises = [];
      
      // Make 5 concurrent requests
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app).get('/api/stats/overview')
        );
      }
      
      const responses = await Promise.all(promises);
      
      // All should succeed (under rate limit)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid endpoints', async () => {
      const response = await request(app)
        .get('/api/invalid/endpoint');
      
      expect(response.status).toBe(404);
    });

    it('should handle malformed requests', async () => {
      const response = await request(app)
        .get('/api/openings/eco/INVALID');
      
      expect([400, 404]).toContain(response.status);
    });
  });
});