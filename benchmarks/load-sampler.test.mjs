// Tests for the shared load sampler.
//
// NON-VACUITY FIRST: a ceiling that can never breach, or a verdict that can never say NOT OK, would pass
// every suite and protect nothing. Every property below has a control that fails in the other direction.
import test from 'node:test';
import assert from 'node:assert';
import { sample, verdict, calibrate, pids, newSince, UNMEASURED, SUSPECT_ZERO }
  from './load-sampler.mjs';

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

// ---------------------------------------------------------------------------------------------------
// CALIBRATION — the A2 shape frozen by the BIND-1 session: { ceiling, calibReferenceMs, calibRatio }.
// Count is a proxy; this measures contention directly. Every property has a control that fails the
// other way.

const SC = (ms, n = 10, at = 'x') => ({ at, nodeProcs: n, cpuPct: null, calibMs: ms });
const A2 = { ceiling: 40, calibReferenceMs: 35, calibRatio: 3.0 };   // cap = 105ms

test('calibrate() is SELF-WARMING at N>=2 — no separate warm-up burn needed', () => {
  // The first version of this module warmed with a 5e6 burn before measuring. That was redundant and
  // was itself self-load: a cold run can only ever be the MAX, so min-of-N with N>=2 discards it by
  // construction. Caught by the BIND-1 session; the burn now runs only for N<2.
  const first = calibrate();
  const second = calibrate();
  assert.ok(Number.isFinite(first) && first > 0, 'got ' + first);
  assert.ok(second < first * 3,
    'first ' + first + ' vs second ' + second + ' - if min-of-N were NOT self-warming, the first call'
    + ' would be dramatically slower than the second');
});

test('a calibration UNDER the cap passes — the positive control', () => {
  const v = verdict([SC(31), SC(40)], A2);
  assert.equal(v.ok, true, v.why);
  assert.equal(v.calib.capMs, 105);
  assert.equal(v.calib.worstMs, 40);
});

test('a calibration OVER the cap aborts, and names the ratio', () => {
  const v = verdict([SC(31), SC(420)], A2);
  assert.equal(v.ok, false);
  assert.equal(v.calib.overRatio.length, 1);
  assert.equal(v.calib.overRatio[0].ratio, 12);
  assert.match(v.why, /CONTENTION measured directly/);
});

test('THE DANGEROUS CASE — low process count, saturated machine', () => {
  // eight CPU-bound processes saturate eight cores and sail under a ceiling of 40. The count screen
  // cannot see this; the calibration can. This is the whole reason calibration exists.
  const v = verdict([SC(500, 8)], A2);
  assert.equal(v.ok, false, 'count 8 passes the ceiling, but the machine is saturated');
  assert.deepEqual(v.breachedAt, [], 'and the COUNT rule did not fire - only calibration caught it');
  assert.equal(v.calib.overRatio.length, 1);
});

test('A CALIBRATION THAT DID NOT RUN IS UNMEASURED, NEVER FAST', () => {
  for (const bad of [null, undefined, NaN]) {
    const v = verdict([SC(bad)], A2);
    assert.equal(v.ok, false, 'calibMs=' + String(bad) + ' must not pass');
    assert.match(v.unmeasured[0].reason, /calibration/);
  }
  // control: the same sample with a real calibration passes
  assert.equal(verdict([SC(31)], A2).ok, true);
});

test('BACKWARD COMPATIBLE — the count-only callers that predate calibration still work', () => {
  assert.equal(verdict([S(9)], 40).ok, true);
  assert.equal(verdict([S(99)], 40).ok, false);
  // and with the object form but no calibration keys, calibration is simply not checked
  assert.equal(verdict([SC(99999)], { ceiling: 40 }).ok, true, 'no reference frozen, no calibration rule');
});

test('the live instrument composes with the A2 verdict, and is non-vacuous', () => {
  const s = sample();
  assert.ok(Number.isFinite(s.calibMs), 'live sample carries a calibration: ' + JSON.stringify(s));
  assert.equal(verdict([s], { ceiling: 100000, calibReferenceMs: 35, calibRatio: 1000 }).ok, true);
  // NON-VACUITY: the same live sample must FAIL under an impossible ratio
  assert.equal(verdict([s], { ceiling: 100000, calibReferenceMs: 0.001, calibRatio: 1.0 }).ok, false);
});

test('sample() takes a label, and calib:false skips the burn a caller does not need', () => {
  const labelled = sample('discover:auth.test');
  assert.equal(labelled.where, 'discover:auth.test', 'a string argument is the label, not ignored');
  assert.ok(Number.isFinite(labelled.calibMs), 'calibration on by default');

  const t = Date.now();
  const bare = sample({ where: 'x', calib: false });
  const ms = Date.now() - t;
  assert.equal(bare.calibMs, undefined, 'no calibration when the caller brings its own');
  assert.equal(bare.where, 'x');
  // NON-VACUITY: skipping it must actually be cheaper, or the option is decoration
  assert.ok(ms < 8000);
  assert.ok(Number.isFinite(bare.nodeProcs), 'and the count is still taken');
});

// ---------------------------------------------------------------------------------------------------
// pids() / newSince() — for identifying a handle holder that is NOT in a known descendant set.
// Requested by the BIND-1 session after taskkill /T was shown to reach live non-detached grandchildren,
// which means the holder it is hunting is outside the tree it can kill.

test('pids() returns real pids and agrees with the count from the same parse', () => {
  const list = pids();
  assert.ok(Array.isArray(list) && list.length >= 1, 'got ' + JSON.stringify(list));
  for (const p of list) assert.ok(Number.isInteger(p) && p > 0, 'bad pid ' + p);
  assert.ok(list.includes(process.pid), 'the calling process must be in its own list');

  // ONE PARSE, TWO CONSUMERS: the count and the list cannot drift, because they are the same parse
  const n = sample({ calib: false }).nodeProcs;
  assert.ok(Math.abs(n - list.length) <= 3, 'count ' + n + ' vs list ' + list.length);
});

test('newSince() finds what appeared, and refuses when either side is unmeasured', () => {
  const before = pids();
  const after = [...before, 999001, 999002];
  assert.deepEqual(newSince(before, after), [999001, 999002]);
  assert.deepEqual(newSince(before, before), [], 'nothing new when nothing changed');

  // A DIFF AGAINST AN UNKNOWN IS UNKNOWN, not an empty diff. An empty diff reads as "nothing new
  // appeared", which is the passing value — exactly what this module refuses everywhere else.
  assert.equal(newSince(null, after), null);
  assert.equal(newSince(before, null), null);
  assert.equal(newSince(null, null), null);
});
