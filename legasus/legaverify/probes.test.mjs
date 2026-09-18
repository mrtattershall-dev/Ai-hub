// The two ways this module could be worthless, and a test for each:
//
//   IT ADMITS EVERYTHING     a probe set that no realization fails proves nothing. The mutants below
//                            must all die, INCLUDING `0 < n < 10`, which is the realization that
//                            nearly fooled the hand-built probe set in the scale experiment.
//
//   IT REJECTS EVERYTHING    an adversary that also kills the CORRECT realizations is worse than no
//                            adversary, because it destroys the anti-oracle property this project
//                            spent several windows establishing: a contract must admit more than one
//                            implementation.
//
// The mutants are written here WITHOUT consulting which ones any model actually produced, except for
// `0 < n < 10`, which is included precisely because it is the one a regression-style probe set missed.
import test from 'node:test';
import assert from 'node:assert';
import { contractProbes, probeValues, checkProbes, containsPoint } from './probes.mjs';

// The window-11 task family, as a pure function of the program's semantics.
// classify: n == P -> label; n > 10000 -> enormous; n > 1000 -> huge; n > 100 -> large; else other.
const makeOriginal = (P, label) => (n) => {
  if (n === P) return label;
  if (n > 10000) return 'enormous';
  if (n > 1000) return 'huge';
  if (n > 100) return 'large';
  return 'other';
};

// The contract: "for values below T, return small", preserving the existing handling of P.
const contractFor = (T, P) => ({
  requested: { kind: 'interval', variable: 'n', lo: -Infinity, hi: T, loOpen: true, hiOpen: true },
  requestedResult: 'small',
  preserved: { kind: 'point', variable: 'n', value: P },
  preservedWins: true,
  existing: [
    { domain: { kind: 'point', variable: 'n', value: P } },
    { domain: { kind: 'interval', variable: 'n', lo: 10000, hi: Infinity, loOpen: true, hiOpen: true } },
    { domain: { kind: 'interval', variable: 'n', lo: 1000, hi: Infinity, loOpen: true, hiOpen: true } },
    { domain: { kind: 'interval', variable: 'n', lo: 100, hi: Infinity, loOpen: true, hiOpen: true } },
  ],
});

// Candidate realizations, expressed as the guard inserted AFTER the preserved guard.
const realize = (P, label, guard) => (n) => {
  if (n === P) return label;
  if (guard(n)) return 'small';
  if (n > 10000) return 'enormous';
  if (n > 1000) return 'huge';
  if (n > 100) return 'large';
  return 'other';
};

const TASKS = [[10, 0, 'zero'], [10, 3, 'three'], [20, 5, 'five'], [0, -2, 'minus two']];

test('the boundary triple the contract demands is present, for every task', () => {
  for (const [T, P] of TASKS) {
    const vs = probeValues(contractFor(T, P));
    for (const v of [T - 1, T, T + 1, P - 1, P, P + 1]) {
      assert.ok(vs.includes(v), 'task T=' + T + ' P=' + P + ' is missing the probe ' + v);
    }
  }
});

test('the unbounded end is probed deeply, which is where an invented bound hides', () => {
  const vs = probeValues(contractFor(10, 0));
  assert.ok(vs.some((v) => v <= -100), 'no probe far below the threshold: ' + JSON.stringify(vs));
  assert.ok(vs.some((v) => v <= -10000), 'nothing deep enough to catch a large invented lower bound');
});

test('ADMITS: both correct realizations pass every probe, for every task', () => {
  for (const [T, P, label] of TASKS) {
    const c = contractFor(T, P);
    const probes = contractProbes(c, makeOriginal(P, label));
    for (const [name, guard] of [
      ['plain', (n) => n < T],
      ['with exclusion', (n) => n < T && n !== P],
    ]) {
      const r = checkProbes(probes, realize(P, label, guard));
      assert.ok(r.passed, 'T=' + T + ' P=' + P + ' ' + name + ' was rejected: '
        + JSON.stringify(r.failures.slice(0, 3)));
    }
  }
});

test('KILLS the realization that nearly fooled the hand-built probe set', () => {
  for (const [T, P, label] of TASKS) {
    const c = contractFor(T, P);
    const probes = contractProbes(c, makeOriginal(P, label));
    // `0 < n < T` - idiomatic, confident, and inventing a lower bound the contract never stated.
    const r = checkProbes(probes, realize(P, label, (n) => n > 0 && n < T));
    assert.ok(!r.passed, 'T=' + T + ' P=' + P + ': `0 < n < T` survived the contract probes');
    assert.ok(r.failures.some((f) => f.input < 0 || f.input === 0),
      'it must die on a non-positive input, got ' + JSON.stringify(r.failures.slice(0, 2)));
  }
});

test('KILLS every other mutant, none of which any model was consulted about', () => {
  const [T, P, label] = [10, 3, 'three'];
  const c = contractFor(T, P);
  const probes = contractProbes(c, makeOriginal(P, label));
  const mutants = {
    'off by one (n <= T)': (n) => n <= T,
    'inverted (n > T)': (n) => n > T,
    'wrong threshold (n < 100)': (n) => n < 100,
    'excludes the wrong value': (n) => n < T && n !== P + 1,
    'invented large lower bound': (n) => n > -50 && n < T,
    'only the neighbourhood': (n) => n >= P - 1 && n <= P + 1,
    'never fires': () => false,
    'always fires': () => true,
  };
  for (const [name, guard] of Object.entries(mutants)) {
    const r = checkProbes(probes, realize(P, label, guard));
    assert.ok(!r.passed, name + ' survived the contract probes');
  }
});

test('the preserved value is expected to KEEP its old result, not the new one', () => {
  const c = contractFor(10, 3);
  const probes = contractProbes(c, makeOriginal(3, 'three'));
  const p = probes.find((x) => x.input === 3);
  assert.equal(p.expected, 'three');
  assert.match(p.why, /preserved behaviour wins/);
});

test('when precedence says the REQUESTED behaviour wins, the expectation flips', () => {
  const c = { ...contractFor(10, 3), preservedWins: false };
  const probes = contractProbes(c, makeOriginal(3, 'three'));
  assert.equal(probes.find((x) => x.input === 3).expected, 'small');
});

test('expectations outside the requested domain come from the ORIGINAL program', () => {
  const c = contractFor(10, 0);
  const probes = contractProbes(c, makeOriginal(0, 'zero'));
  for (const [input, want] of [[101, 'large'], [1001, 'huge'], [10001, 'enormous'], [11, 'other']]) {
    const p = probes.find((x) => x.input === input);
    assert.ok(p, 'no probe at ' + input);
    assert.equal(p.expected, want, 'probe ' + input);
  }
});

test('containsPoint handles each domain kind', () => {
  assert.ok(containsPoint({ kind: 'point', value: 3 }, 3));
  assert.ok(!containsPoint({ kind: 'point', value: 3 }, 4));
  assert.ok(containsPoint({ kind: 'complement_point', value: 3 }, 4));
  assert.ok(containsPoint({ kind: 'universe' }, 99));
  assert.ok(containsPoint({ kind: 'interval', lo: -Infinity, hi: 10, loOpen: true, hiOpen: true }, 9));
  assert.ok(!containsPoint({ kind: 'interval', lo: -Infinity, hi: 10, loOpen: true, hiOpen: true }, 10));
  assert.ok(containsPoint({ kind: 'interval', lo: -Infinity, hi: 10, loOpen: true, hiOpen: false }, 10));
  assert.ok(!containsPoint({ kind: 'unmodelled', text: 'x' }, 1));
});
