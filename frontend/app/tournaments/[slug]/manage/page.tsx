'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Trophy, Users, Calendar, MapPin, Clock, Award,
  ChevronLeft, Save, RefreshCw, Download, Share2,
  UserPlus, Edit2, Settings, FileText, Bell
} from 'lucide-react';

interface Tournament {
  id: number;
  name: string;
  slug: string;
  type: string;
  location: string;
  start_date: string;
  end_date: string;
  rounds_total: number;
  rounds_completed: number;
  time_control: string;
  status: string;
}

interface Registration {
  id: number;
  player_id: number;
  player_name: string;
  rating: number;
  federation: string;
  title?: string;
  fide_id?: number;
  payment_status: string;
}

interface Pairing {
  id: number;
  board_number: number;
  white_player_id: number;
  black_player_id: number;
  white_player_name: string;
  black_player_name: string;
  white_rating: number;
  black_rating: number;
  result?: string;
  is_bye?: boolean;
}

interface Standing {
  rank: number;
  player_id: number;
  player_name: string;
  rating: number;
  title?: string;
  federation?: string;
  points: number;
  games_played: number;
  wins: number;
  draws: number;
  losses: number;
  buchholz?: number;
  performance_rating?: number;
}

export default function TournamentManagement() {
  const params = useParams();
  const slug = params.slug as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [currentRound, setCurrentRound] = useState(1);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  useEffect(() => {
    fetchTournamentData();
  }, [slug]);

  useEffect(() => {
    if (activeTab === 'registrations') {
      fetchRegistrations();
    } else if (activeTab === 'pairings') {
      fetchPairings();
    } else if (activeTab === 'standings') {
      fetchStandings();
    }
  }, [activeTab, currentRound]);

  const fetchTournamentData = async () => {
    try {
      const response = await fetch(`http://localhost:3008/api/tournaments/${slug}`);
      const data = await response.json();
      setTournament(data);
      setCurrentRound(Math.max(1, data.rounds_completed));
    } catch (error) {
      console.error('Error fetching tournament:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrations = async () => {
    if (!tournament) return;
    try {
      const response = await fetch(`http://localhost:3008/api/tournaments/${tournament.id}/registrations`);
      const data = await response.json();
      setRegistrations(data);
    } catch (error) {
      console.error('Error fetching registrations:', error);
    }
  };

  const fetchPairings = async () => {
    if (!tournament) return;
    try {
      const response = await fetch(`http://localhost:3008/api/tournaments/${tournament.id}/rounds/${currentRound}/pairings`);
      const data = await response.json();
      setPairings(data);
    } catch (error) {
      console.error('Error fetching pairings:', error);
    }
  };

  const fetchStandings = async () => {
    if (!tournament) return;
    try {
      const response = await fetch(`http://localhost:3008/api/tournaments/${tournament.id}/standings`);
      const data = await response.json();
      setStandings(data);
    } catch (error) {
      console.error('Error fetching standings:', error);
    }
  };

  const generatePairings = async () => {
    if (!tournament) return;
    try {
      const response = await fetch(
        `http://localhost:3008/api/tournaments/${tournament.id}/rounds/${currentRound}/generate-pairings`,
        { method: 'POST' }
      );
      const data = await response.json();
      setPairings(data.pairings);
    } catch (error) {
      console.error('Error generating pairings:', error);
    }
  };

  const submitResult = async (boardNumber: number, result: string) => {
    if (!tournament) return;
    try {
      await fetch(
        `http://localhost:3008/api/tournaments/${tournament.id}/rounds/${currentRound}/results`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ board_number: boardNumber, result })
        }
      );
      fetchPairings();
      fetchStandings();
    } catch (error) {
      console.error('Error submitting result:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tournament...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Tournament not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => window.history.back()}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                    <span className="flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      {tournament.location}
                    </span>
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(tournament.start_date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {tournament.time_control}
                    </span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      {tournament.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <Share2 className="w-5 h-5" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <Download className="w-5 h-5" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 border-t">
            {['overview', 'registrations', 'pairings', 'standings', 'reports'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium text-sm capitalize transition ${
                  activeTab === tab
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Tournament Progress</h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Rounds Completed</span>
                      <span>{tournament.rounds_completed} / {tournament.rounds_total}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${(tournament.rounds_completed / tournament.rounds_total) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{registrations.length}</p>
                      <p className="text-sm text-gray-500">Players</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{tournament.rounds_completed}</p>
                      <p className="text-sm text-gray-500">Rounds</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">
                        {pairings.filter(p => p.result).length}
                      </p>
                      <p className="text-sm text-gray-500">Games</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowRegisterModal(true)}
                    className="flex items-center justify-center space-x-2 p-3 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
                  >
                    <UserPlus className="w-5 h-5" />
                    <span>Register Player</span>
                  </button>
                  <button
                    onClick={generatePairings}
                    className="flex items-center justify-center space-x-2 p-3 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span>Generate Pairings</span>
                  </button>
                  <button className="flex items-center justify-center space-x-2 p-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                    <FileText className="w-5 h-5" />
                    <span>Export Results</span>
                  </button>
                  <button className="flex items-center justify-center space-x-2 p-3 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100">
                    <Bell className="w-5 h-5" />
                    <span>Send Announcement</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Current Leaders</h2>
                <div className="space-y-3">
                  {standings.slice(0, 5).map((player, index) => (
                    <div key={player.player_id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                        <div>
                          <p className="font-medium text-gray-900">
                            {player.title && <span className="text-gray-500 mr-1">{player.title}</span>}
                            {player.player_name}
                          </p>
                          <p className="text-sm text-gray-500">{player.rating}</p>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-gray-900">{player.points}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Recent Results</h2>
                <div className="space-y-2">
                  {pairings
                    .filter(p => p.result)
                    .slice(0, 5)
                    .map(pairing => (
                      <div key={pairing.id} className="text-sm">
                        <div className="flex justify-between items-center">
                          <span className={pairing.result === '1-0' ? 'font-medium' : ''}>
                            {pairing.white_player_name}
                          </span>
                          <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                            {pairing.result}
                          </span>
                          <span className={pairing.result === '0-1' ? 'font-medium' : ''}>
                            {pairing.black_player_name}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pairings' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Round {currentRound} Pairings</h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentRound(Math.max(1, currentRound - 1))}
                    disabled={currentRound === 1}
                    className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
                  >
                    ←
                  </button>
                  <span className="px-3 py-1 bg-gray-100 rounded">
                    Round {currentRound} / {tournament.rounds_total}
                  </span>
                  <button
                    onClick={() => setCurrentRound(Math.min(tournament.rounds_total, currentRound + 1))}
                    disabled={currentRound === tournament.rounds_total}
                    className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
            <div className="divide-y">
              {pairings.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No pairings generated yet
                  <button
                    onClick={generatePairings}
                    className="block mx-auto mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Generate Pairings
                  </button>
                </div>
              ) : (
                pairings.map(pairing => (
                  <div key={pairing.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <span className="text-sm font-medium text-gray-500">
                          Board {pairing.board_number}
                        </span>
                        <div className="flex items-center space-x-4">
                          <div className={`text-right ${pairing.result === '1-0' ? 'font-bold' : ''}`}>
                            <span>{pairing.white_player_name}</span>
                            <span className="text-sm text-gray-500 ml-2">({pairing.white_rating})</span>
                          </div>
                          <span className="text-gray-400">vs</span>
                          <div className={pairing.result === '0-1' ? 'font-bold' : ''}>
                            <span>{pairing.black_player_name || 'BYE'}</span>
                            {pairing.black_rating && (
                              <span className="text-sm text-gray-500 ml-2">({pairing.black_rating})</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {pairing.result ? (
                          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-lg font-medium">
                            {pairing.result}
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => submitResult(pairing.board_number, '1-0')}
                              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                            >
                              1-0
                            </button>
                            <button
                              onClick={() => submitResult(pairing.board_number, '1/2-1/2')}
                              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                            >
                              ½-½
                            </button>
                            <button
                              onClick={() => submitResult(pairing.board_number, '0-1')}
                              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                            >
                              0-1
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'standings' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">Current Standings</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Player
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Points
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Games
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      W/D/L
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Buchholz
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {standings.map((player, index) => (
                    <tr key={player.player_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-lg font-bold text-gray-900">
                          {player.rank || index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="font-medium text-gray-900">
                            {player.title && <span className="text-gray-500 mr-1">{player.title}</span>}
                            {player.player_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {player.federation} • {player.rating}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-lg font-bold text-gray-900">{player.points}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {player.games_played}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        {player.wins}/{player.draws}/{player.losses}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {player.buchholz?.toFixed(1) || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {player.performance_rating || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}