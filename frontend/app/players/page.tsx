'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Trophy, Crown, Award, Star, Search, Users, TrendingUp, Calendar, 
  Database, Filter, BarChart3, Globe, Clock, Target, RefreshCw, 
  ArrowUpDown, MapPin, ChevronDown, ChevronRight, Loader2, 
  User, Activity, ChevronLeft, ChevronsLeft, ChevronsRight, Eye
} from 'lucide-react';
import axios from 'axios';
import dynamic from 'next/dynamic';

const GameViewer = dynamic(() => import('@/components/GameViewer'), { ssr: false });

// Featured players with enhanced stats
const featuredPlayers = [
  { 
    slug: 'magnus-carlsen', 
    name: 'Magnus Carlsen', 
    title: 'World Champion 2013-2023',
    peak: 2882,
    country: '🇳🇴',
    icon: Crown,
    games: 3786,
    winRate: 45.8,
    years: '1999-2025'
  },
  { 
    slug: 'garry-kasparov', 
    name: 'Garry Kasparov', 
    title: 'World Champion 1985-2000',
    peak: 2851,
    country: '🇷🇺',
    icon: Crown,
    games: 2500,
    winRate: 47.2,
    years: '1976-2005'
  },
  { 
    slug: 'bobby-fischer', 
    name: 'Bobby Fischer', 
    title: 'World Champion 1972-1975',
    peak: 2785,
    country: '🇺🇸',
    icon: Crown,
    games: 800,
    winRate: 56.1,
    years: '1955-1992'
  },
  { 
    slug: 'anatoly-karpov', 
    name: 'Anatoly Karpov', 
    title: 'World Champion 1975-1985',
    peak: 2780,
    country: '🇷🇺',
    icon: Crown,
    games: 1800,
    winRate: 44.8,
    years: '1970-2009'
  },
];

interface DatabasePlayer {
  name: string;
  totalGames: number;
  peakRating: number | null;
  avgRating: number | null;
  firstGame: string;
  lastGame: string;
  tournaments: number;
  yearsActive: string | null;
}

interface PlayerGame {
  id?: string | number;
  white: string;
  black: string;
  result: string;
  date: string;
  event: string;
  eco: string;
  opening: string;
  whiteElo: number;
  blackElo: number;
  playerColor: 'white' | 'black';
}

interface PlayerStats {
  totalGames: number;
  wins: number;
  draws: number;
  losses: number;
  asWhite: number;
  asBlack: number;
  winRate: string;
  drawRate: string;
  lossRate: string;
}

const API_BASE_URL = 'http://localhost:3007';

