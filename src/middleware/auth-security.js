const { validateRequest } = require('./validation');
const { authLimiter, strictLimiter } = require('./security');
const logger = require('../utils/logger');

// Validation rules for authentication endpoints
const authValidationRules = {
  register: {
    'body.username': { type: 'username', required: true },
    'body.email': { type: 'email', required: true },
    'body.password': { type: 'password', required: true },
    'body.firstName': { type: 'string', required: false },
    'body.lastName': { type: 'string', required: false },
  },
  
  login: {
    'body.email': { type: 'email', required: true },
    'body.password': { type: 'password', required: true },
  },
  
  forgotPassword: {
    'body.email': { type: 'email', required: true },
  },
  
  resetPassword: {
    'body.token': { type: 'string', required: true },
    'body.password': { type: 'password', required: true },
  },
  
  changePassword: {
    'body.oldPassword': { type: 'password', required: true },
    'body.newPassword': { type: 'password', required: true },
  },
  
  updateProfile: {
    'body.username': { type: 'username', required: false },
    'body.firstName': { type: 'string', required: false },
    'body.lastName': { type: 'string', required: false },
    'body.bio': { type: 'string', required: false },
  },
};

// Brute force protection for authentication attempts
const bruteForcePrevention = new Map();

const checkBruteForce = (identifier) => {
  const attempts = bruteForcePrevention.get(identifier) || { count: 0, lastAttempt: Date.now() };
  const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
  
  // Reset counter after 15 minutes
  if (timeSinceLastAttempt > 15 * 60 * 1000) {
    attempts.count = 0;
  }
  
  // Check if account is locked
  if (attempts.count >= 5) {
    const lockoutTime = Math.min(attempts.count * 5, 60) * 60 * 1000; // Progressive lockout up to 1 hour
    if (timeSinceLastAttempt < lockoutTime) {
      return {
        locked: true,
        remainingTime: Math.ceil((lockoutTime - timeSinceLastAttempt) / 1000),
      };
    }
    attempts.count = 0; // Reset after lockout expires
  }
  
  return { locked: false, attempts: attempts.count };
};

const recordFailedAttempt = (identifier) => {
  const attempts = bruteForcePrevention.get(identifier) || { count: 0, lastAttempt: Date.now() };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  bruteForcePrevention.set(identifier, attempts);
  
  logger.warn('Failed authentication attempt', {
    identifier,
    attemptCount: attempts.count,
  });
};

const clearFailedAttempts = (identifier) => {
  bruteForcePrevention.delete(identifier);
};

// Middleware to prevent brute force attacks
const bruteForcePreventer = (req, res, next) => {
  const identifier = req.body.email || req.ip;
  const status = checkBruteForce(identifier);
  
  if (status.locked) {
    logger.warn('Account locked due to too many failed attempts', {
      identifier,
      remainingTime: status.remainingTime,
    });
    
    return res.status(429).json({
      error: 'Too many failed attempts',
      message: `Account locked. Please try again in ${status.remainingTime} seconds.`,
      retryAfter: status.remainingTime,
    });
  }
  
  // Store identifier for use in route handler
  req.bruteForceIdentifier = identifier;
  next();
};

// Password strength requirements
const passwordRequirements = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  bannedPasswords: [
    'password', '12345678', 'qwerty', 'abc123', 'password123',
    'admin', 'letmein', 'welcome', 'monkey', '123456789',
  ],
};

// Check password against common patterns
const checkPasswordStrength = (password) => {
  const issues = [];
  
  if (password.length < passwordRequirements.minLength) {
    issues.push(`Password must be at least ${passwordRequirements.minLength} characters`);
  }
  
  if (password.length > passwordRequirements.maxLength) {
    issues.push(`Password must not exceed ${passwordRequirements.maxLength} characters`);
  }
  
  if (passwordRequirements.requireUppercase && !/[A-Z]/.test(password)) {
    issues.push('Password must contain at least one uppercase letter');
  }
  
  if (passwordRequirements.requireLowercase && !/[a-z]/.test(password)) {
    issues.push('Password must contain at least one lowercase letter');
  }
  
  if (passwordRequirements.requireNumbers && !/\d/.test(password)) {
    issues.push('Password must contain at least one number');
  }
  
  if (passwordRequirements.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    issues.push('Password must contain at least one special character');
  }
  
  if (passwordRequirements.bannedPasswords.includes(password.toLowerCase())) {
    issues.push('This password is too common. Please choose a stronger password');
  }
  
  // Check for sequential characters
  if (/abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(password)) {
    issues.push('Password should not contain sequential characters');
  }
  
  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    issues.push('Password should not contain more than 2 repeated characters');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    strength: calculatePasswordStrength(password),
  };
};

