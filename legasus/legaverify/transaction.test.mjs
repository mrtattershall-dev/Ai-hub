// THE CONTROL R4 EXISTS FOR: both operations individually correct, the composition wrong.
//
// This is the defect that makes multi-operation transactions a different problem rather than a bigger
// one. Two guards, each a perfect realization of its own obligation, compose into a program that
// LOADS, reads plausibly, contains every predicate and every result the specification asked for, and
// silently never produces one of the two behaviours. Nothing that inspects the fragments can see it.
//
// Every test below is written so that a verifier which only checked the fragments would fail it.
import test from 'node:test';
import assert from 'node:assert';
import { transactionProbes, reachability, transactionProbeValues } from './transaction.mjs';
import { containsPoint } from './probes.mjs';

const iv = (lo, hi, loOpen = true, hiOpen = true) => ({ kind: 'interval', variable: 'n', lo, hi, loOpen, hiOpen });
const below = (v) => iv(-Infinity, v);
const above = (v) => iv(v, Infinity);

// classify: n == 3 -> three ; n > 100000 -> vast ; else other
const original = (n) => (n === 3 ? 'three' : n > 100000 ? 'vast' : 'other');

const SMALL = { id: 'small', domain: below(10), result: 'small' };
const TINY = { id: 'tiny', domain: below(0), result: 'tiny' };
const BIG = { id: 'big', domain: above(100), result: 'big' };

const CONTRACT = {
  requested: [SMALL, TINY],
  order: ['tiny', 'small'],           // derived: the contained domain first
  preserved: { kind: 'point', variable: 'n', value: 3 },
  preservedWins: true,
  existing: [{ domain: { kind: 'point', variable: 'n', value: 3 } },
    { domain: above(100000) }],
};

// A candidate program, expressed as the ordered list of guards that were actually committed.
const run = (guards) => (n) => {
  if (n === 3) return 'three';
  for (const [pred, res] of guards) if (pred(n)) return res;
  if (n > 100000) return 'vast';
  return 'other';
};

const check = (probes, fn) => probes.filter((p) => fn(p.input) !== p.expected);

test('THE R4 CONTROL: both operations correct, composition wrong, and it is caught', () => {
  const probes = transactionProbes(CONTRACT, original);

  const correct = run([[(n) => n < 0, 'tiny'], [(n) => n < 10, 'small']]);
  assert.equal(check(probes, correct).length, 0, 'the correctly ordered composition must pass');

  // Same two fragments. Reversed. Each is individually a perfect realization of its obligation.
  const reversed = run([[(n) => n < 10, 'small'], [(n) => n < 0, 'tiny']]);
  const failures = check(probes, reversed);
  assert.ok(failures.length > 0, 'the reversed composition must be caught');
  assert.ok(failures.every((f) => f.input < 0), 'it must fail exactly where tiny is shadowed: '
    + JSON.stringify(failures.slice(0, 3)));
});

test('the wrong composition LOADS and contains every requested predicate and result', () => {
  // Stated explicitly because it is the reason fragment-level checking cannot find this defect.
  const reversed = run([[(n) => n < 10, 'small'], [(n) => n < 0, 'tiny']]);
  assert.equal(typeof reversed(-5), 'string', 'it runs');
  assert.equal(reversed(3), 'three', 'the preserved behaviour survives');
  assert.equal(reversed(5), 'small', 'one requested behaviour is present and correct');
  assert.equal(reversed(-5), 'small', 'and the other is silently gone - this is the whole defect');
});

test('REACHABILITY reports the dead operation by name, separately from probe failures', () => {
  const good = reachability(CONTRACT);
  assert.ok(good.allReachable, 'the derived order must leave both operations reachable');

  const bad = reachability({ ...CONTRACT, order: ['small', 'tiny'] });
  assert.equal(bad.allReachable, false);
  assert.deepEqual(bad.dead, ['tiny'], 'it must name WHICH operation is dead');
});

test('the preserved behaviour still wins over both new ones', () => {
  const probes = transactionProbes(CONTRACT, original);
  const p = probes.find((x) => x.input === 3);
  assert.equal(p.expected, 'three');
  // A composition that lets a new guard take the preserved input must fail even if ordered correctly.
  const greedy = run([[(n) => n <= 3, 'tiny'], [(n) => n < 10, 'small']]);
  assert.ok(check(probes, greedy).length > 0);
});

test('DISJOINT operations verify under BOTH orders - the transaction anti-oracle', () => {
  const disjoint = { ...CONTRACT, requested: [TINY, BIG], order: ['tiny', 'big'] };
  const other = { ...disjoint, order: ['big', 'tiny'] };
  const fn = run([[(n) => n < 0, 'tiny'], [(n) => n > 100, 'big']]);
  const flipped = run([[(n) => n > 100, 'big'], [(n) => n < 0, 'tiny']]);
  for (const [name, contract, impl] of [['as derived', disjoint, fn], ['reversed', other, flipped]]) {
    assert.equal(check(transactionProbes(contract, original), impl).length, 0,
      name + ' must verify: neither can shadow the other, so both orders are legal');
  }
  assert.ok(reachability(disjoint).allReachable && reachability(other).allReachable);
});

test('probe values interrogate the INNER domain boundary, which neither domain alone names', () => {
  const vs = transactionProbeValues(CONTRACT);
  for (const v of [-1, 0, 1, 9, 10, 11]) assert.ok(vs.includes(v), 'missing probe ' + v);
  assert.ok(vs.some((v) => v <= -100), 'deep interior for the open end');
});

test('REFUSES to verify a partly specified composition', () => {
  assert.throws(() => transactionProbes({ ...CONTRACT, order: ['tiny'] }, original),
    /partly specified/);
  assert.throws(() => transactionProbes({ ...CONTRACT, order: ['tiny', 'nope'] }, original),
    /not in the transaction/);
});

test('NEGATIVE CONTROL: a verifier that checks only the fragments passes the broken composition', () => {
  // The fragment-level check: does each requested predicate and result appear somewhere?
  const fragmentsOnly = (guards) => guards.some(([, r]) => r === 'tiny')
    && guards.some(([, r]) => r === 'small');
  const reversedGuards = [[(n) => n < 10, 'small'], [(n) => n < 0, 'tiny']];
  assert.ok(fragmentsOnly(reversedGuards),
    'a fragment-level checker sees nothing wrong - which is why this module exists');
  const probes = transactionProbes(CONTRACT, original);
  assert.ok(check(probes, run(reversedGuards)).length > 0, 'and the transaction probes do');
});

test('NEGATIVE CONTROL: a probe set that never fails would pass the reversed composition', () => {
  const vacuous = [];
  assert.equal(check(vacuous, run([[(n) => n < 10, 'small'], [(n) => n < 0, 'tiny']])).length, 0,
    'an empty probe set proves nothing, which is why the real one is asserted to be non-empty');
  assert.ok(transactionProbes(CONTRACT, original).length >= 10);
});

test('containsPoint agrees with the probe expectations it is built on', () => {
  assert.ok(containsPoint(below(0), -1) && containsPoint(below(10), -1));
  assert.ok(!containsPoint(below(0), 5) && containsPoint(below(10), 5));
});
