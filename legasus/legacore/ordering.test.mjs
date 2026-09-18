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

// ---- N OPERATIONS. The pair tests above establish the relation; these establish the sort.
import { orderTransaction } from './ordering.mjs';

const op = (id, domain, result) => ({ id, domain, result });

test('THREE NESTED: the sort is innermost first', () => {
  const r = orderTransaction([
    op('mid', below(100), 'mid'), op('micro', below(0), 'micro'), op('low', below(10), 'low')]);
  assert.equal(r.status, 'ORDERED');
  assert.deepEqual(r.order, ['micro', 'low', 'mid']);
  assert.equal(r.orderBasis, 'DERIVED', 'fully nested leaves no tie to break');
});

test('THREE NESTED: the sort does not depend on presentation order', () => {
  const a = orderTransaction([op('micro', below(0), 'm'), op('low', below(10), 'l'), op('mid', below(100), 'd')]);
  const b = orderTransaction([op('mid', below(100), 'd'), op('low', below(10), 'l'), op('micro', below(0), 'm')]);
  assert.deepEqual(a.order, b.order);
});

test('MIXED: a disjoint operation is placed by ENGINEERING CHOICE, and the label says so', () => {
  const r = orderTransaction([
    op('micro', below(0), 'm'), op('low', below(10), 'l'), op('big', above(100), 'b')]);
  assert.equal(r.status, 'ORDERED');
  assert.ok(r.order.indexOf('micro') < r.order.indexOf('low'), 'the derived constraint must hold');
  assert.equal(r.orderBasis, 'DERIVED_WITH_ENGINEERING_CHOICE');
  assert.ok(r.ties.length > 0, 'the tie must be recorded rather than silently resolved');
});

test('ONE UNDETERMINED PAIR POISONS THE WHOLE TRANSACTION', () => {
  const r = orderTransaction([
    op('micro', below(0), 'm'), op('low', below(10), 'l'), op('plus', above(0), 'p')]);
  assert.equal(r.status, 'UNDETERMINED');
  assert.equal(r.order, null);
  assert.ok(r.blocking, 'it must name WHICH pair blocked it');
  assert.match(r.reason, /different change from the one requested/,
    'and say why partial commitment is not an option');
});

test('every operation appears exactly once in the order', () => {
  const ids = ['micro', 'low', 'mid'];
  const r = orderTransaction([op('mid', below(100), 'd'), op('micro', below(0), 'm'), op('low', below(10), 'l')]);
  assert.deepEqual([...r.order].sort(), [...ids].sort());
  assert.equal(new Set(r.order).size, r.order.length);
});

test('NEGATIVE CONTROL: a sorter that returns presentation order fails the nested case', () => {
  const presented = [op('mid', below(100), 'd'), op('micro', below(0), 'm'), op('low', below(10), 'l')];
  const naive = presented.map((x) => x.id);
  assert.deepEqual(naive, ['mid', 'micro', 'low']);
  assert.notDeepEqual(orderTransaction(presented).order, naive,
    'the real sorter must disagree with presentation order, or it is not sorting');
});

test('NEGATIVE CONTROL: a sorter that never declines fails the undetermined case', () => {
  const always = () => ({ status: 'ORDERED', order: ['a', 'b', 'c'] });
  const undeterminable = [op('micro', below(0), 'm'), op('low', below(10), 'l'), op('plus', above(0), 'p')];
  assert.equal(always().status, 'ORDERED');
  assert.equal(orderTransaction(undeterminable).status, 'UNDETERMINED');
});

test('the pairwise relations are reported, so the order can be audited rather than trusted', () => {
  const r = orderTransaction([op('micro', below(0), 'm'), op('low', below(10), 'l'), op('mid', below(100), 'd')]);
  assert.equal(r.pairs.length, 3, 'every pair of three operations');
  assert.ok(r.pairs.every((p) => p.status === 'ORDERED'));
  assert.ok(r.pairs.every((p) => p.witness && Number.isFinite(p.witness.input)),
    'each derived relation carries a witness input');
});
