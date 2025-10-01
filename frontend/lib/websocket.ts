'use client';

import { io, Socket } from 'socket.io-client';
import { authService } from './auth';

interface GameUpdate {
  gameId: string;
  pgn: string;
  status: 'ongoing' | 'finished' | 'aborted';
  timeControl: string;
  players: {
    white: string;
    black: string;
  };
  result?: string;
  lastMove?: string;
  currentPosition?: string;
}

interface PlayerStatusUpdate {
  username: string;
  isOnline: boolean;
  currentRating: number;
  lastSeen?: string;
  platform: 'chess.com' | 'lichess';
}

interface TournamentUpdate {
  tournamentId: string;
  name: string;
  status: 'upcoming' | 'ongoing' | 'finished';
  round?: number;
  standings?: Array<{
    position: number;
    player: string;
    points: number;
  }>;
}

interface WebSocketEvents {
  gameUpdate: (data: GameUpdate) => void;
  playerStatusUpdate: (data: PlayerStatusUpdate) => void;
  tournamentUpdate: (data: TournamentUpdate) => void;
  ratingUpdate: (data: { username: string; newRating: number; platform: string }) => void;
  error: (error: string) => void;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<keyof WebSocketEvents, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private isConnecting = false;
  private subscriptions = new Set<string>();

  constructor() {
    this.initializeEventMaps();
  }

  private initializeEventMaps() {
    const events: (keyof WebSocketEvents)[] = [
      'gameUpdate',
      'playerStatusUpdate', 
      'tournamentUpdate',
      'ratingUpdate',
      'error',
      'connect',
      'disconnect',
      'reconnect'
    ];
    
    events.forEach(event => {
      this.listeners.set(event, new Set());
    });
  }

  async connect() {
    if (this.socket?.connected || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      const user = await authService.getCurrentUser();
      const token = authService.getToken();

      this.socket = io(process.env.NEXT_PUBLIC_WS_URL || `${API_BASE_URL}`, {
        auth: {
          token: token,
          userId: user?.id
        },
        transports: ['websocket', 'polling'],
        reconnection: false, // We'll handle reconnection manually
        timeout: 10000
      });

      this.setupEventHandlers();
      this.isConnecting = false;
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.isConnecting = false;
      this.handleReconnect();
    }
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.emit('connect');
      
      // Re-subscribe to all previous subscriptions
      this.subscriptions.forEach(subscription => {
        this.socket?.emit('subscribe', subscription);
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.emit('disconnect');
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.handleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.emit('error', error.message);
      this.handleReconnect();
    });

    this.socket.on('game-update', (data: GameUpdate) => {
      this.emit('gameUpdate', data);
    });

    this.socket.on('player-status-update', (data: PlayerStatusUpdate) => {
      this.emit('playerStatusUpdate', data);
    });

    this.socket.on('tournament-update', (data: TournamentUpdate) => {
      this.emit('tournamentUpdate', data);
    });

    this.socket.on('rating-update', (data: { username: string; newRating: number; platform: string }) => {
      this.emit('ratingUpdate', data);
    });

    this.socket.on('error', (error: string) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    });

    this.socket.on('reconnect', () => {
      console.log('WebSocket reconnected');
      this.emit('reconnect');
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);

    setTimeout(() => {
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.subscriptions.clear();
    this.listeners.forEach(listenerSet => listenerSet.clear());
  }

  // Subscribe to specific data streams
  subscribeToPlayer(username: string) {
    const subscription = `player:${username}`;
    this.subscriptions.add(subscription);
    this.socket?.emit('subscribe', subscription);
  }

  subscribeToGame(gameId: string) {
    const subscription = `game:${gameId}`;
    this.subscriptions.add(subscription);
    this.socket?.emit('subscribe', subscription);
  }

  subscribeToTournament(tournamentId: string) {
    const subscription = `tournament:${tournamentId}`;
    this.subscriptions.add(subscription);
    this.socket?.emit('subscribe', subscription);
  }

  subscribeToTopPlayers(platform: 'chess.com' | 'lichess' = 'chess.com') {
    const subscription = `top-players:${platform}`;
    this.subscriptions.add(subscription);
    this.socket?.emit('subscribe', subscription);
  }

  unsubscribe(subscription: string) {
    this.subscriptions.delete(subscription);
    this.socket?.emit('unsubscribe', subscription);
  }

  unsubscribeFromPlayer(username: string) {
    this.unsubscribe(`player:${username}`);
  }

  unsubscribeFromGame(gameId: string) {
    this.unsubscribe(`game:${gameId}`);
  }

  unsubscribeFromTournament(tournamentId: string) {
    this.unsubscribe(`tournament:${tournamentId}`);
  }

  // Event listener management
  on<K extends keyof WebSocketEvents>(event: K, callback: WebSocketEvents[K]) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.add(callback);
    }
  }

  off<K extends keyof WebSocketEvents>(event: K, callback: WebSocketEvents[K]) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit<K extends keyof WebSocketEvents>(event: K, ...args: Parameters<WebSocketEvents[K]>) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          // @ts-ignore - TypeScript has trouble with the spread operator here
          callback(...args);
        } catch (error) {
          console.error(`Error in WebSocket event handler for ${event}:`, error);
        }
      });
    }
  }

  // Utility methods
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getConnectionState(): 'disconnected' | 'connecting' | 'connected' | 'reconnecting' {
    if (!this.socket) return 'disconnected';
    if (this.isConnecting) return 'connecting';
    if (this.socket.connected) return 'connected';
    if (this.reconnectAttempts > 0) return 'reconnecting';
    return 'disconnected';
  }

  // Send custom events to server
  sendMessage(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  }
}

// Create singleton instance
export const webSocketService = new WebSocketService();

// Export types for use in components
export type { GameUpdate, PlayerStatusUpdate, TournamentUpdate, WebSocketEvents };