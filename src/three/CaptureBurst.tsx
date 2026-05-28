import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { squareToWorld } from '../game/board';
import { useGame } from '../state/store';
import type { Burst } from '../game/types';

const PARTICLES = 90;
const LIFETIME = 2200;

function Puff({ color }: { color: THREE.Color }) {
  const geom = useRef<THREE.BufferGeometry>(null);
  const mat = useRef<THREE.PointsMaterial>(null);
  const start = useRef(performance.now());

  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(PARTICLES * 3);
    const velocities = new Float32Array(PARTICLES * 3);
    for (let i = 0; i < PARTICLES; i++) {
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 1.4 + 0.2,
        Math.random() * 2 - 1,
      ).normalize();
      const speed = 1.5 + Math.random() * 3;
      velocities[i * 3] = dir.x * speed;
      velocities[i * 3 + 1] = dir.y * speed;
      velocities[i * 3 + 2] = dir.z * speed;
    }
    return { positions, velocities };
  }, []);

  useFrame((_, dt) => {
    const g = geom.current;
    if (!g) return;
    const arr = g.attributes.position.array as Float32Array;
    for (let i = 0; i < PARTICLES; i++) {
      velocities[i * 3 + 1] -= 4 * dt; // gravity
      arr[i * 3] += velocities[i * 3] * dt;
      arr[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      arr[i * 3 + 2] += velocities[i * 3 + 2] * dt;
    }
    g.attributes.position.needsUpdate = true;
    const life = (performance.now() - start.current) / LIFETIME;
    if (mat.current) mat.current.opacity = Math.max(0, 1 - life);
  });

  return (
    <points>
      <bufferGeometry ref={geom}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={mat}
        color={color}
        size={0.12}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

interface Chunk {
  size: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  angVel: THREE.Vector3;
}

function Debris({ color }: { color: number }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const chunks = useMemo<Chunk[]>(
    () =>
      Array.from({ length: 12 }, () => ({
        size: 0.08 + Math.random() * 0.14,
        pos: new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          0.1 + Math.random() * 0.3,
          (Math.random() - 0.5) * 0.3,
        ),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          2.5 + Math.random() * 4,
          (Math.random() - 0.5) * 5,
        ),
        rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        angVel: new THREE.Vector3(
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
        ),
      })),
    [],
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.033);
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      c.vel.y -= 16 * dt;
      c.pos.addScaledVector(c.vel, dt);
      const floor = -0.2 + c.size / 2; // rest on board surface (world y ~ 0)
      if (c.pos.y < floor) {
        c.pos.y = floor;
        c.vel.y = Math.abs(c.vel.y) * 0.32;
        c.vel.x *= 0.55;
        c.vel.z *= 0.55;
        c.angVel.multiplyScalar(0.55);
        if (c.vel.y < 0.25) c.vel.y = 0;
      }
      c.rot.x += c.angVel.x * dt;
      c.rot.y += c.angVel.y * dt;
      c.rot.z += c.angVel.z * dt;
      const m = meshes.current[i];
      if (m) {
        m.position.copy(c.pos);
        m.rotation.copy(c.rot);
      }
    }
  });

  return (
    <>
      {chunks.map((c, i) => (
        <mesh key={i} ref={(el) => (meshes.current[i] = el)} castShadow>
          <boxGeometry args={[c.size, c.size, c.size]} />
          <meshStandardMaterial color={color} roughness={0.85} metalness={0.1} />
        </mesh>
      ))}
    </>
  );
}

function Flash() {
  const light = useRef<THREE.PointLight>(null);
  const start = useRef(performance.now());
  useFrame(() => {
    if (light.current) {
      const life = (performance.now() - start.current) / 500;
      light.current.intensity = Math.max(0, 8 * (1 - life));
    }
  });
  return <pointLight ref={light} color={0xffb066} intensity={8} distance={5} position={[0, 0.5, 0]} />;
}

export function CaptureBurst({ burst }: { burst: Burst }) {
  const removeBurst = useGame((s) => s.removeBurst);
  const [x, z] = squareToWorld(burst.square);
  const stoneColor = burst.color === 'w' ? 0xd8cfbd : 0x33303c;
  const sparkColor = useMemo(() => new THREE.Color(0xffc080), []);

  useEffect(() => {
    const id = setTimeout(() => removeBurst(burst.id), LIFETIME);
    return () => clearTimeout(id);
  }, [burst.id, removeBurst]);

  return (
    <group position={[x, 0.2, z]}>
      <Flash />
      <Puff color={sparkColor} />
      <Debris color={stoneColor} />
    </group>
  );
}
