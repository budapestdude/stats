const express = require('express');
const { getMonitoring } = require('../services/monitoring');
const { getPool } = require('../services/connection-pool');

const router = express.Router();

/**
 * Monitoring API routes
 */

// Get monitoring dashboard HTML
router.get('/dashboard', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chess Stats - Monitoring Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        h1 {
            color: white;
            text-align: center;
            margin-bottom: 30px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .card {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .card h2 {
            margin-bottom: 15px;
            color: #667eea;
            font-size: 1.2em;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .metric:last-child {
            border-bottom: none;
        }
        .metric-label {
            color: #666;
        }
        .metric-value {
            font-weight: bold;
            color: #333;
        }
        .health-status {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 0.9em;
        }
        .health-healthy {
            background: #10b981;
            color: white;
        }
        .health-degraded {
            background: #f59e0b;
            color: white;
        }
        .health-unhealthy {
            background: #ef4444;
            color: white;
        }
        .chart {
            height: 200px;
            margin-top: 15px;
        }
        .alert {
            background: #fee2e2;
            border-left: 4px solid #ef4444;
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 4px;
        }
        .alert-resolved {
            opacity: 0.5;
        }
        .endpoint-list {
            max-height: 300px;
            overflow-y: auto;
        }
        .endpoint-item {
            display: flex;
            justify-content: space-between;
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 5px;
            background: #f3f4f6;
        }
        .refresh-info {
            text-align: center;
            color: white;
            margin-top: 20px;
            font-size: 0.9em;
        }
        #cpu-chart, #memory-chart {
            width: 100%;
            height: 200px;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <h1>🎯 Chess Stats Monitoring Dashboard</h1>
        
        <div class="grid">
            <!-- Health Status -->
            <div class="card">
                <h2>System Health</h2>
                <div class="metric">
                    <span class="metric-label">Status</span>
                    <span id="health-status" class="health-status health-healthy">Loading...</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Uptime</span>
                    <span id="uptime" class="metric-value">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Active Alerts</span>
                    <span id="alerts-count" class="metric-value">-</span>
                </div>
            </div>
            
            <!-- Request Metrics -->
            <div class="card">
                <h2>Request Metrics</h2>
                <div class="metric">
                    <span class="metric-label">Total Requests</span>
                    <span id="total-requests" class="metric-value">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Request Rate</span>
                    <span id="request-rate" class="metric-value">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Avg Response Time</span>
                    <span id="avg-response" class="metric-value">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Success Rate</span>
                    <span id="success-rate" class="metric-value">-</span>
                </div>
            </div>
            
            <!-- Database Metrics -->
            <div class="card">
                <h2>Database Performance</h2>
                <div class="metric">
                    <span class="metric-label">Total Queries</span>
                    <span id="total-queries" class="metric-value">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Cache Hit Rate</span>
                    <span id="cache-hit-rate" class="metric-value">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Slow Queries</span>
                    <span id="slow-queries" class="metric-value">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">DB Errors</span>
                    <span id="db-errors" class="metric-value">-</span>
                </div>
            </div>
            
            <!-- Connection Pool -->
            <div class="card">
                <h2>Connection Pool</h2>
                <div class="metric">
                    <span class="metric-label">Created</span>
                    <span id="pool-created" class="metric-value">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Active</span>
                    <span id="pool-active" class="metric-value">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Idle</span>
                    <span id="pool-idle" class="metric-value">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Waiting</span>
                    <span id="pool-waiting" class="metric-value">-</span>
                </div>
            </div>
        </div>
        
        <div class="grid">
            <!-- System Resources -->
            <div class="card">
                <h2>System Resources</h2>
                <div class="metric">
                    <span class="metric-label">CPU Usage</span>
                    <span id="cpu-usage" class="metric-value">-</span>
                </div>
                <canvas id="cpu-chart"></canvas>
            </div>
            
            <div class="card">
                <h2>Memory Usage</h2>
                <div class="metric">
                    <span class="metric-label">Memory Usage</span>
                    <span id="memory-usage" class="metric-value">-</span>
                </div>
                <canvas id="memory-chart"></canvas>
            </div>
        </div>
        
        <div class="grid">
            <!-- Recent Alerts -->
            <div class="card">
                <h2>Recent Alerts</h2>
                <div id="alerts-list"></div>
            </div>
            
            <!-- Top Endpoints -->
            <div class="card">
                <h2>Top Endpoints</h2>
                <div id="endpoints-list" class="endpoint-list"></div>
            </div>
        </div>
        
        <div class="refresh-info">
            Auto-refreshing every 5 seconds | Last update: <span id="last-update">-</span>
        </div>
    </div>
    
    <script>
        let cpuChart, memoryChart;
        
        // Initialize charts
        function initCharts() {
            const chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            };
            
            // CPU Chart
            const cpuCtx = document.getElementById('cpu-chart').getContext('2d');
            cpuChart = new Chart(cpuCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'CPU %',
                        data: [],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.3
                    }]
                },
                options: chartOptions
            });
            
            // Memory Chart
            const memCtx = document.getElementById('memory-chart').getContext('2d');
            memoryChart = new Chart(memCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Memory %',
                        data: [],
                        borderColor: '#764ba2',
                        backgroundColor: 'rgba(118, 75, 162, 0.1)',
                        tension: 0.3
                    }]
                },
                options: chartOptions
            });
        }
        
        // Update dashboard
        async function updateDashboard() {
            try {
                const response = await fetch('/monitoring/metrics');
                const data = await response.json();
                
                // Update health status
                const healthElement = document.getElementById('health-status');
                healthElement.textContent = data.snapshot.health.toUpperCase();
                healthElement.className = 'health-status health-' + data.snapshot.health;
                
                // Update uptime
                const uptimeMs = data.snapshot.uptime;
                const hours = Math.floor(uptimeMs / 3600000);
                const minutes = Math.floor((uptimeMs % 3600000) / 60000);
                document.getElementById('uptime').textContent = hours + 'h ' + minutes + 'm';
                
                // Update request metrics
                document.getElementById('total-requests').textContent = data.snapshot.requests.total.toLocaleString();
                document.getElementById('request-rate').textContent = data.snapshot.requests.rate + ' req/min';
                document.getElementById('avg-response').textContent = data.snapshot.requests.avgResponseTime + ' ms';
                document.getElementById('success-rate').textContent = data.snapshot.requests.successRate + '%';
                
                // Update database metrics
                document.getElementById('total-queries').textContent = data.snapshot.database.queries.toLocaleString();
                document.getElementById('cache-hit-rate').textContent = data.snapshot.database.cacheHitRate + '%';
                document.getElementById('slow-queries').textContent = data.snapshot.database.slowQueries;
                document.getElementById('db-errors').textContent = data.snapshot.database.errors;
                
                // Update pool metrics
                document.getElementById('pool-created').textContent = data.snapshot.database.pool.created;
                document.getElementById('pool-active').textContent = data.snapshot.database.pool.active;
                document.getElementById('pool-idle').textContent = data.snapshot.database.pool.idle;
                document.getElementById('pool-waiting').textContent = data.snapshot.database.pool.waiting;
                
                // Update system metrics
                document.getElementById('cpu-usage').textContent = data.snapshot.system.cpu + '%';
                document.getElementById('memory-usage').textContent = data.snapshot.system.memory + '%';
                
                // Update CPU chart
                if (data.system && data.system.cpu) {
                    const cpuData = data.system.cpu.slice(-20);
                    cpuChart.data.labels = cpuData.map(() => '');
                    cpuChart.data.datasets[0].data = cpuData.map(d => d.usage);
                    cpuChart.update();
                }
                
                // Update Memory chart
                if (data.system && data.system.memory) {
                    const memData = data.system.memory.slice(-20);
                    memoryChart.data.labels = memData.map(() => '');
                    memoryChart.data.datasets[0].data = memData.map(d => d.percentage);
                    memoryChart.update();
                }
                
                // Update alerts
                document.getElementById('alerts-count').textContent = data.snapshot.alerts;
                const alertsList = document.getElementById('alerts-list');
                if (data.alerts && data.alerts.length > 0) {
                    alertsList.innerHTML = data.alerts.slice(-5).map(alert => 
                        '<div class="alert ' + (alert.resolved ? 'alert-resolved' : '') + '">' +
                        '<strong>' + alert.type + '</strong>: ' + alert.message +
                        '</div>'
                    ).join('');
                } else {
                    alertsList.innerHTML = '<p style="color: #666;">No recent alerts</p>';
                }
                
                // Update endpoints
                const endpointsList = document.getElementById('endpoints-list');
                if (data.requests && data.requests.byEndpoint) {
                    const endpoints = Array.from(data.requests.byEndpoint.entries())
                        .sort((a, b) => b[1].count - a[1].count)
                        .slice(0, 10);
                    
                    endpointsList.innerHTML = endpoints.map(([endpoint, stats]) => 
                        '<div class="endpoint-item">' +
                        '<span>' + endpoint + '</span>' +
                        '<span>' + stats.count + ' (' + stats.avgTime.toFixed(0) + 'ms)</span>' +
                        '</div>'
                    ).join('');
                }
                
                // Update last update time
                document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
                
            } catch (error) {
                console.error('Failed to update dashboard:', error);
            }
        }
        
        // Initialize and start updates
        initCharts();
        updateDashboard();
        setInterval(updateDashboard, 5000);
    </script>
