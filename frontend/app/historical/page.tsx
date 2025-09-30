'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp, Award, Users, BookOpen, Activity, Database, AlertCircle } from 'lucide-react';

export default function HistoricalAnalysis() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDecade, setSelectedDecade] = useState<string>('2020s');
  const [selectedTab, setSelectedTab] = useState<'overview' | 'decades' | 'evolution' | 'openings'>('overview');

  useEffect(() => {
    fetchHistoricalData();
  }, []);

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch('http://localhost:3005/api/historical/stats');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch historical data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Analyzing historical chess data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load historical data</p>
        </div>
      </div>
    );
  }

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  const decades = Object.keys(data.decades || {}).filter(d => d.includes('0s')).sort();

  const decadeChartData = decades.map(decade => ({
    decade,
    games: data.decades[decade].games,
    whiteWinRate: parseFloat(data.decades[decade].whiteWinRate || 0),
    drawRate: parseFloat(data.decades[decade].drawRate || 0),
    blackWinRate: parseFloat(data.decades[decade].blackWinRate || 0)
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Historical Chess Analysis</h1>
            <p className="mt-2 text-gray-600">
              Analyzing {data.overview.totalGames.toLocaleString()} games from {data.overview.dateRange.earliest} to {data.overview.dateRange.latest}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-6">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'decades', label: 'Decades', icon: Calendar },
              { id: 'evolution', label: 'Evolution', icon: TrendingUp },
              { id: 'openings', label: 'Openings', icon: BookOpen }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
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
            {/* Database Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Database Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.overview.databases.map((db: any) => (
                  <div key={db.name} className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 text-sm">{db.name}</h3>
                    <p className="text-2xl font-bold text-blue-600 mt-2">{db.games.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">games</p>
                    {db.dateRange.earliest && db.dateRange.latest && (
                      <p className="text-sm text-gray-600 mt-2">
                        {db.dateRange.earliest} - {db.dateRange.latest}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Statistics */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Summary Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Databases</p>
                  <p className="text-2xl font-bold text-blue-600">{data.summary?.totalDatabases || data.overview.databases.length}</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Years Spanned</p>
                  <p className="text-2xl font-bold text-green-600">{data.summary?.yearsSpanned || 'N/A'}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Avg Game Length</p>
                  <p className="text-2xl font-bold text-purple-600">{data.avgGameLength || 'N/A'} moves</p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Avg Games/Year</p>
                  <p className="text-2xl font-bold text-amber-600">{data.summary?.averageGamesPerYear?.toLocaleString() || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Overall Results */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Overall Results Distribution</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">{data.results?.whiteWinRate || '0'}%</p>
                  <p className="text-sm text-gray-600">White Wins</p>
                  <p className="text-xs text-gray-500">{data.results?.whiteWins?.toLocaleString() || '0'} games</p>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-lg">
                  <p className="text-3xl font-bold text-amber-600">{data.results?.drawRate || '0'}%</p>
                  <p className="text-sm text-gray-600">Draws</p>
                  <p className="text-xs text-gray-500">{data.results?.draws?.toLocaleString() || '0'} games</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold text-gray-700">{data.results?.blackWinRate || '0'}%</p>
                  <p className="text-sm text-gray-600">Black Wins</p>
                  <p className="text-xs text-gray-500">{data.results?.blackWins?.toLocaleString() || '0'} games</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Decades Tab */}
        {selectedTab === 'decades' && (
          <div className="space-y-6">
            {/* Decade Comparison Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Decade Comparison</h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={decadeChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="decade" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="whiteWinRate" name="White Win %" fill="#10B981" />
                  <Bar dataKey="drawRate" name="Draw %" fill="#F59E0B" />
                  <Bar dataKey="blackWinRate" name="Black Win %" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Decade Details */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Decade Details</h2>
                <select
                  value={selectedDecade}
                  onChange={(e) => setSelectedDecade(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {decades.map(decade => (
                    <option key={decade} value={decade}>{decade}</option>
                  ))}
                </select>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Games</p>
                    <p className="text-xl font-bold">{data.decades[selectedDecade]?.games?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">White Win Rate</p>
                    <p className="text-xl font-bold">{data.decades[selectedDecade]?.whiteWinRate || 'N/A'}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Draw Rate</p>
                    <p className="text-xl font-bold">{data.decades[selectedDecade]?.drawRate || 'N/A'}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Black Win Rate</p>
                    <p className="text-xl font-bold">{data.decades[selectedDecade]?.blackWinRate || 'N/A'}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Evolution Tab */}
        {selectedTab === 'evolution' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Chess Growth Over Time</h2>
              <p className="text-sm text-gray-600 mb-4">
                Showing games per year from {data.overview.dateRange.earliest} to {data.overview.dateRange.latest}
              </p>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={data.yearlyEvolution?.filter((d: any) => d.year >= 1970 && d.year <= 2025) || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="games"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.3}
                    name="Games per Year"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Openings Tab */}
        {selectedTab === 'openings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Top Openings</h2>
              <div className="space-y-2">
                {data.topOpenings?.map((opening: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-gray-500">#{idx + 1}</span>
                      <span className="font-medium">{opening.eco}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{opening.count.toLocaleString()} games</p>
                      <p className="text-sm text-gray-500">{opening.percentage}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}