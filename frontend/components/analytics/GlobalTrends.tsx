'use client';

import { useEffect, useState } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

export default function GlobalTrends() {
  const [trends, setTrends] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:3010/api/analytics/trends');
        const data = await response.json();
        
        if (data.success) {
          setTrends(data.trends);
        }
      } catch (err) {
        console.error('Failed to fetch trends:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrends();
  }, []);

  if (loading || !trends) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  const openingTrendsData = {
    labels: trends.openingTrends.mostPopular.map((o: any) => o.eco),
    datasets: [{
      label: 'Popularity %',
      data: trends.openingTrends.mostPopular.map((o: any) => o.frequency),
      backgroundColor: trends.openingTrends.mostPopular.map((o: any) => 
        o.trend === 'rising' ? '#10b981' : o.trend === 'falling' ? '#ef4444' : '#6b7280'
      ),
    }],
  };

  const gameResultsData = {
    labels: ['White Wins', 'Draws', 'Black Wins'],
    datasets: [{
      data: [
        trends.gameStatistics.whiteWinRate,
        trends.gameStatistics.drawRate,
        trends.gameStatistics.blackWinRate,
      ],
      backgroundColor: ['#f9fafb', '#6b7280', '#111827'],
      borderWidth: 2,
    }],
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-6">Global Chess Trends - {trends.period}</h3>
        
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">Total Games</p>
            <p className="text-2xl font-bold">{trends.playerActivity.totalGames.toLocaleString()}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">Active Players</p>
            <p className="text-2xl font-bold text-blue-900">{trends.playerActivity.activePlayers.toLocaleString()}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">Tournaments</p>
            <p className="text-2xl font-bold text-green-900">{trends.playerActivity.tournamentsCompleted}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">Avg Games/Player</p>
            <p className="text-2xl font-bold text-purple-900">{trends.playerActivity.averageGamesPerPlayer}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Opening Trends */}
          <div>
            <h4 className="text-lg font-medium mb-4">Most Popular Openings</h4>
            <div className="h-64">
              <Bar 
                data={openingTrendsData} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                  },
                }}
              />
            </div>
            <div className="mt-4 space-y-1">
              {trends.openingTrends.mostPopular.map((o: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{o.eco}: {o.name}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    o.trend === 'rising' ? 'bg-green-100 text-green-800' :
                    o.trend === 'falling' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {o.trend}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Game Results Distribution */}
          <div>
            <h4 className="text-lg font-medium mb-4">Game Results Distribution</h4>
            <div className="h-64">
              <Doughnut 
                data={gameResultsData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-50 p-2 rounded">
                <p className="text-gray-600">Decisive Games</p>
                <p className="font-semibold">{trends.gameStatistics.decisiveGameRate}%</p>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <p className="text-gray-600">Avg Length</p>
                <p className="font-semibold">{trends.gameStatistics.averageLength} moves</p>
              </div>
            </div>
          </div>
        </div>

        {/* Emerging Openings */}
        <div>
          <h4 className="text-lg font-medium mb-4">Emerging Openings</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {trends.openingTrends.emerging.map((opening: any, index: number) => (
              <div key={index} className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{opening.eco}</p>
                    <p className="text-sm text-gray-600">{opening.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">+{opening.growth}%</p>
                    <p className="text-xs text-gray-500">growth</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}