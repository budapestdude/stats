'use client';

// API base URL - hardcoded for Railway deployment
const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? 'http://195.201.6.244'
  : 'http://localhost:3010';

// Frontend caching service for Chess Stats
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  key: string;
}

interface CacheOptions {
  ttl?: number; // Default TTL in milliseconds
  maxSize?: number; // Maximum number of items in cache
  storage?: 'memory' | 'localStorage' | 'sessionStorage';
}

class CacheService {
  private memoryCache = new Map<string, CacheItem<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  private maxSize = 100;
  private storage: 'memory' | 'localStorage' | 'sessionStorage' = 'memory';

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.ttl || this.defaultTTL;
    this.maxSize = options.maxSize || this.maxSize;
    this.storage = options.storage || this.storage;
  }

  // Set item in cache
  set<T>(key: string, data: T, ttl?: number): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      key
    };

    if (this.storage === 'memory') {
      // Enforce max size for memory cache
      if (this.memoryCache.size >= this.maxSize) {
        this.evictOldest();
      }
      this.memoryCache.set(key, item);
    } else {
      this.setInWebStorage(key, item);
    }
  }

  // Get item from cache
  get<T>(key: string): T | null {
    let item: CacheItem<T> | null = null;

    if (this.storage === 'memory') {
      item = this.memoryCache.get(key) || null;
    } else {
      item = this.getFromWebStorage(key);
    }

    if (!item) return null;

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.delete(key);
      return null;
    }

    return item.data;
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  // Delete item from cache
  delete(key: string): void {
    if (this.storage === 'memory') {
      this.memoryCache.delete(key);
    } else {
      this.deleteFromWebStorage(key);
    }
  }

  // Clear entire cache
  clear(): void {
    if (this.storage === 'memory') {
      this.memoryCache.clear();
    } else {
      this.clearWebStorage();
    }
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let totalItems = 0;
    let expiredItems = 0;
    let memoryUsage = 0;

    if (this.storage === 'memory') {
      totalItems = this.memoryCache.size;
      this.memoryCache.forEach((item) => {
        if (now - item.timestamp > item.ttl) {
          expiredItems++;
        }
        memoryUsage += JSON.stringify(item).length;
      });
    } else {
      // Estimate from web storage
      const keys = this.getWebStorageKeys();
      totalItems = keys.length;
      keys.forEach(key => {
        const item = this.getFromWebStorage(key);
        if (item && now - item.timestamp > item.ttl) {
          expiredItems++;
        }
      });
    }

    return {
      totalItems,
      expiredItems,
      validItems: totalItems - expiredItems,
      memoryUsage,
      storage: this.storage,
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL
    };
  }

  // Clean up expired items
  cleanup(): void {
    const now = Date.now();

    if (this.storage === 'memory') {
      const keysToDelete: string[] = [];
      this.memoryCache.forEach((item, key) => {
        if (now - item.timestamp > item.ttl) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.memoryCache.delete(key));
    } else {
      const keys = this.getWebStorageKeys();
      keys.forEach(key => {
        const item = this.getFromWebStorage(key);
        if (item && now - item.timestamp > item.ttl) {
          this.deleteFromWebStorage(key);
        }
      });
    }
  }

  // Web storage helpers
  private setInWebStorage<T>(key: string, item: CacheItem<T>): void {
    if (typeof window === 'undefined') return;

    try {
      const storage = this.getWebStorage();
      const prefixedKey = `chess_stats_cache_${key}`;
      storage.setItem(prefixedKey, JSON.stringify(item));
    } catch (error) {
      console.warn('Failed to save to web storage:', error);
      // Fallback to memory storage
      this.memoryCache.set(key, item);
    }
  }

  private getFromWebStorage<T>(key: string): CacheItem<T> | null {
    if (typeof window === 'undefined') return null;

    try {
      const storage = this.getWebStorage();
      const prefixedKey = `chess_stats_cache_${key}`;
      const item = storage.getItem(prefixedKey);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.warn('Failed to read from web storage:', error);
      return null;
    }
  }

  private deleteFromWebStorage(key: string): void {
    if (typeof window === 'undefined') return;

    try {
      const storage = this.getWebStorage();
      const prefixedKey = `chess_stats_cache_${key}`;
      storage.removeItem(prefixedKey);
    } catch (error) {
      console.warn('Failed to delete from web storage:', error);
    }
  }

  private clearWebStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const storage = this.getWebStorage();
      const keys = this.getWebStorageKeys();
      keys.forEach(key => {
        const prefixedKey = `chess_stats_cache_${key}`;
        storage.removeItem(prefixedKey);
      });
    } catch (error) {
      console.warn('Failed to clear web storage:', error);
    }
  }

  private getWebStorageKeys(): string[] {
    if (typeof window === 'undefined') return [];

    try {
      const storage = this.getWebStorage();
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith('chess_stats_cache_')) {
          keys.push(key.replace('chess_stats_cache_', ''));
        }
      }
      return keys;
    } catch (error) {
      console.warn('Failed to get web storage keys:', error);
      return [];
    }
  }

  private getWebStorage(): Storage {
    if (typeof window === 'undefined') throw new Error('Web storage not available');
    return this.storage === 'localStorage' ? window.localStorage : window.sessionStorage;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    this.memoryCache.forEach((item, key) => {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
    }
  }
}

