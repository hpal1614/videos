import type { Square } from './types';

export const TILE = 1;
export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

/** Convert a chess square (e.g. "e4") to world [x, z]. White (rank 1) sits at +z. */
export function squareToWorld(square: Square): [number, number] {
  const file = square.charCodeAt(0) - 97; // a=0 .. h=7
  const rank = parseInt(square[1], 10) - 1; // 1->0 .. 8->7
  const x = file - 3.5;
  const z = 3.5 - rank;
  return [x, z];
}

export function squareFromIndices(file: number, rank: number): Square {
  return `${FILES[file]}${rank + 1}` as Square;
}

/** Light square? Used for board tile coloring. a1 is dark in standard chess. */
export function isLightSquare(file: number, rank: number): boolean {
  return (file + rank) % 2 === 1;
}
