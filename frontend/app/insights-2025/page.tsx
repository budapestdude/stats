'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, Users, Target, Award, Activity, Calendar, 
  ChevronUp, ChevronDown, Trophy, Zap, BarChart3, PieChart 
} from 'lucide-react';

interface AdvancedStats {
  overview: {
    totalGames: number;
    year2025Games: number;
    percentageFrom2025: string;
  };
  results: {
    whiteWins: number;
    blackWins: number;
    draws: number;
    whiteWinRate: string;
    drawRate: string;
    blackWinRate: string;
  };
  decisiveGames: {
    total: number;
    percentage: string;
  };
  eloBrackets: Record<string, any>;
  gameLengths: {
    veryShort: number;
    short: number;
    medium: number;
    long: number;
    veryLong: number;
    averageMoves: number;
  };
  topOpenings: Array<{
    opening: string;
    count: number;
    percentage: string;
  }>;
  topPlayers: Array<{
    name: string;
    games: number;
    wins: number;
    draws: number;
    losses: number;
    avgRating: number;
    winRate: string;
    performance: string;
  }>;
  topEvents: Array<{
    name: string;
    games: number;
    avgElo: number;
    drawRate: string;
  }>;
  firstMoves: Array<{
    move: string;
    count: number;
    percentage: string;
  }>;
  monthlyTrends: Array<{
    month: string;
    games: number;
    whiteWinRate: string;
    drawRate: string;
    blackWinRate: string;
    avgElo: number;
  }>;
  upsets: {
    total: number;
    biggestUpset: any;
  };
  modernInsights: {
    mostPopularOpening: any;
    mostActivePlayer: any;
    biggestEvent: any;
    dominantFirstMove: any;
    averageGameLength: number;
    decisiveGameRate: string;
  };
}

