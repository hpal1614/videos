import type { Color, PieceSymbol, Square } from 'chess.js';

export type { Color, PieceSymbol, Square };

export type GameMode = 'ai' | 'local';

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw';

export interface PieceEntity {
  id: string;
  type: PieceSymbol;
  color: Color;
  square: Square;
  attackingUntil?: number; // ms timestamp; while in the future the piece plays its attack clip
}

export type AnimState = 'idle' | 'walk' | 'attack' | 'death';

/** A captured rigged piece that plays its death clip before despawning. */
export interface DyingActor {
  id: number;
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
