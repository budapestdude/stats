const validator = require('validator');
const xss = require('xss');
const logger = require('../utils/logger');

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  // Sanitize body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize params
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// Recursive object sanitization
const sanitizeObject = (obj) => {
  const sanitized = {};
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      
      if (value === null || value === undefined) {
        sanitized[key] = value;
      } else if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = sanitizeObject(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'object' ? sanitizeObject(item) : sanitizeString(item.toString())
        );
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
};

// String sanitization
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  // Remove null bytes
  str = str.replace(/\0/g, '');
  
  // Trim whitespace
  str = str.trim();
  
  // Remove control characters
  str = str.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Basic XSS prevention (more aggressive sanitization)
  str = xss(str, {
    whiteList: {}, // No HTML tags allowed by default
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
  });
  
  return str;
};

// Email validation
const validateEmail = (email) => {
  if (!email || !validator.isEmail(email)) {
    return { valid: false, message: 'Invalid email address' };
  }
  
  // Additional checks
  if (email.length > 254) {
    return { valid: false, message: 'Email address too long' };
  }
  
  // Check for disposable email domains (basic list)
  const disposableDomains = ['tempmail.com', 'throwaway.email', '10minutemail.com'];
  const domain = email.split('@')[1];
  if (disposableDomains.includes(domain)) {
    return { valid: false, message: 'Disposable email addresses not allowed' };
  }
  
  return { valid: true, sanitized: validator.normalizeEmail(email) };
};

// Username validation
const validateUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return { valid: false, message: 'Username is required' };
  }
  
  if (username.length < 3 || username.length > 30) {
    return { valid: false, message: 'Username must be 3-30 characters' };
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, message: 'Username can only contain letters, numbers, hyphens, and underscores' };
  }
  
  // Check for reserved usernames
  const reserved = ['admin', 'root', 'api', 'system', 'chess', 'chessstats'];
  if (reserved.includes(username.toLowerCase())) {
    return { valid: false, message: 'This username is reserved' };
  }
  
  return { valid: true, sanitized: username };
};

// Password validation
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  
  if (password.length > 128) {
    return { valid: false, message: 'Password too long' };
  }
  
  // Check password strength
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const strength = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
  
  if (strength < 3) {
    return { 
      valid: false, 
      message: 'Password must contain at least 3 of: uppercase, lowercase, numbers, special characters' 
    };
  }
  
  // Check for common passwords (basic list)
  const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'password123'];
  if (commonPasswords.includes(password.toLowerCase())) {
    return { valid: false, message: 'This password is too common' };
  }
  
  return { valid: true };
};

// URL validation
const validateURL = (url) => {
  if (!url || !validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true,
  })) {
    return { valid: false, message: 'Invalid URL' };
  }
  
  // Check for localhost and private IPs in production
  if (process.env.NODE_ENV === 'production') {
    if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('192.168')) {
      return { valid: false, message: 'Invalid URL for production environment' };
    }
  }
  
  return { valid: true, sanitized: url };
};

// UUID validation
const validateUUID = (uuid) => {
  if (!uuid || !validator.isUUID(uuid)) {
    return { valid: false, message: 'Invalid UUID format' };
  }
  return { valid: true, sanitized: uuid };
};

// Date validation
const validateDate = (date, options = {}) => {
  const dateStr = date?.toString();
  if (!dateStr || !validator.isISO8601(dateStr)) {
    return { valid: false, message: 'Invalid date format' };
  }
  
  const dateObj = new Date(dateStr);
  const now = new Date();
  
  // Check if date is not too far in the past
  if (options.minDate) {
    const minDate = new Date(options.minDate);
    if (dateObj < minDate) {
      return { valid: false, message: `Date must be after ${minDate.toISOString()}` };
    }
  }
  
  // Check if date is not in the future
  if (options.noFuture && dateObj > now) {
    return { valid: false, message: 'Date cannot be in the future' };
  }
  
  return { valid: true, sanitized: dateObj.toISOString() };
};

// Number validation
const validateNumber = (num, options = {}) => {
  const number = parseFloat(num);
  
  if (isNaN(number)) {
    return { valid: false, message: 'Invalid number' };
  }
  
  if (options.min !== undefined && number < options.min) {
    return { valid: false, message: `Number must be at least ${options.min}` };
  }
  
  if (options.max !== undefined && number > options.max) {
    return { valid: false, message: `Number must be at most ${options.max}` };
  }
  
  if (options.integer && !Number.isInteger(number)) {
    return { valid: false, message: 'Number must be an integer' };
  }
  
  return { valid: true, sanitized: number };
};

