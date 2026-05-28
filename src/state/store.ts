import { create } from 'zustand';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import { findBestMove } from '../game/ai';
import type {
  Burst,
  Color,
  GameMode,
  GameStatus,
  PieceEntity,
  PieceSymbol,
  Square,
} from '../game/types';

let entitySeq = 1;
let burstSeq = 1;

function buildEntities(chess: Chess): PieceEntity[] {
  const out: PieceEntity[] = [];
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell) {
        out.push({ id: `p${entitySeq++}`, type: cell.type, color: cell.color, square: cell.square });
      }
    }
  }
  return out;
}

function targetsFor(chess: Chess, square: Square): Square[] {
  const moves = chess.moves({ square, verbose: true }) as Move[];
  return [...new Set(moves.map((m) => m.to))];
}

function computeStatus(chess: Chess): { status: GameStatus; winner: Color | null } {
  if (chess.isCheckmate()) {
    return { status: 'checkmate', winner: chess.turn() === 'w' ? 'b' : 'w' };
  }
  if (chess.isStalemate()) return { status: 'stalemate', winner: null };
  if (chess.isDraw()) return { status: 'draw', winner: null };
  if (chess.inCheck()) return { status: 'check', winner: null };
  return { status: 'playing', winner: null };
}

interface GameState {
  chess: Chess;
  started: boolean;
  mode: GameMode;
  playerColor: Color; // human side in AI mode
  aiColor: Color;
  aiDifficulty: number; // search depth
  entities: PieceEntity[];
  selected: Square | null;
  legalTargets: Square[];
  turn: Color;
  status: GameStatus;
  winner: Color | null;
  history: string[];
  lastMove: { from: Square; to: Square } | null;
  bursts: Burst[];
  thinking: boolean;
  promotion: { from: Square; to: Square } | null;

  newGame: (mode: GameMode, opts?: { playerColor?: Color; difficulty?: number }) => void;
  toMenu: () => void;
  onSquareClick: (square: Square) => void;
  applyMove: (from: Square, to: Square, promotion?: PieceSymbol) => void;
  choosePromotion: (type: PieceSymbol) => void;
  cancelPromotion: () => void;
  maybeRunAi: () => void;
  removeBurst: (id: number) => void;
}

export const useGame = create<GameState>((set, get) => ({
  chess: new Chess(),
  started: false,
  mode: 'local',
  playerColor: 'w',
  aiColor: 'b',
  aiDifficulty: 3,
  entities: [],
  selected: null,
  legalTargets: [],
  turn: 'w',
  status: 'playing',
  winner: null,
  history: [],
  lastMove: null,
  bursts: [],
  thinking: false,
  promotion: null,

  newGame: (mode, opts) => {
    const chess = new Chess();
    const playerColor = opts?.playerColor ?? 'w';
    const aiColor: Color = playerColor === 'w' ? 'b' : 'w';
    set({
      chess,
      started: true,
      mode,
      playerColor,
      aiColor,
      aiDifficulty: opts?.difficulty ?? get().aiDifficulty,
      entities: buildEntities(chess),
      selected: null,
      legalTargets: [],
      turn: chess.turn(),
      status: 'playing',
      winner: null,
      history: [],
      lastMove: null,
      bursts: [],
      thinking: false,
      promotion: null,
    });
    if (mode === 'ai') {
      setTimeout(() => get().maybeRunAi(), 500);
    }
  },

  toMenu: () => set({ started: false, selected: null, legalTargets: [], promotion: null }),

  onSquareClick: (square) => {
    const { selected, legalTargets, chess, mode, aiColor, thinking, promotion } = get();
    if (thinking || promotion) return;
    const turn = chess.turn();
    if (mode === 'ai' && turn === aiColor) return;

    const piece = chess.get(square);

    if (selected) {
      if (square === selected) {
        set({ selected: null, legalTargets: [] });
        return;
      }
      if (legalTargets.includes(square)) {
        const mover = chess.get(selected);
        const lastRank = turn === 'w' ? '8' : '1';
        const isPromotion = mover?.type === 'p' && square[1] === lastRank;
        if (isPromotion) {
          set({ promotion: { from: selected, to: square }, selected: null, legalTargets: [] });
        } else {
          get().applyMove(selected, square);
        }
        return;
      }
      if (piece && piece.color === turn) {
        set({ selected: square, legalTargets: targetsFor(chess, square) });
      } else {
        set({ selected: null, legalTargets: [] });
      }
      return;
    }

    if (piece && piece.color === turn) {
      set({ selected: square, legalTargets: targetsFor(chess, square) });
    }
  },

  applyMove: (from, to, promotion) => {
    const { chess } = get();
    let result: Move;
    try {
      result = chess.move({ from, to, promotion });
    } catch {
      return;
    }

    const entities = get().entities.map((e) => ({ ...e }));
    const mover = entities.find((e) => e.square === from);
    let burst: Burst | null = null;

    if (result.flags.includes('c') || result.flags.includes('e')) {
      let capSquare: Square = to;
      if (result.flags.includes('e')) {
        capSquare = (to[0] + from[1]) as Square;
      }
      const capIndex = entities.findIndex((e) => e.square === capSquare && e !== mover);
      if (capIndex >= 0) {
        const cap = entities[capIndex];
        burst = { id: burstSeq++, square: capSquare, type: cap.type, color: cap.color };
        entities.splice(capIndex, 1);
      }
    }

    if (mover) {
      mover.square = to;
      if (result.flags.includes('p') && result.promotion) mover.type = result.promotion;
    }

    if (result.flags.includes('k')) {
      const rank = result.color === 'w' ? '1' : '8';
      const rook = entities.find((e) => e.square === (`h${rank}` as Square));
      if (rook) rook.square = `f${rank}` as Square;
    } else if (result.flags.includes('q')) {
      const rank = result.color === 'w' ? '1' : '8';
      const rook = entities.find((e) => e.square === (`a${rank}` as Square));
      if (rook) rook.square = `d${rank}` as Square;
    }

    const { status, winner } = computeStatus(chess);

    set({
      entities,
      turn: chess.turn(),
      status,
      winner,
      history: chess.history(),
      lastMove: { from, to },
      selected: null,
      legalTargets: [],
      promotion: null,
      bursts: burst ? [...get().bursts, burst] : get().bursts,
    });

    if (!chess.isGameOver()) {
      setTimeout(() => get().maybeRunAi(), 400);
    }
  },

  choosePromotion: (type) => {
    const promo = get().promotion;
    if (!promo) return;
    get().applyMove(promo.from, promo.to, type);
  },

  cancelPromotion: () => set({ promotion: null }),

  maybeRunAi: () => {
    const { mode, aiColor, chess, aiDifficulty, thinking } = get();
    if (mode !== 'ai' || thinking) return;
    if (chess.isGameOver() || chess.turn() !== aiColor) return;
    set({ thinking: true });
    const fen = chess.fen();
    findBestMove(fen, aiDifficulty).then((move) => {
      set({ thinking: false });
      if (move) get().applyMove(move.from, move.to, move.promotion);
    });
  },

  removeBurst: (id) => set({ bursts: get().bursts.filter((b) => b.id !== id) }),
}));

if (import.meta.env.DEV) {
  (window as unknown as { useGame: typeof useGame }).useGame = useGame;
}
