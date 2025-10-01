'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Search, TrendingUp, Calendar, Users, Clock, MapPin, ChevronLeft, ChevronRight, Filter, Grid, List } from 'lucide-react';
import axios from 'axios';

import { API_BASE_URL } from '@/lib/config';

interface Tournament {
  id?: number;
  name: string;
  games_count: number;
  location?: string;
  start_date?: string;
  end_date?: string;
  event_date?: string;
  players_count?: number;
  rounds?: number;
  time_control?: string;
  description?: string;
  status?: 'upcoming' | 'ongoing' | 'completed';
}

interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  tournaments: Tournament[];
}

type ViewMode = 'calendar' | 'grid' | 'list';

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [upcomingTournaments, setUpcomingTournaments] = useState<Tournament[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTournaments();
    fetchUpcomingTournaments();
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchTournaments();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    generateCalendarData();
  }, [currentDate, tournaments]);

  useEffect(() => {
    // Auto-refresh data every 5 minutes
    const interval = setInterval(() => {
      if (viewMode === 'calendar') {
        fetchUpcomingTournaments();
      }
    }, 300000);
    return () => clearInterval(interval);
  }, [viewMode]);

  const fetchTournaments = async () => {
    setLoading(true);
    setError(null);
    try {
      const [topResponse, otbResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/tournaments/top`),
        axios.get(`${API_BASE_URL}/api/otb/database/tournaments`).catch(() => null)
      ]);

      let allTournaments: Tournament[] = [];

      // Process API tournaments
      if (topResponse.data && Array.isArray(topResponse.data)) {
        allTournaments = [...topResponse.data];
      }

      // Process OTB tournaments if available
      if (otbResponse?.data && Array.isArray(otbResponse.data)) {
        const otbTournaments = otbResponse.data.map((tournament: any) => ({
          ...tournament,
          games_count: tournament.games_count || tournament.game_count || 0,
          start_date: tournament.start_date || tournament.event_date,
        }));
        allTournaments = [...allTournaments, ...otbTournaments];
      }

      // Add sample tournaments with dates for demo
      const sampleTournaments: Tournament[] = [
        {
          name: 'World Chess Championship 2024',
          games_count: 1234,
          location: 'Singapore',
          start_date: '2024-11-25',
          end_date: '2024-12-13',
          players_count: 2,
          status: 'completed'
        },
        {
          name: 'Candidates Tournament 2025',
          games_count: 987,
          location: 'Madrid, Spain',
          start_date: '2025-04-04',
          end_date: '2025-04-25',
          players_count: 8,
          status: 'upcoming'
        },
        {
          name: 'Tata Steel Chess Tournament',
          games_count: 876,
          location: 'Wijk aan Zee, Netherlands',
          start_date: '2025-01-17',
          end_date: '2025-02-02',
          players_count: 14,
          status: 'upcoming'
        },
        {
          name: 'Norway Chess 2025',
          games_count: 654,
          location: 'Stavanger, Norway',
          start_date: '2025-05-26',
          end_date: '2025-06-07',
          players_count: 10,
          status: 'upcoming'
        },
        {
          name: 'Sinquefield Cup 2025',
          games_count: 543,
          location: 'Saint Louis, USA',
          start_date: '2025-08-17',
          end_date: '2025-08-29',
          players_count: 10,
          status: 'upcoming'
        }
      ];

      allTournaments = [...allTournaments, ...sampleTournaments];
      setTournaments(allTournaments);
    } catch (error) {
      console.error('Failed to fetch tournaments:', error);
      setError('Failed to load tournaments. Please try again.');
      // Use fallback data
      setTournaments([
        { name: 'World Chess Championship', games_count: 1234, status: 'completed' },
        { name: 'Candidates Tournament', games_count: 987, status: 'upcoming' },
        { name: 'Tata Steel Chess', games_count: 876, status: 'upcoming' },
        { name: 'Norway Chess', games_count: 654, status: 'upcoming' },
        { name: 'Sinquefield Cup', games_count: 543, status: 'upcoming' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingTournaments = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/tournaments/upcoming`);
      if (response.data && Array.isArray(response.data)) {
        setUpcomingTournaments(response.data);
      }
    } catch (error) {
      console.log('Upcoming tournaments endpoint not available, using static data');
      setUpcomingTournaments([]);
    }
  };

  const searchTournaments = async () => {
    setSearching(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/tournaments/search`, {
        params: { q: searchQuery }
      });
      
      if (response.data && Array.isArray(response.data)) {
        setSearchResults(response.data);
      } else {
        // Fallback to local search
        const filtered = tournaments.filter(tournament =>
          tournament.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (tournament.location && tournament.location.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        setSearchResults(filtered);
      }
    } catch (error) {
      console.error('Search failed:', error);
      // Fallback to local search
      const filtered = tournaments.filter(tournament =>
        tournament.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tournament.location && tournament.location.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setSearchResults(filtered);
    } finally {
      setSearching(false);
    }
  };

  const generateCalendarData = () => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const calendarDays: CalendarDay[] = [];
    const today = new Date();
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const dayTournaments = tournaments.filter(tournament => {
        if (!tournament.start_date) return false;
        const tournamentDate = new Date(tournament.start_date);
        return tournamentDate.toDateString() === date.toDateString();
      });

      calendarDays.push({
        date: new Date(date),
        day: date.getDate(),
        isCurrentMonth: date.getMonth() === currentDate.getMonth(),
        isToday: date.toDateString() === today.toDateString(),
        tournaments: dayTournaments
      });
    }
    
    setCalendarData(calendarDays);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'upcoming': return 'text-blue-400 bg-blue-400/20';
      case 'ongoing': return 'text-green-400 bg-green-400/20';
      case 'completed': return 'text-gray-400 bg-gray-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  const getFilteredTournaments = () => {
    if (filterStatus === 'all') return tournaments;
    return tournaments.filter(tournament => tournament.status === filterStatus);
  };

  const formatTournamentSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '-');
  };

  const renderCalendarView = () => (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between bg-gray-800/50 backdrop-blur rounded-lg p-4">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <h3 className="text-xl font-semibold">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        
        <button
          onClick={() => navigateMonth('next')}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-gray-800/30 rounded-lg p-4">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-gray-400 p-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-2">
          {calendarData.map((day, index) => (
            <div
              key={index}
              className={`p-2 min-h-[80px] rounded-lg border transition-colors cursor-pointer ${
                day.isCurrentMonth 
                  ? 'border-gray-600 hover:border-gray-500' 
                  : 'border-gray-800 text-gray-600'
              } ${
                day.isToday ? 'bg-blue-500/20 border-blue-500' : 'hover:bg-gray-700/50'
              }`}
              onClick={() => setSelectedDate(day.date)}
            >
              <div className="text-sm font-medium mb-1">{day.day}</div>
              {day.tournaments.length > 0 && (
                <div className="space-y-1">
                  {day.tournaments.slice(0, 2).map((tournament, i) => (
                    <div
                      key={i}
                      className="text-xs p-1 rounded bg-blue-500/20 text-blue-300 truncate"
                    >
                      {tournament.name.split(' ').slice(0, 2).join(' ')}
                    </div>
                  ))}
                  {day.tournaments.length > 2 && (
                    <div className="text-xs text-gray-400">
                      +{day.tournaments.length - 2} more
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4">
            {selectedDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h4>
          
          {calendarData
            .find(day => day.date.toDateString() === selectedDate.toDateString())
            ?.tournaments.map((tournament, index) => (
              <Link
                key={index}
                href={`/tournaments/${formatTournamentSlug(tournament.name)}`}
                className="block bg-gray-700/50 rounded-lg p-4 mb-3 hover:bg-gray-600/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="font-semibold text-blue-400">{tournament.name}</h5>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      {tournament.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{tournament.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{tournament.games_count} games</span>
                      </div>
                    </div>
                  </div>
                  {tournament.status && (
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(tournament.status)}`}>
                      {tournament.status}
                    </span>
                  )}
                </div>
              </Link>
            )) || (
            <p className="text-gray-400">No tournaments scheduled for this date.</p>
          )}
        </div>
      )}
    </div>
  );

  const renderGridView = () => {
    const filteredTournaments = getFilteredTournaments();
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTournaments.map((tournament, index) => (
          <Link
            key={tournament.name}
            href={`/tournaments/${formatTournamentSlug(tournament.name)}`}
            className="bg-gray-800/50 backdrop-blur rounded-lg p-6 hover:bg-gray-700/50 transition-all hover:scale-105"
          >
            <div className="flex items-start justify-between mb-3">
              <Trophy className={`w-6 h-6 ${
                index === 0 ? 'text-yellow-400' :
                index === 1 ? 'text-gray-300' :
                index === 2 ? 'text-orange-400' :
                'text-gray-500'
              }`} />
              {tournament.status && (
                <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(tournament.status)}`}>
                  {tournament.status}
                </span>
              )}
            </div>
            
            <h3 className="text-lg font-semibold mb-2 text-blue-400 hover:text-blue-300">
              {tournament.name}
            </h3>
            
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{tournament.games_count.toLocaleString()} games</span>
              </div>
              {tournament.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{tournament.location}</span>
                </div>
              )}
              {tournament.start_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(tournament.start_date).toLocaleDateString()}</span>
                </div>
              )}
              {tournament.players_count && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{tournament.players_count} players</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    );
  };

  const renderListView = () => {
    const filteredTournaments = getFilteredTournaments();
    
    return (
      <div className="space-y-4">
        {filteredTournaments.map((tournament, index) => (
          <Link
            key={tournament.name}
            href={`/tournaments/${formatTournamentSlug(tournament.name)}`}
            className="block bg-gray-800/50 backdrop-blur rounded-lg p-6 hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Trophy className={`w-8 h-8 ${
                  index === 0 ? 'text-yellow-400' :
                  index === 1 ? 'text-gray-300' :
                  index === 2 ? 'text-orange-400' :
                  'text-gray-500'
                }`} />
                
                <div>
                  <h3 className="text-xl font-semibold text-blue-400 hover:text-blue-300">
                    {tournament.name}
                  </h3>
                  
                  <div className="flex items-center gap-6 mt-2 text-sm text-gray-400">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{tournament.games_count.toLocaleString()} games</span>
                    </div>
                    {tournament.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{tournament.location}</span>
                      </div>
                    )}
                    {tournament.start_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(tournament.start_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {tournament.players_count && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{tournament.players_count} players</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {tournament.status && (
                <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(tournament.status)}`}>
                  {tournament.status}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
          <h1 className="text-5xl font-bold mb-4">Chess Tournaments</h1>
          <p className="text-gray-400 text-lg">
            Explore {tournaments.length > 0 ? `${tournaments.length}+` : ''} tournaments with calendar and search
          </p>
        </div>

        {/* Controls */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search tournaments... (e.g., World Championship, Tata Steel)"
              className="w-full pl-12 pr-4 py-3 bg-gray-800/50 backdrop-blur rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searching && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              </div>
            )}
          </div>

          {/* View Mode Tabs and Filters */}
          <div className="flex items-center justify-between bg-gray-800/30 rounded-lg p-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'calendar' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Calendar
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Grid className="w-4 h-4" />
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'list' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
                List
              </button>
            </div>

            {viewMode !== 'calendar' && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-gray-700 text-white rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Tournaments</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Search Results ({searchResults.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((tournament) => (
                <Link
                  key={tournament.name}
                  href={`/tournaments/${formatTournamentSlug(tournament.name)}`}
                  className="bg-gray-800/50 backdrop-blur rounded-lg p-4 hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-blue-400 hover:text-blue-300">
                        {tournament.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                        <Users className="w-4 h-4" />
                        <span>{tournament.games_count} games</span>
                        {tournament.location && (
                          <>
                            <MapPin className="w-4 h-4 ml-2" />
                            <span>{tournament.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {tournament.status && (
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(tournament.status)}`}>
                        {tournament.status}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        {!searchQuery && (
          <>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-gray-800/50 rounded-lg p-6 animate-pulse">
                    <div className="h-6 bg-gray-700 rounded mb-3"></div>
                    <div className="h-4 bg-gray-700 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {viewMode === 'calendar' && renderCalendarView()}
                {viewMode === 'grid' && renderGridView()}
                {viewMode === 'list' && renderListView()}
              </>
            )}
          </>
        )}

        {/* Quick Links */}
        <div className="mt-12 p-6 bg-gray-800/30 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Popular Tournament Series</h3>
          <div className="flex flex-wrap gap-2">
            {[
              'World Championship',
              'Candidates',
              'Olympiad',
              'Tata Steel',
              'Norway Chess',
              'Sinquefield Cup',
              'Grand Prix',
              'Grand Swiss',
              'World Cup',
              'European Championship'
            ].map(series => (
              <button
                key={series}
                onClick={() => setSearchQuery(series)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-full text-sm transition-colors"
              >
                {series}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}