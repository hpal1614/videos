import { Scene } from './three/Scene';
import { Menu } from './ui/Menu';
import { HUD } from './ui/HUD';
import { PromotionPicker } from './ui/PromotionPicker';
import { useGame } from './state/store';

export default function App() {
  const started = useGame((s) => s.started);
  return (
    <div className="app">
      <Scene />
      {started ? (
        <>
          <HUD />
          <PromotionPicker />
        </>
      ) : (
        <Menu />
      )}
    </div>
  );
}
