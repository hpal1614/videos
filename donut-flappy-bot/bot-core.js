/* Donut Flappy Autoplayer — shared vision + control core.
 *
 * Pure logic, no DOM. Used by both the content script (content.js wraps it with
 * canvas-grabbing + event-firing) and the Node test harness (which feeds it real
 * rendered pixels). Keeping it shared means the code that ships is the code tested.
 *
 * Coordinates are in the analysis buffer's pixel space (small, downscaled).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof globalThis !== "undefined") globalThis.DonutBotCore = api;
})(this, function () {
  "use strict";

  function dist2(r, g, b, R, G, B) {
    const dr = r - R, dg = g - G, db = b - B;
    return dr * dr + dg * dg + db * db;
  }

  // --- sky/background colour = DOMINANT colour over the upper region --------
  // Sampling only the top rows is unsafe: pipes hang from the ceiling, so the
  // very top is often INSIDE a pipe. Instead grid-sample the whole upper ~60%
  // (which is mostly sky, with pipes/clouds/bird a minority), quantise colours
  // into coarse bins, and take the most populous bin. Sky is the plurality of
  // the screen, so this survives pipes of any colour, clouds, and the bird.
  function detectSky(data, w, h) {
    const cols = 18, rows = 14, yMax = h * 0.6;
    const counts = new Map(), sums = new Map();
    for (let r = 0; r < rows; r++) {
      const y = Math.min(h - 1, Math.round((r + 0.5) * yMax / rows));
      for (let c = 0; c < cols; c++) {
        const x = Math.min(w - 1, Math.round((c + 0.5) * w / cols));
        const i = (y * w + x) * 4;
        const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
        counts.set(key, (counts.get(key) || 0) + 1);
        let s = sums.get(key); if (!s) { s = [0, 0, 0, 0]; sums.set(key, s); }
        s[0] += data[i]; s[1] += data[i + 1]; s[2] += data[i + 2]; s[3]++;
      }
    }
    let bestKey = null, bestC = -1;
    for (const [k, c] of counts) if (c > bestC) { bestC = c; bestKey = k; }
    const s = sums.get(bestKey);
    return [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
  }

  // Build an "is this pixel an obstacle?" test.
  //  - "color" mode keys on a target colour (e.g. green pipes).
  //  - otherwise: a pixel is an obstacle when it's far from the sky colour.
  function makeIsObstacle(data, cfg, sky) {
    if (cfg.obstacleMode === "color") {
      const c = cfg.obstacleColor, t2 = cfg.obstacleColorTol * cfg.obstacleColorTol;
      return (i) => dist2(data[i], data[i + 1], data[i + 2], c[0], c[1], c[2]) < t2;
    }
    const t2 = cfg.bgTol * cfg.bgTol;
    return (i) => dist2(data[i], data[i + 1], data[i + 2], sky[0], sky[1], sky[2]) >= t2;
  }

  // Find the vertical gap in a column using EDGE-TOUCHING obstacles only:
  // the top pipe hangs from the ceiling, the bottom pipe/ground touches the
  // floor. Floating blobs (clouds, the bird, score text) are ignored, which is
  // what makes this robust without needing the pipe's exact colour.
  function columnGap(isObsXY, x, h) {
    // obstacle extending down from the top edge
    let top = 0;
    while (top < h && isObsXY(x, top)) top++;
    // obstacle extending up from the bottom edge
    let bot = h - 1;
    while (bot >= 0 && isObsXY(x, bot)) bot--;
    return { gapTop: top, gapBottom: bot, center: (top + bot) / 2, top, bot };
  }

  // Find the top of the bottom "ground/base" band: scanning up from the floor,
  // the ground is a near-full-width run of non-sky pixels. Pipes only cover part
  // of the width, so they don't count. This lets us ignore the ground (whose
  // sandy colour is close to a yellow bird) and use it as the effective floor.
  function findGroundTop(isObsXY, w, h) {
    const cols = [w >> 3, w >> 2, (3 * w) >> 3, w >> 1, (5 * w) >> 3, (3 * w) >> 2, (7 * w) >> 3];
    let groundTop = h;
    for (let y = h - 1; y >= 0; y--) {
      let obs = 0;
      for (const x of cols) if (isObsXY(x, y)) obs++;
      if (obs >= cols.length - 1) groundTop = y;   // ~entire width is obstacle => ground
      else break;
    }
    return groundTop;
  }

  // Locate the bird: prefer its colour (distinctive yellow), else a floating
  // blob in the player band, else fixed x-fraction + previous y. Searches only
  // ABOVE the ground band so the sandy base can't be mistaken for the bird.
  function findPlayer(data, idx, w, h, cfg, st, isObsXY, floor) {
    let px = Math.round(cfg.playerXFrac * w);
    let py = st.player.found ? st.player.y : h / 2;
    const yMax = Math.max(2, Math.min(h - 1, floor - 1));

    if (cfg.playerMode === "color") {
      const c = cfg.playerColor, t2 = cfg.playerColorTol * cfg.playerColorTol;
      const xMax = Math.floor(w * 0.6);
      let sx = 0, sy = 0, n = 0;
      for (let x = 1; x < xMax; x++)
        for (let y = 1; y < yMax; y++) {
          const i = idx(x, y);
          if (dist2(data[i], data[i + 1], data[i + 2], c[0], c[1], c[2]) < t2) { sx += x; sy += y; n++; }
        }
      if (n > 5) return { px: Math.round(sx / n), py: Math.round(sy / n), found: true, n };
    }

    // floating-blob fallback (no colour hint): in a narrow band around the bird's
    // FIXED x, the floating obstacle run (not touching top/bottom edge) is the bird.
    // The bird stays at px while clouds drift across, so we anchor hard on px and
    // on the previous y for continuity, and prefer compact runs (clouds are wide
    // but here we only see them when they're passing — proximity rejects them).
    const band = Math.round(0.045 * w);
    const bandL = Math.max(1, px - band), bandR = Math.min(w - 2, px + band);
    const expectY = st.player.found ? st.player.y : yMax * 0.45;
    // saturation of a pixel — clouds are white/grey (~0), the bird is colourful.
    const sat = (i) => { const r = data[i], g = data[i + 1], b = data[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return (mx - mn) / (mx + 1); };
    let best = null, bestScore = -Infinity;
    for (let x = bandL; x <= bandR; x += 1) {
      let runStart = -1;
      for (let y = 0; y <= yMax; y++) {
        const obs = y < yMax && isObsXY(x, y);
        if (obs && runStart < 0) runStart = y;
        if ((!obs || y === yMax) && runStart >= 0) {
          const a = runStart, bnd = y - 1;
          const touchesEdge = a === 0 || bnd === yMax - 1;
          const cy = (a + bnd) / 2, len = bnd - a + 1;
          // a bird-sized floating blob: tall runs are clouds/pipe stubs, skip them
          if (!touchesEdge && len >= 2 && len < 0.22 * h) {
            const s = sat(idx(x, Math.round(cy)));
            // reject washed-out (cloud) blobs; favour saturated, near px & prev-y, compact
            const score = (s < 0.18 ? -1000 : s * 40)
              - Math.abs(cy - expectY) * 2 - Math.abs(x - px) * 1.5 - len * 0.1;
            if (score > bestScore) { bestScore = score; best = { x, cy }; }
          }
          runStart = -1;
        }
      }
    }
    if (best) return { px, py: Math.round(best.cy), found: true, n: 0 };

    return { px, py: Math.round(py), found: st.player.found, n: 0 };
  }

  // Analyse one RGBA frame -> vision summary. Mutates st (player vel, prevSky).
  function analyze(img, cfg, st) {
    const { data, width: w, height: h } = img;
    const idx = (x, y) => (y * w + x) * 4;
    const sky = detectSky(data, w, h);
    const isObsBase = makeIsObstacle(data, cfg, sky);
    const isObsXY = (x, y) => isObsBase(idx(x, y));
    const floor = findGroundTop(isObsXY, w, h);

    const p = findPlayer(data, idx, w, h, cfg, st, isObsXY, floor);
    const px = p.px, py = p.py;
    st.player.vy = st.player.found && p.found ? py - st.player.y : 0;
    st.player.x = px; st.player.y = py; st.player.found = p.found;

    // Mask the bird out of obstacle reasoning: in auto mode the bird itself reads
    // as an obstacle and, in its own column, FUSES with a pipe it's hugging, which
    // makes the detected gap edge jump around. Estimate the bird's radius from its
    // pixel count and treat that disc as free space.
    const birdR = p.found
      ? Math.max(3, Math.min(0.09 * w, (p.n > 20 ? Math.sqrt(p.n / Math.PI) * 1.35 : 0.05 * w)))
      : 0;
    const r2 = birdR * birdR;
    const isObs2 = (x, y) => {
      if (birdR) { const dx = x - px, dy = y - py; if (dx * dx + dy * dy <= r2) return false; }
      return isObsXY(x, y);
    };

    const topMin = cfg.topPipeMin * h, botMin = (1 - cfg.botPipeMin) * h;
    // a column is a pipe pair when it has both a ceiling pipe and a floor pipe
    const pipeAt = (x) => {
      const g = columnGap(isObs2, x, h);
      return (g.top > topMin && g.bot < botMin && g.gapBottom - g.gapTop > 4) ? g : null;
    };
    let haveGap = false, gapCenter = py, gapTop = 0, gapBottom = h, obstacleX = -1;

    // (A) Is the bird currently INSIDE a pipe? Probe its solid centre columns
    // (its faint anti-aliased edges give garbage, so stay within the body). If so,
    // keep targeting that pipe's gap until it scrolls clear — don't jump to the
    // next pipe mid-traversal and steer into the one we're threading.
    const off = Math.round(0.02 * w);
    for (const cx of [px, px - off, px + off]) {
      const x = Math.max(2, Math.min(w - 2, cx));
      const g = pipeAt(x);
      if (g) { haveGap = true; gapCenter = g.center; gapTop = g.gapTop; gapBottom = Math.min(g.gapBottom, floor); obstacleX = x; break; }
    }

    // (B) Otherwise scan ahead (clearing the bird's body) for the next pipe.
    if (!haveGap) {
      const x1 = Math.min(w - 2, px + Math.round(Math.max(cfg.lookMin, 0.06) * w));
      const x2 = Math.min(w - 2, px + Math.round(cfg.lookMax * w));
      for (let x = x1; x <= x2; x += 2) {
        const g = pipeAt(x);
        if (g) { haveGap = true; gapCenter = g.center; gapTop = g.gapTop; gapBottom = Math.min(g.gapBottom, floor); obstacleX = x; break; }
      }
    }
    return { px, py, vy: st.player.vy, found: p.found, playerPixels: p.n,
             haveGap, gapCenter, gapTop, gapBottom, obstacleX, floor, sky, w, h };
  }

  // Decide whether to flap this frame.
  //
  // A single flap lifts the bird a fixed amount (its overshoot), so we aim at
  // the LOWER part of the gap: the bird taps low, rises into the gap, and falls
  // back — the overshoot lands under the top pipe instead of into it. All margins
  // scale with the gap height so this adapts to whatever game we're on.
  function decide(v, cfg) {
    if (!v.found) return { tap: false, reason: "no-bird" };
    // FAILSAFE: never flap while already high on the screen. If detection is off
    // (wrong sky/floor on some page) the controller could otherwise tap every
    // frame and pin the bird to the ceiling. This guarantees it can't.
    if (v.py < v.h * cfg.ceilingStop) return { tap: false, reason: "ceiling-stop" };
    const predicted = v.py + v.vy * cfg.velGain;   // short gravity-aware look-ahead
    if (v.haveGap) {
      const gapH = Math.max(8, v.gapBottom - v.gapTop);
      const aim = v.gapCenter + cfg.gapBiasFrac * (gapH * 0.5);  // toward the bottom
      const dead = cfg.deadzone * gapH;
      const ceilingGuard = v.gapTop + cfg.edgeMargin * gapH;     // don't flap into the top pipe
      if (predicted > aim + dead && v.py > ceilingGuard) return { tap: true, reason: "below-aim", aim };
      return { tap: false, reason: "hold", aim };
    }
    // no pipe in view: hover just above the floor. Guard against a bogus floor
    // (detection failure) by falling back to a sane fraction of the screen.
    const fl = v.floor && v.floor > v.h * 0.5 ? v.floor : v.h * 0.9;
    if (predicted > fl * 0.78) return { tap: true, reason: "hover" };
    return { tap: false, reason: "glide" };
  }

  function defaults() {
    return {
      playerXFrac: 0.30,
      lookMin: 0.02, lookMax: 0.45,
      // control: aim toward the lower part of the gap; margins are fractions of gap height.
      // (tuned by sweep against rendered pixels: vg1/bias0.40 -> 150 pipes, 0 deaths/200s)
      gapBiasFrac: 0.40,   // 0 = gap centre, 1 = gap bottom
      deadzone: 0.06,      // tolerance band (frac of gap height)
      edgeMargin: 0.15,    // suppress flap within this much of the top pipe (frac of gap)
      velGain: 1,          // small look-ahead for the fall prediction (frames)
      cooldownMs: 90,
      ceilingStop: 0.10,   // never flap when the bird is in the top this-fraction of the screen
      topPipeMin: 0.04, botPipeMin: 0.04,   // min ceiling/floor pipe depth (frac of h)
      bgTol: 70,
      obstacleMode: "auto", obstacleColor: [86, 170, 60], obstacleColorTol: 95,
      playerMode: "motion", playerColor: [228, 200, 70], playerColorTol: 95,
      autoStart: true, autoRestart: true,
      autoCalibrate: true,   // learn the real bird's colour from stable blob hits, then lock on
      train: false,          // self-tune control params from how long each life survives
      livesPerEval: 3,       // lives averaged per candidate (flappy is noisy)
    };
  }

  // Control parameters the self-trainer is allowed to tune: [min, max, step-sigma].
  const TRAIN_KEYS = {
    gapBiasFrac: [0.15, 0.70, 0.07],
    velGain:     [0, 4, 0.6],
    deadzone:    [0.02, 0.14, 0.02],
    cooldownMs:  [55, 140, 10],
  };

  // Median of an array of [r,g,b] samples (per channel).
  function medianColor(cols) {
    const ch = (k) => { const a = cols.map((c) => c[k]).sort((p, q) => p - q); return a[a.length >> 1]; };
    return [ch(0), ch(1), ch(2)];
  }

  // Stateful bot wrapper. tick(img, nowMs) -> { tap, vision, decision }.
  function createBot(cfg) {
    const st = { player: { x: 0, y: 0, vy: 0, found: false } };
    let lastTap = -1e9;
    let calib = { done: false, lastX: -1, cols: [], xs: [] };

    // Watch the colour-agnostic blob detector; once it reports the bird at a
    // stable x for enough frames, learn its median colour and lock onto colour
    // tracking. This adapts to the real game's bird without any hardcoded colour.
    function calibrate(img, v) {
      const c = self.cfg;
      if (!c.autoCalibrate || c.playerMode === "color" || calib.done || !v.found) return;
      const { data, width: w } = img;
      const i = (v.py * w + v.px) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if ((mx - mn) / (mx + 1) < 0.18) { calib.cols.length = 0; calib.xs.length = 0; return; } // skip washed-out
      if (calib.lastX >= 0 && Math.abs(v.px - calib.lastX) > 0.04 * w) { calib.cols.length = 0; calib.xs.length = 0; }
      calib.lastX = v.px; calib.cols.push([r, g, b]); calib.xs.push(v.px / w);
      if (calib.cols.length >= 24) {
        c.playerColor = medianColor(calib.cols);
        c.playerColorTol = 100;
        c.playerXFrac = calib.xs.sort((p, q) => p - q)[calib.xs.length >> 1];
        c.playerMode = "color";
        calib.done = true;
      }
    }

    // --- self-training: (1+1) evolution strategy on the control params -------
    // Fitness = how long a life survived. Try a perturbed candidate for a few
    // lives; if its average beats the best, adopt it. Converges to good params
    // for whatever game we're on, from pixels + survival time alone.
    let trainer = null;
    function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    function perturb(base) { const p = {}; for (const k in TRAIN_KEYS) { const [lo, hi, sg] = TRAIN_KEYS[k]; p[k] = Math.max(lo, Math.min(hi, base[k] + gauss() * sg)); } return p; }
    function applyParams(p) { for (const k in p) self.cfg[k] = p[k]; }
    function initTrainer() { const best = {}; for (const k in TRAIN_KEYS) best[k] = self.cfg[k]; trainer = { best, bestFit: -1, cand: null, scores: [], episodes: 0, improved: 0 }; }

    const self = {
      cfg: Object.assign(defaults(), cfg),
      state: st,
      reset() { st.player.found = false; lastTap = -1e9; calib = { done: false, lastX: -1, cols: [], xs: [] }; },
      analyze: (img) => analyze(img, self.cfg, st),
      decide: (v) => decide(v, self.cfg),
      // called once per life with that life's survival fitness (e.g. frames alive)
      onEpisodeEnd(fitness) {
        if (!self.cfg.train) return null;
        if (!trainer) initTrainer();
        trainer.scores.push(fitness);
        if (trainer.scores.length < self.cfg.livesPerEval) return null;
        const avg = trainer.scores.reduce((a, b) => a + b, 0) / trainer.scores.length;
        trainer.scores = [];
        if (avg > trainer.bestFit) { trainer.best = { ...(trainer.cand || trainer.best) }; trainer.bestFit = avg; trainer.improved++; }
        trainer.cand = perturb(trainer.best);
        applyParams(trainer.cand);
        trainer.episodes++;
        const info = { best: trainer.best, bestFit: trainer.bestFit, episodes: trainer.episodes, improved: trainer.improved };
        if (self.onLearn) self.onLearn(info);
        return info;
      },
      trainingBest() { return trainer ? { best: trainer.best, bestFit: trainer.bestFit, episodes: trainer.episodes } : null; },
      // returns whether a tap should fire now, honouring the cooldown
      tick(img, nowMs) {
        const v = analyze(img, self.cfg, st);
        calibrate(img, v);
        const d = decide(v, self.cfg);
        let tap = false;
        if (d.tap && nowMs - lastTap >= self.cfg.cooldownMs) { tap = true; lastTap = nowMs; }
        return { tap, vision: v, decision: d, calibrated: calib.done };
      },
    };
    return self;
  }

  return { createBot, analyze, decide, defaults, _internals: { dist2, detectSky, columnGap, makeIsObstacle, findPlayer } };
});
