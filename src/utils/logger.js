const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Create logs directory if it doesn't exist
const logsDir = config.logging.dir;
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels and colors
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Define format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define format for console (prettier output)
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(
    (info) => {
      const { timestamp, level, message, ...args } = info;
      const ts = timestamp.slice(0, 19).replace('T', ' ');
      return `${ts} [${level}]: ${message} ${
        Object.keys(args).length ? JSON.stringify(args, null, 2) : ''
      }`;
    }
  )
);

// Define transports
const transports = [];

// Console transport (always enabled in development)
if (config.app.isDevelopment) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: config.logging.level,
    })
  );
}

// File transport for all logs
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: config.logging.maxSize,
    maxFiles: config.logging.maxFiles,
    format,
    level: config.logging.level,
  })
);

// File transport for errors only
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: config.logging.maxSize,
    maxFiles: config.logging.maxFiles,
    format,
    level: 'error',
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Enhanced error logging functions
logger.logError = (error, context = {}) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    code: error.code,
    name: error.name,
    ...context,
  };

  // Log to appropriate level based on error type
  if (error.statusCode >= 500 || !error.statusCode) {
    logger.error('Server Error', errorInfo);
  } else if (error.statusCode >= 400) {
    logger.warn('Client Error', errorInfo);
  } else {
    logger.info('Handled Error', errorInfo);
  }

  return errorInfo;
};

// Log API requests
logger.logApiRequest = (service, endpoint, params = {}, response = null, error = null) => {
  const logData = {
    service,
    endpoint,
    params,
    timestamp: new Date().toISOString(),
  };

  if (error) {
    logger.error(`API Request Failed: ${service}`, {
      ...logData,
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.response?.status,
      },
    });
  } else {
    logger.info(`API Request Success: ${service}`, {
      ...logData,
      response: response ? { 
        status: response.status,
        dataLength: JSON.stringify(response.data || {}).length 
      } : null,
    });
  }
};

// Log database operations
logger.logDatabase = (operation, table, params = {}, error = null) => {
  const logData = {
    operation,
    table,
    params,
    timestamp: new Date().toISOString(),
  };

  if (error) {
    logger.error(`Database Error: ${operation} on ${table}`, {
      ...logData,
      error: {
        message: error.message,
        code: error.code,
      },
    });
  } else {
    logger.debug(`Database Operation: ${operation} on ${table}`, logData);
  }
};

// Log WebSocket events
logger.logWebSocket = (event, data = {}, error = null) => {
  const logData = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  if (error) {
    logger.error(`WebSocket Error: ${event}`, {
      ...logData,
      error: {
        message: error.message,
        code: error.code,
      },
    });
  } else {
    logger.debug(`WebSocket Event: ${event}`, logData);
  }
};

// Log cache operations
logger.logCache = (operation, key, hit = null, error = null) => {
  const logData = {
    operation,
    key,
    hit,
    timestamp: new Date().toISOString(),
  };

  if (error) {
    logger.error(`Cache Error: ${operation}`, {
      ...logData,
      error: {
        message: error.message,
      },
    });
  } else if (operation === 'get') {
    logger.debug(`Cache ${hit ? 'Hit' : 'Miss'}: ${key}`, logData);
  } else {
    logger.debug(`Cache ${operation}: ${key}`, logData);
  }
};

// Log authentication events
logger.logAuth = (event, userId = null, success = true, details = {}) => {
  const logData = {
    event,
    userId,
    success,
    details,
    timestamp: new Date().toISOString(),
  };

  if (!success) {
    logger.warn(`Authentication Failed: ${event}`, logData);
  } else {
    logger.info(`Authentication Success: ${event}`, logData);
  }
};

// Log performance metrics
logger.logPerformance = (operation, duration, details = {}) => {
  const logData = {
    operation,
    duration: `${duration}ms`,
    details,
    timestamp: new Date().toISOString(),
  };

  if (duration > 3000) {
    logger.warn(`Slow Operation: ${operation}`, logData);
  } else {
    logger.debug(`Performance: ${operation}`, logData);
  }
};

// Create child logger for specific modules
logger.child = (metadata) => {
  return winston.createLogger({
    level: config.logging.level,
    levels,
    format: winston.format.combine(
      winston.format.metadata({ fillWith: metadata }),
      format
    ),
    transports,
  });
};

// Log unhandled errors
if (config.app.isProduction) {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', {
      promise,
      reason: reason instanceof Error ? reason.stack : reason,
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', {
      error: error.stack,
    });
    // Give time for logs to write before exiting
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
}

// Export logger instance
module.exports = logger;