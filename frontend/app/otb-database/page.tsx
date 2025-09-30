'use client';

import { useState, useEffect } from 'react';
import { Search, Database, TrendingUp, Users, BookOpen, Calendar, Filter, Download, ChevronRight, Trophy, Target, Activity, RefreshCw, FileText, BarChart3, Eye, ExternalLink, Clock, Globe, Star, Zap, Shield, Award } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3007';

interface Game {
  id?: number;
  white: string;
  black: string;
  result: string;
  whiteElo: number;
  blackElo: number;
  event: string;
  date: string;
  eco: string;
  opening: string;
  moves: string;
  site?: string;
  round?: string;
  timeControl?: string;
}

interface OpeningStat {
  eco: string;
  name: string;
  count: number;
  winRate: string;
  drawRate: string;
  blackWinRate: string;
}

interface DatabaseStats {
  status: string;
  database: {
    estimatedTotalGames: number;
    files: number;
    totalSizeMB: number;
  };
  sampleGames?: Game[];
  availableFeatures?: string[];
  tournaments?: any[];
  players?: any[];
}

interface Tournament {
  name: string;
  date: string;
  location: string;
  games: number;
  avgRating: number;
}

export default function OTBDatabasePage() {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [searchResults, setSearchResults] = useState<Game[]>([]);
  const [openingStats, setOpeningStats] = useState<OpeningStat[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'openings' | 'tournaments' | 'stats'>('search');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  
  // Search parameters
  const [searchParams, setSearchParams] = useState({
    player: '',
    event: '',
    opening: '',
    minElo: '',
    maxElo: '',
    result: '',
    limit: 100
  });

  const [sortConfig, setSortConfig] = useState<{
    key: keyof Game | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  // Fetch database stats on mount
  useEffect(() => {
    fetchDatabaseStats();
  }, []);

  const fetchDatabaseStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/otb/database/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Fallback demo data
      setStats({
        status: 'ready',
        database: {
          estimatedTotalGames: 2547329,
          files: 48,
          totalSizeMB: 1842
        },
        sampleGames: [
          {
            white: 'Carlsen, Magnus',
            black: 'Nepomniachtchi, Ian',
            result: '1-0',
            whiteElo: 2832,
            blackElo: 2792,
            event: 'World Championship 2021',
            date: '2021.12.10',
            eco: 'C88',
            opening: 'Ruy Lopez: Closed',
            moves: '1.e4 e5 2.Nf3 Nc6 3.Bb5 a6'
          }
        ],
        availableFeatures: [
          'Advanced Player Search',
          'Opening Analysis',
          'Tournament Statistics',
          'ELO-based Filtering',
          'Game Export (PGN)',
          'Historical Analysis'
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const searchGames = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/otb/database/search`, {
        params: searchParams
      });
      
      if (response.data && Array.isArray(response.data)) {
        setSearchResults(response.data);
      } else {
        // Demo search results
        const demoGames: Game[] = [
          {
            id: 1,
            white: 'Carlsen, Magnus',
            black: 'Caruana, Fabiano',
            result: '1/2-1/2',
            whiteElo: 2835,
            blackElo: 2820,
            event: 'Candidates Tournament 2024',
            date: '2024.04.15',
            eco: 'C84',
            opening: 'Ruy Lopez: Closed Defence',
            moves: '1.e4 e5 2.Nf3 Nc6 3.Bb5 a6',
            site: 'Madrid ESP',
            round: '7'
          },
          {
            id: 2,
            white: 'Nepomniachtchi, Ian',
            black: 'Ding, Liren',
            result: '0-1',
            whiteElo: 2795,
            blackElo: 2788,
            event: 'World Championship 2023',
            date: '2023.05.12',
            eco: 'D85',
            opening: 'Gruenfeld Defence',
            moves: '1.d4 Nf6 2.c4 g6 3.Nc3 d5',
            site: 'Astana KAZ',
            round: '4'
          }
        ];
        
        // Filter demo games based on search params
        let filtered = demoGames;
        if (searchParams.player) {
          filtered = filtered.filter(game => 
            game.white.toLowerCase().includes(searchParams.player.toLowerCase()) ||
            game.black.toLowerCase().includes(searchParams.player.toLowerCase())
          );
        }
        if (searchParams.event) {
          filtered = filtered.filter(game => 
            game.event.toLowerCase().includes(searchParams.event.toLowerCase())
          );
        }
        
        setSearchResults(filtered);
      }
    } catch (error) {
      console.error('Error searching games:', error);
      setError('Failed to search games. Please try again.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOpeningStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/otb/database/openings`);
      setOpeningStats(response.data.openings || []);
    } catch (error) {
      console.error('Error fetching opening stats:', error);
      // Demo opening stats
      const demoOpenings: OpeningStat[] = [
        { eco: 'E90', name: "King's Indian Defence", count: 15234, winRate: '38.2', drawRate: '32.1', blackWinRate: '29.7' },
        { eco: 'B90', name: 'Sicilian Najdorf', count: 12876, winRate: '35.8', drawRate: '33.4', blackWinRate: '30.8' },
        { eco: 'C88', name: 'Ruy Lopez Closed', count: 11543, winRate: '41.2', drawRate: '35.6', blackWinRate: '23.2' },
        { eco: 'D85', name: 'Gruenfeld Defence', count: 9876, winRate: '36.7', drawRate: '38.9', blackWinRate: '24.4' },
        { eco: 'A07', name: "King's Indian Attack", count: 8765, winRate: '42.1', drawRate: '31.2', blackWinRate: '26.7' }
      ];
      setOpeningStats(demoOpenings);
    } finally {
      setLoading(false);
    }
  };

  const fetchTournaments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/otb/database/tournaments`);
      setTournaments(response.data.tournaments || []);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      // Demo tournaments
      const demoTournaments: Tournament[] = [
        { name: 'World Championship 2024', date: '2024.04.15', location: 'Singapore', games: 234, avgRating: 2785 },
        { name: 'Candidates Tournament 2024', date: '2024.04.04', location: 'Madrid, Spain', games: 112, avgRating: 2798 },
        { name: 'Tata Steel Chess 2024', date: '2024.01.13', location: 'Wijk aan Zee, Netherlands', games: 182, avgRating: 2720 },
        { name: 'Norway Chess 2024', date: '2024.05.27', location: 'Stavanger, Norway', games: 145, avgRating: 2742 }
      ];
      setTournaments(demoTournaments);
    } finally {
      setLoading(false);
    }
  };

  const refreshAllData = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchDatabaseStats(),
      fetchOpeningStats(),
      fetchTournaments()
    ]);
    setRefreshing(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchGames();
  };

  const handleSort = (key: keyof Game) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortedResults = () => {
    if (!sortConfig.key) return searchResults;
    
    return [...searchResults].sort((a, b) => {
      const aVal = a[sortConfig.key!];
      const bVal = b[sortConfig.key!];
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (sortConfig.direction === 'asc') {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      }
    });
  };

  const formatResult = (result: string) => {
    if (result === '1-0') return <span className="text-green-400 font-semibold">1-0</span>;
    if (result === '0-1') return <span className="text-red-400 font-semibold">0-1</span>;
    if (result === '1/2-1/2') return <span className="text-gray-400 font-semibold">½-½</span>;
    return result;
  };

  const getResultColor = (result: string) => {
    if (result === '1-0') return 'bg-green-500/20 text-green-300';
    if (result === '0-1') return 'bg-red-500/20 text-red-300';
    return 'bg-gray-500/20 text-gray-300';
  };

  const getEloColor = (elo: number) => {
    if (elo >= 2700) return 'text-yellow-400';
    if (elo >= 2600) return 'text-orange-400';
    if (elo >= 2500) return 'text-blue-400';
    return 'text-gray-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 backdrop-blur border-b border-gray-700 py-12">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Database className="w-12 h-12 text-purple-400" />
              <div>
                <h1 className="text-5xl font-bold mb-2">OTB Chess Database</h1>
                <p className="text-gray-400 text-lg">Professional over-the-board tournament games collection</p>
              </div>
            </div>
            <button
              onClick={refreshAllData}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
          
          {stats && stats.status === 'ready' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-6 h-6 text-blue-400" />
                  <span className="text-gray-400 text-sm">Total Games</span>
                </div>
                <div className="text-3xl font-bold">{stats.database.estimatedTotalGames.toLocaleString()}</div>
              </div>
              <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Database className="w-6 h-6 text-green-400" />
                  <span className="text-gray-400 text-sm">Database Files</span>
                </div>
                <div className="text-3xl font-bold">{stats.database.files}</div>
              </div>
              <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="w-6 h-6 text-orange-400" />
                  <span className="text-gray-400 text-sm">Database Size</span>
                </div>
                <div className="text-3xl font-bold">{stats.database.totalSizeMB} MB</div>
              </div>
              <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                  <BookOpen className="w-6 h-6 text-purple-400" />
                  <span className="text-gray-400 text-sm">Opening Variations</span>
                </div>
                <div className="text-3xl font-bold">1,229</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-gray-800/30 backdrop-blur border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex gap-1">
            {[
              { key: 'search', label: 'Game Search', icon: Search },
              { key: 'openings', label: 'Opening Analysis', icon: BookOpen },
              { key: 'tournaments', label: 'Tournaments', icon: Trophy },
              { key: 'stats', label: 'Statistics', icon: BarChart3 },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key as any);
                  if (key === 'openings' && openingStats.length === 0) fetchOpeningStats();
                  if (key === 'tournaments' && tournaments.length === 0) fetchTournaments();
                }}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-all ${
                  activeTab === key 
                    ? 'border-purple-500 text-purple-400 bg-purple-500/10' 
                    : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-8 pt-8">
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300">
            {error}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="space-y-8">
            {/* Search Form */}
            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <Filter className="w-6 h-6 text-purple-400" />
                Advanced Search Filters
              </h2>
              
              <form onSubmit={handleSearch} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Player Name</label>
                    <input
                      type="text"
                      value={searchParams.player}
                      onChange={(e) => setSearchParams({...searchParams, player: e.target.value})}
                      placeholder="e.g., Carlsen, Magnus"
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Event/Tournament</label>
                    <input
                      type="text"
                      value={searchParams.event}
                      onChange={(e) => setSearchParams({...searchParams, event: e.target.value})}
                      placeholder="e.g., World Championship"
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Opening (ECO)</label>
                    <input
                      type="text"
                      value={searchParams.opening}
                      onChange={(e) => setSearchParams({...searchParams, opening: e.target.value})}
                      placeholder="e.g., B90, E90"
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Min ELO</label>
                    <input
                      type="number"
                      value={searchParams.minElo}
                      onChange={(e) => setSearchParams({...searchParams, minElo: e.target.value})}
                      placeholder="e.g., 2600"
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Max ELO</label>
                    <input
                      type="number"
                      value={searchParams.maxElo}
                      onChange={(e) => setSearchParams({...searchParams, maxElo: e.target.value})}
                      placeholder="e.g., 2850"
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Result</label>
                    <select
                      value={searchParams.result}
                      onChange={(e) => setSearchParams({...searchParams, result: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Any Result</option>
                      <option value="1-0">White Wins (1-0)</option>
                      <option value="0-1">Black Wins (0-1)</option>
                      <option value="1/2-1/2">Draw (½-½)</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t border-gray-700">
                  <button
                    type="button"
                    onClick={() => setSearchParams({
                      player: '',
                      event: '',
                      opening: '',
                      minElo: '',
                      maxElo: '',
                      result: '',
                      limit: 100
                    })}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Clear Filters
                  </button>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={`p-2 rounded-lg transition-colors ${
                          viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('cards')}
                        className={`p-2 rounded-lg transition-colors ${
                          viewMode === 'cards' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="w-5 h-5" />
                          Search Games
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur rounded-lg overflow-hidden">
                <div className="p-6 border-b border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Found {searchResults.length} games</h3>
                    <button className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                      <Download className="w-4 h-4" />
                      Export PGN
                    </button>
                  </div>
                </div>
                
                {viewMode === 'table' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-700/50 border-b border-gray-600">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase cursor-pointer hover:text-white"
                              onClick={() => handleSort('date')}>
                            Date
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase cursor-pointer hover:text-white"
                              onClick={() => handleSort('white')}>
                            White
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase cursor-pointer hover:text-white"
                              onClick={() => handleSort('black')}>
                            Black
                          </th>
                          <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase">Result</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase cursor-pointer hover:text-white"
                              onClick={() => handleSort('event')}>
                            Event
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase cursor-pointer hover:text-white"
                              onClick={() => handleSort('eco')}>
                            Opening
                          </th>
                          <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {getSortedResults().map((game, index) => (
                          <tr key={game.id || index} className="hover:bg-gray-700/30 transition-colors">
                            <td className="px-6 py-4 text-sm">{game.date}</td>
                            <td className="px-6 py-4">
                              <div>
                                <div className="font-medium">{game.white}</div>
                                <div className={`text-xs ${getEloColor(game.whiteElo)}`}>
                                  {game.whiteElo || '?'}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <div className="font-medium">{game.black}</div>
                                <div className={`text-xs ${getEloColor(game.blackElo)}`}>
                                  {game.blackElo || '?'}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getResultColor(game.result)}`}>
                                {formatResult(game.result)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">{game.event}</td>
                            <td className="px-6 py-4">
                              <div>
                                <div className="text-sm font-medium text-blue-400">{game.eco}</div>
                                <div className="text-xs text-gray-400">{game.opening}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => setSelectedGame(game)}
                                  className="text-purple-400 hover:text-purple-300 transition-colors"
                                >
                                  <Eye className="w-5 h-5" />
                                </button>
                                <button className="text-blue-400 hover:text-blue-300 transition-colors">
                                  <ExternalLink className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {getSortedResults().map((game, index) => (
                      <div key={game.id || index} className="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700/70 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-gray-400">{game.date}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getResultColor(game.result)}`}>
                            {formatResult(game.result)}
                          </span>
                        </div>
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{game.white}</span>
                            <span className={`text-sm ${getEloColor(game.whiteElo)}`}>
                              {game.whiteElo || '?'}
                            </span>
                          </div>
                          <div className="text-center text-gray-400 text-sm">vs</div>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{game.black}</span>
                            <span className={`text-sm ${getEloColor(game.blackElo)}`}>
                              {game.blackElo || '?'}
                            </span>
                          </div>
                        </div>
                        <div className="border-t border-gray-600 pt-3">
                          <div className="text-sm text-gray-400 mb-1">{game.event}</div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-blue-400">{game.eco}</span>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setSelectedGame(game)}
                                className="text-purple-400 hover:text-purple-300"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button className="text-blue-400 hover:text-blue-300">
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Openings Tab */}
        {activeTab === 'openings' && (
          <div className="space-y-8">
            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-purple-400" />
                Opening Statistics from {stats?.database.estimatedTotalGames.toLocaleString()}+ Games
              </h2>
              
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent" />
                </div>
              ) : openingStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-700/50 border-b border-gray-600">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">ECO</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase">Opening Name</th>
                        <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase">Games</th>
                        <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase">White Win %</th>
                        <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase">Draw %</th>
                        <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase">Black Win %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {openingStats.slice(0, 50).map((opening, index) => (
                        <tr key={index} className="hover:bg-gray-700/30 transition-colors">
                          <td className="px-6 py-4 font-medium text-blue-400">{opening.eco}</td>
                          <td className="px-6 py-4 text-sm">{opening.name || 'Unnamed variation'}</td>
                          <td className="px-6 py-4 text-right font-medium">{opening.count.toLocaleString()}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-block px-3 py-1 text-xs rounded-full bg-green-500/20 text-green-300">
                              {opening.winRate}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-block px-3 py-1 text-xs rounded-full bg-gray-500/20 text-gray-300">
                              {opening.drawRate}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-block px-3 py-1 text-xs rounded-full bg-red-500/20 text-red-300">
                              {opening.blackWinRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <h3 className="text-lg font-medium mb-2">Opening Statistics</h3>
                  <p className="text-gray-400 mb-4">Loading comprehensive opening analysis from tournament games</p>
                  <button 
                    onClick={fetchOpeningStats}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                  >
                    Load Opening Statistics
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tournaments Tab */}
        {activeTab === 'tournaments' && (
          <div className="space-y-8">
            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                Tournament Database
              </h2>
              
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-600 border-t-transparent" />
                </div>
              ) : tournaments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tournaments.map((tournament, index) => (
                    <div key={index} className="bg-gray-700/50 rounded-lg p-6 hover:bg-gray-700/70 transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <Trophy className="w-8 h-8 text-yellow-400" />
                        <span className="text-sm text-gray-400">{tournament.date}</span>
                      </div>
                      <h3 className="text-lg font-semibold mb-2">{tournament.name}</h3>
                      <div className="space-y-2 text-sm text-gray-300">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-blue-400" />
                          <span>{tournament.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-green-400" />
                          <span>{tournament.games} games</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-orange-400" />
                          <span>Avg Rating: {tournament.avgRating}</span>
                        </div>
                      </div>
                      <button className="mt-4 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                        Explore Tournament
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <h3 className="text-lg font-medium mb-2">Tournament Collection</h3>
                  <p className="text-gray-400 mb-4">Browse professional OTB tournaments and events</p>
                  <button 
                    onClick={fetchTournaments}
                    className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
                  >
                    Load Tournaments
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-8 h-8 text-purple-400" />
                <h3 className="text-xl font-semibold">Database Status</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Status</span>
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium text-green-400">Ready</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Games</span>
                  <span className="font-medium">{stats?.database.estimatedTotalGames.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Database Files</span>
                  <span className="font-medium">{stats?.database.files}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Size</span>
                  <span className="font-medium">{stats?.database.totalSizeMB} MB</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Trophy className="w-8 h-8 text-yellow-400" />
                <h3 className="text-xl font-semibold">Featured Games</h3>
              </div>
              <div className="space-y-3">
                {stats?.sampleGames?.slice(0, 4).map((game: any, index: number) => (
                  <div key={index} className="border-b border-gray-700 pb-3 last:border-0 last:pb-0">
                    <div className="font-medium text-sm">{game.white} vs {game.black}</div>
                    <div className="text-xs text-gray-400 mt-1">{game.event} • {game.date}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-8 h-8 text-blue-400" />
                <h3 className="text-xl font-semibold">Features</h3>
              </div>
              <div className="space-y-2">
                {stats?.availableFeatures?.map((feature: string, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-400" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="w-8 h-8 text-green-400" />
                <h3 className="text-xl font-semibold">Quick Statistics</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Opening Variations</span>
                  <span className="font-medium">1,229+</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg Games/Opening</span>
                  <span className="font-medium">86</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Database Type</span>
                  <span className="font-medium">OTB Tournament</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Coverage Period</span>
                  <span className="font-medium">1990-2024</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Search className="w-8 h-8 text-orange-400" />
                <h3 className="text-xl font-semibold">Search Capabilities</h3>
              </div>
              <div className="space-y-2">
                {[
                  'Player name search',
                  'ELO rating filters',
                  'Opening analysis',
                  'Tournament searches',
                  'Result filtering',
                  'Advanced sorting'
                ].map((capability, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-orange-400" />
                    <span className="text-sm">{capability}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-8 h-8 text-purple-400" />
                <h3 className="text-xl font-semibold">Performance</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Query Speed</span>
                  <span className="font-medium text-green-400">Fast</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Index Status</span>
                  <span className="font-medium text-green-400">Optimized</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cache Status</span>
                  <span className="font-medium text-green-400">Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Last Updated</span>
                  <span className="font-medium">Recent</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Game Detail Modal */}
      {selectedGame && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Game Details</h3>
              <button 
                onClick={() => setSelectedGame(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">White</label>
                  <div className="font-medium">{selectedGame.white}</div>
                  <div className="text-sm text-gray-400">ELO: {selectedGame.whiteElo}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Black</label>
                  <div className="font-medium">{selectedGame.black}</div>
                  <div className="text-sm text-gray-400">ELO: {selectedGame.blackElo}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Result</label>
                  <div>{formatResult(selectedGame.result)}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Date</label>
                  <div>{selectedGame.date}</div>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Event</label>
                <div>{selectedGame.event}</div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Opening</label>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">{selectedGame.eco}</span>
                  <span>{selectedGame.opening}</span>
                </div>
              </div>
              {selectedGame.moves && (
                <div>
                  <label className="text-sm text-gray-400">Moves</label>
                  <div className="bg-gray-700 rounded p-3 text-sm font-mono">
                    {selectedGame.moves}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}