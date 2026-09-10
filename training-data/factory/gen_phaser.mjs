/**
 * gen_phaser.mjs - build Phaser training rows that are PROVEN to render.
 *
 *   node factory/gen_phaser.mjs 2000            (hub server must be running on :3001)
 *
 * WHY THIS EXISTS
 * ---------------
 * The old Phaser slice was harvested from the official examples. Measured 2026-09-08:
 * 71% loaded assets from a server that does not exist outside phaser.io, 95% targeted a
 * `phaser-example` DOM node, and the fine-tuned model reproduced all of it - scoring 0/12
 * on a Chromium-verified eval, with 11 of 12 failures traced to a missing asset. Filtering
 * left 776 usable rows out of 4,242.
 *
 * The `interpret` slice, by contrast, is 100% clean - because it was GENERATED parametrically
 * and executed before each row counted, never harvested. This applies the same method to
 * Phaser: parametric programs using only generated graphics, each one loaded in real headless
 * Chromium and kept only if the engine booted, a canvas appeared, and nothing threw.
 *
 * Costs nothing to run - local generation, local Chromium. No GPU.
 */
import { writeFileSync } from 'fs';
import { createHash } from 'crypto';

const TARGET = parseInt(process.argv[2] || '1000', 10);
const OUT = process.argv[3] || 'dataset_phaser_gen.jsonl';
const HUB = process.env.HUB || 'http://localhost:3001';
const ATTEMPT_MULT = parseInt(process.env.ATTEMPT_MULT || '4', 10);

const SYSTEM = 'You are an expert Phaser 3 game developer. You write complete, runnable Phaser 3 '
  + 'programs using only real Phaser 3 APIs (Phaser.Game, scenes, this.add, this.physics, '
  + 'this.tweens, this.input, this.time). Draw with generated graphics - never load external '
  + 'assets. Return code that runs as given.';

// Full-period LCG (Math.imul avoids the float64 overflow that capped the interpret
// generator at 2,945 unique rows before it was fixed).
let seed = 20260908;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const hex = () => '0x' + pick(['ff4444', '44ff88', '4488ff', 'ffcc44', 'cc44ff', '44ffee', 'ff8844']);

const W = () => pick([640, 800, 960]);
const H = () => pick([480, 600]);
const CASUAL = ['', 'a simple ', 'a basic ', 'just ', 'a small ', 'make ', 'build '];
const casual = (s) => (pick(CASUAL) + s).trim();

// Wrap a scene body into a complete, self-contained program.
const program = (w, h, body, bg) =>
`class Example extends Phaser.Scene {
  create () {
${body}
  }
}
new Phaser.Game({ type: Phaser.AUTO, width: ${w}, height: ${h}, backgroundColor: '${bg || '#1a1a2e'}', scene: Example });`;

const R = {};

R.follow = () => {
  const w = W(), h = H(), pw = ri(60, 140), ph = ri(10, 22), c = hex();
  return { tag: 'follow', request: casual('a paddle at the bottom that follows the mouse'),
    code: program(w, h,
`    const paddle = this.add.rectangle(${w / 2}, ${h - 30}, ${pw}, ${ph}, ${c});
    this.input.on('pointermove', (p) => {
      paddle.x = Phaser.Math.Clamp(p.x, ${pw / 2}, ${w - pw / 2});
    });`) };
};

R.bounce = () => {
  const w = W(), h = H(), r = ri(8, 20), vx = ri(2, 6), vy = ri(2, 6), c = hex();
  return { tag: 'bounce', request: casual('a ball that bounces off all four walls'),
    code: program(w, h,
`    const ball = this.add.circle(${w / 2}, ${h / 2}, ${r}, ${c});
    let vx = ${vx}, vy = ${vy};
    this.events.on('update', () => {
      ball.x += vx; ball.y += vy;
      if (ball.x <= ${r} || ball.x >= ${w - r}) vx = -vx;
      if (ball.y <= ${r} || ball.y >= ${h - r}) vy = -vy;
    });`) };
};

