# Wizard's Chess

An immersive 3D chess game in the browser — themed after the life-sized
Wizard's Chess from Harry Potter. Captured pieces are smashed to rubble with
a physics-driven debris burst, sparks, and a flash. Full legal chess rules,
play vs. the computer or local two-player, and a fully orbitable board.

Built with **React + Three.js (React Three Fiber)**, **chess.js** for rules,
a custom **Web Worker AI** (negamax + alpha-beta), GPU particle VFX, and
postprocessing (bloom + vignette).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

Build for production:

```bash
npm run build
npm run preview
```

## How to play

- **Drag** to orbit the board, **scroll** to zoom.
- Click a piece, then click a **green ring** (a legal target square).
- Choose **vs Computer** (pick side + difficulty) or **Two Players** from the menu.
- Pawn promotion shows a picker; full rules incl. castling, en passant, check/mate.

## Features

- Full legal chess via `chess.js` (move validation, check/checkmate, castling,
  en passant, promotion, draws).
- Single-player AI in a Web Worker (depths 2/3/4 = Apprentice/Wizard/Grandmaster)
  so the search never blocks rendering.
- Carved-stone procedural pieces, smooth glide/bob animations, selection glow.
- Capture VFX: ballistic stone debris that tumbles and settles, an additive
  spark/dust puff, and a fading flash.
- Ambient drifting embers, dynamic lighting, fog, bloom, and vignette.

## Upgrading to rigged characters

The renderer already supports swapping the procedural pieces for **rigged glTF
characters** (e.g. a pawn that swings a sword). It uses the built-in stone
pieces until you provide models.

1. Get rigged, animated models. Free sources that work well:
   - **Mixamo** (free, rigged humanoids + `idle`/`walk`/`attack`/`death` clips) —
     download as glTF/`.glb`.
   - **Quaternius** / **Kenney** / **Sketchfab** (filter to CC0 / free).
2. Drop the files into `public/models/`.
3. Map them in `src/three/assets.ts`:

   ```ts
   export const MODEL_URLS: ModelMap = {
     w: { p: '/models/white-pawn.glb', n: '/models/white-knight.glb' },
     b: { p: '/models/black-pawn.glb' },
   };
   ```

Each model should contain clips whose names contain `idle`, `walk`, `attack`,
or `death` (case-insensitive). `src/three/RiggedPiece.tsx` drives idle/walk
automatically; extend it to trigger `attack`/`death` from capture events for
full combat animations. Any piece without a mapped model falls back to the
stone mesh, so you can upgrade pieces one at a time.
