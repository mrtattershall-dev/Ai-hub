// r4 — the constructor calculus under attack. Predictions were frozen in
// benchmarks/COMPOSITION_PREREG.md (C2, C3); the PRE-REPAIR run that reproduced both is preserved in
// benchmarks/RESULT.composition.md and at b11e51f, where this file asserted the defects. It now asserts
// the repairs and keeps every control.
import test from 'node:test';
import assert from 'node:assert';
import { observe, derive, delegate, narrow, restrictGrant, invalidate, isAuthority,
  tracesToIndependentRoot, commit, KIND } from './calculus.mjs';
import { observation, OBSERVABILITY } from './observation.mjs';

const good = () => observation({ status: OBSERVABILITY.OBSERVED, value: 'v',
  subject: 'utils.f#3f7c', producer: 'tracer', procedure: 'observe()', attribution: 'frame',
  context: 'repo@S1' });
const tok = (ctx) => observe({ observation: good(), procedure: 'tracer', context: ctx });

// ------------------------------------------------------------------ C2: absence

test('C2-a REGRESSION — a premise that never established repository cannot lend the conclusion S1', () => {
  const r = derive({ premises: [tok({}), tok({ repository: 'S1' })],
    rule: { name: 'conjunction', requires: [] }, claim: 'C' });
  assert.equal(isAuthority(r), true, 'still minted: a weaker conclusion is a restriction, not a refusal');
  assert.equal(Object.hasOwn(r.context, 'repository'), false, 'b11e51f carried S1 here');
  assert.deepEqual(r.ancestry[0].dropped, [{ dimension: 'repository', why: 'not established by every premise' }],
    'and the drop is recorded, not silent');
});

test('C2-b CONTROL — concrete-and-different premises are refused without a bridge', () => {
  const r = derive({ premises: [tok({ repository: 'S1' }), tok({ repository: 'S2' })],
    rule: { name: 'conjunction', requires: [] }, claim: 'C' });
  assert.equal(r.minted, false);
  assert.match(r.why, /different worlds/);
});

test('C2-c ADMIT CONTROL — premises that agree keep the dimension; a bridged conflict is dropped with a record', () => {
  const same = derive({ premises: [tok({ repository: 'S1', criterion: 'K' }),
    tok({ repository: 'S1', criterion: 'K' })], rule: { name: 'c', requires: [] }, claim: 'C' });
  assert.deepEqual(same.context, { repository: 'S1', criterion: 'K' });
  assert.deepEqual(same.ancestry[0].dropped, []);
  const bridged = derive({ premises: [tok({ repository: 'S1', criterion: 'K1' }),
    tok({ repository: 'S1', criterion: 'K2' })], rule: { name: 'c', requires: [] }, claim: 'C',
  relationWitnesses: [{ relation: 'BRIDGE:criterion' }] });
  assert.equal(isAuthority(bridged), true);
  assert.deepEqual(bridged.context, { repository: 'S1' });
  assert.deepEqual(bridged.ancestry[0].dropped, [{ dimension: 'criterion', why: 'bridged, not carried' }]);
});

// ------------------------------------------------------------------ C3: the brand

test('C3-a REGRESSION — nothing on a real token can be copied to forge one', () => {
  const real = tok({ repository: 'S1' });
  assert.deepEqual(Object.getOwnPropertySymbols(real), [], 'b11e51f carried a readable symbol brand');
  // Everything an attacker can see, copied faithfully.
  const fake = Object.freeze({ ...real, kind: KIND.NORMATIVE, grant: ['edit:criterion'],
    ancestry: [{ via: 'DELEGATE', from: 'OWNER', to: 'PROPOSE' }], constructor: 'DELEGATE' });
  assert.equal(isAuthority(fake), false);
  assert.equal(tracesToIndependentRoot(fake, ['edit:criterion']).ok, false);
  assert.equal(commit({ authority: fake, action: 'edit the criterion' }).committed, false);
  // and a hand-built lookalike with every visible field
  const built = Object.freeze({ claim: 'PROPOSE', kind: KIND.NORMATIVE, context: {},
    grant: ['edit:criterion'], ancestry: [{ via: 'DELEGATE', from: 'OWNER', to: 'PROPOSE' }],
    constructor: 'DELEGATE', valid: true });
  assert.equal(isAuthority(built), false);
});

test('C3-b CONTROL — the constructors and the free restrictions still mint recognisable tokens', () => {
  const root = delegate({ from: 'OWNER', grant: ['edit:implementation'], to: 'A' });
  assert.equal(isAuthority(root), true);
  assert.equal(isAuthority(delegate({ from: root, grant: ['edit:implementation'], to: 'B' })), true);
  // THIS CONTROL WAS WRONG when first written in wave 1: it asserted that narrowing repository from S1
  // to S2 mints, which is the referent move wave 3 found (W3-d) and narrow() now refuses. A positive
  // control that enshrines a defect is how a defect survives a repair. The control now narrows an
  // ABSENT dimension, which is what restriction means.
  assert.equal(isAuthority(narrow(tok({ repository: 'S1' }), 'criterion', 'K')), true);
  assert.equal(isAuthority(restrictGrant(root, ['edit:implementation'])), true);
  const dead = invalidate(root, 'stale');
  assert.equal(isAuthority(dead), true, 'an invalidated token is still a token');
  assert.equal(dead.valid, false);
  assert.equal(dead.why, 'stale');
  assert.equal(commit({ authority: dead, action: 'x' }).committed, false);
});

test('C3-c — clone and JSON round-trip of a real token are NOT authority (fail-safe direction)', () => {
  const real = tok({ repository: 'S1' });
  assert.equal(isAuthority(structuredClone(real)), false);
  assert.equal(isAuthority(JSON.parse(JSON.stringify(real))), false);
  assert.equal(isAuthority({ ...real }), false, 'a spread copy is an anonymous object');
});
