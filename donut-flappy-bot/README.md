# 🍩 Donut Flappy Autoplayer (Chrome extension)

A one-click Chrome extension that **auto-presses "Start"** and then **plays
donut / flappy-style tap games for you**, threading the bird/donut through every
gap to rack up score. No game-specific code — it *watches the canvas pixels* to
find the bird and the next gap, so it works on most web flappy clones.

## How well does it work?

The vision + control "brain" (`bot-core.js`) is **tested headlessly in Node**:
a flappybird.io-like scene is rendered to a real canvas and the *exact shipped
code* plays it from pixels alone. Results:

- **225 pipes, 0 deaths over a full 5-minute run** on one life (colour mode).
- Across scene variants (different gap sizes, scroll speeds, pipe/bird colours,
  with and without clouds): **0–2 deaths per 2.5-minute run** in colour mode.

(See `Architecture & testing` below. Very tight gaps — much smaller than real
flappybird.io — are the hard case and the weakest spot.)

## How it works

Each animation frame the bot:
1. Finds the biggest `<canvas>` on the page (the game).
2. Copies its pixels into a small offscreen buffer.
3. **Sees**:
   - Sky colour = the *dominant* colour of the upper screen (robust to clouds
     and to pipes that hang from the ceiling).
   - Finds the bird — by its colour if a preset gives one, else as the saturated
     floating blob at the bird's fixed x (clouds are white, so they're rejected).
   - Detects the ground band and ignores it (its sandy colour resembles a yellow
     bird).
   - Finds the next pipe's **gap** using only obstacles that touch the top/bottom
     edges (pipes), so floating clouds/score-text don't create phantom gaps. The
     bird is masked out so it can't fuse with a pipe it's hugging.
4. **Decides**: aims at the lower part of the gap (so a flap's upward overshoot
   lands under the top pipe) and flaps when the bird would otherwise sink too low.
   All margins scale with the gap height, so it adapts to any game.
5. **Taps**: fires pointer + mouse + touch + `Space`/`ArrowUp`, so it triggers
   whatever input the game listens for.
6. **Auto-restarts**: if the bird stops moving (crash screen), it presses Start
   again to keep going.

## Install (Load Unpacked)

1. Open `chrome://extensions` in Chrome (or any Chromium browser: Edge, Brave…).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `donut-flappy-bot/` folder.
4. Pin the 🍩 extension for easy access.

## Use

1. Open the donut/flappy game in a tab.
2. Click the 🍩 toolbar icon → **Start / Stop**, or press **Ctrl+Shift+B**.
3. A draggable control panel appears top-right. It auto-clicks Start and begins
   playing. Click **STOP BOT** (or Ctrl+Shift+B) to stop.

## Test it first

Open `demo/donut-flappy.html` in the same browser, then start the bot — it
should fly the donut through the pipes indefinitely. Tune against the demo, then
point it at the real game.

## flappybird.io (built-in preset)

A preset for **flappybird.io** switches on automatically by hostname: the bird
is tracked by its **yellow**, and pipes/ground are found via the sky-difference
method. Just open flappybird.io, press **Ctrl+Shift+B**, and it flaps through the
pipes. If detection drifts (different rendering / retina scaling), open **tuning**
and nudge **bird sens.**. Tuning is saved **per-site**; **reset to preset**
restores this site's preset.

## Tuning (if a game misbehaves)

Open **tuning** in the on-page panel and adjust live:

| Slider | What it does |
|---|---|
| **look-ahead** | how far right it scans for the next pipe. |
| **aim low ↓** | where in the gap to aim (0 = centre, 1 = bottom). Raise if it clips the **top** pipe; lower if it clips the **bottom**. |
| **deadzone** | tolerance band (bigger = calmer, fewer taps). |
| **predict** | how far ahead it anticipates the fall (frames). |
| **cooldown** | min ms between taps (raise if it slams the ceiling). |
| **sky sens.** | sky-vs-obstacle threshold (lower if it can't see pipes). |
| **bird sens.** | how loosely it matches the bird's colour (colour-mode games). |

Settings persist per-site automatically.

## Architecture & testing

- `bot-core.js` — pure vision + control, no DOM. Shared by the extension and the
  tests, so **what ships is what's tested**. Exposes `createBot(cfg).tick(imageData, ms)`.
- `content.js` — finds the canvas, grabs pixels, fires taps, auto-start/restart,
  and the tuning panel.
- `popup.js` / `background.js` — toolbar button and `Ctrl+Shift+B` shortcut.
- `demo/donut-flappy.html` — a self-contained game to verify/tune the bot.

To re-run the headless gameplay tests you need Node + a canvas lib:

```
npm i @napi-rs/canvas
node test-sim.js        # one long run, prints pipes/deaths
```

## Limitations / honesty

- **2D-canvas games**: fully supported.
- **WebGL games**: the page may block pixel reads (canvas comes back blank). The
  bot detects this and falls back to a weak blind metronome tap. Most flappy
  clones are 2D canvas, so this is usually fine.
- **Cross-origin / tainted canvas**: same blind fallback.
- **DOM/CSS-sprite games** (no `<canvas>`): not supported by the vision path.
- **Generic (no-preset) detection vs. heavy clouds**: colour mode is the most
  robust; the generic detector can occasionally confuse a cloud for the bird on
  busy scenes. For a specific game, set the bird colour (a preset) for best
  results.
- **Very tight gaps**: gaps much smaller than real flappybird.io leave little
  margin for a fixed-size flap and are the main source of deaths.
- This automates a browser game in your own browser. If a game has an **online
  leaderboard** or is a **prize promotion**, submitting bot scores may violate
  that site's terms — use it for local high scores / personal practice.
