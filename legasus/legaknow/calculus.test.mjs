// THE REDUCTION — are the seven laws consequences of three constructors?
//
// Preregistered in ad96c02. R1 laws follow, R2 historical bugs are illicit mints, R3 restriction is free,
// R4 authority is unforgeable. A clean reduction on the first attempt would be more suspicious than a
// partial one, so what does NOT reduce is recorded as a result rather than hidden.
import test from 'node:test';
import assert from 'node:assert';
import { observe, derive, delegate, narrow, restrictGrant, invalidate, propose, commit, isAuthority,
  KIND } from './calculus.mjs';
import { observation, OBSERVABILITY } from './observation.mjs';

const good = (o = {}) => observation({ status: OBSERVABILITY.OBSERVED, value: 'foo-bar',
  subject: 'utils.canonicalize_name#3f7c', producer: 'line-tracer', procedure: 'observe()',
  attribution: 'co_qualname frame', context: 'repoB@S1', ...o });

const tok = (ctx = { repository: 'S1' }) =>
  observe({ observation: good(), procedure: 'tracer', context: ctx });

// ---------------------------------------------------------------- R4 UNFORGEABILITY

test('R4 — authority cannot be constructed, only minted by a constructor', async () => {
  const mod = await import('./calculus.mjs');
  assert.equal(mod.Authority, undefined);
  assert.equal(mod.mint, undefined);
  assert.equal(mod.token, undefined);
  // A hand-rolled lookalike is not authority, however convincing its fields.
  const fake = { claim: 'x', kind: KIND.EPISTEMIC, context: { repository: 'S1' }, grant: ['all'],
    ancestry: [], valid: true };
  assert.equal(isAuthority(fake), false);
  assert.equal(derive({ premises: [fake], rule: { name: 'r' }, claim: 'y' }).minted, false);
  assert.equal(commit({ authority: fake, action: 'write' }).committed, false);
  assert.equal(isAuthority(tok()), true);
});

// ---------------------------------------------------------------- R3 RESTRICTION IS FREE

test('R3 — restriction needs no proof object and cannot increase authority', () => {
  const t = delegate({ from: 'OWNER', grant: ['edit:implementation', 'edit:docs'], to: 'PROPOSE' });
  assert.equal(isAuthority(t), true);
  const narrowed = restrictGrant(t, ['edit:implementation']);
  assert.deepEqual([...narrowed.grant], ['edit:implementation']);
  // Asking restriction to WIDEN silently yields nothing extra - it is an intersection, not an assignment.
  const attempted = restrictGrant(t, ['edit:implementation', 'edit:criterion']);
  assert.equal(attempted.grant.includes('edit:criterion'), false);
  assert.equal(invalidate(t, 'stale').valid, false);
  assert.equal(narrow(t, 'repository', 'S2').context.repository, 'S2');
});

// ---------------------------------------------------------------- R1 THE LAWS AS CONSEQUENCES

test('LAW 1 follows — information loss leaves nothing for OBSERVE to be made of', () => {
  const dead = observation({ status: OBSERVABILITY.PRODUCER_FAILED, subject: 's', producer: 'p',
    procedure: 'q', attribution: 'a', context: 'c' });
  const r = observe({ observation: dead, procedure: 'tracer', context: { repository: 'S1' } });
  assert.equal(r.minted, false);
  assert.match(r.why, /cannot be inferred from its own absence/);
  // and a REAL empty observation still mints, so this is not a ban on emptiness
  const empty = observation({ status: OBSERVABILITY.EMPTY_OBSERVED, subject: 's', producer: 'p',
    procedure: 'q', attribution: 'a', context: 'c' });
  assert.equal(isAuthority(observe({ observation: empty, procedure: 'tracer',
    context: { repository: 'S1' } })), true);
});

test('LAW 2 follows — DERIVE cannot state a conclusion for a world no premise covered', () => {
  const a = tok({ repository: 'S1', criterion: 'K1' });
  const b = tok({ repository: 'S1', criterion: 'K2' });
  const r = derive({ premises: [a, b], rule: { name: 'modus ponens' }, claim: 'C' });
  assert.equal(r.minted, false);
  assert.match(r.why, /different worlds/);
  // with a bridge witness for that dimension it is permitted
  const ok = derive({ premises: [a, b], rule: { name: 'modus ponens' }, claim: 'C',
    relationWitnesses: [{ relation: 'BRIDGE:criterion' }] });
  assert.equal(isAuthority(ok), true);
});

