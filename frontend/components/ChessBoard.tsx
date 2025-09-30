'use client';

import { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { RotateCw, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';

interface ChessBoardProps {
  pgn?: string;
  fen?: string;
  interactive?: boolean;
  showControls?: boolean;
  boardWidth?: number;
  onMove?: (move: any) => void;
}

export default function ChessBoard({
  pgn = '',
  fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  interactive = true,
  showControls = true,
  boardWidth = 560,
  onMove,
}: ChessBoardProps) {
  const [game, setGame] = useState(new Chess());
  const [currentPosition, setCurrentPosition] = useState(fen);
  const [moves, setMoves] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');

  useEffect(() => {
    const newGame = new Chess();
    
    if (pgn) {
      try {
        newGame.loadPgn(pgn);
        const history = newGame.history();
        setMoves(history);
        // Reset to starting position
        newGame.reset();
        setGame(newGame);
        setCurrentPosition(newGame.fen());
        setCurrentMoveIndex(-1);
      } catch (error) {
        console.error('Invalid PGN:', error);
        newGame.load(fen);
        setGame(newGame);
        setCurrentPosition(fen);
      }
    } else if (fen) {
      try {
        newGame.load(fen);
        setGame(newGame);
        setCurrentPosition(fen);
      } catch (error) {
        console.error('Invalid FEN:', error);
      }
    }
  }, [pgn, fen]);

  useEffect(() => {
    if (isPlaying && currentMoveIndex < moves.length - 1) {
      const timer = setTimeout(() => {
        handleNextMove();
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isPlaying && currentMoveIndex >= moves.length - 1) {
      setIsPlaying(false);
    }
  }, [isPlaying, currentMoveIndex, moves.length]);

  function handleDrop(sourceSquare: string, targetSquare: string) {
    if (!interactive) return false;

    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // Always promote to queen for simplicity
      });

      if (move === null) return false;

      setCurrentPosition(game.fen());
      if (onMove) onMove(move);
      return true;
    } catch (error) {
      return false;
    }
  }

  function handleReset() {
    const newGame = new Chess();
    if (pgn) {
      newGame.reset();
    } else {
      newGame.load(fen);
    }
    setGame(newGame);
    setCurrentPosition(newGame.fen());
    setCurrentMoveIndex(-1);
    setIsPlaying(false);
  }

  function handlePreviousMove() {
    if (currentMoveIndex >= 0) {
      const newIndex = currentMoveIndex - 1;
      const newGame = new Chess();
      
      for (let i = 0; i <= newIndex; i++) {
        newGame.move(moves[i]);
      }
      
      setGame(newGame);
      setCurrentPosition(newGame.fen());
      setCurrentMoveIndex(newIndex);
    }
    setIsPlaying(false);
  }

  function handleNextMove() {
    if (currentMoveIndex < moves.length - 1) {
      const newIndex = currentMoveIndex + 1;
      const newGame = new Chess();
      
      for (let i = 0; i <= newIndex; i++) {
        newGame.move(moves[i]);
      }
      
      setGame(newGame);
      setCurrentPosition(newGame.fen());
      setCurrentMoveIndex(newIndex);
    }
  }

  function togglePlayback() {
    if (currentMoveIndex >= moves.length - 1) {
      handleReset();
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  }

  function flipBoard() {
    setOrientation(orientation === 'white' ? 'black' : 'white');
  }

  return (
    <div className="inline-block">
      <div className="bg-white rounded-lg shadow-lg p-4">
        <Chessboard
          position={currentPosition}
          onPieceDrop={handleDrop}
          boardWidth={boardWidth}
          boardOrientation={orientation}
          arrowsColor="steelblue"
          arePiecesDraggable={interactive}
          customBoardStyle={{
            borderRadius: '4px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
          }}
        />
        
        {showControls && moves.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title="Reset"
              >
                <RotateCw className="w-5 h-5" />
              </button>
              <button
                onClick={handlePreviousMove}
                disabled={currentMoveIndex < 0}
                className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
                title="Previous move"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={togglePlayback}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button
                onClick={handleNextMove}
                disabled={currentMoveIndex >= moves.length - 1}
                className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
                title="Next move"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Move {currentMoveIndex + 1} / {moves.length}
              </span>
              <button
                onClick={flipBoard}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title="Flip board"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        
        {showControls && interactive && moves.length === 0 && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              {game.turn() === 'w' ? 'White' : 'Black'} to move
            </p>
            {game.isCheckmate() && (
              <p className="text-sm font-semibold text-red-600">Checkmate!</p>
            )}
            {game.isDraw() && (
              <p className="text-sm font-semibold text-gray-600">Draw!</p>
            )}
            {game.isCheck() && !game.isCheckmate() && (
              <p className="text-sm font-semibold text-orange-600">Check!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}