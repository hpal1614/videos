/* Donut Flappy Autoplayer — content script (DOM glue around bot-core.js)
 *
 * bot-core.js holds the vision + control brain (and is unit/gameplay-tested in
 * Node against rendered pixels). This file just wires it to a real page:
 *   1. find the game <canvas>
 *   2. each frame, copy its pixels into a small offscreen buffer
 *   3. hand the pixels to the bot, and if it says "flap", fire taps
 *   4. auto-press Start, and auto-restart after a crash
 *   5. a draggable panel with live tuning sliders
 */
(() => {
  "use strict";
  if (window.__donutBotLoaded) return;        // avoid double-injection
  window.__donutBotLoaded = true;

  const Core = globalThis.DonutBotCore;
  if (!Core) { console.error("[DonutBot] bot-core.js not loaded"); return; }

  // Per-site presets, merged over the core defaults when the hostname matches.
  const PRESETS = {
    "flappybird.io": {
      playerMode: "color", playerColor: [228, 200, 70], playerColorTol: 95,
      obstacleMode: "auto", bgTol: 70,
    },
  };
  function presetForHost() {
    let p = {};
    for (const k in PRESETS) if (location.hostname.includes(k)) p = PRESETS[k];
    return { ...Core.defaults(), ...p };
  }
  function hostKey() { return "donutCfg:" + location.hostname; }

  let cfg = { debug: false, ...presetForHost() };

  // ---- state ----------------------------------------------------------------
  let running = false;
  let canvas = null;
  let off = null, octx = null;       // offscreen analysis buffer
  let bot = null;                    // Core bot instance
  let rafId = 0, startTries = 0;
  let stillFrames = 0, lastY = -1, frames = 0;
  let panel, statusEl;
  let dbg = null, dctx = null;   // debug overlay canvas

  // =========================================================================
  // Canvas discovery + pixel grab
  // =========================================================================
  function findCanvas() {
    const cs = [...document.querySelectorAll("canvas")].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 80 && r.height > 80;
    });
    if (!cs.length) return null;
    cs.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    });
    return cs[0];
  }

  function ensureBuffers() {
    const w = canvas.width || canvas.getBoundingClientRect().width;
    const h = canvas.height || canvas.getBoundingClientRect().height;
    const scale = Math.min(1, 320 / w);   // downscale for speed, keep aspect
    const bw = Math.max(40, Math.round(w * scale));
    const bh = Math.max(40, Math.round(h * scale));
    if (!off || off.width !== bw || off.height !== bh) {
      off = document.createElement("canvas");
      off.width = bw; off.height = bh;
      octx = off.getContext("2d", { willReadFrequently: true });
    }
    return { bw, bh };
  }

  function grabPixels() {
    const { bw, bh } = ensureBuffers();
    try {
      octx.drawImage(canvas, 0, 0, bw, bh);
      return octx.getImageData(0, 0, bw, bh);
    } catch (e) {
      return null;   // tainted (cross-origin) or WebGL without preserveDrawingBuffer
    }
  }

  // =========================================================================
  // Main loop
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
      setStatus("⚠ can't read canvas (cross-origin/WebGL). Blind tapping.");
      maybeTap(performance.now() % 700 < 30);   // gentle metronome fallback
      return;
    }

    const { tap: want, vision: v, decision: d } = bot.tick(img, performance.now());
    if (want) doTap();
    frames++;

    if (cfg.debug) drawDebug(v, d, want); else hideDebug();

    // auto-restart: if the bird stops moving (or vanishes) for ~1.3s, the game is
    // over — press Start again to keep racking up score.
    if (cfg.autoRestart) {
      if (v.found && Math.abs(v.py - lastY) > 1) { lastY = v.py; stillFrames = 0; }
      else stillFrames++;
      if (stillFrames > 80) { clickStart(); bot.reset(); stillFrames = 0; lastY = -1; }
    }

    setStatus(
      `${v.haveGap ? "gap@" + Math.round(v.gapCenter) : "open"} | ` +
      `bird y=${v.py} vy=${v.vy.toFixed(1)}${v.found ? "" : " (lost)"} ${want ? "▲" : "·"}`
    );
  }

  function maybeTap(want) { if (want) doTap(); }

  // =========================================================================
  // Debug overlay — draws what the bot sees onto the game, for diagnosis
  // =========================================================================
  function hideDebug() { if (dbg) dbg.style.display = "none"; }
  function drawDebug(v, d, tapped) {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    if (!dbg) {
      dbg = document.createElement("canvas");
      dbg.style.cssText = "position:fixed;z-index:2147483646;pointer-events:none;";
      document.documentElement.appendChild(dbg);
      dctx = dbg.getContext("2d");
    }
    dbg.style.display = "block";
    dbg.style.left = r.left + "px"; dbg.style.top = r.top + "px";
    dbg.style.width = r.width + "px"; dbg.style.height = r.height + "px";
    if (dbg.width !== Math.round(r.width) || dbg.height !== Math.round(r.height)) {
      dbg.width = Math.round(r.width); dbg.height = Math.round(r.height);
    }
    const sx = dbg.width / v.w, sy = dbg.height / v.h;
    dctx.clearRect(0, 0, dbg.width, dbg.height);

    // floor line
    dctx.strokeStyle = "rgba(255,180,0,.8)"; dctx.lineWidth = 2;
    line(0, v.floor * sy, dbg.width, v.floor * sy);
    // gap band + aim
    if (v.haveGap) {
      dctx.strokeStyle = "rgba(0,220,120,.9)";
      line(0, v.gapTop * sy, dbg.width, v.gapTop * sy);
      line(0, v.gapBottom * sy, dbg.width, v.gapBottom * sy);
      dctx.strokeStyle = "rgba(0,120,255,.9)";
      if (d.aim != null) line(0, d.aim * sy, dbg.width, d.aim * sy);
      if (v.obstacleX >= 0) { dctx.strokeStyle = "rgba(255,0,180,.7)"; line(v.obstacleX * sx, 0, v.obstacleX * sx, dbg.height); }
    }
    // bird marker
    dctx.strokeStyle = v.found ? "#00e0ff" : "#ff3b3b"; dctx.lineWidth = 3;
    dctx.beginPath(); dctx.arc(v.px * sx, v.py * sy, 12, 0, 7); dctx.stroke();
    // label
    dctx.fillStyle = "rgba(0,0,0,.6)"; dctx.fillRect(4, 4, 210, 46);
    dctx.fillStyle = "#fff"; dctx.font = "12px monospace";
    dctx.fillText(`${v.found ? "bird" : "NO BIRD"} y=${v.py} vy=${v.vy.toFixed(1)} ${tapped ? "TAP" : ""}`, 8, 20);
    dctx.fillText(`${d.reason}  ${v.haveGap ? "gap[" + v.gapTop + "-" + v.gapBottom + "]" : "no gap"}`, 8, 34);
    dctx.fillText(`sky=[${v.sky.map((n) => n | 0)}] floor=${v.floor}`, 8, 46);
  }
  function line(x1, y1, x2, y2) { dctx.beginPath(); dctx.moveTo(x1, y1); dctx.lineTo(x2, y2); dctx.stroke(); }

  // =========================================================================
  // Input synthesis — cover pointer / mouse / touch / keyboard
  // =========================================================================
  function doTap() {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const targets = [canvas, document, window];

    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      const Ctor = type.startsWith("pointer") ? PointerEvent : MouseEvent;
      canvas.dispatchEvent(new Ctor(type, {
        bubbles: true, cancelable: true, composed: true,
        clientX: cx, clientY: cy, view: window, button: 0,
        pointerId: 1, pointerType: "touch", isPrimary: true,
      }));
    }
    try {
      const t = new Touch({ identifier: 1, target: canvas, clientX: cx, clientY: cy });
      for (const type of ["touchstart", "touchend"]) {
        canvas.dispatchEvent(new TouchEvent(type, {
          bubbles: true, cancelable: true, composed: true,
          touches: type === "touchstart" ? [t] : [],
          targetTouches: type === "touchstart" ? [t] : [],
          changedTouches: [t],
        }));
      }
    } catch (e) { /* desktop has no TouchEvent ctor — fine */ }
    for (const [key, code, keyCode] of [[" ", "Space", 32], ["ArrowUp", "ArrowUp", 38]]) {
      for (const type of ["keydown", "keyup"]) {
        const ev = new KeyboardEvent(type, { bubbles: true, cancelable: true, composed: true, key, code, keyCode, which: keyCode });
        for (const tgt of targets) tgt.dispatchEvent(ev);
      }
    }
  }

  // =========================================================================
  // Start / restart-button auto-press
  // =========================================================================
  function clickStart() {
    const rx = /\b(start|play|tap to (start|play)|begin|go|new game|restart|retry|continue|ok)\b/i;
    const els = [...document.querySelectorAll("button, [role=button], a, input[type=button], input[type=submit], div, span")];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const txt = (el.innerText || el.value || el.getAttribute("aria-label") || "").trim();
      if (txt && txt.length < 30 && rx.test(txt)) { el.click(); return true; }
    }
    if (canvas) { doTap(); return true; }   // many games start on first tap
    return false;
  }

  // =========================================================================
  // Control panel UI
  // =========================================================================
  function buildPanel() {
    if (panel) return;
    panel = document.createElement("div");
    panel.style.cssText = `
      position:fixed; z-index:2147483647; top:12px; right:12px; width:236px;
      font:12px/1.4 system-ui,sans-serif; color:#fff; background:rgba(20,20,28,.92);
      border:1px solid #ff7ad9; border-radius:10px; padding:10px;
      box-shadow:0 6px 24px rgba(0,0,0,.5); user-select:none;`;
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="font-size:16px">🍩</span><b style="flex:1">Donut Autoplayer</b>
        <span id="dab-grip" style="cursor:move;opacity:.6">⠿</span>
      </div>
      <button id="dab-toggle" style="width:100%;padding:7px;border:0;border-radius:7px;
        background:#ff4fb8;color:#fff;font-weight:700;cursor:pointer">▶ START BOT</button>
      <div id="dab-status" style="margin:7px 0;font-size:11px;color:#9fe">idle</div>
      <label style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:4px;cursor:pointer">
        <input type="checkbox" id="dab-debug"> show vision (debug overlay)</label>
      <details><summary style="cursor:pointer;color:#ffb">tuning</summary>
        <div id="dab-sliders" style="margin-top:6px"></div>
        <button id="dab-reset" style="width:100%;margin-top:6px;padding:4px;border:0;
          border-radius:6px;background:#444;color:#fff;cursor:pointer">reset to preset</button>
      </details>
      <div style="margin-top:6px;font-size:10px;opacity:.6">Ctrl+Shift+B toggles</div>`;
    document.documentElement.appendChild(panel);
    statusEl = panel.querySelector("#dab-status");
    panel.querySelector("#dab-toggle").onclick = toggle;
    const dbgBox = panel.querySelector("#dab-debug");
    dbgBox.checked = !!cfg.debug;
    dbgBox.onchange = () => { cfg.debug = dbgBox.checked; if (!cfg.debug) hideDebug(); save(); };
    panel.querySelector("#dab-reset").onclick = () => { cfg = presetForHost(); if (bot) bot.cfg = { ...cfg }; save(); buildSliders(); };
    makeDraggable(panel, panel.querySelector("#dab-grip"));
    buildSliders();
  }

  const SLIDERS = [
    ["lookMax", 0.2, 0.6, 0.02, "look-ahead"],
    ["gapBiasFrac", 0, 1, 0.05, "aim low ↓"],
    ["deadzone", 0, 0.2, 0.01, "deadzone"],
    ["velGain", 0, 6, 1, "predict"],
    ["cooldownMs", 40, 200, 5, "cooldown"],
    ["bgTol", 20, 140, 5, "sky sens."],
    ["playerColorTol", 30, 160, 5, "bird sens."],
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
      inp.oninput = () => { const x = parseFloat(inp.value); cfg[key] = x; if (bot) bot.cfg[key] = x; val.textContent = x; save(); };
      row.append(Object.assign(document.createElement("span"), { textContent: label, style: "width:64px" }), inp, val);
      box.appendChild(row);
    }
  }

  function makeDraggable(el, handle) {
    let sx, sy, ox, oy, drag = false;
    handle.addEventListener("mousedown", (e) => { drag = true; sx = e.clientX; sy = e.clientY; const r = el.getBoundingClientRect(); ox = r.left; oy = r.top; e.preventDefault(); });
    window.addEventListener("mousemove", (e) => { if (!drag) return; el.style.left = ox + (e.clientX - sx) + "px"; el.style.top = oy + (e.clientY - sy) + "px"; el.style.right = "auto"; });
    window.addEventListener("mouseup", () => (drag = false));
  }

  function setStatus(s) { if (statusEl) statusEl.textContent = s; }

  // =========================================================================
  // lifecycle
  // =========================================================================
  function toggle() { running ? stop() : start(); }

  function start() {
    canvas = findCanvas();
    bot = Core.createBot(cfg);
    running = true; startTries = 0; stillFrames = 0; lastY = -1; frames = 0;
    const btn = panel?.querySelector("#dab-toggle");
    if (btn) { btn.textContent = "⏸ STOP BOT"; btn.style.background = "#36c"; }
    if (cfg.autoStart) {
      const tryStart = () => { if (!running) return; if (clickStart() || startTries++ > 6) return; setTimeout(tryStart, 350); };
      tryStart();
    }
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(step);
    setStatus("running…");
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    hideDebug();
    const btn = panel?.querySelector("#dab-toggle");
    if (btn) { btn.textContent = "▶ START BOT"; btn.style.background = "#ff4fb8"; }
    setStatus("stopped");
  }

  // persistence (per-host, so tuning one game doesn't disturb another)
  function save() { try { chrome.storage?.local.set({ [hostKey()]: cfg }); } catch (e) {} }
  function load() {
    try {
      chrome.storage?.local.get(hostKey(), (r) => {
        const saved = r && r[hostKey()];
        cfg = saved ? { ...presetForHost(), ...saved } : presetForHost();
        if (bot) bot.cfg = { ...cfg };
        if (panel) buildSliders();
      });
    } catch (e) {}
  }

  try {
    chrome.runtime?.onMessage.addListener((msg, _s, send) => {
      if (msg?.type === "toggle") { toggle(); send?.({ running }); }
      if (msg?.type === "status") send?.({ running });
      return true;
    });
  } catch (e) {}

  function boot() { buildPanel(); load(); canvas = findCanvas(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
