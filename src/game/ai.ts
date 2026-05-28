import type { SimpleMove } from './types';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (move: SimpleMove | null) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; move: SimpleMove | null }>) => {
      const resolve = pending.get(e.data.id);
      if (resolve) {
        pending.delete(e.data.id);
        resolve(e.data.move);
      }
    };
  }
  return worker;
}

export function findBestMove(fen: string, depth: number): Promise<SimpleMove | null> {
  const w = getWorker();
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    w.postMessage({ fen, depth, id });
  });
}
