'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3007';

interface TestResult {
  name: string;
  endpoint: string;
  status: 'pending' | 'testing' | 'success' | 'failed';
  data?: any;
  error?: string;
  responseTime?: number;
}

export default function RealDataTestPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState({ passed: 0, failed: 0, total: 0 });

  const realDataTests = [
    {
      name: 'Chess.com Player - Magnus Carlsen',
      endpoint: '/api/players/magnuscarlsen',
      validate: (data: any) => data && data.username && data.rating
    },
    {
      name: 'Chess.com Player - Hikaru Nakamura',
      endpoint: '/api/players/hikaru',
      validate: (data: any) => data && data.username && data.rating
    },
    {
      name: 'Lichess Opening Explorer - Starting Position',
      endpoint: '/api/openings/explorer',
      validate: (data: any) => data && (data.moves || data.opening)
    },
    {
      name: 'Platform Statistics',
      endpoint: '/api/stats/overview',
      validate: (data: any) => data && data.totalPlayers && data.totalGames
    },
    {
      name: 'Rating Distribution Data',
      endpoint: '/api/stats/rating-distribution',
      validate: (data: any) => data && data.distribution && Array.isArray(data.distribution)
    },
    {
      name: 'Top Players List',
      endpoint: '/api/players/top',
      validate: (data: any) => data && (Array.isArray(data) || data.players)
    },
    {
      name: 'Tournament List',
      endpoint: '/api/tournaments',
      validate: (data: any) => data && (Array.isArray(data) || data.tournaments)
    },
    {
      name: 'OTB Database Tournaments',
      endpoint: '/api/otb/database/tournaments',
      validate: (data: any) => data !== undefined // May be empty array if no data
    },
    {
      name: 'Popular Openings',
      endpoint: '/api/openings/popular',
      validate: (data: any) => data && (Array.isArray(data) || data.openings)
    },
    {
      name: 'Server Health Check',
      endpoint: '/health',
      validate: (data: any) => data && data.status === 'healthy'
    }
  ];

  const runTest = async (test: any): Promise<TestResult> => {
    const startTime = Date.now();
    try {
      const response = await axios.get(`${API_BASE_URL}${test.endpoint}`, {
        timeout: 10000 // 10 second timeout
      });
      const responseTime = Date.now() - startTime;
      
      const isValid = test.validate(response.data);
      
      return {
        name: test.name,
        endpoint: test.endpoint,
        status: isValid ? 'success' : 'failed',
        data: response.data,
        responseTime,
        error: isValid ? undefined : 'Response validation failed'
      };
    } catch (error: any) {
      return {
        name: test.name,
        endpoint: test.endpoint,
        status: 'failed',
        error: error.message || 'Unknown error',
        responseTime: Date.now() - startTime
      };
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    const results: TestResult[] = realDataTests.map(test => ({
      name: test.name,
      endpoint: test.endpoint,
      status: 'pending'
    }));
    setTestResults(results);

    for (let i = 0; i < realDataTests.length; i++) {
      // Update status to testing
      results[i].status = 'testing';
      setTestResults([...results]);

      // Run the test
      const result = await runTest(realDataTests[i]);
      results[i] = result;
      setTestResults([...results]);

      // Small delay between tests to avoid overwhelming the server
      if (i < realDataTests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Calculate summary
    const passed = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    setSummary({ passed, failed, total: results.length });
    setIsRunning(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'testing': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'failed': return '❌';
      case 'testing': return '⏳';
      default: return '⏸';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Real Data Validation Tests</h1>
        <p className="text-gray-600 mb-8">
          Validate API endpoints with actual Chess.com and Lichess data
        </p>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold">Test Suite</h2>
              <p className="text-sm text-gray-600">
                {realDataTests.length} tests configured
              </p>
            </div>
            <button
              onClick={runAllTests}
              disabled={isRunning}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
            >
              {isRunning ? 'Running Tests...' : 'Run All Tests'}
            </button>
          </div>

          {summary.total > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 p-3 rounded">
                <p className="text-green-800 text-2xl font-bold">{summary.passed}</p>
                <p className="text-green-600 text-sm">Passed</p>
              </div>
              <div className="bg-red-50 p-3 rounded">
                <p className="text-red-800 text-2xl font-bold">{summary.failed}</p>
                <p className="text-red-600 text-sm">Failed</p>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-blue-800 text-2xl font-bold">
                  {summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0}%
                </p>
                <p className="text-blue-600 text-sm">Success Rate</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {testResults.map((result, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span>{getStatusIcon(result.status)}</span>
                      <h3 className="font-semibold">{result.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(result.status)}`}>
                        {result.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      <code>{result.endpoint}</code>
                    </p>
                  </div>
                  {result.responseTime && (
                    <span className="text-sm text-gray-500">
                      {result.responseTime}ms
                    </span>
                  )}
                </div>

                {result.error && (
                  <div className="mt-2 p-2 bg-red-50 rounded">
                    <p className="text-sm text-red-700">Error: {result.error}</p>
                  </div>
                )}

                {result.data && result.status === 'success' && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                      View Response Data
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>

          {testResults.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Click "Run All Tests" to start validation
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">About These Tests</h3>
          <p className="text-sm text-blue-700">
            These tests validate that the API endpoints are working correctly with real data from Chess.com and Lichess.
            Each test checks both the response status and validates the structure of the returned data.
          </p>
        </div>
      </div>
    </div>
  );
}