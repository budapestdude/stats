const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const EventEmitter = require('events');

/**
 * Application Monitoring Service
 * Tracks performance metrics, health status, and system resources
 */
class MonitoringService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      interval: options.interval || 60000, // 1 minute default
      retentionDays: options.retentionDays || 7,
      metricsPath: options.metricsPath || path.join(__dirname, '../../metrics'),
      enableFileLogging: options.enableFileLogging !== false,
      ...options
    };
    
    // Metrics storage
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        failed: 0,
        byEndpoint: new Map(),
        byStatusCode: new Map(),
        responseTime: []
      },
      database: {
        queries: 0,
        slowQueries: [],
        errors: 0,
        cacheHits: 0,
        cacheMisses: 0,
        connectionPool: {
          created: 0,
          active: 0,
          idle: 0,
          waiting: 0
        }
      },
      system: {
        cpu: [],
        memory: [],
        uptime: 0,
        startTime: Date.now()
      },
      errors: [],
      alerts: []
    };
    
    // Performance tracking
    this.performanceMarks = new Map();
    this.slowQueryThreshold = 1000; // 1 second
    this.slowRequestThreshold = 3000; // 3 seconds
    
    // Health checks
    this.healthChecks = new Map();
    this.healthStatus = 'healthy';
    
    this.intervalId = null;
  }

  /**
   * Start monitoring
   */
  async start() {
    logger.info('Starting monitoring service');
    
    // Create metrics directory if needed
    if (this.options.enableFileLogging) {
      await this.ensureMetricsDirectory();
    }
    
    // Start collection interval
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, this.options.interval);
    
    // Initial collection
    this.collectMetrics();
    
    // Clean old metrics daily
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 24 * 60 * 60 * 1000);
    
    this.emit('started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    logger.info('Monitoring service stopped');
    this.emit('stopped');
  }

  /**
   * Record HTTP request
   */
  recordRequest(req, res, duration) {
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    const statusCode = res.statusCode;
    
    // Update totals
    this.metrics.requests.total++;
    
    if (statusCode >= 200 && statusCode < 400) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.failed++;
    }
    
    // Update by endpoint
    if (!this.metrics.requests.byEndpoint.has(endpoint)) {
      this.metrics.requests.byEndpoint.set(endpoint, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0
      });
    }
    
    const endpointMetrics = this.metrics.requests.byEndpoint.get(endpoint);
    endpointMetrics.count++;
    endpointMetrics.totalTime += duration;
    endpointMetrics.avgTime = endpointMetrics.totalTime / endpointMetrics.count;
    endpointMetrics.minTime = Math.min(endpointMetrics.minTime, duration);
    endpointMetrics.maxTime = Math.max(endpointMetrics.maxTime, duration);
    
    // Update by status code
    const statusGroup = `${Math.floor(statusCode / 100)}xx`;
    this.metrics.requests.byStatusCode.set(
      statusGroup,
      (this.metrics.requests.byStatusCode.get(statusGroup) || 0) + 1
    );
    
    // Track response time distribution
    this.metrics.requests.responseTime.push({
      timestamp: Date.now(),
      duration,
      endpoint,
      statusCode
    });
    
    // Keep only last 1000 entries
    if (this.metrics.requests.responseTime.length > 1000) {
      this.metrics.requests.responseTime.shift();
    }
    
    // Check for slow requests
    if (duration > this.slowRequestThreshold) {
      this.addAlert('slow-request', `Slow request: ${endpoint} took ${duration}ms`, {
        endpoint,
        duration,
        statusCode
      });
    }
    
    this.emit('request', { endpoint, statusCode, duration });
  }

  /**
   * Record database query
   */
  recordQuery(query, duration, success = true, cacheHit = false) {
    this.metrics.database.queries++;
    
    if (cacheHit) {
      this.metrics.database.cacheHits++;
    } else {
      this.metrics.database.cacheMisses++;
    }
    
    if (!success) {
      this.metrics.database.errors++;
    }
    
    // Track slow queries
    if (duration > this.slowQueryThreshold && !cacheHit) {
      this.metrics.database.slowQueries.push({
        timestamp: Date.now(),
        query: query.substring(0, 200),
        duration
      });
      
      // Keep only last 100 slow queries
      if (this.metrics.database.slowQueries.length > 100) {
        this.metrics.database.slowQueries.shift();
      }
      
      this.addAlert('slow-query', `Slow query: ${duration}ms`, {
        query: query.substring(0, 100),
        duration
      });
    }
    
    this.emit('query', { duration, success, cacheHit });
  }

  /**
   * Update connection pool metrics
   */
  updatePoolMetrics(poolStats) {
    this.metrics.database.connectionPool = {
      created: poolStats.created,
      active: poolStats.activeCount,
      idle: poolStats.idleCount,
      waiting: poolStats.waitingCount
    };
  }

  /**
   * Record error
   */
  recordError(error, context = {}) {
    const errorInfo = {
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      context
    };
    
    this.metrics.errors.push(errorInfo);
    
    // Keep only last 500 errors
    if (this.metrics.errors.length > 500) {
      this.metrics.errors.shift();
    }
    
    // Add alert for critical errors
    if (context.critical) {
      this.addAlert('critical-error', error.message, context);
    }
    
    this.emit('error', errorInfo);
  }

  /**
   * Add alert
   */
  addAlert(type, message, data = {}) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      data,
      timestamp: Date.now(),
      resolved: false
    };
    
    this.metrics.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.metrics.alerts.length > 100) {
      this.metrics.alerts.shift();
    }
    
    logger.warn(`Alert: ${type} - ${message}`, data);
    this.emit('alert', alert);
    
    return alert.id;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId) {
    const alert = this.metrics.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
    }
  }

  /**
   * Register health check
   */
  registerHealthCheck(name, checkFn, options = {}) {
    this.healthChecks.set(name, {
      fn: checkFn,
      interval: options.interval || 30000,
      timeout: options.timeout || 5000,
      critical: options.critical !== false,
      lastCheck: null,
      lastResult: null,
      failures: 0
    });
  }

  /**
   * Run health checks
   */
  async runHealthChecks() {
    const results = new Map();
    let overallHealth = 'healthy';
    
    for (const [name, check] of this.healthChecks) {
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), check.timeout)
        );
        
        const result = await Promise.race([check.fn(), timeoutPromise]);
        
        results.set(name, {
          status: 'healthy',
          message: result.message || 'OK',
          data: result.data
        });
        
        check.lastResult = 'healthy';
        check.failures = 0;
        
      } catch (error) {
        results.set(name, {
          status: 'unhealthy',
          message: error.message,
          error: error.stack
        });
        
        check.lastResult = 'unhealthy';
        check.failures++;
        
        if (check.critical) {
          overallHealth = 'unhealthy';
        } else if (overallHealth === 'healthy') {
          overallHealth = 'degraded';
        }
        
        // Add alert after 3 consecutive failures
        if (check.failures >= 3) {
          this.addAlert('health-check-failed', `Health check '${name}' failed`, {
            check: name,
            failures: check.failures,
            error: error.message
          });
        }
      }
      
      check.lastCheck = Date.now();
    }
    
    this.healthStatus = overallHealth;
    return { status: overallHealth, checks: Object.fromEntries(results) };
  }

  /**
   * Collect system metrics
   */
  async collectMetrics() {
    // CPU usage
    const cpus = os.cpus();
    const cpuUsage = cpus.map(cpu => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return ((total - idle) / total) * 100;
    });
    
    this.metrics.system.cpu.push({
      timestamp: Date.now(),
      usage: cpuUsage.reduce((a, b) => a + b, 0) / cpuUsage.length
    });
    
    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    this.metrics.system.memory.push({
      timestamp: Date.now(),
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percentage: (usedMem / totalMem) * 100
    });
    
    // Keep only last hour of system metrics
    const oneHourAgo = Date.now() - 3600000;
    this.metrics.system.cpu = this.metrics.system.cpu.filter(m => m.timestamp > oneHourAgo);
    this.metrics.system.memory = this.metrics.system.memory.filter(m => m.timestamp > oneHourAgo);
    
    // Update uptime
    this.metrics.system.uptime = Date.now() - this.metrics.system.startTime;
    
    // Run health checks
    await this.runHealthChecks();
    
    // Save metrics to file if enabled
    if (this.options.enableFileLogging) {
      await this.saveMetrics();
    }
    
    this.emit('metrics-collected', this.getSnapshot());
  }

  /**
   * Get metrics snapshot
   */
  getSnapshot() {
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;
    
    // Calculate request rate
    const recentRequests = this.metrics.requests.responseTime.filter(
      r => r.timestamp > fiveMinutesAgo
    );
    
    const requestRate = recentRequests.length / 5; // per minute
    
    // Calculate average response time
    const avgResponseTime = recentRequests.length > 0
      ? recentRequests.reduce((sum, r) => sum + r.duration, 0) / recentRequests.length
      : 0;
    
    // Calculate cache hit rate
    const totalCacheOps = this.metrics.database.cacheHits + this.metrics.database.cacheMisses;
    const cacheHitRate = totalCacheOps > 0
      ? (this.metrics.database.cacheHits / totalCacheOps) * 100
      : 0;
    
    return {
      timestamp: now,
      uptime: this.metrics.system.uptime,
      health: this.healthStatus,
      requests: {
        total: this.metrics.requests.total,
        rate: requestRate.toFixed(2),
        avgResponseTime: avgResponseTime.toFixed(2),
        successRate: this.metrics.requests.total > 0
          ? ((this.metrics.requests.success / this.metrics.requests.total) * 100).toFixed(2)
          : 100
      },
      database: {
        queries: this.metrics.database.queries,
        cacheHitRate: cacheHitRate.toFixed(2),
        slowQueries: this.metrics.database.slowQueries.length,
        errors: this.metrics.database.errors,
        pool: this.metrics.database.connectionPool
      },
      system: {
        cpu: this.metrics.system.cpu[this.metrics.system.cpu.length - 1]?.usage.toFixed(2) || 0,
        memory: this.metrics.system.memory[this.metrics.system.memory.length - 1]?.percentage.toFixed(2) || 0
      },
      errors: this.metrics.errors.filter(e => e.timestamp > fiveMinutesAgo).length,
      alerts: this.metrics.alerts.filter(a => !a.resolved).length
    };
  }

  /**
   * Get detailed metrics
   */
  getDetailedMetrics() {
    return {
      ...this.metrics,
      snapshot: this.getSnapshot()
    };
  }

  /**
   * Save metrics to file
   */
  async saveMetrics() {
    try {
      const date = new Date().toISOString().split('T')[0];
      const filename = `metrics_${date}.json`;
      const filepath = path.join(this.options.metricsPath, filename);
      
      const data = {
        timestamp: Date.now(),
        snapshot: this.getSnapshot(),
        detailed: this.getDetailedMetrics()
      };
      
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
      
    } catch (error) {
      logger.error('Failed to save metrics', error);
    }
  }

  /**
   * Ensure metrics directory exists
   */
  async ensureMetricsDirectory() {
    try {
      await fs.mkdir(this.options.metricsPath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create metrics directory', error);
    }
  }

  /**
   * Clean up old metrics files
   */
  async cleanupOldMetrics() {
    try {
      const files = await fs.readdir(this.options.metricsPath);
      const cutoffTime = Date.now() - (this.options.retentionDays * 24 * 60 * 60 * 1000);
      
      for (const file of files) {
        if (file.startsWith('metrics_')) {
          const filepath = path.join(this.options.metricsPath, file);
          const stats = await fs.stat(filepath);
          
          if (stats.mtimeMs < cutoffTime) {
            await fs.unlink(filepath);
            logger.debug(`Deleted old metrics file: ${file}`);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old metrics', error);
    }
  }

  /**
   * Express middleware
   */
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Override res.end to capture response
      const originalEnd = res.end;
      res.end = (...args) => {
        const duration = Date.now() - startTime;
        this.recordRequest(req, res, duration);
        originalEnd.apply(res, args);
      };
      
      next();
    };
  }
}

// Create singleton instance
let monitoringInstance = null;

/**
 * Get or create monitoring instance
 */
function getMonitoring(options) {
  if (!monitoringInstance) {
    monitoringInstance = new MonitoringService(options);
  }
  return monitoringInstance;
}

module.exports = {
  MonitoringService,
  getMonitoring
};