R.spawnRow = () => {
  const w = W(), h = H(), n = ri(3, 8), size = ri(18, 40), speed = ri(1, 4), c = hex();
  return { tag: 'spawnRow', request: casual(`${n} enemies that move down and wrap to the top`),
    code: program(w, h,
`    const enemies = [];
    for (let i = 0; i < ${n}; i++) {
      enemies.push(this.add.rectangle(${Math.floor(w / (n + 1))} * (i + 1), ${ri(20, 80)}, ${size}, ${size}, ${c}));
    }
    this.events.on('update', () => {
      for (const e of enemies) { e.y += ${speed}; if (e.y > ${h + size}) e.y = -${size}; }
    });`) };
};

R.keyboardMove = () => {
  const w = W(), h = H(), size = ri(20, 44), sp = ri(2, 7), c = hex();
  return { tag: 'keyboardMove', request: casual('a square you move with the arrow keys, clamped to the screen'),
    code: program(w, h,
`    const player = this.add.rectangle(${w / 2}, ${h / 2}, ${size}, ${size}, ${c});
    const cursors = this.input.keyboard.createCursorKeys();
    this.events.on('update', () => {
      if (cursors.left.isDown)  player.x -= ${sp};
      if (cursors.right.isDown) player.x += ${sp};
      if (cursors.up.isDown)    player.y -= ${sp};
      if (cursors.down.isDown)  player.y += ${sp};
      player.x = Phaser.Math.Clamp(player.x, ${size / 2}, ${w - size / 2});
      player.y = Phaser.Math.Clamp(player.y, ${size / 2}, ${h - size / 2});
    });`) };
};

R.scoreTimer = () => {
  const w = W(), h = H(), step = ri(5, 50), ms = pick([250, 500, 1000]);
  return { tag: 'scoreTimer', request: casual(`a score counter that goes up by ${step} on a timer`),
    code: program(w, h,
`    let score = 0;
    const label = this.add.text(16, 16, 'Score: 0', { fontSize: '20px', color: '#ffffff' });
    this.time.addEvent({ delay: ${ms}, loop: true, callback: () => {
      score += ${step};
      label.setText('Score: ' + score);
    }});`) };
};

R.gravity = () => {
  const w = W(), h = H(), size = ri(20, 40), g = ri(200, 900), c = hex();
  return { tag: 'gravity', request: casual('a box that falls under gravity and lands on a platform'),
    code: `class Example extends Phaser.Scene {
  create () {
    const ground = this.add.rectangle(${w / 2}, ${h - 20}, ${w}, 20, 0x555577);
    this.physics.add.existing(ground, true);
    const box = this.add.rectangle(${w / 2}, ${ri(40, 120)}, ${size}, ${size}, ${c});
    this.physics.add.existing(box);
    box.body.setBounce(0.${ri(1, 6)});
    this.physics.add.collider(box, ground);
  }
}
new Phaser.Game({ type: Phaser.AUTO, width: ${w}, height: ${h}, backgroundColor: '#1a1a2e',
  physics: { default: 'arcade', arcade: { gravity: { y: ${g} } } }, scene: Example });` };
};

R.tween = () => {
  const w = W(), h = H(), size = ri(30, 70), dur = ri(600, 2500), c = hex();
  const kind = pick(['angle', 'scale', 'alpha', 'x']);
  const prop = kind === 'angle' ? 'angle: 360' : kind === 'scale' ? 'scaleX: 1.8, scaleY: 1.8'
    : kind === 'alpha' ? 'alpha: 0.2' : `x: ${w - 60}`;
  return { tag: 'tween', request: casual(`a shape that animates its ${kind} forever`),
    code: program(w, h,
`    const shape = this.add.rectangle(${kind === 'x' ? 60 : Math.floor(w / 2)}, ${h / 2}, ${size}, ${size}, ${c});
    this.tweens.add({ targets: shape, ${prop}, duration: ${dur}, yoyo: ${kind !== 'angle'}, repeat: -1 });`) };
};

R.grid = () => {
  const w = W(), h = H(), cols = ri(4, 10), rows = ri(2, 5), pad = ri(4, 12), c = hex();
  const cw = Math.floor((w - pad * (cols + 1)) / cols), ch = ri(14, 26);
  return { tag: 'grid', request: casual('a grid of bricks that disappear when clicked'),
    code: program(w, h,
`    for (let r = 0; r < ${rows}; r++) {
      for (let c = 0; c < ${cols}; c++) {
        const brick = this.add.rectangle(${pad} + c * ${cw + pad} + ${cw / 2}, 60 + r * ${ch + pad}, ${cw}, ${ch}, ${c});
        brick.setInteractive();
        brick.on('pointerdown', () => brick.destroy());
      }
    }`) };
};

