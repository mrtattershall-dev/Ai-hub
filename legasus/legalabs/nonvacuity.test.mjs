// NON-VACUITY — including a REPLAY of the exact incident that produced it.
//
// The set family's leak checker reported ZERO LEAKS while every evaluation threw. The decisive test here
// is therefore not "does the helper count correctly" but "would it have refused THAT run".
import test from 'node:test';
import assert from 'node:assert';
import { makeTally, observed, unobservable, finding, nonVacuous, conclude, coverageLine }
  from './nonvacuity.mjs';

const clean = 'ZERO LEAKS.';
const dirty = (n) => n + ' LEAK(S).';

test('REPLAY — the incident: every examination fails, and the null is REFUSED', () => {
  // 28 distinct guards, every one a syntax error, zero findings recorded.
  const t = makeTally('leak-sets');
  for (let i = 0; i < 28; i++) unobservable(t, 'IndentationError: unexpected indent');
  assert.equal(t.findings, 0, 'the original reported no findings, which is the trap');
  const v = nonVacuous(t);
  assert.equal(v.ok, false);
  assert.match(v.why, /indistinguishable from/);
  const r = conclude(t, { clean, dirty });
  assert.equal(r.ok, false);
  assert.equal(r.vacuous, true);
  assert.ok(!r.text.includes('ZERO LEAKS'), 'it must not be able to print the clean conclusion');
  assert.match(r.text, /REFUSING TO REPORT/);
});

test('a genuinely clean run reports clean — the helper must not refuse everything', () => {
  // The negative control for the guard itself: one that always refused would pass the replay above and
  // be useless.
  const t = makeTally('leak-sets');
  for (let i = 0; i < 28; i++) observed(t);
  const v = nonVacuous(t);
  assert.equal(v.ok, true, JSON.stringify(v));
  const r = conclude(t, { clean, dirty });
  assert.equal(r.ok, true);
  assert.match(r.text, /ZERO LEAKS/);
  assert.match(r.text, /attempted 28   observed 28   unobservable 0/);
});

test('findings are reported when there are findings', () => {
  const t = makeTally('x');
  for (let i = 0; i < 10; i++) observed(t);
  finding(t); finding(t);
  const r = conclude(t, { clean, dirty });
  assert.equal(r.ok, true);
  assert.match(r.text, /2 LEAK\(S\)/);
});

test('ONE unobservable item among many poisons the null — no partial credit', () => {
  const t = makeTally('x');
  for (let i = 0; i < 99; i++) observed(t);
  unobservable(t, 'could not run');
  const v = nonVacuous(t);
  assert.equal(v.ok, false, '99 of 100 is not a proven observation');
  assert.match(v.why, /1 of 100/);
});

test('nothing attempted is vacuous, not clean', () => {
  const t = makeTally('empty');
  const v = nonVacuous(t);
  assert.equal(v.ok, false);
  assert.match(v.why, /nothing was attempted/);
  assert.equal(conclude(t, { clean, dirty }).ok, false);
});

test('a missing tally is a refusal, not a pass', () => {
  assert.equal(nonVacuous(undefined).ok, false);
  assert.equal(nonVacuous({}).ok, false);
});

test('coverage is printed BEFORE the conclusion, in both outcomes', () => {
  const good = makeTally('a'); observed(good);
  const bad = makeTally('b'); unobservable(bad, 'x');
  for (const t of [good, bad]) {
    const r = conclude(t, { clean, dirty });
    const lines = r.text.split(String.fromCharCode(10));
    assert.match(lines[0], /^  COVERAGE/, 'coverage must come first, or a clean number gets read first');
  }
  assert.match(coverageLine(good), /attempted 1   observed 1   unobservable 0/);
});

test('an unaccounted gap between attempted and observed is refused', () => {
  // Defends against a caller that increments attempted directly and forgets to record the outcome.
  const t = makeTally('x');
  t.attempted = 5; t.observed = 3; t.failed = 0;
  const v = nonVacuous(t);
  assert.equal(v.ok, false);
  assert.match(v.why, /unaccounted/);
});
