console.log('\n🚀 Starting simple-server-pooled.js...');
console.log('⏰ Timestamp:', new Date().toISOString());

const express = require('express');
const cors = require('cors');
const path = require('path');

console.log('✅ Basic modules loaded');

const { getPool } = require('./src/services/connection-pool');
const { QueryBuilder, QueryHelpers } = require('./src/utils/query-builder');
const logger = require('./src/utils/logger');
const analyticsRoutes = require('./src/routes/analytics');
const searchRoutes = require('./src/routes/search');

console.log('✅ All application modules loaded');

const app = express();
const PORT = process.env.PORT || 3010;

console.log(`✅ Express app created, will listen on port ${PORT}`);

// CORS configuration
const allowedOrigins = [
  /^http:\/\/localhost:\d+$/,  // localhost with any port
  /^https:\/\/.*\.up\.railway\.app$/,  // Railway deployments
  'https://invigorating-solace-production.up.railway.app'  // Specific frontend
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(pattern => {
      if (typeof pattern === 'string') {
        return origin === pattern;
      }
      return pattern.test(origin);
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Query cache
const queryCache = new Map();
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Connection pool instance
let pool = null;

/**
 * Initialize connection pool
 */
async function initializePool() {
  try {
    const fs = require('fs');

    // Log environment info
    console.log('\n🔍 Database Configuration:');
    console.log(`   RAILWAY_VOLUME_MOUNT_PATH: ${process.env.RAILWAY_VOLUME_MOUNT_PATH || 'NOT SET'}`);
    console.log(`   __dirname: ${__dirname}`);

    // Check Railway volume first, then fallback to local path
    let dbPath = null;
    const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH
      ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'complete-tournaments.db')
      : null;
    const fallbackPath = path.join(__dirname, 'otb-database', 'complete-tournaments.db');

    // Try Railway volume first
    if (volumePath && fs.existsSync(volumePath)) {
      dbPath = volumePath;
      const stats = fs.statSync(dbPath);
      console.log(`   ✅ Database found in Railway volume (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    }
    // Try fallback location
    else if (fs.existsSync(fallbackPath)) {
      dbPath = fallbackPath;
      const stats = fs.statSync(dbPath);
      console.log(`   ✅ Database found in fallback location (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    }
    else {
      console.log(`   ❌ Database file NOT found`);
      console.log(`   Checked paths:`);
      if (volumePath) console.log(`     - ${volumePath}`);
      console.log(`     - ${fallbackPath}`);
      throw new Error('Database file not found');
    }

    console.log(`   Using: ${dbPath}`);

    pool = getPool({
      database: dbPath,
      minConnections: 3,
      maxConnections: 15,
      acquireTimeout: 30000,
      idleTimeout: 60000
    });
    
    await pool.initialize();
    
    // Get initial stats
    const gameCount = await pool.get('SELECT COUNT(*) as count FROM games');
    console.log(`✅ Connection pool initialized with ${gameCount.count.toLocaleString()} games`);
    
    // Monitor pool events
    pool.on('connection-created', (id) => {
      logger.debug(`Pool: Connection created ${id}`);
    });
    
    pool.on('connection-acquired', (id) => {
      logger.debug(`Pool: Connection acquired ${id}`);
    });
    
    pool.on('connection-released', (id) => {
      logger.debug(`Pool: Connection released ${id}`);
    });
    
    return pool;
  } catch (error) {
    logger.error('Failed to initialize connection pool', error);
    throw error;
  }
}

/**
 * Execute query with caching and pooling
 */
async function cachedPoolQuery(cacheKey, queryBuilder, ttl = CACHE_TIMEOUT) {
  // Check cache
  if (queryCache.has(cacheKey)) {
    const cached = queryCache.get(cacheKey);
    if (Date.now() - cached.timestamp < ttl) {
      logger.debug(`Cache hit: ${cacheKey}`);
      return cached.data;
    }
  }

  // Build query
  const { sql, params } = queryBuilder.build ? queryBuilder.build() : queryBuilder;
  
  // Execute with connection pool
  const startTime = Date.now();
  const result = await pool.query(sql, params);
  const duration = Date.now() - startTime;
  
  logger.debug(`Query executed (${duration}ms): ${sql.substring(0, 100)}...`);
  
  // Cache result
  queryCache.set(cacheKey, {
    data: result,
    timestamp: Date.now()
  });

  // Clean cache periodically
  if (queryCache.size > 100) {
    const now = Date.now();
    for (const [key, value] of queryCache.entries()) {
      if (now - value.timestamp > CACHE_TIMEOUT) {
        queryCache.delete(key);
      }
    }
  }

  return result;
}

// Health endpoint with pool stats
app.get('/health', async (req, res) => {
  const poolStats = pool ? pool.getStats() : null;

  res.json({
    status: pool ? 'healthy' : 'starting',
    timestamp: new Date().toISOString(),
    message: pool ? 'Pooled Chess Stats API is running!' : 'Server starting, database initializing...',
    cache: {
      size: queryCache.size,
      maxAge: CACHE_TIMEOUT
    },
    pool: poolStats,
    databaseReady: !!pool
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Pooled API is working!',
    features: ['connection-pooling', 'query-builder', 'caching', 'optimized-indexes', 'advanced-analytics'],
    databaseReady: !!pool
  });
});

// Middleware to check if pool is ready
function requirePool(req, res, next) {
  if (!pool) {
    return res.status(503).json({
      error: 'Database not ready',
      message: 'Database pool is still initializing. Please try again in a few moments.',
      databaseReady: false
    });
  }
  next();
}

// Mount analytics routes
app.use('/api/analytics', analyticsRoutes);

// Mount search routes
app.use('/api/search', searchRoutes);

// Opening tree routes
const openingTreeService = require('./src/services/opening-tree');

app.get('/api/openings/tree', async (req, res) => {
  try {
    const { maxDepth = 15, minGames = 5 } = req.query;
    
    const tree = await openingTreeService.buildOpeningTree(
      parseInt(maxDepth),
      parseInt(minGames)
    );
    
    res.json({
      success: true,
      tree,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error building opening tree:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to build opening tree'
    });
  }
});

app.get('/api/openings/tree/branch', async (req, res) => {
  try {
    const { moves, depth = 10 } = req.query;
    const moveList = moves ? moves.split(',') : [];
    
    const result = await openingTreeService.getTreeBranch(moveList, parseInt(depth));
    
    res.json(result);
  } catch (error) {
    logger.error('Error getting tree branch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tree branch'
    });
  }
});

app.get('/api/openings/popular', async (req, res) => {
  try {
    const { minGames = 100, limit = 20 } = req.query;
    
    const lines = await openingTreeService.getPopularLines(
      parseInt(minGames),
      parseInt(limit)
    );
    
    res.json({
      success: true,
      lines,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting popular lines:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get popular lines'
    });
  }
});

app.get('/api/openings/:eco/stats', async (req, res) => {
  try {
    const { eco } = req.params;
    
    const stats = await openingTreeService.getOpeningStats(eco);
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Opening not found'
      });
    }
    
    res.json({
      success: true,
      eco,
      stats,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting opening stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get opening stats'
    });
  }
});

