'use client';

import { useState, useEffect } from 'react';
import { Loader2, Trophy, BookOpen, Database, Users, TrendingUp, Search, Activity, Settings, TestTube, Zap, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function DeveloperToolsPage() {
  const [activeTab, setActiveTab] = useState<string>('connection');
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [data, setData] = useState<Record<string, any>>({});
  const [error, setError] = useState<Record<string, string>>({});
  
  // Connection Test State
  const [backendStatus, setBackendStatus] = useState<any>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(false);

  // API Test State
  const [apiUrl, setApiUrl] = useState(`${API_BASE_URL}`);
  const [testResults, setTestResults] = useState<any>({});
  const [apiLoading, setApiLoading] = useState(false);

  // Real Data Test State
  const [playerUsername, setPlayerUsername] = useState('hikaru');
  const [openingMoves, setOpeningMoves] = useState('e2e4');

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    setConnectionLoading(true);
    setConnectionError(null);
    
    try {
      const response = await fetch('http://localhost:3007/health');
      const data = await response.json();
      setBackendStatus(data);
    } catch (err: any) {
      setConnectionError(err.message);
    } finally {
      setConnectionLoading(false);
    }
  };

  const testEndpoint = async (endpoint: string) => {
    setApiLoading(true);
    const results: any = {};
    
    try {
      const response = await fetch(`${apiUrl}${endpoint}`);
      results.status = response.status;
      results.ok = response.ok;
      results.headers = Object.fromEntries(response.headers.entries());
      
      if (response.ok) {
        const data = await response.json();
        results.data = data;
      } else {
        results.error = `HTTP ${response.status}`;
      }
    } catch (error: any) {
      results.error = error.message;
      results.networkError = true;
    }
    
    setTestResults((prev: any) => ({
      ...prev,
      [endpoint]: results
    }));
    setApiLoading(false);
  };

  const testAllEndpoints = async () => {
    const endpoints = [
      '/health',
      '/api/test',
      '/api/players/top',
      '/api/stats/overview',
      '/api/players',
      '/api/players/search?q=magnus',
      '/api/openings/explorer?play=e2e4',
      '/api/tournaments',
      '/api/otb/database/search'
    ];
    
    setTestResults({});
    for (const endpoint of endpoints) {
      await testEndpoint(endpoint);
    }
  };

  const fetchRealData = async (key: string, url: string) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    setError(prev => ({ ...prev, [key]: '' }));
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      setData(prev => ({ ...prev, [key]: result }));
    } catch (err: any) {
      setError(prev => ({ ...prev, [key]: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const tabs = [
    { id: 'connection', label: 'Connection Test', icon: Zap },
    { id: 'api', label: 'API Endpoints', icon: TestTube },
    { id: 'realdata', label: 'Live Data Test', icon: Activity },
    { id: 'system', label: 'System Info', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Developer Tools</h1>
              <p className="text-gray-600">API testing, connection diagnostics, and system information</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Connection Test Tab */}
        {activeTab === 'connection' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Backend Connection Status</h2>
                <button
                  onClick={testConnection}
                  disabled={connectionLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {connectionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Test Connection
                </button>
              </div>
              
              {connectionLoading && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Testing connection...
                </div>
              )}
              
              {connectionError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    <p className="font-bold">Connection Failed</p>
                  </div>
                  <p>{connectionError}</p>
                  <p className="mt-2 text-sm">
                    Make sure the backend is running on: <code className="bg-gray-100 px-2 py-1">http://localhost:3007</code>
                  </p>
                </div>
              )}
              
              {backendStatus && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    <p className="font-bold">✅ Backend Connected!</p>
                  </div>
                  <pre className="mt-2 text-sm overflow-x-auto">{JSON.stringify(backendStatus, null, 2)}</pre>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Quick Tests</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => window.open('http://localhost:3007/health', '_blank')}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                  Health Endpoint
                </button>
                <button
                  onClick={() => window.open('http://localhost:3007/api/test', '_blank')}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                >
                  API Test
                </button>
                <button
                  onClick={() => window.open('http://localhost:3001', '_blank')}
                  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
                >
                  Frontend
                </button>
                <button
                  onClick={() => window.open('http://localhost:3001/statistics', '_blank')}
                  className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                >
                  Statistics
                </button>
              </div>
            </div>
          </div>
        )}

        {/* API Endpoints Tab */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">API Endpoint Testing</h2>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="API URL"
                  />
                  <button
                    onClick={testAllEndpoints}
                    disabled={apiLoading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {apiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                    Test All
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {Object.entries(testResults).map(([endpoint, result]: [string, any]) => (
                  <div key={endpoint} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <code className="font-mono text-sm">{endpoint}</code>
                      <div className="flex items-center gap-2">
                        {result.ok ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          result.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {result.ok ? 'SUCCESS' : result.networkError ? 'NETWORK ERROR' : `HTTP ${result.status}`}
                        </span>
                      </div>
                    </div>
                    
                    {result.error && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-red-700 text-sm">
                        Error: {result.error}
                      </div>
                    )}
                    
                    {result.data && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                          View Response Data
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto max-h-40">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Real Data Test Tab */}
        {activeTab === 'realdata' && (
          <div className="space-y-6">
            {/* Player Games */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-blue-500" />
                  <h2 className="text-xl font-semibold">Player Game Archives (Chess.com)</h2>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={playerUsername}
                    onChange={(e) => setPlayerUsername(e.target.value)}
                    placeholder="Username"
                    className="px-3 py-1 border rounded"
                  />
                  <button
                    onClick={() => fetchRealData('games', `http://localhost:3007/api/players/${playerUsername}/games/archives?limit=2`)}
                    disabled={loading.games}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading.games ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch Games'}
                  </button>
                </div>
              </div>
              
              {error.games && (
                <div className="text-red-500 mb-4">Error: {error.games}</div>
              )}
              
              {data.games && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    Total games fetched: {data.games.totalGames} from last 2 months
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {data.games.games?.slice(0, 5).map((game: any, i: number) => (
                      <div key={i} className="border rounded p-3 bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold">
                              {game.white.username} ({game.white.rating}) vs {game.black.username} ({game.black.rating})
                            </div>
                            <div className="text-sm text-gray-600">
                              Result: {game.white.result === 'win' ? '1-0' : game.black.result === 'win' ? '0-1' : '1/2-1/2'}
                              {game.opening?.name && ` • ${game.opening.name}`}
                            </div>
                            <div className="text-xs text-gray-500">
                              {game.time_class} • {new Date(game.end_time * 1000).toLocaleDateString()}
                            </div>
                          </div>
                          <a
                            href={game.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline text-sm"
                          >
                            View →
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Opening Explorer */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-6 h-6 text-green-500" />
                  <h2 className="text-xl font-semibold">Opening Explorer (Lichess)</h2>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={openingMoves}
                    onChange={(e) => setOpeningMoves(e.target.value)}
                    placeholder="Moves (e.g., e2e4,e7e5)"
                    className="px-3 py-1 border rounded"
                  />
                  <button
                    onClick={() => fetchRealData('openings', `http://localhost:3007/api/openings/explorer?play=${openingMoves}`)}
                    disabled={loading.openings}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading.openings ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Explore'}
                  </button>
                </div>
              </div>
              
              {error.openings && (
                <div className="text-red-500 mb-4">Error: {error.openings}</div>
              )}
              
              {data.openings && (
                <div className="space-y-4">
                  {data.openings.opening && (
                    <div className="font-semibold text-lg">
                      {data.openings.opening.eco}: {data.openings.opening.name}
                    </div>
                  )}
                  <div className="flex gap-4 text-sm">
                    <span>White wins: {((data.openings.white / (data.openings.white + data.openings.draws + data.openings.black)) * 100).toFixed(1)}%</span>
                    <span>Draws: {((data.openings.draws / (data.openings.white + data.openings.draws + data.openings.black)) * 100).toFixed(1)}%</span>
                    <span>Black wins: {((data.openings.black / (data.openings.white + data.openings.draws + data.openings.black)) * 100).toFixed(1)}%</span>
                    <span>Total: {(data.openings.white + data.openings.draws + data.openings.black).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* System Info Tab */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">System Information</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Frontend URL</p>
                    <p className="font-mono">{typeof window !== 'undefined' ? window.location.origin : 'Loading...'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Backend URL</p>
                    <p className="font-mono">{apiUrl}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">User Agent</p>
                    <p className="font-mono text-xs">{typeof navigator !== 'undefined' ? navigator.userAgent : 'Loading...'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Timestamp</p>
                    <p className="font-mono">{new Date().toISOString()}</p>
                  </div>
                </div>
                
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h3 className="font-semibold text-yellow-800 mb-2">Development Notes:</h3>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Backend should run on port 3007</li>
                    <li>• Frontend runs on port 3001 (Next.js dev server)</li>
                    <li>• Check browser console for CORS errors</li>
                    <li>• Use /dev-tools for comprehensive testing</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}