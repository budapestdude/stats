'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Trophy, TrendingUp, Globe, Activity, CheckCircle, Star, Zap } from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

export default function PlatformsPage() {
  const [selectedCategory, setSelectedCategory] = useState('rapid');
  const [selectedPlatform, setSelectedPlatform] = useState<'chesscom' | 'lichess' | 'both'>('both');

  // Fetch platform comparison
  const { data: platformComparison } = useQuery({
    queryKey: ['platform-comparison'],
    queryFn: () => fetch('http://localhost:3005/api/stats/platform-comparison').then(res => res.json()),
  });

  // Fetch Chess.com top players
  const { data: chesscomTop } = useQuery({
    queryKey: ['chesscom-top', selectedCategory],
    queryFn: () => fetch(`http://localhost:3005/api/players/top?category=${selectedCategory}`).then(res => res.json()),
    enabled: selectedPlatform !== 'lichess',
  });

  // Fetch Lichess top players
  const { data: lichessTop } = useQuery({
    queryKey: ['lichess-top', selectedCategory],
    queryFn: () => fetch(`http://localhost:3005/api/lichess/top/${selectedCategory}`).then(res => res.json()),
    enabled: selectedPlatform !== 'chesscom',
  });

  const ratingComparisonData = [
    {
      format: 'Bullet',
      ChessCom: platformComparison?.platforms[0]?.averageRating?.bullet || 0,
      Lichess: platformComparison?.platforms[1]?.averageRating?.bullet || 0,
    },
    {
      format: 'Blitz',
      ChessCom: platformComparison?.platforms[0]?.averageRating?.blitz || 0,
      Lichess: platformComparison?.platforms[1]?.averageRating?.blitz || 0,
    },
    {
      format: 'Rapid',
      ChessCom: platformComparison?.platforms[0]?.averageRating?.rapid || 0,
      Lichess: platformComparison?.platforms[1]?.averageRating?.rapid || 0,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Platform Comparison</h1>
        <p className="text-gray-600">
          Compare Chess.com and Lichess statistics, top players, and features
        </p>
      </div>

      {/* Platform Overview Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Chess.com Card */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-green-800">Chess.com</h2>
            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-700">Total Users</span>
              <span className="font-bold text-green-700">
                {platformComparison?.platforms[0]?.totalUsers?.toLocaleString() || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Daily Active</span>
              <span className="font-bold text-green-700">
                {platformComparison?.platforms[0]?.activeDaily?.toLocaleString() || '-'}
              </span>
            </div>
            <div className="pt-3 border-t border-green-200">
              <div className="text-sm text-gray-700 mb-2">Features:</div>
              <div className="flex flex-wrap gap-2">
                {platformComparison?.platforms[0]?.features?.map((feature: string) => (
                  <span key={feature} className="px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Lichess Card */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-blue-800">Lichess</h2>
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <Star className="w-6 h-6 text-white" />
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-700">Total Users</span>
              <span className="font-bold text-blue-700">
                {platformComparison?.platforms[1]?.totalUsers?.toLocaleString() || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Daily Active</span>
              <span className="font-bold text-blue-700">
                {platformComparison?.platforms[1]?.activeDaily?.toLocaleString() || '-'}
              </span>
            </div>
            <div className="pt-3 border-t border-blue-200">
              <div className="text-sm text-gray-700 mb-2">Features:</div>
              <div className="flex flex-wrap gap-2">
                {platformComparison?.platforms[1]?.features?.map((feature: string) => (
                  <span key={feature} className="px-2 py-1 bg-blue-200 text-blue-800 rounded-full text-xs">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Average Rating Comparison */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-xl font-semibold mb-6">Average Rating Comparison</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={ratingComparisonData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="format" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="ChessCom" fill="#10B981" name="Chess.com" />
            <Bar dataKey="Lichess" fill="#3B82F6" name="Lichess" />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 text-sm text-gray-600 text-center">
          Note: Lichess uses a different rating system starting at 1500
        </div>
      </div>

      {/* Top Players Comparison */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Top Players by Platform</h2>
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="bullet">Bullet</option>
              <option value="blitz">Blitz</option>
              <option value="rapid">Rapid</option>
              <option value="classical">Classical</option>
            </select>
            <div className="flex gap-1">
              <button
                onClick={() => setSelectedPlatform('both')}
                className={`px-4 py-2 rounded-lg transition ${
                  selectedPlatform === 'both'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Both
              </button>
              <button
                onClick={() => setSelectedPlatform('chesscom')}
                className={`px-4 py-2 rounded-lg transition ${
                  selectedPlatform === 'chesscom'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Chess.com
              </button>
              <button
                onClick={() => setSelectedPlatform('lichess')}
                className={`px-4 py-2 rounded-lg transition ${
                  selectedPlatform === 'lichess'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Lichess
              </button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Chess.com Top Players */}
          {selectedPlatform !== 'lichess' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 text-green-600">Chess.com Top {selectedCategory}</h3>
              <div className="space-y-2">
                {chesscomTop?.slice(0, 10).map((player: any, idx: number) => (
                  <Link
                    key={idx}
                    href={`/players/${player.username}?platform=chesscom`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-400">#{idx + 1}</span>
                      <div>
                        <div className="font-semibold">
                          {player.title && (
                            <span className="text-xs font-bold text-orange-600 mr-1">
                              {player.title}
                            </span>
                          )}
                          {player.username}
                        </div>
                        <div className="text-xs text-gray-600">{player.country}</div>
                      </div>
                    </div>
                    <div className="text-lg font-bold text-green-600">
                      {player.current_ratings?.[selectedCategory] || player.current_ratings?.rapid || '-'}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Lichess Top Players */}
          {selectedPlatform !== 'chesscom' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 text-blue-600">Lichess Top {selectedCategory}</h3>
              <div className="space-y-2">
                {lichessTop?.map((player: any) => (
                  <Link
                    key={player.username}
                    href={`/players/${player.username}?platform=lichess`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-400">#{player.rank}</span>
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {player.title && (
                            <span className="text-xs font-bold text-orange-600">
                              {player.title}
                            </span>
                          )}
                          {player.username}
                          {player.online && (
                            <span className="w-2 h-2 bg-green-500 rounded-full" title="Online" />
                          )}
                        </div>
                        {player.progress !== 0 && (
                          <div className="text-xs text-gray-600">
                            {player.progress > 0 ? '+' : ''}{player.progress} today
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-lg font-bold text-blue-600">
                      {player.rating}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Platform Features Comparison */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-6">Platform Features</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-semibold text-green-600 mb-3">Chess.com Advantages</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <span>Largest player base (100M+ users)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <span>Structured learning with lessons and courses</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <span>Play against computer bots of various strengths</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <span>Mobile app with full features</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <span>Daily puzzles and puzzle rush</span>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-blue-600 mb-3">Lichess Advantages</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Star className="w-5 h-5 text-blue-600 mt-0.5" />
                <span>Completely free and open source</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-5 h-5 text-blue-600 mt-0.5" />
                <span>No ads or premium features</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-5 h-5 text-blue-600 mt-0.5" />
                <span>Advanced analysis tools and studies</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-5 h-5 text-blue-600 mt-0.5" />
                <span>Cleaner, minimalist interface</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-5 h-5 text-blue-600 mt-0.5" />
                <span>Strong tournament system</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}