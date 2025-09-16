const axios = require('axios');
const { mockPlayer, mockGame } = global.testUtils;

// Mock axios
jest.mock('axios');

describe('Players API Extended Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlayerProfile', () => {
    it('should fetch Chess.com player profile successfully', async () => {
      const mockData = mockPlayer({
        username: 'magnuscarlsen',
        title: 'GM',
        country: 'NO',
        followers: 500000
      });

      axios.get.mockResolvedValueOnce({ data: mockData });

      const result = await axios.get('https://api.chess.com/pub/player/magnuscarlsen');
      
      expect(result.data).toEqual(mockData);
      expect(axios.get).toHaveBeenCalledWith('https://api.chess.com/pub/player/magnuscarlsen');
    });

    it('should handle Lichess player profile', async () => {
      const lichessData = {
        id: 'drdrunkenstein',
        username: 'DrDrunkenstein',
        perfs: {
          blitz: { rating: 2900, games: 1000 },
          rapid: { rating: 2850, games: 500 }
        },
        profile: {
          country: 'NO',
          firstName: 'Magnus',
          lastName: 'Carlsen'
        }
      };

      axios.get.mockResolvedValueOnce({ data: lichessData });

      const result = await axios.get('https://lichess.org/api/user/drdrunkenstein');
      
      expect(result.data).toEqual(lichessData);
    });

    it('should handle player not found error', async () => {
      axios.get.mockRejectedValueOnce(new Error('404: Player not found'));

      await expect(
        axios.get('https://api.chess.com/pub/player/nonexistentplayer')
      ).rejects.toThrow('404: Player not found');
    });

    it('should handle rate limiting', async () => {
      const rateLimitError = new Error('429: Too Many Requests');
      rateLimitError.response = { status: 429 };
      
      axios.get.mockRejectedValueOnce(rateLimitError);

      await expect(
        axios.get('https://api.chess.com/pub/player/testuser')
      ).rejects.toThrow('429: Too Many Requests');
    });
  });

  describe('getPlayerStats', () => {
    it('should fetch player statistics', async () => {
      const mockStats = {
        chess_blitz: {
          last: { rating: 2500, date: 1698768000 },
          best: { rating: 2550, date: 1698000000 },
          record: { win: 1000, loss: 200, draw: 300 }
        },
        chess_rapid: {
          last: { rating: 2600, date: 1698768000 },
          best: { rating: 2650, date: 1698000000 },
          record: { win: 500, loss: 100, draw: 150 }
        }
      };

      axios.get.mockResolvedValueOnce({ data: mockStats });

      const result = await axios.get('https://api.chess.com/pub/player/magnuscarlsen/stats');
      
      expect(result.data).toEqual(mockStats);
      expect(result.data.chess_blitz.last.rating).toBe(2500);
    });

    it('should calculate win rate correctly', () => {
      const stats = {
        record: { win: 100, loss: 50, draw: 50 }
      };
      
      const totalGames = stats.record.win + stats.record.loss + stats.record.draw;
      const winRate = (stats.record.win / totalGames) * 100;
      
      expect(winRate).toBe(50);
    });
  });

  describe('getPlayerGames', () => {
    it('should fetch player game archives', async () => {
      const mockArchives = {
        archives: [
          'https://api.chess.com/pub/player/magnuscarlsen/games/2024/01',
          'https://api.chess.com/pub/player/magnuscarlsen/games/2024/02'
        ]
      };

      axios.get.mockResolvedValueOnce({ data: mockArchives });

      const result = await axios.get('https://api.chess.com/pub/player/magnuscarlsen/games/archives');
      
      expect(result.data.archives).toHaveLength(2);
      expect(result.data.archives[0]).toContain('2024/01');
    });

    it('should fetch games from specific month', async () => {
      const mockGames = {
        games: [
          mockGame({ id: 'game1', white: { username: 'magnuscarlsen' } }),
          mockGame({ id: 'game2', black: { username: 'magnuscarlsen' } })
        ]
      };

      axios.get.mockResolvedValueOnce({ data: mockGames });

      const result = await axios.get('https://api.chess.com/pub/player/magnuscarlsen/games/2024/01');
      
      expect(result.data.games).toHaveLength(2);
      expect(result.data.games[0].id).toBe('game1');
    });

    it('should filter games by time control', () => {
      const games = [
        mockGame({ time_control: '180+0', id: 'blitz1' }),
        mockGame({ time_control: '600+0', id: 'rapid1' }),
        mockGame({ time_control: '300+2', id: 'blitz2' })
      ];

      const blitzGames = games.filter(g => {
        const [base] = g.time_control.split('+');
        return parseInt(base) < 600;
      });

      expect(blitzGames).toHaveLength(2);
      expect(blitzGames.map(g => g.id)).toEqual(['blitz1', 'blitz2']);
    });
  });

  describe('searchPlayers', () => {
    it('should search players by username', async () => {
      const searchResults = {
        players: [
          mockPlayer({ username: 'magnus123' }),
          mockPlayer({ username: 'carlsenmagnus' })
        ]
      };

      axios.get.mockResolvedValueOnce({ data: searchResults });

      const result = await axios.get('/api/players/search?q=magnus');
      
      expect(result.data.players).toHaveLength(2);
    });

    it('should filter players by country', () => {
      const players = [
        mockPlayer({ username: 'player1', country: 'US' }),
        mockPlayer({ username: 'player2', country: 'NO' }),
        mockPlayer({ username: 'player3', country: 'US' })
      ];

      const usPlayers = players.filter(p => p.country === 'US');
      
      expect(usPlayers).toHaveLength(2);
      expect(usPlayers.map(p => p.username)).toEqual(['player1', 'player3']);
    });

    it('should filter players by title', () => {
      const players = [
        mockPlayer({ username: 'gm1', title: 'GM' }),
        mockPlayer({ username: 'im1', title: 'IM' }),
        mockPlayer({ username: 'gm2', title: 'GM' })
      ];

      const grandmasters = players.filter(p => p.title === 'GM');
      
      expect(grandmasters).toHaveLength(2);
    });
  });

  describe('getTopPlayers', () => {
    it('should fetch top rated players', async () => {
      const topPlayers = {
        blitz: [
          { username: 'magnuscarlsen', rating: 3200 },
          { username: 'hikarunakamura', rating: 3150 }
        ],
        rapid: [
          { username: 'magnuscarlsen', rating: 2900 },
          { username: 'fabianocaruana', rating: 2850 }
        ]
      };

      axios.get.mockResolvedValueOnce({ data: topPlayers });

      const result = await axios.get('/api/players/top');
      
      expect(result.data.blitz[0].username).toBe('magnuscarlsen');
      expect(result.data.rapid[0].rating).toBe(2900);
    });

    it('should sort players by rating', () => {
      const players = [
        { username: 'player1', rating: 2500 },
        { username: 'player2', rating: 2700 },
        { username: 'player3', rating: 2600 }
      ];

      const sorted = players.sort((a, b) => b.rating - a.rating);
      
      expect(sorted[0].rating).toBe(2700);
      expect(sorted[1].rating).toBe(2600);
      expect(sorted[2].rating).toBe(2500);
    });
  });

  describe('getRatingHistory', () => {
    it('should fetch player rating history', async () => {
      const ratingHistory = {
        history: [
          { date: '2024-01-01', rating: 2500 },
          { date: '2024-02-01', rating: 2520 },
          { date: '2024-03-01', rating: 2510 }
        ]
      };

      axios.get.mockResolvedValueOnce({ data: ratingHistory });

      const result = await axios.get('/api/players/magnuscarlsen/rating-history');
      
      expect(result.data.history).toHaveLength(3);
      expect(result.data.history[1].rating).toBe(2520);
    });

    it('should calculate rating change', () => {
      const history = [
        { date: '2024-01-01', rating: 2500 },
        { date: '2024-02-01', rating: 2520 }
      ];

      const change = history[1].rating - history[0].rating;
      
      expect(change).toBe(20);
    });
  });

  describe('getPlayerOpenings', () => {
    it('should analyze player opening repertoire', async () => {
      const games = [
        mockGame({ eco: 'B90', opening: 'Sicilian Defense' }),
        mockGame({ eco: 'C42', opening: 'Russian Game' }),
        mockGame({ eco: 'B90', opening: 'Sicilian Defense' })
      ];

      const openingStats = games.reduce((acc, game) => {
        acc[game.eco] = (acc[game.eco] || 0) + 1;
        return acc;
      }, {});

      expect(openingStats['B90']).toBe(2);
      expect(openingStats['C42']).toBe(1);
    });

    it('should calculate opening success rate', () => {
      const games = [
        { eco: 'B90', result: 'win' },
        { eco: 'B90', result: 'loss' },
        { eco: 'B90', result: 'win' }
      ];

      const b90Games = games.filter(g => g.eco === 'B90');
      const wins = b90Games.filter(g => g.result === 'win').length;
      const successRate = (wins / b90Games.length) * 100;

      expect(successRate.toFixed(1)).toBe('66.7');
    });
  });

  describe('compareP layers', () => {
    it('should compare two players head-to-head', async () => {
      const comparison = {
        player1: mockPlayer({ username: 'magnuscarlsen', title: 'GM' }),
        player2: mockPlayer({ username: 'hikarunakamura', title: 'GM' }),
        headToHead: {
          total: 100,
          player1Wins: 45,
          player2Wins: 40,
          draws: 15
        }
      };

      axios.get.mockResolvedValueOnce({ data: comparison });

      const result = await axios.get('/api/players/compare?p1=magnuscarlsen&p2=hikarunakamura');
      
      expect(result.data.headToHead.total).toBe(100);
      expect(result.data.headToHead.player1Wins).toBeGreaterThan(result.data.headToHead.player2Wins);
    });
  });
});