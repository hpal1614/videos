import { EffectComposer, Bloom, Vignette, SMAA } from '@react-three/postprocessing';

export function Effects() {
  return (
    <EffectComposer>
      <Bloom
        intensity={0.9}
        luminanceThreshold={0.45}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      <Vignette eskil={false} offset={0.25} darkness={0.85} />
      <SMAA />
    </EffectComposer>
  );
}
