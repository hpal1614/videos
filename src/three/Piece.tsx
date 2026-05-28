import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { getPieceGeometry } from './pieceGeometry';
import { modelUrlFor } from './assets';
import { RiggedPiece } from './RiggedPiece';
import { squareToWorld } from '../game/board';
import { useGame } from '../state/store';
import type { AnimState, PieceEntity } from '../game/types';

interface Props {
  entity: PieceEntity;
  selected: boolean;
}

function makeMaterial(color: 'w' | 'b'): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: color === 'w' ? 0xe9e1d1 : 0x262430,
    roughness: color === 'w' ? 0.62 : 0.55,
    metalness: color === 'w' ? 0.06 : 0.12,
    emissive: new THREE.Color(0x6cb8ff),
    emissiveIntensity: 0,
  });
}

export function Piece({ entity, selected }: Props) {
  const group = useRef<THREE.Group>(null);
  const onSquareClick = useGame((s) => s.onSquareClick);

  const geometry = useMemo(() => getPieceGeometry(entity.type), [entity.type]);
  const material = useMemo(() => makeMaterial(entity.color), [entity.color]);
  useEffect(() => () => material.dispose(), [material]);

  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const url = modelUrlFor(entity.color, entity.type);
  const baseRotY = url
    ? entity.color === 'w'
      ? Math.PI // rigged: white faces the enemy (-z); flip if your model faces the other way
      : 0
    : entity.type === 'n' && entity.color === 'w'
      ? Math.PI
      : 0;
  const target = useRef(new THREE.Vector3());
  const prevSquare = useRef(entity.square);
  const movingUntil = useRef(0);

  useEffect(() => {
    if (prevSquare.current !== entity.square) {
      movingUntil.current = performance.now() + 600;
      prevSquare.current = entity.square;
    }
  }, [entity.square]);

  // Initialize at correct position on first mount.
  useEffect(() => {
    const [x, z] = squareToWorld(entity.square);
    group.current?.position.set(x, 0, z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const [x, z] = squareToWorld(entity.square);
    const lift = selected ? 0.2 : 0;
    target.current.set(x, lift + Math.sin(t * 1.6 + phase) * 0.012, z);
    g.position.lerp(target.current, Math.min(1, dt * 7));
    g.rotation.y = baseRotY + (selected ? Math.sin(t * 4) * 0.12 : 0);
    const desired = selected ? 0.55 + Math.sin(t * 5) * 0.25 : 0;
    material.emissiveIntensity = THREE.MathUtils.lerp(material.emissiveIntensity, desired, Math.min(1, dt * 6));
  });

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSquareClick(entity.square);
  };

  const now = performance.now();
  const anim: AnimState =
    entity.attackingUntil && entity.attackingUntil > now
      ? 'attack'
      : movingUntil.current > now
        ? 'walk'
        : 'idle';

  return (
    <group ref={group} onPointerDown={handleDown}>
      {url ? (
        <Suspense fallback={null}>
          <RiggedPiece url={url} anim={anim} />
        </Suspense>
      ) : (
        <mesh geometry={geometry} material={material} castShadow receiveShadow scale={0.92} />
      )}
    </group>
  );
}
