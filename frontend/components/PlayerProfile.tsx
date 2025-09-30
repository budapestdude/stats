'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trophy, Target, TrendingUp, Award, Users, BookOpen, Calendar, Zap, Shield, Swords } from 'lucide-react';
import { OpponentStats } from '@/components/OpponentStats';

interface PlayerProfileProps {
  playerName: string;
  playerSlug: string;
  playerTitle?: string;
}

export default function PlayerProfile({ playerName, playerSlug, playerTitle }: PlayerProfileProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<string>('overview');

  useEffect(() => {
    fetchPlayerData();
  }, [playerSlug]);

  const fetchPlayerData = async () => {
    try {
      const response = await fetch(`http://localhost:3007/api/players/${playerSlug}/stats`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch player data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading {playerName} statistics...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p className="text-center text-gray-600">Failed to load player data</p>
      </div>
    );
  }

  const COLORS = ['#10B981', '#F59E0B', '#EF4444'];
  
  // Prepare data for charts
  const yearlyData = Object.entries(data.yearlyStats || {}).map(([year, stats]: [string, any]) => ({
    year: parseInt(year),
    games: stats.games,
    winRate: parseFloat(stats.winRate || 0),
    avgOpponentRating: stats.avgOpponentRating || 0
  })).sort((a, b) => a.year - b.year);

  const resultsPieData = [
    { name: 'Wins', value: data.overview?.wins || 0 },
    { name: 'Draws', value: data.overview?.draws || 0 },
    { name: 'Losses', value: data.overview?.losses || 0 }
  ];

  const performanceByColor = [
    { 
      name: 'White', 
      games: data.byColor?.white?.games || 0,
      winRate: parseFloat(data.byColor?.white?.winRate || 0),
      performance: parseFloat(data.byColor?.white?.performanceScore || 0)
    },
    { 
      name: 'Black', 
      games: data.byColor?.black?.games || 0,
      winRate: parseFloat(data.byColor?.black?.winRate || 0),
      performance: parseFloat(data.byColor?.black?.performanceScore || 0)
    }
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Trophy },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'openings', label: 'Openings', icon: BookOpen },
    { id: 'opponents', label: 'Opponents', icon: Users },
    { id: 'achievements', label: 'Achievements', icon: Award }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{playerName}</h1>
              {playerTitle && <p className="text-gray-600 mt-1">{playerTitle}</p>}
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{data.overview?.totalGames || 0}</p>
                <p className="text-sm text-gray-600">Total Games</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{data.overview?.winRate || 0}%</p>
                <p className="text-sm text-gray-600">Win Rate</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600">{data.peakRating || 'N/A'}</p>
                <p className="text-sm text-gray-600">Peak Rating</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                    selectedTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Overview Tab */}
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Performance</p>
                    <p className="text-2xl font-bold">{data.overview?.performanceScore || 0}%</p>
                  </div>
                  <Trophy className="w-8 h-8 text-yellow-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Decisive Games</p>
                    <p className="text-2xl font-bold">{data.overview?.decisiveGameRate || 0}%</p>
                  </div>
                  <Swords className="w-8 h-8 text-red-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Win Streak</p>
                    <p className="text-2xl font-bold">{data.streaks?.longestWinStreak || 0}</p>
                  </div>
                  <Zap className="w-8 h-8 text-orange-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Unbeaten Streak</p>
                    <p className="text-2xl font-bold">{data.streaks?.longestUnbeatenStreak || 0}</p>
                  </div>
                  <Shield className="w-8 h-8 text-green-500" />
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Results Distribution */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Results Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={resultsPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({name, value, percent}) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {resultsPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Performance by Color */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Performance by Color</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={performanceByColor}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="winRate" fill="#3B82F6" name="Win Rate %" />
                    <Bar dataKey="performance" fill="#10B981" name="Performance %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Career Timeline */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4">Career Timeline</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="winRate" stroke="#3B82F6" name="Win Rate %" />
                  <Line yAxisId="right" type="monotone" dataKey="games" stroke="#10B981" name="Games Played" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {selectedTab === 'performance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Rating Categories */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Performance by Opponent Rating</h3>
                <div className="space-y-3">
                  {data.opponentRatings?.map((category: any) => (
                    <div key={category.category} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{category.category}</p>
                        <p className="text-sm text-gray-600">{category.games} games</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{category.performanceScore}%</p>
                        <p className="text-xs text-gray-600">
                          +{category.wins} ={category.draws} -{category.losses}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time Controls */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Performance by Time Control</h3>
                <div className="space-y-3">
                  {Object.entries(data.timeControlCategories || {}).map(([tc, stats]: [string, any]) => (
                    <div key={tc} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium capitalize">{tc}</p>
                        <p className="text-sm text-gray-600">{stats.games} games</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">
                          {stats.games > 0 ? ((stats.wins / stats.games) * 100).toFixed(1) : 0}%
                        </p>
                        <p className="text-xs text-gray-600">
                          +{stats.wins} ={stats.draws} -{stats.losses}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Yearly Performance Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4">Yearly Performance</h3>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="games" stackId="1" stroke="#10B981" fill="#10B981" name="Games" />
                  <Area type="monotone" dataKey="winRate" stackId="2" stroke="#3B82F6" fill="#3B82F6" name="Win Rate %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Openings Tab */}
        {selectedTab === 'openings' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* White Repertoire */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">White Repertoire</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {data.openingStats?.asWhite?.map((opening: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="text-sm font-medium truncate">{opening.opening}</p>
                        <p className="text-xs text-gray-600">{opening.games} games</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{opening.winRate}%</p>
                        <p className="text-xs text-gray-600">Win Rate</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Black Repertoire */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Black Repertoire</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {data.openingStats?.asBlack?.map((opening: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="text-sm font-medium truncate">{opening.opening}</p>
                        <p className="text-xs text-gray-600">{opening.games} games</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{opening.winRate}%</p>
                        <p className="text-xs text-gray-600">Win Rate</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Opponents Tab */}
        {selectedTab === 'opponents' && (
          <div className="space-y-6">
            <OpponentStats 
              opponents={data.opponentStatsDetailed || data.opponentsDetailed}
              simpleOpponents={data.topOpponents || data.opponentStats}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">vs Elite (2750+)</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Games</span>
                    <span className="font-bold">{data.vsElite?.vsTop10?.games || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Wins</span>
                    <span className="font-bold text-green-600">{data.vsElite?.vsTop10?.wins || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Draws</span>
                    <span className="font-bold text-gray-600">{data.vsElite?.vsTop10?.draws || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Losses</span>
                    <span className="font-bold text-red-600">{data.vsElite?.vsTop10?.losses || 0}</span>
                  </div>
                  <div className="flex justify-between border-t pt-3">
                    <span>Performance</span>
                    <span className="font-bold">
                      {data.vsElite?.vsTop10?.games > 0 
                        ? (((data.vsElite.vsTop10.wins + data.vsElite.vsTop10.draws * 0.5) / data.vsElite.vsTop10.games) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">vs Strong (2700+)</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Games</span>
                    <span className="font-bold">{data.vsElite?.vsTop50?.games || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Wins</span>
                    <span className="font-bold text-green-600">{data.vsElite?.vsTop50?.wins || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Draws</span>
                    <span className="font-bold text-gray-600">{data.vsElite?.vsTop50?.draws || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Losses</span>
                    <span className="font-bold text-red-600">{data.vsElite?.vsTop50?.losses || 0}</span>
                  </div>
                  <div className="flex justify-between border-t pt-3">
                    <span>Performance</span>
                    <span className="font-bold">
                      {data.vsElite?.vsTop50?.games > 0 
                        ? (((data.vsElite.vsTop50.wins + data.vsElite.vsTop50.draws * 0.5) / data.vsElite.vsTop50.games) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Achievements Tab */}
        {selectedTab === 'achievements' && (
          <div className="space-y-6">
            {/* Notable Victories */}
            {data.notableVictories && data.notableVictories.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Notable Victories (2700+ opponents)</h3>
                <div className="space-y-2">
                  {data.notableVictories.slice(0, 20).map((victory: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{victory.opponent} ({victory.rating})</p>
                        <p className="text-sm text-gray-600">{victory.event} • {victory.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">Victory</p>
                        <p className="text-xs text-gray-600">{victory.opening}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Perfect Events */}
            {data.perfectEvents && data.perfectEvents.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Perfect Events (No Losses)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.perfectEvents.map((event: any, idx: number) => (
                    <div key={idx} className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
                      <p className="font-medium">{event.event}</p>
                      <p className="text-sm text-gray-600 mt-1">{event.score} • {event.year}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Career Milestones */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4">Career Milestones</h3>
              <div className="space-y-4">
                {data.firstGame && (
                  <div className="flex items-center gap-4">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium">First Game</p>
                      <p className="text-sm text-gray-600">
                        {data.firstGame.date} • vs {data.firstGame.opponent} • {data.firstGame.event}
                      </p>
                    </div>
                  </div>
                )}
                {data.lastGame && (
                  <div className="flex items-center gap-4">
                    <Calendar className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">Latest Game</p>
                      <p className="text-sm text-gray-600">
                        {data.lastGame.date} • vs {data.lastGame.opponent} • {data.lastGame.event}
                      </p>
                    </div>
                  </div>
                )}
                {data.peakRating && data.peakRating !== 'N/A' && (
                  <div className="flex items-center gap-4">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    <div>
                      <p className="font-medium">Peak Rating</p>
                      <p className="text-sm text-gray-600">
                        {data.peakRating} • Achieved in {data.peakRatingEvent || 'N/A'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}