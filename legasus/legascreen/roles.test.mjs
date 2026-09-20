// CONTROLS FOR H-DEFAULT — predictions D-1..D-5 in benchmarks/H_DEFAULT_PREREG.md.
//
// The point of these is that "the taxonomy did not grow" must be MECHANICALLY CHECKED. A frozen
// table that silently accepts a seventh role would make the whole experiment unfalsifiable.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { classify, ROLE, COMPLETION, VALUE, VERDICT } from './roles.mjs';

test('THE TABLE IS SIX ROLES AND SIX LAWS, and that is checkable', () => {
  assert.equal(Object.keys(ROLE).length, 6);
  assert.equal(Object.keys(COMPLETION).length, 6);
  assert.deepEqual(Object.keys(COMPLETION).sort(), Object.values(ROLE).sort());
  assert.equal(Object.keys(VALUE).length, 7, 'and values are a separate set from completions');
});

test('MUST FIRE — a seventh role is REFUSED, which is the failure condition of the experiment', () => {
  assert.throws(() => classify({ id: 'x', verdict: VERDICT.EXPLAINED, role: 'INTENT',
    applied: 'DONT_CARE' }), /IS NOT ONE OF THE SIX FROZEN ROLES/);
});

test('MUST FIRE — a new completion law is REFUSED', () => {
  assert.throws(() => classify({ id: 'x', verdict: VERDICT.EXPLAINED, role: ROLE.EVIDENCE,
    applied: 'ASSUME_SAFE' }), /IS NOT ONE OF THE SIX FROZEN COMPLETION LAWS/);
});

test('an EXPLAINED entry must actually be wrong, and a non-EXPLAINED one carries no role', () => {
  assert.throws(() => classify({ id: 'x', verdict: VERDICT.EXPLAINED, role: ROLE.EVIDENCE,
    applied: 'NOT_ESTABLISHED' }), /the applied law is correct/);
  assert.throws(() => classify({ id: 'x', verdict: VERDICT.NOT_AN_OMISSION, role: ROLE.EVIDENCE }),
    /only an EXPLAINED entry carries a role/);
});

test('the confusion is DERIVED from the table, not asserted by the entry', () => {
  const r = classify({ id: 'C2', verdict: VERDICT.EXPLAINED, role: ROLE.EVIDENCE,
    applied: COMPLETION[ROLE.QUERY] });
  assert.equal(r.required, 'NOT_ESTABLISHED');
  assert.equal(r.confusion, 'EVIDENCE read as QUERY');
});

test('THE CORPUS VALIDATES, AND ITS NUMBERS ARE WHAT THEY ARE', () => {
  const corpus = JSON.parse(readFileSync('benchmarks/h-default-corpus.json', 'utf8'));
  const rows = corpus.entries.map(classify);           // throws if the taxonomy grew
  const explained = rows.filter((r) => r.verdict === VERDICT.EXPLAINED);
  assert.equal(rows.length, 31);
  assert.equal(explained.length, 13, 'D-1: 42%, which is NOT the high fraction the prediction wanted');

  const confusions = new Set(explained.map((r) => r.confusion));
  assert.ok(confusions.size >= 2, 'D-2 holds: more than one confusion');
  const dominant = explained.filter((r) => r.confusion === 'EVIDENCE read as QUERY').length;
  assert.equal(dominant, 9, 'but 9 of 13 are one pair, so D-2 holds only weakly');

  // HALF THE TABLE NEVER FIRES. Recorded as a test so it cannot be forgotten: a role that never
  // turns out to be the REQUIRED role has not been shown to do any work in this corpus.
  const required = new Set(explained.map((r) => r.role));
  assert.deepEqual([...required].sort(), ['EVIDENCE', 'REQUEST', 'STATE']);
  for (const unused of [ROLE.QUERY, ROLE.GRANT, ROLE.DELTA]) {
    assert.ok(!required.has(unused), unused + ' is never the required role in this corpus');
  }
});
