// r4 — composition wave 2, the project ratchet. Predictions frozen in benchmarks/COMPOSITION_PREREG_2.md
// (W2-c) BEFORE this file existed. Assertions state the PREDICTED DEFECT; controls beside them.
import test from 'node:test';
import assert from 'node:assert';
import { connectivity, supportedRegion, assessAdvancement, VERDICT, ROUTE } from './frontier.mjs';
import { STATE } from '../legaknow/ledger.mjs';

const PURPOSE = { domains: ['pkg'], entryPoints: ['pkg.main'], prohibitions: [] };
const witness = (lifecycle) => ({ id: 'w1', rootSubject: 'pkg.main', entered: ['pkg.x'],
  lines: ['pkg:10'], lifecycle });

test('W2-c-1 ATTACK — a STALE witness still connects the region and scores ADVANCEMENT', () => {
  const conn = connectivity([witness('STALE')]);
  const region = supportedRegion({ purpose: PURPOSE, subjects: ['pkg.x'], conn });
  // PREDICTED DEFECT: the stale edge is an edge.
  assert.equal(region.supported.get('pkg.x'), ROUTE.IN_DOMAIN, 'prediction W2-c-1: connected by a stale witness');
  const a = assessAdvancement({ purpose: PURPOSE, before: {}, after: { 'pkg.x': { state: STATE.VERIFIED } },
    witnesses: [witness('STALE')] });
  assert.equal(a.verdict, VERDICT.ADVANCEMENT);
});

test('W2-c-2 CONTROL — the same witness VALID connects', () => {
  const conn = connectivity([witness('VALID')]);
  assert.equal(supportedRegion({ purpose: PURPOSE, subjects: ['pkg.x'], conn }).supported.get('pkg.x'),
    ROUTE.IN_DOMAIN);
  const a = assessAdvancement({ purpose: PURPOSE, before: {}, after: { 'pkg.x': { state: STATE.VERIFIED } },
    witnesses: [witness('VALID')] });
  assert.equal(a.verdict, VERDICT.ADVANCEMENT);
});

test('W2-c-3 CONTROL — with no witness at all the subject is UNSUPPORTED', () => {
  const conn = connectivity([]);
  assert.equal(supportedRegion({ purpose: PURPOSE, subjects: ['pkg.x'], conn }).supported.has('pkg.x'), false);
  const a = assessAdvancement({ purpose: PURPOSE, before: {}, after: { 'pkg.x': { state: STATE.VERIFIED } },
    witnesses: [] });
  assert.equal(a.verdict, VERDICT.NOT_PURPOSE_SUPPORTED);
});
