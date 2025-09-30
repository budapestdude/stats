'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { 
  CacheManager, 
  apiCache, 
  playerCache, 
  gameCache, 
  staticDataCache,
  cachedFetch,
  CacheKeys
} from '@/lib/cache';

interface CacheStats {
  api: ReturnType<typeof apiCache.getStats>;
  player: ReturnType<typeof playerCache.getStats>;
  game: ReturnType<typeof gameCache.getStats>;
  static: ReturnType<typeof staticDataCache.getStats>;
}

interface CacheContextType {
  // Cache operations
  invalidatePlayerData: (username: string) => void;
  invalidateGameData: () => void;
  preloadCommonData: () => Promise<void>;
  clearAllCaches: () => void;
  
  // Cache statistics
  cacheStats: CacheStats;
  refreshStats: () => void;
  
  // Cached data fetchers
  getCachedPlayer: (username: string) => Promise<any>;
  getCachedTopPlayers: () => Promise<any>;
  getCachedOpenings: () => Promise<any>;
  getCachedTournaments: () => Promise<any>;
  
  // Cache status
  isPreloading: boolean;
  lastCleanup: Date | null;
}

const CacheContext = createContext<CacheContextType | null>(null);

interface CacheProviderProps {
  children: ReactNode;
}

export function CacheProvider({ children }: CacheProviderProps) {
  const [cacheStats, setCacheStats] = useState<CacheStats>(() => CacheManager.getAllStats());
  const [isPreloading, setIsPreloading] = useState(false);
  const [lastCleanup, setLastCleanup] = useState<Date | null>(null);

  // Refresh cache statistics
  const refreshStats = useCallback(() => {
    setCacheStats(CacheManager.getAllStats());
  }, []);

  // Invalidate player-specific data
  const invalidatePlayerData = useCallback((username: string) => {
    playerCache.delete(CacheKeys.player(username));
    playerCache.delete(CacheKeys.playerStats(username));
    apiCache.delete(CacheKeys.playerGames(username));
    refreshStats();
  }, [refreshStats]);

  // Invalidate game data
  const invalidateGameData = useCallback(() => {
    gameCache.clear();
    apiCache.delete(CacheKeys.liveGames());
    refreshStats();
  }, [refreshStats]);

  // Preload common data
  const preloadCommonData = useCallback(async () => {
    setIsPreloading(true);
    try {
      await CacheManager.preloadData();
      refreshStats();
    } catch (error) {
      console.error('Failed to preload cache data:', error);
    } finally {
      setIsPreloading(false);
    }
  }, [refreshStats]);

  // Clear all caches
  const clearAllCaches = useCallback(() => {
    CacheManager.clearAll();
    refreshStats();
  }, [refreshStats]);

  // Cached data fetchers
  const getCachedPlayer = useCallback(async (username: string) => {
    return cachedFetch(
      CacheKeys.player(username),
      async () => {
        const response = await fetch(`/api/players/${username}`);
        if (!response.ok) throw new Error('Failed to fetch player');
        return response.json();
      },
      playerCache
    );
  }, []);

  const getCachedTopPlayers = useCallback(async () => {
    return cachedFetch(
      CacheKeys.topPlayers(),
      async () => {
        const response = await fetch('/api/players/top');
        if (!response.ok) throw new Error('Failed to fetch top players');
        return response.json();
      },
      playerCache
    );
  }, []);

  const getCachedOpenings = useCallback(async () => {
    return cachedFetch(
      CacheKeys.openings(),
      async () => {
        const response = await fetch('/api/openings');
        if (!response.ok) throw new Error('Failed to fetch openings');
        return response.json();
      },
      staticDataCache
    );
  }, []);

  const getCachedTournaments = useCallback(async () => {
    return cachedFetch(
      CacheKeys.tournaments(),
      async () => {
        const response = await fetch('/api/tournaments');
        if (!response.ok) throw new Error('Failed to fetch tournaments');
        return response.json();
      },
      staticDataCache
    );
  }, []);

  // Automatic cleanup and stats refresh
  useEffect(() => {
    const cleanup = () => {
      CacheManager.cleanup();
      setLastCleanup(new Date());
      refreshStats();
    };

    // Initial cleanup
    cleanup();

    // Set up periodic cleanup (every 5 minutes)
    const cleanupInterval = setInterval(cleanup, 5 * 60 * 1000);

    // Set up stats refresh (every 30 seconds)
    const statsInterval = setInterval(refreshStats, 30 * 1000);

    return () => {
      clearInterval(cleanupInterval);
      clearInterval(statsInterval);
    };
  }, [refreshStats]);

  // Preload data on mount
  useEffect(() => {
    preloadCommonData();
  }, [preloadCommonData]);

  const contextValue: CacheContextType = {
    // Cache operations
    invalidatePlayerData,
    invalidateGameData,
    preloadCommonData,
    clearAllCaches,
    
    // Cache statistics
    cacheStats,
    refreshStats,
    
    // Cached data fetchers
    getCachedPlayer,
    getCachedTopPlayers,
    getCachedOpenings,
    getCachedTournaments,
    
    // Cache status
    isPreloading,
    lastCleanup
  };

  return (
    <CacheContext.Provider value={contextValue}>
      {children}
    </CacheContext.Provider>
  );
}

export function useCache(): CacheContextType {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error('useCache must be used within a CacheProvider');
  }
  return context;
}

// Custom hooks for specific cached data
export function useCachedPlayer(username: string) {
  const { getCachedPlayer } = useCache();
  const [player, setPlayer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;

    const loadPlayer = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getCachedPlayer(username);
        setPlayer(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load player');
      } finally {
        setIsLoading(false);
      }
    };

    loadPlayer();
  }, [username, getCachedPlayer]);

  return { player, isLoading, error };
}

export function useCachedTopPlayers() {
  const { getCachedTopPlayers } = useCache();
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTopPlayers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getCachedTopPlayers();
        setTopPlayers(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load top players');
      } finally {
        setIsLoading(false);
      }
    };

    loadTopPlayers();
  }, [getCachedTopPlayers]);

  return { topPlayers, isLoading, error };
}

export function useCachedOpenings() {
  const { getCachedOpenings } = useCache();
  const [openings, setOpenings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOpenings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getCachedOpenings();
        setOpenings(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load openings');
      } finally {
        setIsLoading(false);
      }
    };

    loadOpenings();
  }, [getCachedOpenings]);

  return { openings, isLoading, error };
}