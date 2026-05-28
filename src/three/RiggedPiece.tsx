import { useEffect, useRef } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

interface Props {
  url: string;
  selected: boolean;
  moving: boolean;
}

/** Renders a rigged glTF character and drives its idle/walk clips. */
export function RiggedPiece({ url, selected, moving }: Props) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    const pick = (kw: string) => names.find((n) => n.toLowerCase().includes(kw));
    const idle = pick('idle') ?? names[0];
    const walk = pick('walk') ?? pick('run') ?? idle;
    const target = moving ? walk : idle;
    if (!target) return;
    const action = actions[target];
    action?.reset().fadeIn(0.2).play();
    return () => {
      action?.fadeOut(0.2);
    };
  }, [actions, names, moving]);

  return (
    <group ref={group}>
      <primitive object={scene} scale={selected ? 0.92 : 0.85} />
    </group>
  );
}
