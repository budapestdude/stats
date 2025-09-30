'use client';

import { useState, useEffect } from 'react';
import { useWebSocket, GameUpdate } from '@/contexts/WebSocketContext';
import { Clock, User, Trophy, Circle } from 'lucide-react';

interface LiveGameFeedProps {
  maxGames?: number;
  className?: string;
  showConnectionStatus?: boolean;
}

export function LiveGameFeed({ 
  maxGames = 10, 
  className = '',
  showConnectionStatus = true 
}: LiveGameFeedProps) {
  const { gameUpdates, isConnected, subscribeToTopPlayers, onGameUpdate } = useWebSocket();
  const [recentGames, setRecentGames] = useState<GameUpdate[]>([]);

  useEffect(() => {
    // Subscribe to top players' games when component mounts
    subscribeToTopPlayers('chess.com');
    subscribeToTopPlayers('lichess');
  }, [subscribeToTopPlayers]);

  useEffect(() => {
    // Set up listener for new game updates
    const unsubscribe = onGameUpdate((gameUpdate) => {
      setRecentGames(prev => {
        const filtered = prev.filter(game => game.gameId !== gameUpdate.gameId);
        const newGames = [gameUpdate, ...filtered].slice(0, maxGames);
        return newGames;
      });
    });

    return unsubscribe;
  }, [onGameUpdate, maxGames]);

  // Convert Map to array for display
  useEffect(() => {
    const gamesArray = Array.from(gameUpdates.values())
      .sort((a, b) => new Date(b.lastMove || 0).getTime() - new Date(a.lastMove || 0).getTime())
      .slice(0, maxGames);
    
    setRecentGames(gamesArray);
  }, [gameUpdates, maxGames]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ongoing': return 'text-green-600';
      case 'finished': return 'text-gray-600';
      case 'aborted': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ongoing': return <Circle className="w-2 h-2 fill-current text-green-500 animate-pulse" />;
      case 'finished': return <Trophy className="w-3 h-3" />;
      case 'aborted': return <Circle className="w-2 h-2 fill-current text-red-500" />;
      default: return <Circle className="w-2 h-2 fill-current text-gray-400" />;
    }
  };

  if (!isConnected && showConnectionStatus) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-6 text-center ${className}`}>
        <Clock className="w-8 h-8 text-gray-400 mx-auto mb-3" />
        <h3 className="text-sm font-medium text-gray-900 mb-1">Live Feed Unavailable</h3>
        <p className="text-xs text-gray-500">
          Connect to see real-time game updates
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Circle className="w-2 h-2 fill-current text-green-500 animate-pulse" />
              <h3 className="text-sm font-medium text-gray-900">Live Games</h3>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {recentGames.length} active
          </div>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {recentGames.length === 0 ? (
          <div className="p-6 text-center">
            <Clock className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              {isConnected ? 'Waiting for game updates...' : 'No active games'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentGames.map((game) => (
              <div key={game.gameId} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(game.status)}
                        <span className={`text-xs font-medium capitalize ${getStatusColor(game.status)}`}>
                          {game.status}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {game.timeControl}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {game.players.white}
                        </span>
                        <span className="text-xs text-gray-500">vs</span>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {game.players.black}
                        </span>
                      </div>

                      {game.lastMove && (
                        <div className="text-xs text-gray-500">
                          Last move: <span className="font-mono">{game.lastMove}</span>
                        </div>
                      )}

                      {game.result && (
                        <div className="text-xs text-gray-600">
                          Result: {game.result}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {recentGames.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button className="text-xs text-gray-600 hover:text-gray-900 font-medium">
            View all live games →
          </button>
        </div>
      )}
    </div>
  );
}

// Compact version for sidebars
export function LiveGameFeedCompact({ className = '' }: { className?: string }) {
  return (
    <LiveGameFeed 
      maxGames={5} 
      className={className}
      showConnectionStatus={false}
    />
  );
}

// Header version for showing just count and status
export function LiveGameCounter({ className = '' }: { className?: string }) {
  const { gameUpdates, isConnected } = useWebSocket();
  const ongoingGamesCount = Array.from(gameUpdates.values()).filter(game => game.status === 'ongoing').length;

  if (!isConnected) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Circle className="w-2 h-2 fill-current text-green-500 animate-pulse" />
      <span className="text-xs text-gray-600">
        {ongoingGamesCount} live games
      </span>
    </div>
  );
}