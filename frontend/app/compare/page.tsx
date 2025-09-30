'use client';

import { useState, useEffect } from 'react';
import { Search, User, Trophy, TrendingUp, Target, Zap, Shield, Swords, Crown, Star, Activity, Award, Users, RefreshCw, ArrowLeftRight, ArrowUpDown, Filter, Calendar, Clock } from 'lucide-react';
import { 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3007';

interface PlayerStats {
  username: string;
  title?: string;
  name?: string;
  country?: string;
  followers?: number;
  url?: string;
  avatar?: string;
  is_streamer?: boolean;
  verified?: boolean;
  league?: string;
  ratings: {
    rapid?: number;
    blitz?: number;
    bullet?: number;
    correspondence?: number;
  };
  stats: {
    rapid?: { win: number; loss: number; draw: number; time_per_move?: number; };
    blitz?: { win: number; loss: number; draw: number; time_per_move?: number; };
    bullet?: { win: number; loss: number; draw: number; time_per_move?: number; };
  };
  peak_ratings?: {
    rapid?: number;
    blitz?: number;
    bullet?: number;
  };
  joined?: string;
  last_online?: string;
  total_games?: number;
  win_percentage?: number;
}

interface ComparisonMetrics {
  player1: PlayerStats;
  player2: PlayerStats;
  ratingComparison: any[];
  performanceComparison: any[];
  activityComparison: any[];
  strengthsComparison: any[];
  headToHeadRecord?: any;
}

export default function ComparePage() {
  const [player1Username, setPlayer1Username] = useState('hikaru');
  const [player2Username, setPlayer2Username] = useState('magnuscarlsen');
  const [searchInput1, setSearchInput1] = useState('hikaru');
  const [searchInput2, setSearchInput2] = useState('magnuscarlsen');
  const [player1Data, setPlayer1Data] = useState<PlayerStats | null>(null);
  const [player2Data, setPlayer2Data] = useState<PlayerStats | null>(null);
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions1, setSuggestions1] = useState<string[]>([]);
  const [suggestions2, setSuggestions2] = useState<string[]>([]);
  const [showSuggestions1, setShowSuggestions1] = useState(false);
  const [showSuggestions2, setShowSuggestions2] = useState(false);
  const [comparisonView, setComparisonView] = useState<'overview' | 'detailed' | 'head2head'>('overview');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (player1Username) fetchPlayer1Data();
  }, [player1Username]);

  useEffect(() => {
    if (player2Username) fetchPlayer2Data();
  }, [player2Username]);

  const fetchPlayer1Data = async () => {
    if (!player1Username) return;
    setLoading1(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/players/${player1Username}`);
      setPlayer1Data(response.data);
    } catch (error) {
      console.error('Failed to fetch player 1 data:', error);
      setError('Failed to load player 1 data');
    } finally {
      setLoading1(false);
    }
  };

  const fetchPlayer2Data = async () => {
    if (!player2Username) return;
    setLoading2(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/players/${player2Username}`);
      setPlayer2Data(response.data);
    } catch (error) {
      console.error('Failed to fetch player 2 data:', error);
      setError('Failed to load player 2 data');
    } finally {
      setLoading2(false);
    }
  };

  const searchSuggestions = async (query: string, setSuggestions: (suggestions: string[]) => void) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const response = await axios.get(`${API_BASE_URL}/api/players/search`, {
        params: { q: query, limit: 5 }
      });
      if (response.data && Array.isArray(response.data)) {
        setSuggestions(response.data.map((player: any) => player.username || player.name));
      }
    } catch (error) {
      console.log('Search suggestions not available');
      setSuggestions(['magnuscarlsen', 'hikaru', 'gothamchess', 'chessbrah', 'gmhikaru'].filter(name => 
        name.toLowerCase().includes(query.toLowerCase())
      ));
    }
  };

  const handleSearch1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput1.trim()) {
      setPlayer1Username(searchInput1.trim());
      setShowSuggestions1(false);
    }
  };

  const handleSearch2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput2.trim()) {
      setPlayer2Username(searchInput2.trim());
      setShowSuggestions2(false);
    }
  };

  const swapPlayers = () => {
    const tempUsername = player1Username;
    const tempSearchInput = searchInput1;
    const tempData = player1Data;
    
    setPlayer1Username(player2Username);
    setSearchInput1(searchInput2);
    setPlayer1Data(player2Data);
    
    setPlayer2Username(tempUsername);
    setSearchInput2(tempSearchInput);
    setPlayer2Data(tempData);
  };

  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([fetchPlayer1Data(), fetchPlayer2Data()]);
    setRefreshing(false);
  };

  const getComparisonMetrics = (): ComparisonMetrics | null => {
    if (!player1Data || !player2Data) return null;

    // Rating comparison
    const ratingComparison = [
      {
        category: 'Rapid',
        player1: player1Data.ratings?.rapid || 0,
        player2: player2Data.ratings?.rapid || 0,
      },
      {
        category: 'Blitz',
        player1: player1Data.ratings?.blitz || 0,
        player2: player2Data.ratings?.blitz || 0,
      },
      {
        category: 'Bullet',
        player1: player1Data.ratings?.bullet || 0,
        player2: player2Data.ratings?.bullet || 0,
      },
    ];

    // Performance comparison (win rates)
    const getWinRate = (stats: any) => {
      if (!stats || (!stats.win && !stats.loss && !stats.draw)) return 0;
      const total = stats.win + stats.loss + stats.draw;
      return total > 0 ? (stats.win / total * 100) : 0;
    };

    const performanceComparison = [
      {
        category: 'Rapid Win Rate',
        player1: getWinRate(player1Data.stats?.rapid),
        player2: getWinRate(player2Data.stats?.rapid),
      },
      {
        category: 'Blitz Win Rate',
        player1: getWinRate(player1Data.stats?.blitz),
        player2: getWinRate(player2Data.stats?.blitz),
      },
      {
        category: 'Bullet Win Rate',
        player1: getWinRate(player1Data.stats?.bullet),
        player2: getWinRate(player2Data.stats?.bullet),
      },
    ];

    // Activity comparison
    const activityComparison = [
      {
        metric: 'Followers',
        player1: player1Data.followers || 0,
        player2: player2Data.followers || 0,
      },
      {
        metric: 'Total Games',
        player1: player1Data.total_games || 0,
        player2: player2Data.total_games || 0,
      },
    ];

    // Strengths radar chart
    const strengthsComparison = [
      {
        skill: 'Rapid',
        player1: Math.min(100, ((player1Data.ratings?.rapid || 1000) / 3000) * 100),
        player2: Math.min(100, ((player2Data.ratings?.rapid || 1000) / 3000) * 100),
      },
      {
        skill: 'Blitz',
        player1: Math.min(100, ((player1Data.ratings?.blitz || 1000) / 3000) * 100),
        player2: Math.min(100, ((player2Data.ratings?.blitz || 1000) / 3000) * 100),
      },
      {
        skill: 'Bullet',
        player1: Math.min(100, ((player1Data.ratings?.bullet || 1000) / 3000) * 100),
        player2: Math.min(100, ((player2Data.ratings?.bullet || 1000) / 3000) * 100),
      },
      {
        skill: 'Consistency',
        player1: Math.min(100, getWinRate(player1Data.stats?.rapid)),
        player2: Math.min(100, getWinRate(player2Data.stats?.rapid)),
      },
      {
        skill: 'Activity',
        player1: Math.min(100, (player1Data.followers || 0) / 1000),
        player2: Math.min(100, (player2Data.followers || 0) / 1000),
      },
    ];

    return {
      player1: player1Data,
      player2: player2Data,
      ratingComparison,
      performanceComparison,
      activityComparison,
      strengthsComparison,
    };
  };

  const comparisonMetrics = getComparisonMetrics();

  const getBetterPlayer = (value1: number, value2: number) => {
    if (value1 > value2) return 'player1';
    if (value2 > value1) return 'player2';
    return 'tie';
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const renderPlayerCard = (
    playerData: PlayerStats | null,
    loading: boolean,
    searchInput: string,
    setSearchInput: (value: string) => void,
    handleSearch: (e: React.FormEvent) => void,
    suggestions: string[],
    showSuggestions: boolean,
    setShowSuggestions: (show: boolean) => void,
    searchSuggestions: (query: string) => void,
    playerNumber: 1 | 2
  ) => {
    const isPlayer1 = playerNumber === 1;
    const colorClass = isPlayer1 ? 'blue' : 'green';
    
    return (
      <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold text-${colorClass}-400`}>
            Player {playerNumber}
          </h3>
          {playerData?.verified && (
            <div className="flex items-center gap-1">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-yellow-400">Verified</span>
            </div>
          )}
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-4 relative">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  if (e.target.value.length >= 2) {
                    searchSuggestions(e.target.value);
                    setShowSuggestions(true);
                  } else {
                    setShowSuggestions(false);
                  }
                }}
                onFocus={() => {
                  if (searchInput.length >= 2) setShowSuggestions(true);
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Enter username..."
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-gray-700 rounded-lg shadow-lg z-10">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setSearchInput(suggestion);
                        setShowSuggestions(false);
                        if (isPlayer1) {
                          setPlayer1Username(suggestion);
                        } else {
                          setPlayer2Username(suggestion);
                        }
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-600 first:rounded-t-lg last:rounded-b-lg transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 bg-${colorClass}-500 text-white rounded-lg hover:bg-${colorClass}-600 transition-colors disabled:opacity-50`}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Search className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>

        {/* Player Info */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
            <p className="text-gray-400 mt-2">Loading player data...</p>
          </div>
        ) : playerData ? (
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="flex items-center gap-3">
              <User className={`w-6 h-6 text-${colorClass}-400`} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">
                    {playerData.title && <span className="text-yellow-400">{playerData.title} </span>}
                    {playerData.username}
                  </span>
                  {playerData.is_streamer && (
                    <Star className="w-4 h-4 text-purple-400" />
                  )}
                </div>
                {playerData.name && (
                  <p className="text-sm text-gray-400">{playerData.name}</p>
                )}
              </div>
            </div>

            {/* Country & League */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {playerData.country && (
                <div>
                  <span className="text-gray-400">Country:</span>
                  <p className="font-medium">{playerData.country}</p>
                </div>
              )}
              {playerData.league && (
                <div>
                  <span className="text-gray-400">League:</span>
                  <p className="font-medium">{playerData.league}</p>
                </div>
              )}
            </div>

            {/* Current Ratings */}
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h4 className="font-medium text-gray-300 mb-2">Current Ratings</h4>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className={`text-xl font-bold text-${colorClass}-400`}>
                    {playerData.ratings?.rapid || 'N/A'}
                  </div>
                  <div className="text-xs text-gray-400">Rapid</div>
                </div>
                <div>
                  <div className={`text-xl font-bold text-${colorClass}-400`}>
                    {playerData.ratings?.blitz || 'N/A'}
                  </div>
                  <div className="text-xs text-gray-400">Blitz</div>
                </div>
                <div>
                  <div className={`text-xl font-bold text-${colorClass}-400`}>
                    {playerData.ratings?.bullet || 'N/A'}
                  </div>
                  <div className="text-xs text-gray-400">Bullet</div>
                </div>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-400">Followers:</span>
                <p className="font-medium">{playerData.followers?.toLocaleString() || 0}</p>
              </div>
              <div>
                <span className="text-gray-400">Total Games:</span>
                <p className="font-medium">{playerData.total_games?.toLocaleString() || 'N/A'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Enter a username to compare</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Swords className="w-12 h-12 text-blue-400" />
            <ArrowUpDown className="w-8 h-8 text-gray-400" />
            <Swords className="w-12 h-12 text-green-400" />
          </div>
          <h1 className="text-5xl font-bold mb-4">Player Comparison</h1>
          <p className="text-gray-400 text-lg">
            Compare chess players head-to-head with detailed statistics and performance metrics
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={swapPlayers}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Swap Players
          </button>
          <button
            onClick={refreshData}
            disabled={refreshing || loading1 || loading2}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Player Selection Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {renderPlayerCard(
            player1Data, loading1, searchInput1, setSearchInput1, handleSearch1,
            suggestions1, showSuggestions1, setShowSuggestions1,
            (query) => searchSuggestions(query, setSuggestions1), 1
          )}
          {renderPlayerCard(
            player2Data, loading2, searchInput2, setSearchInput2, handleSearch2,
            suggestions2, showSuggestions2, setShowSuggestions2,
            (query) => searchSuggestions(query, setSuggestions2), 2
          )}
        </div>

        {/* Comparison View Tabs */}
        {comparisonMetrics && (
          <>
            <div className="flex items-center justify-center mb-8">
              <div className="bg-gray-800/30 rounded-lg p-2 flex gap-2">
                {[
                  { key: 'overview', label: 'Overview', icon: Trophy },
                  { key: 'detailed', label: 'Detailed Stats', icon: Target },
                  { key: 'head2head', label: 'Head-to-Head', icon: Swords },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setComparisonView(key as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      comparisonView === key
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Overview Tab */}
            {comparisonView === 'overview' && (
              <div className="space-y-8">
                {/* Quick Comparison */}
                <div className="bg-gradient-to-r from-blue-500/20 to-green-500/20 rounded-lg p-6">
                  <h2 className="text-2xl font-bold mb-6 text-center">Head-to-Head Summary</h2>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-blue-400 mb-1">
                        {comparisonMetrics.player1.ratings?.rapid || 0}
                      </div>
                      <div className="text-gray-400 mb-1">vs</div>
                      <div className="text-4xl font-bold text-green-400 mb-2">
                        {comparisonMetrics.player2.ratings?.rapid || 0}
                      </div>
                      <div className="text-sm font-medium">Rapid Rating</div>
                      <div className={`text-xs mt-1 ${
                        getBetterPlayer(
                          comparisonMetrics.player1.ratings?.rapid || 0,
                          comparisonMetrics.player2.ratings?.rapid || 0
                        ) === 'player1' ? 'text-blue-400' :
                        getBetterPlayer(
                          comparisonMetrics.player1.ratings?.rapid || 0,
                          comparisonMetrics.player2.ratings?.rapid || 0
                        ) === 'player2' ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {getBetterPlayer(
                          comparisonMetrics.player1.ratings?.rapid || 0,
                          comparisonMetrics.player2.ratings?.rapid || 0
                        ) === 'player1' ? `${comparisonMetrics.player1.username} leads` :
                        getBetterPlayer(
                          comparisonMetrics.player1.ratings?.rapid || 0,
                          comparisonMetrics.player2.ratings?.rapid || 0
                        ) === 'player2' ? `${comparisonMetrics.player2.username} leads` : 'Tied'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-blue-400 mb-1">
                        {comparisonMetrics.player1.ratings?.blitz || 0}
                      </div>
                      <div className="text-gray-400 mb-1">vs</div>
                      <div className="text-4xl font-bold text-green-400 mb-2">
                        {comparisonMetrics.player2.ratings?.blitz || 0}
                      </div>
                      <div className="text-sm font-medium">Blitz Rating</div>
                      <div className={`text-xs mt-1 ${
                        getBetterPlayer(
                          comparisonMetrics.player1.ratings?.blitz || 0,
                          comparisonMetrics.player2.ratings?.blitz || 0
                        ) === 'player1' ? 'text-blue-400' :
                        getBetterPlayer(
                          comparisonMetrics.player1.ratings?.blitz || 0,
                          comparisonMetrics.player2.ratings?.blitz || 0
                        ) === 'player2' ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {getBetterPlayer(
                          comparisonMetrics.player1.ratings?.blitz || 0,
                          comparisonMetrics.player2.ratings?.blitz || 0
                        ) === 'player1' ? `${comparisonMetrics.player1.username} leads` :
                        getBetterPlayer(
                          comparisonMetrics.player1.ratings?.blitz || 0,
                          comparisonMetrics.player2.ratings?.blitz || 0
                        ) === 'player2' ? `${comparisonMetrics.player2.username} leads` : 'Tied'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-blue-400 mb-1">
                        {comparisonMetrics.player1.followers?.toLocaleString() || 0}
                      </div>
                      <div className="text-gray-400 mb-1">vs</div>
                      <div className="text-4xl font-bold text-green-400 mb-2">
                        {comparisonMetrics.player2.followers?.toLocaleString() || 0}
                      </div>
                      <div className="text-sm font-medium">Followers</div>
                      <div className={`text-xs mt-1 ${
                        getBetterPlayer(
                          comparisonMetrics.player1.followers || 0,
                          comparisonMetrics.player2.followers || 0
                        ) === 'player1' ? 'text-blue-400' :
                        getBetterPlayer(
                          comparisonMetrics.player1.followers || 0,
                          comparisonMetrics.player2.followers || 0
                        ) === 'player2' ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {getBetterPlayer(
                          comparisonMetrics.player1.followers || 0,
                          comparisonMetrics.player2.followers || 0
                        ) === 'player1' ? `${comparisonMetrics.player1.username} leads` :
                        getBetterPlayer(
                          comparisonMetrics.player1.followers || 0,
                          comparisonMetrics.player2.followers || 0
                        ) === 'player2' ? `${comparisonMetrics.player2.username} leads` : 'Tied'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rating Comparison Chart */}
                <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-yellow-400" />
                    Rating Comparison
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={comparisonMetrics.ratingComparison}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="category" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1F2937', 
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#F9FAFB'
                        }}
                      />
                      <Legend />
                      <Bar dataKey="player1" fill="#3B82F6" name={comparisonMetrics.player1.username} />
                      <Bar dataKey="player2" fill="#10B981" name={comparisonMetrics.player2.username} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Strengths Radar Chart */}
                <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <Target className="w-6 h-6 text-purple-400" />
                    Overall Strengths Comparison
                  </h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <RadarChart data={comparisonMetrics.strengthsComparison}>
                      <PolarGrid stroke="#374151" />
                      <PolarAngleAxis dataKey="skill" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                      <PolarRadiusAxis 
                        angle={90} 
                        domain={[0, 100]} 
                        tick={{ fontSize: 10, fill: '#6B7280' }}
                      />
                      <Radar 
                        name={comparisonMetrics.player1.username}
                        dataKey="player1" 
                        stroke="#3B82F6" 
                        fill="#3B82F6" 
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                      <Radar 
                        name={comparisonMetrics.player2.username}
                        dataKey="player2" 
                        stroke="#10B981" 
                        fill="#10B981" 
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Detailed Stats Tab */}
            {comparisonView === 'detailed' && (
              <div className="space-y-8">
                {/* Performance Comparison */}
                <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <Shield className="w-6 h-6 text-blue-400" />
                    Win Rate Performance
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={comparisonMetrics.performanceComparison}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="category" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1F2937', 
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#F9FAFB'
                        }}
                        formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="player1" 
                        stroke="#3B82F6" 
                        fill="#3B82F6" 
                        fillOpacity={0.3}
                        name={comparisonMetrics.player1.username}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="player2" 
                        stroke="#10B981" 
                        fill="#10B981" 
                        fillOpacity={0.3}
                        name={comparisonMetrics.player2.username}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Peak Ratings Comparison */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
                    <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-orange-400" />
                      Peak Ratings - {comparisonMetrics.player1.username}
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Rapid Peak:</span>
                        <span className="font-bold text-orange-400">
                          {comparisonMetrics.player1.peak_ratings?.rapid || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Blitz Peak:</span>
                        <span className="font-bold text-orange-400">
                          {comparisonMetrics.player1.peak_ratings?.blitz || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Bullet Peak:</span>
                        <span className="font-bold text-orange-400">
                          {comparisonMetrics.player1.peak_ratings?.bullet || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
                    <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-orange-400" />
                      Peak Ratings - {comparisonMetrics.player2.username}
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Rapid Peak:</span>
                        <span className="font-bold text-orange-400">
                          {comparisonMetrics.player2.peak_ratings?.rapid || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Blitz Peak:</span>
                        <span className="font-bold text-orange-400">
                          {comparisonMetrics.player2.peak_ratings?.blitz || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Bullet Peak:</span>
                        <span className="font-bold text-orange-400">
                          {comparisonMetrics.player2.peak_ratings?.bullet || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Activity Comparison */}
                <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <Activity className="w-6 h-6 text-green-400" />
                    Activity & Engagement
                  </h3>
                  <div className="grid md:grid-cols-2 gap-8">
                    {comparisonMetrics.activityComparison.map((metric) => (
                      <div key={metric.metric} className="space-y-4">
                        <h4 className="font-medium text-gray-300">{metric.metric}</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">{comparisonMetrics.player1.username}:</span>
                            <span className="font-bold text-blue-400">
                              {metric.player1.toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ 
                                width: `${(metric.player1 / Math.max(metric.player1, metric.player2, 1)) * 100}%` 
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">{comparisonMetrics.player2.username}:</span>
                            <span className="font-bold text-green-400">
                              {metric.player2.toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full"
                              style={{ 
                                width: `${(metric.player2 / Math.max(metric.player1, metric.player2, 1)) * 100}%` 
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Head-to-Head Tab */}
            {comparisonView === 'head2head' && (
              <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <Swords className="w-6 h-6 text-red-400" />
                  Head-to-Head Analysis
                </h3>
                <div className="text-center py-12">
                  <Swords className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <h4 className="text-lg font-medium mb-2">Head-to-Head Data</h4>
                  <p className="text-gray-400 mb-4">
                    Direct match history between {comparisonMetrics.player1.username} and {comparisonMetrics.player2.username}
                  </p>
                  <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-yellow-300 text-sm">
                      Head-to-head game data is currently being processed. This feature will show detailed match history, 
                      including recent games, opening preferences, and win/loss records between these players.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* No Comparison Message */}
        {!comparisonMetrics && (!loading1 && !loading2) && (
          <div className="text-center py-16">
            <div className="flex items-center justify-center gap-4 mb-6 opacity-50">
              <User className="w-16 h-16" />
              <ArrowUpDown className="w-12 h-12" />
              <User className="w-16 h-16" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Ready to Compare</h3>
            <p className="text-gray-400">
              Enter usernames for both players above to see detailed comparisons, statistics, and head-to-head analysis
            </p>
          </div>
        )}
      </div>
    </div>
  );
}