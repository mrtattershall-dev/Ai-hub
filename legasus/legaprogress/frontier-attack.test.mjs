// r4 — composition wave 2, the project ratchet. Prediction frozen in benchmarks/COMPOSITION_PREREG_2.md
// (W2-c); the PRE-REPAIR run that reproduced it is preserved in benchmarks/RESULT.composition-2.md and
// at b0673cd, where this file asserted the defect. It now asserts the repair and keeps every control.
import test from 'node:test';
import assert from 'node:assert';
import { connectivity, supportedRegion, assessAdvancement, liveWitnesses, VERDICT, ROUTE }
  from './frontier.mjs';
import { buildRegion } from './region.mjs';
import { STATE } from '../legaknow/ledger.mjs';

const PURPOSE = { domains: ['pkg'], entryPoints: ['pkg.main'], prohibitions: [] };
const witness = (lifecycle) => ({ id: 'w1', rootSubject: 'pkg.main', entered: ['pkg.x'],
  lines: ['pkg:10'], lifecycle });

test('W2-c-1 REGRESSION — a STALE witness is not an edge: UNSUPPORTED, and the exclusion is reported', () => {
  const conn = connectivity([witness('STALE')]);
  assert.equal(supportedRegion({ purpose: PURPOSE, subjects: ['pkg.x'], conn }).supported.has('pkg.x'), false,
    'b0673cd connected this through a stale witness');
  assert.deepEqual(conn.excluded(), [{ id: 'w1', rootSubject: 'pkg.main', lifecycle: 'STALE' }]);
  const a = assessAdvancement({ purpose: PURPOSE, before: {}, after: { 'pkg.x': { state: STATE.VERIFIED } },
    witnesses: [witness('STALE')] });
  assert.equal(a.verdict, VERDICT.NOT_PURPOSE_SUPPORTED);
  // INVALID is excluded the same way
  assert.equal(connectivity([witness('INVALID')]).reaches('pkg.main', 'pkg.x'), false);
});

test('W2-c-2 CONTROL — VALID, REVALIDATED and raw (unstated) witnesses connect', () => {
  for (const lc of ['VALID', 'REVALIDATED', undefined]) {
    const conn = connectivity([witness(lc)]);
    assert.equal(supportedRegion({ purpose: PURPOSE, subjects: ['pkg.x'], conn }).supported.get('pkg.x'),
      ROUTE.IN_DOMAIN, String(lc));
    assert.deepEqual(conn.excluded(), []);
  }
  const a = assessAdvancement({ purpose: PURPOSE, before: {}, after: { 'pkg.x': { state: STATE.VERIFIED } },
    witnesses: [witness('VALID')] });
  assert.equal(a.verdict, VERDICT.ADVANCEMENT);
});

test('W2-c-3 CONTROL — the repair equals removal: a stale witness and no witness give the same region', () => {
  const stale = supportedRegion({ purpose: PURPOSE, subjects: ['pkg.x'], conn: connectivity([witness('STALE')]) });
  const none = supportedRegion({ purpose: PURPOSE, subjects: ['pkg.x'], conn: connectivity([]) });
  assert.deepEqual([...stale.supported.entries()], [...none.supported.entries()]);
});

test('W2-c-4 — buildRegion() applies the same rule and establishes no site from a stale witness', () => {
  const stale = buildRegion({ witnesses: [witness('STALE')], roots: ['pkg.main'], siteMap: {} });
  assert.equal(stale.subjects.has('pkg.x'), false);
  assert.equal(stale.sites.size, 0);
  assert.deepEqual(stale.excludedWitnesses, [{ id: 'w1', lifecycle: 'STALE' }]);
  const live = buildRegion({ witnesses: [witness('VALID')], roots: ['pkg.main'], siteMap: {} });
  assert.equal(live.subjects.has('pkg.x'), true);
  assert.equal(live.sites.size, 1);
  assert.deepEqual(liveWitnesses([witness('STALE'), witness('VALID')]).live.length, 1);
});