// Cache instances for different data types
export const apiCache = new CacheService({
  ttl: 5 * 60 * 1000, // 5 minutes for API responses
  maxSize: 100,
  storage: 'memory'
});

export const playerCache = new CacheService({
  ttl: 10 * 60 * 1000, // 10 minutes for player data
  maxSize: 50,
  storage: 'localStorage'
});

export const gameCache = new CacheService({
  ttl: 2 * 60 * 1000, // 2 minutes for live game data
  maxSize: 200,
  storage: 'memory'
});

export const staticDataCache = new CacheService({
  ttl: 60 * 60 * 1000, // 1 hour for static data (openings, etc.)
  maxSize: 50,
  storage: 'localStorage'
});

// Cache key generators
export const CacheKeys = {
  player: (username: string) => `player_${username}`,
  playerGames: (username: string, page: number = 1) => `player_games_${username}_${page}`,
  playerStats: (username: string) => `player_stats_${username}`,
  topPlayers: (timeControl: string = 'all') => `top_players_${timeControl}`,
  openings: () => 'openings_list',
  openingStats: (eco: string) => `opening_stats_${eco}`,
  tournaments: () => 'tournaments_list',
  tournamentDetails: (id: string) => `tournament_${id}`,
  gameDetails: (id: string) => `game_${id}`,
  searchResults: (query: string) => `search_${query}`,
  statistics: (type: string) => `statistics_${type}`,
  liveGames: () => 'live_games',
  ratingDistribution: () => 'rating_distribution'
};

// Cache-aware fetch function
export async function cachedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  cache: CacheService = apiCache,
  ttl?: number
): Promise<T> {
  // Try to get from cache first
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  try {
    const data = await fetchFn();
    cache.set(key, data, ttl);
    return data;
  } catch (error) {
    // If fetch fails, try to return stale data if available
    const staleData = cache.get<T>(key);
    if (staleData !== null) {
      console.warn('Using stale cache data due to fetch error:', error);
      return staleData;
    }
    throw error;
  }
}

// Cache management utilities
export const CacheManager = {
  // Preload important data
  async preloadData() {
    const preloadTasks = [
      cachedFetch(CacheKeys.openings(), async () => {
        const response = await fetch(`${API_BASE_URL}/api/openings`);
        return response.json();
      }, staticDataCache),
      cachedFetch(CacheKeys.topPlayers(), async () => {
        const response = await fetch(`${API_BASE_URL}/api/players/top`);
        return response.json();
      }, playerCache)
    ];

    try {
      await Promise.all(preloadTasks);
      console.log('Cache preload completed');
    } catch (error) {
      console.warn('Cache preload failed:', error);
    }
  },

  // Invalidate cache for a specific pattern
  invalidatePattern(pattern: string, cache: CacheService = apiCache) {
    const stats = cache.getStats();
    console.log(`Invalidating cache pattern: ${pattern}`);
    
    // For memory cache, we can iterate
    if (cache === apiCache || cache === gameCache) {
      const keysToDelete: string[] = [];
      (cache as any).memoryCache.forEach((_: any, key: string) => {
        if (key.includes(pattern)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => cache.delete(key));
    }
  },

  // Cleanup all caches
  cleanup() {
    apiCache.cleanup();
    playerCache.cleanup();
    gameCache.cleanup();
    staticDataCache.cleanup();
  },

  // Get all cache statistics
  getAllStats() {
    return {
      api: apiCache.getStats(),
      player: playerCache.getStats(),
      game: gameCache.getStats(),
      static: staticDataCache.getStats()
    };
  },

  // Clear all caches
  clearAll() {
    apiCache.clear();
    playerCache.clear();
    gameCache.clear();
    staticDataCache.clear();
  }
};

// Auto-cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    CacheManager.cleanup();
  }, 5 * 60 * 1000);
}

export { CacheService };