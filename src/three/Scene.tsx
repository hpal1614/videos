import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Board } from './Board';
import { Pieces } from './Pieces';
import { AmbientParticles } from './Particles';
import { CaptureBurst } from './CaptureBurst';
import { Effects } from './Effects';
import { useGame } from '../state/store';

function Bursts() {
  const bursts = useGame((s) => s.bursts);
  return (
    <>
      {bursts.map((b) => (
        <CaptureBurst key={b.id} burst={b} />
      ))}
    </>
  );
}

export function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 7.5, 9], fov: 45 }}
      gl={{ antialias: false }}
    >
      <color attach="background" args={[0x0a0810]} />
      <fog attach="fog" args={[0x0a0810, 16, 34]} />

      <hemisphereLight args={[0x556088, 0x100806, 0.55]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        position={[6, 12, 5]}
        intensity={2.6}
        color={0xfff0d8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0004}
      />
      <pointLight position={[-6, 4, -5]} color={0x4f7bff} intensity={40} distance={22} />
      <pointLight position={[0, 5, 0]} color={0xffb070} intensity={18} distance={16} />

      {/* dungeon floor */}
      <mesh position={[0, -0.62, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color={0x0c0a12} roughness={1} metalness={0} />
      </mesh>

      <Board />
      <Pieces />
      <AmbientParticles />
      <Bursts />

      <OrbitControls
        target={[0, 0, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={20}
        minPolarAngle={0.2}
        maxPolarAngle={1.45}
      />

      <Effects />
    </Canvas>
  );
}
