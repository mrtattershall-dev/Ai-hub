// CONTROLS FOR AUTO-WITNESS — predictions W-1..W-7 in benchmarks/AUTO_WITNESS_1_PREREG.md.
//
// Every fixture is a miniature authority system written HERE, with a real module-private brand, so
// nothing passes by accident of the repository's state. The run against the real trees, through the
// loader and an existing test file, is benchmarks/RESULT.auto-witness.md.
import test from 'node:test';
import assert from 'node:assert';
import * as substrate from './witness.mjs';
import { recorder, describe, semantic } from './witness.mjs';

// A subject with an unforgeable brand: membership in a WeakSet nothing outside can add to.
function subject() {
  const MINTED = new WeakSet();
  const isAuthority = (t) => !!(t && typeof t === 'object' && MINTED.has(t));
  const observe = ({ context }) => {
    const t = Object.freeze({ context: Object.freeze({ ...context }) });
    MINTED.add(t); return t;
  };
  const derive = ({ premises }) => {
    if (!premises.every(isAuthority)) return { minted: false, why: 'not a token' };
    const ctx = {};
    for (const d of ['repo', 'crit']) {
      if (premises.every((p) => p.context[d] !== undefined)) ctx[d] = premises[0].context[d];
    }
    const t = Object.freeze({ context: Object.freeze(ctx) });
    MINTED.add(t); return t;
  };
  return { isAuthority, observe, derive };
}

function run() {
  const S = subject();
  const R = recorder().brand(S.isAuthority);
  const observe = R.instrument('s.observe', S.observe);
  const derive = R.instrument('s.derive', S.derive);
  const a = observe({ context: { repo: 'S1', crit: 'K' } });
  const b = observe({ context: { repo: 'S1', crit: 'K' } });
  const out = derive({ premises: [a, b] });
  return { S, R, a, b, out };
}

test('W-1 — a construction DAG is recorded from ordinary calls, with no driver', () => {
  const { R, out } = run();
  const ws = R.witnesses('s.derive');
  assert.equal(ws.length, 1);
  const w = ws[0];
  assert.deepEqual(w.ids, [0, 1, 2], 'the derive node plus BOTH observe calls that fed it');
  assert.equal(w.root.result, out);
  assert.deepEqual(describe(w).map((l) => l.split('(')[0].trim()),
    ['#0  s.observe', '#1  s.observe', '#2  s.derive']);
});

test('W-6 — edges are by IDENTITY: two calls with identical arguments are two different nodes', () => {
  // The whole point. Byte-identical arguments produce distinct tokens, and the recipe must say WHICH
  // one each premise was, or replay rebuilds a different world than the one observed.
  const { R } = run();
  const w = R.witnesses('s.derive')[0];
  const refs = JSON.stringify(w.root.args).match(/"__ref":\d+/g);
  assert.deepEqual(refs, ['"__ref":0', '"__ref":1'], 'not [0,0] - shape would have collapsed them');
});

test('W-3 — the brand survives recording: a REPLAYED premise is a token the subject accepts', () => {
  const { S, R } = run();
  const r = R.replay(R.witnesses('s.derive')[0]);
  assert.equal(r.ok, true);
  assert.ok(S.isAuthority(r.result), 'a recorder that cloned its arguments would fail here');
  assert.notEqual(r.result, R.witnesses('s.derive')[0].root.result, 'and it is a NEW token, not the old one');
});

test('W-4b MUST FIRE — a token-SHAPED unbranded object is a LEAF, not authority', () => {
  const S = subject();
  const R = recorder().brand(S.isAuthority);
  const derive = R.instrument('s.derive', S.derive);
  const impostor = Object.freeze({ context: Object.freeze({ repo: 'S1', crit: 'K' }) });  // same shape
  derive({ premises: [impostor, impostor] });
  const w = R.witnesses('s.derive')[0];
  assert.equal(w.foreign.length, 0, 'the SUBJECT says it is not authority, so neither does the recorder');
  assert.ok(w.leaves.some((l) => l.path.includes('repo')), 'it is plain data, and its fields are leaves');
});

test('W-4 — a REAL token that no recorded call produced is FOREIGN, and blocks replay', () => {
  const S = subject();
  const R = recorder().brand(S.isAuthority);
  const outside = S.observe({ context: { repo: 'S1' } });     // minted before recording began
  const derive = R.instrument('s.derive', S.derive);
  derive({ premises: [outside, outside] });
  const w = R.witnesses('s.derive')[0];
  assert.equal(w.foreign.length, 2, 'authority in, no recipe for it');
  assert.equal(w.leaves.length, 0, 'AND IT IS NEVER A LEAF - mutable raw data is what it must not be');
  const r = R.replay(w);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'FOREIGN_INPUT');
  assert.match(r.why, /construction history/);
});

test('W-2b MUST FIRE — a non-deterministic subject is BASELINE_UNREPLAYABLE and yields nothing', () => {
  const S = subject();
  const R = recorder().brand(S.isAuthority);
  // THE VARYING FIELD MUST BE ONE THE SUBJECT READS. The first version of this control varied a
  // field `derive` ignores, so the output was identical every time and the control could not fire -
  // a vacuous control inside the slice whose subject is vacuity.
  let n = 0;
  const observe = R.instrument('s.observe', () => S.observe({ context: { repo: 'S' + (n++) } }));
  const derive = R.instrument('s.derive', S.derive);
  derive({ premises: [observe(), observe()] });
  const r = R.replay(R.witnesses('s.derive')[0]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'DIVERGED');
  assert.match(r.why, /attributed to an intervention/);
});

test('REPLAY DOES NOT PERTURB THE RECORD — it calls the raw functions, not the wrapped ones', () => {
  // Otherwise every replay would grow the graph it is replaying, and a second replay would differ
  // from the first for reasons having nothing to do with the subject.
  const { R } = run();
  const before = R.nodes().length;
  R.replay(R.witnesses('s.derive')[0]);
  R.replay(R.witnesses('s.derive')[0]);
  assert.equal(R.nodes().length, before);
});

test('ARGUMENTS ARE RECORDED AS PASSED, not as the subject left them', () => {
  // A subject that mutates its own argument would otherwise be replayed with a call that never
  // happened - silently, and only for subjects that mutate.
  const R = recorder();
  const f = R.instrument('s.mutates', (cfg) => { cfg.mode = 'CHANGED'; return { ok: cfg.mode }; });
  f({ mode: 'ORIGINAL' });
  const w = R.witnesses('s.mutates')[0];
  assert.match(JSON.stringify(w.root.args), /ORIGINAL/);
  assert.doesNotMatch(JSON.stringify(w.root.args), /CHANGED/);
});

test('semantic identity distinguishes structure from reference', () => {
  assert.equal(semantic({ a: 1, b: [2] }), semantic({ b: [2], a: 1 }), 'key order is not meaning');
  const m = new Map(); const n = new Map();
  assert.notEqual(semantic(m), semantic(n), 'two empty Maps are not the same object');
  assert.equal(semantic(m), semantic(m));
});

test('W-7 — THE WITNESS SUBSTRATE OFFERS NO BACKDOOR', () => {
  const names = Object.keys(substrate).sort();
  assert.deepEqual(names.filter((k) => /forge|mint|fabricat|unsafe|bypass|testonly/i.test(k)), [],
    'instrumentation that could produce an authority object would be the backdoor');
  assert.deepEqual(names, ['KIND', 'describe', 'recorder', 'semantic']);
});
