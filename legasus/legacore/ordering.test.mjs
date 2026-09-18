// The three ways an ordering deriver goes wrong, and a test for each:
//
//   IT ORDERS WHAT IT SHOULD NOT   intersecting-without-containment domains have no derivable order.
//                                  Inventing one makes LegaCore an oracle, which is the single failure
//                                  that would make this whole project's claim meaningless.
//   IT DECLINES WHAT IT SHOULD ORDER   a strictly contained domain MUST go first or it is dead code -
//                                      a program that is syntactically fine and silently never produces
//                                      one of the two results it was asked for.
//   IT ORDERS WITHOUT A WITNESS    a containment claim no example supports is a bound comparison
//                                  wearing a derivation's clothes.
import test from 'node:test';
import assert from 'node:assert';
import { orderRequested, strictlyContains, containsPoint } from './ordering.mjs';

const iv = (loV, hiV, loOpen = true, hiOpen = true) => ({ kind: 'interval', variable: 'n',
  lo: loV, hi: hiV, loOpen, hiOpen });
const pt = (v) => ({ kind: 'point', variable: 'n', value: v });

const below = (v) => iv(-Infinity, v);
const above = (v) => iv(v, Infinity);

test('ORDERS: a strictly contained interval goes first, with a witness', () => {
  const r = orderRequested(
    { id: 'small', domain: below(10), result: '"small"' },
    { id: 'tiny', domain: below(0), result: '"tiny"' });
  assert.equal(r.status, 'ORDERED');
  assert.equal(r.first, 'tiny');
  assert.equal(r.second, 'small');
  assert.ok(containsPoint(below(0), r.witness.input), 'the witness must be inside the narrow domain');
  assert.ok(containsPoint(below(10), r.witness.input), 'and inside the wide one, or it proves nothing');
  assert.equal(r.witness.under_correct_order, '"tiny"');
  assert.equal(r.witness.under_reversed_order, '"small"');
});

test('ORDERS the same way whichever argument comes first', () => {
  const a = orderRequested({ id: 'small', domain: below(10), result: 'S' }, { id: 'tiny', domain: below(0), result: 'T' });
  const b = orderRequested({ id: 'tiny', domain: below(0), result: 'T' }, { id: 'small', domain: below(10), result: 'S' });
  assert.equal(a.first, b.first);
  assert.equal(a.second, b.second);
});

test('ORDERS: a point inside an interval goes first', () => {
  const r = orderRequested(
    { id: 'wide', domain: below(10), result: 'W' },
    { id: 'exact', domain: pt(4), result: 'E' });
  assert.equal(r.status, 'ORDERED');
  assert.equal(r.first, 'exact');
  assert.equal(r.witness.input, 4);
});

test('DECLINES: intersecting without containment is UNDETERMINED, not a guess', () => {
  // below 10 and above 0 share (0, 10) but neither contains the other.
  const r = orderRequested(
    { id: 'low', domain: below(10), result: 'L' },
    { id: 'high', domain: above(0), result: 'H' });
  assert.equal(r.status, 'UNDETERMINED');
  assert.ok(containsPoint(below(10), r.witness.input) && containsPoint(above(0), r.witness.input),
    'the refusal must name a shared input, or it is not a refusal about anything');
});

test('DECLINES: disjoint domains are labelled an ENGINEERING CHOICE, not derived', () => {
  const r = orderRequested(
    { id: 'low', domain: below(0), result: 'L' },
    { id: 'high', domain: above(100), result: 'H' });
  assert.equal(r.status, 'DISJOINT');
  assert.match(r.note, /ENGINEERING CHOICE/);
});

test('DECLINES: identical domains are not a containment', () => {
  const r = orderRequested(
    { id: 'a', domain: below(10), result: 'A' },
    { id: 'b', domain: below(10), result: 'B' });
  assert.notEqual(r.status, 'ORDERED');
});

test('boundary openness alone is a strict containment, and is ordered', () => {
  // n < 10 strictly contains n < 10 inclusive? No - the inclusive one is WIDER.
  const r = orderRequested(
    { id: 'inclusive', domain: iv(-Infinity, 10, true, false), result: 'I' },
    { id: 'exclusive', domain: iv(-Infinity, 10, true, true), result: 'E' });
  assert.equal(r.status, 'ORDERED');
  assert.equal(r.first, 'exclusive', 'the exclusive domain is the narrower one');
  assert.equal(r.witness.input, 9, 'witnessed on a value inside both');
});

test('NEGATIVE CONTROL: a deriver that always ORDERS fails the decline cases', () => {
  const always = () => ({ status: 'ORDERED', first: 'a', second: 'b' });
  const declineCases = [
    [{ id: 'low', domain: below(10), result: 'L' }, { id: 'high', domain: above(0), result: 'H' }],
    [{ id: 'low', domain: below(0), result: 'L' }, { id: 'high', domain: above(100), result: 'H' }],
  ];
  for (const [a, b] of declineCases) {
    assert.equal(always(a, b).status, 'ORDERED');
    assert.notEqual(orderRequested(a, b).status, 'ORDERED',
      'the real deriver must decline where a permissive one would not');
  }
});

test('NEGATIVE CONTROL: a deriver that never ORDERS fails the containment cases', () => {
  const never = () => ({ status: 'UNDETERMINED' });
  const a = { id: 'small', domain: below(10), result: 'S' };
  const b = { id: 'tiny', domain: below(0), result: 'T' };
  assert.notEqual(never(a, b).status, 'ORDERED');
  assert.equal(orderRequested(a, b).status, 'ORDERED');
});

test('strictlyContains never claims containment it cannot witness', () => {
  assert.equal(strictlyContains(below(10), below(10)), null, 'equal domains');
  assert.equal(strictlyContains(below(0), below(10)), null, 'narrower does not contain wider');
  assert.equal(strictlyContains(above(0), below(10)), null, 'neither contains the other');
  const c = strictlyContains(below(10), below(0));
  assert.ok(c && containsPoint(below(0), c.inside) && !containsPoint(below(0), c.outsideInner));
  assert.ok(containsPoint(below(10), c.outsideInner), 'the outside witness must still be in the wider domain');
});

test('an unmodelled domain is never ordered', () => {
  const r = orderRequested(
    { id: 'a', domain: { kind: 'unmodelled', text: 'something odd' }, result: 'A' },
    { id: 'b', domain: below(10), result: 'B' });
  assert.notEqual(r.status, 'ORDERED');
});
