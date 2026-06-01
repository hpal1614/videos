import { useEffect, useMemo, useRef } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import type { AnimState, Color } from '../game/types';

interface Props {
  url: string;
  anim: AnimState;
  /** Piece color, used to tint the auto-generated body proxy if the source model has no body mesh. */
  color: Color;
  /** Target height in world units (board tiles are 1 unit). Pieces are auto-fit to this. */
  targetHeight?: number;
}

/** Mixamo bone -> capsule radius heuristic for the body-proxy fallback. */
function limbRadius(boneName: string): number {
  const n = boneName.toLowerCase();
  if (n.endsWith('hips')) return 0.18;
  if (n.includes('spine2') || n.includes('upperchest')) return 0.16;
  if (n.includes('spine')) return 0.17;
  if (n.endsWith('neck')) return 0.08;
  if (n.includes('shoulder')) return 0.1;
  if (n.includes('forearm')) return 0.075;
  if (n.includes('arm') && !n.includes('forearm')) return 0.085;
  if (n.includes('upleg') || n.includes('thigh')) return 0.12;
  if (n.endsWith('leg')) return 0.1;
  if (n.includes('foot')) return 0.08;
  return 0; // hands, fingers, head — skip (head handled separately)
}

/**
 * Builds capsule "limbs" between every connected pair of bones and a sphere on
 * the head bone. Used when the source glTF has skeleton + props but no skinned
 * body mesh, so the character isn't invisible / distorted.
 */
function addBodyProxy(root: THREE.Object3D, color: Color) {
  let totalSkinnedVerts = 0;
  let skinnedMesh: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh) {
      totalSkinnedVerts += sm.geometry.attributes.position.count;
      if (!skinnedMesh) skinnedMesh = sm;
    }
  });
  // If the model already has a real body (>= ~500 skinned verts), skip the proxy.
  if (totalSkinnedVerts >= 500 || !skinnedMesh) return;

  const mat = new THREE.MeshStandardMaterial({
    color: color === 'w' ? 0xb8b1a0 : 0x2e2a36,
    roughness: 0.42,
    metalness: 0.78,
  });

  const sm = skinnedMesh as THREE.SkinnedMesh;
  for (const bone of sm.skeleton.bones) {
    const r = limbRadius(bone.name);
    if (r <= 0) continue;
    for (const child of bone.children) {
      if ((child as THREE.Bone).isBone !== true) continue;
      const dist = (child as THREE.Bone).position.length();
      if (dist < 0.02) continue;
      const length = Math.max(0.01, dist - r);
      const geom = new THREE.CapsuleGeometry(r, length, 3, 10);
      const limb = new THREE.Mesh(geom, mat);
      const dir = (child as THREE.Bone).position.clone().normalize();
      limb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      limb.position.copy((child as THREE.Bone).position).multiplyScalar(0.5);
      limb.castShadow = true;
      bone.add(limb);
    }
  }

  // Head: a single sphere a bit above the head bone.
  const head = sm.skeleton.bones.find((b) => /head$/i.test(b.name));
  if (head) {
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), mat);
    helmet.position.set(0, 0.13, 0);
    helmet.castShadow = true;
    head.add(helmet);
  }
}

/**
 * Renders a rigged glTF character (Draco/meshopt supported) and plays the clip
 * matching `anim`. Auto-scales any source model to `targetHeight` and recenters
 * its feet on the tile. If the source has no skinned body mesh (e.g. a Mixamo
 * "motion-only" export with just sword/shield/helmet bound to the skeleton), a
 * capsule body proxy is generated from the bones so the character is visible.
 * Clip names are matched case-insensitively by substring, so standard Mixamo
 * exports ("Idle", "Walking", "Sword And Shield Slash", "Sword And Shield
 * Death") resolve automatically.
 */
export function RiggedPiece({ url, anim, color, targetHeight = 1.0 }: Props) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url, '/draco/', true);
  const cloned = useMemo(() => {
    const c = skeletonClone(scene);
    addBodyProxy(c, color);
    return c;
  }, [scene, color]);
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
