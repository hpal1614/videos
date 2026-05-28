import { useGame } from '../state/store';
import type { PieceSymbol } from '../game/types';

const CHOICES: { type: PieceSymbol; label: string; glyph: string }[] = [
  { type: 'q', label: 'Queen', glyph: '♛' },
  { type: 'r', label: 'Rook', glyph: '♜' },
  { type: 'b', label: 'Bishop', glyph: '♝' },
  { type: 'n', label: 'Knight', glyph: '♞' },
];

export function PromotionPicker() {
  const promotion = useGame((s) => s.promotion);
  const choosePromotion = useGame((s) => s.choosePromotion);
  const cancelPromotion = useGame((s) => s.cancelPromotion);
  if (!promotion) return null;

  return (
    <div className="overlay promo" onClick={cancelPromotion}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <h2>Promote pawn</h2>
        <div className="promo-grid">
          {CHOICES.map((c) => (
            <button key={c.type} onClick={() => choosePromotion(c.type)}>
              <span className="glyph">{c.glyph}</span>
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