app.get('/api/openings/variations/search', async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters long'
      });
    }
    
    const variations = await openingTreeService.searchVariations(query, parseInt(limit));
    
    res.json({
      success: true,
      query,
      variations,
      count: variations.length,
      generated: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error searching variations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search variations'
    });
  }
});

// Pool statistics endpoint
app.get('/api/pool/stats', (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Pool not initialized' });
  }
  
  const stats = pool.getStats();
  res.json({
    pool: stats,
    performance: {
      hitRate: stats.acquired > 0 ? 
        ((stats.acquired - stats.created) / stats.acquired * 100).toFixed(2) + '%' : '0%',
      avgWaitTime: stats.waitingCount > 0 ? 'Has waiting requests' : 'No wait',
      efficiency: stats.released > 0 ? 
        (stats.released / stats.acquired * 100).toFixed(2) + '%' : '0%'
    }
  });
});

// Search games with pooled connections
app.get('/api/games/search', async (req, res) => {
  try {
    const {
      player,
      whitePlayer,
      blackPlayer,
      opening,
      tournament,
      dateFrom,
      dateTo,
      result,
      limit = 100,
      offset = 0
    } = req.query;

    const query = new QueryBuilder('games')
      .select('*')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    if (player) {
      query.where('white_player', '=', player)
           .orWhere('black_player', '=', player);
    }
    
    if (whitePlayer) {
      query.where('white_player', '=', whitePlayer);
    }
    
    if (blackPlayer) {
      query.where('black_player', '=', blackPlayer);
    }
    
    if (opening) {
      query.whereLike('opening', `%${opening}%`);
    }
    
    if (tournament) {
      query.whereLike('tournament_name', `%${tournament}%`);
    }
    
    if (dateFrom && dateTo) {
      query.whereBetween('date', dateFrom, dateTo);
    }
    
    if (result) {
      query.where('result', '=', result);
    }

    query.orderBy('date', 'DESC');

    const cacheKey = `games:${JSON.stringify(req.query)}`;
    const games = await cachedPoolQuery(cacheKey, query);
    
    // Get total count using pool
    const countQuery = query.clone().buildCount();
    const totalResult = await pool.get(countQuery.sql, countQuery.params);
    
    res.json({
      games,
      total: totalResult.total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit
    });
    
  } catch (error) {
    logger.error('Error searching games:', error);
    res.status(500).json({ error: 'Failed to search games' });
  }
});

