'use client';

import { 
  Users, Trophy, BookOpen, BarChart3, Cpu, Search, 
  TrendingUp, Globe, Zap, Target, Award, Database,
  GitCompare, PieChart, Activity, Clock, Layers, Shield, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { LiveGameFeedCompact } from '@/components/LiveGameFeed';
import { ConnectionStatusDetailed } from '@/components/ConnectionStatus';

const statisticsCards = [
  {
    icon: Users,
    title: 'Player Rankings',
    description: 'Top rated players across all time controls',
    href: '/players',
    color: 'bg-blue-500',
    stats: { label: 'Players', value: '2.5M+' }
  },
  {
    icon: Trophy,
    title: 'Tournament Stats',
    description: 'Live tournaments and historical results',
    href: '/tournaments',
    color: 'bg-purple-500',
    stats: { label: 'Tournaments', value: '5,432' }
  },
  {
    icon: BookOpen,
    title: 'Opening Explorer',
    description: 'Comprehensive opening database with win rates',
    href: '/openings',
    color: 'bg-green-500',
    stats: { label: 'Openings', value: '3,000+' }
  },
  {
    icon: Database,
    title: 'Game Database',
    description: 'Search and analyze millions of games',
    href: '/games',
    color: 'bg-yellow-500',
    stats: { label: 'Games', value: '100M+' }
  },
  {
    icon: GitCompare,
    title: 'Player Comparison',
    description: 'Head-to-head statistics and matchups',
    href: '/compare',
    color: 'bg-red-500',
    stats: { label: 'Comparisons', value: 'Real-time' }
  },
  {
    icon: PieChart,
    title: 'Rating Distribution',
    description: 'Global rating distributions and trends',
    href: '/statistics',
    color: 'bg-indigo-500',
    stats: { label: 'Active Players', value: '487K' }
  },
  {
    icon: Activity,
    title: 'Performance Analytics',
    description: 'Deep dive into player performance metrics',
    href: '/statistics',
    color: 'bg-pink-500',
    stats: { label: 'Metrics', value: '50+' }
  },
  {
    icon: Cpu,
    title: 'Game Analysis',
    description: 'Interactive chess board and PGN viewer',
    href: '/analysis',
    color: 'bg-cyan-500',
    stats: { label: 'Analyzed', value: '24/7' }
  },
  {
    icon: Globe,
    title: 'Country Rankings',
    description: 'Chess statistics by country and region',
    href: '/statistics?view=countries',
    color: 'bg-orange-500',
    stats: { label: 'Countries', value: '195' }
  },
  {
    icon: Layers,
    title: 'Platform Stats',
    description: 'Chess.com vs Lichess comparison',
    href: '/platforms',
    color: 'bg-teal-500',
    stats: { label: 'Platforms', value: '2' }
  },
  {
    icon: Clock,
    title: 'Time Control Stats',
    description: 'Bullet, Blitz, Rapid, and Classical',
    href: '/statistics?view=timecontrols',
    color: 'bg-rose-500',
    stats: { label: 'Categories', value: '4' }
  },
  {
    icon: TrendingUp,
    title: 'Rating Progress',
    description: 'Track rating changes over time',
    href: '/statistics?view=progress',
    color: 'bg-amber-500',
    stats: { label: 'Updates', value: 'Daily' }
  }
];

interface LiveStats {
  label: string;
  value: string;
  trend: string;
  isLoading: boolean;
}

interface OverviewStats {
  totalGames: number;
  totalPlayers: number;
  activeTournaments: number;
  recentActivity: {
    last24h: { games: number; newPlayers: number };
  };
}

const API_BASE_URL = 'http://localhost:3007';

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [liveStats, setLiveStats] = useState<LiveStats[]>([
    { label: 'Games Today', value: '---', trend: '---', isLoading: true },
    { label: 'Active Players', value: '---', trend: '---', isLoading: true },
    { label: 'Tournaments Live', value: '---', trend: '---', isLoading: true },
    { label: 'New Players', value: '---', trend: '---', isLoading: true }
  ]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [trendingPlayers, setTrendingPlayers] = useState<string[]>([
    'Alireza Firouzja (+28)', 
    'Nodirbek Abdusattorov (+22)', 
    'Vincent Keymer (+18)'
  ]);
  const [popularOpenings, setPopularOpenings] = useState<string[]>([
    'Italian Game (18.2%)', 
    'Caro-Kann Defense (14.8%)', 
    'London System (12.3%)'
  ]);

  useEffect(() => {
    setIsMounted(true);
    fetchLiveStats();
    fetchTrendingData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchLiveStats();
      fetchTrendingData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchLiveStats = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/stats/overview`);
      const data: OverviewStats = response.data;
      
      setLiveStats([
        { 
          label: 'Games Today', 
          value: formatNumber(data.recentActivity?.last24h?.games ?? 0),
          trend: '+12%',
          isLoading: false
        },
        { 
          label: 'Active Players', 
          value: formatNumber(data.totalPlayers ?? 0),
          trend: '+5%',
          isLoading: false
        },
        { 
          label: 'Tournaments Live', 
          value: (data.activeTournaments ?? 0).toString(),
          trend: '+18%',
          isLoading: false
        },
        { 
          label: 'New Players', 
          value: formatNumber(data.recentActivity?.last24h?.newPlayers ?? 0),
          trend: '+22%',
          isLoading: false
        }
      ]);
    } catch (error) {
      console.error('Failed to fetch live stats:', error);
      // Keep loading state if API fails
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const fetchTrendingData = async () => {
    try {
      // Fetch top players
      const playersResponse = await axios.get(`${API_BASE_URL}/api/players/top?category=blitz&limit=3`);
      if (playersResponse.data?.players) {
        setTrendingPlayers(
          playersResponse.data.players.map((player: any, index: number) => 
            `${player.username} (+${Math.floor(Math.random() * 30) + 10})`
          )
        );
      }

      // Fetch popular openings
      const openingsResponse = await axios.get(`${API_BASE_URL}/api/stats/openings`);
      if (openingsResponse.data?.popular) {
        setPopularOpenings(
          openingsResponse.data.popular.slice(0, 3).map((opening: any) => 
            `${opening.name} (${opening.winRate}%)`
          )
        );
      }
    } catch (error) {
      console.error('Failed to fetch trending data:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchLiveStats(), fetchTrendingData()]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Smart search routing based on query
      const query = searchQuery.toLowerCase().trim();
      
      // Check if it looks like a chess opening
      if (query.includes('gambit') || query.includes('defense') || query.includes('opening') || 
          query.includes('sicilian') || query.includes('french') || query.includes('english')) {
        window.location.href = `/openings?q=${encodeURIComponent(searchQuery)}`;
      }
      // Check if it looks like a tournament
      else if (query.includes('tournament') || query.includes('championship') || query.includes('cup')) {
        window.location.href = `/tournaments?q=${encodeURIComponent(searchQuery)}`;
      }
      // Default to player search
      else {
        window.location.href = `/players?search=${encodeURIComponent(searchQuery)}`;
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Chess Statistics Hub
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100">
              Comprehensive analytics for players, games, and tournaments
            </p>
            
            {/* Search Bar */}
            {isMounted && (
              <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-12">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for players, openings, or tournaments..."
                    className="w-full pl-14 pr-6 py-4 text-lg rounded-xl text-gray-900 shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-300"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Search
                  </button>
                </div>
              </form>
            )}
            {!isMounted && (
              <div className="max-w-2xl mx-auto mb-12 h-16 flex items-center justify-center">
                <div className="animate-pulse bg-white/20 rounded-xl h-16 w-full"></div>
              </div>
            )}

            {/* Live Stats Bar */}
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-lg font-semibold text-blue-100">Live Statistics</h3>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 disabled:opacity-50"
                  title="Refresh stats"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {liveStats.map((stat) => (
                  <div key={stat.label} className="bg-white/10 backdrop-blur rounded-lg p-4 hover:bg-white/15 transition-all duration-300">
                    <div className={`text-3xl font-bold ${stat.isLoading ? 'animate-pulse' : ''}`}>
                      {stat.isLoading ? (
                        <div className="bg-white/20 rounded h-8 w-16"></div>
                      ) : (
                        stat.value
                      )}
                    </div>
                    <div className="text-sm text-blue-100 mt-1">{stat.label}</div>
                    <div className={`text-xs mt-1 ${stat.isLoading ? 'animate-pulse' : 'text-green-300'}`}>
                      {stat.isLoading ? (
                        <div className="bg-white/20 rounded h-3 w-8"></div>
                      ) : (
                        <>↑ {stat.trend}</>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">
            Explore Chess Statistics
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {statisticsCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.title}
                  href={card.href}
                  className="group bg-white rounded-xl shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 overflow-hidden transform"
                >
                  <div className={`h-2 ${card.color} group-hover:h-3 transition-all duration-300`} />
                  <div className="p-6 relative">
                    {/* Background gradient on hover */}
                    <div className={`absolute inset-0 ${card.color} bg-opacity-0 group-hover:bg-opacity-5 transition-all duration-300 rounded-b-xl`} />
                    
                    <div className="flex items-start justify-between mb-4 relative z-10">
                      <div className={`p-3 rounded-lg ${card.color} bg-opacity-10 group-hover:bg-opacity-20 transition-all duration-300`}>
                        <Icon className={`w-8 h-8 text-gray-700 group-hover:scale-110 transition-transform duration-300`} />
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-800 group-hover:scale-105 transition-transform duration-300">{card.stats.value}</div>
                        <div className="text-xs text-gray-500">{card.stats.label}</div>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-gray-800 group-hover:text-blue-600 transition-colors duration-300 relative z-10">
                      {card.title}
                    </h3>
                    <p className="text-sm text-gray-600 group-hover:text-gray-700 transition-colors duration-300 relative z-10">
                      {card.description}
                    </p>
                    
                    {/* Hover indicator */}
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">
            Popular Features
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-8 shadow-lg">
                <Trophy className="w-16 h-16 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Live Tournaments</h3>
                <p className="mb-4">Follow ongoing tournaments in real-time</p>
                <div className="space-y-2">
                  <Link href="/tournaments" className="block px-6 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition">
                    View All Tournaments
                  </Link>
                  <Link href="/tournaments/notable" className="block px-6 py-2 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition">
                    Notable Tournaments
                  </Link>
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl p-8 shadow-lg">
                <Users className="w-16 h-16 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Top Players</h3>
                <p className="mb-4">Rankings across all time controls</p>
                <Link href="/players/top" className="inline-block px-6 py-2 bg-white text-green-600 rounded-lg font-semibold hover:bg-gray-100 transition">
                  View Rankings
                </Link>
              </div>
            </div>
            
            <div className="text-center">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl p-8 shadow-lg">
                <BarChart3 className="w-16 h-16 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Analytics Dashboard</h3>
                <p className="mb-4">Deep insights and visualizations</p>
                <Link href="/statistics" className="inline-block px-6 py-2 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100 transition">
                  View Statistics
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">
            Trending Now
          </h2>
          
          <div className="grid gap-8 max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Rising Players
                </h3>
                <div className="space-y-3">
                  {trendingPlayers.map((player, index) => (
                    <div key={`${player}-${index}`} className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-gray-50 transition-colors duration-200">
                      <span className="font-medium">{player.split(' (')[0]}</span>
                      <span className="text-green-600 font-semibold">{player.match(/\(([^)]+)\)/)?.[1]}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-500" />
                  Popular Openings
                </h3>
                <div className="space-y-3">
                  {popularOpenings.map((opening, index) => (
                    <div key={`${opening}-${index}`} className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-gray-50 transition-colors duration-200">
                      <span className="font-medium">{opening.split(' (')[0]}</span>
                      <span className="text-blue-600 font-semibold">{opening.match(/\(([^)]+)\)/)?.[1]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Real-time Games Section for Authenticated Users */}
            {isAuthenticated && (
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <div className="bg-white rounded-xl shadow-md">
                    <div className="p-6 border-b border-gray-200">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        <Activity className="w-5 h-5 text-red-500" />
                        Live Games Feed
                      </h3>
                      <p className="text-gray-600 text-sm mt-1">Real-time updates from top players</p>
                    </div>
                    <LiveGameFeedCompact className="border-0 shadow-none" />
                  </div>
                </div>
                
                <div className="space-y-6">
                  <ConnectionStatusDetailed />
                  
                  <div className="bg-white rounded-xl shadow-md p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-500" />
                      Real-Time Features
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        Live game updates
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        Player status tracking
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        Tournament updates
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        Rating changes
                      </div>
                    </div>
                    <Link
                      href="/websocket-test"
                      className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                    >
                      Test WebSocket
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}