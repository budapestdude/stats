'use client';

import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { ChevronLeft, ChevronRight, SkipBack, SkipForward, Play, Pause, X } from 'lucide-react';

interface GameViewerProps {
  gameId: string | number;
  onClose?: () => void;
}

interface GameData {
  id: string | number;
  white: string;
  black: string;
  result: string;
  date: string;
  event: string;
  site?: string;
  round?: string;
  eco?: string;
  opening?: string;
  whiteElo?: number;
  blackElo?: number;
  moves: string;
  pgn?: string;
}

export default function GameViewer({ gameId, onClose }: GameViewerProps) {
  const [game, setGame] = useState<Chess>(new Chess());
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [currentMove, setCurrentMove] = useState(0);
  const [moves, setMoves] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boardPosition, setBoardPosition] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

  useEffect(() => {
    // Reset state when gameId changes
    setCurrentMove(0);
    setMoves([]);
    setIsPlaying(false);
    const newGame = new Chess();
    setGame(newGame);
    setBoardPosition(newGame.fen());
    fetchGame();
  }, [gameId]);

  useEffect(() => {
    if (isPlaying && currentMove < moves.length) {
      const timer = setTimeout(() => {
        goToMove(currentMove + 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (currentMove >= moves.length) {
      setIsPlaying(false);
    }
  }, [isPlaying, currentMove, moves.length]);

  const fetchGame = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3007/api/otb/database/game/${gameId}`);
      if (!response.ok) throw new Error('Failed to fetch game');
      
      const data = await response.json();
      setGameData(data);
      
      // Parse moves
      if (data.moves) {
        const chess = new Chess();
        // Split moves by spaces and filter out empty strings, results, and ellipsis
        const moveList = data.moves
          .split(/\s+/)
          .filter((m: string) => {
            // Keep only valid move notation (not empty, not results like 1-0, not ellipsis)
            return m && 
                   !m.match(/^(1-0|0-1|1\/2-1\/2|\*|\.\.\.)$/) &&
                   !m.match(/^\d+\.$/); // Remove standalone move numbers
          });
        
        const validMoves: string[] = [];
        
        for (const move of moveList) {
          try {
            // Try to parse the move
            const result = chess.move(move);
            if (result) {
              // Store the SAN notation for replay
              validMoves.push(result.san);
            }
          } catch (e) {
            // Try without special characters if initial parse fails
            const cleanMove = move.replace(/[+#!?]/g, '');
            try {
              const result = chess.move(cleanMove);
              if (result) {
                validMoves.push(result.san);
              }
            } catch (e2) {
              console.warn('Skipping invalid move:', move);
            }
          }
        }
        
        console.log(`Parsed ${validMoves.length} valid moves from ${moveList.length} tokens`);
        console.log('First 10 moves:', validMoves.slice(0, 10));
        setMoves(validMoves);
        
        // Reset to initial position
        const initialGame = new Chess();
        setGame(initialGame);
        setBoardPosition(initialGame.fen());
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game');
    } finally {
      setLoading(false);
    }
  };

  const goToMove = (moveIndex: number) => {
    if (moveIndex < 0 || moveIndex > moves.length) return;
    
    console.log(`Going to move ${moveIndex} of ${moves.length}`);
    console.log('Current moves array:', moves.slice(0, Math.min(10, moves.length)));
    
    const newGame = new Chess();
    for (let i = 0; i < moveIndex; i++) {
      try {
        console.log(`Applying move ${i}: ${moves[i]}`);
        const move = newGame.move(moves[i]);
        if (!move) {
          console.error('Failed to make move:', moves[i]);
          break;
        }
        console.log(`Successfully applied move ${i}: ${move.san}`);
      } catch (e) {
        console.error('Error applying move:', moves[i], e);
        break;
      }
    }
    
    const newPosition = newGame.fen();
    console.log('New position FEN:', newPosition);
    console.log('Board should update to this position');
    
    setGame(newGame);
    setBoardPosition(newPosition);
    setCurrentMove(moveIndex);
    
    if (moveIndex >= moves.length) {
      setIsPlaying(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') goToMove(currentMove - 1);
    if (e.key === 'ArrowRight') goToMove(currentMove + 1);
    if (e.key === 'Home') goToMove(0);
    if (e.key === 'End') goToMove(moves.length);
    if (e.key === ' ') {
      e.preventDefault();
      setIsPlaying(!isPlaying);
    }
    if (e.key === 'Escape' && onClose) onClose();
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentMove, moves.length, isPlaying]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading game...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!gameData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">No game data available</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full"
        >
          <X className="h-5 w-5" />
        </button>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chess Board */}
        <div className="space-y-4">
          <div className="aspect-square max-w-[500px] mx-auto">
            <Chessboard 
              position={boardPosition} 
              arePiecesDraggable={false}
              boardOrientation="white"
              key={`board-${currentMove}-${boardPosition.substring(0, 10)}`}
            />
          </div>
          
          {/* Controls */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => goToMove(0)}
              className="p-2 hover:bg-gray-100 rounded"
              title="First move (Home)"
            >
              <SkipBack className="h-5 w-5" />
            </button>
            
            <button
              onClick={() => goToMove(currentMove - 1)}
              className="p-2 hover:bg-gray-100 rounded"
              disabled={currentMove === 0}
              title="Previous move (←)"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 hover:bg-gray-100 rounded"
              title="Play/Pause (Space)"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            
            <button
              onClick={() => goToMove(currentMove + 1)}
              className="p-2 hover:bg-gray-100 rounded"
              disabled={currentMove >= moves.length}
              title="Next move (→)"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            
            <button
              onClick={() => goToMove(moves.length)}
              className="p-2 hover:bg-gray-100 rounded"
              title="Last move (End)"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>
          
          <div className="text-center text-sm text-gray-600">
            Move {currentMove} of {moves.length}
            {moves.length === 0 && gameData && (
              <div className="text-red-500 mt-2">No valid moves could be parsed</div>
            )}
          </div>
        </div>
        
        {/* Game Info */}
        <div className="space-y-4">
          <div className="border-b pb-4">
            <h2 className="text-2xl font-bold mb-2">
              {gameData.white} vs {gameData.black}
            </h2>
            <div className="text-lg font-semibold">
              Result: {gameData.result}
            </div>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Event:</span>
              <span className="font-medium">{gameData.event || 'Unknown'}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Date:</span>
              <span className="font-medium">{gameData.date || 'Unknown'}</span>
            </div>
            
            {gameData.round && (
              <div className="flex justify-between">
                <span className="text-gray-600">Round:</span>
                <span className="font-medium">{gameData.round}</span>
              </div>
            )}
            
            {gameData.eco && (
              <div className="flex justify-between">
                <span className="text-gray-600">ECO:</span>
                <span className="font-medium">{gameData.eco}</span>
              </div>
            )}
            
            {gameData.opening && (
              <div className="flex justify-between">
                <span className="text-gray-600">Opening:</span>
                <span className="font-medium">{gameData.opening}</span>
              </div>
            )}
            
            {(gameData.whiteElo || gameData.blackElo) && (
              <div className="flex justify-between">
                <span className="text-gray-600">Ratings:</span>
                <span className="font-medium">
                  {gameData.whiteElo || '?'} - {gameData.blackElo || '?'}
                </span>
              </div>
            )}
          </div>
          
          {/* Move List */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">
              Moves {moves.length > 0 && `(${moves.length} half-moves)`}
            </h3>
            <div className="max-h-64 overflow-y-auto bg-gray-50 rounded p-3">
              {moves.length > 0 ? (
                <div className="grid grid-cols-2 gap-x-4 text-sm">
                  {moves.map((move, index) => {
                  const moveNumber = Math.floor(index / 2) + 1;
                  const isWhiteMove = index % 2 === 0;
                  
                  return (
                    <div
                      key={index}
                      className={`py-1 px-2 rounded cursor-pointer hover:bg-gray-200 transition-colors ${
                        index < currentMove ? 'bg-gray-100' : ''
                      } ${index === currentMove - 1 ? 'bg-blue-200 font-semibold' : ''}`}
                      onClick={() => goToMove(index + 1)}
                      title={`Move ${moveNumber} ${isWhiteMove ? '(White)' : '(Black)'}`}
                    >
                      <span className="text-gray-500 mr-1">
                        {moveNumber}.{isWhiteMove ? '' : '..'}
                      </span>
                      <span className="font-medium">{move}</span>
                    </div>
                  );
                  })}
                </div>
              ) : (
                <div className="text-gray-500 text-center py-4">
                  {gameData?.moves ? 'Processing moves...' : 'No moves available for this game'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}