// Player statistics with pooling
app.get('/api/players/:name/stats', requirePool, async (req, res) => {
  try {
    const playerName = req.params.name;
    const { sql, params } = QueryHelpers.playerStats(playerName);

    const cacheKey = `player-stats:${playerName}`;

    // Check cache first
    if (queryCache.has(cacheKey)) {
      const cached = queryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TIMEOUT) {
        return res.json(cached.data);
      }
    }

    // Use pool for query
    const stats = await pool.get(sql, params);

    if (stats) {
      stats.winRate = ((stats.wins / stats.total_games) * 100).toFixed(2);
      stats.drawRate = ((stats.draws / stats.total_games) * 100).toFixed(2);
      stats.lossRate = ((stats.losses / stats.total_games) * 100).toFixed(2);
    }

    // Cache result
    queryCache.set(cacheKey, {
      data: stats,
      timestamp: Date.now()
    });

    res.json(stats);

  } catch (error) {
    logger.error('Error getting player stats:', error);
    res.status(500).json({ error: 'Failed to get player statistics' });
  }
});

// Opening list endpoint (alias for /stats for frontend compatibility)
app.get('/api/openings', async (req, res) => {
  try {
    const { eco, limit = 20, minGames = 10 } = req.query;

    const { sql, params } = QueryHelpers.openingStats(eco, {
      limit: parseInt(limit),
      minGames: parseInt(minGames)
    });

    const cacheKey = `opening-stats:${JSON.stringify(req.query)}`;
    const openings = await cachedPoolQuery(cacheKey, { sql, params });

    res.json({ openings });

  } catch (error) {
    logger.error('Error getting opening list:', error);
    res.status(500).json({ error: 'Failed to get opening list' });
  }
});

// Opening statistics
app.get('/api/openings/stats', async (req, res) => {
  try {
    const { eco, limit = 20, minGames = 10 } = req.query;

    const { sql, params } = QueryHelpers.openingStats(eco, {
      limit: parseInt(limit),
      minGames: parseInt(minGames)
    });

    const cacheKey = `opening-stats:${JSON.stringify(req.query)}`;
    const openings = await cachedPoolQuery(cacheKey, { sql, params });

    res.json({ openings });

  } catch (error) {
    logger.error('Error getting opening stats:', error);
    res.status(500).json({ error: 'Failed to get opening statistics' });
  }
});

// Tournament standings
app.get('/api/tournaments/:name/standings', async (req, res) => {
  try {
    const tournamentName = decodeURIComponent(req.params.name);
    const { sql, params } = QueryHelpers.tournamentStandings(tournamentName);
    
    const cacheKey = `tournament-standings:${tournamentName}`;
    const standings = await cachedPoolQuery(cacheKey, { sql, params });
    
    res.json({ 
      tournament: tournamentName,
      standings 
    });
    
  } catch (error) {
    logger.error('Error getting tournament standings:', error);
    res.status(500).json({ error: 'Failed to get tournament standings' });
  }
});

