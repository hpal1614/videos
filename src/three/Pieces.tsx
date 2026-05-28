import { useGame } from '../state/store';
import { Piece } from './Piece';

export function Pieces() {
  const entities = useGame((s) => s.entities);
  const selected = useGame((s) => s.selected);
  return (
    <group>
      {entities.map((e) => (
        <Piece key={e.id} entity={e} selected={selected === e.square} />
      ))}
    </group>
  );
}
