// r4 — ATTACK on the constructor calculus. Predictions frozen in benchmarks/COMPOSITION_PREREG.md
// (C2, C3) BEFORE this file existed. Assertions state the PREDICTED DEFECT.
import test from 'node:test';
import assert from 'node:assert';
import { observe, derive, isAuthority, tracesToIndependentRoot, commit, KIND } from './calculus.mjs';
import { observation, OBSERVABILITY } from './observation.mjs';

const good = () => observation({ status: OBSERVABILITY.OBSERVED, value: 'v',
  subject: 'utils.f#3f7c', producer: 'tracer', procedure: 'observe()', attribution: 'frame',
  context: 'repo@S1' });
const tok = (ctx) => observe({ observation: good(), procedure: 'tracer', context: ctx });

// ------------------------------------------------------------------ C2: absence

test('C2-a ATTACK — a premise that never established repository composes into a conclusion AT S1', () => {
  const a = tok({});                       // establishes nothing about repository
  const b = tok({ repository: 'S1' });
  const r = derive({ premises: [a, b], rule: { name: 'conjunction', requires: [] }, claim: 'C' });
  // PREDICTED DEFECT: minted, and the output context carries S1 although premise a licenses nothing
  // over repository. justification.mjs treats the same absence as "never established".
  assert.equal(isAuthority(r), true, 'prediction C2-a: minted - ' + (r.why || ''));
  assert.equal(r.context.repository, 'S1');
});

test('C2-b CONTROL — concrete-and-different premises are refused without a bridge', () => {
  const r = derive({ premises: [tok({ repository: 'S1' }), tok({ repository: 'S2' })],
    rule: { name: 'conjunction', requires: [] }, claim: 'C' });
  assert.equal(r.minted, false);
  assert.match(r.why, /different worlds/);
});

// ------------------------------------------------------------------ C3: the brand

test('C3-a ATTACK — the mint symbol is recoverable from any real token, and a forgery then passes', () => {
  const real = tok({ repository: 'S1' });
  const syms = Object.getOwnPropertySymbols(real);
  assert.equal(syms.length, 1, 'one symbol-keyed brand on the token');
  const MINT = syms[0];
  const fake = Object.freeze({ [MINT]: true, claim: 'PROPOSE', kind: KIND.NORMATIVE, context: {},
    grant: ['edit:criterion'], ancestry: [{ via: 'DELEGATE', from: 'OWNER', to: 'PROPOSE' }],
    constructor: 'DELEGATE', valid: true });
  // PREDICTED DEFECT: indistinguishable from a legitimately delegated token.
  assert.equal(isAuthority(fake), true, 'prediction C3-a: the forgery is authority');
  assert.equal(tracesToIndependentRoot(fake, ['edit:criterion']).ok, true,
    'and it claims a root it never had');
  assert.equal(commit({ authority: fake, action: 'edit the criterion' }).committed, true);
});

test('C3-b CONTROL — without the brand the same object is refused', () => {
  const fake = { claim: 'PROPOSE', kind: KIND.NORMATIVE, context: {}, grant: ['edit:criterion'],
    ancestry: [{ via: 'DELEGATE', from: 'OWNER', to: 'PROPOSE' }], constructor: 'DELEGATE', valid: true };
  assert.equal(isAuthority(fake), false);
});

test('C3-c — clone and JSON round-trip of a real token are NOT authority (fail-safe direction)', () => {
  const real = tok({ repository: 'S1' });
  assert.equal(isAuthority(structuredClone(real)), false);
  assert.equal(isAuthority(JSON.parse(JSON.stringify(real))), false);
});
