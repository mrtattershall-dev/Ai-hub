// r4 — composition wave 3, the constructor calculus. Predictions were frozen in
// benchmarks/COMPOSITION_PREREG_3.md (W3-c..f); the PRE-REPAIR run that reproduced all four is preserved
// in benchmarks/RESULT.composition-3.md and at 32b0207, where this file asserted the defects. It now
// asserts the repairs and keeps every control.
import test from 'node:test';
import assert from 'node:assert';
import { observe, derive, delegate, narrow, commit, isAuthority, tracesToIndependentRoot, KIND }
  from './calculus.mjs';
import { observation, OBSERVABILITY } from './observation.mjs';

const good = () => observation({ status: OBSERVABILITY.OBSERVED, value: 'v',
  subject: 'utils.f#3f7c', producer: 'tracer', procedure: 'observe()', attribution: 'frame',
  context: 'repo@S1' });
const tok = (ctx) => observe({ observation: good(), procedure: 'tracer', context: ctx });

test('W3-c-1 REGRESSION — delegation cannot WIDEN the world a grant applies in', () => {
  const a = delegate({ from: 'OWNER', grant: ['x'], to: 'A', context: { repository: 'S1' } });
  const b = delegate({ from: a, grant: ['x'], to: 'B', context: {} });
  assert.equal(b.minted, false, '32b0207 minted this over every world');
  assert.deepEqual(b.widened, ['repository']);
  const moved = delegate({ from: a, grant: ['x'], to: 'B', context: { repository: 'S2' } });
  assert.equal(moved.minted, false, 'nor move it');
});

test('W3-c CONTROL — the same or a narrower context still delegates, and a chain still roots', () => {
  const a = delegate({ from: 'OWNER', grant: ['x'], to: 'A', context: { repository: 'S1' } });
  const same = delegate({ from: a, grant: ['x'], to: 'B' });
  assert.equal(isAuthority(same), true);
  const narrower = delegate({ from: a, grant: ['x'], to: 'B', context: { repository: 'S1', criterion: 'K' } });
  assert.equal(isAuthority(narrower), true);
  assert.equal(tracesToIndependentRoot(narrower, ['x']).ok, true);
});

test('W3-d-1 REGRESSION — narrow() refuses to move an established dimension', () => {
  const r = narrow(tok({ repository: 'S1' }), 'repository', 'S2');
  assert.equal(r.minted, false, '32b0207 returned authority at S2');
  assert.equal(isAuthority(r), false);
  assert.match(r.why, /change of referent/);
});

test('W3-d CONTROL — narrowing an absent dimension, or to the same value, is a restriction', () => {
  assert.equal(narrow(tok({ repository: 'S1' }), 'criterion', 'K').context.criterion, 'K');
  const same = narrow(tok({ repository: 'S1' }), 'repository', 'S1');
  assert.equal(isAuthority(same), true);
  assert.equal(same.context.repository, 'S1');
});

test('W3-e-1 REGRESSION — commit() refuses EPISTEMIC authority: evidence does not act', () => {
  const c = commit({ authority: tok({ repository: 'S1' }), action: 'write bytes' });
  assert.equal(c.committed, false, '32b0207 committed on evidence alone');
  assert.match(c.why, /not permission/);
});

test('W3-e CONTROL — a rooted NORMATIVE token whose grant covers the action commits; an uncovered or unrooted one does not', () => {
  const a = delegate({ from: 'OWNER', grant: ['write'], to: 'PROPOSE' });
  assert.equal(commit({ authority: a, action: 'write bytes', requires: ['write'] }).committed, true);
  assert.equal(commit({ authority: a, action: 'delete', requires: ['delete'] }).committed, false,
    'a grant that does not cover the action');
  const b = delegate({ from: a, grant: ['write'], to: 'B' });
  assert.equal(commit({ authority: b, action: 'write bytes', requires: ['write'] }).committed, true,
    'through a chain, still rooted');
});

test('W3-f-1 REGRESSION — derive() refuses a NORMATIVE premise; kind and grant no longer depend on order', () => {
  const n = delegate({ from: 'OWNER', grant: ['x'], to: 'A' });
  const e = tok({});
  for (const premises of [[n, e], [e, n]]) {
    const d = derive({ premises, rule: { name: 'c', requires: [] }, claim: 'C' });
    assert.equal(d.minted, false, '32b0207 minted, with order-dependent authority');
    assert.match(d.why, /delegated, not derived/);
  }
});

test('W3-f CONTROL — two epistemic premises derive an epistemic conclusion with no grant, in either order', () => {
  const d = derive({ premises: [tok({}), tok({})], rule: { name: 'c', requires: [] }, claim: 'C' });
  assert.equal(d.kind, KIND.EPISTEMIC);
  assert.deepEqual([...d.grant], []);
  assert.equal(isAuthority(d), true);
});
