'use client';

import { useState } from 'react';
import PlayerMetrics from '@/components/analytics/PlayerMetrics';
import RatingProgression from '@/components/analytics/RatingProgression';
import OpeningAnalysis from '@/components/analytics/OpeningAnalysis';
import PlayerComparison from '@/components/analytics/PlayerComparison';
import TournamentAnalytics from '@/components/analytics/TournamentAnalytics';
import GlobalTrends from '@/components/analytics/GlobalTrends';

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('player');
  const [playerName, setPlayerName] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [tournamentName, setTournamentName] = useState('');

  const tabs = [
    { id: 'player', label: 'Player Analytics', icon: '👤' },
    { id: 'comparison', label: 'Player Comparison', icon: '⚔️' },
    { id: 'tournament', label: 'Tournament Analysis', icon: '🏆' },
    { id: 'trends', label: 'Global Trends', icon: '📈' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Chess Analytics Dashboard
          </h1>
          <p className="text-gray-600">
            Advanced statistical analysis and data visualization for chess games
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-2 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'player' && (
            <div className="space-y-6">
              <div className="max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Player Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="e.g., Magnus Carlsen"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => {/* Trigger refresh */}}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Analyze
                  </button>
                </div>
              </div>

              {playerName && (
                <>
                  <PlayerMetrics playerName={playerName} />
                  <RatingProgression playerName={playerName} />
                  <OpeningAnalysis playerName={playerName} />
                </>
              )}
            </div>
          )}

          {activeTab === 'comparison' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 max-w-2xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Player 1
                  </label>
                  <input
                    type="text"
                    value={player1}
                    onChange={(e) => setPlayer1(e.target.value)}
                    placeholder="Enter first player"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Player 2
                  </label>
                  <input
                    type="text"
                    value={player2}
                    onChange={(e) => setPlayer2(e.target.value)}
                    placeholder="Enter second player"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {player1 && player2 && (
                <PlayerComparison player1={player1} player2={player2} />
              )}
            </div>
          )}

          {activeTab === 'tournament' && (
            <div className="space-y-6">
              <div className="max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tournament Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tournamentName}
                    onChange={(e) => setTournamentName(e.target.value)}
                    placeholder="e.g., Tata Steel 2024"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => {/* Trigger refresh */}}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Analyze
                  </button>
                </div>
              </div>

              {tournamentName && (
                <TournamentAnalytics tournamentName={tournamentName} />
              )}
            </div>
          )}

          {activeTab === 'trends' && (
            <GlobalTrends />
          )}
        </div>
      </div>
    </div>
  );
}