'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Filter, ChevronDown, ChevronUp, Clock, Zap, Timer, Globe } from 'lucide-react';

interface OpponentData {
  name: string;
  total: { games: number; wins: number; draws: number; losses: number; performanceScore: string };
  classical: { games: number; wins: number; draws: number; losses: number; performanceScore: string };
  rapid: { games: number; wins: number; draws: number; losses: number; performanceScore: string };
  blitz: { games: number; wins: number; draws: number; losses: number; performanceScore: string };
  online: { games: number; wins: number; draws: number; losses: number; performanceScore: string };
  avgRating?: number;
  firstGame?: string;
  lastGame?: string;
}

interface OpponentStatsProps {
  opponents?: OpponentData[];
  simpleOpponents?: any[]; // Fallback for old format
}

export function OpponentStats({ opponents, simpleOpponents }: OpponentStatsProps) {
  const [filters, setFilters] = useState({
    classical: true,
    rapid: true,
    blitz: true,
    online: false
  });
  
  const [expandedOpponent, setExpandedOpponent] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'games' | 'score'>('games');
  const [minGames, setMinGames] = useState(3);

  // Use enhanced data if available, otherwise fall back to simple format
  const opponentData = opponents || (simpleOpponents?.map(opp => ({
    name: opp.opponent || opp.name,
    total: {
      games: opp.games,
      wins: opp.wins,
      draws: opp.draws,
      losses: opp.losses,
      performanceScore: opp.score || opp.performanceScore
    },
    classical: { games: opp.games, wins: opp.wins, draws: opp.draws, losses: opp.losses, performanceScore: opp.performanceScore },
    rapid: { games: 0, wins: 0, draws: 0, losses: 0, performanceScore: '0' },
    blitz: { games: 0, wins: 0, draws: 0, losses: 0, performanceScore: '0' },
    online: { games: 0, wins: 0, draws: 0, losses: 0, performanceScore: '0' }
  })) || []);

  // Calculate filtered stats for each opponent
  const getFilteredStats = (opp: OpponentData) => {
    let games = 0, wins = 0, draws = 0, losses = 0;
    
    if (filters.classical && opp.classical) {
      games += opp.classical.games;
      wins += opp.classical.wins;
      draws += opp.classical.draws;
      losses += opp.classical.losses;
    }
    if (filters.rapid && opp.rapid) {
      games += opp.rapid.games;
      wins += opp.rapid.wins;
      draws += opp.rapid.draws;
      losses += opp.rapid.losses;
    }
    if (filters.blitz && opp.blitz) {
      games += opp.blitz.games;
      wins += opp.blitz.wins;
      draws += opp.blitz.draws;
      losses += opp.blitz.losses;
    }
    if (filters.online && opp.online) {
      games += opp.online.games;
      wins += opp.online.wins;
      draws += opp.online.draws;
      losses += opp.online.losses;
    }
    
    const performanceScore = games > 0 ? ((wins + draws * 0.5) / games * 100) : 0;
    
    return { games, wins, draws, losses, performanceScore };
  };

  // Filter and sort opponents
  const filteredOpponents = opponentData
    .map(opp => ({
      ...opp,
      filtered: getFilteredStats(opp)
    }))
    .filter(opp => opp.filtered.games >= minGames)
    .sort((a, b) => {
      if (sortBy === 'games') {
        return b.filtered.games - a.filtered.games;
      } else {
        return b.filtered.performanceScore - a.filtered.performanceScore;
      }
    });

  const toggleFilter = (key: keyof typeof filters) => {
    // Ensure at least one filter remains active
    const newFilters = { ...filters, [key]: !filters[key] };
    if (Object.values(newFilters).some(v => v)) {
      setFilters(newFilters);
    }
  };

  const TimeControlIcon = ({ type }: { type: string }) => {
    switch(type) {
      case 'classical': return <Clock className="w-4 h-4" />;
      case 'rapid': return <Timer className="w-4 h-4" />;
      case 'blitz': return <Zap className="w-4 h-4" />;
      case 'online': return <Globe className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Head-to-Head Records</CardTitle>
          <Filter className="w-5 h-5 text-gray-500" />
        </div>
        
        {/* Filter Controls */}
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {Object.entries(filters).map(([key, value]) => (
              <button
                key={key}
                onClick={() => toggleFilter(key as keyof typeof filters)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  value 
                    ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}
              >
                <TimeControlIcon type={key} />
                <span className="capitalize text-sm font-medium">{key}</span>
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <label htmlFor="minGames" className="text-gray-600">Min games:</label>
              <select
                id="minGames"
                value={minGames}
                onChange={(e) => setMinGames(Number(e.target.value))}
                className="px-2 py-1 border rounded"
              >
                <option value={1}>1</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label htmlFor="sortBy" className="text-gray-600">Sort by:</label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'games' | 'score')}
                className="px-2 py-1 border rounded"
              >
                <option value="games">Games Played</option>
                <option value="score">Performance Score</option>
              </select>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-2">
          {filteredOpponents.length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              No opponents match the current filters
            </p>
          ) : (
            filteredOpponents.slice(0, 20).map((opp) => (
              <div key={opp.name} className="border rounded-lg">
                <div
                  className="p-3 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedOpponent(
                    expandedOpponent === opp.name ? null : opp.name
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-semibold">{opp.name}</p>
                        {opp.avgRating && (
                          <p className="text-xs text-gray-500">Avg Rating: {opp.avgRating}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm">
                          <span className="text-green-600 font-medium">+{opp.filtered.wins}</span>
                          <span className="text-gray-500 mx-1">=</span>
                          <span className="text-gray-600">{opp.filtered.draws}</span>
                          <span className="text-gray-500 mx-1">-</span>
                          <span className="text-red-600 font-medium">{opp.filtered.losses}</span>
                        </p>
                        <p className="text-xs text-gray-500">{opp.filtered.games} games</p>
                      </div>
                      
                      <div className="text-center">
                        <p className="text-lg font-bold">
                          {opp.filtered.performanceScore.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">Score</p>
                      </div>
                      
                      {expandedOpponent === opp.name ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
                
                {expandedOpponent === opp.name && (
                  <div className="border-t bg-gray-50 p-3">
                    <div className="grid grid-cols-4 gap-3">
                      {['classical', 'rapid', 'blitz', 'online'].map((tc) => {
                        const stats = opp[tc as keyof OpponentData] as any;
                        if (!stats || stats.games === 0) return null;
                        
                        return (
                          <div key={tc} className="bg-white rounded p-2">
                            <div className="flex items-center gap-1 mb-1">
                              <TimeControlIcon type={tc} />
                              <span className="text-xs font-medium capitalize">{tc}</span>
                            </div>
                            <p className="text-xs">
                              {stats.games} game{stats.games !== 1 ? 's' : ''}
                            </p>
                            <p className="text-xs">
                              <span className="text-green-600">+{stats.wins}</span>
                              <span className="text-gray-500 mx-0.5">=</span>
                              <span className="text-gray-600">{stats.draws}</span>
                              <span className="text-gray-500 mx-0.5">-</span>
                              <span className="text-red-600">{stats.losses}</span>
                            </p>
                            <p className="text-xs font-semibold mt-1">
                              {stats.performanceScore}%
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    
                    {opp.firstGame && opp.lastGame && (
                      <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                        <p>Period: {opp.firstGame} to {opp.lastGame}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        
        {filteredOpponents.length > 20 && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Showing top 20 of {filteredOpponents.length} opponents
          </p>
        )}
      </CardContent>
    </Card>
  );
}