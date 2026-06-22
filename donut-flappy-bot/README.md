# 🍩 Donut Flappy Autoplayer (Chrome extension)

A one-click Chrome extension that **auto-presses "Start"** and then **plays
donut / flappy-style tap games for you**, aiming the donut through every gap to
rack up score. No game-specific code — it *watches the canvas pixels* to find
the donut and the next gap, so it works on most web flappy clones.

## How it works

Each animation frame the bot:
1. Finds the biggest `<canvas>` on the page (the game).
2. Copies its pixels into a small offscreen buffer.
3. **Sees**: samples the sky colour from the top, finds the donut by detecting
   the blob that *moved* (frame differencing), then scans just to the right of
   the donut for the next obstacle column and locates the vertical **gap**.
4. **Decides**: if the donut is — or, predicting its fall, soon will be — below
   the gap centre, it taps.
5. **Taps**: fires pointer + mouse + touch + `Space`/`ArrowUp` events, so it
   triggers whatever input the game listens for.

## Install (Load Unpacked)

1. Open `chrome://extensions` in Chrome (or any Chromium browser: Edge, Brave…).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `donut-flappy-bot/` folder.
4. Pin the 🍩 extension for easy access.

## Use

1. Open the donut flappy game in a tab.
2. Click the 🍩 toolbar icon → **Start / Stop**, or press **Ctrl+Shift+B**.
3. A control panel appears top-right of the page. It auto-clicks Start and
   begins playing. Click **STOP BOT** (or Ctrl+Shift+B) to stop.

## Tuning (if a game misbehaves)

Open **tuning** in the on-page panel and adjust live:

| Slider | What it does |
|---|---|
| **look-ahead** | how far right it scans for the next pipe. Lower = react later. |
| **deadzone** | tolerance around the gap centre (bigger = calmer, fewer taps). |
| **aim up/down** | bias the target within the gap (raise if it clips the bottom pipe). |
| **fall predict** | how far ahead it predicts the donut's drop (raise if it taps too late). |
| **tap cooldown** | min ms between taps (raise if it slams the ceiling). |
| **colour sens.** | obstacle vs. sky colour threshold. Tune if it can't see pipes. |

Settings persist automatically. **reset defaults** restores them.

## Test it first

Open `demo/donut-flappy.html` in the same browser, then start the bot — it
should fly the donut through the pipes indefinitely. Tune against the demo, then
point it at the real game.

## Limitations / honesty

- **2D canvas games**: fully supported.
- **WebGL games**: the page may block pixel reads (canvas comes back blank). The
  bot detects this and falls back to a blind metronome tap — far weaker. Most
  flappy clones are 2D canvas, so this is usually fine.
- **Cross-origin / tainted canvas**: same fallback.
- **DOM/CSS-sprite games** (no canvas): not supported by the vision path.
- This automates a browser game in your own browser. If a game has an **online
  leaderboard**, submitting bot scores there may violate that site's terms —
  use it for local high scores / personal practice.
