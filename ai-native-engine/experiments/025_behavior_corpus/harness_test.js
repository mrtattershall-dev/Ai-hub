'use strict';
// =============================================================================
// CALIBRATION PROOF — the referee must hand out KNOWN-CORRECT verdicts on
// deliberately-broken controls BEFORE it is trusted to judge an RD-B1 rival.
// A referee that passes a fork-bomb is worse than no referee. This is the whole
// measure-first bet applied to the scorer itself (RD-021 fuzzer-vs-engine split).
//
//   C0  the corpus reproduces every oracle (the rulebook is internally correct)
//   C1  each control scores EXACTLY its predicted 5-axis matrix
//   C2  containment is LOAD-BEARING, not adapter goodwill: NC-raweval's runaway
//       is actually stopped by the harness (infinite loop hard-killed, memory
//       bomb capped) and its escape is actually OBSERVED (canary + tripwire)
//   C3  every axis is PASSED by at least one control (no detector false-positives
//       — an always-FAIL detector would trivially "calibrate" but judge nothing)
//   C4  the two unsafe controls differ from a confined one exactly where they
//       should (NC-nondet == a correct rep EXCEPT determinism)
//
// `node experiments/025_behavior_corpus/harness_test.js` -> ALL PASS.
// Runs every control through the FULL worker-contained pipeline; ~20-40s.
// =============================================================================

const corpus = require('./corpus.js');
const { scoreAdapter } = require('./harness.js');
const { EXPECTED } = require('./adapters.js');
const path = require('path');

const ADAPTERS = path.join(__dirname, 'adapters.js');
const AXES = ['EXPRESSIVE', 'SAFE', 'DETERMINISTIC', 'BOUNDED', 'LOCALIZED'];

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const whyOf = (m, axis, behavior) => (m.detail.find(d => d.axis === axis && d.behavior === behavior) || {}).why || '(no detail)';

(async () => {
  // ---- C0: corpus self-consistency ----------------------------------------
  console.log('=== C0: corpus reproduces every oracle ===');
  const cf = corpus.selfCheck();
  ok(cf.length === 0, `corpus self-check: ${cf.length === 0 ? 'all reference encodings reproduce their oracle' : JSON.stringify(cf)}`);

  // ---- C1: each control scores exactly its predicted matrix ----------------
  console.log('\n=== C1: each control scores EXACTLY its predicted matrix ===');
  const scored = {};
  for (const name of Object.keys(EXPECTED)) {
    const m = await scoreAdapter({ modulePath: ADAPTERS, name });
    scored[name] = m;
    for (const axis of AXES) {
      const got = m[axis], want = EXPECTED[name][axis];
      ok(got === want, `${name} ${axis} = ${got ? 'PASS' : 'FAIL'} (expected ${want ? 'PASS' : 'FAIL'})`
        + (got !== want ? ` — ${whyOf(m, axis, m.detail.find(d => d.axis === axis && d.verdict !== want)?.behavior)}` : ''));
    }
    ok(m.admissible === false, `${name} is INADMISSIBLE (no control is a valid representation)`);
  }

  // ---- C2: containment is load-bearing, escape is observed -----------------
  console.log('\n=== C2: harness containment is load-bearing (not adapter goodwill) ===');
  const raw = scored['NC-raweval'];
  ok(/hard-killed/.test(whyOf(raw, 'BOUNDED', 'M-infloop')),
    `NC-raweval infinite loop was HARD-KILLED by the harness: "${whyOf(raw, 'BOUNDED', 'M-infloop')}"`);
  ok(/mem-capped/.test(whyOf(raw, 'BOUNDED', 'M-membomb')),
    `NC-raweval memory bomb hit the worker memory CAP: "${whyOf(raw, 'BOUNDED', 'M-membomb')}"`);
  ok(/growth-capped/.test(whyOf(raw, 'BOUNDED', 'M-forkbomb')),
    `NC-raweval fork bomb hit the per-tick op CAP: "${whyOf(raw, 'BOUNDED', 'M-forkbomb')}"`);
  ok(/canary/.test(whyOf(raw, 'SAFE', 'M-escape')),
    `NC-raweval host escape was OBSERVED via the canary: "${whyOf(raw, 'SAFE', 'M-escape')}"`);
  ok(/outside declared scope/.test(whyOf(raw, 'SAFE', 'M-scope-read')),
    `NC-raweval out-of-scope read was OBSERVED via the tripwire: "${whyOf(raw, 'SAFE', 'M-scope-read')}"`);

  // trusted-closure (inproc) FAILS bounded where raweval (sandbox) passes — the
  // execMode contract: an inproc adapter that needs the hard kill did NOT self-bound.
  const tc = scored['NC-trusted-closure'];
  ok(tc.BOUNDED === false && raw.BOUNDED === true,
    'inproc trusted-closure FAILS BOUNDED where sandbox raweval PASSES — needing the harness kill is an inproc failure');

  // ---- C3: every axis is PASSED by at least one control --------------------
  console.log('\n=== C3: every axis is genuinely passable (no always-FAIL detector) ===');
  for (const axis of AXES) {
    const passer = Object.keys(scored).find(n => scored[n][axis] === true);
    ok(!!passer, `${axis} is PASSED by at least one control (${passer || 'NONE — detector is stuck FAIL!'})`);
    const failer = Object.keys(scored).find(n => scored[n][axis] === false);
    ok(!!failer, `${axis} is FAILED by at least one control (${failer || 'NONE — detector never bites!'})`);
  }

  // ---- C4: nondet isolates cleanly ----------------------------------------
  console.log('\n=== C4: NC-nondet == a correct rep EXCEPT determinism ===');
  const nd = scored['NC-nondet'];
  ok(nd.EXPRESSIVE && nd.SAFE && nd.BOUNDED && nd.LOCALIZED && !nd.DETERMINISTIC,
    'NC-nondet fails ONLY DETERMINISTIC — the axis is isolated (correct multiset, unstable order)');

  console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('HARNESS TEST CRASHED:', e); process.exit(2); });
