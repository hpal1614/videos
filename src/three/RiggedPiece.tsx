import { useEffect, useMemo, useRef } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import type { AnimState, Color } from '../game/types';

interface Props {
  url: string;
  anim: AnimState;
  /** Piece color — reserved for future per-side tinting; currently unused. */
  color: Color;
  /** Target height in world units (board tiles are 1 unit). */
  targetHeight?: number;
}

/**
 * Renders a rigged glTF character (Draco/meshopt supported) and plays the clip
 * matching `anim`. Auto-scales the model to `targetHeight` and recenters its
 * feet on the tile. Whatever's in the file — meshes, props, animation — is
 * what shows, with no compensating geometry.
 */
export function RiggedPiece({ url, anim, color, targetHeight = 1.0 }: Props) {
  void color;
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url, '/draco/', true);
  const cloned = useMemo(() => skeletonClone(scene), [scene]);
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    cloned.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
      if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.computeBoundingBox();
    });
    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const measured = size.y > 0.05 ? size.y : 1.7;
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
