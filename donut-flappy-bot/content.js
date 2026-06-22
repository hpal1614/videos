/* Donut Flappy Autoplayer — content script
 *
 * Strategy (works on most "tap to flap" canvas games):
 *  1. Find the largest <canvas> on the page (that's the game).
 *  2. Each animation frame, copy the canvas pixels into an offscreen buffer.
 *  3. VISION:
 *       - sample the sky/background colour from the top corners
 *       - find the donut (player) by frame-differencing: the blob that moved
 *         the most in the left part of the screen is the player.
 *       - look a bit to the RIGHT of the player for the next obstacle column,
 *         and find the vertical GAP in it (the free run bounded by obstacle).
 *  4. CONTROL: if the donut is (or will soon be) below the gap centre, TAP.
 *  5. TAP: fire pointer/mouse/touch/keyboard events so it works regardless of
 *     which input the game listens for.
 *
 * Nothing here is game-specific, so a floating panel lets you tune it live.
 */
(() => {
  "use strict";
  if (window.__donutBotLoaded) return;        // avoid double-injection
  window.__donutBotLoaded = true;

  // ---- tunables (persisted) -------------------------------------------------
  const DEFAULTS = {
    playerXAuto: true,   // detect donut x by motion, else use playerXFrac
    playerXFrac: 0.30,   // fallback horizontal position of the donut (0..1)
    lookMin: 0.02,       // start scanning this far right of the donut (frac of w)
    lookMax: 0.45,       // ...up to this far right
    deadzone: 0.04,      // tolerance band around gap centre (frac of h)
    targetBias: 0.00,    // shift aim up(-)/down(+) within the gap (frac of h)
    velGain: 6,          // how far ahead to predict the donut's fall (frames)
    cooldownMs: 90,      // min time between taps (anti-ceiling)
    bgTol: 60,           // colour distance: below = "free/sky", above = obstacle
    autoStart: true,     // click a Start/Play button when activated
  };
  let cfg = { ...DEFAULTS };

  // ---- state ----------------------------------------------------------------
  let running = false;
  let canvas = null;
  let off = null, octx = null;       // offscreen analysis buffer
  let prevGray = null;               // previous frame (grayscale) for diffing
  let lastTap = 0;
  let player = { x: 0, y: 0, vy: 0, found: false };
  let panel, statusEl, scoreGuessEl;
  let rafId = 0;
  let startTries = 0;

  // =========================================================================
  // Canvas discovery
  // =========================================================================
  function findCanvas() {
    const cs = [...document.querySelectorAll("canvas")].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 80 && r.height > 80;
    });
    if (!cs.length) return null;
    // biggest visible canvas wins
    cs.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    });
    return cs[0];
  }

  function ensureBuffers() {
    const w = canvas.width || canvas.getBoundingClientRect().width;
    const h = canvas.height || canvas.getBoundingClientRect().height;
    // downscale for speed; keep aspect
    const scale = Math.min(1, 320 / w);
    const bw = Math.max(40, Math.round(w * scale));
    const bh = Math.max(40, Math.round(h * scale));
    if (!off || off.width !== bw || off.height !== bh) {
      off = document.createElement("canvas");
      off.width = bw; off.height = bh;
      octx = off.getContext("2d", { willReadFrequently: true });
      prevGray = null;
    }
    return { bw, bh };
  }

  function grabPixels() {
    const { bw, bh } = ensureBuffers();
    try {
      octx.drawImage(canvas, 0, 0, bw, bh);
      return octx.getImageData(0, 0, bw, bh);
    } catch (e) {
      // tainted (cross-origin) or WebGL without preserveDrawingBuffer
      return null;
    }
  }

  // =========================================================================
  // Vision
  // =========================================================================
  function dist2(r, g, b, R, G, B) {
    const dr = r - R, dg = g - G, db = b - B;
    return dr * dr + dg * dg + db * db;
  }

  function analyze(img) {
    const { data, width: w, height: h } = img;
    const idx = (x, y) => (y * w + x) * 4;

    // --- background colour: average a few top-corner samples (the sky) ---
    let br = 0, bg = 0, bb = 0, n = 0;
    const corners = [
      [2, 2], [w - 3, 2], [Math.floor(w / 2), 2],
      [2, Math.floor(h * 0.12)], [w - 3, Math.floor(h * 0.12)],
    ];
    for (const [x, y] of corners) {
      const i = idx(x, y);
      br += data[i]; bg += data[i + 1]; bb += data[i + 2]; n++;
    }
    br /= n; bg /= n; bb /= n;
    const tol2 = cfg.bgTol * cfg.bgTol;
    const isFree = (i) => dist2(data[i], data[i + 1], data[i + 2], br, bg, bb) < tol2;

    // --- grayscale + frame diff to locate the moving donut ---
    const gray = new Float32Array(w * h);
    for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
      gray[p] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }

    let px = Math.round(cfg.playerXFrac * w);
    let py = Math.round(h / 2);
    if (cfg.playerXAuto && prevGray) {
      // search the left 55% for the column-band with the most motion
      let bestSum = 0, bestX = px, bestY = py;
      const xMax = Math.floor(w * 0.55);
      // per-column motion energy, then pick weighted centroid in best band
      let cx = 0, cy = 0, csum = 0;
      for (let x = 2; x < xMax; x++) {
        for (let y = 2; y < h - 2; y++) {
          const p = y * w + x;
          const d = Math.abs(gray[p] - prevGray[p]);
          if (d > 28) { cx += x * d; cy += y * d; csum += d; }
        }
      }
      if (csum > 400) { bestX = cx / csum; bestY = cy / csum; bestSum = csum; }
      if (bestSum > 0) { px = Math.round(bestX); py = Math.round(bestY); }
      else if (player.found) { px = Math.round(player.x); py = Math.round(player.y); }
    } else {
      // no diff yet: find donut's y by scanning its column for a non-sky blob
      let sy = 0, sc = 0;
      for (let y = 2; y < h - 2; y++) {
        if (!isFree(idx(px, y))) { sy += y; sc++; }
      }
      if (sc > 0) py = Math.round(sy / sc);
    }
    prevGray = gray;

    // --- find the next obstacle column to the right of the donut, and its gap ---
    const x1 = Math.min(w - 2, px + Math.round(cfg.lookMin * w));
    const x2 = Math.min(w - 2, px + Math.round(cfg.lookMax * w));
    let target = py, haveGap = false, obstacleX = -1;
    for (let x = x1; x <= x2; x += 2) {
      let obstacleCount = 0;
      for (let y = 0; y < h; y++) if (!isFree(idx(x, y))) obstacleCount++;
      if (obstacleCount > h * 0.18) {   // this column has a pipe/obstacle
        obstacleX = x;
        // find the gap: longest FREE vertical run that has an obstacle above it
        let runStart = -1, bestLen = 0, bestC = py, sawObstacleAbove = false;
        for (let y = 0; y <= h; y++) {
          const free = y < h && isFree(idx(x, y));
          if (free && runStart < 0) runStart = y;
          if ((!free || y === h) && runStart >= 0) {
            const len = y - runStart;
            // a real gap is bounded above by obstacle (skip the top sky run)
            if (sawObstacleAbove && len > bestLen) {
              bestLen = len; bestC = runStart + len / 2;
            }
            runStart = -1;
          }
          if (!free) sawObstacleAbove = true;
        }
        if (bestLen > 0) { target = bestC; haveGap = true; }
        break;
      }
    }

    return { px, py, target, haveGap, obstacleX, w, h };
  }

  // =========================================================================
  // Control
  // =========================================================================
  function step() {
    if (!running) return;
    rafId = requestAnimationFrame(step);

    if (!canvas || !canvas.isConnected) {
      canvas = findCanvas();
      if (!canvas) { setStatus("searching for game canvas…"); return; }
    }

    const img = grabPixels();
    if (!img) {
      setStatus("⚠ can't read canvas (cross-origin or WebGL). Taps still firing.");
      // blind fallback: gentle metronome tap so the donut doesn't drop
      maybeTap(performance.now() % 700 < 30);
      return;
    }

    const a = analyze(img);
    // scale player coords back to display space ratio is irrelevant; we tap centre
    const newY = a.py;
    player.vy = player.found ? newY - player.y : 0;
    player.x = a.px; player.y = newY; player.found = true;

    let targetY = a.target + cfg.targetBias * a.h;
    const dead = cfg.deadzone * a.h;
    const predicted = a.py + player.vy * cfg.velGain;

    let wantTap = false;
    if (a.haveGap) {
      wantTap = predicted > targetY + dead;
    } else {
      // no obstacle in view: just hover around mid-low, don't smash ceiling
      wantTap = predicted > a.h * 0.62;
    }
    maybeTap(wantTap);

    setStatus(
      `${a.haveGap ? "gap@" + Math.round(a.target) : "open"} | ` +
      `donut y=${Math.round(a.py)} vy=${player.vy.toFixed(1)} ` +
      `${wantTap ? "▲TAP" : "—"}`
    );
  }

  function maybeTap(want) {
    if (!want) return;
    const now = performance.now();
    if (now - lastTap < cfg.cooldownMs) return;
    lastTap = now;
    tap();
  }

  // =========================================================================
  // Input synthesis — cover every common scheme
  // =========================================================================
  function tap() {
    const r = canvas.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const targets = [canvas, document, window];

    // Pointer + Mouse
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      const Ctor = type.startsWith("pointer") ? PointerEvent : MouseEvent;
      const ev = new Ctor(type, {
        bubbles: true, cancelable: true, composed: true,
        clientX: cx, clientY: cy, view: window, button: 0,
        pointerId: 1, pointerType: "touch", isPrimary: true,
      });
      canvas.dispatchEvent(ev);
    }

    // Touch
    try {
      const t = new Touch({ identifier: 1, target: canvas, clientX: cx, clientY: cy });
      for (const type of ["touchstart", "touchend"]) {
        const ev = new TouchEvent(type, {
          bubbles: true, cancelable: true, composed: true,
          touches: type === "touchstart" ? [t] : [],
          targetTouches: type === "touchstart" ? [t] : [],
          changedTouches: [t],
        });
        canvas.dispatchEvent(ev);
      }
    } catch (e) { /* TouchEvent ctor unsupported on desktop—fine */ }

    // Keyboard (Space / ArrowUp / W) — many flappy clones use these
    for (const [key, code, keyCode] of [[" ", "Space", 32], ["ArrowUp", "ArrowUp", 38]]) {
      for (const type of ["keydown", "keyup"]) {
        const ev = new KeyboardEvent(type, {
          bubbles: true, cancelable: true, composed: true, key, code, keyCode, which: keyCode,
        });
        for (const tgt of targets) tgt.dispatchEvent(ev);
      }
    }
  }

  // =========================================================================
  // Start-button auto-press
  // =========================================================================
  function clickStart() {
    const rx = /\b(start|play|tap to (start|play)|begin|go|new game|restart|continue)\b/i;
    const candidates = [...document.querySelectorAll(
      "button, [role=button], a, input[type=button], input[type=submit], div, span"
    )];
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const txt = (el.innerText || el.value || el.getAttribute("aria-label") || "").trim();
      if (txt && txt.length < 30 && rx.test(txt)) {
        el.click();
        // also dispatch a pointer tap in case it's canvas-drawn-looking
        return true;
      }
    }
    // fallback: tap the canvas centre (many games start on first tap)
    if (canvas) { tap(); return true; }
    return false;
  }

  // =========================================================================
  // Control panel UI
  // =========================================================================
  function buildPanel() {
    if (panel) return;
    panel = document.createElement("div");
    panel.style.cssText = `
      position:fixed; z-index:2147483647; top:12px; right:12px; width:230px;
      font:12px/1.4 system-ui,sans-serif; color:#fff; background:rgba(20,20,28,.92);
      border:1px solid #ff7ad9; border-radius:10px; padding:10px;
      box-shadow:0 6px 24px rgba(0,0,0,.5); user-select:none;`;
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="font-size:16px">🍩</span>
        <b style="flex:1">Donut Autoplayer</b>
        <span id="dab-grip" style="cursor:move;opacity:.6">⠿</span>
      </div>
      <button id="dab-toggle" style="width:100%;padding:7px;border:0;border-radius:7px;
        background:#ff4fb8;color:#fff;font-weight:700;cursor:pointer">▶ START BOT</button>
      <div id="dab-status" style="margin:7px 0;font-size:11px;color:#9fe">idle</div>
      <details><summary style="cursor:pointer;color:#ffb">tuning</summary>
        <div id="dab-sliders" style="margin-top:6px"></div>
        <button id="dab-reset" style="width:100%;margin-top:6px;padding:4px;border:0;
          border-radius:6px;background:#444;color:#fff;cursor:pointer">reset defaults</button>
      </details>
      <div style="margin-top:6px;font-size:10px;opacity:.6">Ctrl+Shift+B toggles</div>`;
    document.documentElement.appendChild(panel);

    statusEl = panel.querySelector("#dab-status");
    panel.querySelector("#dab-toggle").onclick = toggle;
    panel.querySelector("#dab-reset").onclick = () => { cfg = { ...DEFAULTS }; save(); buildSliders(); };
    makeDraggable(panel, panel.querySelector("#dab-grip"));
    buildSliders();
  }

  const SLIDERS = [
    ["lookMax", 0.1, 0.6, 0.01, "look-ahead"],
    ["deadzone", 0.0, 0.15, 0.005, "deadzone"],
    ["targetBias", -0.15, 0.15, 0.005, "aim up/down"],
    ["velGain", 0, 14, 1, "fall predict"],
    ["cooldownMs", 40, 250, 5, "tap cooldown"],
    ["bgTol", 20, 140, 5, "colour sens."],
  ];
  function buildSliders() {
    const box = panel.querySelector("#dab-sliders");
    box.innerHTML = "";
    for (const [key, min, max, stp, label] of SLIDERS) {
      const row = document.createElement("label");
      row.style.cssText = "display:flex;align-items:center;gap:6px;margin:3px 0;font-size:10px";
      const val = document.createElement("span");
      val.style.cssText = "width:42px;text-align:right;color:#9fe";
      val.textContent = cfg[key];
      const inp = document.createElement("input");
      inp.type = "range"; inp.min = min; inp.max = max; inp.step = stp; inp.value = cfg[key];
      inp.style.flex = "1";
      inp.oninput = () => { cfg[key] = parseFloat(inp.value); val.textContent = cfg[key]; save(); };
      row.append(Object.assign(document.createElement("span"),
        { textContent: label, style: "width:62px" }), inp, val);
      box.appendChild(row);
    }
  }

  function makeDraggable(el, handle) {
    let sx, sy, ox, oy, drag = false;
    handle.addEventListener("mousedown", (e) => {
      drag = true; sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect(); ox = r.left; oy = r.top; e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!drag) return;
      el.style.left = ox + (e.clientX - sx) + "px";
      el.style.top = oy + (e.clientY - sy) + "px";
      el.style.right = "auto";
    });
    window.addEventListener("mouseup", () => (drag = false));
  }

  function setStatus(s) { if (statusEl) statusEl.textContent = s; }

  // =========================================================================
  // lifecycle
  // =========================================================================
  function toggle() { running ? stop() : start(); }

  function start() {
    canvas = findCanvas();
    running = true;
    startTries = 0;
    prevGray = null; player.found = false;
    const btn = panel?.querySelector("#dab-toggle");
    if (btn) { btn.textContent = "⏸ STOP BOT"; btn.style.background = "#36c"; }
    if (cfg.autoStart) {
      // try a few times — the Start button might appear after a beat
      const tryStart = () => {
        if (!running) return;
        if (clickStart() || startTries++ > 6) return;
        setTimeout(tryStart, 350);
      };
      tryStart();
    }
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(step);
    setStatus("running…");
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    const btn = panel?.querySelector("#dab-toggle");
    if (btn) { btn.textContent = "▶ START BOT"; btn.style.background = "#ff4fb8"; }
    setStatus("stopped");
  }

  // persistence
  function save() { try { chrome.storage?.local.set({ donutCfg: cfg }); } catch (e) {} }
  function load() {
    try {
      chrome.storage?.local.get("donutCfg", (r) => {
        if (r && r.donutCfg) cfg = { ...DEFAULTS, ...r.donutCfg };
        if (panel) buildSliders();
      });
    } catch (e) {}
  }

  // messages from popup / keyboard command
  try {
    chrome.runtime?.onMessage.addListener((msg, _s, send) => {
      if (msg?.type === "toggle") { toggle(); send?.({ running }); }
      if (msg?.type === "status") send?.({ running });
      return true;
    });
  } catch (e) {}

  // boot
  function boot() {
    buildPanel();
    load();
    canvas = findCanvas();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else boot();
})();
