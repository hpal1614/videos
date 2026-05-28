import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PieceSymbol } from '../game/types';

type Profile = [number, number][]; // [radius, height] bottom -> top

function lathe(profile: Profile, segments = 28): THREE.BufferGeometry {
  const pts = profile.map(([r, h]) => new THREE.Vector2(Math.max(r, 0.0001), h));
  const g = new THREE.LatheGeometry(pts, segments);
  g.computeVertexNormals();
  return g;
}

function sphere(r: number, y: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 20, 16);
  g.translate(0, y, 0);
  return g;
}

function box(w: number, h: number, d: number): THREE.BoxGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

const PAWN: Profile = [
  [0, 0], [0.27, 0], [0.27, 0.04], [0.17, 0.1], [0.13, 0.13],
  [0.1, 0.3], [0.13, 0.35], [0.1, 0.38],
];

const ROOK: Profile = [
  [0, 0], [0.3, 0], [0.3, 0.05], [0.18, 0.12], [0.17, 0.42],
  [0.24, 0.46], [0.26, 0.5], [0.26, 0.58],
];

const BISHOP: Profile = [
  [0, 0], [0.29, 0], [0.29, 0.05], [0.17, 0.12], [0.13, 0.14],
  [0.11, 0.45], [0.17, 0.52], [0.1, 0.58], [0.12, 0.64], [0.05, 0.72],
];

const QUEEN: Profile = [
  [0, 0], [0.31, 0], [0.31, 0.05], [0.18, 0.13], [0.14, 0.16],
  [0.12, 0.58], [0.19, 0.68], [0.21, 0.76],
];

const KING: Profile = [
  [0, 0], [0.31, 0], [0.31, 0.05], [0.18, 0.13], [0.14, 0.16],
  [0.12, 0.6], [0.19, 0.72], [0.22, 0.8], [0.15, 0.86],
];

const KNIGHT_BASE: Profile = [
  [0, 0], [0.3, 0], [0.3, 0.05], [0.18, 0.12], [0.16, 0.32], [0.2, 0.38],
];

function buildPawn(): THREE.BufferGeometry {
  return mergeGeometries([lathe(PAWN), sphere(0.14, 0.46)], false)!;
}

function buildRook(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [lathe(ROOK)];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const b = box(0.09, 0.1, 0.09);
    b.translate(Math.cos(a) * 0.2, 0.62, Math.sin(a) * 0.2);
    parts.push(b);
  }
  return mergeGeometries(parts, false)!;
}

function buildBishop(): THREE.BufferGeometry {
  return mergeGeometries([lathe(BISHOP), sphere(0.075, 0.8)], false)!;
}

function buildQueen(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [lathe(QUEEN)];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(sphere(0.05, 0.82).translate(Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16));
  }
  parts.push(sphere(0.08, 0.88));
  return mergeGeometries(parts, false)!;
}

function buildKing(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [lathe(KING)];
  const v = box(0.07, 0.22, 0.07);
  v.translate(0, 0.97, 0);
  const h = box(0.18, 0.07, 0.07);
  h.translate(0, 0.97, 0);
  parts.push(v, h);
  return mergeGeometries(parts, false)!;
}

function buildKnight(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [lathe(KNIGHT_BASE)];
  const neck = box(0.22, 0.36, 0.18);
  neck.rotateX(-0.25);
  neck.translate(0, 0.56, 0.02);
  parts.push(neck);
  const muzzle = box(0.18, 0.14, 0.34);
  muzzle.rotateX(0.15);
  muzzle.translate(0, 0.66, 0.18);
  parts.push(muzzle);
  const earL = box(0.05, 0.12, 0.05);
  earL.translate(-0.06, 0.78, -0.04);
  const earR = box(0.05, 0.12, 0.05);
  earR.translate(0.06, 0.78, -0.04);
  parts.push(earL, earR);
  return mergeGeometries(parts, false)!;
}

const builders: Record<PieceSymbol, () => THREE.BufferGeometry> = {
  p: buildPawn,
  r: buildRook,
  b: buildBishop,
  q: buildQueen,
  k: buildKing,
  n: buildKnight,
};

const cache = new Map<PieceSymbol, THREE.BufferGeometry>();

export function getPieceGeometry(type: PieceSymbol): THREE.BufferGeometry {
  let g = cache.get(type);
  if (!g) {
    g = builders[type]();
    g.computeVertexNormals();
    cache.set(type, g);
  }
  return g;
}

/** Approx piece height for placing labels / debris origin. */
export const PIECE_HEIGHT: Record<PieceSymbol, number> = {
  p: 0.6,
  r: 0.62,
  b: 0.82,
  q: 0.9,
  k: 1.05,
  n: 0.82,
};
