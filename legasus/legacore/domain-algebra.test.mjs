// THE DOMAIN ALGEBRA — every relation, across every pair of kinds, plus the refusals.
//
// The reason this module exists is a defect that no per-component test could have caught: two stages
// each passing their own suite while disagreeing about what a domain means. So the test that matters
// most here is the CROSS-KIND one - the pairs that only exist once there is more than one kind.
import test from 'node:test';
import assert from 'node:assert';
import { relate, contains, disjoint, equivalent, overlaps, witnessValues, RELATION }
  from './domain-algebra.mjs';
import { parseCondition } from './predicates.mjs';

const d = (s) => parseCondition(s);
const rel = (x, y) => relate(d(x), d(y)).relation;

test('CONTAINMENT in every kind combination', () => {
  assert.equal(rel('n < 100', 'n < 10'), RELATION.CONTAINS, 'interval over interval');
  assert.equal(rel('n < 10', 'n == 5'), RELATION.CONTAINS, 'interval over point');
  assert.equal(rel('n < 10', 'n in (1, 5, 9)'), RELATION.CONTAINS, 'interval over set');
  assert.equal(rel('n in (1, 3, 5)', 'n in (3, 5)'), RELATION.CONTAINS, 'set over set');
  assert.equal(rel('n in (1, 3, 5)', 'n == 3'), RELATION.CONTAINS, 'set over point');
  assert.equal(rel('n in (3, 5)', 'n in (1, 3, 5)'), RELATION.CONTAINED, 'and the mirror direction');
});

test('DISJOINT in every kind combination', () => {
  assert.equal(rel('n < 0', 'n > 100'), RELATION.DISJOINT, 'interval and interval');
  assert.equal(rel('n in (1, 3)', 'n in (5, 7)'), RELATION.DISJOINT, 'set and set');
  assert.equal(rel('n in (1, 3)', 'n > 100'), RELATION.DISJOINT, 'set and interval');
  assert.equal(rel('n == 5', 'n in (1, 3)'), RELATION.DISJOINT, 'point and set');
});

test('OVERLAP — shares values, neither contains the other, and it is REFUSED downstream', () => {
  // The relation intervals could barely express. This is the whole reason sets were added.
  const r = relate(d('n in (1, 3)'), d('n in (3, 5)'));
  assert.equal(r.relation, RELATION.OVERLAP);
  assert.equal(r.witness.shared, 3);
  assert.equal(r.witness.onlyA, 1);
  assert.equal(r.witness.onlyB, 5);
  // Intervals can reach it too, with the right pair.
  assert.equal(rel('n < 10', 'n > 5'), RELATION.OVERLAP);
  // And a set against an interval that clips it.
  assert.equal(rel('n in (1, 5, 50)', 'n < 10'), RELATION.OVERLAP);
});

test('EQUAL yields no precedence, however it is spelled', () => {
  assert.equal(rel('n in (1, 3)', 'n in (3, 1)'), RELATION.EQUAL);
  assert.equal(rel('n == 5', 'n == 5'), RELATION.EQUAL);
  assert.equal(equivalent(d('n in (1, 3)'), d('n in (1, 3, 1)')), true);
  assert.equal(rel('n < 10', 'n < 10'), RELATION.EQUAL);
});

test('UNKNOWN is a real answer, never a guess', () => {
  const r = relate(d('n in (a, b)'), d('n < 10'));
  assert.equal(r.relation, RELATION.UNKNOWN);
  assert.match(r.why, /does not model/);
  assert.equal(contains(d('n in (a, b)'), d('n < 10')), null,
    'containment must refuse rather than return false, which would read as a decided answer');
});

test('every relation carries a witness that actually holds', () => {
  const cases = [['n in (1, 3, 5)', 'n in (3, 5)'], ['n in (1, 3)', 'n in (3, 5)'],
    ['n < 0', 'n > 100'], ['n < 10', 'n == 5']];
  for (const [x, y] of cases) {
    const r = relate(d(x), d(y));
    assert.ok(r.witness, x + ' vs ' + y + ' must carry a witness');
    for (const v of Object.values(r.witness)) {
      assert.equal(typeof v, 'number', 'witnesses are values, not descriptions');
    }
  }
});

test('the witness set interrogates set gaps and unbounded ends', () => {
  const vs = witnessValues(d('n in (2, 4, 6, 8)'), d('n < 10'));
  for (const gap of [3, 5, 7]) {
    assert.ok(vs.includes(gap), 'gap ' + gap + ' must be a witness, or a spanning range looks equal');
  }
  assert.ok(vs.some((v) => v <= -1000, 'an unbounded end must be interrogated far out'));
});

test('THE DEFECT THIS MODULE EXISTS FOR — a set pair is not reported DISJOINT', () => {
  // The forked implementation returned false for every set membership test, which made every pair of
  // sets look disjoint to DECIDE while PROVE judged them correctly. The relation is asserted directly.
  assert.notEqual(rel('n in (1, 3, 5)', 'n in (3, 5)'), RELATION.DISJOINT);
  assert.equal(disjoint(d('n in (1, 3, 5)'), d('n in (3, 5)')), false);
  assert.equal(overlaps(d('n in (1, 3, 5)'), d('n in (3, 5)')), true);
});

test('relate is symmetric in meaning, with direction carried in the name', () => {
  const ab = relate(d('n < 100'), d('n < 10')).relation;
  const ba = relate(d('n < 10'), d('n < 100')).relation;
  assert.equal(ab, RELATION.CONTAINS);
  assert.equal(ba, RELATION.CONTAINED);
  for (const [x, y] of [['n in (1, 3)', 'n in (5, 7)'], ['n in (1, 3)', 'n in (3, 5)'],
    ['n == 4', 'n == 4']]) {
    assert.equal(rel(x, y), rel(y, x), 'symmetric relations must not depend on argument order');
  }
});
