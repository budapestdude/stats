'use client';

import { useEffect, useState } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface PlayerMetricsProps {
  playerName: string;
}

interface Metrics {
  totalGames: number;
  winRate: string;
  drawRate: string;
  lossRate: string;
  consistency: string;
  aggression: string;
  performanceRating: number;
  winStreak: { current: number; max: number };
  performanceByColor: {
    white: { wins: number; draws: number; losses: number };
    black: { wins: number; draws: number; losses: number };
  };
  topOpenings: Array<{
    name: string;
    games: number;
    winRate: string;
  }>;
}

export default function PlayerMetrics({ playerName }: PlayerMetricsProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `http://localhost:3010/api/analytics/player/${encodeURIComponent(playerName)}/metrics`
        );
        const data = await response.json();
        
        if (data.success) {
          setMetrics(data.metrics);
          setError(null);
        } else {
          setError(data.error || 'Failed to fetch metrics');
        }
      } catch (err) {
        setError('Failed to connect to analytics server');
      } finally {
        setLoading(false);
      }
    };

    if (playerName) {
      fetchMetrics();
    }
  }, [playerName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  // Prepare chart data
  const resultsChartData = {
    labels: ['Wins', 'Draws', 'Losses'],
    datasets: [
      {
        data: [
          parseFloat(metrics.winRate),
          parseFloat(metrics.drawRate),
          parseFloat(metrics.lossRate),
        ],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        borderWidth: 0,
      },
    ],
  };

  const colorPerformanceData = {
    labels: ['White Wins', 'White Draws', 'White Losses', 'Black Wins', 'Black Draws', 'Black Losses'],
    datasets: [
      {
        label: 'Games by Color',
        data: [
          metrics.performanceByColor.white.wins,
          metrics.performanceByColor.white.draws,
          metrics.performanceByColor.white.losses,
          metrics.performanceByColor.black.wins,
          metrics.performanceByColor.black.draws,
          metrics.performanceByColor.black.losses,
        ],
        backgroundColor: [
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#059669',
          '#d97706',
          '#dc2626',
        ],
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Player Metrics: {playerName}</h2>
      
      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Games</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.totalGames}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Performance Rating</p>
          <p className="text-2xl font-bold text-blue-900">{metrics.performanceRating}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Win Rate</p>
          <p className="text-2xl font-bold text-green-900">{metrics.winRate}%</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Max Win Streak</p>
          <p className="text-2xl font-bold text-purple-900">{metrics.winStreak.max}</p>
        </div>
      </div>

      {/* Advanced Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Consistency</span>
            <span className="font-semibold">{metrics.consistency}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${metrics.consistency}%` }}
            ></div>
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Aggression</span>
            <span className="font-semibold">{metrics.aggression}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-red-600 h-2 rounded-full"
              style={{ width: `${metrics.aggression}%` }}
            ></div>
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Current Streak</span>
            <span className="font-semibold">{metrics.winStreak.current} wins</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full"
              style={{ width: `${(metrics.winStreak.current / metrics.winStreak.max) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Results Distribution</h3>
          <div className="h-64">
            <Doughnut data={resultsChartData} options={chartOptions} />
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Performance by Color</h3>
          <div className="h-64">
            <Bar data={colorPerformanceData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Top Openings */}
      {metrics.topOpenings && metrics.topOpenings.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Top Openings</h3>
          <div className="space-y-2">
            {metrics.topOpenings.slice(0, 5).map((opening, index) => (
              <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{opening.name}</p>
                  <p className="text-sm text-gray-600">{opening.games} games</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{opening.winRate}%</p>
                  <p className="text-sm text-gray-600">win rate</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}