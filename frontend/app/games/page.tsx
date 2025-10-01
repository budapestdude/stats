'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Calendar, Trophy, Clock, ChevronDown, ChevronUp, Eye, Download, X, RefreshCw, Users, BarChart3, Share } from 'lucide-react';
import Link from 'next/link';
import ChessBoard from '@/components/ChessBoard';
import axios from 'axios';

import { API_BASE_URL } from '@/lib/config';

export default function GamesPage() {
  const [filters, setFilters] = useState({
    player: '',
    opening: '',
    result: '',
    minRating: '',
    maxRating: '',
    timeControl: '',
    dateFrom: '',
    dateTo: '',
  });
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [playerSuggestions, setPlayerSuggestions] = useState<string[]>([]);
  const [showPlayerSuggestions, setShowPlayerSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [availableOpenings, setAvailableOpenings] = useState<any[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch available openings on mount
  useEffect(() => {
    fetchAvailableOpenings();
  }, []);

  // Fetch player suggestions when typing
  useEffect(() => {
    if (filters.player.length > 2) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        fetchPlayerSuggestions();
      }, 300);
    } else {
      setPlayerSuggestions([]);
      setShowPlayerSuggestions(false);
    }
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [filters.player]);

  const fetchAvailableOpenings = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/stats/openings`);
      if (response.data?.popular) {
        setAvailableOpenings(response.data.popular);
      }
    } catch (error) {
      console.error('Failed to fetch openings:', error);
    }
  };

  const fetchPlayerSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/players/search`, {
        params: { q: filters.player, limit: 5 }
      });
      if (response.data?.players) {
        setPlayerSuggestions(response.data.players.map((p: any) => p.username || p.name));
        setShowPlayerSuggestions(true);
      }
    } catch (error) {
      console.error('Failed to fetch player suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Build query string from filters
  const queryString = new URLSearchParams({
    ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== '')),
    page: page.toString(),
    limit: '20',
  }).toString();

  // Fetch games
  const { data: gamesData, isLoading, error } = useQuery({
    queryKey: ['games', queryString],
    queryFn: () => fetch(`${API_BASE_URL}/api/games/search?${queryString}`).then(res => res.json()),
  });

  // Fetch selected game details
  const { data: gameDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ['game', selectedGame?.id],
    queryFn: () => fetch(`${API_BASE_URL}/api/games/${selectedGame.id}`).then(res => res.json()),
    enabled: !!selectedGame?.id,
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      player: '',
      opening: '',
      result: '',
      minRating: '',
      maxRating: '',
      timeControl: '',
      dateFrom: '',
      dateTo: '',
    });
    setPage(1);
  };

  const downloadPGN = (game: any) => {
    if (!game?.pgn) return;
    
    const blob = new Blob([game.pgn], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${game.white}_vs_${game.black}_${game.date}.pgn`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const shareGame = async (game: any) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${game.white} vs ${game.black}`,
          text: `Check out this chess game: ${game.white} vs ${game.black} (${game.result})`,
          url: window.location.href
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      const gameUrl = `${window.location.origin}/games/${game.id}`;
      navigator.clipboard.writeText(gameUrl);
      alert('Game URL copied to clipboard!');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric' 
    });
  };

  const getResultDisplay = (result: string) => {
    switch(result) {
      case '1-0': return <span className="px-2 py-1 bg-white text-black border rounded text-xs font-bold">1-0</span>;
      case '0-1': return <span className="px-2 py-1 bg-black text-white rounded text-xs font-bold">0-1</span>;
      case '1/2-1/2': return <span className="px-2 py-1 bg-gray-400 text-white rounded text-xs font-bold">½-½</span>;
      default: return result;
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Game Database</h1>
        <p className="text-gray-600">
          Search through millions of chess games with advanced filters
        </p>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Search Filters
          </h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="text-gray-600 hover:text-gray-900"
          >
            {showFilters ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {showFilters && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Player Search */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Player</label>
                <div className="relative">
                  <input
                    type="text"
                    value={filters.player}
                    onChange={(e) => handleFilterChange('player', e.target.value)}
                    onFocus={() => setShowPlayerSuggestions(playerSuggestions.length > 0)}
                    onBlur={() => setTimeout(() => setShowPlayerSuggestions(false), 200)}
                    placeholder="Search players..."
                    className="w-full px-3 py-2 pr-8 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {loadingSuggestions && (
                    <RefreshCw className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                  )}
                </div>
                
                {/* Player Suggestions */}
                {showPlayerSuggestions && playerSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                    {playerSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          handleFilterChange('player', suggestion);
                          setShowPlayerSuggestions(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors border-b last:border-0"
                      >
                        <div className="font-medium">{suggestion}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Opening */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening</label>
                <select
                  value={filters.opening}
                  onChange={(e) => handleFilterChange('opening', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Openings</option>
                  {availableOpenings.map((opening) => (
                    <option key={opening.eco} value={opening.eco}>
                      {opening.name} ({opening.eco})
                    </option>
                  ))}
                </select>
              </div>

              {/* Result */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Result</label>
                <select
                  value={filters.result}
                  onChange={(e) => handleFilterChange('result', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Results</option>
                  <option value="1-0">White Wins</option>
                  <option value="0-1">Black Wins</option>
                  <option value="1/2-1/2">Draw</option>
                </select>
              </div>

              {/* Rating Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Rating</label>
                <input
                  type="number"
                  value={filters.minRating}
                  onChange={(e) => handleFilterChange('minRating', e.target.value)}
                  placeholder="1000"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Rating</label>
                <input
                  type="number"
                  value={filters.maxRating}
                  onChange={(e) => handleFilterChange('maxRating', e.target.value)}
                  placeholder="3000"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Time Control */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Control</label>
                <select
                  value={filters.timeControl}
                  onChange={(e) => handleFilterChange('timeControl', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Time Controls</option>
                  <option value="bullet">Bullet</option>
                  <option value="blitz">Blitz</option>
                  <option value="rapid">Rapid</option>
                  <option value="classical">Classical</option>
                </select>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition"
              >
                Clear Filters
              </button>
              {gamesData?.pagination?.total && (
                <span className="text-sm text-gray-600">
                  Found {gamesData.pagination.total.toLocaleString()} games
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Searching games...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium">Search Error</h3>
            <p className="text-sm text-gray-600 mt-2">Unable to fetch games. Please try again.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Retry
            </button>
          </div>
        </div>
      ) : !gamesData?.games?.length ? (
        <div className="text-center py-12">
          <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Games Found</h3>
          <p className="text-gray-600">Try adjusting your search filters to find more games.</p>
          <button
            onClick={clearFilters}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Game List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Search Results</h3>
                  {gamesData?.pagination?.total && (
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {gamesData.pagination.total.toLocaleString()} games
                      </span>
                      <span>Page {page} of {gamesData.pagination.pages}</span>
                    </div>
                  )}
                </div>
                
                {/* Active Filters Summary */}
                {Object.values(filters).some(v => v !== '') && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(filters).map(([key, value]) => 
                      value && (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                        >
                          {key}: {value}
                          <button
                            onClick={() => handleFilterChange(key, '')}
                            className="hover:bg-blue-200 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )
                    )}
                    <button
                      onClick={clearFilters}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
              
              <div className="divide-y">
                {gamesData?.games?.map((game: any) => (
                  <div
                    key={game.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition ${
                      selectedGame?.id === game.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedGame(game)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/players/${game.white}`}
                          className="font-semibold hover:text-blue-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {game.white}
                        </Link>
                        <span className="text-gray-400">({game.whiteRating})</span>
                        <span className="text-gray-600">vs</span>
                        <Link
                          href={`/players/${game.black}`}
                          className="font-semibold hover:text-blue-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {game.black}
                        </Link>
                        <span className="text-gray-400">({game.blackRating})</span>
                      </div>
                      {getResultDisplay(game.result)}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{game.opening.name}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {game.timeControl}
                      </span>
                      <span>•</span>
                      <span>{game.moves} moves</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(game.date)}
                      </span>
                      {game.tournament && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            {game.tournament}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {gamesData?.pagination && (
                <div className="p-4 border-t flex items-center justify-between">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {gamesData.pagination.pages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= gamesData.pagination.pages}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Game Preview */}
          <div className="lg:col-span-1">
            {loadingDetails ? (
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-gray-200 rounded"></div>
                  <div className="w-full aspect-square bg-gray-200 rounded"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            ) : gameDetails ? (
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Game Details</h3>
                  <button
                    onClick={() => setSelectedGame(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Mini Board */}
                <div className="mb-4">
                  <ChessBoard
                    pgn={gameDetails.pgn}
                    interactive={false}
                    showControls={true}
                    boardWidth={300}
                  />
                </div>

                {/* Game Info */}
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">White:</span>
                    <span className="font-medium">{gameDetails.white} ({gameDetails.whiteRating})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Black:</span>
                    <span className="font-medium">{gameDetails.black} ({gameDetails.blackRating})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Result:</span>
                    <span className="font-medium">{gameDetails.result}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Opening:</span>
                    <span className="font-medium">{gameDetails.opening.name}</span>
                  </div>
                  {gameDetails.tournament && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tournament:</span>
                      <span className="font-medium">{gameDetails.tournament}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Moves:</span>
                    <span className="font-medium">{gameDetails.moves}</span>
                  </div>
                </div>

                {/* Analysis Stats */}
                {gameDetails.analysis && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium mb-2">Analysis</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Accuracy:</span>
                        <div className="flex gap-2">
                          <span>W: {gameDetails.analysis.accuracy.white}%</span>
                          <span>B: {gameDetails.analysis.accuracy.black}%</span>
                        </div>
                      </div>
                      {gameDetails.analysis.brilliantMoves > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Brilliant Moves:</span>
                          <span className="font-medium text-purple-600">{gameDetails.analysis.brilliantMoves}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 pt-4 border-t space-y-2">
                  <div className="flex gap-2">
                    <Link
                      href={`/analysis?pgn=${encodeURIComponent(gameDetails.pgn || '')}`}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Analyze
                    </Link>
                    <button 
                      onClick={() => downloadPGN(gameDetails)}
                      className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                  <button
                    onClick={() => shareGame(gameDetails)}
                    className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
                  >
                    <Share className="w-4 h-4" />
                    Share Game
                  </button>
                  
                  {/* Quick Stats */}
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-xs text-gray-500 space-y-1">
                      <div className="flex justify-between">
                        <span>Game ID:</span>
                        <span className="font-mono">{gameDetails.id}</span>
                      </div>
                      {gameDetails.eco && (
                        <div className="flex justify-between">
                          <span>ECO:</span>
                          <span className="font-mono">{gameDetails.eco}</span>
                        </div>
                      )}
                      {gameDetails.timeControl && (
                        <div className="flex justify-between">
                          <span>Time Control:</span>
                          <span>{gameDetails.timeControl}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Select a game to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}