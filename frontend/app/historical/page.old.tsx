'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp, Award, Users, BookOpen, Cpu, Activity, Database, Clock, ChevronRight, AlertCircle, Target, Zap } from 'lucide-react';

interface HistoricalData {
  overview: any;
  decades: any;
  yearlyStats: any[];
  evolution: {
    drawRate: any[];
    gameLength: any[];
    averageElo: any[];
  };
  openingsByDecade: any;
  playersByDecade: any;
  openingTimelines: any[];
  engineEra: any;
  milestones: any[];
  insights: any[];
}

export default function HistoricalAnalysis() {
  const [data, setData] = useState<HistoricalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDecade, setSelectedDecade] = useState<string>('2020s');
  const [selectedMetric, setSelectedMetric] = useState<'drawRate' | 'gameLength' | 'averageElo'>('drawRate');
  const [selectedTab, setSelectedTab] = useState<'overview' | 'decades' | 'evolution' | 'openings' | 'insights'>('overview');

  useEffect(() => {
    fetchHistoricalData();
  }, []);

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch('http://localhost:3005/api/historical/stats');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new TypeError("Response was not JSON");
      }
      
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch historical data:', error);
      // Try to display the actual error
      if (error instanceof TypeError) {
        console.error('Server returned non-JSON response. Check if backend is running on port 3005.');
      }
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

  const decades = ['1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];

  const decadeChartData = decades.map(decade => ({
    decade,
    games: data.decades[decade].games,
    whiteWinRate: parseFloat(data.decades[decade].whiteWinRate || 0),
    drawRate: parseFloat(data.decades[decade].drawRate || 0),
    blackWinRate: parseFloat(data.decades[decade].blackWinRate || 0),
    avgElo: data.decades[decade].avgElo
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Historical Chess Analysis</h1>
              <p className="mt-2 text-gray-600">
                Analyzing {data.overview.totalGames.toLocaleString()} games from {data.overview.dateRange.earliest} to {data.overview.dateRange.latest}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {data.overview.dataQuality && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">Data Quality</p>
                  <p className="text-2xl font-bold text-green-600">{data.overview.dataQuality.completenessRate}</p>
                </div>
              )}
            </div>
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
              { id: 'openings', label: 'Openings', icon: BookOpen },
              { id: 'insights', label: 'Insights', icon: Zap }
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.overview.databases.map((db: any) => (
                  <div key={db.name} className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900">{db.name}</h3>
                    <p className="text-2xl font-bold text-blue-600 mt-2">{db.games.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">games</p>
                    {db.dateRange.earliest && db.dateRange.latest && (
                      <p className="text-sm text-gray-600 mt-2">
                        {db.dateRange.earliest} - {db.dateRange.latest}
                      </p>
                    )}
                    {db.avgElo > 0 && (
                      <p className="text-sm text-gray-600">Avg ELO: {db.avgElo}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Engine Era Comparison */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Engine Era Impact</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { era: 'Pre-Engine Era', key: 'preEngine', period: 'Before 2000', icon: Clock },
                  { era: 'Early Engine Era', key: 'earlyEngine', period: '2000-2010', icon: Cpu },
                  { era: 'Modern Engine Era', key: 'modernEngine', period: '2010+', icon: Zap }
                ].map(({ era, key, period, icon: Icon }) => (
                  <div key={key} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Icon className="w-5 h-5 text-blue-600" />
                      <div>
                        <h3 className="font-semibold">{era}</h3>
                        <p className="text-sm text-gray-500">{period}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {data.engineEra[key].games.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-500">games</p>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-sm text-gray-600">Draw Rate</span>
                        <span className="font-semibold">{data.engineEra[key].drawRate}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Avg Moves</span>
                        <span className="font-semibold">{data.engineEra[key].avgMoves}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Milestones */}
            {data.milestones && data.milestones.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">Historical Milestones</h2>
                <div className="space-y-3">
                  {data.milestones.map((milestone: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
                      <Award className="w-5 h-5 text-blue-600" />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{milestone.type}</p>
                        <p className="text-sm text-gray-600">{milestone.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600">{milestone.value}</p>
                        <p className="text-sm text-gray-500">Year {milestone.year}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

            {/* Decade Selector */}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Openings */}
                <div>
                  <h3 className="font-semibold mb-3">Top Openings</h3>
                  <div className="space-y-2">
                    {data.openingsByDecade[selectedDecade]?.slice(0, 10).map((opening: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{opening.eco}</span>
                        <span className="font-semibold">{opening.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Players */}
                <div>
                  <h3 className="font-semibold mb-3">Most Active Players</h3>
                  <div className="space-y-2">
                    {data.playersByDecade[selectedDecade]?.slice(0, 10).map((player: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm truncate">{player.name}</span>
                        <span className="font-semibold">{player.games} games</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Evolution Tab */}
        {selectedTab === 'evolution' && (
          <div className="space-y-6">
            {/* Metric Selector */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Chess Evolution Over Time</h2>
                <div className="flex gap-2">
                  {[
                    { key: 'drawRate', label: 'Draw Rate' },
                    { key: 'gameLength', label: 'Game Length' },
                    { key: 'averageElo', label: 'Average ELO' }
                  ].map(metric => (
                    <button
                      key={metric.key}
                      onClick={() => setSelectedMetric(metric.key as any)}
                      className={`px-4 py-2 rounded-lg transition ${
                        selectedMetric === metric.key
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {metric.label}
                    </button>
                  ))}
                </div>
              </div>

              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={data.evolution[selectedMetric]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey={selectedMetric === 'drawRate' ? 'rate' : selectedMetric === 'gameLength' ? 'avgMoves' : 'avgElo'}
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.3}
                    name={
                      selectedMetric === 'drawRate' ? 'Draw Rate (%)' :
                      selectedMetric === 'gameLength' ? 'Average Moves' :
                      'Average ELO'
                    }
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Yearly Statistics Table */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Yearly Statistics</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Year</th>
                      <th className="text-right py-2 px-4">Games</th>
                      <th className="text-right py-2 px-4">White Win %</th>
                      <th className="text-right py-2 px-4">Draw %</th>
                      <th className="text-right py-2 px-4">Black Win %</th>
                      <th className="text-right py-2 px-4">Avg ELO</th>
                      <th className="text-right py-2 px-4">Avg Moves</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.yearlyStats.slice(-10).reverse().map((year: any) => (
                      <tr key={year.year} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-4 font-semibold">{year.year}</td>
                        <td className="text-right py-2 px-4">{year.games.toLocaleString()}</td>
                        <td className="text-right py-2 px-4">
                          {((year.whiteWins / year.games) * 100).toFixed(1)}%
                        </td>
                        <td className="text-right py-2 px-4">
                          {((year.draws / year.games) * 100).toFixed(1)}%
                        </td>
                        <td className="text-right py-2 px-4">
                          {((year.blackWins / year.games) * 100).toFixed(1)}%
                        </td>
                        <td className="text-right py-2 px-4">{year.avgElo || '-'}</td>
                        <td className="text-right py-2 px-4">{year.avgMoves || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Openings Tab */}
        {selectedTab === 'openings' && (
          <div className="space-y-6">
            {/* Opening Evolution Timeline */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Opening Popularity Timeline</h2>
              <div className="space-y-4">
                {data.openingTimelines.slice(0, 10).map((opening: any) => (
                  <div key={opening.eco} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{opening.eco}</h3>
                      <span className="text-sm text-gray-500">
                        {opening.totalGames.toLocaleString()} total games
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={100}>
                      <AreaChart data={opening.timeline}>
                        <XAxis dataKey="year" hide />
                        <YAxis hide />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#3B82F6"
                          fill="#3B82F6"
                          fillOpacity={0.3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Insights Tab */}
        {selectedTab === 'insights' && (
          <div className="space-y-6">
            {/* Key Insights */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Key Historical Insights</h2>
              <div className="space-y-4">
                {data.insights.map((insight: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-l-4 ${
                      insight.significance === 'high'
                        ? 'bg-red-50 border-red-500'
                        : 'bg-blue-50 border-blue-500'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Target className={`w-5 h-5 mt-0.5 ${
                        insight.significance === 'high' ? 'text-red-600' : 'text-blue-600'
                      }`} />
                      <div>
                        <p className="font-semibold text-gray-900">{insight.category}</p>
                        <p className="text-gray-700 mt-1">{insight.finding}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Quality Report */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Data Quality Report</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Games with ELO', value: data.overview.dataQuality.gamesWithElo },
                  { label: 'Games with Date', value: data.overview.dataQuality.gamesWithDate },
                  { label: 'Games with Opening', value: data.overview.dataQuality.gamesWithOpening },
                  { label: 'Complete Games', value: data.overview.dataQuality.completeGames }
                ].map(stat => (
                  <div key={stat.label} className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {stat.value.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {((stat.value / data.overview.totalGames) * 100).toFixed(1)}%
                    </p>
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