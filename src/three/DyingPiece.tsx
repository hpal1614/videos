import { Suspense, useEffect } from 'react';
import { RiggedPiece } from './RiggedPiece';
import { modelUrlFor } from './assets';
import { squareToWorld } from '../game/board';
import { useGame } from '../state/store';
import type { DyingActor } from '../game/types';

const DEATH_MS = 1600;

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
        <RiggedPiece url={url} anim="death" />
      </Suspense>
    </group>
  );
}
