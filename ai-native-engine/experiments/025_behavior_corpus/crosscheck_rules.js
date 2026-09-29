'use strict';
// =============================================================================
// CROSS-CHECK — score the DECIDED RD-B1 winner (core/behavior.js declarative
// rules) through the independently-calibrated referee. The referee's own
// trustworthiness is proven by harness_test.js; here we turn it on the actual
// chosen representation for an independent verdict.
//
// EXPECTED (and asserted) result — the referee independently reproduces BOTH
// halves of the RD-B1 finding:
//   SAFE / BOUNDED / DETERMINISTIC / LOCALIZED  ->  PASS
//     the un-foolable safety axes hold: every attack is STATICALLY REJECTED at
//     compile (cross-pool field, oversized spawn cap) or UNREPRESENTABLE in the
//     grammar (host access, loops, allocation) — never contained by a hard kill.
//   EXPRESSIVE  ->  FAIL on exactly one behavior: decay-cascade
//     rules touch only the MATCHED entity, so a cascade to a child's field is not
//     authorable. This is RD-B1's own measured expressiveness ceiling, rediscovered
//     independently — rules are the SAFEST shape, not the most expressive one.
//
// Plus three direct core/behavior probes that print the ACTUAL localized errors
// behind the safety verdict (the range proof is RD-B1's signature result).
// `node experiments/025_behavior_corpus/crosscheck_rules.js` -> ALL PASS.
// =============================================================================

const path = require('path');
const { scoreAdapter, formatMatrix } = require('./harness.js');
const { parseRule } = require('../../core/behavior.js');

const ADAPTER = path.join(__dirname, 'rules_adapter.js');
const stubEngine = () => ({ w: { capacity: 256, resolve: () => ({ status: 'missing' }), type: [], byUuid: new Map() } });

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

(async () => {
  console.log('=== scoring core/behavior.js rules through the calibrated referee ===');
  const m = await scoreAdapter({ modulePath: ADAPTER, name: 'RB1-rules' });
  console.log(formatMatrix(m));

  // ---- the un-foolable safety axes must hold -------------------------------
  console.log('=== safety axes (the referee is proven un-gameable on these) ===');
  ok(m.SAFE === true,          'SAFE  — every scope/escape attack statically rejected or unrepresentable');
  ok(m.BOUNDED === true,       'BOUNDED — every loop/growth/alloc attack rejected at compile (no hard kill needed)');
  ok(m.DETERMINISTIC === true, 'DETERMINISTIC — pure function of the pre-tick view');
  ok(m.LOCALIZED === true,     'LOCALIZED — malformed sources yield {at,code,detail} re-promptable errors');

  // ---- expressiveness: the honest ceiling, reproduced ----------------------
  console.log('\n=== expressiveness ceiling (independently reproduced) ===');
  const expr = m.detail.filter(d => d.axis === 'EXPRESSIVE');
  const passed = expr.filter(d => d.verdict).map(d => d.behavior);
  const failed = expr.filter(d => !d.verdict).map(d => d.behavior);
  console.log(`  expressible: ${passed.join(', ')}`);
  console.log(`  NOT expressible: ${failed.join(', ') || '(none)'}`);
  ok(passed.length === 5 && failed.length === 1 && failed[0] === 'decay-cascade',
    `rules express 5/6 reals; the ONE miss is decay-cascade (multi-entity cascade) — RD-B1's measured ceiling`);
  ok(m.EXPRESSIVE === false, 'EXPRESSIVE axis FAILS (binary) — rules are the SAFEST shape, not the most expressive');
  ok(m.admissible === false, 'admissible=false in THIS referee (binary EXPRESSIVE) — the nuance is in the axis breakdown, not the bit');

  // ---- direct core/behavior probes: the actual static-rejection errors ------
  console.log('\n=== the static rejections behind the SAFE/BOUNDED verdict (actual localized errors) ===');
  const probe = (label, rule) => { const r = parseRule(stubEngine(), rule); const e = r.ok ? null : r.errors[0]; console.log(`  ${label}: ${r.ok ? 'ACCEPTED (!)' : `rejected [${e.code}] ${e.detail || ''}`}`); return r; };

  // THE RANGE PROOF (RD-B1 signature): growth+5 with no clamp reaches [5,260], escapes [0,255].
  const range = probe('range proof (growth+5, no clamp)', { name: 'r', match: { type: 'crop' }, effects: [ { set: 'growth', to: { add: [ { field: 'growth' }, 5 ] } } ] });
  ok(!range.ok && range.errors.some(e => e.code === 'range_unprovable'),
    'RANGE PROOF: unclamped growth+5 rejected (interval [5,260] escapes [0,255]) — author must STATE the clamp');

  const cross = probe('cross-pool write (set hp on a crop)', { name: 'x', match: { type: 'crop' }, effects: [ { set: 'hp', to: 0 } ] });
  ok(!cross.ok && cross.errors.some(e => e.code === 'field_not_owned'), 'cross-pool write statically rejected (field_not_owned)');

  const cap = probe('unbounded spawn (cap 100000)', { name: 'g', match: { type: 'zone' }, effects: [ { spawn: { type: 'crop', cap: 100000 } } ] });
  ok(!cap.ok && cap.errors.some(e => e.code === 'spawn_cap_required'), 'unbounded growth statically rejected (spawn cap 1..16 required)');

  // ---- the headline interpretation -----------------------------------------
  console.log('\n=== verdict ===');
  console.log('  An INDEPENDENTLY-CALIBRATED referee (proven un-foolable: it hard-kills a raw-eval');
  console.log('  infinite loop, caps a memory bomb, catches an escape) scores the decided RD-B1');
  console.log('  rules representation as SAFE + BOUNDED + DETERMINISTIC + LOCALIZED — every attack');
  console.log('  rejected BEFORE running — and rediscovers, on its own, the exact expressiveness');
  console.log('  ceiling RD-B1 measured (multi-entity cascade unauthorable). Independent corroboration.');

  console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('CROSS-CHECK CRASHED:', e); process.exit(2); });
