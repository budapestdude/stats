'use client';

import { useEffect, useState } from 'react';
import { Bar, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { getApiBaseUrl } from '@/lib/config';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface OpeningAnalysisProps {
  playerName: string;
}

export default function OpeningAnalysis({ playerName }: OpeningAnalysisProps) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${getApiBaseUrl()}/api/analytics/player/${encodeURIComponent(playerName)}/openings`
        );
        const data = await response.json();
        
        if (data.success) {
          setAnalysis(data.analysis);
        }
      } catch (err) {
        console.error('Failed to fetch opening analysis:', err);
      } finally {
        setLoading(false);
      }
    };

    if (playerName) {
      fetchAnalysis();
    }
  }, [playerName]);

  if (loading || !analysis) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  const topOpeningsData = {
    labels: analysis.bestPerforming?.slice(0, 5).map((o: any) => o.eco) || [],
    datasets: [
      {
        label: 'Win Rate %',
        data: analysis.bestPerforming?.slice(0, 5).map((o: any) => parseFloat(o.winRate)) || [],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
      },
      {
        label: 'Games Played',
        data: analysis.bestPerforming?.slice(0, 5).map((o: any) => o.games_played / 10) || [],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-6">Opening Analysis</h3>
        
        {/* Statistics Overview */}
        {analysis.statistics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Unique Openings</p>
              <p className="text-xl font-bold">{analysis.statistics.uniqueOpenings}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Overall Win Rate</p>
              <p className="text-xl font-bold text-blue-900">{analysis.statistics.overallWinRate}%</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Average Score</p>
              <p className="text-xl font-bold text-green-900">{analysis.statistics.averageScore}%</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Diversity</p>
              <p className="text-xl font-bold text-purple-900">{analysis.statistics.diversity}%</p>
            </div>
          </div>
        )}

        {/* Top Performing Openings Chart */}
        <div className="mb-6">
          <h4 className="text-lg font-medium mb-4">Best Performing Openings</h4>
          <div className="h-64">
            <Bar 
              data={topOpeningsData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                  },
                },
              }} 
            />
          </div>
        </div>

        {/* Openings Table */}
        <div>
          <h4 className="text-lg font-medium mb-4">Detailed Opening Statistics</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Opening
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Games
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Win %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Draw %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recommendation
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analysis.openings?.slice(0, 10).map((opening: any, index: number) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {opening.eco} - {opening.opening}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {opening.games_played}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {opening.winRate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {opening.drawRate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {opening.score}%
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {opening.recommendation}
                    </td>
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