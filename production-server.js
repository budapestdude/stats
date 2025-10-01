const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3010;

// CORS configuration for production
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3007',
      'http://localhost:3009',
      'http://localhost:3010',
      'http://195.201.6.244',
      'https://195.201.6.244'
    ];
    if (!origin || allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Homepage
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chess Stats API</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            line-height: 1.6;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { color: #333; margin-top: 0; }
        h2 { color: #666; margin-top: 30px; }
        .endpoint {
            background: #f8f8f8;
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            border-left: 3px solid #4CAF50;
        }
        .endpoint code {
            color: #d63384;
        }
        .status {
            display: inline-block;
            padding: 4px 12px;
            background: #4CAF50;
            color: white;
            border-radius: 4px;
            font-size: 14px;
            margin-left: 10px;
        }
        a { color: #2196F3; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>♟️ Chess Stats API <span class="status">Online</span></h1>
        <p>Welcome to the Chess Stats API server running on Hetzner!</p>
        
        <h2>Available Endpoints</h2>
        
        <div class="endpoint">
            <strong>GET</strong> <code>/health</code>
            <p>Server health check - <a href="/health">Try it</a></p>
        </div>
        
        <div class="endpoint">
            <strong>GET</strong> <code>/api/test</code>
            <p>API connectivity test - <a href="/api/test">Try it</a></p>
        </div>
        
        <div class="endpoint">
            <strong>GET</strong> <code>/api/players/:username</code>
            <p>Get Chess.com player data - <a href="/api/players/magnuscarlsen">Example: Magnus Carlsen</a></p>
        </div>
        
        <h2>Server Info</h2>
        <ul>
            <li><strong>Status:</strong> Production</li>
            <li><strong>Version:</strong> 1.0.0</li>
            <li><strong>Platform:</strong> Node.js + Express</li>
            <li><strong>Host:</strong> Hetzner</li>
        </ul>
        
        <p style="margin-top: 30px; color: #666; font-size: 14px;">
            Server time: ${new Date().toISOString()}
        </p>
    </div>
</body>
</html>
    `);
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'Chess Stats API is running on Hetzner!',
        server: 'production',
        uptime: process.uptime()
    });
});

// API test
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API is working!',
        version: '1.0.0',
        environment: 'production',
        timestamp: new Date().toISOString()
    });
});

// Chess.com player endpoint
app.get('/api/players/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const response = await axios.get(`https://api.chess.com/pub/player/${username}`, {
            headers: { 'User-Agent': 'Chess-Stats/1.0' }
        });
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch player data',
            message: error.message
        });
    }
});

// Statistics endpoints (placeholder until database is available)
app.get('/api/stats/overview', (req, res) => {
    res.json({
        totalGames: 'Loading...',
        totalPlayers: 'Loading...',
        totalTournaments: 'Loading...',
        message: 'Database is being uploaded. Full statistics will be available soon.',
        estimatedCompletion: '10-15 minutes'
    });
});

app.get('/api/stats/activity', (req, res) => {
    res.json({
        message: 'Database loading',
        data: []
    });
});

app.get('/api/stats/rating-distribution', (req, res) => {
    res.json({
        message: 'Database loading',
        distribution: []
    });
});

app.get('/api/stats/leaderboards', (req, res) => {
    res.json({
        message: 'Database loading',
        players: []
    });
});

app.get('/api/stats/openings', (req, res) => {
    res.json({
        message: 'Database loading',
        openings: []
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Endpoint ${req.method} ${req.path} not found`,
        availableEndpoints: [
            'GET /',
            'GET /health',
            'GET /api/test',
            'GET /api/players/:username'
        ]
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Chess Stats Production Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`🏠 Homepage: http://localhost:${PORT}`);
});
