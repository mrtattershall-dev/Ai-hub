// r4 — composition wave 3, the constructor calculus. Predictions frozen in
// benchmarks/COMPOSITION_PREREG_3.md (W3-c, W3-d, W3-e, W3-f) BEFORE this file existed. Assertions
// state the PREDICTED DEFECT; controls beside them.
import test from 'node:test';
import assert from 'node:assert';
import { observe, derive, delegate, narrow, commit, isAuthority, KIND } from './calculus.mjs';
import { observation, OBSERVABILITY } from './observation.mjs';

const good = () => observation({ status: OBSERVABILITY.OBSERVED, value: 'v',
  subject: 'utils.f#3f7c', producer: 'tracer', procedure: 'observe()', attribution: 'frame',
  context: 'repo@S1' });
const tok = (ctx) => observe({ observation: good(), procedure: 'tracer', context: ctx });

test('W3-c-1 ATTACK — delegation WIDENS the world a grant applies in', () => {
  const a = delegate({ from: 'OWNER', grant: ['x'], to: 'A', context: { repository: 'S1' } });
  const b = delegate({ from: a, grant: ['x'], to: 'B', context: {} });
  // PREDICTED DEFECT: B holds x over every world; A held it over S1.
  assert.equal(isAuthority(b), true, 'prediction W3-c-1: minted');
  assert.deepEqual({ ...b.context }, {});
});

test('W3-c CONTROL — the same or a narrower context still delegates', () => {
  const a = delegate({ from: 'OWNER', grant: ['x'], to: 'A', context: { repository: 'S1' } });
  assert.equal(isAuthority(delegate({ from: a, grant: ['x'], to: 'B' })), true);
  assert.equal(isAuthority(delegate({ from: a, grant: ['x'], to: 'B',
    context: { repository: 'S1', criterion: 'K' } })), true);
});

test('W3-d-1 ATTACK — narrow() moves an established dimension to another value', () => {
  const t = narrow(tok({ repository: 'S1' }), 'repository', 'S2');
  // PREDICTED DEFECT: a referent move under restriction's free pass.
  assert.equal(isAuthority(t), true, 'prediction W3-d-1: still authority');
  assert.equal(t.context.repository, 'S2');
});

test('W3-d CONTROL — narrowing an absent dimension, or to the same value, is a restriction', () => {
  assert.equal(narrow(tok({ repository: 'S1' }), 'criterion', 'K').context.criterion, 'K');
  assert.equal(narrow(tok({ repository: 'S1' }), 'repository', 'S1').context.repository, 'S1');
});

test('W3-e-1 ATTACK — commit() consumes EPISTEMIC authority: evidence acts', () => {
  const c = commit({ authority: tok({ repository: 'S1' }), action: 'write bytes' });
  // PREDICTED DEFECT: OBSERVE plus COMMIT is an action nobody permitted.
  assert.equal(c.committed, true, 'prediction W3-e-1: committed on evidence alone');
});

test('W3-e CONTROL — a rooted NORMATIVE token whose grant covers the action commits', () => {
  const a = delegate({ from: 'OWNER', grant: ['write'], to: 'PROPOSE' });
  assert.equal(commit({ authority: a, action: 'write bytes' }).committed, true);
});

test('W3-f-1 ATTACK — derive() kind and grant depend on argument ORDER', () => {
  const n = delegate({ from: 'OWNER', grant: ['x'], to: 'A' });
  const e = tok({});
  const d1 = derive({ premises: [n, e], rule: { name: 'c', requires: [] }, claim: 'C' });
  const d2 = derive({ premises: [e, n], rule: { name: 'c', requires: [] }, claim: 'C' });
  assert.equal(isAuthority(d1), true); assert.equal(isAuthority(d2), true);
  // PREDICTED DEFECT: same premises, different authority.
  assert.equal(d1.kind, KIND.NORMATIVE, 'prediction W3-f-1');
  assert.deepEqual([...d1.grant], ['x']);
  assert.equal(d2.kind, KIND.EPISTEMIC);
  assert.deepEqual([...d2.grant], []);
});

test('W3-f CONTROL — two epistemic premises derive an epistemic conclusion with no grant, in either order', () => {
  const d = derive({ premises: [tok({}), tok({})], rule: { name: 'c', requires: [] }, claim: 'C' });
  assert.equal(d.kind, KIND.EPISTEMIC);
  assert.deepEqual([...d.grant], []);
});