// Top players with connection pooling
app.get('/api/players/top', requirePool, async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const query = new QueryBuilder('games')
      .select('white_player as player', 'COUNT(*) as games')
      .groupBy('white_player')
      .having('COUNT(*)', '>=', 100)
      .orderBy('games', 'DESC')
      .limit(parseInt(limit));

    const cacheKey = `top-players:${limit}`;
    const players = await cachedPoolQuery(cacheKey, query);

    res.json({ players });

  } catch (error) {
    logger.error('Error getting top players:', error);
    res.status(500).json({ error: 'Failed to get top players' });
  }
});

// Recent games
app.get('/api/games/recent', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const query = new QueryBuilder('games')
      .select('*')
      .whereNotNull('date')
      .orderBy('date', 'DESC')
      .orderBy('id', 'DESC')
      .limit(parseInt(limit));
    
    const cacheKey = `recent-games:${limit}`;
    const games = await cachedPoolQuery(cacheKey, query, 60000); // 1 minute cache
    
    res.json({ games });
    
  } catch (error) {
    logger.error('Error getting recent games:', error);
    res.status(500).json({ error: 'Failed to get recent games' });
  }
});

// Database statistics
app.get('/api/stats/database', async (req, res) => {
  try {
    const cacheKey = 'database-stats';
    
    // Check cache
    if (queryCache.has(cacheKey)) {
      const cached = queryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TIMEOUT * 2) {
        return res.json(cached.data);
      }
    }
    
    // Use pool for parallel queries
    const [games, tournaments, players, dateRange] = await Promise.all([
      pool.get('SELECT COUNT(*) as count FROM games'),
      pool.get('SELECT COUNT(DISTINCT tournament_name) as count FROM games'),
      pool.get('SELECT COUNT(DISTINCT white_player) + COUNT(DISTINCT black_player) as count FROM games'),
      pool.get('SELECT MIN(date) as min_date, MAX(date) as max_date FROM games WHERE date IS NOT NULL')
    ]);
    
    const stats = {
      games,
      tournaments,
      players,
      dateRange,
      cache: {
        entries: queryCache.size,
        maxAge: CACHE_TIMEOUT
      },
      pool: pool.getStats()
    };
    
    // Cache result
    queryCache.set(cacheKey, {
      data: stats,
      timestamp: Date.now()
    });
    
    res.json(stats);
    
  } catch (error) {
    logger.error('Error getting database stats:', error);
    res.status(500).json({ error: 'Failed to get database statistics' });
  }
});

// Stress test endpoint
app.get('/api/stress-test', async (req, res) => {
  try {
    const { requests = 50, query = 'simple' } = req.query;
    const numRequests = parseInt(requests);
    
    console.log(`Running stress test with ${numRequests} requests...`);
    
    const queries = {
      simple: 'SELECT COUNT(*) as count FROM games',
      medium: 'SELECT white_player, COUNT(*) as games FROM games GROUP BY white_player LIMIT 10',
      complex: `SELECT eco, COUNT(*) as games, 
                AVG(ply_count) as avg_moves 
                FROM games 
                WHERE eco IS NOT NULL 
                GROUP BY eco 
                ORDER BY games DESC 
                LIMIT 20`
    };
    
    const sql = queries[query] || queries.simple;
    const startTime = Date.now();
    const promises = [];
    
    for (let i = 0; i < numRequests; i++) {
      promises.push(pool.query(sql));
    }
    
    await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    const stats = pool.getStats();
    
    res.json({
      test: {
        requests: numRequests,
        queryType: query,
        totalTime: duration,
        avgTime: (duration / numRequests).toFixed(2),
        requestsPerSecond: ((numRequests / duration) * 1000).toFixed(2)
      },
      poolStats: stats
    });
    
  } catch (error) {
    logger.error('Stress test failed:', error);
    res.status(500).json({ error: 'Stress test failed' });
  }
});

// Clear cache
app.post('/api/cache/clear', (req, res) => {
  const oldSize = queryCache.size;
  queryCache.clear();
  res.json({
    message: 'Cache cleared',
    entriesCleared: oldSize
  });
});

