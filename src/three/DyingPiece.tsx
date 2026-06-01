import { Suspense, useEffect } from 'react';
import { RiggedPiece } from './RiggedPiece';
import { modelUrlFor } from './assets';
import { squareToWorld } from '../game/board';
import { useGame } from '../state/store';
import type { DyingActor, PieceSymbol } from '../game/types';

const DEATH_MS = 1600;

const RIGGED_HEIGHT: Record<PieceSymbol, number> = {
  p: 1.8,
  r: 2.0,
  n: 2.1,
  b: 2.1,
  q: 2.4,
  k: 2.6,
};

export function DyingPiece({ actor }: { actor: DyingActor }) {
  const removeDying = useGame((s) => s.removeDying);
  const url = modelUrlFor(actor.color, actor.type);
  const [x, z] = squareToWorld(actor.square);
  const rotY = actor.color === 'w' ? Math.PI : 0;

  useEffect(() => {
    const id = setTimeout(() => removeDying(actor.id), DEATH_MS);
    return () => clearTimeout(id);
  }, [actor.id, removeDying]);

  if (!url) return null;

  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <Suspense fallback={null}>
        <RiggedPiece
          url={url}
          anim="death"
          color={actor.color}
          targetHeight={RIGGED_HEIGHT[actor.type]}
        />
      </Suspense>
    </group>
  );
}
