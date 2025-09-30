'use client';

import { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';

interface TournamentAnalyticsProps {
  tournamentName: string;
}

export default function TournamentAnalytics({ tournamentName }: TournamentAnalyticsProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `http://localhost:3010/api/analytics/tournament/${encodeURIComponent(tournamentName)}`
        );
        const data = await response.json();
        
        if (data.success) {
          setAnalytics(data.analytics);
        }
      } catch (err) {
        console.error('Failed to fetch tournament analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    if (tournamentName) {
      fetchAnalytics();
    }
  }, [tournamentName]);

  if (loading || !analytics) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  const resultsDistribution = {
    labels: ['Decisive Games', 'Draws'],
    datasets: [{
      data: [
        analytics.overview.decisiveGames,
        analytics.overview.totalGames - analytics.overview.decisiveGames,
      ],
      backgroundColor: ['#3b82f6', '#e5e7eb'],
    }],
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-6">Tournament Analytics: {tournamentName}</h3>
        
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">Total Games</p>
            <p className="text-2xl font-bold">{analytics.overview.totalGames}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">Players</p>
            <p className="text-2xl font-bold text-blue-900">{analytics.overview.totalPlayers}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">Draw Rate</p>
            <p className="text-2xl font-bold text-green-900">{analytics.overview.drawRate}%</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">Avg Length</p>
            <p className="text-2xl font-bold text-purple-900">
              {Math.round(analytics.overview.averageGameLength)} moves
            </p>
          </div>
        </div>

        {/* Results Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h4 className="text-lg font-medium mb-4">Results Distribution</h4>
            <div className="h-64">
              <Doughnut data={resultsDistribution} options={{ maintainAspectRatio: false }} />
            </div>
          </div>
          
          {/* Top Performers */}
          <div>
            <h4 className="text-lg font-medium mb-4">Top Performers</h4>
            <div className="space-y-2">
              {analytics.topPerformers.topScorers.slice(0, 5).map((player: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="font-medium">{index + 1}. {player.player}</span>
                  <span className="text-sm">
                    {player.score} pts ({player.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Standings Table */}
        <div>
          <h4 className="text-lg font-medium mb-4">Final Standings</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Games</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">W</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">D</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">L</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">%</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.standings.slice(0, 10).map((player: any, index: number) => (
                  <tr key={index}>
                    <td className="px-4 py-2 text-sm">{index + 1}</td>
                    <td className="px-4 py-2 text-sm font-medium">{player.player}</td>
                    <td className="px-4 py-2 text-sm">{player.games}</td>
                    <td className="px-4 py-2 text-sm">{player.wins}</td>
                    <td className="px-4 py-2 text-sm">{player.draws}</td>
                    <td className="px-4 py-2 text-sm">{player.losses}</td>
                    <td className="px-4 py-2 text-sm font-medium">{player.score}</td>
                    <td className="px-4 py-2 text-sm">{player.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}