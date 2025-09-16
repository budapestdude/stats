const request = require('supertest');
const axios = require('axios');
const express = require('express');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('Tournament Endpoints', () => {
  let app;
  
  beforeEach(() => {
    // Create a minimal Express app for testing
    app = express();
    app.use(express.json());
    
    // Mock the tournament endpoints from simple-server.js
    const LICHESS_API = 'https://lichess.org/api';
    
    // Get tournaments list
    app.get('/api/tournaments', (req, res) => {
      res.json({
        upcoming: [
          {
            id: 1,
            name: 'Tata Steel Chess Tournament 2024',
            location: 'Wijk aan Zee, Netherlands',
            startDate: '2024-01-13',
            endDate: '2024-01-28',
            format: 'Round Robin',
            category: 21,
            players: 14,
            prize: '$100,000',
            status: 'upcoming'
          },
          {
            id: 2,
            name: 'Candidates Tournament 2024',
            location: 'Toronto, Canada',
            startDate: '2024-04-03',
            endDate: '2024-04-22',
            format: 'Double Round Robin',
            category: 22,
            players: 8,
            prize: '$500,000',
            status: 'upcoming'
          }
        ],
        ongoing: [
          {
            id: 4,
            name: 'Chess.com Rapid Championship',
            location: 'Online',
            startDate: '2024-01-08',
            endDate: '2024-01-10',
            format: 'Swiss',
            rounds: 11,
            players: 256,
            prize: '$50,000',
            status: 'ongoing',
            currentRound: 7
          }
        ],
        recent: [
          {
            id: 6,
            name: 'World Chess Championship 2023',
            location: 'Astana, Kazakhstan',
            startDate: '2023-04-07',
            endDate: '2023-05-01',
            format: 'Match',
            winner: 'Ding Liren',
            runnerUp: 'Ian Nepomniachtchi',
            prize: '$2,000,000',
            status: 'completed'
          }
        ]
      });
    });

    // Get Lichess tournaments (must come before /:name route)
    app.get('/api/tournaments/lichess', async (req, res) => {
      try {
        const { status = 'started' } = req.query;
        
        const response = await axios.get(`${LICHESS_API}/tournament`, {
          headers: { 
            'Accept': 'application/x-ndjson',
            'User-Agent': 'Chess Stats App'
          }
        });
        
        // Parse NDJSON response
        const tournaments = response.data
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(Boolean)
          .map(t => ({
            id: t.id,
            name: t.fullName || t.name,
            status: t.status,
            variant: t.variant.name,
            startsAt: t.startsAt,
            finishesAt: t.finishesAt,
            nbPlayers: t.nbPlayers,
            clock: t.clock,
            rated: t.rated,
            winner: t.winner,
            url: `https://lichess.org/tournament/${t.id}`
          }));
        
        res.json({
          source: 'lichess',
          tournaments: tournaments.slice(0, 20)
        });
      } catch (error) {
        console.error('Error fetching Lichess tournaments:', error.message);
        res.status(500).json({ error: 'Failed to fetch tournaments' });
      }
    });

    // Search tournaments
    app.get('/api/tournaments/search', (req, res) => {
      const { q } = req.query;
      
      if (!q && q !== '') {
        return res.status(400).json({ error: 'Query parameter is required' });
      }
      
      // Mock tournament search results
      const mockTournaments = [
        { name: 'World Chess Championship', games_count: 1234, location: 'Global', start_date: '2023-04-07' },
        { name: 'Candidates Tournament', games_count: 987, location: 'Toronto', start_date: '2024-04-03' },
        { name: 'Tata Steel Chess', games_count: 876, location: 'Netherlands', start_date: '2024-01-13' },
        { name: 'Sinquefield Cup', games_count: 654, location: 'St. Louis', start_date: '2023-08-20' },
        { name: 'Norway Chess', games_count: 543, location: 'Stavanger', start_date: '2024-05-27' }
      ];
      
      const filtered = mockTournaments.filter(t => 
        t.name.toLowerCase().includes(q.toLowerCase())
      );
      
      res.json(filtered);
    });

    // Get tournament by name/ID
    app.get('/api/tournaments/:name', (req, res) => {
      const tournamentName = decodeURIComponent(req.params.name);
      
      // Mock detailed tournament data
      res.json({
        name: tournamentName,
        games_count: 1234,
        location: 'Mock Location',
        start_date: '2024-01-01',
        end_date: '2024-01-15',
        format: 'Round Robin',
        players: [
          { name: 'Magnus Carlsen', score: 7.5, games: 9, wins: 6, draws: 3, losses: 0, performance: 2950 },
          { name: 'Fabiano Caruana', score: 6.5, games: 9, wins: 5, draws: 3, losses: 1, performance: 2875 },
          { name: 'Hikaru Nakamura', score: 6.0, games: 9, wins: 4, draws: 4, losses: 1, performance: 2825 },
          { name: 'Ding Liren', score: 5.5, games: 9, wins: 3, draws: 5, losses: 1, performance: 2800 }
        ],
        stats: {
          totalGames: 1234,
          decisiveRate: 65,
          averageLength: 42,
          mostCommonOpening: 'Italian Game',
          longestGame: 127,
          shortestDecisive: 18,
          upsets: 3
        }
      });
    });

  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tournaments', () => {
    test('should return tournaments organized by status', async () => {
      const response = await request(app)
        .get('/api/tournaments')
        .expect(200);
      
      expect(response.body).toHaveProperty('upcoming');
      expect(response.body).toHaveProperty('ongoing');
      expect(response.body).toHaveProperty('recent');
      
      expect(response.body.upcoming).toBeInstanceOf(Array);
      expect(response.body.ongoing).toBeInstanceOf(Array);
      expect(response.body.recent).toBeInstanceOf(Array);
    });

    test('should validate tournament data structure', async () => {
      const response = await request(app)
        .get('/api/tournaments')
        .expect(200);
      
      const allTournaments = [
        ...response.body.upcoming,
        ...response.body.ongoing,
        ...response.body.recent
      ];
      
      allTournaments.forEach(tournament => {
        expect(tournament).toHaveProperty('id');
        expect(tournament).toHaveProperty('name');
        expect(tournament).toHaveProperty('location');
        expect(tournament).toHaveProperty('startDate');
        expect(tournament).toHaveProperty('format');
        expect(tournament).toHaveProperty('status');
        
        // Validate data types
        expect(typeof tournament.id).toBe('number');
        expect(typeof tournament.name).toBe('string');
        expect(typeof tournament.location).toBe('string');
        expect(typeof tournament.startDate).toBe('string');
        expect(typeof tournament.format).toBe('string');
        expect(typeof tournament.status).toBe('string');
        
        // Validate status values
        expect(['upcoming', 'ongoing', 'completed']).toContain(tournament.status);
        
        // Validate date format
        expect(tournament.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    test('should include upcoming tournaments', async () => {
      const response = await request(app)
        .get('/api/tournaments')
        .expect(200);
      
      expect(response.body.upcoming.length).toBeGreaterThan(0);
      
      response.body.upcoming.forEach(tournament => {
        expect(tournament.status).toBe('upcoming');
        expect(tournament).toHaveProperty('prize');
        expect(tournament).toHaveProperty('players');
        expect(tournament).toHaveProperty('category');
      });
    });

    test('should include ongoing tournaments with current round', async () => {
      const response = await request(app)
        .get('/api/tournaments')
        .expect(200);
      
      if (response.body.ongoing.length > 0) {
        response.body.ongoing.forEach(tournament => {
          expect(tournament.status).toBe('ongoing');
          expect(tournament).toHaveProperty('currentRound');
          expect(typeof tournament.currentRound).toBe('number');
          expect(tournament.currentRound).toBeGreaterThan(0);
        });
      }
    });

    test('should include completed tournaments with winners', async () => {
      const response = await request(app)
        .get('/api/tournaments')
        .expect(200);
      
      if (response.body.recent.length > 0) {
        response.body.recent.forEach(tournament => {
          expect(tournament.status).toBe('completed');
          expect(tournament).toHaveProperty('winner');
          expect(typeof tournament.winner).toBe('string');
        });
      }
    });
  });

  describe('GET /api/tournaments/search', () => {
    test('should search tournaments by name', async () => {
      const response = await request(app)
        .get('/api/tournaments/search?q=World')
        .expect(200);
      
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      
      response.body.forEach(tournament => {
        expect(tournament.name.toLowerCase()).toContain('world');
      });
    });

    test('should return empty array for no matches', async () => {
      const response = await request(app)
        .get('/api/tournaments/search?q=NonexistentTournament')
        .expect(200);
      
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(0);
    });

    test('should require query parameter', async () => {
      const response = await request(app)
        .get('/api/tournaments/search')
        .expect(400);
      
      expect(response.body).toHaveProperty('error', 'Query parameter is required');
    });

    test('should handle case insensitive search', async () => {
      const response = await request(app)
        .get('/api/tournaments/search?q=TATA')
        .expect(200);
      
      expect(response.body.length).toBeGreaterThan(0);
      response.body.forEach(tournament => {
        expect(tournament.name.toLowerCase()).toContain('tata');
      });
    });

    test('should return tournament data with all required fields', async () => {
      const response = await request(app)
        .get('/api/tournaments/search?q=Chess')
        .expect(200);
      
      response.body.forEach(tournament => {
        expect(tournament).toHaveProperty('name');
        expect(tournament).toHaveProperty('games_count');
        expect(tournament).toHaveProperty('location');
        expect(tournament).toHaveProperty('start_date');
        
        expect(typeof tournament.name).toBe('string');
        expect(typeof tournament.games_count).toBe('number');
        expect(tournament.games_count).toBeGreaterThan(0);
      });
    });

    test('should handle partial matches', async () => {
      const response = await request(app)
        .get('/api/tournaments/search?q=Tou')
        .expect(200);
      
      expect(response.body.length).toBeGreaterThan(0);
      response.body.forEach(tournament => {
        expect(tournament.name.toLowerCase()).toContain('tou');
      });
    });
  });

  describe('GET /api/tournaments/:name', () => {
    test('should return detailed tournament information', async () => {
      const tournamentName = 'World Chess Championship 2023';
      const response = await request(app)
        .get(`/api/tournaments/${encodeURIComponent(tournamentName)}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('name', tournamentName);
      expect(response.body).toHaveProperty('games_count');
      expect(response.body).toHaveProperty('location');
      expect(response.body).toHaveProperty('start_date');
      expect(response.body).toHaveProperty('end_date');
      expect(response.body).toHaveProperty('players');
      expect(response.body).toHaveProperty('stats');
    });

    test('should include player standings', async () => {
      const response = await request(app)
        .get('/api/tournaments/Test Tournament')
        .expect(200);
      
      expect(response.body.players).toBeInstanceOf(Array);
      expect(response.body.players.length).toBeGreaterThan(0);
      
      response.body.players.forEach(player => {
        expect(player).toHaveProperty('name');
        expect(player).toHaveProperty('score');
        expect(player).toHaveProperty('games');
        expect(player).toHaveProperty('wins');
        expect(player).toHaveProperty('draws');
        expect(player).toHaveProperty('losses');
        expect(player).toHaveProperty('performance');
        
        // Validate data types
        expect(typeof player.name).toBe('string');
        expect(typeof player.score).toBe('number');
        expect(typeof player.games).toBe('number');
        expect(typeof player.wins).toBe('number');
        expect(typeof player.draws).toBe('number');
        expect(typeof player.losses).toBe('number');
        expect(typeof player.performance).toBe('number');
        
        // Validate logical constraints
        expect(player.score).toBeLessThanOrEqual(player.games);
        expect(player.wins + player.draws + player.losses).toBe(player.games);
        expect(player.performance).toBeGreaterThan(1000);
        expect(player.performance).toBeLessThan(4000);
      });
    });

    test('should include tournament statistics', async () => {
      const response = await request(app)
        .get('/api/tournaments/Statistics Test')
        .expect(200);
      
      const stats = response.body.stats;
      expect(stats).toHaveProperty('totalGames');
      expect(stats).toHaveProperty('decisiveRate');
      expect(stats).toHaveProperty('averageLength');
      expect(stats).toHaveProperty('mostCommonOpening');
      expect(stats).toHaveProperty('longestGame');
      expect(stats).toHaveProperty('shortestDecisive');
      expect(stats).toHaveProperty('upsets');
      
      // Validate stat types and ranges
      expect(typeof stats.totalGames).toBe('number');
      expect(typeof stats.decisiveRate).toBe('number');
      expect(typeof stats.averageLength).toBe('number');
      expect(typeof stats.mostCommonOpening).toBe('string');
      expect(typeof stats.longestGame).toBe('number');
      expect(typeof stats.shortestDecisive).toBe('number');
      expect(typeof stats.upsets).toBe('number');
      
      expect(stats.decisiveRate).toBeGreaterThanOrEqual(0);
      expect(stats.decisiveRate).toBeLessThanOrEqual(100);
      expect(stats.averageLength).toBeGreaterThan(0);
      expect(stats.longestGame).toBeGreaterThan(stats.shortestDecisive);
    });

    test('should handle URL-encoded tournament names', async () => {
      const tournamentName = 'Tournament with Spaces & Special Chars!';
      const response = await request(app)
        .get(`/api/tournaments/${encodeURIComponent(tournamentName)}`)
        .expect(200);
      
      expect(response.body.name).toBe(tournamentName);
    });

    test('should handle tournaments with special characters', async () => {
      const specialNames = [
        'Torneo de Ajedrez México',
        'Schach-Turnier 2024',
        'Échecs Tournament',
        'World Championship - Final'
      ];
      
      for (const name of specialNames) {
        const response = await request(app)
          .get(`/api/tournaments/${encodeURIComponent(name)}`)
          .expect(200);
        
        expect(response.body.name).toBe(name);
      }
    });
  });

  describe('GET /api/tournaments/lichess', () => {
    test('should fetch tournaments from Lichess API', async () => {
      const mockLichessResponse = {
        data: `{"id":"abc123","fullName":"Titled Arena","status":"started","variant":{"name":"Standard"},"nbPlayers":150,"clock":{"limit":180,"increment":0},"rated":true}
{"id":"def456","fullName":"Bullet Arena","status":"finished","variant":{"name":"Standard"},"nbPlayers":200,"clock":{"limit":60,"increment":0},"rated":true,"winner":{"id":"player1","name":"TestPlayer"}}`
      };
      
      mockedAxios.get.mockResolvedValue(mockLichessResponse);
      
      const response = await request(app)
        .get('/api/tournaments/lichess')
        .expect(200);
      
      expect(response.body).toHaveProperty('source', 'lichess');
      expect(response.body).toHaveProperty('tournaments');
      expect(response.body.tournaments).toBeInstanceOf(Array);
      expect(response.body.tournaments.length).toBe(2);
      
      response.body.tournaments.forEach(tournament => {
        expect(tournament).toHaveProperty('id');
        expect(tournament).toHaveProperty('name');
        expect(tournament).toHaveProperty('status');
        expect(tournament).toHaveProperty('variant');
        expect(tournament).toHaveProperty('nbPlayers');
        expect(tournament).toHaveProperty('clock');
        expect(tournament).toHaveProperty('rated');
        expect(tournament).toHaveProperty('url');
        
        expect(tournament.url).toContain('lichess.org/tournament/');
      });
    });

    test('should handle API failures gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));
      
      const response = await request(app)
        .get('/api/tournaments/lichess')
        .expect(500);
      
      expect(response.body).toHaveProperty('error', 'Failed to fetch tournaments');
    });

    test('should handle different status filters', async () => {
      const mockResponse = {
        data: `{"id":"test123","fullName":"Test Tournament","status":"created","variant":{"name":"Standard"},"nbPlayers":50,"clock":{"limit":300,"increment":0},"rated":true}`
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const response = await request(app)
        .get('/api/tournaments/lichess?status=created')
        .expect(200);
      
      expect(response.body.tournaments).toHaveLength(1);
      expect(response.body.tournaments[0].status).toBe('created');
    });

    test('should handle malformed NDJSON gracefully', async () => {
      const mockResponse = {
        data: `{"id":"valid","fullName":"Valid Tournament","status":"started","variant":{"name":"Standard"},"nbPlayers":100,"clock":{"limit":180,"increment":0},"rated":true}
invalid json line
{"id":"valid2","fullName":"Another Valid","status":"finished","variant":{"name":"Standard"},"nbPlayers":75,"clock":{"limit":300,"increment":2},"rated":false}`
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const response = await request(app)
        .get('/api/tournaments/lichess')
        .expect(200);
      
      expect(response.body.tournaments).toHaveLength(2);
      expect(response.body.tournaments[0].id).toBe('valid');
      expect(response.body.tournaments[1].id).toBe('valid2');
    });

    test('should limit results to 20 tournaments', async () => {
      // Generate 25 mock tournaments
      const mockTournaments = Array(25).fill(0).map((_, i) => 
        `{"id":"tournament${i}","fullName":"Tournament ${i}","status":"started","variant":{"name":"Standard"},"nbPlayers":${100 + i},"clock":{"limit":180,"increment":0},"rated":true}`
      );
      
      mockedAxios.get.mockResolvedValue({
        data: mockTournaments.join('\n')
      });
      
      const response = await request(app)
        .get('/api/tournaments/lichess')
        .expect(200);
      
      expect(response.body.tournaments).toHaveLength(20);
    });

    test('should include proper headers in API request', async () => {
      const mockResponse = { data: '' };
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      await request(app)
        .get('/api/tournaments/lichess')
        .expect(200);
      
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://lichess.org/api/tournament',
        {
          headers: {
            'Accept': 'application/x-ndjson',
            'User-Agent': 'Chess Stats App'
          }
        }
      );
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle concurrent tournament requests', async () => {
      const requests = Array(5).fill().map(() => 
        request(app).get('/api/tournaments')
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('upcoming');
        expect(response.body).toHaveProperty('ongoing');
        expect(response.body).toHaveProperty('recent');
      });
    });

    test('should respond quickly for tournament lists', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/tournaments')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    test('should respond quickly for tournament search', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/tournaments/search?q=Chess')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    test('should handle empty search queries gracefully', async () => {
      const response = await request(app)
        .get('/api/tournaments/search?q=')
        .expect(200);
      
      expect(response.body).toBeInstanceOf(Array);
    });

    test('should handle very long tournament names', async () => {
      const longName = 'A'.repeat(200);
      const response = await request(app)
        .get(`/api/tournaments/${encodeURIComponent(longName)}`)
        .expect(200);
      
      expect(response.body.name).toBe(longName);
    });
  });
});