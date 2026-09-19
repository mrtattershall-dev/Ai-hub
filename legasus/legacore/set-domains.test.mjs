// SET DOMAINS — the second domain kind, and the first real generalization pressure on DECIDE.
//
// Every claim in this program so far rests on integer INTERVALS over one function shape. Intervals make
// containment easy and leave one relation nearly unreachable: two intervals that overlap without nesting
// are unusual in a specification, so `UNDETERMINED` has been exercised mostly by construction.
//
// Finite sets express all three relations naturally, and are not intervals in disguise - {1, 5, 9} has
// no lo/hi that describes it:
//
//     {1,3,5} vs {3,5}     CONTAINMENT      the subset must win where they overlap
//     {1,3}   vs {5,7}     DISJOINT         any order is legal
//     {1,3}   vs {3,5}     INTERSECTING     neither contains the other - must be REFUSED
import test from 'node:test';
import assert from 'node:assert';
import { parseCondition, requestedBehaviour, containsPoint } from './predicates.mjs';
import { strictlyContains, orderRequested, orderTransaction } from './ordering.mjs';
import { containsPoint as probesContainsPoint, probeValues, auditProbeSet } from '../legaverify/probes.mjs';

const dom = (s) => parseCondition(s);
const req = (id, cond, result) => ({ id, domain: dom(cond), result });

test('ONE canonical membership predicate, not two that agree today', () => {
  // This file exists because the duplicate silently returned false for every set. Asserting agreement on
  // examples would pass again the next time the kinds diverge; asserting IDENTITY cannot.
  assert.equal(containsPoint, probesContainsPoint,
    'legacore and legaverify must import the same function, not keep two in step by discipline');
});

test('a set parses, and is not coerced into an interval', () => {
  const d = dom('n in (1, 5, 9)');
  assert.equal(d.kind, 'set');
  assert.deepEqual(d.values, [1, 5, 9]);
  assert.equal(d.lo, undefined, 'a set must not acquire bounds');
  for (const [v, want] of [[1, true], [5, true], [9, true], [2, false], [6, false], [0, false], [10, false]]) {
    assert.equal(containsPoint(d, v), want, 'membership at ' + v);
  }
});

test('spelling does not change the domain', () => {
  const a = dom('n in (5, 1, 9, 5)');
  const b = dom('n in [1, 5, 9]');
  const c = dom('n in {9, 5, 1}');
  assert.deepEqual(a.values, [1, 5, 9]);
  assert.deepEqual(a.values, b.values);
  assert.deepEqual(b.values, c.values);
});

test('prose names a set too, and a non-set stays unmodelled', () => {
  // The subject must sit directly against the membership word. "values THAT ARE one of 1, 3 and 5" puts
  // `are` in the subject slot and is correctly DECLINED rather than guessed at - the renderer is the
  // thing that must say it plainly, which is exactly the division this project keeps arriving at.
  for (const text of ['For values among 1, 3 and 5, return "odd".',
    'For values one of 1, 3 and 5, return "odd".',
    'For values in 1, 3 and 5, return "odd".']) {
    const r = requestedBehaviour(text, 'n', { soleParameter: true });
    assert.equal(r.domain.kind, 'set', text);
    assert.deepEqual(r.domain.values, [1, 3, 5], text);
    assert.equal(r.result, '"odd"');
  }
  const declined = requestedBehaviour('For values that are one of 1, 3 and 5, return "odd".', 'n',
    { soleParameter: true });
  assert.equal(declined.domain.kind, 'unmodelled',
    'an unrecognised subject must be declined, not bound to the sole parameter by hope');

  // Anything this parser cannot model must say so rather than invent a domain.
  assert.equal(dom('n in (a, b)').kind, 'unmodelled');
  assert.equal(dom('n in ()').kind, 'unmodelled');
  assert.equal(dom('n in (1, x, 3)').kind, 'unmodelled',
    'one non-numeric member makes the whole set unmodelled rather than partly read');
});

test('CONTAINMENT — a proper subset is ordered first, with real member witnesses', () => {
  const r = strictlyContains(dom('n in (1, 3, 5)'), dom('n in (3, 5)'));
  assert.ok(r, 'the subset must be recognised');
  assert.ok(containsPoint(dom('n in (3, 5)'), r.inside));
  assert.equal(containsPoint(dom('n in (3, 5)'), r.outsideInner), false);
  assert.ok(containsPoint(dom('n in (1, 3, 5)'), r.outsideInner));

  const o = orderRequested(req('wide', 'n in (1, 3, 5)', 'wide'), req('narrow', 'n in (3, 5)', 'narrow'));
  assert.equal(o.status, 'ORDERED');
  assert.equal(o.first, 'narrow');
});

