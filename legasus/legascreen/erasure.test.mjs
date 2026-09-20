// LegaScreen v0 — the screen's own behaviour, pinned. Predictions LS-1..LS-5 frozen in
// benchmarks/LEGASCREEN_V0_PREREG.md; the run against the real tree at 77fd921 is preserved in
// benchmarks/RESULT.legascreen-v0.md.
//
// A SCREEN THAT CANNOT BE SHOWN TO FIRE IS A SCREEN THAT HAS NEVER BEEN SHOWN TO WORK, so the
// erasing and preserving cases are both here in-memory, and the sensitivity claim is re-derivable
// without a temporary checkout.
import test from 'node:test';
import assert from 'node:assert';
import { screen, AUTHORITY_FIELDS } from './erasure.mjs';

const VERDICT = { state: 'QUIESCENT_CONTEST', justified: [], why: 'because',
  establishes: 'no investigation formulated in this frontier is currently justified',
  doesNotEstablish: 'that no justified investigation exists' };

// The two versions of the function, exactly as they were before and after 84af085.
const BEFORE = { objectivesFromContest: (c) => ({ objectives: [], why: 'a QUIESCENT contest...' }) };
const AFTER = { objectivesFromContest: (c) => ({ objectives: [], why: 'a QUIESCENT contest...',
  establishes: c.establishes, doesNotEstablish: c.doesNotEstablish }) };

const run = (exports) => screen({ modules: [{ name: 'm', exports }],
  seeds: { verdict: () => VERDICT } });

test('LS-1 — the screen FIRES on the erasure, knowing nothing about the defect', async () => {
  const r = await run(BEFORE);
  const hit = r.positives.find((p) => p.fn === 'm.objectivesFromContest');
  assert.ok(hit, 'the erasing version must be flagged');
  assert.ok(hit.lost.includes('establishes') && hit.lost.includes('doesNotEstablish'));
});

test('LS-2 — and is SILENT on the repaired version, so it tracks the code and not the name', async () => {
  const r = await run(AFTER);
  const hit = r.positives.find((p) => p.fn === 'm.objectivesFromContest');
  assert.ok(!hit || (!hit.lost.includes('establishes') && !hit.lost.includes('doesNotEstablish')),
    'the repaired version must not be flagged for the bound');
});

test('LS-3 NON-VACUITY — the screen reports what it actually exercised', async () => {
  const r = await run(BEFORE);
  assert.equal(r.coverage.functions, 1);
  assert.ok(r.coverage.exercisedCalls > 0, 'a screen that calls nothing would satisfy LS-2 trivially');
});

test('LS-5 — a function the corpus cannot reach is UNSCREENED, never clean', async () => {
  const r = await screen({
    modules: [{ name: 'm', exports: { ...AFTER, needsTwoArgs: (a, b) => { throw new Error('nope'); } } }],
    seeds: { verdict: () => VERDICT } });
  assert.deepEqual(r.unscreened.map((u) => u.fn), ['m.needsTwoArgs']);
  assert.match(r.unscreened[0].why, /NOT FLAGGED here means NOT EXAMINED/);
  assert.equal(r.coverage.neverCalled, 1);
});

test('THE DECLARED VOCABULARY is argued from the laws, and is stated rather than tuned', () => {
  for (const f of ['establishes', 'doesNotEstablish', 'scope', 'provenance', 'evidence', 'witness',
    'grant', 'ancestry', 'UNADMITTED', 'why']) {
    assert.ok(AUTHORITY_FIELDS.has(f), f);
  }
  // and it is not everything - a screen that flagged every field would have no specificity at all
  for (const f of ['objectives', 'name', 'missing', 'pending']) assert.equal(AUTHORITY_FIELDS.has(f), false);
});