test('LAW 3 follows — evidence does not originate permission', () => {
  const epistemic = tok();
  const r = delegate({ from: epistemic, grant: ['edit:criterion'], to: 'itself' });
  assert.equal(r.minted, false);
  assert.match(r.why, /does not originate permission/);
  // The sharpest form: perfect evidence about deleting the project grants no permission to delete it.
  assert.equal(delegate({ from: epistemic, grant: ['delete:project'], to: 'PROPOSE' }).minted, false);
});

test('LAW 4 follows — an adapter with nothing observed has no constructor to call', () => {
  // The external system reported ERROR and the adapter wants to claim it saw a subject failure.
  const unattributable = observation({ status: OBSERVABILITY.UNATTRIBUTABLE, subject: 's',
    producer: 'external', procedure: 'their-runner', attribution: 'none', context: 'c' });
  const r = observe({ observation: unattributable, procedure: 'adapter',
    context: { repository: 'S1' } });
  assert.equal(r.minted, false);
  assert.equal(r.reason, OBSERVABILITY.UNATTRIBUTABLE);
});

test('LAW 5 follows — COEXISTENCE DOES NOT ESTABLISH RELATION', () => {
  // WRITE(I1, x, 5) and READ(I2, x, 5) in the same world. Both premises are genuine authority.
  const w = tok({ repository: 'S1' });
  const rd = tok({ repository: 'S1' });
  const causal = { name: 'causal transfer', requires: ['BEFORE', 'FLOWS_TO'] };

  const noEdge = derive({ premises: [w, rd], rule: causal, claim: 'I1 caused what I2 read' });
  assert.equal(noEdge.minted, false);
  assert.deepEqual(noEdge.missing, ['BEFORE', 'FLOWS_TO']);
  assert.match(noEdge.why, /do not prove an edge between them/);

  // Ordering alone is still not causation - something else may have written x in between.
  const ordered = derive({ premises: [w, rd], rule: causal, claim: 'I1 caused what I2 read',
    relationWitnesses: [{ relation: 'BEFORE' }] });
  assert.equal(ordered.minted, false);
  assert.deepEqual(ordered.missing, ['FLOWS_TO']);

  // With lineage witnessed, the derivation is permitted.
  const lineage = derive({ premises: [w, rd], rule: causal, claim: 'I1 caused what I2 read',
    relationWitnesses: [{ relation: 'BEFORE' }, { relation: 'FLOWS_TO' }] });
  assert.equal(isAuthority(lineage), true);

  // And a rule that requires nothing still composes, so the calculus is not a wall.
  assert.equal(isAuthority(derive({ premises: [w, rd], rule: { name: 'conjunction', requires: [] },
    claim: 'both happened' })), true);
});

test('LAW 6 follows — delegation may narrow and may never widen, so cycles cannot amplify', () => {
  const a = delegate({ from: 'OWNER', grant: ['edit:implementation'], to: 'A' });
  const b = delegate({ from: a, grant: ['edit:implementation'], to: 'B' });
  assert.equal(isAuthority(b), true);
  // B tries to hand A something neither was given. Locally nobody self-ratifies; globally nothing grows.
  const amplify = delegate({ from: b, grant: ['edit:criterion'], to: 'A' });
  assert.equal(amplify.minted, false);
  assert.match(amplify.why, /circulating permission around a cycle cannot amplify it/);
  // Circulation itself is harmless as long as it adds nothing.
  assert.equal(isAuthority(delegate({ from: b, grant: ['edit:implementation'], to: 'A' })), true);
});

test('LAW 7, THE HALF THAT REDUCES — no token means there is no action to choose', () => {
  assert.equal(commit({ authority: null, action: 'write' }).committed, false);
  assert.equal(commit({ authority: invalidate(tok(), 'stale'), action: 'write' }).committed, false);
});

