import { useGame } from '../state/store';

function statusText(
  status: string,
  winner: string | null,
  turn: string,
  mode: string,
  aiColor: string,
  thinking: boolean,
): string {
  if (status === 'checkmate') return `Checkmate — ${winner === 'w' ? 'White' : 'Black'} wins`;
  if (status === 'stalemate') return 'Stalemate — draw';
  if (status === 'draw') return 'Draw';
  if (mode === 'ai' && turn === aiColor) return thinking ? 'Computer is conjuring…' : 'Computer to move';
  const side = turn === 'w' ? 'White' : 'Black';
  return status === 'check' ? `${side} to move — Check!` : `${side} to move`;
}

export function HUD() {
  const status = useGame((s) => s.status);
  const winner = useGame((s) => s.winner);
  const turn = useGame((s) => s.turn);
  const mode = useGame((s) => s.mode);
  const aiColor = useGame((s) => s.aiColor);
  const thinking = useGame((s) => s.thinking);
  const history = useGame((s) => s.history);
  const toMenu = useGame((s) => s.toMenu);
  const newGame = useGame((s) => s.newGame);
  const playerColor = useGame((s) => s.playerColor);
  const difficulty = useGame((s) => s.aiDifficulty);

  const pairs: { n: number; w: string; b?: string }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({ n: i / 2 + 1, w: history[i], b: history[i + 1] });
  }

  const over = status === 'checkmate' || status === 'stalemate' || status === 'draw';

  return (
    <>
      <div className="hud-top">
        <div className={`status ${status === 'check' ? 'check' : ''} ${over ? 'over' : ''}`}>
          <span className={`dot ${turn === 'w' ? 'white' : 'black'}`} />
          {statusText(status, winner, turn, mode, aiColor, thinking)}
        </div>
        <div className="hud-buttons">
          <button onClick={() => newGame(mode, { playerColor, difficulty })}>Restart</button>
          <button onClick={toMenu}>Menu</button>
        </div>
      </div>

      <div className="movelist">
        <div className="movelist-head">Moves</div>
        <div className="movelist-body">
          {pairs.length === 0 && <div className="empty">No moves yet</div>}
          {pairs.map((p) => (
            <div className="move-row" key={p.n}>
              <span className="num">{p.n}.</span>
              <span className="san">{p.w}</span>
              <span className="san">{p.b ?? ''}</span>
            </div>
          ))}
        </div>
      </div>

      {over && (
        <div className="overlay result">
          <div className="panel">
            <h2>{statusText(status, winner, turn, mode, aiColor, thinking)}</h2>
            <button className="primary" onClick={() => newGame(mode, { playerColor, difficulty })}>
              Play Again
            </button>
            <button onClick={toMenu}>Back to Menu</button>
          </div>
        </div>
      )}
    </>
  );
}
