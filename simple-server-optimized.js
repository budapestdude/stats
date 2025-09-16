const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const { QueryBuilder, QueryHelpers } = require('./src/utils/query-builder');
const logger = require('./src/utils/logger');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs');

const app = express();
const PORT = 3009;
const CHESS_COM_API = 'https://api.chess.com/pub';
const LICHESS_API = 'https://lichess.org/api';

// Proper User-Agent header as required by Chess.com API terms
const USER_AGENT = 'Chess-Stats-Website/1.0 (contact: chessstats@example.com; purpose: educational)';

app.use(cors({
  origin: function(origin, callback) {
    // Allow any localhost port
    if (!origin || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Database instance with optimizations
let db = null;
const dbPath = path.join(__dirname, 'otb-database', 'complete-tournaments.db');

// Query cache
const queryCache = new Map();
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize optimized database connection
 */
async function initializeDatabase() {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
      mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
    });

    // Apply performance optimizations
    const optimizations = [
      'PRAGMA cache_size = 10000',        // 10MB cache
      'PRAGMA temp_store = MEMORY',       // Use memory for temp tables
      'PRAGMA mmap_size = 30000000000',   // 30GB memory-mapped I/O
      'PRAGMA journal_mode = WAL',        // Write-Ahead Logging
      'PRAGMA synchronous = NORMAL',      // Balance safety and speed
      'PRAGMA wal_autocheckpoint = 1000', // Auto-checkpoint every 1000 pages
      'PRAGMA optimize',                  // Run optimizer
      'PRAGMA analysis_limit = 1000',     // Analyze sample size
      'PRAGMA automatic_index = ON'       // Allow automatic indexes
    ];

    for (const pragma of optimizations) {
      await db.run(pragma);
      logger.debug(`Applied: ${pragma}`);
    }

    // Get database stats
    const gameCount = await db.get('SELECT COUNT(*) as count FROM games');
    console.log(`✅ Connected to optimized database with ${gameCount.count.toLocaleString()} games`);
    
    return db;
  } catch (error) {
    logger.error('Database initialization failed', error);
    throw error;
  }
}

/**
 * Execute query with caching
 */
async function cachedQuery(cacheKey, queryBuilder, ttl = CACHE_TIMEOUT) {
  // Check cache
  if (queryCache.has(cacheKey)) {
    const cached = queryCache.get(cacheKey);
    if (Date.now() - cached.timestamp < ttl) {
      logger.debug(`Cache hit: ${cacheKey}`);
      return cached.data;
    }
  }

  // Build and execute query
  const { sql, params } = queryBuilder.build();
  const startTime = Date.now();
  
  const result = await db.all(sql, params);
  const duration = Date.now() - startTime;
  
  logger.debug(`Query executed (${duration}ms): ${sql.substring(0, 100)}...`);
  
  // Cache result
  queryCache.set(cacheKey, {
    data: result,
    timestamp: Date.now()
  });

  // Clean old cache entries periodically
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

// Initialize database on startup
initializeDatabase().catch(error => {
  console.error('Failed to initialize database:', error);
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'Optimized Chess Stats API is running!',
    cache: {
      size: queryCache.size,
      maxAge: CACHE_TIMEOUT
    }
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Optimized API is working!',
    features: ['query-builder', 'caching', 'optimized-indexes']
  });
});

// Search games with optimized query builder
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

    // Build WHERE conditions
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

    // Generate cache key
    const cacheKey = `games:${JSON.stringify(req.query)}`;
    
    // Execute with caching
    const games = await cachedQuery(cacheKey, query);
    
    // Get total count
    const countQuery = query.clone().buildCount();
    const totalResult = await db.get(countQuery.sql, countQuery.params);
    
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

// Get player statistics with optimized queries
app.get('/api/players/:name/stats', async (req, res) => {
  try {
    const playerName = req.params.name;
    
    // Use prepared query helper
    const { sql, params } = QueryHelpers.playerStats(playerName);
    
    const cacheKey = `player-stats:${playerName}`;
    
    // Check cache
    if (queryCache.has(cacheKey)) {
      const cached = queryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TIMEOUT) {
        return res.json(cached.data);
      }
    }
    
    // Execute optimized query
    const stats = await db.get(sql, params);
    
    // Calculate percentages
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

// Get opening statistics with optimized queries
app.get('/api/openings/stats', async (req, res) => {
  try {
    const { eco, limit = 20, minGames = 10 } = req.query;
    
    // Use prepared query helper
    const { sql, params } = QueryHelpers.openingStats(eco, {
      limit: parseInt(limit),
      minGames: parseInt(minGames)
    });
    
    const cacheKey = `opening-stats:${JSON.stringify(req.query)}`;
    
    // Execute with caching
    const openings = await cachedQuery(cacheKey, {
      build: () => ({ sql, params })
    });
    
    res.json({ openings });
    
  } catch (error) {
    logger.error('Error getting opening stats:', error);
    res.status(500).json({ error: 'Failed to get opening statistics' });
  }
});

// Get tournament standings with optimized queries
app.get('/api/tournaments/:name/standings', async (req, res) => {
  try {
    const tournamentName = decodeURIComponent(req.params.name);
    
    // Use prepared query helper
    const { sql, params } = QueryHelpers.tournamentStandings(tournamentName);
    
    const cacheKey = `tournament-standings:${tournamentName}`;
    
    // Execute with caching
    const standings = await cachedQuery(cacheKey, {
      build: () => ({ sql, params })
    });
    
    res.json({ 
      tournament: tournamentName,
      standings 
    });
    
  } catch (error) {
    logger.error('Error getting tournament standings:', error);
    res.status(500).json({ error: 'Failed to get tournament standings' });
  }
});

// Top players by game count
app.get('/api/players/top', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const query = new QueryBuilder('games')
      .select('white_player as player', 'COUNT(*) as games')
      .groupBy('white_player')
      .having('COUNT(*)', '>=', 100)
      .orderBy('games', 'DESC')
      .limit(parseInt(limit));
    
    const cacheKey = `top-players:${limit}`;
    const players = await cachedQuery(cacheKey, query);
    
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
    const games = await cachedQuery(cacheKey, query, 60000); // 1 minute cache
    
    res.json({ games });
    
  } catch (error) {
    logger.error('Error getting recent games:', error);
    res.status(500).json({ error: 'Failed to get recent games' });
  }
});

// Database statistics endpoint
app.get('/api/stats/database', async (req, res) => {
  try {
    const cacheKey = 'database-stats';
    
    // Check cache
    if (queryCache.has(cacheKey)) {
      const cached = queryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TIMEOUT * 2) { // Longer cache for stats
        return res.json(cached.data);
      }
    }
    
    const stats = {
      games: await db.get('SELECT COUNT(*) as count FROM games'),
      tournaments: await db.get('SELECT COUNT(DISTINCT tournament_name) as count FROM games'),
      players: await db.get('SELECT COUNT(DISTINCT white_player) + COUNT(DISTINCT black_player) as count FROM games'),
      dateRange: await db.get('SELECT MIN(date) as min_date, MAX(date) as max_date FROM games WHERE date IS NOT NULL'),
      cache: {
        entries: queryCache.size,
        maxAge: CACHE_TIMEOUT
      }
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

// Clear cache endpoint (for development)
app.post('/api/cache/clear', (req, res) => {
  const oldSize = queryCache.size;
  queryCache.clear();
  res.json({ 
    message: 'Cache cleared',
    entriesCleared: oldSize 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Optimized Chess Stats API running on http://localhost:${PORT}`);
  console.log('📊 Features enabled:');
  console.log('  ✅ Query Builder for complex queries');
  console.log('  ✅ In-memory query caching');
  console.log('  ✅ Database optimizations (WAL, cache, indexes)');
  console.log('  ✅ Prepared statement helpers');
  console.log('\nEndpoints:');
  console.log(`  GET http://localhost:${PORT}/health`);
  console.log(`  GET http://localhost:${PORT}/api/games/search`);
  console.log(`  GET http://localhost:${PORT}/api/games/recent`);
  console.log(`  GET http://localhost:${PORT}/api/players/top`);
  console.log(`  GET http://localhost:${PORT}/api/players/:name/stats`);
  console.log(`  GET http://localhost:${PORT}/api/openings/stats`);
  console.log(`  GET http://localhost:${PORT}/api/tournaments/:name/standings`);
  console.log(`  GET http://localhost:${PORT}/api/stats/database`);
  console.log(`  POST http://localhost:${PORT}/api/cache/clear`);
});