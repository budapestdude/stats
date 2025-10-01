import axios from 'axios';

// API base URL - uses environment variable at build time or runtime detection
const getApiBaseUrl = () => {
  // Server-side rendering
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://195.201.6.244';
  }

  // Client-side: check if on localhost
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3010';
  }

  // Production: use environment variable or default to Hetzner
  return process.env.NEXT_PUBLIC_API_URL || 'http://195.201.6.244';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Player {
  id: string;
  username: string;
  full_name: string;
  country: string;
  title: string;
  fide_id: number;
  current_ratings: {
    classical?: number;
    rapid?: number;
    blitz?: number;
    bullet?: number;
  };
  peak_ratings: {
    classical?: number;
    rapid?: number;
    blitz?: number;
    bullet?: number;
  };
}

export interface Game {
  id: string;
  white_player_id: string;
  black_player_id: string;
  pgn: string;
  eco: string;
  opening_name: string;
  result: string;
  white_elo: number;
  black_elo: number;
  time_control: string;
  played_at: string;
}

export interface Opening {
  id: string;
  eco: string;
  name: string;
  pgn: string;
  category: string;
  variation: string;
}

export interface Tournament {
  id: string;
  name: string;
  location: string;
  format: string;
  start_date: string;
  end_date: string;
  participants: number;
  prize_pool: number;
}

export const playerApi = {
  getAll: async (params?: { page?: number; limit?: number; sortBy?: string }) => {
    const response = await api.get('/api/players', { params });
    return response.data;
  },

  search: async (query: string) => {
    const response = await api.get('/api/players/search', { params: { q: query } });
    return response.data;
  },

  getTop: async (category = 'blitz', limit = 10) => {
    const response = await api.get('/api/players/top', { params: { category, limit } });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/api/players/${id}`);
    return response.data;
  },

  getGames: async (id: string, params?: any) => {
    const response = await api.get(`/api/players/${id}/games`, { params });
    return response.data;
  },

  getStatistics: async (id: string) => {
    const response = await api.get(`/api/players/${id}/statistics`);
    return response.data;
  },

  getRatingHistory: async (id: string, category = 'all', period = '1y') => {
    const response = await api.get(`/api/players/${id}/rating-history`, {
      params: { category, period },
    });
    return response.data;
  },
};

export const gameApi = {
  getAll: async (params?: any) => {
    const response = await api.get('/api/games', { params });
    return response.data;
  },

  search: async (params: any) => {
    const response = await api.get('/api/games/search', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/api/games/${id}`);
    return response.data;
  },

  importPGN: async (pgn: string) => {
    const response = await api.post('/api/games/import/pgn', { pgn });
    return response.data;
  },
};

export const openingApi = {
  getAll: async () => {
    const response = await api.get('/api/openings');
    return response.data;
  },

  getPopular: async () => {
    const response = await api.get('/api/openings/popular');
    return response.data;
  },

  getByECO: async (eco: string) => {
    const response = await api.get(`/api/openings/eco/${eco}`);
    return response.data;
  },

  explorer: async (moves: string) => {
    const response = await api.get('/api/openings/explorer', { params: { moves } });
    return response.data;
  },
};

export const tournamentApi = {
  getAll: async () => {
    const response = await api.get('/api/tournaments');
    return response.data;
  },

  getUpcoming: async () => {
    const response = await api.get('/api/tournaments/upcoming');
    return response.data;
  },

  getRecent: async () => {
    const response = await api.get('/api/tournaments/recent');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/api/tournaments/${id}`);
    return response.data;
  },

  getStandings: async (id: string) => {
    const response = await api.get(`/api/tournaments/${id}/standings`);
    return response.data;
  },
};

export const statsApi = {
  getOverview: async () => {
    const response = await api.get('/api/stats/overview');
    return response.data;
  },

  getRatingDistribution: async () => {
    const response = await api.get('/api/stats/rating-distribution');
    return response.data;
  },

  getOpeningTrends: async () => {
    const response = await api.get('/api/stats/opening-trends');
    return response.data;
  },

  getCountryRankings: async () => {
    const response = await api.get('/api/stats/country-rankings');
    return response.data;
  },
};

// Simple fetch functions for use with React Query
export async function fetchStatsOverview() {
  const response = await fetch(`${API_BASE_URL}/api/stats/overview`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

export async function fetchTopPlayers() {
  const response = await fetch(`${API_BASE_URL}/api/players/top`);
  if (!response.ok) throw new Error('Failed to fetch top players');
  return response.json();
}

export async function fetchPlayerProfile(username: string) {
  const response = await fetch(`${API_BASE_URL}/api/players/${username}`);
  if (!response.ok) throw new Error('Failed to fetch player profile');
  return response.json();
}

export async function fetchPlayers() {
  const response = await fetch(`${API_BASE_URL}/api/players`);
  if (!response.ok) throw new Error('Failed to fetch players');
  return response.json();
}

export default api;