/**
 * WebSocket Server for Real-time Updates
 * Manages WebSocket connections and real-time data streaming
 */

const WebSocket = require('ws');
const http = require('http');
const RealTimeMonitor = require('./real-time-monitor');
const logger = require('../utils/logger');

class WebSocketServer {
    constructor(options = {}) {
        this.config = {
            port: options.port || 8080,
            heartbeatInterval: options.heartbeatInterval || 30000,
            maxConnections: options.maxConnections || 1000,
            authRequired: options.authRequired || false,
            corsOrigin: options.corsOrigin || '*'
        };

        this.wss = null;
        this.server = null;
        this.clients = new Map();
        this.rooms = new Map(); // Room-based subscriptions
        this.monitor = new RealTimeMonitor();
        
        this.metrics = {
            totalConnections: 0,
            activeConnections: 0,
            messagesReceived: 0,
            messagesSent: 0,
            errors: 0,
            startTime: null
        };
    }

    /**
     * Start WebSocket server
     * @param {Object} existingServer - Optional existing HTTP server
     */
    async start(existingServer = null) {
        try {
            // Create or use existing HTTP server
            if (existingServer) {
                this.server = existingServer;
            } else {
                this.server = http.createServer();
                this.server.listen(this.config.port, () => {
                    console.log(`🌐 WebSocket server listening on port ${this.config.port}`);
                });
            }

            // Create WebSocket server
            this.wss = new WebSocket.Server({ 
                server: this.server,
                maxPayload: 10 * 1024 * 1024, // 10MB max message size
                perMessageDeflate: {
                    zlibDeflateOptions: {
                        chunkSize: 1024,
                        memLevel: 7,
                        level: 3
                    },
                    zlibInflateOptions: {
                        chunkSize: 10 * 1024
                    },
                    clientNoContextTakeover: true,
                    serverNoContextTakeover: true,
                    serverMaxWindowBits: 10,
                    concurrencyLimit: 10,
                    threshold: 1024
                }
            });

            // Set up WebSocket event handlers
            this.setupWebSocketHandlers();

            // Start real-time monitor
            await this.monitor.start();

            // Set up monitor event forwarding
            this.setupMonitorEventForwarding();

            // Start heartbeat
            this.startHeartbeat();

            this.metrics.startTime = new Date().toISOString();

            logger.info('WebSocket server started successfully', {
                port: this.config.port,
                timestamp: this.metrics.startTime
            });

            return { success: true, port: this.config.port };
        } catch (error) {
            logger.error('Failed to start WebSocket server:', error);
            throw error;
        }
    }