R.orbit = () => {
  const w = W(), h = H(), rad = ri(60, 160), sp = (ri(1, 5) / 100).toFixed(2), c = hex();
  return { tag: 'orbit', request: casual('a dot orbiting the centre of the screen'),
    code: program(w, h,
`    const dot = this.add.circle(${w / 2 + rad}, ${h / 2}, ${ri(6, 14)}, ${c});
    let a = 0;
    this.events.on('update', () => {
      a += ${sp};
      dot.x = ${w / 2} + Math.cos(a) * ${rad};
      dot.y = ${h / 2} + Math.sin(a) * ${rad};
    });`) };
};

R.healthBar = () => {
  const w = W(), h = H(), max = ri(60, 200), bw = ri(120, 260);
  return { tag: 'healthBar', request: casual('a health bar that drains over time'),
    code: program(w, h,
`    let hp = ${max};
    this.add.rectangle(20, 20, ${bw}, 18, 0x333344).setOrigin(0, 0);
    const fill = this.add.rectangle(20, 20, ${bw}, 18, 0xff4444).setOrigin(0, 0);
    const label = this.add.text(20, 44, 'HP: ' + hp, { fontSize: '16px', color: '#ffffff' });
    this.time.addEvent({ delay: ${pick([200, 400, 800])}, loop: true, callback: () => {
      hp = Math.max(0, hp - ${ri(1, 9)});
      fill.width = ${bw} * (hp / ${max});
      label.setText('HP: ' + hp);
    }});`) };
};

// ---------------------------------------------------------------------------
async function verify(code) {
  try {
    const r = await fetch(HUB + '/api/game/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine: 'phaser', code }), signal: AbortSignal.timeout(90000) });
    if (!r.ok) return null;                       // harness problem, not a verdict
    return (await r.json()).ok === true;
  } catch { return null; }
}

const names = Object.keys(R);
const rows = [], seen = new Set();
let attempts = 0, dup = 0, rejected = 0, unreachable = 0;
const tally = {};

console.log(`generating ${TARGET} verified Phaser rows from ${names.length} families...`);
// Verification is the bottleneck: each row pays a full Chromium launch (~5s), and doing
// that serially put 2,500 rows at ~2h45m. The work is embarrassingly parallel - separate
// browsers, no shared state - so run CONCURRENCY of them at once. Generation itself is
// pure CPU; only the verify needs fanning out.
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '8', 10);

async function worker() {
  while (rows.length < TARGET && attempts < TARGET * ATTEMPT_MULT) {
    attempts++;
    let b;
    try { b = R[names[attempts % names.length]](); } catch { continue; }
    const key = createHash('sha1').update(b.code).digest('hex');
    if (seen.has(key)) { dup++; continue; }
    seen.add(key);                     // claim before awaiting, so peers skip it
    const ok = await verify(b.code);
    if (ok === null) {
      // The verifier is unreachable (server restarted, or overloaded). This is NOT a
      // verdict and must not consume the attempt budget - with concurrency, cheap
      // failures burn thousands of attempts in seconds and the run ends with nothing.
      // Back off, give the budget back, and retry.
      unreachable++; seen.delete(key); attempts--;
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }   // never record a harness failure
    if (!ok) { rejected++; continue; }
    tally[b.tag] = (tally[b.tag] || 0) + 1;
    rows.push({ messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: b.request },
      { role: 'assistant', content: '```javascript\n' + b.code.trim() + '\n```' },
    ]});
    if (rows.length % 25 === 0) {
      writeFileSync(OUT, rows.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
      console.log(`  ${rows.length}/${TARGET}  (rejected ${rejected}, dup ${dup})`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
writeFileSync(OUT, rows.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
console.log(`\nkept ${rows.length} verified rows -> ${OUT}`);
console.log(`attempts ${attempts} | rejected by chromium ${rejected} | duplicates ${dup}` + (unreachable ? ` | unreachable ${unreachable}` : ''));
console.log('by family:', JSON.stringify(tally));
