// r4 — the instrument representation APPLIED, once, where the classes and witnesses come from executed
// tests and from history rather than from my hand.
//
// Two instruments exist in this repository whose failure classes are enumerated by their own executed
// refusals: the FREEZE GATE (ten historical defects, each refused in FREEZE-GATE.test.mjs) and the
// COMPOSITION ATTACK SUITE (twenty-one defects, each reproduced pre-repair in the commits recorded in
// RESULT.composition*.md and each now a regression). The witnesses are those executions.
//
// THE HISTORICAL FACT THAT MAKES THIS NON-VACUOUS: the freeze gate passed at 464/464 while all
// twenty-one composition defects were live. A null from the gate did not stand in for a null from the
// composition suite, and the representation must say so - and must say the converse too, since the
// composition suite never injected the gate's ten.
import test from 'node:test';
import assert from 'node:assert';
import { instrument, subsumes, nullTransfers, SUBSUMPTION } from './instruments.mjs';

const W = (ref) => ({ injected: true, fired: true, ref });
const GATE = instrument({ name: 'FREEZE-GATE', detects: [
  'null->empty', 'unknown->zero', 'identity alias', 'stale state', 'spec crossing', 'frankenstein',
  'self-ratification', 'adapter invention', 'irrelevant scope defeats', 'pointless investigation',
].map((c) => ({ failureClass: c, witness: W('FREEZE-GATE.test.mjs GATE / REFUSE') })) });

const COMPOSITION = instrument({ name: 'COMPOSITION-ATTACKS', detects: [
  ['C1 null intermediate launders context', 'b11e51f'], ['C2 absence read as for-all', 'b11e51f'],
  ['C3 brand recoverable', 'b11e51f'], ['C4 admission by name across producers', 'b11e51f'],
  ['C5 reserved key admissible', 'b11e51f'], ['C6 shadowed carried value lost', 'b11e51f'],
  ['C7 identity excludes scope', 'b11e51f'], ['C8 last-wins digest / seal without attribution', 'b11e51f'],
  ['C9 pending string stalls', 'b11e51f'], ['C10 duplicated vocabulary', 'b11e51f'],
  ['W2-a refuter across worlds', 'b0673cd'], ['W2-b reestablish moves scope', 'b0673cd'],
  ['W2-c stale witness is an edge', 'b0673cd'], ['W2-d unmeasured metric compatible', 'b0673cd'],
  ['W2-e absent version stringified', 'b0673cd'], ['W2-f fabricated ordinal', 'b0673cd'],
  ['W2-g mapping across producers', 'b0673cd'], ['W3-c delegation widens world', '32b0207'],
  ['W3-d narrow moves referent', '32b0207'], ['W3-e commit consumes evidence', '32b0207'],
  ['W3-f derive order-dependent', '32b0207'],
].map(([c, ref]) => ({ failureClass: c, witness: W(ref) })) });

test('neither instrument subsumes the other, and the representation says so in both directions', () => {
  const gateOverComposition = subsumes(GATE, COMPOSITION);
  assert.equal(gateOverComposition.verdict, SUBSUMPTION.DOES_NOT_SUBSUME);
  assert.equal(gateOverComposition.uncovered.length, 21, 'the gate has never fired on any of the 21');
  const compositionOverGate = subsumes(COMPOSITION, GATE);
  assert.equal(compositionOverGate.verdict, SUBSUMPTION.DOES_NOT_SUBSUME);
  assert.equal(compositionOverGate.uncovered.length, 10);
});

test('THE HISTORICAL READING — a green freeze gate was never a null for the composition suite', () => {
  const n = nullTransfers({ cheap: GATE, strong: COMPOSITION, cheapFound: false });
  assert.equal(n.transfers, false);
  assert.match(n.why, /never been shown to detect/);
  // and when the gate DOES find something, that finding stands whatever the relation
  assert.equal(nullTransfers({ cheap: GATE, strong: COMPOSITION, cheapFound: true }).transfers, true);
});

test('LIMIT, executed rather than stated — a class the composition suite CLAIMS without a witness is UNKNOWN, not covered', () => {
  const claimed = instrument({ name: 'COMPOSITION+claim', detects: [...COMPOSITION.detects,
    { failureClass: 'null->empty', witness: { injected: false, fired: false, ref: 'never run' } }] });
  const s = subsumes(claimed, instrument({ name: 'one', detects: [
    { failureClass: 'null->empty', witness: W('FREEZE-GATE.test.mjs') }] }));
  assert.equal(s.verdict, SUBSUMPTION.UNKNOWN);
  assert.deepEqual(s.claimedNotWitnessed, ['null->empty']);
});
