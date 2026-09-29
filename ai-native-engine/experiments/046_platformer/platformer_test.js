'use strict';
// =============================================================================
// RD-036 bar 1 — the platformer PLAYS on today's grammar, zero core edits, safe.
// Observable: a player dropped from above FALLS under gravity, LANDS on a platform
// (proximity ⇒ grounded ⇒ vy arrested), STOPS, and a JUMP input launches it back
// up. Controls (RD-029 discipline): a player with no platform beneath never lands;
// the ruleset produces exactly ONE write-smell advisory (move_y), the same shape
// as Pong's ball_move_y — the RD-035 check generalizing to a fourth genre.
//   node experiments/046_platformer/platformer_test.js
// =============================================================================
const path = require('node:path');
const R = require(path.join(__dirname, 'platformer_rules.js'));
const { buildWorld, install, H, NEAR_R, PLAT_Y } = R;

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

const BAND_LO = PLAT_Y - NEAR_R, BAND_HI = PLAT_Y + NEAR_R;   // grounded band [184,216]

// helpers to spawn + read through the live system view
function world() {
  const { g, T } = buildWorld();
  const res = install(g);
  return { g, T, res };
}
const uuidOf = (g, type, name) => { const v = g._systemView(); return v.allOfType(type).find((u) => v.nameOf(u) === name); };
const fld = (g, u, f) => g._systemView().field(u, f);

// ---- install: all rules gate-clean; exactly one advisory, on move_y ----------
{
  const { res } = world();
  ok(res.every((r) => r.ok), 'all 5 platformer rules install through the gate');
  const flagged = res.filter((r) => (r.warnings || []).some((w) => w.code === 'unconditional_write')).map((r) => r.name);
  ok(JSON.stringify(flagged) === JSON.stringify(['move_y']),
    `RD-035 advisory fires on EXACTLY move_y (physics owns y) — same shape as ball_move_y, a 4th-genre confirmation (got: [${flagged.join(', ')}])`);
  const guarded = res.filter((r) => ['gravity', 'land', 'jump'].includes(r.name));
  ok(guarded.every((r) => !(r.warnings || []).some((w) => w.code === 'unconditional_write')),
    'the vy writers (gravity/land/jump) are scoped apart — NO contention advisory (RD-035 applied at design time)');
}

// ---- observable: fall → land → rest ------------------------------------------
{
  const { g, T } = world();
  g.spawn(T.player, { name: 'hero', x: 128, y: 40 });
  g.spawn(T.platform, { name: 'ground', x: 128, y: PLAT_Y });
  const hero = uuidOf(g, 'player', 'hero');
  const trace = [];
  let unsafe = 0, deferrals = 0;
  for (let t = 0; t < 40; t++) {
    const r = g.stepTick();
    deferrals += r.deferrals.length;
    if (!g.indexesConsistent()) unsafe++;
    trace.push(fld(g, hero, 'y'));
  }
  const startY = 40, maxY = Math.max(...trace), finalY = trace[trace.length - 1];
  ok(trace[0] >= startY && maxY > 150, `the player FELL under gravity (y ${startY} → max ${maxY})`);
  ok(maxY <= BAND_HI, `it did NOT tunnel through the platform (max y ${maxY} ≤ band top ${BAND_HI})`);
  const monotoneWhileFalling = trace.every((y, i) => i === 0 || y >= trace[i - 1] - 0);   // never rose during the drop
  ok(monotoneWhileFalling, 'y only ever increased while falling — no bounce/oscillation');
  ok(finalY >= BAND_LO && finalY <= BAND_HI, `it LANDED in the platform band [${BAND_LO},${BAND_HI}] (rest y ${finalY})`);
  ok(trace[39] === trace[38] && trace[38] === trace[37], `it came to REST (stable y for the last ticks: ${trace[37]},${trace[38]},${trace[39]})`);
  ok(fld(g, hero, 'on_ground') === 1 && fld(g, hero, 'vy') === 0, 'at rest: on_ground=1, vy=0 (grounded, not falling)');
  ok(unsafe === 0 && deferrals === 0, `SAFE + CONTENTION-FREE across 40 ticks (unsafe=${unsafe}, deferrals=${deferrals})`);
}

// ---- jump: a grounded player launches upward on input ------------------------
{
  const { g, T } = world();
  g.spawn(T.player, { name: 'hero', x: 128, y: 40 });
  g.spawn(T.platform, { name: 'ground', x: 128, y: PLAT_Y });
  const hero = uuidOf(g, 'player', 'hero');
  for (let t = 0; t < 30; t++) g.stepTick();                 // let it land + rest
  const restY = fld(g, hero, 'y');
  ok(fld(g, hero, 'on_ground') === 1, 'precondition: the player is resting on the ground');
  // hold jump for a few ticks
  let rose = false, minY = restY;
  for (let t = 0; t < 6; t++) {
    g.stepTick([{ actor: 'p', ops: [{ kind: 'setfield', target: hero, field: 'jump', value: 1 }] }]);
    const y = fld(g, hero, 'y'); minY = Math.min(minY, y);
    if (fld(g, hero, 'vy') < 0) rose = true;
  }
  ok(rose, 'jump input drove vy NEGATIVE — the player launched upward (guarded impulse)');
  ok(minY < restY, `the player actually ROSE above its rest height (min y ${minY} < rest ${restY})`);
  // release jump; gravity brings it back down and it lands again
  for (let t = 0; t < 40; t++) g.stepTick([{ actor: 'p', ops: [{ kind: 'setfield', target: hero, field: 'jump', value: 0 }] }]);
  ok(fld(g, hero, 'on_ground') === 1 && fld(g, hero, 'vy') === 0, 'after the jump, gravity returns it to rest on the platform (full cycle)');
}

// ---- control: no platform beneath ⇒ it NEVER lands (falls to the floor) -------
{
  const { g, T } = world();
  g.spawn(T.player, { name: 'faller', x: 10, y: 40 });        // x=10, platform is at x=128 → never near
  g.spawn(T.platform, { name: 'ground', x: 128, y: PLAT_Y });
  const faller = uuidOf(g, 'player', 'faller');
  for (let t = 0; t < 60; t++) g.stepTick();
  ok(fld(g, faller, 'y') === H && fld(g, faller, 'on_ground') === 0,
    `CONTROL: a player far from any platform never grounds — falls to the floor y=${H}, on_ground=0 (the bar is losable)`);
}

// ---- determinism: two identical runs produce identical traces ----------------
{
  const run = () => {
    const { g, T } = world();
    g.spawn(T.player, { name: 'hero', x: 128, y: 40 });
    g.spawn(T.platform, { name: 'ground', x: 128, y: PLAT_Y });
    const hero = uuidOf(g, 'player', 'hero');
    const tr = [];
    for (let t = 0; t < 30; t++) { g.stepTick(); tr.push(fld(g, hero, 'y') + ',' + fld(g, hero, 'vy')); }
    return tr.join('|');
  };
  ok(run() === run(), 'deterministic: two identical runs produce byte-identical (y,vy) traces');
}

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed — RD-036: platformer, a 4th genre, zero core edits`);
process.exit(FAIL ? 1 : 0);
