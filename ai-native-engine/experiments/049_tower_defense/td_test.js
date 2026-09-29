'use strict';
// =============================================================================
// RD-039 — tower defense: what the grammar CARRIES, and the RD-032 wall it hits.
// Part 1 (PLAYS): area towers kill a wave on an L-path before it leaks; with no
// tower the wave leaks and the base loses life (losable). Safe, deterministic.
// Part 2 (THE GAP, forced): the two relational things TD needs and the grammar
// lacks, shown as concrete gate verdicts — not prose.
//   node experiments/049_tower_defense/td_test.js
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { installRule } = CORE('behavior.js');
const R = require(path.join(__dirname, 'td_rules.js'));
const { buildWorld, install, START_LIFE } = R;

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const hr = (t) => console.log(`\n--- ${t} ---`);

function scene({ withTower }) {
  const { g, T } = buildWorld();
  install(g);
  g.spawn(T.base, { name: 'hq' });
  if (withTower) g.spawn(T.tower, { name: 't1', x: 100, y: 40 });
  const enemies = [];
  for (let i = 0; i < 3; i++) enemies.push(g.spawn(T.enemy, { name: `e${i}`, x: 0, y: 40, hp: R.ENEMY_HP }));
  const v = g._systemView();
  const base = v.allOfType('base').find((u) => v.nameOf(u) === 'hq');
  const enemyU = v.allOfType('enemy');
  const F = (u, f) => g._systemView().field(u, f);
  let unsafe = 0, deferrals = 0;
  const run = (n) => { for (let i = 0; i < n; i++) { const r = g.stepTick(); deferrals += r.deferrals.length; if (!g.indexesConsistent()) unsafe++; } };
  return { g, base, enemyU, F, run, stats: () => ({ unsafe, deferrals }) };
}

// ---- install ----------------------------------------------------------------
{
  const { g } = buildWorld();
  const res = install(g);
  ok(res.every((r) => r.ok), `all ${res.length} tower-defense rules install through the gate`);
  const flagged = res.filter((r) => (r.warnings || []).length).map((r) => r.name);
  ok(flagged.length === 0, `no write-smell advisories — every position/state write is guarded by a path/alive condition (got: [${flagged.join(', ')}])`);
}

// ---- PART 1: it plays --------------------------------------------------------
hr('P1 the wave is stopped by an area tower (attack-by-inversion)');
{
  const s = scene({ withTower: true });
  s.run(60);
  const killed = s.enemyU.filter((u) => s.F(u, 'hp') === 0).length;
  const leaked = s.enemyU.filter((u) => s.F(u, 'leaked') === 1).length;
  ok(killed === 3 && leaked === 0, `all 3 enemies KILLED in the tower's range before the corner (killed=${killed}, leaked=${leaked})`);
  ok(s.F(s.base, 'money') === 15, `kills paid a bounty (money=${s.F(s.base, 'money')} = 3×5)`);
  ok(s.F(s.base, 'life') === START_LIFE, `the base took no damage (life=${s.F(s.base, 'life')})`);
  const st = s.stats();
  ok(st.unsafe === 0 && st.deferrals === 0, `SAFE + contention-free (unsafe=${st.unsafe}, deferrals=${st.deferrals})`);
}

hr('P1 control — no tower: the wave leaks and the base bleeds life (the bar is losable)');
{
  const s = scene({ withTower: false });
  s.run(150);
  const leaked = s.enemyU.filter((u) => s.F(u, 'leaked') === 1).length;
  ok(leaked === 3 && s.F(s.base, 'life') === START_LIFE - 3,
    `CONTROL: with no tower all 3 leak and life drops (leaked=${leaked}, life=${s.F(s.base, 'life')})`);
  ok(s.F(s.base, 'money') === 0, 'no kills, no money');
}

hr('P1 determinism');
{
  const trace = () => {
    const s = scene({ withTower: true });
    const t = [];
    for (let i = 0; i < 40; i++) { s.run(1); t.push(s.enemyU.map((u) => s.F(u, 'hp')).join('.') + '/' + s.F(s.base, 'money')); }
    return t.join('|');
  };
  ok(trace() === trace(), 'deterministic: two identical defenses produce identical traces');
}

// ---- PART 2: THE RD-032 WALL, as gate verdicts -------------------------------
hr('P2 GAP A — a tower cannot SELECT or WRITE another entity (so single-target targeting is impossible)');
{
  const { g } = buildWorld();
  install(g);
  // "the tower shoots an enemy": a tower-matched rule that writes hp (an enemy field).
  const r = installRule(g, { name: 'tower_shoots', match: { type: 'tower' }, effects: [{ set: 'hp', to: 0 }] });
  console.log(`     verdict: ${r.ok ? 'ACCEPTED' : 'REJECTED ' + JSON.stringify((r.errors || []).map((e) => e.code))}`);
  ok(!r.ok && (r.errors || []).some((e) => e.code === 'field_not_owned'),
    "a tower writing an enemy's hp is REJECTED (field_not_owned) — attacks MUST be inverted (the target owns the write), so a tower cannot pick 'the nearest' and shoot it");
}

hr('P2 GAP B — a `where` compares a field to a CONSTANT, never to the matched entity\'s OWN field (RD-032)');
{
  const { g } = buildWorld();
  install(g);
  // "target the enemy whose progress equals MINE" / "move toward waypoint[my idx]"
  // reduces to a predicate comparing one field to ANOTHER field. Try it directly:
  const r = installRule(g, { name: 'relational',
    match: { type: 'enemy', where: { field: 'x', cmp: '<', value: { field: 'y' } } },   // x < (my y) — a RELATION
    effects: [{ set: 'leaked', to: 1 }] });
  console.log(`     verdict: ${r.ok ? 'ACCEPTED (!!)' : 'REJECTED ' + JSON.stringify((r.errors || []).map((e) => e.code))}`);
  ok(!r.ok, "a relational predicate (field cmp FIELD) does NOT install — the grammar has field-vs-CONSTANT only. This is the exact wall behind ordered-checkpoint racing AND per-enemy-waypoint pathing AND single-target 'nearest/strongest' selection.");
}

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed — RD-039: tower defense — the genre plays (area/inversion), and the RD-032 relational gap is REAL and now pinned as gate verdicts`);
process.exit(FAIL ? 1 : 0);
