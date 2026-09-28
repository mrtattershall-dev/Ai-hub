// PLACEMENT ROBUSTNESS rev 2 — calibrated against the middle family, with the anti-bloat control.
//
// This dimension does not get to be used anywhere until it reproduces an ordering that was measured
// independently, FOR THE STATED REASON, and fails to reward defensiveness that buys nothing.
//
//     middle family, insertion placement varied:
//         self-defending  n < 10 and n != 3    0.651 of placements survived
//         plain           n < 10               0.470
//
// Revision 1 called those equal and then demoted the self-defending guard. Revision 2 must not.
import test from 'node:test';
import assert from 'node:assert';
import { placementRobustness, insertionPositions, hostLegalPositions } from './robustness.mjs';

const NL = String.fromCharCode(10);

// The middle family's shape: a preserved behaviour that is NOT last, and a later existing guard the new
// behaviour must precede. That geometry is what makes placement matter at all.
const SRC = ['def classify(n):',
  '    if n == 3:',
  '        return "special"',
  '    if n < 100:',
  '        return "ordinary"',
  '    return "large"'];

const INPUTS = [-5, 0, 1, 3, 4, 9, 10, 11, 50, 99, 100, 101];

// GROUND TRUTH FROM THE CONTRACT, written out rather than derived from any candidate:
//   n == 3        -> "special"   (preserved, wins)
//   n < 10        -> "tiny"      (the new behaviour)
//   n < 100       -> "ordinary"  (existing)
//   otherwise     -> "large"
const EXPECTED = new Map(INPUTS.map((v) => {
  if (v === 3) return [v, 'special'];
  if (v < 10) return [v, 'tiny'];
  if (v < 100) return [v, 'ordinary'];
  return [v, 'large'];
}));

const guard = (cond) => ['    if ' + cond + ':', '        return "tiny"'];
const score = (cond) => placementRobustness({ srcLines: SRC, guardLines: guard(cond),
  inputs: INPUTS, expected: EXPECTED });

test('the measure has more than one position to vary, or it is not measuring placement', () => {
  const positions = insertionPositions(SRC);
  assert.ok(positions.length >= 4, 'a one-position unit cannot exhibit placement robustness at all');
});

test('CALIBRATION — the self-defending guard is more placement-robust than the plain one', () => {
  const selfDefending = score('n < 10 and n != 3');
  const plain = score('n < 10');
  assert.ok(selfDefending.fraction > plain.fraction,
    'rev 1 called these equal and then demoted the self-defending guard: '
      + JSON.stringify({ selfDefending: selfDefending.correct + '/' + selfDefending.legal,
        plain: plain.correct + '/' + plain.legal }));
});

test('AND FOR THE STATED REASON — it survives positions the plain guard breaks at', () => {
  // The reason must be "more legal insertion positions preserve semantics", not an accident of counting.
  const selfDefending = score('n < 10 and n != 3');
  const plain = score('n < 10');
  const gained = selfDefending.detail.filter((d, i) => d.ok && !plain.detail[i].ok);
  assert.ok(gained.length > 0, 'there must be an actual position where one holds and the other does not');
  // At that position, the plain guard must be shadowing the preserved behaviour - the known mechanism.
  const early = gained.some((d) => d.position === 0);
  assert.ok(early, 'the gained position should be ahead of the preserved behaviour, which is where a'
    + ' plain guard swallows n == 3');
});

test('THE ANTI-BLOAT CONTROL — defensiveness that buys no position must score the SAME', () => {
  // 999 is claimed by no behaviour in this unit, so excluding it cannot free a single placement. If this
  // scored higher, the dimension would have become REWARD EXTRA GUARDS.
  const plain = score('n < 10');
  const pointless = score('n < 10 and n != 999');
  assert.equal(pointless.fraction, plain.fraction,
    'an exclusion of a value nothing claims must not buy robustness');

  const alsoPointless = score('n < 10 and n != 999 and n != 1000 and n != 1001');
  assert.equal(alsoPointless.fraction, plain.fraction, 'and piling them up must not either');
});

test('robustness to AUTHORIZED variation, not defensiveness against arbitrary mutation', () => {
  // A guard that defends against the preserved behaviour gains a position because the preserved behaviour
  // REALLY IS THERE. A guard that defends against a value no behaviour claims gains nothing. The
  // distinction is measured, not asserted.
  const defendsSomethingReal = score('n < 10 and n != 3');
  const defendsNothing = score('n < 10 and n != 999');
  assert.ok(defendsSomethingReal.fraction > defendsNothing.fraction,
    'only defence against a real neighbour may be rewarded');
});

test('a WRONG realization is not rescued by being placed well', () => {
  // Robustness is measured against the contract, so a candidate with the wrong domain scores badly at
  // every position rather than well at one.
  const wrong = score('n < 5');
  assert.equal(wrong.correct, 0, 'the wrong domain must not verify anywhere: ' + JSON.stringify(wrong.detail));
});

test('THE DENOMINATOR IS CANDIDATE-INDEPENDENT — fitting in fewer places must not raise the score', () => {
  // The trap this pins: if legality were decided per candidate, one that parses at fewer positions would
  // shrink its own denominator and score HIGHER for being compatible with less. That is the opposite of
  // robustness and the exact shape of every accidental oracle here.
  const a = score('n < 10 and n != 3');
  const b = score('n < 10');
  const c = score('n < 10 and n != 999');
  assert.equal(a.legal, b.legal, 'every candidate is answerable for the same host positions');
  assert.equal(b.legal, c.legal);
  assert.ok(a.legal > 0);
  // The legal set is the host's, so it is reproducible without reference to any candidate.
  assert.equal(hostLegalPositions(SRC, INPUTS).length, a.legal);
});

test('a candidate that FAILS TO COMPILE at a legal position is charged for it', () => {
  // A guard whose own text breaks at a position the host accepts is a candidate failure, counted in the
  // denominator and not correct - not an excused absence.
  const broken = placementRobustness({ srcLines: SRC,
    guardLines: ['    if n < 10:', '    return "tiny"'],   // body not indented: parses nowhere
    inputs: INPUTS, expected: EXPECTED });
  assert.equal(broken.correct, 0);
  assert.ok(broken.legal > 0, 'the host positions still exist');
  assert.equal(broken.candidateFailures, broken.legal, 'and the candidate is charged at every one');
  assert.equal(broken.fraction, 0, 'it must not score 0/0 = undefined or be silently excused');
});

test('the ground truth comes from the CONTRACT, never from the candidate', () => {
  // If expectations were read off the candidate, every candidate would be perfectly robust. Passing a
  // deliberately impossible expectation must score zero for everything.
  const impossible = new Map(INPUTS.map((v) => [v, 'nonsense']));
  const r = placementRobustness({ srcLines: SRC, guardLines: guard('n < 10 and n != 3'),
    inputs: INPUTS, expected: impossible });
  assert.equal(r.correct, 0, 'the measure must be answerable to supplied truth, not self-confirming');
});
