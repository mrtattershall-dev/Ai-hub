'use strict';
// =============================================================================
// RD-037 bar 1 — the racer PLAYS on today's grammar, zero core edits, safe.
// Observable: a car accelerates to top speed, drives out to the far marker and
// back across the finish = ONE lap; a second loop = two; idling on the line does
// NOT farm laps (the `armed` flag); a car that never reaches the far side scores
// no lap (the bar is losable). Plus the RD-035 advisory generalizes (fires only on
// the unconditional position writes drive_x/drive_y).
//   node experiments/047_racing/racing_test.js
// =============================================================================
const path = require('node:path');
const R = require(path.join(__dirname, 'racing_rules.js'));
const { buildWorld, install, TOP, FINISH_X, FAR_X, LANE_Y } = R;

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

function scene() {
  const { g, T } = buildWorld();
  const res = install(g);
  g.spawn(T.car, { name: 'kart', x: FINISH_X, y: LANE_Y });
  g.spawn(T.finish, { name: 'line', x: FINISH_X, y: LANE_Y });
  g.spawn(T.marker, { name: 'far', x: FAR_X, y: LANE_Y });
  const v = g._systemView();
  const car = v.allOfType('car').find((u) => v.nameOf(u) === 'kart');
  const fld = (f) => g._systemView().field(car, f);
  let unsafe = 0, deferrals = 0;
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { const r = g.stepTick(); deferrals += r.deferrals.length; if (!g.indexesConsistent()) unsafe++; } };
  const setIn = (obj) => { const r = g.stepTick([{ actor: 'p', ops: Object.entries(obj).map(([field, value]) => ({ kind: 'setfield', target: car, field, value })) }]); deferrals += r.deferrals.length; };
  const driveUntil = (pred, max = 300) => { let n = 0; while (!pred() && n++ < max) tick(); return n < max; };
  return { g, car, fld, tick, setIn, driveUntil, stats: () => ({ unsafe, deferrals }) };
}

// ---- install: gate-clean; advisory only on the position writes ---------------
{
  const { res } = (() => { const { g } = buildWorld(); return { res: install(g) }; })();
  ok(res.every((r) => r.ok), `all ${res.length} racing rules install through the gate`);
  const flagged = res.filter((r) => (r.warnings || []).some((w) => w.code === 'unconditional_write')).map((r) => r.name).sort();
  ok(JSON.stringify(flagged) === JSON.stringify(['drive_x', 'drive_y']),
    `RD-035 advisory fires only on the unconditional position writes (got: [${flagged.join(', ')}])`);
}

// ---- throttle physics: accelerate to TOP, coast back to 0 --------------------
{
  const s = scene();
  s.setIn({ throttle: 1, sx: 0, sy: 0 });
  s.tick(12);
  ok(s.fld('speed') === TOP, `accelerate reaches top speed (${s.fld('speed')} == ${TOP})`);
  s.setIn({ throttle: 0 });
  s.tick(12);
  ok(s.fld('speed') === 0, `coast/brake returns to a stop (${s.fld('speed')} == 0)`);
}

// ---- one lap, two laps, and no double-count ---------------------------------
{
  const s = scene();
  const doLoop = () => {
    s.setIn({ throttle: 1, sx: 1, sy: 0 });               // accelerate toward the far marker
    s.driveUntil(() => s.fld('x') >= FAR_X - 6);
    s.setIn({ sx: 0 }); s.tick(3);                         // dwell so proximity -> armed registers
    s.setIn({ throttle: 1, sx: -1 });                     // drive back to the finish
    s.driveUntil(() => s.fld('x') <= FINISH_X + 6);
    s.setIn({ sx: 0 }); s.tick(3);                         // dwell so the crossing counts
  };
  ok(s.fld('laps') === 0, 'starts with 0 laps (on the line, but never armed)');
  doLoop();
  ok(s.fld('laps') === 1, `one full loop = 1 lap (${s.fld('laps')})`);
  // idle on the finish line — must NOT farm laps (armed was consumed)
  s.setIn({ throttle: 0, sx: 0 }); s.tick(15);
  ok(s.fld('laps') === 1, `idling on the line does NOT double-count (${s.fld('laps')} still 1)`);
  doLoop();
  ok(s.fld('laps') === 2, `a second loop = 2 laps (${s.fld('laps')})`);
  const st = s.stats();
  ok(st.unsafe === 0 && st.deferrals === 0, `SAFE + contention-free across the race (unsafe=${st.unsafe}, deferrals=${st.deferrals})`);
}

// ---- control: crossing the finish WITHOUT reaching the far side = no lap -----
{
  const s = scene();
  s.setIn({ throttle: 1, sx: 1, sy: 0 });
  s.driveUntil(() => s.fld('x') >= 150);                   // out to mid-track only (marker is at 235)
  s.setIn({ throttle: 1, sx: -1 });
  s.driveUntil(() => s.fld('x') <= FINISH_X + 6);
  s.setIn({ sx: 0 }); s.tick(4);
  ok(s.fld('laps') === 0, `CONTROL: crossing the line without a real loop scores no lap (${s.fld('laps')}) — the bar is losable`);
}

// ---- determinism -------------------------------------------------------------
{
  const trace = () => {
    const s = scene();
    s.setIn({ throttle: 1, sx: 1 });
    const t = [];
    for (let i = 0; i < 25; i++) { s.tick(); t.push(s.fld('x') + ',' + s.fld('speed')); }
    return t.join('|');
  };
  ok(trace() === trace(), 'deterministic: two identical races produce identical (x,speed) traces');
}

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed — RD-037: racing, a 5th genre, zero core edits`);
process.exit(FAIL ? 1 : 0);