export default function PlayersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGameId, setSelectedGameId] = useState<string | number | null>(null);
  const [databasePlayers, setDatabasePlayers] = useState<DatabasePlayer[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [playerGames, setPlayerGames] = useState<PlayerGame[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingGames, setLoadingGames] = useState(false);
  const [activeTab, setActiveTab] = useState<'featured' | 'search'>('featured');
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false
  });
  const [gamesPagination, setGamesPagination] = useState({
    total: 0,
    limit: 100,
    offset: 0,
    hasMore: false
  });
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length >= 2) {
      if (searchDebounce) clearTimeout(searchDebounce);
      const timeout = setTimeout(() => {
        searchPlayers(searchQuery);
      }, 500);
      setSearchDebounce(timeout);
    } else {
      setDatabasePlayers([]);
      setPagination({ total: 0, limit: 50, offset: 0, hasMore: false });
    }
    
    return () => {
      if (searchDebounce) clearTimeout(searchDebounce);
    };
  }, [searchQuery]);

  const searchPlayers = async (query: string, offset = 0) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/otb/database/players/search`, {
        params: { q: query, limit: 50, offset }
      });
      
      setDatabasePlayers(response.data.players || []);
      setPagination(response.data.pagination || { total: 0, limit: 50, offset: 0, hasMore: false });
      setActiveTab('search');
    } catch (error) {
      console.error('Search failed:', error);
      setDatabasePlayers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPlayerGames = async (playerName: string, offset = 0) => {
    setLoadingGames(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/otb/database/players/${encodeURIComponent(playerName)}/games`,
        { params: { limit: 100, offset } }
      );
      
      setPlayerGames(response.data.games || []);
      setPlayerStats(response.data.statistics || null);
      setGamesPagination(response.data.pagination || { total: 0, limit: 100, offset: 0, hasMore: false });
    } catch (error) {
      console.error('Failed to load player games:', error);
      setPlayerGames([]);
      setPlayerStats(null);
    } finally {
      setLoadingGames(false);
    }
  };

  const handlePlayerSelect = (playerName: string) => {
    setSelectedPlayer(playerName);
    loadPlayerGames(playerName);
  };

  const handlePageChange = (newOffset: number) => {
    if (searchQuery.length >= 2) {
      searchPlayers(searchQuery, newOffset);
    }
  };

  const handleGamesPageChange = (newOffset: number) => {
    if (selectedPlayer) {
      loadPlayerGames(selectedPlayer, newOffset);
    }
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const gamesCurrentPage = Math.floor(gamesPagination.offset / gamesPagination.limit) + 1;
  const gamesTotalPages = Math.ceil(gamesPagination.total / gamesPagination.limit);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Chess Players Database</h1>
              <p className="text-gray-600">Search 620K+ players from 9.1M OTB games (1851-2025)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players (e.g., Carlsen, Kasparov, Fischer)..."
              className="w-full pl-12 pr-4 py-3 text-lg border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              suppressHydrationWarning={true}
            />
            {loading && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
            )}
          </div>
          <p className="text-sm text-gray-500 mt-2 text-center">
            Enter at least 2 characters to search the database
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="border-b border-gray-200">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('featured')}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'featured'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              suppressHydrationWarning={true}
            >
              <Crown className="w-4 h-4" />
              Featured Players
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                {featuredPlayers.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'search'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              suppressHydrationWarning={true}
            >
              <Database className="w-4 h-4" />
              Database Search
              {databasePlayers.length > 0 && (
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  {pagination.total}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Featured Players Tab */}
        {activeTab === 'featured' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">World Champions & Legends</h2>
              <p className="text-gray-600">Players with pre-built detailed statistics pages</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {featuredPlayers.map((player) => {
                const Icon = player.icon;
                return (
                  <Link key={player.slug} href={`/players/${player.slug}`}>
                    <Card className="hover:shadow-lg transition-all cursor-pointer h-full group hover:scale-105">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{player.country}</span>
                            <Icon className="h-5 w-5 text-yellow-600" />
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Peak Rating</div>
                            <div className="font-bold text-lg">{player.peak}</div>
                          </div>
                        </div>
                        <CardTitle className="text-xl group-hover:text-blue-600 transition">{player.name}</CardTitle>
                        <p className="text-sm text-gray-600">{player.title}</p>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-gray-500">Games</div>
                            <div className="font-semibold">{player.games}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Win Rate</div>
                            <div className="font-semibold">{player.winRate}%</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-gray-500">Active Years</div>
                            <div className="font-semibold">{player.years}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-center">
                          <span className="text-sm text-blue-600 group-hover:text-blue-700 font-medium">
                            View Detailed Stats →
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Database Search Tab */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            {/* Search Results */}
            {databasePlayers.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    Found {pagination.total} players matching "{searchQuery}"
                  </h2>
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(0)}
                        disabled={currentPage === 1}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronsLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                        disabled={currentPage === 1}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm text-gray-600 px-2">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                        disabled={!pagination.hasMore}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePageChange((totalPages - 1) * pagination.limit)}
                        disabled={currentPage === totalPages}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronsRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Players List */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-700">Players</h3>
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {databasePlayers.map((player, index) => (
                        <div
                          key={`${player.name}-${index}`}
                          onClick={() => handlePlayerSelect(player.name)}
                          className={`p-4 bg-white border rounded-lg hover:shadow-md transition cursor-pointer ${
                            selectedPlayer === player.name ? 'border-blue-500 bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{player.name}</div>
                              <div className="text-sm text-gray-600 mt-1">
                                {player.totalGames} games • {player.tournaments} tournaments
                              </div>
                              {player.yearsActive && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Active: {player.yearsActive}
                                </div>
                              )}
                            </div>
                            {player.peakRating && (
                              <div className="text-right">
                                <div className="text-xs text-gray-500">Peak</div>
                                <div className="font-semibold">{player.peakRating}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Player Details */}
                  <div className="space-y-3">
                    {selectedPlayer ? (
                      <>
                        <h3 className="font-semibold text-gray-700">
                          {selectedPlayer}'s Games
                        </h3>
                        
                        {/* Player Statistics */}
                        {playerStats && (
                          <Card className="mb-4">
                            <CardContent className="p-4">
                              <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                  <div className="text-2xl font-bold text-green-600">
                                    {playerStats.wins}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    Wins ({playerStats.winRate}%)
                                  </div>
                                </div>
                                <div>
                                  <div className="text-2xl font-bold text-gray-600">
                                    {playerStats.draws}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    Draws ({playerStats.drawRate}%)
                                  </div>
                                </div>
                                <div>
                                  <div className="text-2xl font-bold text-red-600">
                                    {playerStats.losses}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    Losses ({playerStats.lossRate}%)
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                                <div className="text-center">
                                  <div className="text-lg font-semibold">{playerStats.asWhite}</div>
                                  <div className="text-sm text-gray-600">Games as White</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-semibold">{playerStats.asBlack}</div>
                                  <div className="text-sm text-gray-600">Games as Black</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Games List */}
                        {loadingGames ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                          </div>
                        ) : (
                          <>
                            {/* Games Pagination */}
                            {gamesTotalPages > 1 && (
                              <div className="flex items-center justify-center gap-2 mb-2">
                                <button
                                  onClick={() => handleGamesPageChange(Math.max(0, gamesPagination.offset - gamesPagination.limit))}
                                  disabled={gamesCurrentPage === 1}
                                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-sm text-gray-600 px-2">
                                  Games {gamesCurrentPage} of {gamesTotalPages} ({gamesPagination.total} total)
                                </span>
                                <button
                                  onClick={() => handleGamesPageChange(gamesPagination.offset + gamesPagination.limit)}
                                  disabled={!gamesPagination.hasMore}
                                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                            
                            <div className="bg-white rounded-lg border overflow-hidden max-h-[400px] overflow-y-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                  <tr>
                                    <th className="px-3 py-2 text-left">Date</th>
                                    <th className="px-3 py-2 text-left">Opponent</th>
                                    <th className="px-3 py-2 text-center">Color</th>
                                    <th className="px-3 py-2 text-center">Result</th>
                                    <th className="px-3 py-2 text-left">Event</th>
                                    <th className="px-3 py-2"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {playerGames.map((game, index) => {
                                    const opponent = game.playerColor === 'white' ? game.black : game.white;
                                    const opponentElo = game.playerColor === 'white' ? game.blackElo : game.whiteElo;
                                    const playerWon = 
                                      (game.playerColor === 'white' && game.result === '1-0') ||
                                      (game.playerColor === 'black' && game.result === '0-1');
                                    const playerLost = 
                                      (game.playerColor === 'white' && game.result === '0-1') ||
                                      (game.playerColor === 'black' && game.result === '1-0');
                                    
                                    return (
                                      <tr key={index} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => game.id && setSelectedGameId(game.id)}>
                                        <td className="px-3 py-2 text-gray-600">
                                          {game.date || 'Unknown'}
                                        </td>
                                        <td className="px-3 py-2">
                                          <div>
                                            <span className="font-medium">{opponent}</span>
                                            {opponentElo && (
                                              <span className="text-gray-500 ml-1">({opponentElo})</span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <span className={`inline-block w-4 h-4 rounded-sm ${
                                            game.playerColor === 'white' ? 'bg-white border border-gray-400' : 'bg-gray-800'
                                          }`} />
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <span className={`font-mono ${
                                            playerWon ? 'text-green-600 font-semibold' :
                                            playerLost ? 'text-red-600' :
                                            'text-gray-600'
                                          }`}>
                                            {game.result}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-gray-600 truncate max-w-[200px]" title={game.event}>
                                          {game.event}
                                        </td>
                                        <td className="px-3 py-2">
                                          {game.id && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedGameId(game.id!);
                                              }}
                                              className="text-blue-600 hover:text-blue-800 p-1"
                                              title="View game"
                                            >
                                              <Eye className="h-4 w-4" />
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <User className="w-16 h-16 mb-4 text-gray-300" />
                        <p className="text-lg font-medium">Select a player to view games</p>
                        <p className="text-sm mt-2">Click on any player from the list</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Empty State */}
            {databasePlayers.length === 0 && !loading && searchQuery.length >= 2 && (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No players found</h3>
                <p className="text-gray-600">
                  No players matching "{searchQuery}" in the database. Try a different search.
                </p>
              </div>
            )}

            {/* Initial State */}
            {searchQuery.length < 2 && (
              <div className="text-center py-12">
                <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Search the Database</h3>
                <p className="text-gray-600">
                  Enter at least 2 characters to search through 620,000+ players
                </p>
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Users className="w-10 h-10 text-blue-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold">620K+</div>
                      <div className="text-sm text-gray-600">Unique Players</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Activity className="w-10 h-10 text-green-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold">9.1M</div>
                      <div className="text-sm text-gray-600">Total Games</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Calendar className="w-10 h-10 text-purple-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold">174</div>
                      <div className="text-sm text-gray-600">Years of Data</div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Game Viewer Modal */}
      {selectedGameId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-auto">
            <GameViewer 
              gameId={selectedGameId} 
              onClose={() => setSelectedGameId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}