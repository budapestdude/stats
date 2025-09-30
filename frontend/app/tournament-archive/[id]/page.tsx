'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  Trophy, Download, Share2, ChevronLeft, Users, 
  Calendar, MapPin, Clock, Award, TrendingUp,
  Activity, BarChart3, FileText, Grid3x3
} from 'lucide-react';
import Link from 'next/link';

interface TournamentDetails {
  id: number;
  name: string;
  location: string;
  country: string;
  federation: string;
  start_date: string;
  end_date: string;
  tournament_type: string;
  category: string;
  average_rating: number;
  number_of_players: number;
  number_of_rounds: number;
  number_of_games: number;
  time_control: string;
  organizer: string;
  chief_arbiter: string;
  website: string;
  series_name?: string;
  statistics: {
    white_wins: number;
    black_wins: number;
    draws: number;
    avg_ply_count: number;
    unique_openings: number;
  };
}

interface Standing {
  rank: number;
  starting_rank: number;
  player_name: string;
  player_title: string;
  player_federation: string;
  player_rating: number;
  player_fide_id: number;
  points: number;
  games_played: number;
  wins: number;
  draws: number;
  losses: number;
  performance_rating: number;
  rating_change: number;
  tb1: number;
  tb2: number;
  tb3: number;
}

interface Game {
  id: number;
  round: number;
  board: number;
  white_player: string;
  white_title: string;
  white_rating: number;
  black_player: string;
  black_title: string;
  black_rating: number;
  result: string;
  eco: string;
  opening: string;
  ply_count: number;
}

