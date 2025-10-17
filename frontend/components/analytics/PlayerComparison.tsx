'use client';

import { useEffect, useState } from 'react';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { getApiBaseUrl } from '@/lib/config';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface PlayerComparisonProps {
  player1: string;
  player2: string;
}

export default function PlayerComparison({ player1, player2 }: PlayerComparisonProps) {
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComparison = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${getApiBaseUrl()}/api/analytics/compare?player1=${encodeURIComponent(player1)}&player2=${encodeURIComponent(player2)}`
        );
        const data = await response.json();
        
        if (data.success) {
          setComparison(data.comparison);
        }
      } catch (err) {
        console.error('Failed to fetch comparison:', err);
      } finally {
        setLoading(false);
      }
    };

    if (player1 && player2) {
      fetchComparison();
    }
  }, [player1, player2]);

  if (loading || !comparison) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  const radarData = {
    labels: ['Win Rate', 'Consistency', 'Aggression', 'Games', 'Performance'],
    datasets: [
      {
        label: player1,
        data: [
          comparison.metrics.winRate.player1,
          comparison.metrics.consistency.player1,
          comparison.metrics.aggression.player1,
          Math.min(100, comparison.metrics.totalGames.player1 / 10),
          comparison.metrics.performanceRating.player1 / 25,
        ],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
      },
      {
        label: player2,
        data: [
          comparison.metrics.winRate.player2,
          comparison.metrics.consistency.player2,
          comparison.metrics.aggression.player2,
          Math.min(100, comparison.metrics.totalGames.player2 / 10),
          comparison.metrics.performanceRating.player2 / 25,
        ],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-6">Player Comparison</h3>
        
        {/* Players Overview */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="text-center">
            <h4 className="text-lg font-medium text-blue-600">{player1}</h4>
            <p className="text-sm text-gray-600">{comparison.players.player1.style}</p>
          </div>
          <div className="text-center">
            <h4 className="text-lg font-medium text-red-600">{player2}</h4>
            <p className="text-sm text-gray-600">{comparison.players.player2.style}</p>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="h-80 mb-6">
          <Radar 
            data={radarData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                r: {
                  beginAtZero: true,
                  max: 100,
                },
              },
            }}
          />
        </div>

        {/* Metrics Comparison */}
        <div className="space-y-4">
          {Object.entries(comparison.metrics).map(([key, value]: [string, any]) => (
            <div key={key} className="border rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div className="text-center flex-1">
                  <p className="text-2xl font-bold text-blue-600">{value.player1}</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-sm font-medium text-gray-700">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Advantage: {value.advantage === player1 ? '⬅️' : '➡️'} {value.advantage}
                  </p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-2xl font-bold text-red-600">{value.player2}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Head to Head */}
        {comparison.headToHead && comparison.headToHead.totalGames > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-3">Head-to-Head Record</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">{comparison.headToHead.player1Wins}</p>
                <p className="text-sm text-gray-600">{player1} Wins</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{comparison.headToHead.draws}</p>
                <p className="text-sm text-gray-600">Draws</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{comparison.headToHead.player2Wins}</p>
                <p className="text-sm text-gray-600">{player2} Wins</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}