</body>
</html>
  `);
});

// Get metrics JSON
router.get('/metrics', (req, res) => {
  const monitoring = getMonitoring();
  res.json(monitoring.getDetailedMetrics());
});

// Get snapshot
router.get('/snapshot', (req, res) => {
  const monitoring = getMonitoring();
  res.json(monitoring.getSnapshot());
});

// Health check endpoint
router.get('/health', async (req, res) => {
  const monitoring = getMonitoring();
  const health = await monitoring.runHealthChecks();
  
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 206 : 503;
  
  res.status(statusCode).json(health);
});

// Get alerts
router.get('/alerts', (req, res) => {
  const monitoring = getMonitoring();
  const { resolved = false } = req.query;
  
  const alerts = monitoring.metrics.alerts.filter(a => 
    resolved === 'true' || !a.resolved
  );
  
  res.json(alerts);
});

// Resolve alert
router.post('/alerts/:id/resolve', (req, res) => {
  const monitoring = getMonitoring();
  monitoring.resolveAlert(req.params.id);
  res.json({ success: true });
});

// Get slow queries
router.get('/slow-queries', (req, res) => {
  const monitoring = getMonitoring();
  res.json(monitoring.metrics.database.slowQueries);
});

// Get errors
router.get('/errors', (req, res) => {
  const monitoring = getMonitoring();
  const { limit = 50 } = req.query;
  
  const errors = monitoring.metrics.errors
    .slice(-parseInt(limit))
    .reverse();
  
  res.json(errors);
});

// Pool stats
router.get('/pool', (req, res) => {
  try {
    const pool = getPool();
    res.json(pool.getStats());
  } catch (error) {
    res.status(503).json({ error: 'Pool not initialized' });
  }
});

module.exports = router;