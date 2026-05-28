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

## Run on iOS & Android (Capacitor)

The same web build is packaged as native apps with [Capacitor](https://capacitorjs.com/).
The `android/` and `ios/` native projects are generated on your machine (they
need the Android SDK / Xcode, and iOS requires macOS), so they aren't committed:

```bash
# one-time, per platform:
npx cap add android
npx cap add ios

# build the web app + copy it into the native shells + open the IDE:
npm run cap:android   # opens Android Studio
npm run cap:ios       # opens Xcode (macOS only)
```

`npm run cap:sync` rebuilds and syncs both platforms without opening an IDE.
The web app keeps working as-is — Capacitor just adds the native wrappers.

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

## Rigged characters (e.g. a sword-swinging pawn)

The renderer supports swapping the procedural pieces for **rigged glTF
characters**. The loader and the idle / walk / **attack** / **death** hooks are
already wired: when a piece moves it plays `walk`, when it captures it plays
`attack`, and a captured rigged piece plays its `death` clip before despawning.
Any piece without a mapped model falls back to the stone mesh, so you can
upgrade one piece at a time.

### 1. Get a model (Mixamo etc.)

Mixamo characters are free and rigged with the clips we need. One model is
**reused for every piece of that type/colour** (all 8 pawns share one file), so
you only need a handful of models.

### 2. Trim + compress (fixes the "44 MB" problem)

A raw Mixamo export with dozens of clips is huge and shouldn't go in git. Keep
only ~4 clips and compress — this typically takes a model from tens of MB down
to **~2–5 MB**:

```bash
npx @gltf-transform/cli optimize raw-pawn.glb pawn.glb \
  --compress draco --texture-compress webp
```

(Keep clips named so they contain `idle`, `walk`, `attack`/`slash`, and
`death` — matched case-insensitively. Draco- and meshopt-compressed models are
both supported.)

### 3. Host the models (CDN, not git)

Upload the optimized files to a CDN / blob store (Cloudflare R2, Vercel Blob, a
GitHub Release asset, …). Point the app at it with a `.env` file:

```
VITE_ASSET_BASE_URL=https://cdn.example.com/wizards-chess
```

### 4. Map them in `src/three/assets.ts`

```ts
export const MODEL_URLS: ModelMap = {
  w: { p: 'models/white-pawn.glb', n: 'models/white-knight.glb' },
  b: { p: 'models/black-pawn.glb' },
};
```

Relative paths resolve against `VITE_ASSET_BASE_URL` (or `public/` if unset);
absolute `https://` URLs are used verbatim. Tune per-piece `scale` and facing
in `src/three/RiggedPiece.tsx` / `Piece.tsx` if your model faces the wrong way
or is the wrong size.
