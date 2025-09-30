'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { webSocketService, GameUpdate, PlayerStatusUpdate, TournamentUpdate } from '@/lib/websocket';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  // Connection state
  isConnected: boolean;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  
  // Data streams
  gameUpdates: Map<string, GameUpdate>;
  playerUpdates: Map<string, PlayerStatusUpdate>;
  tournamentUpdates: Map<string, TournamentUpdate>;
  
  // Subscription management
  subscribeToPlayer: (username: string) => void;
  unsubscribeFromPlayer: (username: string) => void;
  subscribeToGame: (gameId: string) => void;
  unsubscribeFromGame: (gameId: string) => void;
  subscribeToTournament: (tournamentId: string) => void;
  unsubscribeFromTournament: (tournamentId: string) => void;
  subscribeToTopPlayers: (platform?: 'chess.com' | 'lichess') => void;
  
  // Event handlers
  onGameUpdate: (callback: (data: GameUpdate) => void) => () => void;
  onPlayerStatusUpdate: (callback: (data: PlayerStatusUpdate) => void) => () => void;
  onTournamentUpdate: (callback: (data: TournamentUpdate) => void) => () => void;
  onRatingUpdate: (callback: (data: { username: string; newRating: number; platform: string }) => void) => () => void;
  
  // Connection management
  connect: () => void;
  disconnect: () => void;
  
  // Live data getters
  getPlayerStatus: (username: string) => PlayerStatusUpdate | null;
  getGameUpdate: (gameId: string) => GameUpdate | null;
  getTournamentUpdate: (tournamentId: string) => TournamentUpdate | null;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
  autoConnect?: boolean;
}

