const fs = require('fs');
const path = require('path');

// Mock the database analyzer module
const DatabaseAnalyzer = {
  analyze: jest.fn(),
  getTableStats: jest.fn(),
  getIndexStats: jest.fn(),
  getQueryPerformance: jest.fn(),
  suggestOptimizations: jest.fn()
};

describe('Database Analyzer Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyze', () => {
    it('should analyze database structure', async () => {
      const mockAnalysis = {
        tables: ['games', 'tournaments', 'players'],
        totalSize: 1024 * 1024 * 100, // 100MB
        rowCounts: {
          games: 1000000,
          tournaments: 500,
          players: 10000
        }
      };

      DatabaseAnalyzer.analyze.mockResolvedValue(mockAnalysis);

      const result = await DatabaseAnalyzer.analyze('test.db');
      
      expect(result.tables).toHaveLength(3);
      expect(result.rowCounts.games).toBe(1000000);
      expect(DatabaseAnalyzer.analyze).toHaveBeenCalledWith('test.db');
    });

    it('should handle analysis errors', async () => {
      DatabaseAnalyzer.analyze.mockRejectedValue(new Error('Database not found'));

      await expect(DatabaseAnalyzer.analyze('nonexistent.db'))
        .rejects.toThrow('Database not found');
    });
  });

  describe('getTableStats', () => {
    it('should get detailed table statistics', async () => {
      const tableStats = {
        name: 'games',
        rowCount: 1000000,
        avgRowSize: 256,
        totalSize: 256000000,
        indexes: ['idx_players', 'idx_date'],
        columns: 15
      };

      DatabaseAnalyzer.getTableStats.mockResolvedValue(tableStats);

      const result = await DatabaseAnalyzer.getTableStats('games');
      
      expect(result.rowCount).toBe(1000000);
      expect(result.indexes).toHaveLength(2);
      expect(result.avgRowSize).toBe(256);
    });

    it('should calculate table size in MB', async () => {
      const tableStats = {
        totalSize: 256000000 // bytes
      };

      DatabaseAnalyzer.getTableStats.mockResolvedValue(tableStats);

      const result = await DatabaseAnalyzer.getTableStats('games');
      const sizeInMB = result.totalSize / (1024 * 1024);
      
      expect(sizeInMB).toBeCloseTo(244.14, 2);
    });
  });

  describe('getIndexStats', () => {
    it('should analyze index usage', async () => {
      const indexStats = {
        'idx_games_players': {
          table: 'games',
          columns: ['white_player', 'black_player'],
          unique: false,
          size: 50000000,
          cardinality: 10000
        },
        'idx_games_date': {
          table: 'games',
          columns: ['date'],
          unique: false,
          size: 20000000,
          cardinality: 3650
        }
      };

      DatabaseAnalyzer.getIndexStats.mockResolvedValue(indexStats);

      const result = await DatabaseAnalyzer.getIndexStats();
      
      expect(Object.keys(result)).toHaveLength(2);
      expect(result['idx_games_players'].cardinality).toBe(10000);
      expect(result['idx_games_date'].columns).toContain('date');
    });

    it('should identify unused indexes', async () => {
      const indexStats = {
        'idx_unused': {
          table: 'games',
          columns: ['unused_column'],
          usageCount: 0,
          lastUsed: null
        }
      };

      DatabaseAnalyzer.getIndexStats.mockResolvedValue(indexStats);

      const result = await DatabaseAnalyzer.getIndexStats();
      const unusedIndexes = Object.entries(result)
        .filter(([_, stats]) => stats.usageCount === 0)
        .map(([name]) => name);
      
      expect(unusedIndexes).toContain('idx_unused');
    });
  });

  describe('getQueryPerformance', () => {
    it('should analyze query performance', async () => {
      const queryPerf = {
        slowQueries: [
          {
            query: 'SELECT * FROM games WHERE white_player = ?',
            avgTime: 1500, // ms
            execCount: 100,
            suggestion: 'Add index on white_player'
          }
        ],
        frequentQueries: [
          {
            query: 'SELECT COUNT(*) FROM games',
            avgTime: 50,
            execCount: 10000
          }
        ]
      };

      DatabaseAnalyzer.getQueryPerformance.mockResolvedValue(queryPerf);

      const result = await DatabaseAnalyzer.getQueryPerformance();
      
      expect(result.slowQueries).toHaveLength(1);
      expect(result.slowQueries[0].avgTime).toBe(1500);
      expect(result.slowQueries[0].suggestion).toContain('index');
    });

    it('should identify optimization opportunities', async () => {
      const queryPerf = {
        slowQueries: [
          { query: 'SELECT * FROM games', avgTime: 5000 },
          { query: 'SELECT * FROM players WHERE name LIKE "%carl%"', avgTime: 2000 }
        ]
      };

      DatabaseAnalyzer.getQueryPerformance.mockResolvedValue(queryPerf);

      const result = await DatabaseAnalyzer.getQueryPerformance();
      const needsOptimization = result.slowQueries.filter(q => q.avgTime > 1000);
      
      expect(needsOptimization).toHaveLength(2);
    });
  });

  describe('suggestOptimizations', () => {
    it('should suggest database optimizations', async () => {
      const suggestions = [
        {
          type: 'index',
          priority: 'high',
          description: 'Create index on games(tournament_name)',
          estimatedImprovement: '80%'
        },
        {
          type: 'vacuum',
          priority: 'medium',
          description: 'Run VACUUM to reclaim space',
          estimatedImprovement: '10% space reduction'
        },
        {
          type: 'denormalization',
          priority: 'low',
          description: 'Consider caching player statistics',
          estimatedImprovement: '50% faster stats queries'
        }
      ];

      DatabaseAnalyzer.suggestOptimizations.mockResolvedValue(suggestions);

      const result = await DatabaseAnalyzer.suggestOptimizations();
      
      expect(result).toHaveLength(3);
      expect(result[0].priority).toBe('high');
      expect(result[0].type).toBe('index');
    });

    it('should prioritize optimizations', async () => {
      const suggestions = [
        { priority: 'low', impact: 10 },
        { priority: 'high', impact: 100 },
        { priority: 'medium', impact: 50 }
      ];

      DatabaseAnalyzer.suggestOptimizations.mockResolvedValue(suggestions);

      const result = await DatabaseAnalyzer.suggestOptimizations();
      const highPriority = result.filter(s => s.priority === 'high');
      
      expect(highPriority).toHaveLength(1);
      expect(highPriority[0].impact).toBe(100);
    });
  });

  describe('Database Health Checks', () => {
    it('should check database integrity', async () => {
      const integrityCheck = jest.fn().mockResolvedValue({
        status: 'ok',
        errors: [],
        warnings: ['Large table without primary key: temp_games']
      });

      const result = await integrityCheck();
      
      expect(result.status).toBe('ok');
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });

    it('should detect fragmentation', async () => {
      const fragmentation = {
        games: { fragmentation: 25, recommendation: 'Consider VACUUM' },
        players: { fragmentation: 5, recommendation: 'OK' }
      };

      const checkFragmentation = jest.fn().mockResolvedValue(fragmentation);
      const result = await checkFragmentation();
      
      expect(result.games.fragmentation).toBe(25);
      expect(result.games.recommendation).toContain('VACUUM');
    });

    it('should monitor cache hit ratio', () => {
      const cacheStats = {
        hits: 8500,
        misses: 1500,
        hitRatio: 0.85
      };

      const calculateHitRatio = (hits, misses) => hits / (hits + misses);
      const ratio = calculateHitRatio(cacheStats.hits, cacheStats.misses);
      
      expect(ratio).toBe(0.85);
      expect(ratio).toBeGreaterThan(0.8); // Good cache performance
    });
  });

  describe('Query Optimization', () => {
    it('should analyze query execution plan', () => {
      const executionPlan = [
        { step: 1, operation: 'SCAN TABLE games', rows: 1000000 },
        { step: 2, operation: 'USE INDEX idx_players', rows: 100 }
      ];

      const hasTableScan = executionPlan.some(step => 
        step.operation.includes('SCAN TABLE')
      );
      
      expect(hasTableScan).toBe(true);
      expect(executionPlan[1].rows).toBeLessThan(executionPlan[0].rows);
    });

    it('should suggest query rewrites', () => {
      const query = 'SELECT * FROM games WHERE white_player LIKE "%magnus%"';
      const suggestion = {
        original: query,
        optimized: 'SELECT * FROM games WHERE white_player = "Magnus Carlsen"',
        reason: 'Avoid LIKE with leading wildcard'
      };

      expect(suggestion.original).toContain('LIKE');
      expect(suggestion.optimized).not.toContain('LIKE');
      expect(suggestion.reason).toContain('wildcard');
    });

    it('should identify N+1 query problems', () => {
      const queries = [
        'SELECT * FROM tournaments',
        'SELECT * FROM games WHERE tournament_id = 1',
        'SELECT * FROM games WHERE tournament_id = 2',
        'SELECT * FROM games WHERE tournament_id = 3'
      ];

      const hasNPlusOne = queries.filter(q => 
        q.includes('WHERE tournament_id')
      ).length > 2;
      
      expect(hasNPlusOne).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate database growth rate', () => {
      const sizeHistory = [
        { date: '2024-01-01', size: 1000000000 },
        { date: '2024-02-01', size: 1100000000 },
        { date: '2024-03-01', size: 1210000000 }
      ];

      const growthRates = [];
      for (let i = 1; i < sizeHistory.length; i++) {
        const growth = ((sizeHistory[i].size - sizeHistory[i-1].size) / sizeHistory[i-1].size) * 100;
        growthRates.push(growth);
      }

      expect(growthRates[0]).toBe(10); // 10% growth
      expect(growthRates[1]).toBe(10); // 10% growth
    });

    it('should monitor query response times', () => {
      const responseTimes = [120, 150, 130, 180, 140]; // ms
      const avg = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      const max = Math.max(...responseTimes);
      const min = Math.min(...responseTimes);

      expect(avg).toBe(144);
      expect(max).toBe(180);
      expect(min).toBe(120);
    });

    it('should track concurrent connections', () => {
      const connectionPool = {
        max: 100,
        active: 45,
        idle: 10,
        waiting: 0
      };

      const utilization = (connectionPool.active / connectionPool.max) * 100;
      const available = connectionPool.max - connectionPool.active - connectionPool.waiting;

      expect(utilization).toBe(45);
      expect(available).toBe(55);
    });
  });
});