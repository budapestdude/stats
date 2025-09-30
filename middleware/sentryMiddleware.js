const sentryConfig = require('../config/sentry');
const { logger } = require('./errorHandler');

class SentryMiddleware {
  constructor() {
    this.isEnabled = false;
  }

  initialize(app) {
    this.isEnabled = sentryConfig.initialize();
    
    if (this.isEnabled && app) {
      // Add Sentry request handler (must be first middleware)
      app.use(sentryConfig.requestHandler());
      
      // Add tracing handler
      app.use(sentryConfig.tracingHandler());
      
      console.log('✅ Sentry middleware initialized');
    }
    
    return this.isEnabled;
  }

  // Error handling middleware (must be added last)
  errorHandler() {
    if (!this.isEnabled) {
      return (err, req, res, next) => next(err);
    }

    return sentryConfig.errorHandler();
  }

  // Performance monitoring middleware
  performanceMiddleware() {
    return (req, res, next) => {
      if (!this.isEnabled) {
        return next();
      }

      const startTime = Date.now();
      const transactionName = `${req.method} ${req.route?.path || req.path}`;
      const transaction = sentryConfig.startTransaction(transactionName, 'http.server');
      
      // Store transaction in request for later use
      req.sentryTransaction = transaction;
      
      // Add breadcrumb for the request
      sentryConfig.addBreadcrumb(
        `${req.method} ${req.originalUrl}`,
        'http',
        'info',
        {
          method: req.method,
          url: req.originalUrl,
          user_agent: req.get('User-Agent'),
          ip: req.ip
        }
      );

      // Monitor response
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        const duration = Date.now() - startTime;
        
        // Set transaction status based on response
        if (res.statusCode >= 400) {
          transaction.setHttpStatus(res.statusCode);
          
          if (res.statusCode >= 500) {
            transaction.setStatus('internal_error');
          } else {
            transaction.setStatus('invalid_argument');
          }
        } else {
          transaction.setStatus('ok');
        }
        
        // Add tags
        transaction.setTag('http.status_code', res.statusCode);
        transaction.setTag('http.method', req.method);
        transaction.setTag('endpoint', req.route?.path || req.path);
        
        // Set measurement
        transaction.setMeasurement('http.response_time', duration, 'millisecond');
        
        // Finish transaction
        transaction.finish();
        
        // Call original end
        originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  // Rate limiting error tracking
  rateLimitErrorMiddleware() {
    return (req, res, next) => {
      if (!this.isEnabled) {
        return next();
      }

      // Track rate limit hits
      const originalStatus = res.status;
      res.status = function(statusCode) {
        if (statusCode === 429) {
          sentryConfig.addBreadcrumb(
            'Rate limit exceeded',
            'http',
            'warning',
            {
              ip: req.ip,
              endpoint: req.originalUrl,
              user_agent: req.get('User-Agent')
            }
          );
          
          sentryConfig.captureMessage(
            `Rate limit exceeded for ${req.ip}`,
            'warning',
            {
              endpoint: req.originalUrl,
              ip: req.ip,
              extra: {
                headers: req.headers,
                method: req.method
              }
            }
          );
        }
        
        return originalStatus.call(this, statusCode);
      };

      next();
    };
  }

  // Database error tracking
  databaseErrorMiddleware() {
    return (req, res, next) => {
      if (!this.isEnabled) {
        return next();
      }

      // Wrap database operations to catch errors
      const originalQuery = req.db?.query;
      if (originalQuery) {
        req.db.query = function(...args) {
          const startTime = Date.now();
          
          return originalQuery.apply(this, args).catch(error => {
            const duration = Date.now() - startTime;
            
            sentryConfig.captureError(error, {
              level: 'error',
              tags: {
                type: 'database_error',
                endpoint: req.originalUrl,
                method: req.method
              },
              extra: {
                query_duration: duration,
                sql_query: args[0],
                parameters: args[1]
              }
            });
            
            throw error;
          });
        };
      }

      next();
    };
  }

  // External API error tracking
  externalAPIErrorMiddleware() {
    return (req, res, next) => {
      if (!this.isEnabled) {
        return next();
      }

      // Store original request info for API error context
      req.sentryContext = {
        endpoint: req.originalUrl,
        method: req.method,
        user_agent: req.get('User-Agent'),
        ip: req.ip
      };

      next();
    };
  }

  // User context middleware
  userContextMiddleware() {
    return (req, res, next) => {
      if (!this.isEnabled) {
        return next();
      }

      // Set user context if available
      if (req.user) {
        sentryConfig.setUser({
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
          ip_address: req.ip
        });
      }

      // Add tags for request context
      sentryConfig.setTag('endpoint', req.route?.path || req.path);
      sentryConfig.setTag('method', req.method);
      sentryConfig.setTag('user_type', req.user?.role || 'anonymous');

      next();
    };
  }

  // Helper method to capture API errors
  captureAPIError(error, apiName, endpoint, context = {}) {
    if (!this.isEnabled) {
      return;
    }

    sentryConfig.captureError(error, {
      level: 'error',
      tags: {
        type: 'external_api_error',
        api: apiName,
        api_endpoint: endpoint,
        ...context.tags
      },
      extra: {
        api_name: apiName,
        api_endpoint: endpoint,
        ...context.extra
      }
    });
  }

  // Helper method to track performance metrics
  trackPerformanceMetric(name, value, unit = 'millisecond', tags = {}) {
    if (!this.isEnabled) {
      return;
    }

    const transaction = sentryConfig.startTransaction(
      `performance.${name}`,
      'performance'
    );

    Object.entries(tags).forEach(([key, value]) => {
      transaction.setTag(key, value);
    });

    transaction.setMeasurement(name, value, unit);
    transaction.finish();
  }

  // Health check for Sentry
  healthCheck() {
    return {
      enabled: this.isEnabled,
      environment: process.env.NODE_ENV,
      dsn_configured: !!process.env.SENTRY_DSN,
      status: this.isEnabled ? 'operational' : 'disabled'
    };
  }

  // Manual error reporting helper
  reportError(error, req, additionalContext = {}) {
    if (!this.isEnabled) {
      return;
    }

    const context = {
      level: 'error',
      tags: {
        endpoint: req?.originalUrl,
        method: req?.method,
        user_id: req?.user?.id
      },
      extra: {
        url: req?.originalUrl,
        method: req?.method,
        headers: req?.headers,
        body: req?.body,
        query: req?.query,
        params: req?.params,
        ip: req?.ip,
        user_agent: req?.get?.('User-Agent'),
        ...additionalContext
      }
    };

    if (req?.user) {
      context.user = {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email
      };
    }

    sentryConfig.captureError(error, context);
  }

  // Graceful shutdown
  async shutdown() {
    if (this.isEnabled) {
      logger.info('Shutting down Sentry...');
      await sentryConfig.close();
      logger.info('Sentry shutdown complete');
    }
  }
}

// Export singleton instance
const sentryMiddleware = new SentryMiddleware();
module.exports = sentryMiddleware;