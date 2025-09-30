'use client';

import { useState, useEffect } from 'react';
import { 
  Trophy, Search, Filter, Calendar, MapPin, Users, 
  TrendingUp, Award, Database, Download, ChevronRight,
  Globe, Clock, Activity, BarChart3
} from 'lucide-react';
import Link from 'next/link';

interface Tournament {
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
  series_name?: string;
  players_count: number;
  games_count: number;
}

interface Statistics {
  totalTournaments: number;
  totalGames: number;
  totalPlayers: number;
  countries: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
}

export default function TournamentArchive() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    location: '',
    country: '',
    year: '',
    category: '',
    minRating: '',
    timeControl: ''
  });
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const resultsPerPage = 50;

  useEffect(() => {
    fetchStatistics();
    fetchTournaments();
  }, [currentPage]);

  const fetchStatistics = async () => {
    try {
      const response = await fetch('http://localhost:3010/api/archive/statistics');
      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const fetchTournaments = async () => {
    try {
      const params = new URLSearchParams({
        limit: resultsPerPage.toString(),
        offset: (currentPage * resultsPerPage).toString()
      });

      if (searchQuery) params.append('q', searchQuery);
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`http://localhost:3010/api/archive/tournaments/search?${params}`);
      const data = await response.json();
      setTournaments(data.tournaments);
      setTotalResults(data.total);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(0);
    fetchTournaments();
  };

  const formatDate = (date: string) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'World Championship': 'bg-yellow-100 text-yellow-800',
      'Super GM': 'bg-purple-100 text-purple-800',
      'Masters': 'bg-blue-100 text-blue-800',
      'Open': 'bg-green-100 text-green-800',
      'Youth': 'bg-pink-100 text-pink-800',
      'Women': 'bg-red-100 text-red-800',
      'Senior': 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const totalPages = Math.ceil(totalResults / resultsPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <Database className="w-8 h-8 text-indigo-600" />
                  Tournament Archive
                </h1>
                <p className="mt-2 text-gray-600">
                  Comprehensive database of historical chess tournament results
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Tournaments</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statistics.totalTournaments.toLocaleString()}
                  </p>
                </div>
                <Trophy className="w-8 h-8 text-indigo-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Games</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statistics.totalGames.toLocaleString()}
                  </p>
                </div>
                <Activity className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Players</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statistics.totalPlayers.toLocaleString()}
                  </p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Countries</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {statistics.countries}
                  </p>
                </div>
                <Globe className="w-8 h-8 text-purple-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Date Range</p>
                  <p className="text-sm font-bold text-gray-900">
                    {statistics.dateRange.earliest ? 
                      `${new Date(statistics.dateRange.earliest).getFullYear()} - ${new Date(statistics.dateRange.latest).getFullYear()}` 
                      : 'N/A'}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-yellow-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-lg shadow p-4">
          <form onSubmit={handleSearch}>
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search tournaments, locations, organizers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Search
              </button>
            </div>

            {showFilters && (
              <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <input
                  type="text"
                  placeholder="Location"
                  value={filters.location}
                  onChange={(e) => setFilters({...filters, location: e.target.value})}
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Country"
                  value={filters.country}
                  onChange={(e) => setFilters({...filters, country: e.target.value})}
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Year"
                  value={filters.year}
                  onChange={(e) => setFilters({...filters, year: e.target.value})}
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({...filters, category: e.target.value})}
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Categories</option>
                  <option value="World Championship">World Championship</option>
                  <option value="Super GM">Super GM</option>
                  <option value="Masters">Masters</option>
                  <option value="Open">Open</option>
                  <option value="Youth">Youth</option>
                  <option value="Women">Women</option>
                </select>
                <input
                  type="number"
                  placeholder="Min Rating"
                  value={filters.minRating}
                  onChange={(e) => setFilters({...filters, minRating: e.target.value})}
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={filters.timeControl}
                  onChange={(e) => setFilters({...filters, timeControl: e.target.value})}
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Time Controls</option>
                  <option value="classical">Classical</option>
                  <option value="rapid">Rapid</option>
                  <option value="blitz">Blitz</option>
                  <option value="bullet">Bullet</option>
                </select>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Tournament Results ({totalResults.toLocaleString()} total)
              </h2>
              <div className="text-sm text-gray-500">
                Page {currentPage + 1} of {totalPages}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading tournament archive...</p>
            </div>
          ) : tournaments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No tournaments found matching your criteria
            </div>
          ) : (
            <div className="divide-y">
              {tournaments.map((tournament) => (
                <Link
                  key={tournament.id}
                  href={`/tournament-archive/${tournament.id}`}
                  className="block p-6 hover:bg-gray-50 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 hover:text-indigo-600">
                          {tournament.name}
                        </h3>
                        {tournament.series_name && (
                          <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs font-medium rounded-full">
                            {tournament.series_name}
                          </span>
                        )}
                        {tournament.category && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(tournament.category)}`}>
                            {tournament.category}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{tournament.location}, {tournament.country || tournament.federation}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(tournament.start_date)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{tournament.players_count || tournament.number_of_players} players</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Activity className="w-4 h-4" />
                          <span>{tournament.games_count || tournament.number_of_games} games</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                        {tournament.average_rating && (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            Avg: {tournament.average_rating}
                          </span>
                        )}
                        {tournament.time_control && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {tournament.time_control}
                          </span>
                        )}
                        {tournament.number_of_rounds && (
                          <span>{tournament.number_of_rounds} rounds</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 mt-2" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t bg-gray-50">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="flex gap-2">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const pageNum = currentPage > 2 ? currentPage - 2 + i : i;
                    if (pageNum >= totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 rounded ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border hover:bg-gray-50'
                        }`}
                      >
                        {pageNum + 1}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage === totalPages - 1}
                  className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}