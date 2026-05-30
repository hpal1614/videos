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
 * Paths may be absolute URLs (a CDN) or paths relative to the asset base. Set
 * a CDN base by defining VITE_ASSET_BASE_URL in a .env file (e.g.
 * `VITE_ASSET_BASE_URL=https://cdn.example.com/wizards-chess`) — relative
 * entries below are then resolved against it. Leave it unset to serve from
 * `public/`.
 *
 * Example:
 *   export const MODEL_URLS: ModelMap = {
 *     w: { p: 'models/white-pawn.glb', n: 'models/white-knight.glb' },
 *     b: { p: 'models/black-pawn.glb' },
 *   };
 */
export type ModelMap = Partial<Record<'w' | 'b', Partial<Record<PieceSymbol, string>>>>;

export const MODEL_URLS: ModelMap = {
  w: { p: 'models/paladin.glb' },
  b: { p: 'models/paladin.glb' },
};

const BASE = (import.meta.env.VITE_ASSET_BASE_URL ?? '').replace(/\/$/, '');

function resolve(path: string): string {
  if (/^https?:\/\//.test(path) || path.startsWith('/')) return path;
  return BASE ? `${BASE}/${path}` : `/${path}`;
}

export function modelUrlFor(color: 'w' | 'b', type: PieceSymbol): string | undefined {
  const path = MODEL_URLS[color]?.[type];
  return path ? resolve(path) : undefined;
}
