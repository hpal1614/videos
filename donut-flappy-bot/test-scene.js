/* Shared flappybird.io-like simulator (real-pixel rendering). */
const W = 288, H = 512;
const SKY = [78, 192, 202];
const PIPE = [88, 173, 62];
const BUSH = [96, 140, 70];
const GROUND = [222, 184, 135];
const BIRD = [228, 200, 70];
const GROUND_H = 56;
const BUSH_H = 26;

const GRAV = 0.45, FLAP = -7.6, SPEED = 2.2, PIPE_W = 52, GAP = 132, SPACING = 175;
const BIRD_X = Math.round(0.30 * W), BIRD_R = 12;
const playW = H - GROUND_H;

function mkGame() {
  return {
    y: H / 2, vy: 0, score: 0, deaths: 0, dead: false,
    pipes: [], nextX: W + 40,
    clouds: Array.from({ length: 5 }, () => ({ x: Math.random() * W, y: 40 + Math.random() * 120, r: 16 + Math.random() * 14 })),
    groundOff: 0,
  };
}
function spawn(g) {
  const margin = 70;
  const gapY = margin + Math.random() * (playW - GAP - margin * 2);
  g.pipes.push({ x: g.nextX, gapY, passed: false });
  g.nextX += SPACING;
}
function flap(g) { g.vy = FLAP; }
function update(g) {
  g.vy += GRAV; g.y += g.vy;
  g.groundOff = (g.groundOff + SPEED) % 16;
  for (const p of g.pipes) p.x -= SPEED;
  for (const c of g.clouds) { c.x -= SPEED * 0.3; if (c.x < -c.r) { c.x = W + c.r; c.y = 40 + Math.random() * 120; } }
  while (g.pipes.length && g.pipes[0].x + PIPE_W < 0) g.pipes.shift();
  if (!g.pipes.length || g.pipes[g.pipes.length - 1].x < W - SPACING) { g.nextX = (g.pipes.length ? g.pipes[g.pipes.length - 1].x + SPACING : W + 40); spawn(g); }
  for (const p of g.pipes) {
    if (!p.passed && p.x + PIPE_W < BIRD_X) { p.passed = true; g.score++; }
    const inX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
    if (inX && (g.y - BIRD_R < p.gapY || g.y + BIRD_R > p.gapY + GAP)) g.dead = true;
  }
  if (g.y + BIRD_R > playW || g.y - BIRD_R < 0) g.dead = true;
}
function render(ctx, g) {
  const fill = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  ctx.fillStyle = fill(SKY); ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  for (const c of g.clouds) { ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.arc(c.x + c.r, c.y + 4, c.r * 0.8, 0, 7); ctx.fill(); }
  ctx.fillStyle = fill(PIPE);
  for (const p of g.pipes) { ctx.fillRect(p.x, 0, PIPE_W, p.gapY); ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, playW - (p.gapY + GAP)); }
  ctx.fillStyle = fill(BUSH); ctx.fillRect(0, playW - BUSH_H, W, BUSH_H);
  ctx.fillStyle = fill(GROUND); ctx.fillRect(0, playW, W, GROUND_H);
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  for (let x = -16 + g.groundOff; x < W; x += 16) ctx.fillRect(x, playW, 8, GROUND_H);
  ctx.fillStyle = fill(BIRD); ctx.beginPath(); ctx.arc(BIRD_X, g.y, BIRD_R, 0, 7); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(BIRD_X + 4, g.y - 3, 3, 0, 7); ctx.fill();
  ctx.fillStyle = "#e07a1f"; ctx.fillRect(BIRD_X + BIRD_R - 2, g.y - 2, 6, 4);
}
module.exports = { W, H, SKY, PIPE, BUSH, GROUND, BIRD, GROUND_H, BUSH_H, GRAV, FLAP, SPEED, PIPE_W, GAP, SPACING, BIRD_X, BIRD_R, playW, mkGame, spawn, flap, update, render };
