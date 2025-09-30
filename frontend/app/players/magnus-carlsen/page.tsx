'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trophy, Target, TrendingUp, Award, Users, BookOpen, Calendar, Zap, Shield, Swords } from 'lucide-react';
import { OpponentStats } from '@/components/OpponentStats';

export default function MagnusCarlsenProfile() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<string>('overview');

  useEffect(() => {
    fetchPlayerData();
  }, []);

  const fetchPlayerData = async () => {
    try {
      const response = await fetch('http://localhost:3007/api/players/magnus-carlsen/stats');
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
          <p className="mt-4 text-gray-600">Loading Magnus Carlsen statistics...</p>
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

  // Prepare chart data
  const yearlyData = Object.entries(data.yearlyStats || {})
    .map(([year, stats]: [string, any]) => ({
      year: parseInt(year),
      games: stats.games,
      winRate: parseFloat(((stats.wins / stats.games) * 100).toFixed(1)),
      performanceScore: parseFloat(stats.performanceScore),
      avgOpponentRating: stats.avgOpponentRating
    }))
    .filter(d => d.year >= 2000)
    .sort((a, b) => a.year - b.year);

  const resultsPieData = [
    { name: 'Wins', value: data.overview.wins, color: '#10B981' },
    { name: 'Draws', value: data.overview.draws, color: '#F59E0B' },
    { name: 'Losses', value: data.overview.losses, color: '#EF4444' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold">Magnus Carlsen</h1>
              <p className="mt-2 text-blue-100">
                {data.overview.totalGames.toLocaleString()} OTB games analyzed • 
                Peak Rating: {data.peakRating?.rating || 'N/A'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{data.overview.performanceScore}%</div>
              <div className="text-sm text-blue-100">Performance Score</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-6 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: Trophy },
              { id: 'yearly', label: 'Yearly Progress', icon: TrendingUp },
              { id: 'openings', label: 'Openings', icon: BookOpen },
              { id: 'opponents', label: 'Opponents', icon: Users },
              { id: 'achievements', label: 'Achievements', icon: Award }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition whitespace-nowrap ${
                  selectedTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Overview Tab */}
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <Trophy className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-gray-500">Win Rate</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{data.overview.winRate}%</p>
                <p className="text-sm text-gray-600 mt-1">
                  {data.overview.wins.toLocaleString()} wins
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <Shield className="w-5 h-5 text-amber-600" />
                  <span className="text-sm text-gray-500">Draw Rate</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{data.overview.drawRate}%</p>
                <p className="text-sm text-gray-600 mt-1">
                  {data.overview.draws.toLocaleString()} draws
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  <span className="text-sm text-gray-500">Decisive Games</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{data.overview.decisiveGameRate}%</p>
                <p className="text-sm text-gray-600 mt-1">
                  {(data.overview.wins + data.overview.losses).toLocaleString()} decisive
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <Award className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-gray-500">Peak Rating</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{data.peakRating?.rating || 'N/A'}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {data.peakRating?.date || 'N/A'}
                </p>
              </div>
            </div>

            {/* Results Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Results Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={resultsPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: any) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {resultsPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Color Performance</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">As White</span>
                      <span className="text-sm text-gray-500">{data.byColor.white.games} games</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {data.byColor.white.performanceScore}%
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Win rate: {data.byColor.white.winRate}%
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">As Black</span>
                      <span className="text-sm text-gray-500">{data.byColor.black.games} games</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      {data.byColor.black.performanceScore}%
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Win rate: {data.byColor.black.winRate}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance vs Rating Categories */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4">Performance by Opponent Rating</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.opponentRatings}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="performanceScore" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Yearly Progress Tab */}
        {selectedTab === 'yearly' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4">Games Per Year</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="games" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4">Performance Score Evolution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis domain={[40, 80]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="performanceScore" stroke="#10B981" strokeWidth={2} name="Performance Score" />
                  <Line type="monotone" dataKey="winRate" stroke="#F59E0B" strokeWidth={2} name="Win Rate" />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4">Average Opponent Rating</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={yearlyData.filter(d => d.avgOpponentRating > 0)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis domain={[1800, 2800]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgOpponentRating" stroke="#8B5CF6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Openings Tab */}
        {selectedTab === 'openings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4">Opening Repertoire as White</h3>
              <div className="space-y-2">
                {data.openings?.asWhite?.slice(0, 10).map((opening: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <span className="font-medium">{opening.opening}</span>
                      <span className="text-sm text-gray-500 ml-2">({opening.games} games)</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-sm">Win: {opening.winRate}%</span>
                      <span className="font-bold text-green-600">Score: {opening.performanceScore}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4">Opening Repertoire as Black</h3>
              <div className="space-y-2">
                {data.openings?.asBlack?.slice(0, 10).map((opening: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <span className="font-medium">{opening.opening}</span>
                      <span className="text-sm text-gray-500 ml-2">({opening.games} games)</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-sm">Win: {opening.winRate}%</span>
                      <span className="font-bold text-blue-600">Score: {opening.performanceScore}%</span>
                    </div>
                  </div>
                ))}
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
                    <span className="font-bold text-amber-600">{data.vsElite?.vsTop10?.draws || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Losses</span>
                    <span className="font-bold text-red-600">{data.vsElite?.vsTop10?.losses || 0}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">vs Top 50 (2700+)</h3>
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
                    <span className="font-bold text-amber-600">{data.vsElite?.vsTop50?.draws || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Losses</span>
                    <span className="font-bold text-red-600">{data.vsElite?.vsTop50?.losses || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Achievements Tab */}
        {selectedTab === 'achievements' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-6">
                <Zap className="w-8 h-8 text-yellow-600 mb-2" />
                <h3 className="font-bold text-lg mb-1">Longest Win Streak</h3>
                <p className="text-3xl font-bold text-yellow-600">{data.streaks?.longestWinStreak || 0}</p>
                <p className="text-sm text-gray-600">consecutive wins</p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6">
                <Shield className="w-8 h-8 text-blue-600 mb-2" />
                <h3 className="font-bold text-lg mb-1">Longest Unbeaten</h3>
                <p className="text-3xl font-bold text-blue-600">{data.streaks?.longestUnbeatenStreak || 0}</p>
                <p className="text-sm text-gray-600">games without loss</p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6">
                <Trophy className="w-8 h-8 text-purple-600 mb-2" />
                <h3 className="font-bold text-lg mb-1">Peak Rating</h3>
                <p className="text-3xl font-bold text-purple-600">{data.peakRating?.rating || 'N/A'}</p>
                <p className="text-sm text-gray-600">{data.peakRating?.date || 'N/A'}</p>
              </div>
            </div>

            {/* Notable Victories */}
            {data.notableVictories && data.notableVictories.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold mb-4">Notable Victories (2700+ opponents)</h3>
                <div className="space-y-2">
                  {data.notableVictories.slice(0, 10).map((victory: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded">
                      <div>
                        <span className="font-medium">{victory.opponent}</span>
                        <span className="text-sm text-gray-500 ml-2">({victory.rating})</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {victory.event} • {victory.date}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Career Milestones */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold mb-4">Career Timeline</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-green-600 mt-2"></div>
                  <div>
                    <p className="font-medium">First Game</p>
                    <p className="text-sm text-gray-600">
                      {data.career?.firstGame?.date} vs {data.career?.firstGame?.opponent}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-purple-600 mt-2"></div>
                  <div>
                    <p className="font-medium">Peak Rating</p>
                    <p className="text-sm text-gray-600">
                      {data.peakRating?.rating} on {data.peakRating?.date}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-2"></div>
                  <div>
                    <p className="font-medium">Latest Game</p>
                    <p className="text-sm text-gray-600">
                      {data.career?.lastGame?.date} vs {data.career?.lastGame?.opponent}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}