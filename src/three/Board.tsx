import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { isLightSquare, squareFromIndices, squareToWorld } from '../game/board';
import { useGame } from '../state/store';
import type { Square } from '../game/types';

function Tile({ square, light }: { square: Square; light: boolean }) {
  const onSquareClick = useGame((s) => s.onSquareClick);
  const [x, z] = squareToWorld(square);
  return (
    <mesh
      position={[x, -0.1, z]}
      receiveShadow
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onSquareClick(square);
      }}
    >
      <boxGeometry args={[0.98, 0.2, 0.98]} />
      <meshStandardMaterial
        color={light ? 0x6d6a78 : 0x201e28}
        roughness={0.85}
        metalness={0.15}
      />
    </mesh>
  );
}

function Marker({ square, kind }: { square: Square; kind: 'select' | 'target' | 'last' }) {
  const onSquareClick = useGame((s) => s.onSquareClick);
  const ref = useRef<THREE.Mesh>(null);
  const [x, z] = squareToWorld(square);
  const color = kind === 'select' ? 0x7ec8ff : kind === 'target' ? 0x66ff99 : 0xffd166;
  useFrame((state) => {
    if (ref.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.12;
      ref.current.scale.setScalar(kind === 'target' ? s : 1);
    }
  });
  return (
    <mesh
      ref={ref}
      position={[x, 0.012, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onSquareClick(square);
      }}
    >
      {kind === 'target' ? (
        <ringGeometry args={[0.12, 0.2, 24]} />
      ) : (
        <planeGeometry args={[0.96, 0.96]} />
      )}
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={kind === 'last' ? 0.5 : 1.1}
        transparent
        opacity={kind === 'last' ? 0.35 : 0.7}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function Board() {
  const selected = useGame((s) => s.selected);
  const legalTargets = useGame((s) => s.legalTargets);
  const lastMove = useGame((s) => s.lastMove);

  const tiles = useMemo(() => {
    const out: { square: Square; light: boolean }[] = [];
    for (let f = 0; f < 8; f++) {
      for (let r = 0; r < 8; r++) {
        out.push({ square: squareFromIndices(f, r), light: isLightSquare(f, r) });
      }
    }
    return out;
  }, []);

  return (
    <group>
      {/* base slab + frame */}
      <mesh position={[0, -0.35, 0]} receiveShadow castShadow>
        <boxGeometry args={[9.2, 0.5, 9.2]} />
        <meshStandardMaterial color={0x14121a} roughness={0.9} metalness={0.2} />
      </mesh>
      <mesh position={[0, -0.16, 0]} receiveShadow>
        <boxGeometry args={[8.4, 0.12, 8.4]} />
        <meshStandardMaterial color={0x3a3550} roughness={0.6} metalness={0.4} />
      </mesh>

      {tiles.map((t) => (
        <Tile key={t.square} square={t.square} light={t.light} />
      ))}

      {lastMove && <Marker square={lastMove.from} kind="last" />}
      {lastMove && <Marker square={lastMove.to} kind="last" />}
      {selected && <Marker square={selected} kind="select" />}
      {legalTargets.map((sq) => (
        <Marker key={sq} square={sq} kind="target" />
      ))}
    </group>
  );
}