// Chess-specific validations
const validateChessUsername = (username) => {
  const base = validateUsername(username);
  if (!base.valid) return base;
  
  // Additional chess.com/lichess username rules
  if (username.length > 20) {
    return { valid: false, message: 'Chess username must be 20 characters or less' };
  }
  
  return { valid: true, sanitized: username };
};

const validateECO = (eco) => {
  if (!eco) {
    return { valid: false, message: 'Invalid ECO code format (e.g., A00, E99)' };
  }

  // Uppercase the ECO code first to allow lowercase input
  const uppercasedEco = eco.toUpperCase();

  if (!/^[A-E][0-9]{2}$/.test(uppercasedEco)) {
    return { valid: false, message: 'Invalid ECO code format (e.g., A00, E99)' };
  }

  return { valid: true, sanitized: uppercasedEco };
};

const validateFEN = (fen) => {
  if (!fen || typeof fen !== 'string') {
    return { valid: false, message: 'FEN string is required' };
  }
  
  // Basic FEN validation
  const parts = fen.split(' ');
  if (parts.length !== 6) {
    return { valid: false, message: 'Invalid FEN format' };
  }
  
  // Validate board position (simplified)
  const position = parts[0];
  const ranks = position.split('/');
  if (ranks.length !== 8) {
    return { valid: false, message: 'Invalid FEN board position' };
  }
  
  return { valid: true, sanitized: fen };
};

const validatePGN = (pgn) => {
  if (!pgn || typeof pgn !== 'string') {
    return { valid: false, message: 'PGN string is required' };
  }
  
  // Basic PGN validation
  if (pgn.length > 100000) {
    return { valid: false, message: 'PGN too long (max 100KB)' };
  }
  
  // Check for basic PGN structure
  if (!pgn.includes('[') || !pgn.includes(']')) {
    return { valid: false, message: 'Invalid PGN format' };
  }
  
  return { valid: true, sanitized: pgn };
};

// Request validation middleware factory
const validateRequest = (rules) => {
  return (req, res, next) => {
    const errors = [];
    
    for (const field in rules) {
      const rule = rules[field];
      const value = getNestedValue(req, field);
      
      // Check required fields
      if (rule.required && !value) {
        errors.push({ field, message: `${field} is required` });
        continue;
      }
      
      // Skip optional empty fields
      if (!rule.required && !value) {
        continue;
      }
      
      // Apply validation based on type
      let validation;
      switch (rule.type) {
        case 'email':
          validation = validateEmail(value);
          break;
        case 'username':
          validation = validateUsername(value);
          break;
        case 'password':
          validation = validatePassword(value);
          break;
        case 'url':
          validation = validateURL(value);
          break;
        case 'uuid':
          validation = validateUUID(value);
          break;
        case 'date':
          validation = validateDate(value, rule.options);
          break;
        case 'number':
          validation = validateNumber(value, rule.options);
          break;
        case 'chessUsername':
          validation = validateChessUsername(value);
          break;
        case 'eco':
          validation = validateECO(value);
          break;
        case 'fen':
          validation = validateFEN(value);
          break;
        case 'pgn':
          validation = validatePGN(value);
          break;
        default:
          if (rule.custom) {
            validation = rule.custom(value);
          } else {
            validation = { valid: true, sanitized: value };
          }
      }
      
      if (!validation.valid) {
        errors.push({ field, message: validation.message });
      } else if (validation.sanitized !== undefined) {
        setNestedValue(req, field, validation.sanitized);
      }
    }
    
    if (errors.length > 0) {
      logger.warn('Request validation failed', { 
        path: req.path,
        errors,
        ip: req.ip,
      });
      
      return res.status(400).json({
        error: 'Validation failed',
        errors,
      });
    }
    
    next();
  };
};

// Helper to get nested values (e.g., 'body.user.email')
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

// Helper to set nested values
const setNestedValue = (obj, path, value) => {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => current[key], obj);
  target[lastKey] = value;
};

module.exports = {
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
  sanitizeObject,
};