test('EQUAL sets are containment but not STRICT containment, so no order is derivable', () => {
  assert.equal(strictlyContains(dom('n in (1, 3)'), dom('n in (3, 1)')), null);
  const o = orderRequested(req('a', 'n in (1, 3)', 'a'), req('b', 'n in (1, 3)', 'b'));
  assert.notEqual(o.status, 'ORDERED', 'identical domains cannot yield a precedence');
});

test('DISJOINT sets are not ordered — both orders are legal', () => {
  const o = orderRequested(req('a', 'n in (1, 3)', 'a'), req('b', 'n in (5, 7)', 'b'));
  assert.equal(o.status, 'DISJOINT');
});

test('INTERSECTING WITHOUT CONTAINMENT is REFUSED, and this is the relation sets exist to reach', () => {
  const o = orderRequested(req('a', 'n in (1, 3)', 'a'), req('b', 'n in (3, 5)', 'b'));
  assert.equal(o.status, 'UNDETERMINED');
  assert.ok(o.blocking || o.witness || o.reason, 'a refusal must say what blocked it');
  // And one such pair poisons the whole transaction rather than being quietly ordered.
  const t = orderTransaction([req('a', 'n in (1, 3)', 'a'), req('b', 'n in (3, 5)', 'b'),
    req('c', 'n in (9)', 'c')]);
  assert.equal(t.status, 'UNDETERMINED');
  assert.equal(t.order, undefined);
});

test('a set inside an INTERVAL orders correctly — the kinds mix', () => {
  const o = orderRequested(req('wide', 'n < 10', 'wide'), req('members', 'n in (1, 3, 5)', 'members'));
  assert.equal(o.status, 'ORDERED');
  assert.equal(o.first, 'members', 'the set is strictly inside n < 10, so it must come first');
});

test('a set containing a POINT orders the point first', () => {
  const o = orderRequested(req('set', 'n in (1, 3, 5)', 'set'), req('pt', 'n == 3', 'pt'));
  assert.equal(o.status, 'ORDERED');
  assert.equal(o.first, 'pt');
});

test('a three-operation set transaction derives a total order', () => {
  const t = orderTransaction([req('wide', 'n in (1, 3, 5, 7)', 'wide'),
    req('mid', 'n in (3, 5)', 'mid'), req('narrow', 'n in (3)', 'narrow')]);
  assert.equal(t.status, 'ORDERED');
  assert.deepEqual(t.order, ['narrow', 'mid', 'wide']);
});

test('PROBES for a set interrogate the NON-members beside each member', () => {
  // A guard that widened `n in (1, 5, 9)` into `1 <= n <= 9` satisfies every member. Only a probe at a
  // gap can see it, which is the same argument as probing beyond an unbounded end.
  const vs = probeValues({ requested: dom('n in (1, 5, 9)') });
  for (const m of [1, 5, 9]) assert.ok(vs.includes(m), 'member ' + m + ' must be probed');
  for (const gap of [2, 4, 6, 8]) assert.ok(vs.includes(gap), 'gap ' + gap + ' must be probed');
});

test('the audit REFUSES a set probe set that could not see a widened guard', () => {
  const d = dom('n in (1, 5, 9)');
  assert.deepEqual(auditProbeSet(d, [1, 5, 9]).length > 0, true,
    'members only cannot distinguish the set from the range that spans it');
  assert.match(auditProbeSet(d, [1, 5, 9]).join(' '), /immediately beside a member/);
  assert.deepEqual(auditProbeSet(d, [1, 2, 5, 9]), [], 'a gap probe makes it sufficient');
  assert.match(auditProbeSet(d, [1, 2, 5]).join(' '), /member 9 is never probed/);
});

test('NEGATIVE CONTROL — the widened guard really is wrong, by execution', async () => {
  // Proving the probe argument on the artifact rather than asserting it: the range answers correctly on
  // every member and differs at a gap.
  const inSet = (v) => [1, 5, 9].includes(v);
  const asRange = (v) => v >= 1 && v <= 9;
  for (const m of [1, 5, 9]) assert.equal(inSet(m), asRange(m), 'they agree on members');
  assert.notEqual(inSet(4), asRange(4), 'and disagree in a gap, which is why the gap is probed');
});