test('PROPOSE creates zero authority, and COMMIT consumes rather than produces', () => {
  const p = propose('def f(): return 1');
  assert.equal(p.authority, null);
  assert.match(p.why, /no constructor that turns one into authority/);
  const c = commit({ authority: tok(), action: 'write bytes' });
  assert.equal(c.committed, true);
  assert.ok(c.consumed.length > 0);
  assert.equal(c.authority, undefined, 'COMMIT returns no new authority');
});

// ---------------------------------------------------------------- R2 HISTORICAL BUGS AS ILLICIT MINTS

test('R2 — every historical defect is the SAME illicit minting operation', () => {
  const cases = [];

  // failSet(null) -> {} : a dead producer presented as a clean result.
  cases.push(['run 0 / failSet(null)', observe({ procedure: 'p', context: { repository: 'S1' },
    observation: observation({ status: OBSERVABILITY.PRODUCER_FAILED, subject: 's', producer: 'p',
      procedure: 'q', attribution: 'a', context: 'c' }) })]);

  // UNKNOWN || 0 : a measurement that never happened presented as a measured zero.
  cases.push(['history-scope / UNKNOWN||0', observe({ procedure: 'p', context: { repository: 'S1' },
    observation: observation({ status: OBSERVABILITY.NOT_ATTEMPTED, subject: 's', producer: 'p',
      procedure: 'q', attribution: 'a', context: 'c' }) })]);

  // line aliasing : an observation that cannot be bound to a subject.
  cases.push(['hazard 13 / module:line', observe({ procedure: 'p', context: { repository: 'S1' },
    observation: observation({ status: OBSERVABILITY.UNATTRIBUTABLE, subject: 's', producer: 'p',
      procedure: 'q', attribution: 'a', context: 'c' }) })]);

  // stale doctests : evidence from S0 used to conclude about S1.
  cases.push(['stale evidence', derive({ premises: [tok({ repository: 'S0' }), tok({ repository: 'S1' })],
    rule: { name: 'compare' }, claim: 'the corpora agree' })]);

  // Frankenstein join : premises from different histories.
  cases.push(['frankenstein join', derive({
    premises: [tok({ repository: 'S1', history: 'H1' }), tok({ repository: 'S1', history: 'H2' })],
    rule: { name: 'chain' }, claim: 'therefore B' })]);

  // the five doctest mutations : an actor reaching into what judges it.
  cases.push(['doctest mutation', delegate({ from: tok(), grant: ['edit:evidence'], to: 'PROPOSE' })]);

  for (const [name, r] of cases) {
    assert.equal(r.minted, false, name + ' should have been refused');
    assert.equal(isAuthority(r), false, name);
    assert.ok(typeof r.why === 'string' && r.why.length > 0, name + ' must say why');
  }
  assert.equal(cases.length, 6);
});

// ---------------------------------------------------------------- WHAT DOES NOT REDUCE

test('HONEST RESIDUE — two things the three constructors do NOT account for', () => {
  // 1. THE INDEPENDENT ROOT IS AN AXIOM, NOT A CONSTRUCTOR. `delegate({from: 'OWNER'})` mints without a
  //    prior token, and nothing inside the calculus justifies OWNER's authority. That is correct - it is
  //    a boundary condition, and normative authority has to enter the system from outside it - but it
  //    means the calculus has THREE CONSTRUCTORS AND ONE AXIOM, not three constructors.
  const root = delegate({ from: 'OWNER', grant: ['edit:implementation'], to: 'A' });
  assert.equal(isAuthority(root), true);
  assert.equal(root.ancestry[0].from, 'OWNER');

  // 2. LAW 7 ONLY HALF-REDUCES. "No token, no action" falls out. But the requirement that an
  //    investigation must be able to CHANGE ENTITLEMENT is not a conservation property at all - nothing
  //    about authority forbids running a probe that cannot change its own mind. It is a TERMINATION
  //    property, and it needs its own justification outside this calculus.
  const t = tok();
  const pointlessButPermitted = commit({ authority: t, action: 'rerun the identical probe' });
  assert.equal(pointlessButPermitted.committed, true,
    'the calculus PERMITS a pointless investigation: authority is not what stops it');
});
