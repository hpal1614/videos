/* Headless gameplay test for the Donut Flappy bot.
 *
 * Renders a flappybird.io-like scene to a REAL canvas (native pixels via
 * @napi-rs/canvas), then feeds those pixels to the SHIPPED bot-core.js and lets
 * the bot's taps drive the bird. The bot only ever sees pixels — never the
 * game's internal state — so this exercises the real vision + control path.
 *
 *   npm i @napi-rs/canvas
 *   node test-sim.js                 # defaults: colour mode, 300s
 *   VG=1 GB=0.4 FR=18000 node test-sim.js   # override velGain / gapBiasFrac / frames
 */
const { createCanvas } = require("@napi-rs/canvas");
const core = require("./bot-core.js");
const sim = require("./test-scene.js");

function run({ frames, preset }) {
  const canvas = createCanvas(sim.W, sim.H);
  const ctx = canvas.getContext("2d");
  const bot = core.createBot(preset);
  const g = sim.mkGame(); sim.spawn(g); sim.spawn(g); sim.spawn(g);
  let maxScore = 0, total = 0, taps = 0, deaths = 0;
  for (let f = 0; f < frames; f++) {
    sim.render(ctx, g);
    const { tap } = bot.tick(ctx.getImageData(0, 0, sim.W, sim.H), f * (1000 / 60));
    if (tap) { sim.flap(g); taps++; }
    sim.update(g);
    if (g.dead) {
      maxScore = Math.max(maxScore, g.score); total += g.score; deaths++;
      Object.assign(g, sim.mkGame()); sim.spawn(g); sim.spawn(g); sim.spawn(g); bot.reset();
    }
  }
  maxScore = Math.max(maxScore, g.score); total += g.score;
  return { maxScore, total, deaths, taps };
}

const FR = parseInt(process.env.FR ?? "18000", 10);
const preset = {
  playerMode: "color", playerColor: sim.BIRD, playerColorTol: 95, obstacleMode: "auto", bgTol: 70,
  velGain: parseFloat(process.env.VG ?? core.defaults().velGain),
  gapBiasFrac: parseFloat(process.env.GB ?? core.defaults().gapBiasFrac),
};
const r = run({ frames: FR, preset });
const pass = r.maxScore >= 50 && r.deaths <= 2;
console.log(`scene ${sim.W}x${sim.H} gap=${sim.GAP}px | ${(FR / 60).toFixed(0)}s: ` +
  `best run=${r.maxScore} pipes, total=${r.total}, deaths=${r.deaths}, taps=${r.taps} => ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