export default function Insights2025Page() {
  const [stats, setStats] = useState<AdvancedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'overview' | 'openings' | 'players' | 'trends'>('overview');

  useEffect(() => {
    fetchAdvancedStats();
  }, []);

  const fetchAdvancedStats = async () => {
    try {
      const response = await fetch('http://localhost:3005/api/otb/advanced-stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching advanced stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent mx-auto mb-4" />
          <p className="text-lg text-gray-600">Analyzing 105,600+ games from 2025...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-lg text-gray-600">Failed to load statistics</p>
      </div>
    );
  }

  const getEloBracketColor = (bracket: string) => {
    const colors: Record<string, string> = {
      'sub2000': 'bg-gray-500',
      '2000-2200': 'bg-blue-500',
      '2200-2400': 'bg-green-500',
      '2400-2600': 'bg-yellow-500',
      '2600-2700': 'bg-orange-500',
      '2700+': 'bg-red-500'
    };
    return colors[bracket] || 'bg-gray-400';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold mb-4">2025 Chess Insights</h1>
          <p className="text-xl opacity-90 mb-8">
            Advanced analytics from {stats.overview.totalGames.toLocaleString()} tournament games
          </p>
          
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <Activity className="w-8 h-8" />
                <span className="text-3xl font-bold">{stats.decisiveGames.percentage}%</span>
              </div>
              <div className="text-sm">Decisive Games</div>
              <div className="text-xs opacity-75 mt-1">
                {stats.decisiveGames.total.toLocaleString()} decisive results
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8" />
                <span className="text-3xl font-bold">{stats.results.whiteWinRate}%</span>
              </div>
              <div className="text-sm">White Win Rate</div>
              <div className="text-xs opacity-75 mt-1">
                {stats.results.whiteWins.toLocaleString()} white victories
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <Target className="w-8 h-8" />
                <span className="text-3xl font-bold">{stats.gameLengths.averageMoves}</span>
              </div>
              <div className="text-sm">Avg Game Length</div>
              <div className="text-xs opacity-75 mt-1">moves per game</div>
            </div>
            
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <Zap className="w-8 h-8" />
                <span className="text-3xl font-bold">{stats.upsets.total}</span>
              </div>
              <div className="text-sm">Major Upsets</div>
              <div className="text-xs opacity-75 mt-1">200+ rating difference</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <div className="flex gap-8">
            {(['overview', 'openings', 'players', 'trends'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setSelectedView(view)}
                className={`py-4 px-6 border-b-2 transition capitalize ${
                  selectedView === view
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Overview Tab */}
        {selectedView === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Result Distribution */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <PieChart className="w-6 h-6 text-indigo-600" />
                Result Distribution in 2025
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>White Wins</span>
                    <span className="font-semibold">{stats.results.whiteWinRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-green-500 h-3 rounded-full"
                      style={{ width: `${stats.results.whiteWinRate}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Draws</span>
                    <span className="font-semibold">{stats.results.drawRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gray-500 h-3 rounded-full"
                      style={{ width: `${stats.results.drawRate}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Black Wins</span>
                    <span className="font-semibold">{stats.results.blackWinRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-red-500 h-3 rounded-full"
                      style={{ width: `${stats.results.blackWinRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Game Length Distribution */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-purple-600" />
                Game Length Distribution
              </h2>
              <div className="space-y-3">
                {[
                  { label: 'Very Short (<20)', value: stats.gameLengths.veryShort, color: 'bg-red-500' },
                  { label: 'Short (20-40)', value: stats.gameLengths.short, color: 'bg-orange-500' },
                  { label: 'Medium (40-60)', value: stats.gameLengths.medium, color: 'bg-yellow-500' },
                  { label: 'Long (60-80)', value: stats.gameLengths.long, color: 'bg-green-500' },
                  { label: 'Very Long (80+)', value: stats.gameLengths.veryLong, color: 'bg-blue-500' }
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="w-32 text-sm">{item.label}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                      <div 
                        className={`${item.color} h-6 rounded-full flex items-center justify-end pr-2`}
                        style={{ width: `${(item.value / stats.overview.totalGames * 100).toFixed(1)}%` }}
                      >
                        <span className="text-xs text-white font-semibold">{item.value.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ELO Bracket Performance */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-600" />
                Performance by Rating
              </h2>
              <div className="space-y-4">
                {Object.entries(stats.eloBrackets).map(([bracket, data]) => {
                  const total = data.games;
                  if (total === 0) return null;
                  const whiteWinRate = ((data.whiteWins / total) * 100).toFixed(1);
                  const drawRate = ((data.draws / total) * 100).toFixed(1);
                  const blackWinRate = ((data.blackWins / total) * 100).toFixed(1);
                  
                  return (
                    <div key={bracket} className="border rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold">{bracket}</span>
                        <span className="text-sm text-gray-600">{total} games</span>
                      </div>
                      <div className="flex gap-1 text-xs">
                        <div 
                          className="bg-green-500 text-white px-2 py-1 rounded"
                          style={{ width: `${whiteWinRate}%` }}
                        >
                          W: {whiteWinRate}%
                        </div>
                        <div 
                          className="bg-gray-500 text-white px-2 py-1 rounded"
                          style={{ width: `${drawRate}%` }}
                        >
                          D: {drawRate}%
                        </div>
                        <div 
                          className="bg-red-500 text-white px-2 py-1 rounded"
                          style={{ width: `${blackWinRate}%` }}
                        >
                          B: {blackWinRate}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* First Move Preferences */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <Activity className="w-6 h-6 text-green-600" />
                First Move Choices in 2025
              </h2>
              <div className="space-y-3">
                {stats.firstMoves.slice(0, 8).map((move, index) => (
                  <div key={move.move} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                      <span className="font-mono font-semibold text-lg">{move.move}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{move.percentage}%</div>
                      <div className="text-xs text-gray-500">{move.count.toLocaleString()} games</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Openings Tab */}
        {selectedView === 'openings' && (
          <div>
            <h2 className="text-3xl font-semibold mb-8">Trending Openings in 2025</h2>
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Opening</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Games</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">Popularity</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.topOpenings.map((opening, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold">{opening.opening}</div>
                      </td>
                      <td className="px-6 py-4 text-right">{opening.count.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                          {opening.percentage}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {index < 5 ? (
                          <ChevronUp className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-red-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Players Tab */}
        {selectedView === 'players' && (
          <div>
            <h2 className="text-3xl font-semibold mb-8">Most Active Players in 2025</h2>
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">Games</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">Performance</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">Avg Rating</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">W/D/L</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.topPlayers.map((player, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold">{player.name}</div>
                      </td>
                      <td className="px-6 py-4 text-center">{player.games}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm ${
                          parseFloat(player.winRate) > 50 
                            ? 'bg-green-100 text-green-800' 
                            : parseFloat(player.winRate) > 40
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {player.winRate}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-semibold">{player.performance}%</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {player.avgRating || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-center text-sm">
                        {player.wins}/{player.draws}/{player.losses}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Trends Tab */}
        {selectedView === 'trends' && (
          <div className="space-y-8">
            <h2 className="text-3xl font-semibold">2025 Monthly Trends</h2>
            
            {/* Monthly Game Activity */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-6">Monthly Activity</h3>
              <div className="space-y-4">
                {stats.monthlyTrends.map((month) => (
                  <div key={month.month} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-semibold text-lg">{month.month}</span>
                      <span className="text-sm text-gray-600">{month.games.toLocaleString()} games</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">White Win: </span>
                        <span className="font-semibold text-green-600">{month.whiteWinRate}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Draw: </span>
                        <span className="font-semibold text-gray-600">{month.drawRate}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Black Win: </span>
                        <span className="font-semibold text-red-600">{month.blackWinRate}%</span>
                      </div>
                    </div>
                    {month.avgElo && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-600">Average ELO: </span>
                        <span className="font-semibold">{month.avgElo}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Biggest Upset */}
            {stats.upsets.biggestUpset && (
              <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl shadow-lg p-6 border border-red-200">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-6 h-6 text-red-600" />
                  Biggest Upset of 2025
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Winner</p>
                    <p className="font-semibold text-lg">{stats.upsets.biggestUpset.white}</p>
                    <p className="text-sm text-gray-500">Rating: {stats.upsets.biggestUpset.whiteElo}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Defeated</p>
                    <p className="font-semibold text-lg">{stats.upsets.biggestUpset.black}</p>
                    <p className="text-sm text-gray-500">Rating: {stats.upsets.biggestUpset.blackElo}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-red-200">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Rating Difference:</span> {stats.upsets.biggestUpset.ratingDiff} points
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Event:</span> {stats.upsets.biggestUpset.event}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Date:</span> {stats.upsets.biggestUpset.date}
                  </p>
                </div>
              </div>
            )}

            {/* Top Events */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-6">Major Tournaments in 2025</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {stats.topEvents.slice(0, 10).map((event, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold">{event.name}</div>
                        <div className="text-sm text-gray-600">{event.games} games</div>
                      </div>
                      <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Avg ELO: </span>
                        <span className="font-semibold">{event.avgElo || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Draw Rate: </span>
                        <span className="font-semibold">{event.drawRate}%</span>
                      </div>
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