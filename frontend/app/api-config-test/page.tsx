'use client';

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/config';

export default function ApiConfigTest() {
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const apiUrl = getApiBaseUrl();
    setConfig({
      apiUrl,
      hostname: window.location.hostname,
      buildTimeVar: process.env.NEXT_PUBLIC_API_URL || 'not set',
      isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">API Configuration Test</h1>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">Current Configuration</h2>

          {config ? (
            <>
              <div className="border-b pb-3">
                <p className="text-sm text-gray-600">API URL (Runtime)</p>
                <p className="font-mono text-lg font-bold text-blue-600">{config.apiUrl}</p>
              </div>

              <div className="border-b pb-3">
                <p className="text-sm text-gray-600">Current Hostname</p>
                <p className="font-mono">{config.hostname}</p>
              </div>

              <div className="border-b pb-3">
                <p className="text-sm text-gray-600">NEXT_PUBLIC_API_URL (Build Time)</p>
                <p className="font-mono">{config.buildTimeVar}</p>
              </div>

              <div className="border-b pb-3">
                <p className="text-sm text-gray-600">Is Localhost?</p>
                <p className="font-mono">{config.isLocalhost ? 'Yes' : 'No'}</p>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded">
                <p className="text-sm font-medium mb-2">Expected Behavior:</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>Localhost → http://localhost:3010</li>
                  <li>Railway Production → http://195.201.6.244</li>
                </ul>
              </div>
            </>
          ) : (
            <p>Loading...</p>
          )}
        </div>

        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Test API Call</h2>
          <button
            onClick={async () => {
              try {
                const url = `${getApiBaseUrl()}/health`;
                console.log('Testing:', url);
                const response = await fetch(url);
                const data = await response.json();
                alert(`Success! Response: ${JSON.stringify(data)}`);
              } catch (error: any) {
                alert(`Error: ${error.message}`);
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Test Health Endpoint
          </button>
        </div>
      </div>
    </div>
  );
}
