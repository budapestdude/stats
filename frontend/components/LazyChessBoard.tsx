'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load the chess board component
export const LazyChessBoard = dynamic(
  () => import('react-chessboard').then(mod => mod.Chessboard),
  {
    loading: () => (
      <div className="w-full aspect-square">
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
    ),
    ssr: false // Disable SSR for chess board
  }
);

// Lazy load chess.js library
export const useChess = () => {
  const { Chess } = require('chess.js');
  return new Chess();
};