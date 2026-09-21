/**
 * expect.mjs - the self-check's KNOWN ANSWERS, written before the toy matrix was read.
 *
 *   node legasus/selfcheck/expect.mjs legasus/out/selfcheck/matrix.json
 *
 * If the apparatus cannot reproduce these on a subject whose behaviour is fully known, it
 * has no business reporting on one whose behaviour is not.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const M = JSON.parse(readFileSync(process.argv[2], 'utf8'));

// An attempt the load rule discarded is NOT a result, so there is nothing here to check the
// known answers against. Saying so is the only honest output; a wall of FAILs would read as
// the apparatus being wrong when it was the machine being busy.
if (M.attempt && M.attempt.status !== 'OBSERVED') {
  console.log(`selfcheck expectations: NOT APPLICABLE - attempt is ${M.attempt.status} (${M.attempt.reason || 'no reason recorded'})`);
  process.exit(2);
}
const W = 'legasus/selfcheck/toy_witness.mjs :: ';
const rec = (mutantPrefix, caseId) => M.records.find((r) => r.mutant.startsWith(mutantPrefix) && r.witness === W + caseId);
const byFamily = (fam) => M.records.filter((r) => r.family === fam && r.granularity === 'case');
let passed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; } };

test('the tracer produced one record per (mutant x case) for every valid mutant', () => {
  const valid = new Set(M.records.filter((r) => r.klass !== 'INVALID_MUTANT').map((r) => r.mutant));
  for (const m of valid) assert.equal(M.records.filter((r) => r.mutant === m && r.granularity === 'case').length, 5, `mutant ${m}`);
});

test('a case that never calls the subject is NOT_EXECUTED under every mutant - never discriminated', () => {
  const rs = M.records.filter((r) => r.witness === W + 'untouched');
  assert.ok(rs.length >= 20);
  for (const r of rs) assert.ok(['NOT_EXECUTED', 'UNOBSERVABLE'].includes(r.klass), `${r.mutant}: ${r.klass}`);
  assert.ok(rs.some((r) => r.klass === 'NOT_EXECUTED'), 'at least one plain NOT_EXECUTED');
});

test('a case that fails at baseline is BASELINE_INVALID everywhere and counts for nothing', () => {
  const rs = M.records.filter((r) => r.witness === W + 'deliberately wrong');
  assert.ok(rs.length >= 20);
  for (const r of rs) assert.equal(r.klass, 'BASELINE_INVALID', r.mutant);
  assert.ok(!M.candidates.some((c) => c.discriminators.some((d) => d.endsWith('deliberately wrong'))));
});

test('RETURN_EMPTY is discriminated by exactly the three cases that call the subject', () => {
  const rs = byFamily('RETURN_EMPTY');
  const disc = rs.filter((r) => r.klass.startsWith('DISCRIMINATED')).map((r) => r.witness.slice(W.length)).sort();
  assert.deepEqual(disc, ['big clamps', 'small passes', 'string is -1']);
  for (const r of rs.filter((r) => r.klass.startsWith('DISCRIMINATED'))) assert.equal(r.klass, 'DISCRIMINATED_BY_FAIL');
});

test('EXECUTED_NOT_DISCRIMINATED and NOT_EXECUTED are both produced, and are different types', () => {
  const kinds = new Set(M.records.map((r) => r.klass));
  assert.ok(kinds.has('EXECUTED_NOT_DISCRIMINATED'), 'no EXECUTED_NOT_DISCRIMINATED anywhere');
  assert.ok(kinds.has('NOT_EXECUTED'), 'no NOT_EXECUTED anywhere');
});

test('swallowing the catch is seen ONLY by the case that reaches the catch; the others never executed that block', () => {
  const swallow = M.records.filter((r) => r.family === 'EXCEPTION' && r.granularity === 'case' && /swallow/.test((M.perMutant.find((p) => p.mutant === r.mutant) || {}).describe || ''));
  assert.ok(swallow.length === 5, `expected 5 records for the swallow mutant, got ${swallow.length}`);
  const by = Object.fromEntries(swallow.map((r) => [r.witness.slice(W.length), r.klass]));
  assert.equal(by['string is -1'], 'DISCRIMINATED_BY_FAIL');
  assert.equal(by['big clamps'], 'NOT_EXECUTED');
  assert.equal(by['small passes'], 'NOT_EXECUTED');
});

test('a mutant that throws out of the subject: the running case is an observation, later cases are UNOBSERVABLE', () => {
  const prop = M.records.filter((r) => r.family === 'EXCEPTION' && r.granularity === 'case' && /propagate/.test((M.perMutant.find((p) => p.mutant === r.mutant) || {}).describe || ''));
  const by = Object.fromEntries(prop.map((r) => [r.witness.slice(W.length), r.klass]));
  assert.equal(by['string is -1'], 'DISCRIMINATED_BY_ERROR', 'the case running when the process died');
  assert.equal(by['untouched'], 'UNOBSERVABLE', 'never ran - must not be credited as discrimination');
  assert.equal(by['deliberately wrong'], 'BASELINE_INVALID');
});

test('no obligation was named: candidates are anonymous D-numbers with provenance', () => {
  for (const c of M.candidates) { assert.match(c.D, /^D\d+$/); assert.ok(c.provenance); assert.ok(!('meaning' in c)); }
});

console.log(`selfcheck expectations: ${passed} passed`);