// Calculate password strength score
const calculatePasswordStrength = (password) => {
  let strength = 0;
  
  // Length score
  strength += Math.min(password.length * 4, 40);
  
  // Character variety score
  if (/[a-z]/.test(password)) strength += 10;
  if (/[A-Z]/.test(password)) strength += 10;
  if (/\d/.test(password)) strength += 10;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 20;
  
  // Deductions
  if (/^[a-zA-Z]+$/.test(password)) strength -= 10;
  if (/^\d+$/.test(password)) strength -= 10;
  
  // Calculate strength level
  if (strength < 30) return 'weak';
  if (strength < 50) return 'fair';
  if (strength < 70) return 'good';
  if (strength < 90) return 'strong';
  return 'very strong';
};

// Two-factor authentication check
const requireTwoFactor = (req, res, next) => {
  // Check if user has 2FA enabled
  if (req.user && req.user.twoFactorEnabled) {
    const token = req.headers['x-2fa-token'] || req.body.twoFactorToken;
    
    if (!token) {
      return res.status(401).json({
        error: 'Two-factor authentication required',
        message: 'Please provide your 2FA token',
        require2FA: true,
      });
    }
    
    // Validate 2FA token (implementation depends on 2FA method)
    // This is a placeholder
    if (!validate2FAToken(token, req.user.twoFactorSecret)) {
      return res.status(401).json({
        error: 'Invalid 2FA token',
        message: 'The provided 2FA token is invalid or expired',
      });
    }
  }
  
  next();
};

// Placeholder for 2FA validation
const validate2FAToken = (token, secret) => {
  // In production, use a library like speakeasy or otplib
  return true;
};

// Account lockout policy
const accountLockout = {
  maxAttempts: 5,
  lockoutDuration: 30 * 60 * 1000, // 30 minutes
  progressiveLockout: true,
};

// IP-based suspicious activity detection
const suspiciousActivityDetector = (req, res, next) => {
  const ip = req.ip;
  const userAgent = req.headers['user-agent'];
  
  // Check for suspicious patterns
  const suspicious = [];
  
  // No user agent
  if (!userAgent) {
    suspicious.push('Missing user agent');
  }
  
  // Known bot user agents
  const botPatterns = /bot|crawler|spider|scraper|curl|wget|python|java|ruby/i;
  if (userAgent && botPatterns.test(userAgent)) {
    suspicious.push('Bot-like user agent');
  }
  
  // Multiple account creation from same IP
  // This would need to track in database/Redis
  
  if (suspicious.length > 0) {
    logger.warn('Suspicious activity detected', {
      ip,
      userAgent,
      patterns: suspicious,
      path: req.path,
    });
    
    // Could implement additional checks or challenges here
  }
  
  next();
};

// Apply auth-specific security
const applyAuthSecurity = (router) => {
  // Registration endpoint
  router.post('/register',
    authLimiter,
    suspiciousActivityDetector,
    validateRequest(authValidationRules.register),
    (req, res, next) => {
      const passwordCheck = checkPasswordStrength(req.body.password);
      if (!passwordCheck.valid) {
        return res.status(400).json({
          error: 'Weak password',
          issues: passwordCheck.issues,
          strength: passwordCheck.strength,
        });
      }
      next();
    }
  );
  
  // Login endpoint
  router.post('/login',
    authLimiter,
    bruteForcePreventer,
    validateRequest(authValidationRules.login)
  );
  
  // Password reset endpoints
  router.post('/forgot-password',
    strictLimiter,
    validateRequest(authValidationRules.forgotPassword)
  );
  
  router.post('/reset-password',
    strictLimiter,
    validateRequest(authValidationRules.resetPassword)
  );
  
  // Protected endpoints
  router.post('/change-password',
    requireTwoFactor,
    validateRequest(authValidationRules.changePassword)
  );
  
  router.put('/profile',
    validateRequest(authValidationRules.updateProfile)
  );
  
  logger.info('Auth-specific security applied');
};

module.exports = {
  authValidationRules,
  checkBruteForce,
  recordFailedAttempt,
  clearFailedAttempts,
  bruteForcePreventer,
  checkPasswordStrength,
  calculatePasswordStrength,
  requireTwoFactor,
  suspiciousActivityDetector,
  applyAuthSecurity,
};