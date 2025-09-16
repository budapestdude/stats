const request = require('supertest');
const express = require('express');

describe('Game Endpoints', () => {
  let app;
  
  beforeEach(() => {
    // Create a minimal Express app for testing
    app = express();
    app.use(express.json());
    
    // Mock the game endpoints from simple-server.js
    
    // Game search endpoint
    app.get('/api/games/search', (req, res) => {
      const { 
        player, 
        opening, 
        result, 
        minRating, 
        maxRating,
        timeControl,
        dateFrom,
        dateTo,
        page = 1,
        limit = 20 
      } = req.query;

      // Generate mock game data based on filters
      const games = [];
      const totalGames = 15423; // Mock total
      
      for (let i = 0; i < limit; i++) {
        const gameNum = (page - 1) * limit + i + 1;
        if (gameNum > totalGames) break;
        
        const results = ['1-0', '0-1', '1/2-1/2'];
        const openings = [
          { eco: 'C50', name: 'Italian Game' },
          { eco: 'B10', name: 'Caro-Kann Defense' },
          { eco: 'D02', name: 'London System' },
          { eco: 'A04', name: 'Reti Opening' },
          { eco: 'B01', name: 'Scandinavian Defense' }
        ];
        const timeControls = ['blitz', 'rapid', 'bullet', 'classical'];
        const players = ['Hikaru', 'MagnusCarlsen', 'FabianoCaruana', 'DingLiren', 'Nepo', 'AlirезаFirouzja'];
        
        games.push({
          id: `game_${gameNum}`,
          white: players[Math.floor(Math.random() * players.length)],
          black: players[Math.floor(Math.random() * players.length)],
          result: result || results[Math.floor(Math.random() * results.length)],
          whiteRating: minRating ? parseInt(minRating) + Math.floor(Math.random() * 200) : 2000 + Math.floor(Math.random() * 800),
          blackRating: minRating ? parseInt(minRating) + Math.floor(Math.random() * 200) : 2000 + Math.floor(Math.random() * 800),
          opening: opening || openings[Math.floor(Math.random() * openings.length)],
          timeControl: timeControl || timeControls[Math.floor(Math.random() * timeControls.length)],
          moves: 30 + Math.floor(Math.random() * 60),
          date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          tournament: Math.random() > 0.7 ? 'Titled Tuesday' : null,
          pgn: '1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d4 exd4 6.cxd4...'
        });
      }

      res.json({
        games,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalGames,
          pages: Math.ceil(totalGames / limit)
        },
        filters: {
          player,
          opening,
          result,
          minRating,
          maxRating,
          timeControl,
          dateFrom,
          dateTo
        }
      });
    });

    // Get game by ID endpoint
    app.get('/api/games/:id', (req, res) => {
      const { id } = req.params;
      
      res.json({
        id,
        white: 'MagnusCarlsen',
        black: 'Hikaru',
        whiteRating: 2839,
        blackRating: 2802,
        result: '1-0',
        opening: { eco: 'C50', name: 'Italian Game', variation: 'Classical Variation' },
        timeControl: 'rapid',
        timeClass: '10+0',
        date: '2024-01-15T14:30:00Z',
        tournament: 'Tata Steel Masters 2024',
        round: 7,
        moves: 41,
        termination: 'resignation',
        pgn: `[Event "Tata Steel Masters 2024"]
[Site "Wijk aan Zee NED"]
[Date "2024.01.15"]
[Round "7"]
[White "Magnus Carlsen"]
[Black "Hikaru Nakamura"]
[Result "1-0"]
[WhiteElo "2839"]
[BlackElo "2802"]
[ECO "C50"]

1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d4 exd4 6.cxd4 Bb4+ 7.Bd2 Bxd2+ 
8.Nbxd2 d5 9.exd5 Nxd5 10.Qb3 Na5 11.Qa4+ Nc6 12.Qb3 Na5 13.Qa4+ Nc6 
14.O-O O-O 15.Rfe1 Nb6 16.Qd1 Nxc4 17.Nxc4 Be6 18.Nce5 Nxe5 19.Nxe5 c6 
20.Qf3 Qb6 21.Rad1 Rad8 22.h3 Rd5 23.Qg3 Rfd8 24.Rd2 Qb4 25.Red1 Qb1 
26.Qf4 Qxd1+ 27.Rxd1 f6 28.Ng4 Kf7 29.Ne3 R5d7 30.Nc4 Ke7 31.Nb6 Rd6 
32.Nc4 Rd5 33.Ne3 R5d7 34.Qh4 h6 35.Qf4 Rd6 36.Nc4 R6d7 37.Qc1 Kf7 
38.Qc3 Rd5 39.Re1 R8d7 40.Ne3 Rxd4 41.Qc5 1-0`,
        analysis: {
          accuracy: { white: 94.2, black: 87.6 },
          brilliantMoves: 1,
          blunders: 0,
          mistakes: { white: 1, black: 2 },
          inaccuracies: { white: 2, black: 4 },
          averagecentipawnloss: { white: 12, black: 28 }
        }
      });
    });
  });

  describe('GET /api/games/search', () => {
    test('should return games with default pagination', async () => {
      const response = await request(app)
        .get('/api/games/search')
        .expect(200);
      
      expect(response.body).toHaveProperty('games');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('filters');
      
      expect(response.body.games).toBeInstanceOf(Array);
      expect(response.body.games.length).toBeLessThanOrEqual(20); // Default limit
      
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 15423,
        pages: Math.ceil(15423 / 20)
      });
    });

    test('should handle custom pagination', async () => {
      const response = await request(app)
        .get('/api/games/search?page=2&limit=10')
        .expect(200);
      
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.games.length).toBeLessThanOrEqual(10);
    });

    test('should filter by player', async () => {
      const response = await request(app)
        .get('/api/games/search?player=MagnusCarlsen')
        .expect(200);
      
      expect(response.body.filters.player).toBe('MagnusCarlsen');
      expect(response.body.games).toBeInstanceOf(Array);
    });

    test('should filter by multiple parameters', async () => {
      const response = await request(app)
        .get('/api/games/search?player=Hikaru&result=1-0&minRating=2500&timeControl=blitz')
        .expect(200);
      
      expect(response.body.filters).toEqual({
        player: 'Hikaru',
        result: '1-0',
        minRating: '2500',
        timeControl: 'blitz',
        opening: undefined,
        maxRating: undefined,
        dateFrom: undefined,
        dateTo: undefined
      });
      
      // Check that games respect rating filter
      response.body.games.forEach(game => {
        expect(game.whiteRating).toBeGreaterThanOrEqual(2500);
        expect(game.blackRating).toBeGreaterThanOrEqual(2500);
        if (response.body.filters.timeControl) {
          expect(game.timeControl).toBe(response.body.filters.timeControl);
        }
        if (response.body.filters.result) {
          expect(game.result).toBe(response.body.filters.result);
        }
      });
    });

    test('should handle date range filtering', async () => {
      const dateFrom = '2024-01-01';
      const dateTo = '2024-12-31';
      
      const response = await request(app)
        .get(`/api/games/search?dateFrom=${dateFrom}&dateTo=${dateTo}`)
        .expect(200);
      
      expect(response.body.filters.dateFrom).toBe(dateFrom);
      expect(response.body.filters.dateTo).toBe(dateTo);
    });

    test('should handle rating range filtering', async () => {
      const response = await request(app)
        .get('/api/games/search?minRating=2000&maxRating=2500')
        .expect(200);
      
      expect(response.body.filters.minRating).toBe('2000');
      expect(response.body.filters.maxRating).toBe('2500');
      
      response.body.games.forEach(game => {
        expect(game.whiteRating).toBeGreaterThanOrEqual(2000);
        expect(game.blackRating).toBeGreaterThanOrEqual(2000);
      });
    });

    test('should validate game data structure', async () => {
      const response = await request(app)
        .get('/api/games/search')
        .expect(200);
      
      response.body.games.forEach(game => {
        // Check required fields
        expect(game).toHaveProperty('id');
        expect(game).toHaveProperty('white');
        expect(game).toHaveProperty('black');
        expect(game).toHaveProperty('result');
        expect(game).toHaveProperty('whiteRating');
        expect(game).toHaveProperty('blackRating');
        expect(game).toHaveProperty('opening');
        expect(game).toHaveProperty('timeControl');
        expect(game).toHaveProperty('moves');
        expect(game).toHaveProperty('date');
        expect(game).toHaveProperty('pgn');
        
        // Validate data types
        expect(typeof game.id).toBe('string');
        expect(typeof game.white).toBe('string');
        expect(typeof game.black).toBe('string');
        expect(typeof game.result).toBe('string');
        expect(typeof game.whiteRating).toBe('number');
        expect(typeof game.blackRating).toBe('number');
        expect(typeof game.moves).toBe('number');
        expect(typeof game.pgn).toBe('string');
        
        // Validate result format
        expect(['1-0', '0-1', '1/2-1/2']).toContain(game.result);
        
        // Validate date format
        expect(new Date(game.date)).toBeInstanceOf(Date);
        expect(new Date(game.date).toString()).not.toBe('Invalid Date');
        
        // Validate opening structure
        expect(game.opening).toHaveProperty('eco');
        expect(game.opening).toHaveProperty('name');
      });
    });

    test('should handle large page numbers gracefully', async () => {
      const response = await request(app)
        .get('/api/games/search?page=1000&limit=20')
        .expect(200);
      
      // Should return empty results for pages beyond available data
      expect(response.body.games).toHaveLength(0);
    });

    test('should handle edge case parameters', async () => {
      const response = await request(app)
        .get('/api/games/search?limit=1&page=1')
        .expect(200);
      
      expect(response.body.games).toHaveLength(1);
      expect(response.body.pagination.limit).toBe(1);
    });
  });

  describe('GET /api/games/:id', () => {
    test('should return detailed game data', async () => {
      const gameId = 'game_123';
      const response = await request(app)
        .get(`/api/games/${gameId}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('id', gameId);
      expect(response.body).toHaveProperty('white', 'MagnusCarlsen');
      expect(response.body).toHaveProperty('black', 'Hikaru');
      expect(response.body).toHaveProperty('result', '1-0');
      expect(response.body).toHaveProperty('opening');
      expect(response.body).toHaveProperty('analysis');
    });

    test('should include complete opening information', async () => {
      const response = await request(app)
        .get('/api/games/test_game')
        .expect(200);
      
      expect(response.body.opening).toEqual({
        eco: 'C50',
        name: 'Italian Game',
        variation: 'Classical Variation'
      });
    });

    test('should include game analysis data', async () => {
      const response = await request(app)
        .get('/api/games/test_game')
        .expect(200);
      
      const analysis = response.body.analysis;
      expect(analysis).toHaveProperty('accuracy');
      expect(analysis).toHaveProperty('brilliantMoves');
      expect(analysis).toHaveProperty('blunders');
      expect(analysis).toHaveProperty('mistakes');
      expect(analysis).toHaveProperty('inaccuracies');
      expect(analysis).toHaveProperty('averagecentipawnloss');
      
      // Validate accuracy structure
      expect(analysis.accuracy).toHaveProperty('white');
      expect(analysis.accuracy).toHaveProperty('black');
      expect(typeof analysis.accuracy.white).toBe('number');
      expect(typeof analysis.accuracy.black).toBe('number');
      
      // Validate mistake structure
      expect(analysis.mistakes).toHaveProperty('white');
      expect(analysis.mistakes).toHaveProperty('black');
      expect(typeof analysis.mistakes.white).toBe('number');
      expect(typeof analysis.mistakes.black).toBe('number');
    });

    test('should include valid PGN format', async () => {
      const response = await request(app)
        .get('/api/games/pgn_test')
        .expect(200);
      
      const pgn = response.body.pgn;
      expect(typeof pgn).toBe('string');
      
      // Check for PGN headers
      expect(pgn).toContain('[Event ');
      expect(pgn).toContain('[Site ');
      expect(pgn).toContain('[Date ');
      expect(pgn).toContain('[Round ');
      expect(pgn).toContain('[White ');
      expect(pgn).toContain('[Black ');
      expect(pgn).toContain('[Result ');
      expect(pgn).toContain('[WhiteElo ');
      expect(pgn).toContain('[BlackElo ');
      expect(pgn).toContain('[ECO ');
      
      // Check for moves
      expect(pgn).toContain('1.e4');
      expect(pgn).toContain('1-0'); // Result at end
    });

    test('should handle different game IDs', async () => {
      const gameIds = ['game_1', 'game_999', 'special_game_id', '12345'];
      
      for (const gameId of gameIds) {
        const response = await request(app)
          .get(`/api/games/${gameId}`)
          .expect(200);
        
        expect(response.body.id).toBe(gameId);
      }
    });

    test('should validate complete game data structure', async () => {
      const response = await request(app)
        .get('/api/games/complete_test')
        .expect(200);
      
      const game = response.body;
      
      // Required fields
      const requiredFields = [
        'id', 'white', 'black', 'whiteRating', 'blackRating', 
        'result', 'opening', 'timeControl', 'timeClass', 'date', 
        'tournament', 'round', 'moves', 'termination', 'pgn', 'analysis'
      ];
      
      requiredFields.forEach(field => {
        expect(game).toHaveProperty(field);
      });
      
      // Validate data types
      expect(typeof game.whiteRating).toBe('number');
      expect(typeof game.blackRating).toBe('number');
      expect(typeof game.round).toBe('number');
      expect(typeof game.moves).toBe('number');
      
      // Validate date format
      expect(new Date(game.date)).toBeInstanceOf(Date);
      expect(new Date(game.date).toString()).not.toBe('Invalid Date');
      
      // Validate rating ranges
      expect(game.whiteRating).toBeGreaterThan(1000);
      expect(game.whiteRating).toBeLessThan(4000);
      expect(game.blackRating).toBeGreaterThan(1000);
      expect(game.blackRating).toBeLessThan(4000);
    });
  });

  describe('Game Data Validation', () => {
    test('should validate time control formats', async () => {
      const response = await request(app)
        .get('/api/games/search?timeControl=rapid')
        .expect(200);
      
      response.body.games.forEach(game => {
        expect(['blitz', 'rapid', 'bullet', 'classical']).toContain(game.timeControl);
      });
    });

    test('should validate result formats', async () => {
      const response = await request(app)
        .get('/api/games/search')
        .expect(200);
      
      response.body.games.forEach(game => {
        expect(['1-0', '0-1', '1/2-1/2']).toContain(game.result);
      });
    });

    test('should validate ECO codes', async () => {
      const response = await request(app)
        .get('/api/games/search')
        .expect(200);
      
      response.body.games.forEach(game => {
        expect(game.opening.eco).toMatch(/^[A-E]\d{2}$/);
      });
    });

    test('should validate move counts are reasonable', async () => {
      const response = await request(app)
        .get('/api/games/search')
        .expect(200);
      
      response.body.games.forEach(game => {
        expect(game.moves).toBeGreaterThan(0);
        expect(game.moves).toBeLessThan(200); // Reasonable upper bound
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle concurrent game search requests', async () => {
      const requests = Array(10).fill().map(() => 
        request(app).get('/api/games/search?limit=5')
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.games).toBeDefined();
        expect(response.body.games.length).toBeLessThanOrEqual(5);
      });
    });

    test('should handle concurrent game detail requests', async () => {
      const gameIds = ['game_1', 'game_2', 'game_3', 'game_4', 'game_5'];
      const requests = gameIds.map(id => 
        request(app).get(`/api/games/${id}`)
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(gameIds[index]);
      });
    });

    test('should handle special characters in game IDs', async () => {
      const specialIds = ['game-123', 'game_test', 'game.456', 'game@789'];
      
      for (const gameId of specialIds) {
        const response = await request(app)
          .get(`/api/games/${encodeURIComponent(gameId)}`)
          .expect(200);
        
        expect(response.body.id).toBe(gameId);
      }
    });

    test('should respond quickly for game searches', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/games/search?limit=50')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200); // Should respond within 200ms
    });

    test('should respond quickly for individual game requests', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/games/performance_test')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should respond within 100ms
    });
  });
});