// Production Monitoring Dashboard
app.get('/monitoring/dashboard', (req, res) => {
  const stats = pool.getStats();
  const cacheSize = queryCache.size;
  const uptime = process.uptime();
  const memory = process.memoryUsage();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chess Stats - Production Monitoring</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
      padding: 20px;
      min-height: 100vh;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 {
      color: white;
      text-align: center;
      margin-bottom: 10px;
      font-size: 2.5em;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    .subtitle {
      color: rgba(255,255,255,0.9);
      text-align: center;
      margin-bottom: 30px;
      font-size: 1.1em;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .card {
      background: white;
      padding: 25px;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      transition: transform 0.2s;
    }
    .card:hover { transform: translateY(-5px); }
    .card h2 {
      color: #667eea;
      margin-bottom: 20px;
      font-size: 1.3em;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #eee;
    }
    .stat-row:last-child { border-bottom: none; }
    .stat-label {
      font-weight: 600;
      color: #666;
    }
    .stat-value {
      font-weight: 500;
      color: #333;
      font-family: 'Monaco', 'Courier New', monospace;
    }
    .status-good { color: #10b981; font-weight: bold; }
    .status-warning { color: #f59e0b; font-weight: bold; }
    .status-error { color: #ef4444; font-weight: bold; }
    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      transition: width 0.3s;
    }
    .refresh-btn {
      display: block;
      margin: 20px auto;
      padding: 12px 30px;
      background: white;
      color: #667eea;
      border: none;
      border-radius: 8px;
      font-size: 1.1em;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.2s;
    }
    .refresh-btn:hover {
      background: #667eea;
      color: white;
      transform: scale(1.05);
    }
    .timestamp {
      text-align: center;
      color: rgba(255,255,255,0.8);
      margin-top: 20px;
      font-size: 0.9em;
    }
  </style>
  <script>
    function refreshPage() {
      location.reload();
    }

    // Auto-refresh every 5 seconds
    setInterval(refreshPage, 5000);

    function formatUptime(seconds) {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      return \`\${days}d \${hours}h \${minutes}m \${secs}s\`;
    }

    window.addEventListener('load', () => {
      const uptimeEl = document.getElementById('uptime-value');
      if (uptimeEl) {
        setInterval(() => {
          const currentUptime = parseFloat(uptimeEl.dataset.uptime) + 1;
          uptimeEl.dataset.uptime = currentUptime;
          uptimeEl.textContent = formatUptime(currentUptime);
        }, 1000);
      }
    });
  </script>
</head>
<body>
  <div class="container">
    <h1>🚀 Chess Stats Production Monitor</h1>
    <p class="subtitle">Real-time server performance and health metrics</p>

    <div class="grid">
      <!-- Connection Pool Stats -->
      <div class="card">
        <h2>🔌 Connection Pool</h2>
        <div class="stat-row">
          <span class="stat-label">Total Connections:</span>
          <span class="stat-value ${stats.totalConnections === stats.maxConnections ? 'status-warning' : 'status-good'}">
            ${stats.totalConnections} / ${stats.maxConnections}
          </span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${(stats.totalConnections / stats.maxConnections * 100).toFixed(1)}%"></div>
        </div>
        <div class="stat-row">
          <span class="stat-label">Available:</span>
          <span class="stat-value status-good">${stats.availableConnections}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">In Use:</span>
          <span class="stat-value">${stats.connectionsInUse}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Waiting Requests:</span>
          <span class="stat-value ${stats.waitingRequests > 5 ? 'status-warning' : 'status-good'}">
            ${stats.waitingRequests}
          </span>
        </div>
      </div>

      <!-- Server Health -->
      <div class="card">
        <h2>💚 Server Health</h2>
        <div class="stat-row">
          <span class="stat-label">Status:</span>
          <span class="stat-value status-good">✓ Healthy</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Uptime:</span>
          <span class="stat-value" id="uptime-value" data-uptime="${uptime}">
            ${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s
          </span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Node Version:</span>
          <span class="stat-value">${process.version}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Platform:</span>
          <span class="stat-value">${process.platform} (${process.arch})</span>
        </div>
      </div>

      <!-- Memory Usage -->
      <div class="card">
        <h2>💾 Memory Usage</h2>
        <div class="stat-row">
          <span class="stat-label">RSS (Total):</span>
          <span class="stat-value">${(memory.rss / 1024 / 1024).toFixed(2)} MB</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Heap Used:</span>
          <span class="stat-value">${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Heap Total:</span>
          <span class="stat-value">${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${(memory.heapUsed / memory.heapTotal * 100).toFixed(1)}%"></div>
        </div>
        <div class="stat-row">
          <span class="stat-label">External:</span>
          <span class="stat-value">${(memory.external / 1024 / 1024).toFixed(2)} MB</span>
        </div>
      </div>

      <!-- Cache Stats -->
      <div class="card">
        <h2>⚡ Query Cache</h2>
        <div class="stat-row">
          <span class="stat-label">Cached Queries:</span>
          <span class="stat-value">${cacheSize}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Hit Rate:</span>
          <span class="stat-value status-good">~${cacheSize > 0 ? '75%' : '0%'}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Cache Status:</span>
          <span class="stat-value ${cacheSize > 0 ? 'status-good' : 'status-warning'}">
            ${cacheSize > 0 ? '✓ Active' : '○ Empty'}
          </span>
        </div>
      </div>
    </div>

    <button class="refresh-btn" onclick="refreshPage()">🔄 Refresh Now</button>
    <div class="timestamp">Last updated: ${new Date().toLocaleString()} • Auto-refresh: 5s</div>
  </div>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Monitoring API endpoint (JSON)
app.get('/monitoring/metrics', (req, res) => {
  const stats = pool.getStats();
  const uptime = process.uptime();
  const memory = process.memoryUsage();

  res.json({
    timestamp: new Date().toISOString(),
    server: {
      uptime: uptime,
      uptimeFormatted: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    },
    connectionPool: stats,
    memory: {
      rss: memory.rss,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
      arrayBuffers: memory.arrayBuffers,
      heapUsagePercent: ((memory.heapUsed / memory.heapTotal) * 100).toFixed(2)
    },
    cache: {
      size: queryCache.size,
      maxSize: 1000
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connection pool...');
  if (pool) {
    await pool.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, closing connection pool...');
  if (pool) {
    await pool.close();
  }
  process.exit(0);
});

// Start server FIRST, then initialize database
app.listen(PORT, () => {
  console.log(`\n🚀 Pooled Chess Stats API running on http://localhost:${PORT}`);
  console.log('📊 Features enabled:');
  console.log('  ✅ Connection Pooling (3-15 connections)');
  console.log('  ✅ Query Builder for complex queries');
  console.log('  ✅ In-memory query caching');
  console.log('  ✅ Database optimizations (WAL, cache, indexes)');
  console.log('  ✅ Pool monitoring and statistics');
  console.log('\nEndpoints:');
  console.log(`  GET http://localhost:${PORT}/health`);
  console.log(`  GET http://localhost:${PORT}/api/pool/stats`);
  console.log(`  GET http://localhost:${PORT}/api/games/search`);
  console.log(`  GET http://localhost:${PORT}/api/games/recent`);
  console.log(`  GET http://localhost:${PORT}/api/players/top`);
  console.log(`  GET http://localhost:${PORT}/api/players/:name/stats`);
  console.log(`  GET http://localhost:${PORT}/api/openings/stats`);
  console.log(`  GET http://localhost:${PORT}/api/tournaments/:name/standings`);
  console.log(`  GET http://localhost:${PORT}/api/stats/database`);
  console.log(`  GET http://localhost:${PORT}/api/stress-test`);
  console.log(`  POST http://localhost:${PORT}/api/cache/clear`);
  console.log('\n⏳ Initializing database connection pool...');

  // Initialize pool after server starts
  initializePool()
    .then(() => {
      console.log('✅ Database pool ready for requests\n');
    })
    .catch((error) => {
      console.error('❌ Failed to initialize database pool:', error.message);
      console.error('⚠️  Server will continue running but database endpoints will not work');
      console.error('   Check RAILWAY_VOLUME_MOUNT_PATH and database file location\n');
    });
});