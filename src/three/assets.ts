import type { PieceSymbol } from '../game/types';

/**
 * Optional rigged character models.
 *
 * Leave empty to use the built-in carved-stone pieces. To upgrade to rigged
 * characters (e.g. free Mixamo / Quaternius / Sketchfab CC0 models), drop glTF
 * files into `public/models/` and map them here, per color if desired.
 *
 * Each model is expected to contain animation clips named (case-insensitive,
 * substring match): "idle", "walk", "attack", "death". The piece renderer will
 * play them based on game state. Missing clips fall back gracefully.
 *
 * Example:
 *   export const MODEL_URLS: ModelMap = {
 *     w: { p: '/models/white-pawn.glb', n: '/models/white-knight.glb' },
 *     b: { p: '/models/black-pawn.glb' },
 *   };
 */
export type ModelMap = Partial<Record<'w' | 'b', Partial<Record<PieceSymbol, string>>>>;

export const MODEL_URLS: ModelMap = {};

export function modelUrlFor(color: 'w' | 'b', type: PieceSymbol): string | undefined {
  return MODEL_URLS[color]?.[type];
}
