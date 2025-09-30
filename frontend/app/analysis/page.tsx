'use client';

import { useState } from 'react';
import ChessBoard from '@/components/ChessBoard';
import { Copy, Download, Upload, Zap } from 'lucide-react';

// Famous game: Kasparov vs Topalov, 1999 (Kasparov's Immortal)
const SAMPLE_PGN = `[Event "Hoogovens"]
[Site "Wijk aan Zee NED"]
[Date "1999.01.20"]
[Round "4"]
[White "Garry Kasparov"]
[Black "Veselin Topalov"]
[Result "1-0"]

1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Be3 Bg7 5.Qd2 c6 6.f3 b5 7.Nge2 Nbd7 8.Bh6 Bxh6
9.Qxh6 Bb7 10.a3 e5 11.O-O-O Qe7 12.Kb1 a6 13.Nc1 O-O-O 14.Nb3 exd4 15.Rxd4
c5 16.Rd1 Nb6 17.g3 Kb8 18.Na5 Ba8 19.Bh3 d5 20.Qf4+ Ka7 21.Rhe1 d4 22.Nd5
Nbxd5 23.exd5 Qd6 24.Rxd4 cxd4 25.Re7+ Kb6 26.Qxd4+ Kxa5 27.b4+ Ka4 28.Qc3
Qxd5 29.Ra7 Bb7 30.Rxb7 Qc4 31.Qxf6 Kxa3 32.Qxa6+ Kxb4 33.c3+ Kxc3 34.Qa1+
Kd2 35.Qb2+ Kd1 36.Bf1 Rd2 37.Rd7 Rxd7 38.Bxc4 bxc4 39.Qxh8 Rd3 40.Qa8 c3
41.Qa4+ Ke1 42.f4 f5 43.Kc1 Rd2 44.Qa7 1-0`;

export default function AnalysisPage() {
  const [pgn, setPgn] = useState(SAMPLE_PGN);
  const [currentPgn, setCurrentPgn] = useState(SAMPLE_PGN);
  const [fen, setFen] = useState('');
  const [activeTab, setActiveTab] = useState<'pgn' | 'fen'>('pgn');

  const handleLoadPgn = () => {
    setCurrentPgn(pgn);
    setActiveTab('pgn');
  };

  const handleLoadFen = () => {
    setActiveTab('fen');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setPgn(content);
        setCurrentPgn(content);
      };
      reader.readAsText(file);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Game Analysis</h1>
        <p className="text-gray-600">
          Analyze chess games with an interactive board. Load PGN files or paste positions to explore.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Chess Board */}
        <div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Interactive Board</h2>
            <div className="flex justify-center">
              <ChessBoard
                pgn={activeTab === 'pgn' ? currentPgn : ''}
                fen={activeTab === 'fen' ? fen : undefined}
                interactive={true}
                showControls={true}
                boardWidth={480}
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setPgn(SAMPLE_PGN);
                  setCurrentPgn(SAMPLE_PGN);
                  setActiveTab('pgn');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 justify-center"
              >
                <Zap className="w-4 h-4" />
                Load Sample Game
              </button>
              <button
                onClick={() => {
                  setFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
                  setActiveTab('fen');
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2 justify-center"
              >
                Starting Position
              </button>
            </div>
          </div>
        </div>

        {/* Input Panel */}
        <div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('pgn')}
                className={`px-4 py-2 rounded-lg transition ${
                  activeTab === 'pgn'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                PGN
              </button>
              <button
                onClick={() => setActiveTab('fen')}
                className={`px-4 py-2 rounded-lg transition ${
                  activeTab === 'fen'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                FEN
              </button>
            </div>

            {activeTab === 'pgn' ? (
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PGN Notation
                  </label>
                  <textarea
                    value={pgn}
                    onChange={(e) => setPgn(e.target.value)}
                    className="w-full h-64 p-3 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Paste PGN here..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleLoadPgn}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Load PGN
                  </button>
                  <button
                    onClick={() => copyToClipboard(pgn)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                  <label className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Upload PGN
                    <input
                      type="file"
                      accept=".pgn"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    FEN Position
                  </label>
                  <input
                    type="text"
                    value={fen}
                    onChange={(e) => setFen(e.target.value)}
                    className="w-full p-3 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleLoadFen}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Load FEN
                  </button>
                  <button
                    onClick={() => copyToClipboard(fen)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Game Info */}
          {activeTab === 'pgn' && currentPgn && (
            <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
              <h3 className="text-lg font-semibold mb-4">Game Information</h3>
              <div className="space-y-2 text-sm">
                {currentPgn.match(/\[White "(.+?)"\]/)?.[1] && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">White:</span>
                    <span className="font-medium">
                      {currentPgn.match(/\[White "(.+?)"\]/)?.[1]}
                    </span>
                  </div>
                )}
                {currentPgn.match(/\[Black "(.+?)"\]/)?.[1] && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Black:</span>
                    <span className="font-medium">
                      {currentPgn.match(/\[Black "(.+?)"\]/)?.[1]}
                    </span>
                  </div>
                )}
                {currentPgn.match(/\[Result "(.+?)"\]/)?.[1] && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Result:</span>
                    <span className="font-medium">
                      {currentPgn.match(/\[Result "(.+?)"\]/)?.[1]}
                    </span>
                  </div>
                )}
                {currentPgn.match(/\[Event "(.+?)"\]/)?.[1] && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Event:</span>
                    <span className="font-medium">
                      {currentPgn.match(/\[Event "(.+?)"\]/)?.[1]}
                    </span>
                  </div>
                )}
                {currentPgn.match(/\[Date "(.+?)"\]/)?.[1] && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium">
                      {currentPgn.match(/\[Date "(.+?)"\]/)?.[1]}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}