    /**
     * Stop WebSocket server
     */
    async stop() {
        try {
            // Stop heartbeat
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
            }

            // Stop monitor
            await this.monitor.stop();

            // Close all client connections
            for (const [clientId, client] of this.clients) {
                client.ws.close(1000, 'Server shutting down');
            }

            // Close WebSocket server
            if (this.wss) {
                this.wss.close(() => {
                    console.log('WebSocket server closed');
                });
            }

            // Close HTTP server if we created it
            if (this.server && !this.config.existingServer) {
                this.server.close();
            }

            logger.info('WebSocket server stopped successfully');
            return { success: true };
        } catch (error) {
            logger.error('Error stopping WebSocket server:', error);
            throw error;
        }
    }

    /**
     * Set up WebSocket server event handlers
     */
    setupWebSocketHandlers() {
        this.wss.on('connection', (ws, request) => {
            const clientId = this.generateClientId();
            const clientIp = request.socket.remoteAddress;

            // Check max connections
            if (this.clients.size >= this.config.maxConnections) {
                ws.close(1008, 'Maximum connections reached');
                return;
            }

            // Create client object
            const client = {
                id: clientId,
                ws,
                ip: clientIp,
                connectedAt: new Date().toISOString(),
                authenticated: !this.config.authRequired,
                subscriptions: new Set(),
                rooms: new Set(),
                isAlive: true,
                metadata: {}
            };

            this.clients.set(clientId, client);
            this.metrics.totalConnections++;
            this.metrics.activeConnections++;

            // Send welcome message
            this.sendToClient(client, {
                type: 'connection:established',
                clientId,
                timestamp: new Date().toISOString(),
                config: {
                    heartbeatInterval: this.config.heartbeatInterval,
                    features: ['monitoring', 'alerts', 'forecasting', 'anomaly-detection']
                }
            });

            // Set up client event handlers
            this.setupClientHandlers(client);

            logger.info(`Client connected: ${clientId} from ${clientIp}`);
        });

        this.wss.on('error', (error) => {
            logger.error('WebSocket server error:', error);
            this.metrics.errors++;
        });
    }

    /**
     * Set up individual client handlers
     * @param {Object} client - Client object
     */
    setupClientHandlers(client) {
        const { ws } = client;

        // Handle incoming messages
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());
                this.metrics.messagesReceived++;
                await this.handleClientMessage(client, data);
            } catch (error) {
                logger.error(`Error handling message from ${client.id}:`, error);
                this.sendError(client, 'Invalid message format');
            }
        });

        // Handle pong (heartbeat response)
        ws.on('pong', () => {
            client.isAlive = true;
        });

        // Handle close
        ws.on('close', (code, reason) => {
            this.handleClientDisconnect(client, code, reason);
        });

        // Handle errors
        ws.on('error', (error) => {
            logger.error(`WebSocket error for client ${client.id}:`, error);
            this.metrics.errors++;
        });
    }

    /**
     * Handle client messages
     * @param {Object} client - Client object
     * @param {Object} message - Parsed message
     */
    async handleClientMessage(client, message) {
        const { type, data, id: messageId } = message;

        // Log message for debugging
        logger.debug(`Message from ${client.id}: ${type}`);

        try {
            let response = null;

            switch (type) {
                case 'auth:token':
                    response = await this.handleAuthentication(client, data);
                    break;

                case 'monitor:subscribe':
                    response = await this.handleMonitorSubscribe(client, data);
                    break;

                case 'monitor:unsubscribe':
                    response = await this.handleMonitorUnsubscribe(client, data);
                    break;

                case 'room:join':
                    response = await this.handleRoomJoin(client, data);
                    break;

                case 'room:leave':
                    response = await this.handleRoomLeave(client, data);
                    break;

                case 'player:track':
                    response = await this.handlePlayerTracking(client, data);
                    break;

                case 'alerts:get':
                    response = await this.handleGetAlerts(client, data);
                    break;

                case 'alerts:clear':
                    response = await this.handleClearAlerts(client, data);
                    break;

                case 'metrics:get':
                    response = await this.handleGetMetrics(client, data);
                    break;

                case 'forecast:request':
                    response = await this.handleForecastRequest(client, data);
                    break;

                case 'ping':
                    response = { type: 'pong', timestamp: new Date().toISOString() };
                    break;

                default:
                    response = { 
                        type: 'error', 
                        error: `Unknown message type: ${type}` 
                    };
            }

            // Send response with original message ID for correlation
            if (response && messageId) {
                response.correlationId = messageId;
            }

            if (response) {
                this.sendToClient(client, response);
            }
        } catch (error) {
            logger.error(`Error handling ${type} from ${client.id}:`, error);
            this.sendError(client, error.message, messageId);
        }
    }

    /**
     * Handle authentication
     * @param {Object} client - Client object
     * @param {Object} data - Auth data
     */
    async handleAuthentication(client, data) {
        const { token } = data;

        // Validate token (implement your auth logic here)
        const isValid = await this.validateToken(token);

        if (isValid) {
            client.authenticated = true;
            client.metadata.userId = data.userId || null;
            
            return {
                type: 'auth:success',
                message: 'Authentication successful'
            };
        } else {
            return {
                type: 'auth:failed',
                error: 'Invalid authentication token'
            };
        }
    }

    /**
     * Handle monitor subscription
     * @param {Object} client - Client object
     * @param {Object} data - Subscription data
     */
    async handleMonitorSubscribe(client, data) {
        if (!client.authenticated && this.config.authRequired) {
            return { type: 'error', error: 'Authentication required' };
        }

        const { players = [], events = [], options = {} } = data;

        // Subscribe to monitor updates
        const subscriptionId = this.monitor.subscribeToUpdates(client.ws, {
            players,
            events,
            ...options
        });

        client.subscriptions.add(subscriptionId);

        // Start monitoring for requested players
        for (const player of players) {
            if (!this.monitor.activeMonitors.has(player)) {
                await this.monitor.addPlayerMonitor(player, options);
            }
        }

        return {
            type: 'monitor:subscribed',
            subscriptionId,
            players,
            events,
            message: 'Successfully subscribed to monitoring updates'
        };
    }

    /**
     * Handle monitor unsubscribe
     * @param {Object} client - Client object
     * @param {Object} data - Unsubscribe data
     */
    async handleMonitorUnsubscribe(client, data) {
        const { subscriptionId, players = [] } = data;

        if (subscriptionId && client.subscriptions.has(subscriptionId)) {
            client.subscriptions.delete(subscriptionId);
        }

        // Stop monitoring if no other clients are watching
        for (const player of players) {
            const otherSubscribers = this.getPlayerSubscribers(player);
            if (otherSubscribers.length === 0) {
                await this.monitor.removePlayerMonitor(player);
            }
        }

        return {
            type: 'monitor:unsubscribed',
            message: 'Successfully unsubscribed from monitoring updates'
        };
    }

    /**
     * Handle room join
     * @param {Object} client - Client object
     * @param {Object} data - Room data
     */
    async handleRoomJoin(client, data) {
        const { roomName } = data;

        if (!roomName) {
            return { type: 'error', error: 'Room name required' };
        }

        // Add client to room
        if (!this.rooms.has(roomName)) {
            this.rooms.set(roomName, new Set());
        }
        
        this.rooms.get(roomName).add(client.id);
        client.rooms.add(roomName);

        // Notify room members
        this.broadcastToRoom(roomName, {
            type: 'room:member_joined',
            roomName,
            clientId: client.id,
            timestamp: new Date().toISOString()
        }, client.id);

        return {
            type: 'room:joined',
            roomName,
            members: Array.from(this.rooms.get(roomName))
        };
    }

    /**
     * Handle room leave
     * @param {Object} client - Client object
     * @param {Object} data - Room data
     */
    async handleRoomLeave(client, data) {
        const { roomName } = data;

        if (!roomName || !client.rooms.has(roomName)) {
            return { type: 'error', error: 'Not in room' };
        }

        // Remove client from room
        this.rooms.get(roomName).delete(client.id);
        client.rooms.delete(roomName);

        // Clean up empty rooms
        if (this.rooms.get(roomName).size === 0) {
            this.rooms.delete(roomName);
        } else {
            // Notify remaining room members
            this.broadcastToRoom(roomName, {
                type: 'room:member_left',
                roomName,
                clientId: client.id,
                timestamp: new Date().toISOString()
            });
        }

        return {
            type: 'room:left',
            roomName,
            message: 'Successfully left room'
        };
    }

    /**
     * Handle player tracking request
     * @param {Object} client - Client object
     * @param {Object} data - Tracking data
     */
    async handlePlayerTracking(client, data) {
        const { playerName, action = 'start', options = {} } = data;

        if (!playerName) {
            return { type: 'error', error: 'Player name required' };
        }

        if (action === 'start') {
            const result = await this.monitor.addPlayerMonitor(playerName, options);
            return {
                type: 'player:tracking_started',
                playerName,
                ...result
            };
        } else if (action === 'stop') {
            const result = await this.monitor.removePlayerMonitor(playerName);
            return {
                type: 'player:tracking_stopped',
                playerName,
                ...result
            };
        } else {
            return { type: 'error', error: 'Invalid action' };
        }
    }

    /**
     * Handle get alerts request
     * @param {Object} client - Client object
     * @param {Object} data - Filter data
     */
    async handleGetAlerts(client, data) {
        const alerts = this.monitor.getAlerts(data);
        
        return {
            type: 'alerts:list',
            alerts,
            count: alerts.length,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Handle clear alerts request
     * @param {Object} client - Client object
     * @param {Object} data - Clear options
     */
    async handleClearAlerts(client, data) {
        const result = this.monitor.clearAlerts(data);
        
        return {
            type: 'alerts:cleared',
            ...result,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Handle get metrics request
     * @param {Object} client - Client object
     * @param {Object} data - Metrics options
     */
    async handleGetMetrics(client, data) {
        const monitorMetrics = this.monitor.getMetrics();
        const serverMetrics = this.getServerMetrics();
        
        return {
            type: 'metrics:data',
            monitor: monitorMetrics,
            server: serverMetrics,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Handle forecast request
     * @param {Object} client - Client object
     * @param {Object} data - Forecast parameters
     */
    async handleForecastRequest(client, data) {
        const { playerName, horizon = 10 } = data;

        if (!playerName) {
            return { type: 'error', error: 'Player name required' };
        }

        const playerData = this.monitor.exportMonitoringData(playerName);
        
        if (playerData.error) {
            return { type: 'error', error: playerData.error };
        }

        // Generate forecast if enough data
        if (playerData.data.ratings.length >= 50) {
            const timeSeries = playerData.data.ratings.map((rating, i) => ({
                timestamp: playerData.data.timestamps[i],
                value: rating
            }));

            const forecast = await this.monitor.timeSeriesForecaster.generateForecast(
                timeSeries,
                { horizon, models: ['arima', 'exponential'] }
            );

            return {
                type: 'forecast:result',
                playerName,
                forecast: forecast.ensemble,
                dataPoints: timeSeries.length,
                timestamp: new Date().toISOString()
            };
        } else {
            return {
                type: 'error',
                error: 'Insufficient data for forecast'
            };
        }
    }

    /**
     * Handle client disconnect
     * @param {Object} client - Client object
     * @param {number} code - Close code
     * @param {string} reason - Close reason
     */
    handleClientDisconnect(client, code, reason) {
        logger.info(`Client ${client.id} disconnected: ${code} - ${reason}`);

        // Clean up client subscriptions
        for (const subscriptionId of client.subscriptions) {
            // Unsubscribe from monitor
        }

        // Remove from rooms
        for (const roomName of client.rooms) {
            const room = this.rooms.get(roomName);
            if (room) {
                room.delete(client.id);
                if (room.size === 0) {
                    this.rooms.delete(roomName);
                } else {
                    // Notify room members
                    this.broadcastToRoom(roomName, {
                        type: 'room:member_disconnected',
                        roomName,
                        clientId: client.id,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }

        // Remove client
        this.clients.delete(client.id);
        this.metrics.activeConnections--;
    }

    /**
     * Set up monitor event forwarding
     */
    setupMonitorEventForwarding() {
        // Forward monitor events to WebSocket clients
        const events = [
            'data:update',
            'alert:generated',
            'anomalies:detected',
            'monitor:added',
            'monitor:removed',
            'monitor:error'
        ];

        events.forEach(eventType => {
            this.monitor.on(eventType, (data) => {
                // Broadcast to all connected clients in relevant rooms
                this.broadcastMonitorEvent(eventType, data);
            });
        });
    }

    /**
     * Broadcast monitor event to relevant clients
     * @param {string} eventType - Event type
     * @param {Object} data - Event data
     */
    broadcastMonitorEvent(eventType, data) {
        // Determine which clients should receive this event
        for (const [clientId, client] of this.clients) {
            // Check if client has subscribed to this type of event
            const shouldReceive = this.shouldClientReceiveEvent(client, eventType, data);
            
            if (shouldReceive) {
                this.sendToClient(client, {
                    type: `monitor:${eventType}`,
                    data,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    /**
     * Check if client should receive event
     * @param {Object} client - Client object
     * @param {string} eventType - Event type
     * @param {Object} data - Event data
     * @returns {boolean} Should receive
     */
    shouldClientReceiveEvent(client, eventType, data) {
        // Check authentication
        if (this.config.authRequired && !client.authenticated) {
            return false;
        }

        // Check if client has any relevant subscriptions
        // This is simplified - in production, you'd have more sophisticated filtering
        return client.subscriptions.size > 0;
    }

    /**
     * Start heartbeat to check client connections
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            for (const [clientId, client] of this.clients) {
                if (!client.isAlive) {
                    // Client didn't respond to last ping
                    client.ws.terminate();
                    this.handleClientDisconnect(client, 1006, 'Heartbeat timeout');
                } else {
                    client.isAlive = false;
                    client.ws.ping();
                }
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * Send message to specific client
     * @param {Object} client - Client object
     * @param {Object} message - Message to send
     */
    sendToClient(client, message) {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
            this.metrics.messagesSent++;
        }
    }

    /**
     * Send error to client
     * @param {Object} client - Client object
     * @param {string} error - Error message
     * @param {string} correlationId - Optional correlation ID
     */
    sendError(client, error, correlationId = null) {
        const message = {
            type: 'error',
            error,
            timestamp: new Date().toISOString()
        };

        if (correlationId) {
            message.correlationId = correlationId;
        }

        this.sendToClient(client, message);
    }

    /**
     * Broadcast to all clients
     * @param {Object} message - Message to broadcast
     * @param {string} excludeClientId - Optional client to exclude
     */
    broadcast(message, excludeClientId = null) {
        for (const [clientId, client] of this.clients) {
            if (clientId !== excludeClientId) {
                this.sendToClient(client, message);
            }
        }
    }

    /**
     * Broadcast to room
     * @param {string} roomName - Room name
     * @param {Object} message - Message to broadcast
     * @param {string} excludeClientId - Optional client to exclude
     */
    broadcastToRoom(roomName, message, excludeClientId = null) {
        const room = this.rooms.get(roomName);
        if (!room) return;

        for (const clientId of room) {
            if (clientId !== excludeClientId) {
                const client = this.clients.get(clientId);
                if (client) {
                    this.sendToClient(client, message);
                }
            }
        }
    }

    /**
     * Get subscribers for a player
     * @param {string} playerName - Player name
     * @returns {Array} List of subscriber IDs
     */
    getPlayerSubscribers(playerName) {
        const subscribers = [];
        
        for (const [clientId, client] of this.clients) {
            // Check if client is monitoring this player
            // This is simplified - implement based on your subscription logic
            if (client.metadata.monitoringPlayers?.includes(playerName)) {
                subscribers.push(clientId);
            }
        }

        return subscribers;
    }

    /**
     * Generate unique client ID
     * @returns {string} Client ID
     */
    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Validate authentication token
     * @param {string} token - Auth token
     * @returns {boolean} Is valid
     */
    async validateToken(token) {
        // Implement your token validation logic here
        // This is a placeholder
        return token && token.length > 10;
    }

    /**
     * Get server metrics
     * @returns {Object} Server metrics
     */
    getServerMetrics() {
        return {
            ...this.metrics,
            activeConnections: this.clients.size,
            totalRooms: this.rooms.size,
            uptime: this.metrics.startTime ? 
                Date.now() - new Date(this.metrics.startTime).getTime() : 0
        };
    }

    /**
     * Get connected clients info
     * @returns {Array} Client information
     */
    getConnectedClients() {
        const clientInfo = [];
        
        for (const [clientId, client] of this.clients) {
            clientInfo.push({
                id: clientId,
                ip: client.ip,
                connectedAt: client.connectedAt,
                authenticated: client.authenticated,
                subscriptions: client.subscriptions.size,
                rooms: Array.from(client.rooms)
            });
        }

        return clientInfo;
    }

    /**
     * Get room information
     * @param {string} roomName - Optional room name
     * @returns {Object} Room information
     */
    getRoomInfo(roomName = null) {
        if (roomName) {
            const room = this.rooms.get(roomName);
            return room ? {
                name: roomName,
                members: Array.from(room),
                size: room.size
            } : null;
        }

        const roomInfo = {};
        for (const [name, members] of this.rooms) {
            roomInfo[name] = {
                members: Array.from(members),
                size: members.size
            };
        }
        
        return roomInfo;
    }
}

module.exports = WebSocketServer;