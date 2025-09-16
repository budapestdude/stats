const fs = require('fs');
const path = require('path');

const players = [
  { slug: 'anatoly-karpov', name: 'Anatoly Karpov', title: 'World Champion 1975-1985' },
  { slug: 'viswanathan-anand', name: 'Viswanathan Anand', title: 'World Champion 2007-2013' },
  { slug: 'vladimir-kramnik', name: 'Vladimir Kramnik', title: 'World Champion 2000-2007' },
  { slug: 'fabiano-caruana', name: 'Fabiano Caruana', title: 'US #1 • Peak Rating 2844' },
  { slug: 'hikaru-nakamura', name: 'Hikaru Nakamura', title: '5-time US Champion' },
  { slug: 'ian-nepomniachtchi', name: 'Ian Nepomniachtchi', title: '2x World Championship Challenger' },
  { slug: 'levon-aronian', name: 'Levon Aronian', title: 'Peak Rating 2830' },
  { slug: 'bobby-fischer', name: 'Bobby Fischer', title: 'World Champion 1972-1975' },
  { slug: 'ding-liren', name: 'Ding Liren', title: 'World Champion 2023-present' }
];

const pageTemplate = (playerName, playerTitle, slug) => `'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Trophy, TrendingUp, Users, Target, Award, Calendar } from 'lucide-react';

export default function ${playerName.replace(/\s+/g, '')}Page() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayerData = async () => {
      try {
        const response = await fetch('http://localhost:3005/api/players/${slug}/stats');
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Error fetching player data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">${playerName} - OTB Statistics</h1>
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-gray-600">No data available for this player yet.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const performanceByColor = [
    { name: 'White', games: data.byColor?.white?.games || 0, winRate: data.byColor?.white?.winRate || 0, color: '#ffffff' },
    { name: 'Black', games: data.byColor?.black?.games || 0, winRate: data.byColor?.black?.winRate || 0, color: '#000000' }
  ];

  const resultDistribution = [
    { name: 'Wins', value: data.overview?.wins || 0, color: '#10b981' },
    { name: 'Draws', value: data.overview?.draws || 0, color: '#6b7280' },
    { name: 'Losses', value: data.overview?.losses || 0, color: '#ef4444' }
  ];

  const yearlyData = Object.entries(data.yearlyStats || {})
    .map(([year, stats]: [string, any]) => ({
      year: parseInt(year),
      winRate: parseFloat(stats.winRate || 0),
      games: stats.games || 0,
      avgOpponentRating: stats.avgOpponentRating || 0
    }))
    .sort((a, b) => a.year - b.year);

  const topOpenings = Object.entries(data.openingStats || {})
    .map(([opening, stats]: [string, any]) => ({
      opening: opening.length > 30 ? opening.substring(0, 30) + '...' : opening,
      games: stats.games || 0,
      winRate: parseFloat(stats.winRate || 0)
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 10);

  const topOpponents = Object.entries(data.opponentStats || {})
    .map(([opponent, stats]: [string, any]) => ({
      opponent,
      games: stats.games || 0,
      wins: stats.wins || 0,
      draws: stats.draws || 0,
      losses: stats.losses || 0,
      score: ((stats.wins || 0) + (stats.draws || 0) * 0.5) / (stats.games || 1) * 100
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 15);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">${playerName}</h1>
          <p className="text-gray-600">${playerTitle} • OTB Career Statistics</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Trophy className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold">{data.overview?.totalGames || 0}</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Total Games</p>
              <p className="text-xs text-gray-500 mt-1">
                {data.overview?.wins || 0}W / {data.overview?.draws || 0}D / {data.overview?.losses || 0}L
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold">{data.overview?.winRate || '0'}%</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Win Rate</p>
              <p className="text-xs text-gray-500 mt-1">
                Performance: {data.overview?.performanceScore || '0'}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Target className="h-5 w-5 text-purple-600" />
                <span className="text-2xl font-bold">{data.peakRating || 'N/A'}</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Peak Rating</p>
              <p className="text-xs text-gray-500 mt-1">
                Avg Opp: {Math.round(data.avgOpponentRating || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Calendar className="h-5 w-5 text-orange-600" />
                <span className="text-2xl font-bold">
                  {yearlyData.length > 0 ? \`\${yearlyData[0].year}-\${yearlyData[yearlyData.length - 1].year}\` : 'N/A'}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Career Span</p>
              <p className="text-xs text-gray-500 mt-1">
                {yearlyData.length} active years
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Year</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="winRate" stroke="#3b82f6" name="Win Rate %" />
                  <Line type="monotone" dataKey="games" stroke="#10b981" name="Games" yAxisId="right" />
                  <YAxis yAxisId="right" orientation="right" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Result Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={resultDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => \`\${name}: \${value} (\${(percent * 100).toFixed(1)}%)\`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {resultDistribution.map((entry, index) => (
                      <Cell key={\`cell-\${index}\`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Top Opening Repertoire</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topOpenings} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="opening" type="category" width={150} />
                  <Tooltip />
                  <Bar dataKey="games" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance by Color</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {performanceByColor.map(color => (
                  <div key={color.name} className="flex items-center justify-between p-4 rounded-lg bg-gray-100">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded border-2 border-gray-300"
                        style={{ backgroundColor: color.color }}
                      />
                      <div>
                        <p className="font-semibold">{color.name}</p>
                        <p className="text-sm text-gray-600">{color.games} games</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{color.winRate}%</p>
                      <p className="text-sm text-gray-600">Win Rate</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Notable Opponents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Opponent</th>
                    <th className="text-center py-2">Games</th>
                    <th className="text-center py-2">Wins</th>
                    <th className="text-center py-2">Draws</th>
                    <th className="text-center py-2">Losses</th>
                    <th className="text-center py-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {topOpponents.map(opp => (
                    <tr key={opp.opponent} className="border-b">
                      <td className="py-2">{opp.opponent}</td>
                      <td className="text-center">{opp.games}</td>
                      <td className="text-center text-green-600">{opp.wins}</td>
                      <td className="text-center text-gray-600">{opp.draws}</td>
                      <td className="text-center text-red-600">{opp.losses}</td>
                      <td className="text-center font-semibold">{opp.score.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}`;

players.forEach(player => {
  const dir = path.join(__dirname, 'frontend', 'app', 'players', player.slug);
  fs.mkdirSync(dir, { recursive: true });
  
  const filePath = path.join(dir, 'page.tsx');
  fs.writeFileSync(filePath, pageTemplate(player.name, player.title, player.slug));
  console.log(`Created ${filePath}`);
});

console.log('All player pages created successfully!');