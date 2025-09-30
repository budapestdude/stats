'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3007';

interface CacheStats {
  cache: {
    hits: number;
    misses: number;
    errors: number;
    writes: number;
    deletes: number;
    hitRate: number;
    hitRateFormatted: string;
    uptime: number;
    uptimeFormatted: string;
    type: string;
    available: boolean;
  };
  rateLimit: {
    blocked: number;
    passed: number;
    queued: number;
    blockRate: string;
    apiCalls: {
      chesscom: { success: number; failed: number; queued: number };
      lichess: { success: number; failed: number; queued: number };
    };
    queues: {
      chesscom: { size: number; pending: number; isPaused: boolean };
      lichess: { size: number; pending: number; isPaused: boolean };
    };
    redisConnected: boolean;
  };
}

export default function CacheMonitorPage() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [invalidatePattern, setInvalidatePattern] = useState('');
  const [warmupUrls, setWarmupUrls] = useState('');

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/api/cache/stats`);
      setStats(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    if (autoRefresh) {
      const interval = setInterval(fetchStats, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const handleInvalidate = async () => {
    if (!invalidatePattern) return;
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/cache/invalidate`, {
        pattern: invalidatePattern
      });
      alert(`Invalidated ${response.data.deleted} cache entries`);
      setInvalidatePattern('');
      fetchStats();
    } catch (err) {
      alert('Failed to invalidate cache');
    }
  };

  const handleWarmup = async () => {
    const urls = warmupUrls.split('\n').filter(u => u.trim());
    
    try {
      await axios.post(`${API_BASE_URL}/api/cache/warmup`, { urls });
      alert(`Started cache warmup for ${urls.length} URLs`);
      setWarmupUrls('');
    } catch (err) {
      alert('Failed to start cache warmup');
    }
  };

  if (!stats && loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-gray-600">Loading statistics...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Cache & Rate Limit Monitor</h1>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Auto-refresh (2s)</span>
            </label>
            <button
              onClick={fetchStats}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">Error: {error}</p>
          </div>
        )}

        {stats && (
          <>
            {/* Cache Statistics */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">
                Cache Statistics ({stats.cache.type})
                <span className={`ml-2 px-2 py-1 text-xs rounded ${
                  stats.cache.available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {stats.cache.available ? 'Active' : 'Inactive'}
                </span>
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-600">Hit Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.cache.hitRateFormatted}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-600">Hits</p>
                  <p className="text-2xl font-bold">{stats.cache.hits.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-600">Misses</p>
                  <p className="text-2xl font-bold">{stats.cache.misses.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-600">Uptime</p>
                  <p className="text-2xl font-bold">{stats.cache.uptimeFormatted}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Writes</p>
                  <p className="text-lg font-semibold">{stats.cache.writes.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Deletes</p>
                  <p className="text-lg font-semibold">{stats.cache.deletes.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Errors</p>
                  <p className="text-lg font-semibold text-red-600">
                    {stats.cache.errors.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Rate Limiting Statistics */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">
                Rate Limiting
                <span className={`ml-2 px-2 py-1 text-xs rounded ${
                  stats.rateLimit.redisConnected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {stats.rateLimit.redisConnected ? 'Redis' : 'Memory'}
                </span>
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-600">Blocked</p>
                  <p className="text-2xl font-bold text-red-600">
                    {stats.rateLimit.blocked.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">{stats.rateLimit.blockRate}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-600">Passed</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.rateLimit.passed.toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-600">Queued</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.rateLimit.queued.toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-600">Total Requests</p>
                  <p className="text-2xl font-bold">
                    {(stats.rateLimit.blocked + stats.rateLimit.passed).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* API-specific stats */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Chess.com API</h3>
                  <div className="bg-gray-50 p-3 rounded space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Success:</span>
                      <span className="font-semibold text-green-600">
                        {stats.rateLimit.apiCalls.chesscom.success}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Failed:</span>
                      <span className="font-semibold text-red-600">
                        {stats.rateLimit.apiCalls.chesscom.failed}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Queue Size:</span>
                      <span className="font-semibold">
                        {stats.rateLimit.queues.chesscom.size}
                      </span>
                    </div>
                    {stats.rateLimit.queues.chesscom.isPaused && (
                      <div className="text-xs text-red-600 font-semibold">
                        ⚠️ Queue Paused (Rate Limited)
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Lichess API</h3>
                  <div className="bg-gray-50 p-3 rounded space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Success:</span>
                      <span className="font-semibold text-green-600">
                        {stats.rateLimit.apiCalls.lichess.success}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Failed:</span>
                      <span className="font-semibold text-red-600">
                        {stats.rateLimit.apiCalls.lichess.failed}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Queue Size:</span>
                      <span className="font-semibold">
                        {stats.rateLimit.queues.lichess.size}
                      </span>
                    </div>
                    {stats.rateLimit.queues.lichess.isPaused && (
                      <div className="text-xs text-red-600 font-semibold">
                        ⚠️ Queue Paused (Rate Limited)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Cache Management */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Cache Invalidation</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Use wildcards to invalidate multiple keys. Example: cache:*:/api/players/*
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={invalidatePattern}
                    onChange={(e) => setInvalidatePattern(e.target.value)}
                    placeholder="cache:*:/api/players/*"
                    className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleInvalidate}
                    disabled={!invalidatePattern}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300"
                  >
                    Invalidate
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Cache Warmup</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Enter URLs to pre-cache (one per line)
                </p>
                <textarea
                  value={warmupUrls}
                  onChange={(e) => setWarmupUrls(e.target.value)}
                  placeholder="/api/stats/overview
/api/players/top
/api/openings/popular"
                  className="w-full h-20 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={handleWarmup}
                  disabled={!warmupUrls}
                  className="mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
                >
                  Start Warmup
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}