const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const os = require('os');
const fs = require('fs');

/**
 * Production monitoring and logging setup
 */

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// JSON format for production
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? jsonFormat : logFormat,
  defaultMeta: { 
    service: 'chess-stats',
    environment: process.env.NODE_ENV,
    hostname: os.hostname()
  },
  transports: [
    // Error logs
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    }),
    
    // Combined logs
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    }),
    
    // Access logs
    new DailyRotateFile({
      filename: path.join(logsDir, 'access-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'http',
      maxSize: '20m',
      maxFiles: '7d',
      zippedArchive: true
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Performance monitoring
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: new Map(),
      database: new Map(),
      cache: {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0
      },
      errors: new Map()
    };
    
    // Reset metrics periodically
    setInterval(() => this.resetMetrics(), 3600000); // Every hour
  }
  
  // Track request performance
  trackRequest(endpoint, duration, statusCode) {
    if (!this.metrics.requests.has(endpoint)) {
      this.metrics.requests.set(endpoint, {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        errors: 0
      });
    }
    
    const metric = this.metrics.requests.get(endpoint);
    metric.count++;
    metric.totalDuration += duration;
    metric.avgDuration = metric.totalDuration / metric.count;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    
    if (statusCode >= 400) {
      metric.errors++;
    }
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        endpoint,
        duration,
        statusCode
      });
    }
  }
  
  // Track database query performance
  trackDatabaseQuery(query, duration) {
    const queryKey = query.substring(0, 50); // Truncate for grouping
    
    if (!this.metrics.database.has(queryKey)) {
      this.metrics.database.set(queryKey, {
        count: 0,
        totalDuration: 0,
        avgDuration: 0
      });
    }
    
    const metric = this.metrics.database.get(queryKey);
    metric.count++;
    metric.totalDuration += duration;
    metric.avgDuration = metric.totalDuration / metric.count;
    
    // Log slow queries
    if (duration > 500) {
      logger.warn('Slow database query', {
        query: queryKey,
        duration
      });
    }
  }
  
  // Track cache operations
  trackCache(operation) {
    this.metrics.cache[operation]++;
  }
  
  // Track errors
  trackError(error, context) {
    const errorKey = error.name || 'UnknownError';
    
    if (!this.metrics.errors.has(errorKey)) {
      this.metrics.errors.set(errorKey, {
        count: 0,
        lastOccurred: null,
        contexts: []
      });
    }
    
    const metric = this.metrics.errors.get(errorKey);
    metric.count++;
    metric.lastOccurred = new Date();
    metric.contexts.push(context);
    
    // Keep only last 10 contexts
    if (metric.contexts.length > 10) {
      metric.contexts.shift();
    }
    
    logger.error('Error tracked', {
      error: error.message,
      stack: error.stack,
      context
    });
  }
  
  // Get current metrics
  getMetrics() {
    const requestMetrics = {};
    this.metrics.requests.forEach((value, key) => {
      requestMetrics[key] = value;
    });
    
    const databaseMetrics = {};
    this.metrics.database.forEach((value, key) => {
      databaseMetrics[key] = value;
    });
    
    const errorMetrics = {};
    this.metrics.errors.forEach((value, key) => {
      errorMetrics[key] = {
        count: value.count,
        lastOccurred: value.lastOccurred
      };
    });
    
    return {
      requests: requestMetrics,
      database: databaseMetrics,
      cache: this.metrics.cache,
      errors: errorMetrics,
      system: this.getSystemMetrics()
    };
  }
  
  // Get system metrics
  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      },
      cpu: {
        user: Math.round(cpuUsage.user / 1000000), // Convert to seconds
        system: Math.round(cpuUsage.system / 1000000)
      },
      uptime: Math.round(process.uptime()),
      loadAverage: os.loadavg(),
      freeMemory: Math.round(os.freemem() / 1024 / 1024),
      totalMemory: Math.round(os.totalmem() / 1024 / 1024)
    };
  }
  
  // Reset metrics
  resetMetrics() {
    this.metrics.requests.clear();
    this.metrics.database.clear();
    this.metrics.cache = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    logger.info('Metrics reset');
  }
}

// Health check system
class HealthChecker {
  constructor() {
    this.checks = new Map();
    this.status = 'healthy';
    this.lastCheck = null;
  }
  
  // Register a health check
  registerCheck(name, checkFn, critical = false) {
    this.checks.set(name, {
      fn: checkFn,
      critical,
      status: 'unknown',
      lastCheck: null,
      message: null
    });
  }
  
  // Run all health checks
  async runChecks() {
    const results = {};
    let overallStatus = 'healthy';
    
    for (const [name, check] of this.checks) {
      try {
        const result = await check.fn();
        check.status = result.status || 'healthy';
        check.message = result.message || null;
        check.lastCheck = new Date();
        
        results[name] = {
          status: check.status,
          message: check.message,
          critical: check.critical
        };
        
        if (check.status !== 'healthy') {
          if (check.critical) {
            overallStatus = 'unhealthy';
          } else if (overallStatus !== 'unhealthy') {
            overallStatus = 'degraded';
          }
        }
      } catch (error) {
        check.status = 'unhealthy';
        check.message = error.message;
        check.lastCheck = new Date();
        
        results[name] = {
          status: 'unhealthy',
          message: error.message,
          critical: check.critical
        };
        
        if (check.critical) {
          overallStatus = 'unhealthy';
        }
        
        logger.error(`Health check failed: ${name}`, error);
      }
    }
    
    this.status = overallStatus;
    this.lastCheck = new Date();
    
    return {
      status: overallStatus,
      timestamp: this.lastCheck,
      checks: results
    };
  }
  
  // Get current status
  getStatus() {
    const checks = {};
    this.checks.forEach((value, key) => {
      checks[key] = {
        status: value.status,
        message: value.message,
        critical: value.critical,
        lastCheck: value.lastCheck
      };
    });
    
    return {
      status: this.status,
      lastCheck: this.lastCheck,
      checks
    };
  }
}

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log response after it's sent
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.http('Request processed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    
    // Track in performance monitor
    if (monitor) {
      monitor.trackRequest(`${req.method} ${req.route?.path || req.path}`, duration, res.statusCode);
    }
  });
  
  next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  
  // Track in performance monitor
  if (monitor) {
    monitor.trackError(err, {
      method: req.method,
      url: req.url
    });
  }
  
  next(err);
};

// Create singleton instances
const monitor = new PerformanceMonitor();
const healthChecker = new HealthChecker();

// Export monitoring utilities
module.exports = {
  logger,
  monitor,
  healthChecker,
  requestLogger,
  errorLogger,
  PerformanceMonitor,
  HealthChecker
};