'use client';

import { useState, useEffect } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { ConnectionStatusDetailed } from '@/components/ConnectionStatus';
import { LiveGameFeed } from '@/components/LiveGameFeed';
import { Wifi, Users, Trophy, Activity, RefreshCw } from 'lucide-react';

export default function WebSocketTestPage() {
  const { 
    isConnected, 
    connectionState, 
    gameUpdates, 
    playerUpdates, 
    tournamentUpdates,
    connect,
    disconnect,
    subscribeToPlayer,
    subscribeToTopPlayers,
    onGameUpdate,
    onPlayerStatusUpdate,
    onRatingUpdate
  } = useWebSocket();

  const [testPlayer, setTestPlayer] = useState('magnuscarlsen');
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState({
    totalGameUpdates: 0,
    totalPlayerUpdates: 0,
    totalRatingUpdates: 0
  });

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  };

  // Set up event listeners
  useEffect(() => {
    const unsubscribeGame = onGameUpdate((data) => {
      addLog(`Game update: ${data.gameId} - ${data.status} - ${data.players.white} vs ${data.players.black}`);
      setStats(prev => ({ ...prev, totalGameUpdates: prev.totalGameUpdates + 1 }));
    });

    const unsubscribePlayer = onPlayerStatusUpdate((data) => {
      addLog(`Player update: ${data.username} - ${data.isOnline ? 'online' : 'offline'} - Rating: ${data.currentRating}`);
      setStats(prev => ({ ...prev, totalPlayerUpdates: prev.totalPlayerUpdates + 1 }));
    });

    const unsubscribeRating = onRatingUpdate((data) => {
      addLog(`Rating update: ${data.username} - New rating: ${data.newRating} (${data.platform})`);
      setStats(prev => ({ ...prev, totalRatingUpdates: prev.totalRatingUpdates + 1 }));
    });

    return () => {
      unsubscribeGame();
      unsubscribePlayer();
      unsubscribeRating();
    };
  }, [onGameUpdate, onPlayerStatusUpdate, onRatingUpdate]);

  // Log connection state changes
  useEffect(() => {
    addLog(`Connection state changed: ${connectionState}`);
  }, [connectionState]);

  const handleSubscribeToPlayer = () => {
    if (testPlayer.trim()) {
      subscribeToPlayer(testPlayer.trim());
      addLog(`Subscribed to player: ${testPlayer.trim()}`);
    }
  };

  const handleSubscribeToTopPlayers = () => {
    subscribeToTopPlayers('chess.com');
    addLog('Subscribed to Chess.com top players');
  };

  const handleConnect = () => {
    connect();
    addLog('Manual connection attempt initiated');
  };

  const handleDisconnect = () => {
    disconnect();
    addLog('Manual disconnection initiated');
  };

  const clearLogs = () => {
    setLogs([]);
    setStats({ totalGameUpdates: 0, totalPlayerUpdates: 0, totalRatingUpdates: 0 });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">WebSocket Test Dashboard</h1>
          <p className="text-gray-600">Test and monitor real-time WebSocket connections</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Connection Status and Controls */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Wifi className="w-5 h-5" />
                Connection Status
              </h2>
              
              <ConnectionStatusDetailed className="mb-6" />

              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={handleConnect}
                    disabled={isConnected}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Connect
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={!isConnected}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Disconnect
                  </button>
                </div>

                <button
                  onClick={handleSubscribeToTopPlayers}
                  disabled={!isConnected}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Subscribe to Top Players
                </button>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testPlayer}
                    onChange={(e) => setTestPlayer(e.target.value)}
                    placeholder="Player username"
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                  <button
                    onClick={handleSubscribeToPlayer}
                    disabled={!isConnected || !testPlayer.trim()}
                    className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Subscribe
                  </button>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Live Statistics
              </h2>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Game Updates:</span>
                  <span className="text-sm font-medium">{stats.totalGameUpdates}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Player Updates:</span>
                  <span className="text-sm font-medium">{stats.totalPlayerUpdates}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Rating Updates:</span>
                  <span className="text-sm font-medium">{stats.totalRatingUpdates}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-gray-600">Total Data Streams:</span>
                  <span className="text-sm font-medium">
                    {gameUpdates.size + playerUpdates.size + tournamentUpdates.size}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Live Game Feed */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Live Game Feed
                </h2>
              </div>
              <LiveGameFeed className="border-0 shadow-none" />
            </div>
          </div>

          {/* Event Log */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Event Log
                  </h2>
                  <button
                    onClick={clearLogs}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Clear
                  </button>
                </div>
              </div>
              
              <div className="h-96 overflow-y-auto p-4">
                {logs.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center mt-8">
                    No events yet. Connect and subscribe to see real-time updates.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className="text-xs font-mono bg-gray-50 p-2 rounded border-l-4 border-blue-500"
                      >
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Data Tables */}
        <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Game Updates Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Active Games ({gameUpdates.size})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Game</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Players</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Array.from(gameUpdates.values()).map((game) => (
                    <tr key={game.gameId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {game.gameId.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {game.players.white} vs {game.players.black}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          game.status === 'ongoing' ? 'bg-green-100 text-green-800' :
                          game.status === 'finished' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {game.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {gameUpdates.size === 0 && (
                <div className="text-center py-8 text-sm text-gray-500">
                  No active games. Subscribe to top players to see live games.
                </div>
              )}
            </div>
          </div>

          {/* Player Updates Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Player Status ({playerUpdates.size})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Array.from(playerUpdates.values()).map((player) => (
                    <tr key={`${player.username}:${player.platform}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {player.username}
                        <div className="text-xs text-gray-500">{player.platform}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          player.isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {player.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.currentRating}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {playerUpdates.size === 0 && (
                <div className="text-center py-8 text-sm text-gray-500">
                  No player updates yet. Subscribe to specific players to see their status.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}