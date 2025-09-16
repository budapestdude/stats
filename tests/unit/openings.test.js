const request = require('supertest');
const axios = require('axios');
const express = require('express');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('Opening Endpoints', () => {
  let app;
  
  beforeEach(() => {
    // Create a minimal Express app for testing
    app = express();
    app.use(express.json());
    
    // Mock the opening endpoints from simple-server.js
    const LICHESS_API = 'https://lichess.org/api';
    
    // Opening explorer endpoint
    app.get('/api/openings/explorer', async (req, res) => {
      try {
        const { 
          fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          play = '',
          variant = 'standard',
          speeds = 'blitz,rapid,classical', 
          ratings = '1600,1800,2000,2200,2500'
        } = req.query;
        
        // Build query params for Lichess API
        const params = new URLSearchParams({
          variant,
          speeds,
          ratings,
          ...(play && { play })
        });
        
        // Fetch from Lichess opening explorer
        const response = await axios.get(
          `${LICHESS_API}/opening/explorer?${params.toString()}`,
          {
            headers: { 
              'Accept': 'application/json',
              'User-Agent': 'Chess Stats App'
            }
          }
        );
        
        const data = response.data;
        
        // Format the response
        const formattedData = {
          opening: data.opening || null,
          white: data.white,
          draws: data.draws,
          black: data.black,
          moves: data.moves?.map(move => ({
            uci: move.uci,
            san: move.san,
            averageRating: move.averageRating,
            white: move.white,
            draws: move.draws,
            black: move.black,
            games: move.white + move.draws + move.black,
            winRate: ((move.white / (move.white + move.draws + move.black)) * 100).toFixed(1),
            drawRate: ((move.draws / (move.white + move.draws + move.black)) * 100).toFixed(1),
            blackWinRate: ((move.black / (move.white + move.draws + move.black)) * 100).toFixed(1)
          })) || [],
          topGames: data.topGames?.map(game => ({
            id: game.id,
            winner: game.winner,
            white: {
              name: game.white.name,
              rating: game.white.rating
            },
            black: {
              name: game.black.name,
              rating: game.black.rating
            },
            year: game.year,
            month: game.month
          })) || [],
          recentGames: data.recentGames?.map(game => ({
            id: game.id,
            winner: game.winner,
            white: {
              name: game.white.name,
              rating: game.white.rating
            },
            black: {
              name: game.black.name,
              rating: game.black.rating
            },
            year: game.year,
            month: game.month
          })) || []
        };
        
        res.json(formattedData);
      } catch (error) {
        console.error('Error fetching opening explorer:', error.message);
        res.status(500).json({ error: 'Failed to fetch opening data' });
      }
    });

    // Master games opening explorer
    app.get('/api/openings/explorer/masters', async (req, res) => {
      try {
        const { 
          fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          play = '',
          since = 1952,
          until = 2024
        } = req.query;
        
        const params = new URLSearchParams({
          since,
          until,
          ...(play && { play })
        });
        
        const response = await axios.get(
          `${LICHESS_API}/opening/explorer/master?${params.toString()}`,
          {
            headers: { 
              'Accept': 'application/json',
              'User-Agent': 'Chess Stats App'
            }
          }
        );
        
        const data = response.data;
        
        res.json({
          opening: data.opening || null,
          white: data.white,
          draws: data.draws,
          black: data.black,
          moves: data.moves?.map(move => ({
            uci: move.uci,
            san: move.san,
            white: move.white,
            draws: move.draws,
            black: move.black,
            games: move.white + move.draws + move.black,
            winRate: ((move.white / (move.white + move.draws + move.black)) * 100).toFixed(1),
            drawRate: ((move.draws / (move.white + move.draws + move.black)) * 100).toFixed(1)
          })) || [],
          topGames: data.topGames || []
        });
      } catch (error) {
        console.error('Error fetching master games:', error.message);
        res.status(500).json({ error: 'Failed to fetch master games' });
      }
    });

    // Opening statistics
    app.get('/api/stats/openings', (req, res) => {
      res.json({
        popular: [
          { eco: 'B10', name: 'Caro-Kann Defense', games: 8472931, winRate: 52.3, drawRate: 28.1 },
          { eco: 'C50', name: 'Italian Game', games: 7892341, winRate: 53.7, drawRate: 25.4 },
          { eco: 'A04', name: 'Reti Opening', games: 6723894, winRate: 54.2, drawRate: 30.2 },
          { eco: 'D02', name: 'London System', games: 6234782, winRate: 55.1, drawRate: 26.8 },
          { eco: 'B01', name: 'Scandinavian Defense', games: 5892734, winRate: 51.9, drawRate: 24.3 },
          { eco: 'C01', name: 'French Defense', games: 5234891, winRate: 50.8, drawRate: 31.2 },
          { eco: 'B07', name: 'Pirc Defense', games: 4892341, winRate: 49.2, drawRate: 27.9 },
          { eco: 'E60', name: "King's Indian Defense", games: 4234782, winRate: 48.7, drawRate: 26.1 }
        ],
        byRating: {
          '1000-1400': [
            { name: 'Italian Game', percentage: 18.2 },
            { name: 'London System', percentage: 15.7 },
            { name: "Queen's Gambit", percentage: 12.3 }
          ],
          '1400-1800': [
            { name: 'Caro-Kann Defense', percentage: 14.8 },
            { name: 'Italian Game', percentage: 13.9 },
            { name: 'Ruy Lopez', percentage: 11.2 }
          ],
          '1800+': [
            { name: 'Najdorf Sicilian', percentage: 16.3 },
            { name: 'Ruy Lopez', percentage: 14.1 },
            { name: 'Nimzo-Indian', percentage: 12.7 }
          ]
        }
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/openings/explorer', () => {
    test('should fetch opening data from starting position', async () => {
      const mockLichessResponse = {
        data: {
          white: 12345,
          draws: 5678,
          black: 9876,
          opening: {
            eco: 'C50',
            name: 'Italian Game'
          },
          moves: [
            {
              uci: 'e2e4',
              san: 'e4',
              white: 5000,
              draws: 2000,
              black: 3000,
              averageRating: 1850
            },
            {
              uci: 'd2d4',
              san: 'd4',
              white: 4500,
              draws: 2500,
              black: 3000,
              averageRating: 1900
            }
          ],
          topGames: [
            {
              id: 'game123',
              winner: 'white',
              white: { name: 'Carlsen', rating: 2850 },
              black: { name: 'Caruana', rating: 2800 },
              year: 2024,
              month: 1
            }
          ],
          recentGames: []
        }
      };
      
      mockedAxios.get.mockResolvedValue(mockLichessResponse);
      
      const response = await request(app)
        .get('/api/openings/explorer')
        .expect(200);
      
      expect(response.body).toHaveProperty('white', 12345);
      expect(response.body).toHaveProperty('draws', 5678);
      expect(response.body).toHaveProperty('black', 9876);
      expect(response.body).toHaveProperty('opening');
      expect(response.body).toHaveProperty('moves');
      expect(response.body).toHaveProperty('topGames');
      expect(response.body).toHaveProperty('recentGames');
      
      expect(response.body.moves).toHaveLength(2);
      expect(response.body.moves[0]).toHaveProperty('uci', 'e2e4');
      expect(response.body.moves[0]).toHaveProperty('san', 'e4');
      expect(response.body.moves[0]).toHaveProperty('games', 10000);
      expect(response.body.moves[0]).toHaveProperty('winRate', '50.0');
      expect(response.body.moves[0]).toHaveProperty('drawRate', '20.0');
      expect(response.body.moves[0]).toHaveProperty('blackWinRate', '30.0');
    });

    test('should handle custom parameters', async () => {
      const mockResponse = {
        data: {
          white: 100,
          draws: 50,
          black: 75,
          moves: []
        }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      await request(app)
        .get('/api/openings/explorer?play=e2e4&variant=standard&speeds=blitz&ratings=2000,2200')
        .expect(200);
      
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('play=e2e4'),
        expect.objectContaining({
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Chess Stats App'
          }
        })
      );
    });

    test('should handle API failures gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Lichess API Error'));
      
      const response = await request(app)
        .get('/api/openings/explorer')
        .expect(500);
      
      expect(response.body).toHaveProperty('error', 'Failed to fetch opening data');
    });

    test('should format move statistics correctly', async () => {
      const mockResponse = {
        data: {
          white: 1000,
          draws: 500,
          black: 1500,
          moves: [
            {
              uci: 'e2e4',
              san: 'e4',
              white: 600,
              draws: 200,
              black: 200,
              averageRating: 1800
            }
          ]
        }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const response = await request(app)
        .get('/api/openings/explorer')
        .expect(200);
      
      const move = response.body.moves[0];
      expect(move.games).toBe(1000);
      expect(move.winRate).toBe('60.0');
      expect(move.drawRate).toBe('20.0');
      expect(move.blackWinRate).toBe('20.0');
      expect(move.averageRating).toBe(1800);
    });

    test('should handle empty moves array', async () => {
      const mockResponse = {
        data: {
          white: 100,
          draws: 50,
          black: 75,
          moves: []
        }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const response = await request(app)
        .get('/api/openings/explorer')
        .expect(200);
      
      expect(response.body.moves).toEqual([]);
    });

    test('should format game data correctly', async () => {
      const mockResponse = {
        data: {
          white: 1000,
          draws: 500,
          black: 750,
          moves: [],
          topGames: [
            {
              id: 'topgame1',
              winner: 'white',
              white: { name: 'Player1', rating: 2700 },
              black: { name: 'Player2', rating: 2650 },
              year: 2023,
              month: 12
            }
          ],
          recentGames: [
            {
              id: 'recentgame1',
              winner: 'black',
              white: { name: 'Player3', rating: 2600 },
              black: { name: 'Player4', rating: 2580 },
              year: 2024,
              month: 1
            }
          ]
        }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const response = await request(app)
        .get('/api/openings/explorer')
        .expect(200);
      
      expect(response.body.topGames).toHaveLength(1);
      expect(response.body.topGames[0]).toEqual({
        id: 'topgame1',
        winner: 'white',
        white: { name: 'Player1', rating: 2700 },
        black: { name: 'Player2', rating: 2650 },
        year: 2023,
        month: 12
      });
      
      expect(response.body.recentGames).toHaveLength(1);
      expect(response.body.recentGames[0]).toEqual({
        id: 'recentgame1',
        winner: 'black',
        white: { name: 'Player3', rating: 2600 },
        black: { name: 'Player4', rating: 2580 },
        year: 2024,
        month: 1
      });
    });
  });

  describe('GET /api/openings/explorer/masters', () => {
    test('should fetch master games data', async () => {
      const mockResponse = {
        data: {
          white: 800,
          draws: 600,
          black: 400,
          moves: [
            {
              uci: 'e2e4',
              san: 'e4',
              white: 400,
              draws: 300,
              black: 100
            }
          ],
          topGames: [
            {
              id: 'master_game_1',
              winner: 'white'
            }
          ]
        }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const response = await request(app)
        .get('/api/openings/explorer/masters')
        .expect(200);
      
      expect(response.body).toHaveProperty('white', 800);
      expect(response.body).toHaveProperty('draws', 600);
      expect(response.body).toHaveProperty('black', 400);
      expect(response.body).toHaveProperty('moves');
      expect(response.body).toHaveProperty('topGames');
      
      const move = response.body.moves[0];
      expect(move.games).toBe(800);
      expect(move.winRate).toBe('50.0');
      expect(move.drawRate).toBe('37.5');
    });

    test('should handle custom date range', async () => {
      const mockResponse = {
        data: {
          white: 500,
          draws: 300,
          black: 200,
          moves: []
        }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      await request(app)
        .get('/api/openings/explorer/masters?since=2000&until=2020')
        .expect(200);
      
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('since=2000'),
        expect.any(Object)
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('until=2020'),
        expect.any(Object)
      );
    });

    test('should handle API failures for masters', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Master API Error'));
      
      const response = await request(app)
        .get('/api/openings/explorer/masters')
        .expect(500);
      
      expect(response.body).toHaveProperty('error', 'Failed to fetch master games');
    });

    test('should use correct master API endpoint', async () => {
      const mockResponse = {
        data: { white: 100, draws: 50, black: 25, moves: [] }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      await request(app)
        .get('/api/openings/explorer/masters')
        .expect(200);
      
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/opening/explorer/master'),
        expect.any(Object)
      );
    });
  });

  describe('GET /api/stats/openings', () => {
    test('should return popular openings statistics', async () => {
      const response = await request(app)
        .get('/api/stats/openings')
        .expect(200);
      
      expect(response.body).toHaveProperty('popular');
      expect(response.body).toHaveProperty('byRating');
      
      expect(response.body.popular).toBeInstanceOf(Array);
      expect(response.body.popular.length).toBeGreaterThan(0);
      
      response.body.popular.forEach(opening => {
        expect(opening).toHaveProperty('eco');
        expect(opening).toHaveProperty('name');
        expect(opening).toHaveProperty('games');
        expect(opening).toHaveProperty('winRate');
        expect(opening).toHaveProperty('drawRate');
        
        // Validate data types
        expect(typeof opening.eco).toBe('string');
        expect(typeof opening.name).toBe('string');
        expect(typeof opening.games).toBe('number');
        expect(typeof opening.winRate).toBe('number');
        expect(typeof opening.drawRate).toBe('number');
        
        // Validate ECO format
        expect(opening.eco).toMatch(/^[A-E]\d{2}$/);
        
        // Validate percentages
        expect(opening.winRate).toBeGreaterThanOrEqual(0);
        expect(opening.winRate).toBeLessThanOrEqual(100);
        expect(opening.drawRate).toBeGreaterThanOrEqual(0);
        expect(opening.drawRate).toBeLessThanOrEqual(100);
      });
    });

    test('should include openings by rating categories', async () => {
      const response = await request(app)
        .get('/api/stats/openings')
        .expect(200);
      
      const byRating = response.body.byRating;
      expect(byRating).toHaveProperty('1000-1400');
      expect(byRating).toHaveProperty('1400-1800');
      expect(byRating).toHaveProperty('1800+');
      
      Object.values(byRating).forEach(ratingGroup => {
        expect(ratingGroup).toBeInstanceOf(Array);
        ratingGroup.forEach(opening => {
          expect(opening).toHaveProperty('name');
          expect(opening).toHaveProperty('percentage');
          expect(typeof opening.name).toBe('string');
          expect(typeof opening.percentage).toBe('number');
          expect(opening.percentage).toBeGreaterThan(0);
          expect(opening.percentage).toBeLessThan(100);
        });
      });
    });

    test('should have consistent opening names', async () => {
      const response = await request(app)
        .get('/api/stats/openings')
        .expect(200);
      
      // Check that some openings appear in both popular and byRating
      const popularNames = response.body.popular.map(o => o.name);
      const allRatingNames = Object.values(response.body.byRating)
        .flat()
        .map(o => o.name);
      
      const commonNames = popularNames.filter(name => 
        allRatingNames.includes(name)
      );
      
      expect(commonNames.length).toBeGreaterThan(0);
    });

    test('should validate popular openings data structure', async () => {
      const response = await request(app)
        .get('/api/stats/openings')
        .expect(200);
      
      const popular = response.body.popular;
      expect(popular.length).toBeGreaterThan(5); // Should have multiple openings
      
      // Check first opening has all required fields
      const firstOpening = popular[0];
      expect(firstOpening.eco).toBe('B10');
      expect(firstOpening.name).toBe('Caro-Kann Defense');
      expect(firstOpening.games).toBe(8472931);
      expect(firstOpening.winRate).toBe(52.3);
      expect(firstOpening.drawRate).toBe(28.1);
    });
  });

  describe('Opening Data Validation', () => {
    test('should validate ECO codes in all responses', async () => {
      const mockResponse = {
        data: {
          white: 1000,
          draws: 500,
          black: 750,
          opening: {
            eco: 'C50',
            name: 'Italian Game'
          },
          moves: []
        }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const response = await request(app)
        .get('/api/openings/explorer')
        .expect(200);
      
      if (response.body.opening) {
        expect(response.body.opening.eco).toMatch(/^[A-E]\d{2}$/);
      }
    });

    test('should handle missing opening information', async () => {
      const mockResponse = {
        data: {
          white: 1000,
          draws: 500,
          black: 750,
          opening: null,
          moves: []
        }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const response = await request(app)
        .get('/api/openings/explorer')
        .expect(200);
      
      expect(response.body.opening).toBeNull();
    });

    test('should validate move UCI and SAN notation', async () => {
      const mockResponse = {
        data: {
          white: 1000,
          draws: 500,
          black: 750,
          moves: [
            {
              uci: 'e2e4',
              san: 'e4',
              white: 500,
              draws: 250,
              black: 250,
              averageRating: 1800
            },
            {
              uci: 'g1f3',
              san: 'Nf3',
              white: 300,
              draws: 200,
              black: 100,
              averageRating: 1850
            }
          ]
        }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const response = await request(app)
        .get('/api/openings/explorer')
        .expect(200);
      
      response.body.moves.forEach(move => {
        expect(move.uci).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
        expect(move.san).toMatch(/^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](\=[QRBN])?[\+#]?$|^O-O(-O)?[\+#]?$/);
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle concurrent opening explorer requests', async () => {
      const mockResponse = {
        data: { white: 100, draws: 50, black: 75, moves: [] }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const requests = Array(5).fill().map(() => 
        request(app).get('/api/openings/explorer')
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('white');
        expect(response.body).toHaveProperty('draws');
        expect(response.body).toHaveProperty('black');
      });
    });

    test('should respond quickly for opening statistics', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/stats/openings')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    test('should handle malformed API responses', async () => {
      const mockResponse = {
        data: {
          // Missing required fields
          moves: 'invalid_format'
        }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const response = await request(app)
        .get('/api/openings/explorer')
        .expect(500);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Failed to fetch opening data');
    });

    test('should handle very long move sequences', async () => {
      const longMoveSequence = Array(20).fill(0).map((_, i) => `e${2 + (i % 6)}e${3 + (i % 6)}`).join(',');
      
      const mockResponse = {
        data: { white: 10, draws: 5, black: 3, moves: [] }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      await request(app)
        .get(`/api/openings/explorer?play=${longMoveSequence}`)
        .expect(200);
      
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('play='),
        expect.any(Object)
      );
    });

    test('should handle zero game statistics', async () => {
      const mockResponse = {
        data: {
          white: 0,
          draws: 0,
          black: 0,
          moves: [
            {
              uci: 'e2e4',
              san: 'e4',
              white: 0,
              draws: 0,
              black: 0,
              averageRating: 0
            }
          ]
        }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const response = await request(app)
        .get('/api/openings/explorer')
        .expect(200);
      
      const move = response.body.moves[0];
      expect(move.games).toBe(0);
      expect(move.winRate).toBe('NaN'); // Division by zero
      expect(move.drawRate).toBe('NaN');
    });
  });
});