const {
  sanitizeString,
  sanitizeUsername,
  sanitizeNumber,
  sanitizeECO,
  sanitizeFEN,
  preventSQLInjection
} = require('../../../middleware/validation');

describe('Validation Middleware', () => {
  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
    });

    it('should trim whitespace', () => {
      expect(sanitizeString('  test  ')).toBe('test');
    });

    it('should handle empty strings', () => {
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });
  });

  describe('sanitizeUsername', () => {
    it('should accept valid usernames', () => {
      expect(sanitizeUsername('MagnusCarlsen')).toBe('MagnusCarlsen');
      expect(sanitizeUsername('user_123')).toBe('user_123');
      expect(sanitizeUsername('test-player')).toBe('test-player');
    });

    it('should reject invalid usernames', () => {
      expect(() => sanitizeUsername('')).toThrow('Username is required');
      expect(() => sanitizeUsername('user@123')).toThrow('Invalid username format');
      expect(() => sanitizeUsername('user space')).toThrow('Invalid username format');
      expect(() => sanitizeUsername('../../etc/passwd')).toThrow('Invalid username format');
    });
  });

  describe('sanitizeNumber', () => {
    it('should parse valid numbers', () => {
      expect(sanitizeNumber('123')).toBe(123);
      expect(sanitizeNumber(456)).toBe(456);
      expect(sanitizeNumber('0')).toBe(0);
    });

    it('should enforce min/max bounds', () => {
      expect(sanitizeNumber('5', 1, 10)).toBe(5);
      expect(() => sanitizeNumber('0', 1, 10)).toThrow('Number must be between 1 and 10');
      expect(() => sanitizeNumber('11', 1, 10)).toThrow('Number must be between 1 and 10');
    });

    it('should reject invalid numbers', () => {
      expect(() => sanitizeNumber('abc')).toThrow('Invalid number format');
      expect(() => sanitizeNumber('')).toThrow('Invalid number format');
      expect(() => sanitizeNumber(null)).toThrow('Invalid number format');
    });
  });

  describe('sanitizeECO', () => {
    it('should accept valid ECO codes', () => {
      expect(sanitizeECO('B12')).toBe('B12');
      expect(sanitizeECO('e99')).toBe('E99');
      expect(sanitizeECO('A00')).toBe('A00');
    });

    it('should reject invalid ECO codes', () => {
      expect(() => sanitizeECO('')).toThrow('ECO code is required');
      expect(() => sanitizeECO('Z99')).toThrow('Invalid ECO code format');
      expect(() => sanitizeECO('B1')).toThrow('Invalid ECO code format');
      expect(() => sanitizeECO('B123')).toThrow('Invalid ECO code format');
    });
  });

  describe('sanitizeFEN', () => {
    it('should accept valid FEN strings', () => {
      const startFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      expect(sanitizeFEN(startFEN)).toBe(startFEN);
    });

    it('should return default FEN for empty input', () => {
      const defaultFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      expect(sanitizeFEN('')).toBe(defaultFEN);
      expect(sanitizeFEN(null)).toBe(defaultFEN);
    });

    it('should reject invalid FEN strings', () => {
      expect(() => sanitizeFEN('invalid fen with too many parts 1 2 3 4 5')).toThrow('Invalid FEN format');
    });
  });

  describe('preventSQLInjection', () => {
    it('should allow safe strings', () => {
      expect(preventSQLInjection('Magnus Carlsen')).toBe('Magnus Carlsen');
      expect(preventSQLInjection('player123')).toBe('player123');
    });

    it('should detect SQL keywords', () => {
      expect(() => preventSQLInjection('SELECT * FROM users')).toThrow('Invalid input detected');
      expect(() => preventSQLInjection('DROP TABLE games')).toThrow('Invalid input detected');
      expect(() => preventSQLInjection('1; DELETE FROM users')).toThrow('Invalid input detected');
      expect(() => preventSQLInjection("' OR '1'='1")).not.toThrow(); // This should pass as it doesn't contain SQL keywords
      expect(() => preventSQLInjection('UNION SELECT')).toThrow('Invalid input detected');
    });

    it('should detect SQL comment markers', () => {
      expect(() => preventSQLInjection('-- comment')).toThrow('Invalid input detected');
      expect(() => preventSQLInjection('/* comment */')).toThrow('Invalid input detected');
    });
  });
});