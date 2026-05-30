import { useEffect, useMemo, useRef } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import type { AnimState } from '../game/types';

interface Props {
  url: string;
  anim: AnimState;
  /** Target height in world units (board tiles are 1 unit). Pieces are auto-fit to this. */
  targetHeight?: number;
}

/**
 * Renders a rigged glTF character (Draco/meshopt supported) and plays the clip
 * matching `anim`. Auto-scales any source model to `targetHeight` and recenters
 * its feet on the tile, so models of any origin/scale look right out of the box.
 * Clip names are matched case-insensitively by substring, so standard Mixamo
 * exports ("Idle", "Walking", "Sword And Shield Slash", "Sword And Shield
 * Death") resolve automatically.
 */
export function RiggedPiece({ url, anim, targetHeight = 1.0 }: Props) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url, '/draco/', true);
  const cloned = useMemo(() => skeletonClone(scene), [scene]);
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    cloned.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
      // Skinned meshes default to a bind-pose bounding box that can be tiny or
      // missing; force-recompute so our auto-fit measurement is real.
      if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.computeBoundingBox();
    });
    // Auto-fit: scale so the model's height equals targetHeight, then drop it so
    // its feet sit on y=0 and it's centred on x/z. Clamp the fit factor in case
    // the bbox is degenerate.
    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const measured = size.y > 0.05 ? size.y : 1.7; // fall back to typical humanoid height
    const fit = THREE.MathUtils.clamp(targetHeight / measured, 0.01, 2);
    cloned.scale.setScalar(fit);
    cloned.updateMatrixWorld(true);
    box.setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    cloned.position.set(-center.x, -box.min.y, -center.z);
  }, [cloned, targetHeight]);

  useEffect(() => {
    const pick = (...kws: string[]) =>
      names.find((n) => kws.some((kw) => n.toLowerCase().includes(kw))) ?? names[0];
    const name =
      anim === 'walk'
        ? pick('walk', 'run', 'idle')
        : anim === 'attack'
          ? pick('attack', 'slash', 'punch', 'kick', 'idle')
          : anim === 'death'
            ? pick('death', 'die', 'dying', 'idle')
            : pick('idle');
    if (!name) return;
    const action = actions[name];
    if (!action) return;
    const once = anim === 'attack' || anim === 'death';
    action.reset();
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = once;
    action.fadeIn(0.15).play();
    return () => {
      action.fadeOut(0.2);
    };
  }, [actions, names, anim]);

  return (
    <group ref={group}>
      <primitive object={cloned} />
    </group>
  );
}
