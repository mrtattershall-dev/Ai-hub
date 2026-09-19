// THE FREEZE GATE — the single file that must pass before r3 is frozen and Repo C begins.
//
// Ten historical counterexamples must be refused WITHOUT special-case recognition, and every legitimate
// operation must remain possible. The second half is the half that matters: a refusal machine passes the
// first half perfectly.
//
// After this gate, architecture work STOPS. The next source of information has to be reality outside the
// architecture, because deeper internal refinement without fresh falsification is overfitting.
import test from 'node:test';
import assert from 'node:assert';
import { observe, derive, delegate, restrictGrant, isAuthority, tracesToIndependentRoot }
  from './calculus.mjs';
import { observation, OBSERVABILITY } from './observation.mjs';
import { illegalCompression, illegalRefinement, informationMonotonicity } from './monotonicity.mjs';
import { transfer, BRIDGE, POLARITY } from './referent.mjs';
import { surfaceAuthority, mayApply, DOMAIN, AUTHORIZATION } from './escalation.mjs';
import { registry, comparisonDefeat, RELEVANCE, ARGUED_FROM } from './admissibility.mjs';
import { evidenceFrontier, contestState, objectivesFromContest, nextAction, CONTEST } from './stopping.mjs';
import { adjudicate, party, VERDICT } from './conflict.mjs';

const obs = (status) => observation({ status, value: 'v', subject: 's', producer: 'p', procedure: 'q',
  attribution: 'a', context: 'c' });
const tok = (context) => observe({ observation: obs(OBSERVABILITY.OBSERVED), procedure: 'tracer',
  context });
const REG = registry([
  { name: 'repository', relevance: RELEVANCE.TRUTH_CONDITIONS, argument: 'state changes meaning',
    arguedFrom: ARGUED_FROM.DESIGN },
  { name: 'history', relevance: RELEVANCE.COMPARISON_ENTITLEMENT, argument: 'prefix changes the subject',
    arguedFrom: ARGUED_FROM.SPECIFICATION },
]);

// ===================================================================== TEN COUNTEREXAMPLES

test('GATE / REFUSE — all ten historical defects, no special-case recognition', () => {
  const refused = [];
  const check = (name, cond) => { assert.equal(cond, true, name + ' was NOT refused'); refused.push(name); };

  // 1 null -> empty (run 0)
  check('1 null->empty',
    observe({ observation: obs(OBSERVABILITY.PRODUCER_FAILED), procedure: 'p', context: {} }).minted === false);

  // 2 UNKNOWN -> zero
  check('2 unknown->zero', illegalCompression({
    states: [{ name: 'measured zero', value: { p: 0, known: true } },
      { name: 'unknown', value: { p: undefined, known: false } }],
    compress: (s) => (s.p || 0),
    consumers: [{ name: 'treats as identical subject', grants: (s) => s.known && s.p === 0 }],
  }).ok === false);

  // 3 execution-identity alias
  check('3 identity alias', illegalCompression({
    states: [{ name: 'module stmt', value: { m: 'm', l: 1, code: 'module' } },
      { name: 'fn body', value: { m: 'm', l: 1, code: 'fn' } }],
    compress: (s) => s.m + ':' + s.l,
    consumers: [{ name: 'claims about the body', grants: (s) => s.code === 'fn' }],
  }).ok === false);

  // 4 stale state
  check('4 stale state',
    transfer({ from: { subject: 'x', criterion: 'K', observer: 'o', scope: 'S0' },
      to: { subject: 'x', criterion: 'K', observer: 'o', scope: 'S1' } }).ok === false);

  // 5 specification crossing (the five doctest mutations)
  check('5 spec crossing', mayApply({ grantedOver: [DOMAIN.SUBJECT],
    affects: surfaceAuthority({ insideDocstring: true, line: '    >>> f(1)' }).affects }).ok === false);

  // 6 Frankenstein evidence
  check('6 frankenstein', derive({
    premises: [tok({ repository: 'S1', history: 'H1' }), tok({ repository: 'S1', history: 'H2' })],
    rule: { name: 'chain' }, claim: 'C' }).minted === false);

  // 7 self-ratification
  check('7 self-ratification',
    delegate({ from: tok({ repository: 'S1' }), grant: ['edit:criterion'], to: 'self' }).minted === false);

  // 8 adapter invention
  check('8 adapter invention', illegalRefinement({
    states: [{ name: 'observer died', source: 'ERROR', truth: 'PRODUCER_FAILED' },
      { name: 'subject died', source: 'ERROR', truth: 'SUBJECT_FAILED' }],
    adapt: (s) => s.truth,
    consumers: [{ name: 'repairs the observer', grants: (s) => s === 'PRODUCER_FAILED' }],
  }).ok === false);

  // 9 irrelevant scope must NOT defeat comparison
  check('9 irrelevant scope', comparisonDefeat({
    a: { subject: 'f', repository: 'S1', hostname: 'a', nanos: 1 },
    b: { subject: 'f', repository: 'S1', hostname: 'b', nanos: 2 }, reg: REG }).defeats === false);

  // 10 pointless investigation generates no work
  check('10 pointless investigation', objectivesFromContest(contestState({
    frontier: evidenceFrontier({ requiredProducers: ['t'], attempted: ['t'] }),
    investigations: [{ name: 'rerun', authorized: true, executable: true, targetsDistinction: true,
      canChangeEntitlement: false }],
  })).objectives.length === 0);

  assert.equal(refused.length, 10);
});

