// The three cases the comparability gate must get right, plus the two ways missing evidence
// used to pass as agreement.  node --test factory/comparability.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { assetComparability, COMPARABILITY } from './comparability.mjs';

const v = (assetVersion, pass = true) => ({ pass, assetVersion });

test('matching, known asset versions permit the comparison', () => {
  const r = assetComparability({ base: [v('v7'), v('v7', false)], run5: [v('v7'), v('v7')] });
  assert.equal(r.status, COMPARABILITY.COMPARABLE);
  assert.deepEqual(r.versions, ['v7']);
  assert.deepEqual(r.missing, { base: 0, run5: 0 });
  assert.match(r.why, /all 4 verdicts scored against asset library v7/);
});

test('mismatched versions block it and require a rescore', () => {
  const r = assetComparability({ base: [v('v7'), v('v7')], run5: [v('v8'), v('v8')] });
  assert.equal(r.status, COMPARABILITY.MISMATCH);
  assert.deepEqual(r.versions, ['v7', 'v8']);
  assert.match(r.why, /2 different asset libraries/);
  assert.match(r.why, /RESCORE/);
});

test('a mismatch WITHIN one run is still a mismatch (library changed mid-scoring)', () => {
  const r = assetComparability({ base: [v('v7'), v('v8')] });
  assert.equal(r.status, COMPARABILITY.MISMATCH);
});

test('missing version evidence cannot silently count as agreement', () => {
  // the old defect: `if (j.assetVersion) SET.add(...)` - a run with no versions added nothing,
  // so one versioned row anywhere made the whole comparison look like size === 1
  const r = assetComparability({ base: [v(null), v(null)], run5: [v('v7'), v('v7')] });
  assert.equal(r.status, COMPARABILITY.UNESTABLISHED);
  assert.deepEqual(r.missing, { base: 2, run5: 0 });
  assert.match(r.why, /2 of 4 verdicts carry no asset version/);
  assert.match(r.why, /missing evidence is not agreement/);
});

test('one missing row among many is enough to withhold COMPARABLE', () => {
  const r = assetComparability({ base: [v('v7'), v('v7'), v(undefined)], run5: [v('v7')] });
  assert.equal(r.status, COMPARABILITY.UNESTABLISHED);
  assert.deepEqual(r.missing, { base: 1, run5: 0 });
});

test('no versions anywhere is UNESTABLISHED, never COMPARABLE', () => {
  const r = assetComparability({ base: [v(null)], run5: [v(null)] });
  assert.equal(r.status, COMPARABILITY.UNESTABLISHED);
  assert.deepEqual(r.versions, []);
});

test('harness failures (pass === null) are not verdicts and do not decide anything', () => {
  // a '?' row with no version must not make a clean comparison UNESTABLISHED...
  const a = assetComparability({ base: [v('v7'), { pass: null }], run5: [v('v7')] });
  assert.equal(a.status, COMPARABILITY.COMPARABLE);
  assert.deepEqual(a.counted, { base: 1, run5: 1 });
  // ...and an axis that is ALL '?' has nothing to compare
  const b = assetComparability({ base: [{ pass: null }], run5: [{ pass: null }] });
  assert.equal(b.status, COMPARABILITY.UNESTABLISHED);
  assert.match(b.why, /no verdicts/);
});

test('an empty-string version is missing, not a version', () => {
  const r = assetComparability({ base: [v('')], run5: [v('v7')] });
  assert.equal(r.status, COMPARABILITY.UNESTABLISHED);
});
