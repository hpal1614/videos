import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COUNT = 420;
const RANGE = 9;
const TOP = 7;

export function AmbientParticles() {
  const geom = useRef<THREE.BufferGeometry>(null);

  const { positions, speed, drift } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const speed = new Float32Array(COUNT);
    const drift = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * RANGE * 2;
      positions[i * 3 + 1] = Math.random() * TOP;
      positions[i * 3 + 2] = (Math.random() - 0.5) * RANGE * 2;
      speed[i] = 0.15 + Math.random() * 0.4;
      drift[i] = Math.random() * Math.PI * 2;
    }
    return { positions, speed, drift };
  }, []);

  useFrame((state, dt) => {
    const g = geom.current;
    if (!g) return;
    const arr = g.attributes.position.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] += speed[i] * dt;
      arr[i * 3] += Math.sin(t * 0.3 + drift[i]) * dt * 0.15;
      if (arr[i * 3 + 1] > TOP) {
        arr[i * 3 + 1] = 0;
        arr[i * 3] = (Math.random() - 0.5) * RANGE * 2;
        arr[i * 3 + 2] = (Math.random() - 0.5) * RANGE * 2;
      }
    }
    g.attributes.position.needsUpdate = true;
  });

  return (
    <points>
      <bufferGeometry ref={geom}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={0xffcaa0}
        size={0.05}
        sizeAttenuation
        transparent
        opacity={0.7}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