// ===================================================================== ADMIT CONTROLS

test('GATE / ADMIT — every legitimate operation remains possible', () => {
  const admitted = [];
  const check = (name, cond) => { assert.equal(cond, true, name + ' was WRONGLY refused'); admitted.push(name); };

  // legitimate compression: discards only what no consumer reads
  check('legitimate compression', illegalCompression({
    states: [{ name: 'red', value: { s: 'OK', colour: 'red' } },
      { name: 'blue', value: { s: 'OK', colour: 'blue' } }],
    compress: (v) => v.s, consumers: [{ name: 'reads status', grants: (v) => v.s === 'OK' }] }).ok);

  // legitimate cross-SUBJECT join in one world
  check('cross-subject join', isAuthority(derive({
    premises: [tok({ repository: 'S1' }), tok({ repository: 'S1' })],
    rule: { name: 'conjunction', requires: [] }, claim: 'both' })));

  // legitimate criterion transfer through an authorized bridge
  check('criterion transfer', transfer({
    from: { subject: 'x', criterion: 'K0', observer: 'o', scope: 'S1' },
    to: { subject: 'x', criterion: 'K1', observer: 'o', scope: 'S1' },
    polarity: POLARITY.POSITIVE, bridges: { criterion: BRIDGE.EXPANDED } }).ok);

  // legitimate delegation, rooted and covering
  const rooted = delegate({ from: delegate({ from: 'OWNER', grant: ['edit:impl'], to: 'A' }),
    grant: ['edit:impl'], to: 'B' });
  check('rooted delegation', tracesToIndependentRoot(rooted, ['edit:impl']).ok);
  check('restriction is free', restrictGrant(rooted, ['edit:impl']).grant.length === 1);

  // an authorized surface crossing
  check('authorized crossing', mayApply({ grantedOver: [DOMAIN.SUBJECT],
    affects: [DOMAIN.SUBJECT, DOMAIN.EVIDENCE], authorizedBy: AUTHORIZATION.OWNER }).ok);

  // a RELEVANT difference still defeats comparison
  check('relevant scope defeats', comparisonDefeat({
    a: { subject: 'f', history: 'H1' }, b: { subject: 'f', history: 'H2' }, reg: REG }).defeats);

  // a relevant investigation still produces work
  check('relevant investigation', objectivesFromContest(contestState({
    frontier: evidenceFrontier({ requiredProducers: ['t'], attempted: ['t'] }),
    investigations: [{ name: 'typecheck', authorized: true, executable: true, targetsDistinction: true,
      canChangeEntitlement: true }] })).objectives.length === 1);

  // information loss never GAINS a permission, and losing one is fine
  check('monotonicity holds', informationMonotonicity({
    rich: obs(OBSERVABILITY.OBSERVED), erase: (o) => ({ ...o, subject: null }),
    consumers: [{ name: 'evidence', grants: (o) => o.subject !== null }] }).ok);

  assert.equal(admitted.length, 9);
});

// ===================================================================== THE TWO THAT MUST BE REACHABLE

test('GATE / REACHABLE — GENUINE_DISAGREEMENT and QUIESCE, or the gate is a refusal machine', () => {
  const ref = { subject: 'f', criterion: 'K1', observer: 'o', scope: 'S1' };
  const contest = adjudicate({
    a: party({ name: 'legasus', proposition: 'P', referent: ref, polarity: POLARITY.POSITIVE,
      entitled: true, evidence: ['w1'] }),
    b: party({ name: 'external', proposition: 'not P', referent: ref, polarity: POLARITY.NEGATIVE,
      entitled: true, evidence: ['r9'] }),
  });
  assert.equal(contest.verdict, VERDICT.GENUINE_DISAGREEMENT);
  assert.equal(contest.resolved, false);
  assert.deepEqual(contest.evidence.legasus, ['w1']);
  assert.deepEqual(contest.evidence.external, ['r9'], 'both chains preserved');

  const quiet = contestState({ frontier: evidenceFrontier({ requiredProducers: [], attempted: [] }),
    investigations: [] });
  assert.equal(quiet.state, CONTEST.QUIESCENT_CONTEST);
  assert.equal(nextAction({ candidates: [] }).quiesce, true);
});