export function WebSocketProvider({ children, autoConnect = true }: WebSocketProviderProps) {
  const { isAuthenticated, user } = useAuth();
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
  
  // Data stores
  const [gameUpdates, setGameUpdates] = useState<Map<string, GameUpdate>>(new Map());
  const [playerUpdates, setPlayerUpdates] = useState<Map<string, PlayerStatusUpdate>>(new Map());
  const [tournamentUpdates, setTournamentUpdates] = useState<Map<string, TournamentUpdate>>(new Map());

  // Connection management
  const connect = useCallback(() => {
    if (isAuthenticated && user) {
      webSocketService.connect();
    }
  }, [isAuthenticated, user]);

  const disconnect = useCallback(() => {
    webSocketService.disconnect();
  }, []);

  // Update connection state based on WebSocket events
  useEffect(() => {
    const updateConnectionState = () => {
      const state = webSocketService.getConnectionState();
      setConnectionState(state);
      setIsConnected(state === 'connected');
    };

    webSocketService.on('connect', () => {
      updateConnectionState();
      console.log('WebSocket connected via context');
    });

    webSocketService.on('disconnect', () => {
      updateConnectionState();
      console.log('WebSocket disconnected via context');
    });

    webSocketService.on('reconnect', () => {
      updateConnectionState();
      console.log('WebSocket reconnected via context');
    });

    webSocketService.on('error', (error) => {
      console.error('WebSocket error via context:', error);
      updateConnectionState();
    });

    // Initial state update
    updateConnectionState();

    return () => {
      // Cleanup listeners would go here if webSocketService supported it
    };
  }, []);

  // Auto-connect when authenticated
  useEffect(() => {
    if (autoConnect && isAuthenticated && user && !isConnected && connectionState === 'disconnected') {
      connect();
    } else if (!isAuthenticated && isConnected) {
      disconnect();
    }
  }, [isAuthenticated, user, isConnected, connectionState, autoConnect, connect, disconnect]);

  // Handle game updates
  useEffect(() => {
    const handleGameUpdate = (data: GameUpdate) => {
      setGameUpdates(prev => {
        const newMap = new Map(prev);
        newMap.set(data.gameId, data);
        return newMap;
      });
    };

    webSocketService.on('gameUpdate', handleGameUpdate);

    return () => {
      webSocketService.off('gameUpdate', handleGameUpdate);
    };
  }, []);

  // Handle player status updates
  useEffect(() => {
    const handlePlayerStatusUpdate = (data: PlayerStatusUpdate) => {
      setPlayerUpdates(prev => {
        const newMap = new Map(prev);
        newMap.set(`${data.username}:${data.platform}`, data);
        return newMap;
      });
    };

    webSocketService.on('playerStatusUpdate', handlePlayerStatusUpdate);

    return () => {
      webSocketService.off('playerStatusUpdate', handlePlayerStatusUpdate);
    };
  }, []);

  // Handle tournament updates
  useEffect(() => {
    const handleTournamentUpdate = (data: TournamentUpdate) => {
      setTournamentUpdates(prev => {
        const newMap = new Map(prev);
        newMap.set(data.tournamentId, data);
        return newMap;
      });
    };

    webSocketService.on('tournamentUpdate', handleTournamentUpdate);

    return () => {
      webSocketService.off('tournamentUpdate', handleTournamentUpdate);
    };
  }, []);

  // Subscription methods
  const subscribeToPlayer = useCallback((username: string) => {
    webSocketService.subscribeToPlayer(username);
  }, []);

  const unsubscribeFromPlayer = useCallback((username: string) => {
    webSocketService.unsubscribeFromPlayer(username);
  }, []);

  const subscribeToGame = useCallback((gameId: string) => {
    webSocketService.subscribeToGame(gameId);
  }, []);

  const unsubscribeFromGame = useCallback((gameId: string) => {
    webSocketService.unsubscribeFromGame(gameId);
  }, []);

  const subscribeToTournament = useCallback((tournamentId: string) => {
    webSocketService.subscribeToTournament(tournamentId);
  }, []);

  const unsubscribeFromTournament = useCallback((tournamentId: string) => {
    webSocketService.unsubscribeFromTournament(tournamentId);
  }, []);

  const subscribeToTopPlayers = useCallback((platform: 'chess.com' | 'lichess' = 'chess.com') => {
    webSocketService.subscribeToTopPlayers(platform);
  }, []);

  // Event handler registration methods
  const onGameUpdate = useCallback((callback: (data: GameUpdate) => void) => {
    webSocketService.on('gameUpdate', callback);
    return () => webSocketService.off('gameUpdate', callback);
  }, []);

  const onPlayerStatusUpdate = useCallback((callback: (data: PlayerStatusUpdate) => void) => {
    webSocketService.on('playerStatusUpdate', callback);
    return () => webSocketService.off('playerStatusUpdate', callback);
  }, []);

  const onTournamentUpdate = useCallback((callback: (data: TournamentUpdate) => void) => {
    webSocketService.on('tournamentUpdate', callback);
    return () => webSocketService.off('tournamentUpdate', callback);
  }, []);

  const onRatingUpdate = useCallback((callback: (data: { username: string; newRating: number; platform: string }) => void) => {
    webSocketService.on('ratingUpdate', callback);
    return () => webSocketService.off('ratingUpdate', callback);
  }, []);

  // Data getter methods
  const getPlayerStatus = useCallback((username: string, platform: 'chess.com' | 'lichess' = 'chess.com'): PlayerStatusUpdate | null => {
    return playerUpdates.get(`${username}:${platform}`) || null;
  }, [playerUpdates]);

  const getGameUpdate = useCallback((gameId: string): GameUpdate | null => {
    return gameUpdates.get(gameId) || null;
  }, [gameUpdates]);

  const getTournamentUpdate = useCallback((tournamentId: string): TournamentUpdate | null => {
    return tournamentUpdates.get(tournamentId) || null;
  }, [tournamentUpdates]);

  const contextValue: WebSocketContextType = {
    // Connection state
    isConnected,
    connectionState,
    
    // Data streams
    gameUpdates,
    playerUpdates,
    tournamentUpdates,
    
    // Subscription management
    subscribeToPlayer,
    unsubscribeFromPlayer,
    subscribeToGame,
    unsubscribeFromGame,
    subscribeToTournament,
    unsubscribeFromTournament,
    subscribeToTopPlayers,
    
    // Event handlers
    onGameUpdate,
    onPlayerStatusUpdate,
    onTournamentUpdate,
    onRatingUpdate,
    
    // Connection management
    connect,
    disconnect,
    
    // Live data getters
    getPlayerStatus,
    getGameUpdate,
    getTournamentUpdate,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

// Custom hooks for specific use cases
export function useGameUpdates(gameId?: string) {
  const { gameUpdates, subscribeToGame, unsubscribeFromGame, onGameUpdate } = useWebSocket();
  
  useEffect(() => {
    if (gameId) {
      subscribeToGame(gameId);
      return () => unsubscribeFromGame(gameId);
    }
  }, [gameId, subscribeToGame, unsubscribeFromGame]);
  
  return gameId ? gameUpdates.get(gameId) : null;
}

export function usePlayerStatus(username?: string, platform: 'chess.com' | 'lichess' = 'chess.com') {
  const { playerUpdates, subscribeToPlayer, unsubscribeFromPlayer } = useWebSocket();
  
  useEffect(() => {
    if (username) {
      subscribeToPlayer(username);
      return () => unsubscribeFromPlayer(username);
    }
  }, [username, subscribeToPlayer, unsubscribeFromPlayer]);
  
  return username ? playerUpdates.get(`${username}:${platform}`) : null;
}

export function useTournamentUpdates(tournamentId?: string) {
  const { tournamentUpdates, subscribeToTournament, unsubscribeFromTournament } = useWebSocket();
  
  useEffect(() => {
    if (tournamentId) {
      subscribeToTournament(tournamentId);
      return () => unsubscribeFromTournament(tournamentId);
    }
  }, [tournamentId, subscribeToTournament, unsubscribeFromTournament]);
  
  return tournamentId ? tournamentUpdates.get(tournamentId) : null;
}