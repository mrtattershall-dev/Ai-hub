// CAN IT STOP? — the controls on the verdict this architecture is most at risk of never reaching.
//
// The danger is not that reconciliation is wrong. Reconciliation has been right every time so far. The
// danger is a system that can ALWAYS find an explanation, which is unfalsifiable rather than careful.
import test from 'node:test';
import assert from 'node:assert';
import { adjudicate, party, owesExperiment, VERDICT, RESOLUTION_STRATEGIES_DELIBERATELY_ABSENT }
  from './conflict.mjs';
import { BRIDGE, POLARITY } from './referent.mjs';

const ref = (o = {}) => ({ subject: 'utils.canonicalize_name', criterion: 'K1', observer: 'obs-1',
  scope: 'S1', ...o });

const yes = (o = {}) => party({ name: 'legasus', proposition: 'the site behaves as documented',
  referent: ref(), polarity: POLARITY.POSITIVE, entitled: true, evidence: ['witness w1'], ...o });
const no = (o = {}) => party({ name: 'external', proposition: 'the site does NOT behave as documented',
  referent: ref(), polarity: POLARITY.NEGATIVE, entitled: true, evidence: ['external run r9'], ...o });

test('IT CAN REACH GENUINE DISAGREEMENT — without this every other test is decoration', () => {
  const r = adjudicate({ a: yes(), b: no() });
  assert.equal(r.verdict, VERDICT.GENUINE_DISAGREEMENT);
  assert.equal(r.resolved, false);
  assert.match(r.why, /NO RECONCILIATION IS OFFERED/);
});

test('IT REFUSES TO PICK A WINNER, and the absence is asserted rather than assumed', () => {
  const r = adjudicate({ a: yes(), b: no() });
  assert.equal(r.winner, undefined);
  assert.equal(r.preferred, undefined);
  assert.equal(r.resolution, undefined);
  // BOTH chains survive. A verdict that discards the loser's evidence has picked a winner quietly.
  assert.deepEqual(r.evidence.legasus, ['witness w1']);
  assert.deepEqual(r.evidence.external, ['external run r9']);
  assert.ok(RESOLUTION_STRATEGIES_DELIBERATELY_ABSENT.length > 0);
});

test('GENUINE_DISAGREEMENT IS NOT UNKNOWN — it is a surplus of information, not a gap', () => {
  const r = adjudicate({ a: yes(), b: no() });
  assert.notEqual(r.verdict, 'UNKNOWN');
  assert.equal(owesExperiment(r), true);
  // An unestablished party owes something different, and must NOT be dressed up as a conflict.
  const weak = adjudicate({ a: yes(), b: no({ entitled: false }) });
  assert.equal(weak.verdict, VERDICT.ONE_UNESTABLISHED);
  assert.equal(owesExperiment(weak), false);
});

test('a SCOPE difference dissolves the conflict — but only when the referent really moved', () => {
  const r = adjudicate({ a: yes(), b: no({ referent: ref({ criterion: 'K2' }) }) });
  assert.equal(r.verdict, VERDICT.SCOPE_INCOMPATIBLE);
  assert.deepEqual(r.moved, ['criterion']);

  // AND THE CRUCIAL NEGATIVE: with a bridge that DOES carry the claim, the scope excuse is no longer
  // available and the conflict must resurface. An explanation may only fire when it applies.
  const bridged = adjudicate({ a: yes(), b: no({ referent: ref({ criterion: 'K2' }) }),
    bridges: { criterion: BRIDGE.PRESERVED } });
  assert.equal(bridged.verdict, VERDICT.GENUINE_DISAGREEMENT,
    'a bridged scope is a SHARED scope; the disagreement is real again');
});

test('DIFFERENT SUBJECTS are not a disagreement about anything', () => {
  const r = adjudicate({ a: yes(), b: no({ referent: ref({ subject: 'tags.sys_tags' }) }) });
  assert.equal(r.verdict, VERDICT.NOT_COMPARABLE);
});

test('COMPOSITION DISAGREEMENT — the premises are admissible and the JOIN is not', () => {
  // The external system is entitled to each of its facts, and its conclusion rests on a join Legasus
  // cannot justify. That is a distinct verdict from disputing the facts.
  const r = adjudicate({ a: yes(), b: no({ joinJustified: false }) });
  assert.equal(r.verdict, VERDICT.COMPOSITION_UNJUSTIFIED);
  assert.deepEqual(r.unjustified, ['external']);
  assert.match(r.why, /The premises are not in dispute; the derivation is/);
});

test('AGREEMENT is reachable too, so the adjudicator is not a conflict generator', () => {
  const r = adjudicate({ a: yes(), b: yes({ name: 'external', evidence: ['external run r9'] }) });
  assert.equal(r.verdict, VERDICT.AGREEMENT);
});

test('EVERY VERDICT IS REACHABLE — the vocabulary is not decorative', () => {
  const reached = new Set();
  reached.add(adjudicate({ a: yes(), b: no({ referent: ref({ subject: 'other' }) }) }).verdict);
  reached.add(adjudicate({ a: yes(), b: no({ referent: ref({ scope: 'S2' }) }) }).verdict);
  reached.add(adjudicate({ a: yes(), b: no({ entitled: false }) }).verdict);
  reached.add(adjudicate({ a: yes(), b: no({ joinJustified: false }) }).verdict);
  reached.add(adjudicate({ a: yes(), b: yes({ name: 'external' }) }).verdict);
  reached.add(adjudicate({ a: yes(), b: no() }).verdict);
  assert.equal(reached.size, Object.keys(VERDICT).length,
    'unreached: ' + Object.values(VERDICT).filter((v) => !reached.has(v)).join(', '));
});

test('THE ANTI-EXPLANATION CONTROL — a tempting excuse that does not apply is NOT used', () => {
  // Same subject, same scope, both entitled, both joins justified. There is a difference between the
  // parties - their observers are the same, their evidence differs in content - and none of that is a
  // licence to reconcile. If the adjudicator reached for any explanation here it would be an
  // explaining-away machine.
  const r = adjudicate({
    a: yes({ evidence: ['a hundred witnesses'] }),
    b: no({ evidence: ['one witness'] }),
  });
  assert.equal(r.verdict, VERDICT.GENUINE_DISAGREEMENT,
    'a hundred witnesses against one is still a genuine disagreement, not a resolution');
});
