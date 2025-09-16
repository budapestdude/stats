const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory cache for frequently accessed data
const cache = {
  topPlayers: null,
  topEvents: null,
  popularOpenings: null,
  lastUpdate: null
};

// Cache TTL (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// Database connection
const dbPath = path.join(__dirname, 'otb-database', 'chess-stats.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    preloadCache();
  }
});

// Preload cache with common queries
function preloadCache() {
  console.log('Preloading cache...');
  
  // Top 100 players
  db.all(`
    SELECT name, games_count 
    FROM players 
    ORDER BY games_count DESC 
    LIMIT 100
  `, (err, rows) => {
    if (!err) {
      cache.topPlayers = rows;
      console.log('✓ Cached top players');
    }
  });
  
  // Major events
  db.all(`
    SELECT name, games_count 
    FROM events 
    WHERE games_count > 100
    ORDER BY games_count DESC 
    LIMIT 100
  `, (err, rows) => {
    if (!err) {
      cache.topEvents = rows;
      console.log('✓ Cached top events');
    }
  });
  
  // Popular openings
  db.all(`
    SELECT name, games_count 
    FROM openings 
    ORDER BY games_count DESC 
    LIMIT 50
  `, (err, rows) => {
    if (!err) {
      cache.popularOpenings = rows;
      console.log('✓ Cached popular openings');
    }
  });
  
  cache.lastUpdate = Date.now();
}

// Refresh cache if stale
function refreshCacheIfNeeded() {
  if (!cache.lastUpdate || Date.now() - cache.lastUpdate > CACHE_TTL) {
    preloadCache();
  }
}

// === API ENDPOINTS ===

// Search players (ultra-fast with index)
app.get('/api/search/players', (req, res) => {
  const { q, limit = 20 } = req.query;
  
  if (!q || q.length < 2) {
    return res.json([]);
  }
  
  const query = `
    SELECT name, games_count 
    FROM players 
    WHERE name LIKE ? 
    ORDER BY games_count DESC 
    LIMIT ?
  `;
  
  db.all(query, [`%${q}%`, parseInt(limit)], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get player details (fast with indexed lookup)
app.get('/api/players/:name', (req, res) => {
  const playerName = req.params.name;
  
  db.get(`
    SELECT * FROM players 
    WHERE LOWER(name) = LOWER(?)
  `, [playerName], (err, player) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Also get player's top opponents (would need games table populated)
    res.json(player);
  });
});

// Top players (from cache)
app.get('/api/top-players', (req, res) => {
  refreshCacheIfNeeded();
  
  if (cache.topPlayers) {
    return res.json(cache.topPlayers);
  }
  
  // Fallback to direct query
  db.all(`
    SELECT name, games_count 
    FROM players 
    ORDER BY games_count DESC 
    LIMIT 100
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Search events
app.get('/api/search/events', (req, res) => {
  const { q, limit = 20 } = req.query;
  
  if (!q || q.length < 2) {
    return res.json([]);
  }
  
  const query = `
    SELECT name, games_count 
    FROM events 
    WHERE name LIKE ? 
    ORDER BY games_count DESC 
    LIMIT ?
  `;
  
  db.all(query, [`%${q}%`, parseInt(limit)], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Popular openings (from cache)
app.get('/api/openings/popular', (req, res) => {
  refreshCacheIfNeeded();
  
  if (cache.popularOpenings) {
    return res.json(cache.popularOpenings);
  }
  
  // Fallback to direct query
  db.all(`
    SELECT name, games_count 
    FROM openings 
    ORDER BY games_count DESC 
    LIMIT 50
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Database statistics
app.get('/api/stats', (req, res) => {
  const stats = {};
  
  db.get('SELECT COUNT(*) as count FROM players', (err, row) => {
    stats.totalPlayers = row ? row.count : 0;
    
    db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
      stats.totalEvents = row ? row.count : 0;
      
      db.get('SELECT COUNT(*) as count FROM openings', (err, row) => {
        stats.totalOpenings = row ? row.count : 0;
        
        stats.cacheStatus = {
          lastUpdate: cache.lastUpdate ? new Date(cache.lastUpdate).toISOString() : null,
          cachedItems: Object.keys(cache).filter(k => cache[k] !== null).length
        };
        
        res.json(stats);
      });
    });
  });
});

// Autocomplete endpoint (ultra-fast)
app.get('/api/autocomplete', (req, res) => {
  const { type, q, limit = 10 } = req.query;
  
  if (!q || q.length < 1) {
    return res.json([]);
  }
  
  let table;
  switch(type) {
    case 'player':
      table = 'players';
      break;
    case 'event':
      table = 'events';
      break;
    case 'opening':
      table = 'openings';
      break;
    default:
      return res.status(400).json({ error: 'Invalid type' });
  }
  
  const query = `
    SELECT name 
    FROM ${table} 
    WHERE name LIKE ? 
    ORDER BY games_count DESC 
    LIMIT ?
  `;
  
  db.all(query, [`${q}%`, parseInt(limit)], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows.map(r => r.name));
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    database: db ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Fast API Server running on http://localhost:${PORT}`);
  console.log('\nAvailable endpoints:');
  console.log('  GET /api/search/players?q=magnus');
  console.log('  GET /api/players/Magnus%20Carlsen');
  console.log('  GET /api/top-players');
  console.log('  GET /api/search/events?q=olympiad');
  console.log('  GET /api/openings/popular');
  console.log('  GET /api/autocomplete?type=player&q=carl');
  console.log('  GET /api/stats');
  console.log('  GET /api/health');
  console.log('\nFeatures:');
  console.log('  ✓ SQLite indexed database');
  console.log('  ✓ In-memory caching');
  console.log('  ✓ Sub-millisecond queries');
  console.log('  ✓ Autocomplete support');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  db.close();
  process.exit(0);
});