export default function TournamentDetails() {
  const params = useParams();
  const id = params.id as string;

  const [tournament, setTournament] = useState<TournamentDetails | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [activeTab, setActiveTab] = useState<'crosstable' | 'games' | 'statistics'>('crosstable');
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournamentDetails();
    fetchStandings();
    fetchGames();
  }, [id]);

  const fetchTournamentDetails = async () => {
    try {
      const response = await fetch(`http://localhost:3010/api/archive/tournaments/${id}`);
      const data = await response.json();
      setTournament(data);
    } catch (error) {
      console.error('Error fetching tournament details:', error);
    }
  };

  const fetchStandings = async () => {
    try {
      const response = await fetch(`http://localhost:3010/api/archive/tournaments/${id}/standings`);
      const data = await response.json();
      setStandings(data);
    } catch (error) {
      console.error('Error fetching standings:', error);
    }
  };

  const fetchGames = async () => {
    try {
      let url = `http://localhost:3010/api/archive/tournaments/${id}/games`;
      if (selectedRound) {
        url += `?round=${selectedRound}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      setGames(data);
    } catch (error) {
      console.error('Error fetching games:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (format: 'pgn' | 'csv' | 'json') => {
    try {
      const response = await fetch(`http://localhost:3010/api/archive/tournaments/${id}/export?format=${format}`);
      if (format === 'json') {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tournament?.name.replace(/[^a-z0-9]/gi, '_')}.json`;
        a.click();
      } else {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = format === 'pgn' 
          ? `${tournament?.name.replace(/[^a-z0-9]/gi, '_')}.pgn`
          : `${tournament?.name.replace(/[^a-z0-9]/gi, '_')}_standings.csv`;
        a.click();
      }
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const formatDate = (date: string) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case '1-0': return 'text-green-600 font-semibold';
      case '0-1': return 'text-red-600 font-semibold';
      case '1/2-1/2': return 'text-gray-600';
      default: return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tournament details...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <Link href="/tournament-archive" className="p-2 hover:bg-gray-100 rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                  </Link>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
                    {tournament.series_name && (
                      <p className="text-sm text-indigo-600 mt-1">{tournament.series_name}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 ml-11">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {tournament.location}, {tournament.country || tournament.federation}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {tournament.number_of_players} players
                  </span>
                  <span className="flex items-center gap-1">
                    <Grid3x3 className="w-4 h-4" />
                    {tournament.number_of_rounds} rounds
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {tournament.time_control}
                  </span>
                  {tournament.average_rating && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      Avg: {tournament.average_rating}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-lg" title="Share">
                  <Share2 className="w-5 h-5" />
                </button>
                <div className="relative group">
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg hidden group-hover:block">
                    <button
                      onClick={() => exportData('pgn')}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-50"
                    >
                      Download PGN
                    </button>
                    <button
                      onClick={() => exportData('csv')}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-50"
                    >
                      Export to CSV
                    </button>
                    <button
                      onClick={() => exportData('json')}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-50"
                    >
                      Export as JSON
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1">
            {(['crosstable', 'games', 'statistics'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium text-sm capitalize transition ${
                  activeTab === tab
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'crosstable' ? 'Final Standings' : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'crosstable' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Fed</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rating</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Points</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Games</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">W/D/L</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">TB1</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Perf</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">+/-</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {standings.map((standing, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`font-bold ${index < 3 ? 'text-lg' : ''}`}>
                          {standing.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {standing.player_title || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Link 
                          href={`/archive/players/${standing.player_fide_id || standing.player_name}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {standing.player_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {standing.player_federation || '-'}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">
                        {standing.player_rating || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-lg">{standing.points}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {standing.games_played}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {standing.wins}/{standing.draws}/{standing.losses}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {standing.tb1?.toFixed(1) || '-'}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">
                        {standing.performance_rating || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {standing.rating_change ? (
                          <span className={standing.rating_change > 0 ? 'text-green-600' : 'text-red-600'}>
                            {standing.rating_change > 0 ? '+' : ''}{standing.rating_change}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'games' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Tournament Games</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Round:</span>
                  <select
                    value={selectedRound || ''}
                    onChange={(e) => setSelectedRound(e.target.value ? Number(e.target.value) : null)}
                    className="px-3 py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All Rounds</option>
                    {tournament && [...Array(tournament.number_of_rounds)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>Round {i + 1}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Round</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Board</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">White</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Result</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Black</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">ECO</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Opening</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Moves</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {games.map((game) => (
                      <tr key={game.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-center">{game.round}</td>
                        <td className="px-4 py-2 text-center">{game.board}</td>
                        <td className="px-4 py-2">
                          <span className="text-gray-500 mr-1">{game.white_title}</span>
                          <span className="font-medium">{game.white_player}</span>
                          <span className="text-gray-500 ml-1">({game.white_rating})</span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={getResultColor(game.result)}>{game.result}</span>
                        </td>
                        <td className="px-4 py-2">
                          <span className="text-gray-500 mr-1">{game.black_title}</span>
                          <span className="font-medium">{game.black_player}</span>
                          <span className="text-gray-500 ml-1">({game.black_rating})</span>
                        </td>
                        <td className="px-4 py-2 text-center font-mono text-sm">{game.eco}</td>
                        <td className="px-4 py-2 text-sm">{game.opening}</td>
                        <td className="px-4 py-2 text-center">{game.ply_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'statistics' && tournament.statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Game Results</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">White Wins</span>
                  <span className="font-bold">{tournament.statistics.white_wins}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Draws</span>
                  <span className="font-bold">{tournament.statistics.draws}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Black Wins</span>
                  <span className="font-bold">{tournament.statistics.black_wins}</span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">White Score</span>
                  <span className="font-bold">
                    {tournament.statistics.white_wins && tournament.statistics.black_wins && tournament.statistics.draws
                      ? ((tournament.statistics.white_wins + tournament.statistics.draws * 0.5) / 
                         (tournament.statistics.white_wins + tournament.statistics.black_wins + tournament.statistics.draws) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Tournament Info</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Games</span>
                  <span className="font-bold">{tournament.number_of_games}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Players</span>
                  <span className="font-bold">{tournament.number_of_players}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Rounds</span>
                  <span className="font-bold">{tournament.number_of_rounds}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Average Rating</span>
                  <span className="font-bold">{tournament.average_rating || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Game Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Avg Game Length</span>
                  <span className="font-bold">
                    {tournament.statistics.avg_ply_count 
                      ? Math.round(tournament.statistics.avg_ply_count / 2)
                      : 'N/A'} moves
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Unique Openings</span>
                  <span className="font-bold">{tournament.statistics.unique_openings}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Decisive Games</span>
                  <span className="font-bold">
                    {tournament.statistics.white_wins && tournament.statistics.black_wins && tournament.statistics.draws
                      ? ((tournament.statistics.white_wins + tournament.statistics.black_wins) / 
                         (tournament.statistics.white_wins + tournament.statistics.black_wins + tournament.statistics.draws) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>

            {tournament.organizer && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Organization</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-gray-600 block text-sm">Organizer</span>
                    <span className="font-medium">{tournament.organizer}</span>
                  </div>
                  {tournament.chief_arbiter && (
                    <div>
                      <span className="text-gray-600 block text-sm">Chief Arbiter</span>
                      <span className="font-medium">{tournament.chief_arbiter}</span>
                    </div>
                  )}
                  {tournament.website && (
                    <div>
                      <span className="text-gray-600 block text-sm">Website</span>
                      <a href={tournament.website} target="_blank" rel="noopener noreferrer" 
                         className="text-blue-600 hover:text-blue-800">
                        View Official Site
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}