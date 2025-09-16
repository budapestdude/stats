const {
  sanitizeInput,
  validateEmail,
  validateUsername,
  validatePassword,
  validateURL,
  validateUUID,
  validateDate,
  validateNumber,
  validateChessUsername,
  validateECO,
  validateFEN,
  validatePGN,
  validateRequest,
  sanitizeString,
  sanitizeObject
} = require('../../../src/middleware/validation');

describe('Extended Validation Middleware Tests', () => {
  describe('sanitizeInput middleware', () => {
    test('should sanitize request query parameters', () => {
      const req = {
        query: {
          search: '<script>alert("xss")</script>',
          page: '1',
          unsafe: '  trimmed  '
        },
        body: {},
        params: {}
      };
      const res = {};
      const next = jest.fn();
      
      sanitizeInput(req, res, next);
      
      expect(req.query.search).not.toContain('<script>');
      expect(req.query.unsafe).toBe('trimmed');
      expect(next).toHaveBeenCalled();
    });

    test('should sanitize request body', () => {
      const req = {
        query: {},
        body: {
          username: '  john_doe  ',
          bio: '<b>Bold text</b>',
          nested: {
            value: '<img src=x onerror=alert(1)>'
          }
        },
        params: {}
      };
      const res = {};
      const next = jest.fn();
      
      sanitizeInput(req, res, next);
      
      expect(req.body.username).toBe('john_doe');
      expect(req.body.bio).not.toContain('<b>');
      expect(req.body.nested.value).not.toContain('onerror');
      expect(next).toHaveBeenCalled();
    });

    test('should sanitize request params', () => {
      const req = {
        query: {},
        body: {},
        params: {
          id: '123',
          username: '  magnus  '
        }
      };
      const res = {};
      const next = jest.fn();
      
      sanitizeInput(req, res, next);
      
      expect(req.params.username).toBe('magnus');
      expect(next).toHaveBeenCalled();
    });

    test('should handle null and undefined values', () => {
      const req = {
        query: { nullValue: null, undefinedValue: undefined },
        body: { nullField: null },
        params: {}
      };
      const res = {};
      const next = jest.fn();
      
      sanitizeInput(req, res, next);
      
      expect(req.query.nullValue).toBeNull();
      expect(req.query.undefinedValue).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    test('should sanitize arrays', () => {
      const req = {
        query: {},
        body: {
          tags: ['<script>tag1</script>', '  tag2  ', 'tag3']
        },
        params: {}
      };
      const res = {};
      const next = jest.fn();
      
      sanitizeInput(req, res, next);
      
      expect(req.body.tags[0]).not.toContain('<script>');
      expect(req.body.tags[1]).toBe('tag2');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('validateEmail', () => {
    test('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'john.doe@company.co.uk',
        'test+filter@gmail.com',
        'user123@test-domain.org'
      ];
      
      validEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBeDefined();
      });
    });

    test('should reject invalid email addresses', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@.com',
        '',
        null
      ];
      
      invalidEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.valid).toBe(false);
        expect(result.message).toBeDefined();
      });
    });

    test('should reject very long email addresses', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const result = validateEmail(longEmail);
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('too long');
    });

    test('should reject disposable email domains', () => {
      const result = validateEmail('test@tempmail.com');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Disposable');
    });

    test('should normalize email addresses', () => {
      const result = validateEmail('User.Name+tag@GMAIL.COM');
      
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBeDefined();
    });
  });

  describe('validateUsername', () => {
    test('should accept valid usernames', () => {
      const validUsernames = ['john_doe', 'user123', 'test-user', 'Player_1'];
      
      validUsernames.forEach(username => {
        const result = validateUsername(username);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe(username);
      });
    });

    test('should reject invalid usernames', () => {
      const result1 = validateUsername('ab'); // too short
      const result2 = validateUsername('a'.repeat(31)); // too long
      const result3 = validateUsername('user@name'); // invalid chars
      const result4 = validateUsername(''); // empty
      
      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
      expect(result3.valid).toBe(false);
      expect(result4.valid).toBe(false);
    });

    test('should reject reserved usernames', () => {
      const reserved = ['admin', 'root', 'api', 'system'];
      
      reserved.forEach(username => {
        const result = validateUsername(username);
        expect(result.valid).toBe(false);
        expect(result.message).toContain('reserved');
      });
    });
  });

  describe('validatePassword', () => {
    test('should accept strong passwords', () => {
      const strongPasswords = [
        'MyStr0ng!Pass',
        'Complex123!@#',
        'P@ssw0rd2024'
      ];
      
      strongPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.valid).toBe(true);
      });
    });

    test('should reject weak passwords', () => {
      const result1 = validatePassword('short'); // too short
      const result2 = validatePassword('a'.repeat(129)); // too long
      const result3 = validatePassword('password'); // common
      const result4 = validatePassword('12345678'); // common
      const result5 = validatePassword('onlylowercase'); // no variety
      
      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
      expect(result3.valid).toBe(false);
      expect(result4.valid).toBe(false);
      expect(result5.valid).toBe(false);
    });

    test('should check password strength requirements', () => {
      const result = validatePassword('weakpassword');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('3 of');
    });
  });

  describe('validateURL', () => {
    test('should accept valid URLs', () => {
      const validURLs = [
        'https://example.com',
        'http://subdomain.example.org/path',
        'https://example.com:8080/path?query=value'
      ];
      
      validURLs.forEach(url => {
        const result = validateURL(url);
        expect(result.valid).toBe(true);
      });
    });

    test('should reject invalid URLs', () => {
      const invalidURLs = [
        'not-a-url',
        'ftp://example.com', // wrong protocol
        'example.com', // no protocol
        '',
        null
      ];
      
      invalidURLs.forEach(url => {
        const result = validateURL(url);
        expect(result.valid).toBe(false);
      });
    });

    test('should handle production URL validation', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const result = validateURL('http://localhost:3000/test');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('production');
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('validateUUID', () => {
    test('should accept valid UUIDs', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        '550e8400-e29b-41d4-a716-446655440000'
      ];
      
      validUUIDs.forEach(uuid => {
        const result = validateUUID(uuid);
        expect(result.valid).toBe(true);
      });
    });

    test('should reject invalid UUIDs', () => {
      const invalidUUIDs = [
        '123456',
        'not-a-uuid',
        '123e4567-e89b-12d3-a456',
        '',
        null
      ];
      
      invalidUUIDs.forEach(uuid => {
        const result = validateUUID(uuid);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('validateDate', () => {
    test('should accept valid ISO dates', () => {
      const validDates = [
        '2024-01-01',
        '2024-12-31T23:59:59Z',
        new Date().toISOString()
      ];
      
      validDates.forEach(date => {
        const result = validateDate(date);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBeDefined();
      });
    });

    test('should reject invalid dates', () => {
      const invalidDates = [
        'not-a-date',
        '2024-13-01', // invalid month
        '2024-01-32', // invalid day
        '',
        null
      ];
      
      invalidDates.forEach(date => {
        const result = validateDate(date);
        expect(result.valid).toBe(false);
      });
    });

    test('should validate date with minDate option', () => {
      const minDate = '2024-01-01';
      const result = validateDate('2023-12-31', { minDate });
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('after');
    });

    test('should validate date with noFuture option', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const result = validateDate(futureDate.toISOString(), { noFuture: true });
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('future');
    });
  });

  describe('validateNumber', () => {
    test('should accept valid numbers', () => {
      const result1 = validateNumber('123');
      const result2 = validateNumber('45.67');
      const result3 = validateNumber(-89);
      
      expect(result1.valid).toBe(true);
      expect(result1.sanitized).toBe(123);
      expect(result2.valid).toBe(true);
      expect(result2.sanitized).toBe(45.67);
      expect(result3.valid).toBe(true);
    });

    test('should reject invalid numbers', () => {
      const result1 = validateNumber('not-a-number');
      const result2 = validateNumber('');
      const result3 = validateNumber(null);
      
      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
      expect(result3.valid).toBe(false);
    });

    test('should validate min/max bounds', () => {
      const result1 = validateNumber('5', { min: 10 });
      const result2 = validateNumber('100', { max: 50 });
      const result3 = validateNumber('25', { min: 10, max: 50 });
      
      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
      expect(result3.valid).toBe(true);
    });

    test('should validate integer requirement', () => {
      const result1 = validateNumber('3.14', { integer: true });
      const result2 = validateNumber('42', { integer: true });
      
      expect(result1.valid).toBe(false);
      expect(result1.message).toContain('integer');
      expect(result2.valid).toBe(true);
    });
  });

  describe('Chess-specific Validations', () => {
    describe('validateChessUsername', () => {
      test('should accept valid chess usernames', () => {
        const result = validateChessUsername('MagnusCarlsen');
        
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe('MagnusCarlsen');
      });

      test('should reject usernames over 20 characters', () => {
        const result = validateChessUsername('a'.repeat(21));
        
        expect(result.valid).toBe(false);
        expect(result.message).toContain('20 characters');
      });
    });

    describe('validateECO', () => {
      test('should accept valid ECO codes', () => {
        const validECOs = ['A00', 'B12', 'C65', 'D37', 'E99'];
        
        validECOs.forEach(eco => {
          const result = validateECO(eco);
          expect(result.valid).toBe(true);
          expect(result.sanitized).toBe(eco.toUpperCase());
        });
      });

      test('should reject invalid ECO codes', () => {
        const invalidECOs = ['F00', 'A100', 'AB1', '123', '', null];
        
        invalidECOs.forEach(eco => {
          const result = validateECO(eco);
          expect(result.valid).toBe(false);
        });
      });

      test('should uppercase ECO codes', () => {
        const result = validateECO('a00');
        
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe('A00');
      });
    });

    describe('validateFEN', () => {
      test('should accept valid FEN strings', () => {
        const validFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        const result = validateFEN(validFEN);
        
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe(validFEN);
      });

      test('should reject invalid FEN strings', () => {
        const invalidFENs = [
          'invalid-fen',
          'rnbqkbnr/pppppppp', // incomplete
          '',
          null
        ];
        
        invalidFENs.forEach(fen => {
          const result = validateFEN(fen);
          expect(result.valid).toBe(false);
        });
      });

      test('should validate FEN structure', () => {
        const result = validateFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w'); // missing parts
        
        expect(result.valid).toBe(false);
        expect(result.message).toContain('Invalid FEN');
      });
    });

    describe('validatePGN', () => {
      test('should accept valid PGN strings', () => {
        const validPGN = '[Event "Test"]\n[White "Player1"]\n[Black "Player2"]\n1. e4 e5';
        const result = validatePGN(validPGN);
        
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe(validPGN);
      });

      test('should reject invalid PGN strings', () => {
        const result1 = validatePGN('not-a-pgn');
        const result2 = validatePGN('');
        const result3 = validatePGN(null);
        
        expect(result1.valid).toBe(false);
        expect(result2.valid).toBe(false);
        expect(result3.valid).toBe(false);
      });

      test('should reject very large PGN strings', () => {
        const largePGN = '[Event "Test"]\n' + '1. e4 '.repeat(20000);
        const result = validatePGN(largePGN);
        
        expect(result.valid).toBe(false);
        expect(result.message).toContain('too long');
      });
    });
  });

  describe('validateRequest middleware', () => {
    test('should validate request fields based on rules', () => {
      const rules = {
        'body.email': { type: 'email', required: true },
        'body.username': { type: 'username', required: true },
        'query.page': { type: 'number', required: false, options: { min: 1 } }
      };
      
      const middleware = validateRequest(rules);
      const req = {
        body: {
          email: 'test@example.com',
          username: 'testuser'
        },
        query: {
          page: '2'
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should reject invalid request data', () => {
      const rules = {
        'body.email': { type: 'email', required: true }
      };
      
      const middleware = validateRequest(rules);
      const req = {
        body: {
          email: 'invalid-email'
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          errors: expect.arrayContaining([
            expect.objectContaining({
              field: 'body.email'
            })
          ])
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle optional fields', () => {
      const rules = {
        'body.bio': { type: 'string', required: false }
      };
      
      const middleware = validateRequest(rules);
      const req = {
        body: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should use custom validation functions', () => {
      const customValidator = (value) => ({
        valid: value === 'special',
        message: 'Value must be special'
      });
      
      const rules = {
        'body.field': { custom: customValidator, required: true }
      };
      
      const middleware = validateRequest(rules);
      const req = {
        body: { field: 'not-special' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: 'Value must be special'
            })
          ])
        })
      );
    });
  });

  describe('sanitizeObject', () => {
    test('should recursively sanitize nested objects', () => {
      const obj = {
        level1: '<script>alert(1)</script>',
        nested: {
          level2: '  trimmed  ',
          deeper: {
            level3: '<img src=x onerror=alert(1)>'
          }
        }
      };
      
      const sanitized = sanitizeObject(obj);
      
      expect(sanitized.level1).not.toContain('<script>');
      expect(sanitized.nested.level2).toBe('trimmed');
      expect(sanitized.nested.deeper.level3).not.toContain('onerror');
    });

    test('should handle arrays in objects', () => {
      const obj = {
        tags: ['<b>tag1</b>', '  tag2  '],
        nested: {
          items: [
            { value: '<script>test</script>' },
            { value: 'clean' }
          ]
        }
      };
      
      const sanitized = sanitizeObject(obj);
      
      expect(sanitized.tags[0]).not.toContain('<b>');
      expect(sanitized.tags[1]).toBe('tag2');
      expect(sanitized.nested.items[0].value).not.toContain('<script>');
    });
  });

  describe('sanitizeString', () => {
    test('should remove null bytes', () => {
      const input = 'test\0string';
      const result = sanitizeString(input);
      
      expect(result).toBe('teststring');
      expect(result).not.toContain('\0');
    });

    test('should remove control characters', () => {
      const input = 'test\x00\x1F\x7Fstring';
      const result = sanitizeString(input);
      
      expect(result).toBe('teststring');
    });

    test('should strip dangerous HTML tags', () => {
      const input = '<script>alert(1)</script><div>safe</div>';
      const result = sanitizeString(input);
      
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    test('should handle non-string input', () => {
      const result = sanitizeString(123);
      
      expect(result).toBe(123);
    });
  });
});