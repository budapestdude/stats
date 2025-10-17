'use client';

import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { getApiBaseUrl } from '@/lib/config';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface RatingProgressionProps {
  playerName: string;
}

interface ProgressionData {
  timeline: Array<{
    date: string;
    rating: number;
    games: number;
    winRate: string;
    performance: string;
  }>;
  currentRating: number;
  peakRating: number;
  lowestRating: number;
  trend: string;
  volatility: number;
  improvement: number;
}

export default function RatingProgression({ playerName }: RatingProgressionProps) {
  const [progression, setProgression] = useState<ProgressionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('year');

  useEffect(() => {
    const fetchProgression = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${getApiBaseUrl()}/api/analytics/player/${encodeURIComponent(playerName)}/progression?period=${period}`
        );
        const data = await response.json();
        
        if (data.success) {
          setProgression(data.progression);
        }
      } catch (err) {
        console.error('Failed to fetch progression:', err);
      } finally {
        setLoading(false);
      }
    };

    if (playerName) {
      fetchProgression();
    }
  }, [playerName, period]);

  if (loading || !progression) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  const chartData = {
    labels: progression.timeline.map(t => t.date),
    datasets: [
      {
        label: 'Rating',
        data: progression.timeline.map(t => t.rating),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          afterLabel: (context: any) => {
            const index = context.dataIndex;
            const point = progression.timeline[index];
            return [
              `Games: ${point.games}`,
              `Win Rate: ${point.winRate}%`,
              `Performance: ${point.performance}%`,
            ];
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: 'Rating',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Month',
        },
      },
    },
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'strong_upward': return '📈⬆️';
      case 'upward': return '📈';
      case 'stable': return '➡️';
      case 'downward': return '📉';
      case 'strong_downward': return '📉⬇️';
      default: return '❓';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'strong_upward': return 'text-green-600 bg-green-50';
      case 'upward': return 'text-green-500 bg-green-50';
      case 'stable': return 'text-gray-600 bg-gray-50';
      case 'downward': return 'text-orange-500 bg-orange-50';
      case 'strong_downward': return 'text-red-600 bg-red-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold">Rating Progression</h3>
          <div className="flex gap-2">
            {['month', 'quarter', 'year'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-md text-sm ${
                  period === p 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="text-center">
            <p className="text-sm text-gray-600">Current</p>
            <p className="text-xl font-bold">{progression.currentRating}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Peak</p>
            <p className="text-xl font-bold text-green-600">{progression.peakRating}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Lowest</p>
            <p className="text-xl font-bold text-red-600">{progression.lowestRating}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Volatility</p>
            <p className="text-xl font-bold">{progression.volatility}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Change</p>
            <p className={`text-xl font-bold ${progression.improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {progression.improvement >= 0 ? '+' : ''}{progression.improvement}
            </p>
          </div>
          <div className="text-center">
            <div className={`inline-flex items-center px-3 py-1 rounded-full ${getTrendColor(progression.trend)}`}>
              <span className="text-sm font-medium">
                {getTrendIcon(progression.trend)} {progression.trend.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-80">
          <Line data={chartData} options={chartOptions} />
        </div>

        {/* Timeline Stats */}
        {progression.timeline.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Performance</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {progression.timeline.slice(-4).map((month, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600">{month.date}</p>
                  <p className="font-semibold">{month.rating}</p>
                  <p className="text-xs text-gray-500">{month.games} games • {month.winRate}% wins</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}