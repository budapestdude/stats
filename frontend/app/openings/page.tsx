'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, TrendingUp, Trophy, Users, ChevronRight, BarChart2, Target, Search, ArrowLeft, ArrowRight, RotateCcw, Play, Database } from 'lucide-react';
import ChessBoard from '@/components/ChessBoard';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';

const COLORS = ['#10B981', '#F59E0B', '#EF4444'];

// Popular opening positions
const OPENINGS = [
  { eco: 'C50', name: 'Italian Game', moves: '1.e4 e5 2.Nf3 Nc6 3.Bc4', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3' },
  { eco: 'B10', name: 'Caro-Kann Defense', moves: '1.e4 c6', fen: 'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
  { eco: 'D02', name: 'London System', moves: '1.d4 d5 2.Bf4', fen: 'rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2' },
  { eco: 'A04', name: 'Reti Opening', moves: '1.Nf3', fen: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1' },
  { eco: 'B01', name: 'Scandinavian Defense', moves: '1.e4 d5', fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
  { eco: 'C01', name: 'French Defense', moves: '1.e4 e6', fen: 'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
  { eco: 'B07', name: 'Pirc Defense', moves: '1.e4 d6', fen: 'rnbqkbnr/ppp1pppp/3p4/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
  { eco: 'E60', name: "King's Indian Defense", moves: '1.d4 Nf6 2.c4 g6', fen: 'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3' },
];

interface Move {
  san: string;
  uci: string;
  white: number;
  draws: number;
  black: number;
  games: number;
  winRate: string;
  drawRate: string;
  blackWinRate: string;
}

interface ExplorerData {
  opening?: { eco: string; name: string };
  white: number;
  draws: number;
  black: number;
  moves: Move[];
  topGames?: any[];
}

import { API_BASE_URL } from '@/lib/config';

export default function OpeningsPage() {
  const [selectedOpening, setSelectedOpening] = useState(OPENINGS[0]);
  const [ratingFilter, setRatingFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [currentFen, setCurrentFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [explorerData, setExplorerData] = useState<ExplorerData | null>(null);
  const [loadingExplorer, setLoadingExplorer] = useState(false);
  const [activeTab, setActiveTab] = useState<'popular' | 'explorer'>('popular');

  // Fetch opening statistics
  const { data: openingStats } = useQuery({
    queryKey: ['opening-stats'],
    queryFn: () => fetch(`${API_BASE_URL}/api/stats/openings`).then(res => res.json()),
  });

  useEffect(() => {
    if (activeTab === 'explorer') {
      fetchExplorerData();
    }
  }, [moveHistory, activeTab]);

  const fetchExplorerData = async () => {
    setLoadingExplorer(true);
    try {
      const play = moveHistory.join(',');
      const response = await axios.get(`${API_BASE_URL}/api/openings/explorer`, {
        params: { play: play || undefined }
      });
      setExplorerData(response.data);
    } catch (error) {
      console.error('Failed to fetch explorer data:', error);
    } finally {
      setLoadingExplorer(false);
    }
  };

  const handleMoveClick = (move: Move) => {
    setMoveHistory([...moveHistory, move.uci]);
    // In a real implementation, you'd update the FEN based on the move
    // For now, we'll just track the moves
  };

  const goBackMove = () => {
    if (moveHistory.length > 0) {
      setMoveHistory(moveHistory.slice(0, -1));
    }
  };

  const resetPosition = () => {
    setMoveHistory([]);
    setCurrentFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  };

  const filteredOpenings = OPENINGS.filter(opening => 
    searchQuery === '' || 
    opening.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opening.eco.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Find stats for selected opening
  const currentOpeningStats = openingStats?.popular?.find(
    (o: any) => o.eco === selectedOpening.eco
  ) || {
    games: 0,
    winRate: 50,
    drawRate: 25,
    lossRate: 25,
  };

  // Calculate loss rate
  currentOpeningStats.lossRate = 100 - currentOpeningStats.winRate - currentOpeningStats.drawRate;

  // Pie chart data
  const pieData = [
    { name: 'Win', value: currentOpeningStats.winRate, color: '#10B981' },
    { name: 'Draw', value: currentOpeningStats.drawRate, color: '#F59E0B' },
    { name: 'Loss', value: currentOpeningStats.lossRate, color: '#EF4444' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Opening Explorer</h1>
        <p className="text-gray-600">
          Explore chess openings with statistics, win rates, and popular variations
        </p>
        
        {/* Tab Navigation */}
        <div className="mt-6 border-b border-gray-200">
          <nav className="flex gap-8">
            {[
              { id: 'popular', label: 'Popular Openings', icon: BookOpen },
              { id: 'explorer', label: 'Interactive Explorer', icon: Database }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Popular Openings Tab */}
      {activeTab === 'popular' && (
        <div className="grid lg:grid-cols-3 gap-8">
        {/* Opening List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Popular Openings
            </h2>
            
            {/* Search and Filter */}
            <div className="space-y-3 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search openings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
              >
                <option value="all">All Ratings</option>
                <option value="1000-1400">1000-1400</option>
                <option value="1400-1800">1400-1800</option>
                <option value="1800+">1800+</option>
              </select>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredOpenings.map((opening) => {
                const stats = openingStats?.popular?.find((o: any) => o.eco === opening.eco);
                return (
                  <button
                    key={opening.eco}
                    onClick={() => setSelectedOpening(opening)}
                    className={`w-full text-left p-3 rounded-lg transition ${
                      selectedOpening.eco === opening.eco
                        ? 'bg-blue-50 border-2 border-blue-500'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{opening.name}</div>
                        <div className="text-sm text-gray-600">{opening.eco} • {opening.moves}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                    {stats && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="text-green-600">W: {stats.winRate}%</span>
                        <span className="text-yellow-600">D: {stats.drawRate}%</span>
                        <span className="text-gray-600">{(stats.games / 1000000).toFixed(1)}M games</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Board and Stats */}
        <div className="lg:col-span-2 space-y-8">
          {/* Chess Board */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">{selectedOpening.name}</h2>
            <div className="flex justify-center mb-4">
              <ChessBoard
                fen={selectedOpening.fen}
                interactive={false}
                showControls={false}
                boardWidth={400}
              />
            </div>
            <div className="text-center">
              <div className="text-lg font-mono mb-2">{selectedOpening.moves}</div>
              <div className="text-sm text-gray-600">ECO Code: {selectedOpening.eco}</div>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Win/Draw/Loss Pie Chart */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-600" />
                Results Distribution
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 text-center text-sm text-gray-600">
                Based on {(currentOpeningStats.games / 1000000).toFixed(1)}M games
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-blue-600" />
                Key Statistics
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">Total Games</span>
                  <span className="font-semibold">{currentOpeningStats.games?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span className="text-sm text-gray-600">White Win Rate</span>
                  <span className="font-semibold text-green-600">{currentOpeningStats.winRate}%</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                  <span className="text-sm text-gray-600">Draw Rate</span>
                  <span className="font-semibold text-yellow-600">{currentOpeningStats.drawRate}%</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                  <span className="text-sm text-gray-600">Black Win Rate</span>
                  <span className="font-semibold text-red-600">{currentOpeningStats.lossRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Popular at Different Ratings */}
          {openingStats?.byRating && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Popularity by Rating
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                {Object.entries(openingStats.byRating).map(([rating, openings]: [string, any]) => (
                  <div key={rating} className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-3 text-center">{rating}</h4>
                    <div className="space-y-2">
                      {openings.slice(0, 3).map((opening: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span className="text-sm truncate">{opening.name}</span>
                          <span className="text-sm font-semibold text-blue-600">{opening.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Players Using This Opening */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              Master Players
            </h3>
            <div className="text-sm text-gray-600 mb-4">
              Notable players who frequently use {selectedOpening.name}:
            </div>
            <div className="flex flex-wrap gap-2">
              {['Magnus Carlsen', 'Hikaru Nakamura', 'Fabiano Caruana', 'Ian Nepomniachtchi', 'Ding Liren'].map((player) => (
                <span key={player} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm">
                  {player}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Interactive Explorer Tab */}
      {activeTab === 'explorer' && (
        <div className="grid lg:grid-cols-3 gap-8">
            {/* Move Explorer */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    Move Explorer
                  </h2>
                  <div className="flex gap-1">
                    <button
                      onClick={goBackMove}
                      disabled={moveHistory.length === 0}
                      className="p-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded transition"
                      title="Go back one move"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={resetPosition}
                      disabled={moveHistory.length === 0}
                      className="p-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded transition"
                      title="Reset to starting position"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Move History */}
                {moveHistory.length > 0 && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 mb-1">Move History:</div>
                    <div className="text-sm text-gray-600 font-mono">
                      {moveHistory.join(' ')}
                    </div>
                  </div>
                )}

                {/* Available Moves */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    {loadingExplorer ? 'Loading moves...' : `Available Moves (${explorerData?.moves?.length || 0})`}
                  </h3>
                  
                  {loadingExplorer ? (
                    <div className="space-y-2">
                      {Array.from({length: 5}).map((_, i) => (
                        <div key={i} className="animate-pulse bg-gray-200 rounded h-12"></div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {explorerData?.moves?.map((move, index) => (
                        <button
                          key={index}
                          onClick={() => handleMoveClick(move)}
                          className="w-full text-left p-3 rounded-lg hover:bg-blue-50 border border-gray-200 hover:border-blue-300 transition"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold text-lg">{move.san}</div>
                            <div className="text-sm text-gray-600">{move.games.toLocaleString()} games</div>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-green-600">White: {move.winRate}%</span>
                            <span className="text-yellow-600">Draw: {move.drawRate}%</span>
                            <span className="text-red-600">Black: {move.blackWinRate}%</span>
                          </div>
                          <div className="mt-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-green-500 h-full float-left" 
                              style={{ width: `${move.winRate}%` }}
                            ></div>
                            <div 
                              className="bg-yellow-500 h-full float-left" 
                              style={{ width: `${move.drawRate}%` }}
                            ></div>
                            <div 
                              className="bg-red-500 h-full float-left" 
                              style={{ width: `${move.blackWinRate}%` }}
                            ></div>
                          </div>
                        </button>
                      )) || (
                        <div className="text-center py-8 text-gray-500">
                          <Play className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>No moves available from this position</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Board and Position Stats */}
            <div className="lg:col-span-2 space-y-6">
              {/* Chess Board */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">
                    {explorerData?.opening ? `${explorerData.opening.name} (${explorerData.opening.eco})` : 'Starting Position'}
                  </h2>
                  <div className="text-sm text-gray-500">
                    Move {Math.floor(moveHistory.length / 2) + 1}
                  </div>
                </div>
                <div className="flex justify-center mb-4">
                  <ChessBoard
                    fen={currentFen}
                    interactive={false}
                    showControls={false}
                    boardWidth={400}
                  />
                </div>
                {moveHistory.length > 0 && (
                  <div className="text-center">
                    <div className="text-lg font-mono mb-2">
                      {moveHistory.map((move, i) => (
                        <span key={i}>
                          {i % 2 === 0 && `${Math.floor(i / 2) + 1}.`} {move}{' '}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Position Statistics */}
              {explorerData && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-blue-600" />
                    Position Results
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm text-gray-600">White Wins</span>
                      <span className="font-semibold text-green-600">
                        {explorerData.white.toLocaleString()} 
                        ({((explorerData.white / (explorerData.white + explorerData.draws + explorerData.black)) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                      <span className="text-sm text-gray-600">Draws</span>
                      <span className="font-semibold text-yellow-600">
                        {explorerData.draws.toLocaleString()}
                        ({((explorerData.draws / (explorerData.white + explorerData.draws + explorerData.black)) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                      <span className="text-sm text-gray-600">Black Wins</span>
                      <span className="font-semibold text-red-600">
                        {explorerData.black.toLocaleString()}
                        ({((explorerData.black / (explorerData.white + explorerData.draws + explorerData.black)) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 rounded border-t">
                      <span className="text-sm text-gray-600 font-medium">Total Games</span>
                      <span className="font-bold text-gray-800">
                        {(explorerData.white + explorerData.draws + explorerData.black).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
  );
}