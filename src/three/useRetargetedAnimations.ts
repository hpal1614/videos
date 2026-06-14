import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js';

const SOURCE_URL = '/models/anims-mannequin.glb';

// target Mixamo bone (paladin) → source Rigify bone (Quaternius anim mannequin).
// Three.js's GLTFLoader strips `:` and `.` from node names (PropertyBinding
// uses them as path separators), so the names below are the SANITISED forms
// (e.g. mixamorigHips, not mixamorig:Hips; DEF-spine001, not DEF-spine.001).
// Mixamo's 4th-segment finger bones (Thumb4/Index4/etc), Eye/HeadTop_End,
// and the prop joints (Sword_joint / Shield_joint) have no counterpart on the
// Quaternius rig — they're omitted and stay at bind pose.
const BONE_MAP: Record<string, string> = {
  mixamorigHips: 'DEF-hips',
  mixamorigSpine: 'DEF-spine001',
  mixamorigSpine1: 'DEF-spine002',
  mixamorigSpine2: 'DEF-spine003',
  mixamorigNeck: 'DEF-neck',
  mixamorigHead: 'DEF-head',
  mixamorigLeftShoulder: 'DEF-shoulderL',
  mixamorigLeftArm: 'DEF-upper_armL',
  mixamorigLeftForeArm: 'DEF-forearmL',
  mixamorigLeftHand: 'DEF-handL',
  mixamorigLeftHandThumb1: 'DEF-thumb01L',
  mixamorigLeftHandThumb2: 'DEF-thumb02L',
  mixamorigLeftHandThumb3: 'DEF-thumb03L',
  mixamorigLeftHandIndex1: 'DEF-f_index01L',
  mixamorigLeftHandIndex2: 'DEF-f_index02L',
  mixamorigLeftHandIndex3: 'DEF-f_index03L',
  mixamorigLeftHandMiddle1: 'DEF-f_middle01L',
  mixamorigLeftHandMiddle2: 'DEF-f_middle02L',
  mixamorigLeftHandMiddle3: 'DEF-f_middle03L',
  mixamorigLeftHandRing1: 'DEF-f_ring01L',
  mixamorigLeftHandRing2: 'DEF-f_ring02L',
  mixamorigLeftHandRing3: 'DEF-f_ring03L',
  mixamorigLeftHandPinky1: 'DEF-f_pinky01L',
  mixamorigLeftHandPinky2: 'DEF-f_pinky02L',
  mixamorigLeftHandPinky3: 'DEF-f_pinky03L',
  mixamorigRightShoulder: 'DEF-shoulderR',
  mixamorigRightArm: 'DEF-upper_armR',
  mixamorigRightForeArm: 'DEF-forearmR',
  mixamorigRightHand: 'DEF-handR',
  mixamorigRightHandThumb1: 'DEF-thumb01R',
  mixamorigRightHandThumb2: 'DEF-thumb02R',
  mixamorigRightHandThumb3: 'DEF-thumb03R',
  mixamorigRightHandIndex1: 'DEF-f_index01R',
  mixamorigRightHandIndex2: 'DEF-f_index02R',
  mixamorigRightHandIndex3: 'DEF-f_index03R',
  mixamorigRightHandMiddle1: 'DEF-f_middle01R',
  mixamorigRightHandMiddle2: 'DEF-f_middle02R',
  mixamorigRightHandMiddle3: 'DEF-f_middle03R',
  mixamorigRightHandRing1: 'DEF-f_ring01R',
  mixamorigRightHandRing2: 'DEF-f_ring02R',
  mixamorigRightHandRing3: 'DEF-f_ring03R',
  mixamorigRightHandPinky1: 'DEF-f_pinky01R',
  mixamorigRightHandPinky2: 'DEF-f_pinky02R',
  mixamorigRightHandPinky3: 'DEF-f_pinky03R',
  mixamorigLeftUpLeg: 'DEF-thighL',
  mixamorigLeftLeg: 'DEF-shinL',
  mixamorigLeftFoot: 'DEF-footL',
  mixamorigLeftToeBase: 'DEF-toeL',
  mixamorigRightUpLeg: 'DEF-thighR',
  mixamorigRightLeg: 'DEF-shinR',
  mixamorigRightFoot: 'DEF-footR',
  mixamorigRightToeBase: 'DEF-toeR',
};

function findSkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    if (!found && (o as THREE.SkinnedMesh).isSkinnedMesh) found = o as THREE.SkinnedMesh;
  });
  return found;
}

const cache = new WeakMap<THREE.Object3D, THREE.AnimationClip[]>();

/**
 * Retargets the Quaternius animation library's clips onto whatever skeleton
 * the given target scene exposes (the Paladin uses Mixamo bones).
 *
 * Done once per target scene — useGLTF caches scenes by URL, so all 16 piece
 * instances share the same retargeted clips.
 */
export function useRetargetedAnimations(targetScene: THREE.Object3D): THREE.AnimationClip[] {
  const sourceGLTF = useGLTF(SOURCE_URL, '/draco/', true);

  return useMemo(() => {
    const hit = cache.get(targetScene);
    if (hit) return hit;

    const targetSkin = findSkinnedMesh(targetScene);
    const sourceSkin = findSkinnedMesh(sourceGLTF.scene);
    if (!targetSkin || !sourceSkin) return [];

    const out: THREE.AnimationClip[] = [];
    for (const clip of sourceGLTF.animations) {
      const retargeted = retargetClip(targetSkin, sourceSkin, clip, {
        hip: 'mixamorigHips',
        names: BONE_MAP,
        useFirstFramePosition: true,
      });
      retargeted.name = clip.name;
      out.push(retargeted);
    }
    cache.set(targetScene, out);
    return out;
  }, [sourceGLTF, targetScene]);
}

useGLTF.preload(SOURCE_URL, '/draco/');
