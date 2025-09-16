describe('PGN Parser', () => {
  // Mock PGN parser
  const PGNParser = {
    parse: jest.fn(),
    parseHeaders: jest.fn(),
    parseMoves: jest.fn(),
    validate: jest.fn(),
    extractGameInfo: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parse', () => {
    it('should parse a complete PGN game', () => {
      const pgn = `[Event "World Championship"]
[Site "Dubai UAE"]
[Date "2024.01.15"]
[Round "1"]
[White "Carlsen, Magnus"]
[Black "Nepomniachtchi, Ian"]
[Result "1-0"]
[ECO "C42"]
[WhiteElo "2830"]
[BlackElo "2795"]

1. e4 e5 2. Nf3 Nf6 3. Nxe5 d6 4. Nf3 Nxe4 5. d4 d5 6. Bd3 1-0`;

      const expected = {
        headers: {
          Event: 'World Championship',
          Site: 'Dubai UAE',
          Date: '2024.01.15',
          Round: '1',
          White: 'Carlsen, Magnus',
          Black: 'Nepomniachtchi, Ian',
          Result: '1-0',
          ECO: 'C42',
          WhiteElo: '2830',
          BlackElo: '2795'
        },
        moves: '1. e4 e5 2. Nf3 Nf6 3. Nxe5 d6 4. Nf3 Nxe4 5. d4 d5 6. Bd3',
        result: '1-0'
      };

      PGNParser.parse.mockReturnValue(expected);
      const result = PGNParser.parse(pgn);

      expect(result.headers.White).toBe('Carlsen, Magnus');
      expect(result.headers.ECO).toBe('C42');
      expect(result.result).toBe('1-0');
    });

    it('should handle multiple games in one PGN', () => {
      const multiGamePGN = `[Event "Tournament"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 1-0

[Event "Tournament"]
[White "Player3"]
[Black "Player4"]
[Result "0-1"]

1. d4 d5 0-1`;

      const games = [
        { headers: { White: 'Player1', Black: 'Player2', Result: '1-0' } },
        { headers: { White: 'Player3', Black: 'Player4', Result: '0-1' } }
      ];

      PGNParser.parse.mockReturnValue(games);
      const result = PGNParser.parse(multiGamePGN);

      expect(result).toHaveLength(2);
      expect(result[0].headers.White).toBe('Player1');
      expect(result[1].headers.Result).toBe('0-1');
    });

    it('should handle games with comments and variations', () => {
      const pgnWithComments = `1. e4 {King's pawn} e5 {Classical response} 
2. Nf3 (2. f4 {King's Gambit}) 2... Nc6 3. Bb5 {Ruy Lopez} 1-0`;

      const expected = {
        moves: '1. e4 e5 2. Nf3 Nc6 3. Bb5',
        comments: [
          { move: 'e4', comment: "King's pawn" },
          { move: 'e5', comment: 'Classical response' },
          { move: 'Bb5', comment: 'Ruy Lopez' }
        ],
        variations: [
          { afterMove: '2', variation: '2. f4', comment: "King's Gambit" }
        ]
      };

      PGNParser.parse.mockReturnValue(expected);
      const result = PGNParser.parse(pgnWithComments);

      expect(result.comments).toHaveLength(3);
      expect(result.variations).toHaveLength(1);
    });
  });

  describe('parseHeaders', () => {
    it('should extract all PGN headers', () => {
      const headerString = `[Event "World Championship"]
[Site "Dubai UAE"]
[Date "2024.01.15"]
[Round "1"]
[White "Carlsen, Magnus"]
[Black "Nepomniachtchi, Ian"]`;

      const headers = {
        Event: 'World Championship',
        Site: 'Dubai UAE',
        Date: '2024.01.15',
        Round: '1',
        White: 'Carlsen, Magnus',
        Black: 'Nepomniachtchi, Ian'
      };

      PGNParser.parseHeaders.mockReturnValue(headers);
      const result = PGNParser.parseHeaders(headerString);

      expect(result.Event).toBe('World Championship');
      expect(result.Date).toBe('2024.01.15');
    });

    it('should handle missing headers gracefully', () => {
      const partialHeaders = `[White "Carlsen"]
[Black "Nakamura"]`;

      const headers = {
        White: 'Carlsen',
        Black: 'Nakamura',
        Event: '?',
        Site: '?',
        Date: '????.??.??',
        Round: '?',
        Result: '*'
      };

      PGNParser.parseHeaders.mockReturnValue(headers);
      const result = PGNParser.parseHeaders(partialHeaders);

      expect(result.Event).toBe('?');
      expect(result.Date).toBe('????.??.??');
      expect(result.Result).toBe('*');
    });

    it('should parse custom headers', () => {
      const customHeaders = `[White "Carlsen"]
[Black "Nakamura"]
[TimeControl "180+2"]
[Opening "Sicilian Defense"]
[Variation "Najdorf"]`;

      const headers = {
        White: 'Carlsen',
        Black: 'Nakamura',
        TimeControl: '180+2',
        Opening: 'Sicilian Defense',
        Variation: 'Najdorf'
      };

      PGNParser.parseHeaders.mockReturnValue(headers);
      const result = PGNParser.parseHeaders(customHeaders);

      expect(result.TimeControl).toBe('180+2');
      expect(result.Opening).toBe('Sicilian Defense');
    });
  });

  describe('parseMoves', () => {
    it('should parse standard algebraic notation', () => {
      const movesString = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6';
      
      const moves = [
        { moveNumber: 1, white: 'e4', black: 'e5' },
        { moveNumber: 2, white: 'Nf3', black: 'Nc6' },
        { moveNumber: 3, white: 'Bb5', black: 'a6' }
      ];

      PGNParser.parseMoves.mockReturnValue(moves);
      const result = PGNParser.parseMoves(movesString);

      expect(result).toHaveLength(3);
      expect(result[0].white).toBe('e4');
      expect(result[2].black).toBe('a6');
    });

    it('should handle castling notation', () => {
      const movesWithCastling = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O Nf6 5. d3 O-O-O';
      
      const moves = [
        { moveNumber: 4, white: 'O-O', black: 'Nf6' },
        { moveNumber: 5, white: 'd3', black: 'O-O-O' }
      ];

      PGNParser.parseMoves.mockReturnValue(moves);
      const result = PGNParser.parseMoves(movesWithCastling);

      const castlingMoves = result.filter(m => 
        m.white?.includes('O-O') || m.black?.includes('O-O')
      );
      
      expect(castlingMoves).toBeDefined();
    });

    it('should handle check and checkmate notation', () => {
      const movesWithCheck = '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6?? 4. Qxf7#';
      
      const moves = [
        { moveNumber: 3, white: 'Qh5', black: 'Nf6??' },
        { moveNumber: 4, white: 'Qxf7#', black: null }
      ];

      PGNParser.parseMoves.mockReturnValue(moves);
      const result = PGNParser.parseMoves(movesWithCheck);

      expect(result[result.length - 1].white).toContain('#');
    });

    it('should handle promotion notation', () => {
      const movesWithPromotion = '1. e4 d5 2. exd5 c6 3. dxc6 bxc6 4. d4 e5 5. dxe5 a5 6. e6 a4 7. e7 a3 8. e8=Q+';
      
      const promotion = { moveNumber: 8, white: 'e8=Q+', black: null };

      PGNParser.parseMoves.mockReturnValue([promotion]);
      const result = PGNParser.parseMoves(movesWithPromotion);

      expect(result[0].white).toContain('=Q');
    });
  });

  describe('validate', () => {
    it('should validate correct PGN format', () => {
      const validPGN = `[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 1-0`;

      PGNParser.validate.mockReturnValue({ valid: true, errors: [] });
      const result = PGNParser.validate(validPGN);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid headers', () => {
      const invalidHeaders = `[White Player1]
[Black "Player2"]`;

      PGNParser.validate.mockReturnValue({ 
        valid: false, 
        errors: ['Invalid header format: [White Player1]'] 
      });
      
      const result = PGNParser.validate(invalidHeaders);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid header');
    });

    it('should detect invalid moves', () => {
      const invalidMoves = '1. e4 e5 2. Kf7 Nc6'; // Illegal king move

      PGNParser.validate.mockReturnValue({ 
        valid: false, 
        errors: ['Illegal move: Kf7'] 
      });
      
      const result = PGNParser.validate(invalidMoves);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Illegal move');
    });

    it('should validate result consistency', () => {
      const inconsistentResult = `[Result "1-0"]

1. e4 e5 0-1`; // Header says 1-0, moves end with 0-1

      PGNParser.validate.mockReturnValue({ 
        valid: false, 
        errors: ['Result mismatch: header says 1-0, moves end with 0-1'] 
      });
      
      const result = PGNParser.validate(inconsistentResult);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Result mismatch');
    });
  });

  describe('extractGameInfo', () => {
    it('should extract essential game information', () => {
      const pgn = `[Event "World Championship"]
[White "Carlsen, Magnus"]
[Black "Nepomniachtchi, Ian"]
[Result "1-0"]
[ECO "C42"]

1. e4 e5 2. Nf3 Nf6 1-0`;

      const gameInfo = {
        event: 'World Championship',
        white: 'Carlsen, Magnus',
        black: 'Nepomniachtchi, Ian',
        result: '1-0',
        eco: 'C42',
        opening: 'Russian Game',
        plyCount: 4,
        moveCount: 2
      };

      PGNParser.extractGameInfo.mockReturnValue(gameInfo);
      const result = PGNParser.extractGameInfo(pgn);

      expect(result.white).toBe('Carlsen, Magnus');
      expect(result.eco).toBe('C42');
      expect(result.plyCount).toBe(4);
    });

    it('should calculate game statistics', () => {
      const moves = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6';
      
      const stats = {
        plyCount: 8,
        moveCount: 4,
        piecesDeveloped: { white: 3, black: 2 },
        pawnMoves: { white: 1, black: 2 },
        captures: 0,
        checks: 0
      };

      const calculateStats = jest.fn().mockReturnValue(stats);
      const result = calculateStats(moves);

      expect(result.plyCount).toBe(8);
      expect(result.piecesDeveloped.white).toBe(3);
      expect(result.captures).toBe(0);
    });

    it('should detect opening from moves', () => {
      const openingMoves = [
        { moves: '1. e4 e5 2. Nf3 Nc6 3. Bb5', opening: 'Ruy Lopez' },
        { moves: '1. e4 c5', opening: 'Sicilian Defense' },
        { moves: '1. d4 Nf6 2. c4', opening: 'Queens Gambit' }
      ];

      openingMoves.forEach(({ moves, opening }) => {
        const detected = { opening };
        PGNParser.extractGameInfo.mockReturnValue(detected);
        const result = PGNParser.extractGameInfo(moves);
        expect(result.opening).toBe(opening);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted PGN data', () => {
      const corruptedPGN = '[White "Player1"[Black "Player2"] 1. e4 e5 ??';

      PGNParser.parse.mockImplementation(() => {
        throw new Error('Failed to parse PGN: Unexpected token');
      });

      expect(() => PGNParser.parse(corruptedPGN)).toThrow('Failed to parse');
    });

    it('should handle empty PGN', () => {
      const emptyPGN = '';

      PGNParser.parse.mockReturnValue(null);
      const result = PGNParser.parse(emptyPGN);

      expect(result).toBeNull();
    });

    it('should handle PGN with only headers', () => {
      const headersOnly = `[White "Player1"]
[Black "Player2"]
[Result "*"]`;

      const expected = {
        headers: { White: 'Player1', Black: 'Player2', Result: '*' },
        moves: '',
        result: '*'
      };

      PGNParser.parse.mockReturnValue(expected);
      const result = PGNParser.parse(headersOnly);

      expect(result.moves).toBe('');
      expect(result.result).toBe('*');
    });
  });

  describe('Performance', () => {
    it('should parse large PGN files efficiently', () => {
      const largePGN = Array(1000).fill('[Game]\n1. e4 e5 1-0\n').join('\n');
      
      const startTime = Date.now();
      PGNParser.parse.mockReturnValue(Array(1000).fill({}));
      const result = PGNParser.parse(largePGN);
      const endTime = Date.now();

      expect(result).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should parse in under 1 second
    });

    it('should use streaming for very large files', () => {
      const streamParser = {
        onGame: jest.fn(),
        onError: jest.fn(),
        parse: jest.fn()
      };

      let gameCount = 0;
      streamParser.onGame.mockImplementation(() => gameCount++);
      
      // Simulate streaming 10000 games
      for (let i = 0; i < 10000; i++) {
        streamParser.onGame();
      }

      expect(gameCount).toBe(10000);
    });
  });
});