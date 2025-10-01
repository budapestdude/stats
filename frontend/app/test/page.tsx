'use client';

import { useState } from 'react';
import axios from 'axios';

import { API_BASE_URL } from '@/lib/config';

export default function TestPage() {
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [customPath, setCustomPath] = useState('');

  const endpoints = [
    { name: 'Health Check', path: '/health' },
    { name: 'API Test', path: '/api/test' },
    { name: 'Stats Overview', path: '/api/stats/overview' },
    { name: 'Rating Distribution', path: '/api/stats/rating-distribution' },
    { name: 'Top Players', path: '/api/players/top' },
    { name: 'Player: Magnus Carlsen', path: '/api/players/magnuscarlsen' },
    { name: 'Player: Hikaru Nakamura', path: '/api/players/hikaru' },
    { name: 'Opening Explorer', path: '/api/openings/explorer' },
    { name: 'Popular Openings', path: '/api/openings/popular' },
    { name: 'Tournaments', path: '/api/tournaments' },
    { name: 'OTB Tournaments', path: '/api/otb/database/tournaments' },
  ];

  const testEndpoint = async (path: string) => {
    setLoading(true);
    setError(null);
    setResponse(null);
    setSelectedEndpoint(path);

    try {
      const res = await axios.get(`${API_BASE_URL}${path}`);
      setResponse(res.data);
    } catch (err: any) {
      setError(err.message + (err.response?.data ? ': ' + JSON.stringify(err.response.data) : ''));
    } finally {
      setLoading(false);
    }
  };

  const testCustomEndpoint = () => {
    if (customPath) {
      const path = customPath.startsWith('/') ? customPath : '/' + customPath;
      testEndpoint(path);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Chess Stats API Test Interface</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Quick Test Endpoints</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {endpoints.map((endpoint) => (
              <button
                key={endpoint.path}
                onClick={() => testEndpoint(endpoint.path)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                disabled={loading}
              >
                {endpoint.name}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Custom Endpoint</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="Enter API path (e.g., /api/players/username)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && testCustomEndpoint()}
            />
            <button
              onClick={testCustomEndpoint}
              className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
              disabled={loading || !customPath}
            >
              Test
            </button>
          </div>
        </div>

        {selectedEndpoint && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-2">Testing: {selectedEndpoint}</h2>
            <p className="text-gray-600 text-sm mb-4">
              Full URL: {API_BASE_URL}{selectedEndpoint}
            </p>
          </div>
        )}

        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <p className="text-blue-700">Loading...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h3 className="text-red-700 font-semibold mb-2">Error</h3>
            <p className="text-red-600 font-mono text-sm">{error}</p>
          </div>
        )}

        {response && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-green-700 font-semibold mb-2">Response</h3>
            <pre className="bg-white p-4 rounded border border-gray-200 overflow-auto max-h-96 text-xs">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}