const { ValidationError } = require('./errorHandler');

// Input sanitization helpers
const sanitizeString = (str) => {
  if (!str) return '';
  return str.toString().trim().replace(/[<>]/g, '');
};

const sanitizeUsername = (username) => {
  if (!username) throw new ValidationError('Username is required');
  // Allow alphanumeric, underscore, and dash only
  const sanitized = username.toString().trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    throw new ValidationError('Invalid username format');
  }
  return sanitized;
};

const sanitizeNumber = (num, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = parseInt(num);
  if (isNaN(parsed)) throw new ValidationError('Invalid number format');
  if (parsed < min || parsed > max) {
    throw new ValidationError(`Number must be between ${min} and ${max}`);
  }
  return parsed;
};

const sanitizeECO = (eco) => {
  if (!eco) throw new ValidationError('ECO code is required');
  const sanitized = eco.toString().toUpperCase().trim();
  if (!/^[A-E]\d{2}$/.test(sanitized)) {
    throw new ValidationError('Invalid ECO code format (e.g., B12)');
  }
  return sanitized;
};

const sanitizeFEN = (fen) => {
  if (!fen) return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  // Basic FEN validation
  const parts = fen.split(' ');
  if (parts.length < 1 || parts.length > 6) {
    throw new ValidationError('Invalid FEN format');
  }
  return fen;
};

// Validation middleware
const validatePlayer = (req, res, next) => {
  try {
    if (req.params.username) {
      req.params.username = sanitizeUsername(req.params.username);
    }
    if (req.params.id) {
      req.params.id = sanitizeUsername(req.params.id);
    }
    next();
  } catch (err) {
    next(err);
  }
};

const validatePagination = (req, res, next) => {
  try {
    if (req.query.page) {
      req.query.page = sanitizeNumber(req.query.page, 1, 10000);
    }
    if (req.query.limit) {
      req.query.limit = sanitizeNumber(req.query.limit, 1, 100);
    }
    if (req.query.offset) {
      req.query.offset = sanitizeNumber(req.query.offset, 0, 1000000);
    }
    next();
  } catch (err) {
    next(err);
  }
};

const validateSearch = (req, res, next) => {
  try {
    if (req.query.q) {
      req.query.q = sanitizeString(req.query.q);
      if (req.query.q.length < 2) {
        throw new ValidationError('Search query must be at least 2 characters');
      }
      if (req.query.q.length > 100) {
        throw new ValidationError('Search query too long');
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};

const validateOpening = (req, res, next) => {
  try {
    if (req.params.eco) {
      req.params.eco = sanitizeECO(req.params.eco);
    }
    if (req.query.fen) {
      req.query.fen = sanitizeFEN(req.query.fen);
    }
    next();
  } catch (err) {
    next(err);
  }
};

const validateTournament = (req, res, next) => {
  try {
    if (req.params.id) {
      req.params.id = sanitizeNumber(req.params.id, 1);
    }
    next();
  } catch (err) {
    next(err);
  }
};

// SQL injection prevention
const preventSQLInjection = (value) => {
  if (!value) return '';
  // Remove SQL keywords and special characters
  const dangerous = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|FROM|WHERE|ORDER BY|GROUP BY|HAVING)\b|;|--|\/\*|\*\/|xp_|sp_|0x)/gi;
  if (dangerous.test(value)) {
    throw new ValidationError('Invalid input detected');
  }
  return value;
};

module.exports = {
  sanitizeString,
  sanitizeUsername,
  sanitizeNumber,
  sanitizeECO,
  sanitizeFEN,
  preventSQLInjection,
  validatePlayer,
  validatePagination,
  validateSearch,
  validateOpening,
  validateTournament
};