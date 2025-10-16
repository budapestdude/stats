/**
 * Real-time Performance Monitoring System
 * WebSocket-based live monitoring for chess performance and analytics
 */

const EventEmitter = require('events');
const WebSocket = require('ws');
const AnomalyDetector = require('../ml/anomaly-detector');
const VolatilityAnalyzer = require('../ml/volatility-analyzer');
const TimeSeriesForecaster = require('../ml/time-series-forecasting');

class RealTimeMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            updateInterval: options.updateInterval || 5000, // 5 seconds
            anomalyCheckInterval: options.anomalyCheckInterval || 30000, // 30 seconds
            volatilityWindow: options.volatilityWindow || 100,
            forecastHorizon: options.forecastHorizon || 10,
            maxDataPoints: options.maxDataPoints || 1000,
            alertThresholds: {
                anomalyScore: options.anomalyThreshold || 2.5,
                volatilitySpike: options.volatilityThreshold || 0.15,
                ratingDrop: options.ratingDropThreshold || 50,
                winRateDrop: options.winRateDropThreshold || 0.1
            }
        };

        // Initialize ML components
        this.anomalyDetector = new AnomalyDetector();
        this.volatilityAnalyzer = new VolatilityAnalyzer();
        this.timeSeriesForecaster = new TimeSeriesForecaster();

        // Data streams
        this.dataStreams = new Map(); // playerName -> stream data
        this.activeMonitors = new Map(); // playerName -> monitor info
        this.alerts = [];
        this.subscribers = new Set();

        // Performance metrics
        this.metrics = {
            monitorsActive: 0,
            dataPointsProcessed: 0,
            anomaliesDetected: 0,
            alertsGenerated: 0,
            forecastsGenerated: 0,
            lastUpdateTime: null
        };

        // Initialize monitoring intervals
        this.monitoringInterval = null;
        this.anomalyCheckInterval = null;
    }

    /**
     * Start monitoring system
     */
    async start() {
        console.log('🚀 Starting real-time monitoring system...');
        
        // Start periodic monitoring
        this.monitoringInterval = setInterval(
            () => this.performMonitoringCycle(),
            this.config.updateInterval
        );

        // Start periodic anomaly checking
        this.anomalyCheckInterval = setInterval(
            () => this.performAnomalyCheck(),
            this.config.anomalyCheckInterval
        );

        this.emit('system:started', {
            timestamp: new Date().toISOString(),
            config: this.config
        });

        return { success: true, message: 'Real-time monitoring started' };
    }

    /**
     * Stop monitoring system
     */
    async stop() {
        console.log('🛑 Stopping real-time monitoring system...');
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        if (this.anomalyCheckInterval) {
            clearInterval(this.anomalyCheckInterval);
            this.anomalyCheckInterval = null;
        }

        this.emit('system:stopped', {
            timestamp: new Date().toISOString(),
            metrics: this.metrics
        });

        return { success: true, message: 'Real-time monitoring stopped' };
    }

    /**
     * Add player to monitoring
     * @param {string} playerName - Player to monitor
     * @param {Object} options - Monitoring options
     */
    async addPlayerMonitor(playerName, options = {}) {
        const {
            trackRating = true,
            trackGames = true,
            trackPerformance = true,
            alertsEnabled = true,
            customThresholds = {}
        } = options;

        // Initialize data stream for player
        if (!this.dataStreams.has(playerName)) {
            this.dataStreams.set(playerName, {
                ratings: [],
                games: [],
                performance: [],
                timestamps: [],
                lastUpdate: null
            });
        }

        // Set up monitor configuration
        this.activeMonitors.set(playerName, {
            playerName,
            startTime: new Date().toISOString(),
            config: {
                trackRating,
                trackGames,
                trackPerformance,
                alertsEnabled
            },
            thresholds: { ...this.config.alertThresholds, ...customThresholds },
            status: 'active',
            lastCheck: null
        });

        this.metrics.monitorsActive++;

        this.emit('monitor:added', {
            playerName,
            timestamp: new Date().toISOString(),
            config: this.activeMonitors.get(playerName)
        });

        // Perform initial data fetch
        await this.fetchPlayerData(playerName);

        return {
            success: true,
            message: `Monitoring started for ${playerName}`,
            monitorId: `monitor_${playerName}_${Date.now()}`
        };
    }

    /**
     * Remove player from monitoring
     * @param {string} playerName - Player to stop monitoring
     */
    async removePlayerMonitor(playerName) {
        if (!this.activeMonitors.has(playerName)) {
            return { success: false, error: 'Player not being monitored' };
        }

        this.activeMonitors.delete(playerName);
        this.metrics.monitorsActive--;

        this.emit('monitor:removed', {
            playerName,
            timestamp: new Date().toISOString()
        });

        return { success: true, message: `Monitoring stopped for ${playerName}` };
    }

    /**
     * Perform monitoring cycle for all active monitors
     */
    async performMonitoringCycle() {
        const startTime = Date.now();
        const updates = [];

        for (const [playerName, monitor] of this.activeMonitors) {
            if (monitor.status !== 'active') continue;

            try {
                // Fetch latest data
                const newData = await this.fetchPlayerData(playerName);
                
                if (newData) {
                    // Process new data
                    const analysis = await this.processPlayerData(playerName, newData);
                    
                    // Check for alerts
                    if (monitor.config.alertsEnabled) {
                        const alerts = await this.checkAlerts(playerName, analysis);
                        if (alerts.length > 0) {
                            this.handleAlerts(playerName, alerts);
                        }
                    }

                    updates.push({
                        playerName,
                        analysis,
                        timestamp: new Date().toISOString()
                    });

                    // Update last check time
                    monitor.lastCheck = new Date().toISOString();
                }
            } catch (error) {
                console.error(`Error monitoring ${playerName}:`, error);
                this.emit('monitor:error', {
                    playerName,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Emit batch update
        if (updates.length > 0) {
            this.emit('data:update', {
                updates,
                cycleTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            });
        }

        this.metrics.lastUpdateTime = new Date().toISOString();
    }

    /**
     * Perform anomaly detection check
     */
    async performAnomalyCheck() {
        const anomalies = [];

        for (const [playerName, stream] of this.dataStreams) {
            if (!this.activeMonitors.has(playerName)) continue;

            try {
                // Check for anomalies in recent data
                if (stream.ratings.length >= 20) {
                    const recentRatings = stream.ratings.slice(-100);
                    const anomalyResult = await this.anomalyDetector.detectAnomalies(
                        recentRatings.map((r, i) => ({
                            timestamp: stream.timestamps[stream.timestamps.length - recentRatings.length + i],
                            value: r
                        })),
                        {
                            method: 'ensemble',
                            sensitivity: 'high',
                            includeContextual: true
                        }
                    );

                    if (anomalyResult.combinedAnomalies.length > 0) {
                        anomalies.push({
                            playerName,
                            anomalies: anomalyResult.combinedAnomalies.slice(0, 5),
                            severity: this.calculateAnomalySeverity(anomalyResult.combinedAnomalies)
                        });

                        this.metrics.anomaliesDetected += anomalyResult.combinedAnomalies.length;
                    }
                }
            } catch (error) {
                console.error(`Anomaly check error for ${playerName}:`, error);
            }
        }

        if (anomalies.length > 0) {
            this.emit('anomalies:detected', {
                anomalies,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Fetch latest player data
     * @param {string} playerName - Player name
     * @returns {Object} Latest player data
     */
    async fetchPlayerData(playerName) {
        // This would connect to your data source (Chess.com API, database, etc.)
        // For now, returning simulated data
        const stream = this.dataStreams.get(playerName);
        
        // Simulate new data point
        const lastRating = stream.ratings.length > 0 ? 
            stream.ratings[stream.ratings.length - 1] : 1500;
        
        const newRating = lastRating + (Math.random() - 0.5) * 20;
        const timestamp = new Date().toISOString();

        // Add to stream (maintain max data points)
        stream.ratings.push(newRating);
        stream.timestamps.push(timestamp);
        
        if (stream.ratings.length > this.config.maxDataPoints) {
            stream.ratings.shift();
            stream.timestamps.shift();
        }

        stream.lastUpdate = timestamp;
        this.metrics.dataPointsProcessed++;

        return {
            rating: newRating,
            timestamp,
            games: [], // Would contain recent games
            performance: { winRate: 0.5 + (Math.random() - 0.5) * 0.2 }
        };
    }

    /**
     * Process player data and generate analysis
     * @param {string} playerName - Player name
     * @param {Object} newData - New data point
     * @returns {Object} Analysis results
     */
    async processPlayerData(playerName, newData) {
        const stream = this.dataStreams.get(playerName);
        const analysis = {
            current: newData,
            trend: null,
            volatility: null,
            forecast: null,
            patterns: null
        };

        // Calculate trend
        if (stream.ratings.length >= 10) {
            const recentRatings = stream.ratings.slice(-20);
            analysis.trend = this.calculateTrend(recentRatings);
        }

        // Calculate volatility
        if (stream.ratings.length >= 30) {
            const recentRatings = stream.ratings.slice(-this.config.volatilityWindow);
            const volatilityResult = await this.volatilityAnalyzer.analyzeVolatility(
                recentRatings.map((r, i) => ({
                    timestamp: stream.timestamps[stream.timestamps.length - recentRatings.length + i],
                    value: r
                })),
                {
                    model: 'ewma',
                    includeRisk: true
                }
            );
            
            analysis.volatility = {
                current: volatilityResult.volatility.summary.current,
                average: volatilityResult.volatility.summary.mean,
                trend: volatilityResult.patterns?.persistence?.persistence || 'unknown'
            };
        }

        // Generate forecast
        if (stream.ratings.length >= 50) {
            const recentRatings = stream.ratings.slice(-100);
            const forecastResult = await this.timeSeriesForecaster.generateForecast(
                recentRatings.map((r, i) => ({
                    timestamp: stream.timestamps[stream.timestamps.length - recentRatings.length + i],
                    value: r
                })),
                {
                    horizon: this.config.forecastHorizon,
                    models: ['exponential']
                }
            );
            
            analysis.forecast = {
                values: forecastResult.ensemble.forecast,
                trend: forecastResult.ensemble.trend,
                confidence: forecastResult.ensemble.confidence
            };

            this.metrics.forecastsGenerated++;
        }

        return analysis;
    }

    /**
     * Check for alert conditions
     * @param {string} playerName - Player name
     * @param {Object} analysis - Analysis results
     * @returns {Array} Alerts to trigger
     */
    async checkAlerts(playerName, analysis) {
        const alerts = [];
        const monitor = this.activeMonitors.get(playerName);
        const thresholds = monitor.thresholds;

        // Rating drop alert
        if (analysis.trend && analysis.trend.change < -thresholds.ratingDrop) {
            alerts.push({
                type: 'rating_drop',
                severity: 'high',
                message: `Rating dropped by ${Math.abs(analysis.trend.change).toFixed(0)} points`,
                value: analysis.trend.change
            });
        }

        // Volatility spike alert
        if (analysis.volatility && analysis.volatility.current > thresholds.volatilitySpike) {
            alerts.push({
                type: 'volatility_spike',
                severity: 'medium',
                message: `High volatility detected: ${(analysis.volatility.current * 100).toFixed(2)}%`,
                value: analysis.volatility.current
            });
        }

        // Performance drop alert
        if (analysis.current.performance && 
            analysis.current.performance.winRate < (0.5 - thresholds.winRateDrop)) {
            alerts.push({
                type: 'performance_drop',
                severity: 'medium',
                message: `Win rate dropped to ${(analysis.current.performance.winRate * 100).toFixed(1)}%`,
                value: analysis.current.performance.winRate
            });
        }

        // Forecast warning
        if (analysis.forecast && analysis.forecast.trend === 'declining') {
            const projectedDrop = analysis.forecast.values[analysis.forecast.values.length - 1].value - 
                                 analysis.current.rating;
            
            if (projectedDrop < -30) {
                alerts.push({
                    type: 'forecast_warning',
                    severity: 'low',
                    message: `Projected rating drop of ${Math.abs(projectedDrop).toFixed(0)} points`,
                    value: projectedDrop
                });
            }
        }

        return alerts;
    }

    /**
     * Handle generated alerts
     * @param {string} playerName - Player name
     * @param {Array} alerts - Alerts to handle
     */
    handleAlerts(playerName, alerts) {
        for (const alert of alerts) {
            const fullAlert = {
                ...alert,
                playerName,
                timestamp: new Date().toISOString(),
                id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };

            this.alerts.push(fullAlert);
            this.metrics.alertsGenerated++;

            // Emit alert event
            this.emit('alert:generated', fullAlert);

            // Keep only recent alerts (last 100)
            if (this.alerts.length > 100) {
                this.alerts.shift();
            }
        }
    }

    /**
     * Subscribe to real-time updates via WebSocket
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} options - Subscription options
     */
    subscribeToUpdates(ws, options = {}) {
        const {
            players = [],
            events = ['data:update', 'alert:generated', 'anomalies:detected'],
            filters = {}
        } = options;

        const subscription = {
            id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ws,
            players: new Set(players),
            events: new Set(events),
            filters,
            createdAt: new Date().toISOString()
        };

        this.subscribers.add(subscription);

        // Set up event listeners for this subscription
        events.forEach(eventType => {
            const handler = (data) => {
                if (this.shouldSendUpdate(subscription, eventType, data)) {
                    this.sendWebSocketMessage(ws, {
                        type: eventType,
                        data,
                        subscriptionId: subscription.id
                    });
                }
            };

            this.on(eventType, handler);
            subscription[`handler_${eventType}`] = handler;
        });

        // Send initial state
        this.sendWebSocketMessage(ws, {
            type: 'subscription:confirmed',
            subscriptionId: subscription.id,
            currentState: this.getCurrentState(players)
        });

        // Handle WebSocket close
        ws.on('close', () => {
            this.unsubscribe(subscription);
        });

        return subscription.id;
    }

    /**
     * Unsubscribe from updates
     * @param {Object} subscription - Subscription to remove
     */
    unsubscribe(subscription) {
        // Remove event listeners
        subscription.events.forEach(eventType => {
            const handler = subscription[`handler_${eventType}`];
            if (handler) {
                this.removeListener(eventType, handler);
            }
        });

        this.subscribers.delete(subscription);
    }

    /**
     * Check if update should be sent to subscriber
     * @param {Object} subscription - Subscription
     * @param {string} eventType - Event type
     * @param {Object} data - Event data
     * @returns {boolean} Should send update
     */
    shouldSendUpdate(subscription, eventType, data) {
        // Check if event type is subscribed
        if (!subscription.events.has(eventType)) {
            return false;
        }

        // Check player filter
        if (subscription.players.size > 0) {
            if (data.playerName && !subscription.players.has(data.playerName)) {
                return false;
            }
            if (data.updates) {
                const relevantUpdates = data.updates.filter(u => 
                    subscription.players.has(u.playerName)
                );
                if (relevantUpdates.length === 0) {
                    return false;
                }
            }
        }

        // Apply custom filters
        if (subscription.filters.minSeverity && data.severity) {
            const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
            if (severityLevels[data.severity] < severityLevels[subscription.filters.minSeverity]) {
                return false;
            }
        }

        return true;
    }

    /**
     * Send WebSocket message
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Message to send
     */
    sendWebSocketMessage(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    /**
     * Get current state for players
     * @param {Array} players - Players to get state for
     * @returns {Object} Current state
     */
    getCurrentState(players = []) {
        const state = {
            monitors: {},
            streams: {},
            recentAlerts: []
        };

        const playersToInclude = players.length > 0 ? players : Array.from(this.activeMonitors.keys());

        for (const playerName of playersToInclude) {
            if (this.activeMonitors.has(playerName)) {
                state.monitors[playerName] = this.activeMonitors.get(playerName);
            }
            if (this.dataStreams.has(playerName)) {
                const stream = this.dataStreams.get(playerName);
                state.streams[playerName] = {
                    latestRating: stream.ratings[stream.ratings.length - 1],
                    dataPoints: stream.ratings.length,
                    lastUpdate: stream.lastUpdate
                };
            }
        }

        // Include recent alerts for these players
        state.recentAlerts = this.alerts
            .filter(alert => playersToInclude.includes(alert.playerName))
            .slice(-10);

        return state;
    }

    /**
     * Calculate trend from ratings
     * @param {Array} ratings - Rating values
     * @returns {Object} Trend analysis
     */
    calculateTrend(ratings) {
        if (ratings.length < 2) {
            return { direction: 'stable', change: 0, strength: 0 };
        }

        const recentAvg = ratings.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, ratings.length);
        const olderAvg = ratings.slice(0, 5).reduce((a, b) => a + b, 0) / Math.min(5, ratings.length);
        const change = recentAvg - olderAvg;

        let direction = 'stable';
        if (change > 10) direction = 'rising';
        else if (change < -10) direction = 'declining';

        // Calculate trend strength (0-1)
        const maxChange = Math.max(...ratings) - Math.min(...ratings);
        const strength = maxChange > 0 ? Math.abs(change) / maxChange : 0;

        return { direction, change, strength };
    }

    /**
     * Calculate anomaly severity
     * @param {Array} anomalies - Detected anomalies
     * @returns {string} Severity level
     */
    calculateAnomalySeverity(anomalies) {
        if (anomalies.length === 0) return 'none';
        
        const maxScore = Math.max(...anomalies.map(a => a.score));
        
        if (maxScore > 4) return 'critical';
        if (maxScore > 3) return 'high';
        if (maxScore > 2) return 'medium';
        return 'low';
    }

    /**
     * Get system metrics
     * @returns {Object} Current metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            activeMonitors: this.activeMonitors.size,
            totalDataStreams: this.dataStreams.size,
            totalSubscribers: this.subscribers.size,
            recentAlerts: this.alerts.length,
            uptime: this.monitoringInterval ? 'running' : 'stopped'
        };
    }

    /**
     * Get recent alerts
     * @param {Object} options - Filter options
     * @returns {Array} Filtered alerts
     */
    getAlerts(options = {}) {
        const {
            playerName = null,
            severity = null,
            type = null,
            limit = 50,
            since = null
        } = options;

        let filteredAlerts = [...this.alerts];

        if (playerName) {
            filteredAlerts = filteredAlerts.filter(a => a.playerName === playerName);
        }

        if (severity) {
            filteredAlerts = filteredAlerts.filter(a => a.severity === severity);
        }

        if (type) {
            filteredAlerts = filteredAlerts.filter(a => a.type === type);
        }

        if (since) {
            const sinceDate = new Date(since);
            filteredAlerts = filteredAlerts.filter(a => new Date(a.timestamp) > sinceDate);
        }

        return filteredAlerts.slice(-limit).reverse();
    }

    /**
     * Clear alerts
     * @param {Object} options - Clear options
     */
    clearAlerts(options = {}) {
        const { playerName = null, olderThan = null } = options;

        if (playerName) {
            this.alerts = this.alerts.filter(a => a.playerName !== playerName);
        } else if (olderThan) {
            const cutoffDate = new Date(olderThan);
            this.alerts = this.alerts.filter(a => new Date(a.timestamp) > cutoffDate);
        } else {
            this.alerts = [];
        }

        return { success: true, remaining: this.alerts.length };
    }

    /**
     * Export monitoring data
     * @param {string} playerName - Player to export data for
     * @returns {Object} Exported data
     */
    exportMonitoringData(playerName) {
        if (!this.dataStreams.has(playerName)) {
            return { error: 'No data available for player' };
        }

        const stream = this.dataStreams.get(playerName);
        const monitor = this.activeMonitors.get(playerName);
        const playerAlerts = this.alerts.filter(a => a.playerName === playerName);

        return {
            playerName,
            monitor: monitor || null,
            data: {
                ratings: stream.ratings,
                timestamps: stream.timestamps,
                games: stream.games,
                performance: stream.performance
            },
            alerts: playerAlerts,
            exportedAt: new Date().toISOString()
        };
    }
}

module.exports = RealTimeMonitor;