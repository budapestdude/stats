'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketStats {
  connectedClients: number;
  activeGames: number;
  activeTournaments: number;
  timestamp: string;
}

interface GameUpdate {
  gameId: string;
  white: string;
  black: string;
  result: string;
  moves?: string;
  timestamp: string;
}

interface TournamentUpdate {
  tournamentId: string;
  standings: Array<{
    rank: number;
    player: string;
    gamesPlayed: number;
    score: number;
  }>;
  timestamp: string;
}

export function useWebSocket(serverPath?: string) {
  const socket = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const socketUrl = serverPath || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3007';
    
    // Initialize socket connection
    socket.current = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      transports: ['websocket', 'polling']
    });

    // Connection event handlers
    socket.current.on('connect', () => {
      setIsConnected(true);
      setLastError(null);
      console.log('✅ WebSocket connected:', socket.current?.id);
    });

    socket.current.on('connected', (data) => {
      setConnectionId(data.clientId);
      console.log('📡 WebSocket welcome:', data);
    });

    socket.current.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('❌ WebSocket disconnected:', reason);
      
      if (reason === 'io server disconnect') {
        // Server disconnected, reconnect manually
        socket.current?.connect();
      }
    });

    socket.current.on('connect_error', (error) => {
      setLastError(error.message);
      console.error('🔴 WebSocket connection error:', error);
    });

    socket.current.on('reconnect', (attemptNumber) => {
      setIsConnected(true);
      setLastError(null);
      console.log('🔄 WebSocket reconnected after', attemptNumber, 'attempts');
    });

    socket.current.on('reconnect_error', (error) => {
      setLastError(error.message);
      console.error('🔴 WebSocket reconnection error:', error);
    });

    // Cleanup on unmount
    return () => {
      socket.current?.disconnect();
    };
  }, [serverPath]);

  // Subscribe to game updates
  const subscribeToGame = (gameId: string, callback: (update: GameUpdate) => void) => {
    if (!socket.current) return;

    socket.current.emit('join-game', gameId);
    socket.current.on('game-update', callback);
    socket.current.on('game-move', callback);
    socket.current.on('game-end', callback);

    return () => {
      socket.current?.emit('leave-game', gameId);
      socket.current?.off('game-update', callback);
      socket.current?.off('game-move', callback);
      socket.current?.off('game-end', callback);
    };
  };

  // Subscribe to tournament updates
  const subscribeToTournament = (tournamentId: string, callback: (update: TournamentUpdate) => void) => {
    if (!socket.current) return;

    socket.current.emit('join-tournament', tournamentId);
    socket.current.on('tournament-update', callback);

    return () => {
      socket.current?.emit('leave-tournament', tournamentId);
      socket.current?.off('tournament-update', callback);
    };
  };

  // Subscribe to stats updates
  const subscribeToStats = (callback: (stats: WebSocketStats) => void) => {
    if (!socket.current) return;

    socket.current.emit('subscribe-stats');
    socket.current.on('stats-update', callback);

    return () => {
      socket.current?.emit('unsubscribe-stats');
      socket.current?.off('stats-update', callback);
    };
  };

  // Send custom event
  const emit = (event: string, data?: any) => {
    if (socket.current && isConnected) {
      socket.current.emit(event, data);
    }
  };

  // Subscribe to custom events
  const on = (event: string, callback: (...args: any[]) => void) => {
    if (!socket.current) return;

    socket.current.on(event, callback);
    return () => socket.current?.off(event, callback);
  };

  return {
    socket: socket.current,
    isConnected,
    connectionId,
    lastError,
    subscribeToGame,
    subscribeToTournament,
    subscribeToStats,
    emit,
    on
  };
}

// Hook for specific game watching
export function useGameWatch(gameId: string | null) {
  const { subscribeToGame, isConnected } = useWebSocket();
  const [gameData, setGameData] = useState<GameUpdate | null>(null);
  const [viewers, setViewers] = useState(0);

  useEffect(() => {
    if (!gameId || !isConnected) return;

    const unsubscribe = subscribeToGame(gameId, (update) => {
      setGameData(update);
    });

    return unsubscribe;
  }, [gameId, isConnected, subscribeToGame]);

  return { gameData, viewers, isConnected };
}

// Hook for tournament watching
export function useTournamentWatch(tournamentId: string | null) {
  const { subscribeToTournament, isConnected } = useWebSocket();
  const [tournamentData, setTournamentData] = useState<TournamentUpdate | null>(null);

  useEffect(() => {
    if (!tournamentId || !isConnected) return;

    const unsubscribe = subscribeToTournament(tournamentId, (update) => {
      setTournamentData(update);
    });

    return unsubscribe;
  }, [tournamentId, isConnected, subscribeToTournament]);

  return { tournamentData, isConnected };
}

// Hook for live stats
export function useLiveStats() {
  const { subscribeToStats, isConnected } = useWebSocket();
  const [stats, setStats] = useState<WebSocketStats | null>(null);

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribeToStats((newStats) => {
      setStats(newStats);
    });

    return unsubscribe;
  }, [isConnected, subscribeToStats]);

  return { stats, isConnected };
}