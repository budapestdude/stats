const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');

class SentryConfig {
  constructor() {
    this.dsn = process.env.SENTRY_DSN || '';
    this.environment = process.env.NODE_ENV || 'development';
    this.release = process.env.npm_package_version || '1.0.0';
    this.serverName = process.env.SERVER_NAME || 'chess-stats-api';
    this.sampleRate = parseFloat(process.env.SENTRY_SAMPLE_RATE) || 1.0;
    this.tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1;
    this.profilesSampleRate = parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE) || 0.1;
  }

  initialize() {
    if (!this.dsn && this.environment === 'production') {
      console.warn('⚠️ Sentry DSN not configured for production environment');
      return false;
    }

    if (!this.dsn) {
      console.log('ℹ️ Sentry disabled (no DSN configured)');
      return false;
    }

    try {
      Sentry.init({
        dsn: this.dsn,
        environment: this.environment,
        release: this.release,
        serverName: this.serverName,
        
        // Performance monitoring
        sampleRate: this.sampleRate,
        tracesSampleRate: this.tracesSampleRate,
        profilesSampleRate: this.profilesSampleRate,
        
        // Integrations
        integrations: [
          // HTTP integration for tracing HTTP requests
          new Sentry.Integrations.Http({ tracing: true }),
          
          // Express integration for request handling
          new Sentry.Integrations.Express({ app: null }), // App will be set later
          
          // Profiling integration
          nodeProfilingIntegration(),
          
          // Node-specific integrations
          new Sentry.Integrations.OnUncaughtException({
            onFatalError: (err) => {
              console.error('💥 Fatal uncaught exception:', err);
              process.exit(1);
            }
          }),
          
          new Sentry.Integrations.OnUnhandledRejection({
            mode: 'warn'
          }),
          
          // Context integration for additional data
          new Sentry.Integrations.Context({
            app: true,
            device: true,
            os: true,
            culture: true
          })
        ],
        
        // Before send hook to filter sensitive data
        beforeSend: (event, hint) => {
          // Remove sensitive data
          if (event.request) {
            // Filter query parameters
            if (event.request.query_string) {
              event.request.query_string = this.filterSensitiveData(event.request.query_string);
            }
            
            // Filter headers
            if (event.request.headers) {
              delete event.request.headers.authorization;
              delete event.request.headers.cookie;
              delete event.request.headers['x-api-key'];
            }
            
            // Filter body data
            if (event.request.data) {
              event.request.data = this.filterSensitiveData(event.request.data);
            }
          }
          
          // Filter exception data
          if (event.exception) {
            event.exception.values = event.exception.values.map(exception => ({
              ...exception,
              stacktrace: {
                ...exception.stacktrace,
                frames: exception.stacktrace?.frames?.map(frame => ({
                  ...frame,
                  vars: this.filterSensitiveData(frame.vars || {})
                }))
              }
            }));
          }
          
          return event;
        },
        
        // Before breadcrumb to filter breadcrumb data
        beforeBreadcrumb: (breadcrumb) => {
          // Filter HTTP breadcrumbs
          if (breadcrumb.category === 'http') {
            if (breadcrumb.data) {
              delete breadcrumb.data.headers?.authorization;
              delete breadcrumb.data.headers?.cookie;
            }
          }
          
          return breadcrumb;
        },
        
        // Additional options
        debug: this.environment === 'development',
        maxBreadcrumbs: 50,
        attachStacktrace: true,
        sendDefaultPii: false,
        
        // Tag configuration
        initialScope: {
          tags: {
            component: 'backend',
            service: 'chess-stats'
          },
          contexts: {
            app: {
              name: 'Chess Stats API',
              version: this.release
            }
          }
        }
      });

      console.log('✅ Sentry initialized successfully');
      console.log(`   Environment: ${this.environment}`);
      console.log(`   Release: ${this.release}`);
      console.log(`   Sample Rate: ${this.sampleRate * 100}%`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize Sentry:', error.message);
      return false;
    }
  }

  filterSensitiveData(data) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const filtered = { ...data };
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'authorization', 
      'auth', 'session', 'cookie', 'csrf', 'api_key',
      'access_token', 'refresh_token', 'jwt'
    ];

    Object.keys(filtered).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        filtered[key] = '[Filtered]';
      }
    });

    return filtered;
  }

  // Express middleware for request tracing
  requestHandler() {
    return Sentry.Handlers.requestHandler({
      user: ['id', 'username', 'email'],
      request: ['method', 'url', 'headers', 'data'],
      transaction: 'methodPath'
    });
  }

  // Express middleware for tracing
  tracingHandler() {
    return Sentry.Handlers.tracingHandler();
  }

  // Express error handler
  errorHandler() {
    return Sentry.Handlers.errorHandler({
      shouldHandleError: (error) => {
        // Only send errors that are 500+ status codes
        return error.status >= 500;
      }
    });
  }

  // Manual error capture
  captureError(error, context = {}) {
    if (this.environment === 'test') {
      return; // Don't capture errors during testing
    }

    Sentry.withScope((scope) => {
      // Add context
      Object.entries(context).forEach(([key, value]) => {
        scope.setTag(key, value);
      });

      // Add extra data
      if (context.extra) {
        scope.setExtras(context.extra);
      }

      // Add user context
      if (context.user) {
        scope.setUser(context.user);
      }

      // Set level
      scope.setLevel(context.level || 'error');

      Sentry.captureException(error);
    });
  }

  // Manual message capture
  captureMessage(message, level = 'info', context = {}) {
    if (this.environment === 'test') {
      return;
    }

    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setTag(key, value);
      });

      if (context.extra) {
        scope.setExtras(context.extra);
      }

      scope.setLevel(level);
      Sentry.captureMessage(message);
    });
  }

  // Add breadcrumb
  addBreadcrumb(message, category = 'default', level = 'info', data = {}) {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data: this.filterSensitiveData(data),
      timestamp: Date.now() / 1000
    });
  }

  // Performance monitoring helpers
  startTransaction(name, operation = 'http') {
    return Sentry.startTransaction({ name, op: operation });
  }

  // Set user context
  setUser(user) {
    Sentry.setUser({
      id: user.id,
      username: user.username,
      email: user.email,
      ip_address: user.ip_address
    });
  }

  // Set tags
  setTag(key, value) {
    Sentry.setTag(key, value);
  }

  // Close Sentry connection
  async close(timeout = 2000) {
    await Sentry.close(timeout);
  }
}

// Export singleton instance
const sentryConfig = new SentryConfig();
module.exports = sentryConfig;