'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Trophy, Calendar, MapPin, Users, TrendingUp, Award, Clock, Target } from 'lucide-react';

interface TournamentData {
  name: string;
  games_count: number;
  location?: string;
  start_date?: string;
  end_date?: string;
  players?: Array<{
    name: string;
    score: number;
    games: number;
    wins: number;
    draws: number;
    losses: number;
    performance?: number;
  }>;
  stats?: {
    totalGames: number;
    decisiveRate: number;
    averageLength: number;
    mostCommonOpening: string;
    longestGame: number;
    shortestDecisive: number;
    upsets: number;
  };
}

export default function TournamentPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTournamentData();
  }, [slug]);

  const fetchTournamentData = async () => {
    try {
      setLoading(true);
      // Decode the slug to get the tournament name
      const tournamentName = decodeURIComponent(slug.replace(/-/g, ' '));
      
      const response = await fetch(`http://localhost:3007/api/tournaments/${encodeURIComponent(tournamentName)}`);
      if (!response.ok) {
        throw new Error('Tournament not found');
      }
      
      const data = await response.json();
      setTournament(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournament');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="h-6 bg-gray-700 rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6 h-96"></div>
              <div className="bg-gray-800 rounded-lg p-6 h-96"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto text-center">
          <Trophy className="w-24 h-24 mx-auto mb-4 text-gray-600" />
          <h1 className="text-3xl font-bold mb-4">Tournament Not Found</h1>
          <p className="text-gray-400 mb-8">{error || 'This tournament could not be found in our database.'}</p>
          <Link href="/tournaments" className="text-blue-400 hover:text-blue-300">
            Browse All Tournaments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Trophy className="w-8 h-8 text-yellow-400" />
            <h1 className="text-4xl font-bold">{tournament.name}</h1>
          </div>
          
          <div className="flex flex-wrap gap-6 text-gray-300">
            {tournament.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>{tournament.location}</span>
              </div>
            )}
            {tournament.start_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{tournament.start_date}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{tournament.games_count || 0} games</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Crosstable */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Award className="w-6 h-6 text-yellow-400" />
                Tournament Standings
              </h2>
              
              {tournament.players && tournament.players.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 px-1">#</th>
                        <th className="text-left py-2 px-2">Player</th>
                        <th className="text-center py-2 px-2">Score</th>
                        <th className="text-center py-2 px-2">Games</th>
                        <th className="text-center py-2 px-2 text-green-400">W</th>
                        <th className="text-center py-2 px-2 text-gray-400">D</th>
                        <th className="text-center py-2 px-2 text-red-400">L</th>
                        {tournament.players[0].performance && (
                          <th className="text-center py-2 px-2">Perf</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {tournament.players.map((player, index) => (
                        <tr key={player.name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                          <td className="py-2 px-1">
                            {index === 0 && '🥇'}
                            {index === 1 && '🥈'}
                            {index === 2 && '🥉'}
                            {index > 2 && index + 1}
                          </td>
                          <td className="py-2 px-2">
                            <Link 
                              href={`/players/${player.name.toLowerCase().replace(/\s+/g, '-')}`}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              {player.name}
                            </Link>
                          </td>
                          <td className="text-center py-2 px-2 font-semibold">
                            {player.score}
                          </td>
                          <td className="text-center py-2 px-2">
                            {player.games}
                          </td>
                          <td className="text-center py-2 px-2 text-green-400">
                            {player.wins}
                          </td>
                          <td className="text-center py-2 px-2 text-gray-400">
                            {player.draws}
                          </td>
                          <td className="text-center py-2 px-2 text-red-400">
                            {player.losses}
                          </td>
                          {player.performance && (
                            <td className="text-center py-2 px-2">
                              {player.performance}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Detailed crosstable data not available</p>
                  <p className="text-sm mt-2">This tournament has {tournament.games_count || 0} recorded games</p>
                </div>
              )}
            </div>
          </div>

          {/* Tournament Stats */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Tournament Stats
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Games</span>
                  <span className="font-semibold">{tournament.games_count || 0}</span>
                </div>
                
                {tournament.stats && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Decisive Rate</span>
                      <span className="font-semibold">{tournament.stats.decisiveRate}%</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-400">Avg Length</span>
                      <span className="font-semibold">{tournament.stats.averageLength} moves</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-400">Most Common</span>
                      <span className="font-semibold text-sm">{tournament.stats.mostCommonOpening}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-400">Longest Game</span>
                      <span className="font-semibold">{tournament.stats.longestGame} moves</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-400">Shortest Win</span>
                      <span className="font-semibold">{tournament.stats.shortestDecisive} moves</span>
                    </div>
                    
                    {tournament.stats.upsets > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Major Upsets</span>
                        <span className="font-semibold">{tournament.stats.upsets}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Notable Games */}
            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-red-400" />
                Notable Features
              </h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-gray-300">High-level competition</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-gray-300">Classical time control</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <span className="text-gray-300">FIDE rated event</span>
                </div>
              </div>
            </div>

            {/* Time Control Distribution */}
            <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                Format
              </h3>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Type</span>
                  <span>Round Robin</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Time Control</span>
                  <span>Classical</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Rounds</span>
                  <span>{tournament.games_count ? Math.ceil(Math.sqrt(tournament.games_count)) : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Similar Tournaments */}
        <div className="mt-8 bg-gray-800/50 backdrop-blur rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">Similar Tournaments</h3>
          <div className="flex flex-wrap gap-2">
            {['Tata Steel', 'Norway Chess', 'Sinquefield Cup', 'Candidates'].map(name => (
              <Link
                key={name}
                href={`/tournaments/${name.toLowerCase().replace(/\s+/g, '-')}`}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-full text-sm transition-colors"
              >
                {name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}