// The dangerous failure for an interaction test is firing on MAIN EFFECTS. A test that reports an
// interaction whenever one cell is high would have "confirmed" every subgroup difference this project
// has ever looked at, including the one window 8 just showed was an artifact of reading a null too
// hard. So the load-bearing test here is the negative one: large main effects, no interaction.
import test from 'node:test';
import assert from 'node:assert';
import { interactionTest, chiSqP1 } from './interaction.mjs';

test('NEGATIVE CONTROL: big main effects, equal odds ratios -> no interaction', () => {
  // arm doubles the odds in both windows; window shifts the baseline a lot. Odds ratios identical.
  const r = interactionTest({ a00: 10, n00: 100, a01: 18, n01: 100,
    a10: 40, n10: 100, a11: 57, n11: 100 });
  assert.ok(r.p > 0.3, 'main effects alone must not produce an interaction, got p = ' + r.p.toFixed(4));
});

test('POSITIVE CONTROL: an effect in one stratum and none in the other -> interaction', () => {
  const r = interactionTest({ a00: 10, n00: 100, a01: 10, n01: 100,
    a10: 10, n10: 100, a11: 50, n11: 100 });
  assert.ok(r.p < 0.001, 'a present-here absent-there effect must register, got p = ' + r.p.toFixed(4));
  assert.ok(r.difference_in_differences > 0.35);
});

test('NO EFFECT ANYWHERE -> no interaction, and the statistic is near zero', () => {
  const r = interactionTest({ a00: 20, n00: 100, a01: 20, n01: 100,
    a10: 20, n10: 100, a11: 20, n11: 100 });
  assert.ok(r.p > 0.9, 'p = ' + r.p.toFixed(4));
  assert.ok(r.statistic < 0.01);
});

test('OPPOSITE-SIGN effects register strongly', () => {
  const r = interactionTest({ a00: 20, n00: 100, a01: 50, n01: 100,
    a10: 50, n10: 100, a11: 20, n11: 100 });
  assert.ok(r.p < 1e-6, 'p = ' + r.p);
});

test('the real window-8 cells, at their real sizes', () => {
  // repeated-forbidden-line: W1 OFF 4/40, W1 NEUTRAL 4/40, FULL OFF 5/40, FULL NEUTRAL 14/40
  const r = interactionTest({ a00: 4, n00: 40, a01: 4, n01: 40, a10: 5, n10: 40, a11: 14, n11: 40 });
  assert.ok(Number.isFinite(r.p), 'must produce a finite p at n = 40 per cell');
  assert.ok(r.difference_in_differences > 0.2);
});

test('an underpowered version of the same pattern must NOT be significant', () => {
  // the identical rates at a quarter of the sample: the test has to be able to say "cannot tell".
  const r = interactionTest({ a00: 1, n00: 10, a01: 1, n01: 10, a10: 1, n10: 10, a11: 3, n11: 10 });
  assert.ok(r.p > 0.1, 'small samples must not manufacture confidence, got p = ' + r.p.toFixed(4));
});

test('chi-square tail is calibrated at the usual landmarks', () => {
  assert.ok(Math.abs(chiSqP1(3.841) - 0.05) < 0.002, chiSqP1(3.841));
  assert.ok(Math.abs(chiSqP1(6.635) - 0.01) < 0.002, chiSqP1(6.635));
  assert.equal(chiSqP1(0), 1);
});
