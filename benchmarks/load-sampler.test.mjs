// Tests for the shared load sampler.
//
// NON-VACUITY FIRST: a ceiling that can never breach, or a verdict that can never say NOT OK, would pass
// every suite and protect nothing. Every property below has a control that fails in the other direction.
import test from 'node:test';
import assert from 'node:assert';
import { sample, verdict, UNMEASURED, SUSPECT_ZERO } from './load-sampler.mjs';

const S = (n, at = '2026-09-20T13:00:00.000Z') => ({ at, nodeProcs: n, cpuPct: null });

test('sample() returns a real count, cheaply, and never throws', () => {
  const t = Date.now();
  const s = sample();
  const ms = Date.now() - t;
  assert.match(s.at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(s.error, undefined, 'the instrument worked: ' + JSON.stringify(s));
  // THE CALLER IS ITSELF A NODE PROCESS, so a correct count is at least 1. This is what makes a zero
  // detectable as instrument failure rather than as quiet.
  assert.ok(s.nodeProcs >= 1, 'counted ' + s.nodeProcs + ', but this process is node');
  assert.ok(ms < 8000, 'sampling took ' + ms + 'ms; a slow sampler changes what it measures');
});

test('sample() is stable across back-to-back calls', () => {
  const a = sample();
  const b = sample();
  assert.ok(Math.abs(a.nodeProcs - b.nodeProcs) <= 3,
    'counts ' + a.nodeProcs + ' and ' + b.nodeProcs + ' differ implausibly for adjacent samples');
});

test('verdict OK below the ceiling — the positive control', () => {
  const v = verdict([S(4), S(7), S(9)], 40);
  assert.equal(v.ok, true, v.why);
  assert.equal(v.worst, 9);
  assert.deepEqual(v.breachedAt, []);
});

test('verdict NOT OK above the ceiling, and names WHERE it breached', () => {
  const v = verdict([S(4, 'a'), S(88, 'b'), S(7, 'c')], 40);
  assert.equal(v.ok, false);
  assert.equal(v.worst, 88);
  assert.equal(v.breachedAt.length, 1);
  assert.equal(v.breachedAt[0].at, 'b');
  assert.match(v.why, /UNOBSERVABLE \(load\)/);
});

test('THE CENTRAL PROPERTY — a failed sample is NOT a low sample', () => {
  const failed = { at: 'x', nodeProcs: null, cpuPct: null, error: 'tasklist: ERROR: Invalid argument' };
  const v = verdict([S(4), failed, S(6)], 40);
  assert.equal(v.ok, false, 'an instrument that could not measure is not a quiet machine');
  assert.equal(v.unmeasured.length, 1);
  assert.match(v.why, /did not measure/);

  // the control: the SAME samples with a working instrument in that slot DO pass, so this is not
  // failing for some unrelated reason
  assert.equal(verdict([S(4), S(5), S(6)], 40).ok, true);
});

test('A ZERO IS SUSPECT, not quiet — the Git Bash failure mode, reproduced', () => {
  // `tasklist /FI ... | grep -c node.exe` under MSYS yields 0, not an error. A sampler that trusted it
  // would certify a machine running 263 processes as clean.
  const v = verdict([S(0)], 40);
  assert.equal(v.ok, false, 'zero node processes is impossible: the caller is node');
  assert.equal(v.unmeasured[0].reason, SUSPECT_ZERO);
});

test('no samples at all is NOT OK — an unmeasured run is UNOBSERVABLE, not clean', () => {
  const v = verdict([], 40);
  assert.equal(v.ok, false);
  assert.match(v.why, /no samples/);
});

test('verdict is a PURE function of frozen inputs', () => {
  const samples = [S(4), S(88)];
  const a = verdict(samples, 40);
  const b = verdict(samples, 40);
  assert.deepEqual(a, b, 'same inputs, same verdict - nothing read from the clock or the machine');

  // and the ceiling genuinely decides: the same samples pass under a looser frozen ceiling, which is why
  // it must be frozen BEFORE the run rather than chosen after seeing the number
  assert.equal(verdict(samples, 200).ok, true);
  assert.equal(verdict(samples, 40).ok, false);
});

test('the real instrument composes with the real verdict', () => {
  const samples = [sample(), sample()];
  const v = verdict(samples, 10000);
  assert.equal(v.ok, true, 'a live sample under an absurd ceiling must pass: ' + v.why);
  // NON-VACUITY: the same live samples must FAIL under a ceiling of zero, or this test proves nothing
  assert.equal(verdict(samples, 0).ok, false, 'a live sample under a zero ceiling must fail');
});
