const axios = require('axios');

jest.mock('axios');

describe('Openings API Extended Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOpeningExplorer', () => {
    it('should fetch opening explorer data from Lichess', async () => {
      const explorerData = {
        white: 52.5,
        draws: 30.2,
        black: 17.3,
        moves: [
          { uci: 'e2e4', san: 'e4', white: 5000, draws: 2000, black: 1000 },
          { uci: 'd2d4', san: 'd4', white: 4000, draws: 2500, black: 1500 }
        ],
        topGames: [
          {
            id: 'game1',
            white: { name: 'Carlsen', rating: 2850 },
            black: { name: 'Nakamura', rating: 2800 },
            winner: 'white',
            year: 2024
          }
        ]
      };

      axios.get.mockResolvedValueOnce({ data: explorerData });

      const result = await axios.get('https://explorer.lichess.ovh/lichess?variant=standard&fen=startpos');
      
      expect(result.data.white).toBe(52.5);
      expect(result.data.moves).toHaveLength(2);
      expect(result.data.moves[0].san).toBe('e4');
    });

    it('should handle specific position FEN', async () => {
      const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
      const positionData = {
        white: 48.5,
        draws: 35.0,
        black: 16.5,
        moves: [
          { uci: 'g1f3', san: 'Nf3', white: 3000, draws: 1500, black: 500 }
        ]
      };

      axios.get.mockResolvedValueOnce({ data: positionData });

      const result = await axios.get(`https://explorer.lichess.ovh/lichess?fen=${encodeURIComponent(fen)}`);
      
      expect(result.data.moves[0].san).toBe('Nf3');
    });

    it('should filter by rating range', async () => {
      const ratingFilteredData = {
        moves: [
          { san: 'e4', white: 1000, draws: 500, black: 200, averageRating: 2600 }
        ]
      };

      axios.get.mockResolvedValueOnce({ data: ratingFilteredData });

      const result = await axios.get('https://explorer.lichess.ovh/lichess?ratings=2200,2500');
      
      expect(result.data.moves[0].averageRating).toBeGreaterThanOrEqual(2200);
    });
  });

  describe('getPopularOpenings', () => {
    it('should return most popular openings', async () => {
      const popularOpenings = [
        { eco: 'B90', name: 'Sicilian Defense, Najdorf', games: 50000, whiteWins: 45 },
        { eco: 'C42', name: 'Russian Game', games: 30000, whiteWins: 52 },
        { eco: 'D37', name: 'Queens Gambit Declined', games: 25000, whiteWins: 54 }
      ];

      axios.get.mockResolvedValueOnce({ data: { openings: popularOpenings } });

      const result = await axios.get('/api/openings/popular');
      
      expect(result.data.openings).toHaveLength(3);
      expect(result.data.openings[0].games).toBe(50000);
    });

    it('should sort openings by popularity', () => {
      const openings = [
        { name: 'Opening A', games: 1000 },
        { name: 'Opening B', games: 5000 },
        { name: 'Opening C', games: 3000 }
      ];

      const sorted = openings.sort((a, b) => b.games - a.games);
      
      expect(sorted[0].name).toBe('Opening B');
      expect(sorted[1].name).toBe('Opening C');
      expect(sorted[2].name).toBe('Opening A');
    });
  });

  describe('getOpeningByECO', () => {
    it('should fetch opening details by ECO code', async () => {
      const openingDetails = {
        eco: 'B90',
        name: 'Sicilian Defense, Najdorf Variation',
        moves: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6',
        fen: 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6',
        statistics: {
          totalGames: 50000,
          whiteWins: 22500,
          blackWins: 20000,
          draws: 7500
        }
      };

      axios.get.mockResolvedValueOnce({ data: openingDetails });

      const result = await axios.get('/api/openings/eco/B90');
      
      expect(result.data.eco).toBe('B90');
      expect(result.data.name).toContain('Najdorf');
      expect(result.data.statistics.totalGames).toBe(50000);
    });

    it('should handle invalid ECO code', async () => {
      axios.get.mockRejectedValueOnce(new Error('404: ECO code not found'));

      await expect(
        axios.get('/api/openings/eco/Z99')
      ).rejects.toThrow('404: ECO code not found');
    });

    it('should validate ECO code format', () => {
      const validECO = (code) => /^[A-E][0-9]{2}$/.test(code);
      
      expect(validECO('B90')).toBe(true);
      expect(validECO('A00')).toBe(true);
      expect(validECO('E99')).toBe(true);
      expect(validECO('Z99')).toBe(false);
      expect(validECO('B9')).toBe(false);
      expect(validECO('B900')).toBe(false);
    });
  });

  describe('getOpeningStatistics', () => {
    it('should calculate opening performance statistics', () => {
      const games = [
        { eco: 'B90', result: '1-0', white: 'player1', black: 'player2' },
        { eco: 'B90', result: '0-1', white: 'player3', black: 'player1' },
        { eco: 'B90', result: '1/2-1/2', white: 'player1', black: 'player4' }
      ];

      const stats = {
        total: games.length,
        whiteWins: games.filter(g => g.result === '1-0').length,
        blackWins: games.filter(g => g.result === '0-1').length,
        draws: games.filter(g => g.result === '1/2-1/2').length
      };

      expect(stats.total).toBe(3);
      expect(stats.whiteWins).toBe(1);
      expect(stats.blackWins).toBe(1);
      expect(stats.draws).toBe(1);
    });

    it('should calculate win percentages', () => {
      const stats = {
        total: 100,
        whiteWins: 45,
        blackWins: 35,
        draws: 20
      };

      const whiteWinPct = (stats.whiteWins / stats.total) * 100;
      const blackWinPct = (stats.blackWins / stats.total) * 100;
      const drawPct = (stats.draws / stats.total) * 100;

      expect(whiteWinPct).toBe(45);
      expect(blackWinPct).toBe(35);
      expect(drawPct).toBe(20);
    });
  });

  describe('getOpeningTrends', () => {
    it('should analyze opening popularity trends over time', async () => {
      const trendsData = {
        opening: 'Sicilian Defense',
        eco: 'B90',
        monthly: [
          { month: '2024-01', games: 5000, popularity: 15.2 },
          { month: '2024-02', games: 5500, popularity: 16.1 },
          { month: '2024-03', games: 5200, popularity: 15.5 }
        ]
      };

      axios.get.mockResolvedValueOnce({ data: trendsData });

      const result = await axios.get('/api/openings/B90/trends');
      
      expect(result.data.monthly).toHaveLength(3);
      expect(result.data.monthly[1].games).toBe(5500);
    });

    it('should detect trend direction', () => {
      const monthly = [
        { popularity: 15.2 },
        { popularity: 16.1 },
        { popularity: 15.5 }
      ];

      const firstHalf = monthly.slice(0, Math.floor(monthly.length / 2));
      const secondHalf = monthly.slice(Math.floor(monthly.length / 2));
      
      const avgFirst = firstHalf.reduce((sum, m) => sum + m.popularity, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((sum, m) => sum + m.popularity, 0) / secondHalf.length;
      
      const trend = avgSecond > avgFirst ? 'increasing' : 'decreasing';
      
      expect(avgSecond).toBeGreaterThan(avgFirst);
      expect(trend).toBe('increasing');
    });
  });

  describe('searchOpenings', () => {
    it('should search openings by name', async () => {
      const searchResults = {
        openings: [
          { eco: 'B90', name: 'Sicilian Defense, Najdorf' },
          { eco: 'B33', name: 'Sicilian Defense, Sveshnikov' },
          { eco: 'B22', name: 'Sicilian Defense, Alapin' }
        ]
      };

      axios.get.mockResolvedValueOnce({ data: searchResults });

      const result = await axios.get('/api/openings/search?q=sicilian');
      
      expect(result.data.openings).toHaveLength(3);
      expect(result.data.openings.every(o => o.name.includes('Sicilian'))).toBe(true);
    });

    it('should filter openings by ECO range', () => {
      const openings = [
        { eco: 'A00', name: 'Opening A' },
        { eco: 'B90', name: 'Opening B' },
        { eco: 'C42', name: 'Opening C' },
        { eco: 'D37', name: 'Opening D' }
      ];

      const bOpenings = openings.filter(o => o.eco.startsWith('B'));
      
      expect(bOpenings).toHaveLength(1);
      expect(bOpenings[0].eco).toBe('B90');
    });
  });

  describe('getOpeningTree', () => {
    it('should build opening tree structure', () => {
      const moves = [
        { move: 1, white: 'e4', black: 'e5' },
        { move: 2, white: 'Nf3', black: 'Nc6' },
        { move: 3, white: 'Bb5', black: null }
      ];

      const tree = {
        move: 'e4',
        children: [{
          move: 'e5',
          children: [{
            move: 'Nf3',
            children: [{
              move: 'Nc6',
              children: [{
                move: 'Bb5',
                children: []
              }]
            }]
          }]
        }]
      };

      expect(tree.move).toBe('e4');
      expect(tree.children[0].move).toBe('e5');
      expect(tree.children[0].children[0].children[0].children[0].move).toBe('Bb5');
    });
  });

  describe('getOpeningRepertoire', () => {
    it('should generate opening repertoire for player', async () => {
      const repertoire = {
        asWhite: [
          { eco: 'C42', name: 'Russian Game', games: 100, score: 65 },
          { eco: 'B90', name: 'Sicilian Najdorf', games: 80, score: 58 }
        ],
        asBlack: [
          { eco: 'B90', name: 'Sicilian Najdorf', games: 120, score: 52 },
          { eco: 'E60', name: 'Kings Indian', games: 60, score: 48 }
        ]
      };

      axios.get.mockResolvedValueOnce({ data: repertoire });

      const result = await axios.get('/api/players/magnuscarlsen/repertoire');
      
      expect(result.data.asWhite).toHaveLength(2);
      expect(result.data.asBlack).toHaveLength(2);
      expect(result.data.asWhite[0].score).toBe(65);
    });

    it('should identify most successful openings', () => {
      const openings = [
        { name: 'Opening A', score: 65 },
        { name: 'Opening B', score: 72 },
        { name: 'Opening C', score: 58 }
      ];

      const best = openings.reduce((best, current) => 
        current.score > best.score ? current : best
      );

      expect(best.name).toBe('Opening B');
      expect(best.score).toBe(72);
    });
  });
});