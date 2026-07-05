/* Proves the self-trainer works: start from deliberately BAD control params,
 * play life after life, and check that survival time climbs as the (1+1)-ES
 * keeps parameter tweaks that help. Colour mode (stable vision) so we're
 * measuring the CONTROL learning, not detection.
 *
 *   node --expose-gc train-sim.js
 */
const { createCanvas } = require("@napi-rs/canvas");
const core = require("./bot-core.js");
const sim = require("./test-scene.js");

const canvas = createCanvas(sim.W, sim.H);
const ctx = canvas.getContext("2d");

const bot = core.createBot({
  playerMode: "color", playerColor: sim.BIRD, playerColorTol: 95, obstacleMode: "auto", bgTol: 70,
  autoCalibrate: false, train: true, livesPerEval: 3,
  // deliberately BAD starting control params:
  gapBiasFrac: 0.68, velGain: 4, deadzone: 0.02, cooldownMs: 135,
});

const EPISODES = 150, CAP = 1200;
const fits = [];
let globalFrame = 0;
for (let ep = 0; ep < EPISODES; ep++) {
  const g = sim.mkGame(); sim.spawn(g); sim.spawn(g); sim.spawn(g);
  bot.reset();
  let f = 0;
  for (; f < CAP; f++) {
    sim.render(ctx, g);
    const { tap } = bot.tick(ctx.getImageData(0, 0, sim.W, sim.H), f * (1000 / 60));
    if (tap) sim.flap(g);
    sim.update(g);
    if ((globalFrame++ & 255) === 0 && global.gc) global.gc();
    if (g.dead) break;
  }
  fits.push(f);                 // frames survived = fitness
  bot.onEpisodeEnd(f);
}

const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
const early = fits.slice(0, 15), late = fits.slice(-15);
const b = bot.trainingBest();
console.log(`episodes=${EPISODES}  livesPerEval=3`);
console.log(`survival (frames): first-15 avg=${avg(early)}  last-15 avg=${avg(late)}  best-life=${Math.max(...fits)}`);
console.log(`learned best params:`, Object.fromEntries(Object.entries(b.best).map(([k, v]) => [k, +v.toFixed(3)])), `bestFit=${Math.round(b.bestFit)} improvements=${b.episodes ? b.episodes : 0}`);
const improved = avg(late) > avg(early) * 1.4;
console.log(improved ? "\n✅ LEARNED: survival improved substantially" : "\n❌ no significant improvement");
process.exit(improved ? 0 : 1);
