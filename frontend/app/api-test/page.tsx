'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

import { API_BASE_URL } from '@/lib/config';

interface EndpointCategory {
  name: string;
  endpoints: {
    name: string;
    path: string;
    method: 'GET' | 'POST';
    params?: string[];
    description?: string;
  }[];
}

export default function ApiTestPage() {
  const [results, setResults] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState<Map<string, boolean>>(new Map());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Core']));
  const [paramValues, setParamValues] = useState<Map<string, string>>(new Map());

  const categories: EndpointCategory[] = [
    {
      name: 'Core',
      endpoints: [
        { name: 'Health Check', path: '/health', method: 'GET', description: 'Check if server is running' },
        { name: 'API Test', path: '/api/test', method: 'GET', description: 'Basic API functionality test' },
      ]
    },
    {
      name: 'Statistics',
      endpoints: [
        { name: 'Platform Overview', path: '/api/stats/overview', method: 'GET', description: 'Overall platform statistics' },
        { name: 'Rating Distribution', path: '/api/stats/rating-distribution', method: 'GET', description: 'Player rating distribution' },
        { name: 'Activity Stats', path: '/api/stats/activity', method: 'GET', description: 'Platform activity metrics' },
      ]
    },
    {
      name: 'Players',
      endpoints: [
        { name: 'Top Players', path: '/api/players/top', method: 'GET', description: 'List of top-rated players' },
        { name: 'Search Players', path: '/api/players/search', method: 'GET', params: ['q'], description: 'Search for players by name' },
        { name: 'Get Player', path: '/api/players/{username}', method: 'GET', params: ['username'], description: 'Get specific player data' },
        { name: 'Player Games', path: '/api/players/{username}/games', method: 'GET', params: ['username'], description: 'Get player game history' },
        { name: 'Player Stats', path: '/api/players/{username}/stats', method: 'GET', params: ['username'], description: 'Get player statistics' },
      ]
    },
    {
      name: 'Openings',
      endpoints: [
        { name: 'Opening Stats', path: '/api/openings', method: 'GET', description: 'General opening statistics' },
        { name: 'Opening Explorer', path: '/api/openings/explorer', method: 'GET', params: ['fen', 'play'], description: 'Explore openings from position' },
        { name: 'Popular Openings', path: '/api/openings/popular', method: 'GET', description: 'Most popular chess openings' },
      ]
    },
    {
      name: 'Games',
      endpoints: [
        { name: 'Search Games', path: '/api/games/search', method: 'GET', params: ['player', 'opening'], description: 'Search game database' },
      ]
    },
    {
      name: 'Tournaments',
      endpoints: [
        { name: 'All Tournaments', path: '/api/tournaments', method: 'GET', description: 'List all tournaments' },
        { name: 'Tournament Details', path: '/api/tournaments/{slug}', method: 'GET', params: ['slug'], description: 'Get tournament details' },
      ]
    },
    {
      name: 'OTB Database',
      endpoints: [
        { name: 'Search OTB', path: '/api/otb/database/search', method: 'GET', params: ['q'], description: 'Search OTB database' },
        { name: 'OTB Tournaments', path: '/api/otb/database/tournaments', method: 'GET', description: 'List OTB tournaments' },
        { name: 'Player OTB Games', path: '/api/otb/database/players/{name}/games', method: 'GET', params: ['name'], description: 'Get player OTB games' },
        { name: 'Game Details', path: '/api/otb/database/game/{id}', method: 'GET', params: ['id'], description: 'Get specific game' },
      ]
    }
  ];

  const testEndpoint = async (path: string, params?: string[]) => {
    let finalPath = path;
    
    // Replace parameters in path
    if (params) {
      params.forEach(param => {
        const value = paramValues.get(`${path}-${param}`) || '';
        if (value) {
          finalPath = finalPath.replace(`{${param}}`, value);
        }
      });
      
      // Add query parameters if not in path
      const queryParams = params.filter(p => !path.includes(`{${p}}`));
      if (queryParams.length > 0) {
        const query = queryParams
          .map(p => `${p}=${paramValues.get(`${path}-${p}`) || ''}`)
          .filter(q => q.split('=')[1])
          .join('&');
        if (query) {
          finalPath += '?' + query;
        }
      }
    }

    setLoading(new Map(loading.set(path, true)));

    try {
      const res = await axios.get(`${API_BASE_URL}${finalPath}`);
      setResults(new Map(results.set(path, { success: true, data: res.data, path: finalPath })));
    } catch (err: any) {
      setResults(new Map(results.set(path, { 
        success: false, 
        error: err.message,
        status: err.response?.status,
        data: err.response?.data,
        path: finalPath
      })));
    } finally {
      setLoading(new Map(loading.set(path, false)));
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleParamChange = (key: string, value: string) => {
    setParamValues(new Map(paramValues.set(key, value)));
  };

  const testAll = async (category: EndpointCategory) => {
    for (const endpoint of category.endpoints) {
      if (!endpoint.params || endpoint.params.every(p => paramValues.get(`${endpoint.path}-${p}`))) {
        await testEndpoint(endpoint.path, endpoint.params);
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Comprehensive API Test Suite</h1>
        <p className="text-gray-600 mb-8">Test all Chess Stats API endpoints systematically</p>

        {categories.map((category) => (
          <div key={category.name} className="mb-6">
            <div className="bg-white rounded-lg shadow">
              <div 
                className="p-4 border-b cursor-pointer flex justify-between items-center hover:bg-gray-50"
                onClick={() => toggleCategory(category.name)}
              >
                <h2 className="text-xl font-semibold">{category.name}</h2>
                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      testAll(category);
                    }}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                  >
                    Test All
                  </button>
                  <span className="text-gray-400">
                    {expandedCategories.has(category.name) ? '▼' : '▶'}
                  </span>
                </div>
              </div>
              
              {expandedCategories.has(category.name) && (
                <div className="p-4">
                  {category.endpoints.map((endpoint) => {
                    const result = results.get(endpoint.path);
                    const isLoading = loading.get(endpoint.path);
                    
                    return (
                      <div key={endpoint.path} className="mb-4 pb-4 border-b last:border-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                                {endpoint.method}
                              </span>
                              <code className="text-sm text-gray-700">{endpoint.path}</code>
                              {result && (
                                <span className={`px-2 py-1 rounded text-xs ${
                                  result.success 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {result.success ? '✓ Success' : `✗ ${result.status || 'Error'}`}
                                </span>
                              )}
                            </div>
                            {endpoint.description && (
                              <p className="text-sm text-gray-600">{endpoint.description}</p>
                            )}
                            {endpoint.params && (
                              <div className="mt-2 flex gap-2">
                                {endpoint.params.map(param => (
                                  <input
                                    key={param}
                                    type="text"
                                    placeholder={param}
                                    value={paramValues.get(`${endpoint.path}-${param}`) || ''}
                                    onChange={(e) => handleParamChange(`${endpoint.path}-${param}`, e.target.value)}
                                    className="px-2 py-1 border rounded text-sm"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => testEndpoint(endpoint.path, endpoint.params)}
                            disabled={isLoading || (endpoint.params && !endpoint.params.every(p => paramValues.get(`${endpoint.path}-${p}`)))}
                            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:bg-gray-300"
                          >
                            {isLoading ? 'Testing...' : 'Test'}
                          </button>
                        </div>
                        
                        {result && (
                          <div className="mt-2">
                            <details className="cursor-pointer">
                              <summary className="text-sm text-gray-600 hover:text-gray-800">
                                View Response ({result.success ? 'Success' : 'Failed'}) - {result.path}
                              </summary>
                              <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-60">
                                {JSON.stringify(result.data || result.error, null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Test Parameters</h3>
          <p className="text-sm text-blue-700">
            Default test values: username=magnuscarlsen, q=carlsen, name=Carlsen, slug=world-championship, id=1
          </p>
        </div>
      </div>
    </div>
  );
}