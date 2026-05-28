import type { Color, PieceSymbol, Square } from 'chess.js';

export type { Color, PieceSymbol, Square };

export type GameMode = 'ai' | 'local';

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw';

export interface PieceEntity {
  id: string;
  type: PieceSymbol;
  color: Color;
  square: Square;
}

export interface Burst {
  id: number;
  square: Square;
  type: PieceSymbol;
  color: Color;
}

export interface SimpleMove {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
}
