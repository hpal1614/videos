import { useState } from 'react';
import { useGame } from '../state/store';
import type { Color, GameMode } from '../game/types';

const DIFFICULTIES = [
  { label: 'Apprentice', depth: 2 },
  { label: 'Wizard', depth: 3 },
  { label: 'Grandmaster', depth: 4 },
];

export function Menu() {
  const newGame = useGame((s) => s.newGame);
  const [mode, setMode] = useState<GameMode>('ai');
  const [color, setColor] = useState<Color>('w');
  const [depth, setDepth] = useState(3);

  return (
    <div className="overlay menu">
      <div className="panel">
        <h1>Wizard&apos;s Chess</h1>
        <p className="subtitle">Command the board. Captured pieces are smashed to rubble.</p>

        <div className="field">
          <span className="field-label">Mode</span>
          <div className="seg">
            <button className={mode === 'ai' ? 'on' : ''} onClick={() => setMode('ai')}>
              vs Computer
            </button>
            <button className={mode === 'local' ? 'on' : ''} onClick={() => setMode('local')}>
              Two Players
            </button>
          </div>
        </div>

        {mode === 'ai' && (
          <>
            <div className="field">
              <span className="field-label">Play as</span>
              <div className="seg">
                <button className={color === 'w' ? 'on' : ''} onClick={() => setColor('w')}>
                  White
                </button>
                <button className={color === 'b' ? 'on' : ''} onClick={() => setColor('b')}>
                  Black
                </button>
              </div>
            </div>
            <div className="field">
              <span className="field-label">Difficulty</span>
              <div className="seg">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.depth}
                    className={depth === d.depth ? 'on' : ''}
                    onClick={() => setDepth(d.depth)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <button
          className="primary"
          onClick={() => newGame(mode, { playerColor: color, difficulty: depth })}
        >
          Start Game
        </button>

        <p className="hint">Drag to orbit · scroll to zoom · click a piece, then a glowing square</p>
      </div>
    </div>
  );
}
