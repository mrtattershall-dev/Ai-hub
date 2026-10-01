/**
 * commitBoundary.test.mjs - COMMIT-1's durable regression. THE PROPERTY, at the RETAIN transition.
 *
 *   node server/commitBoundary.test.mjs
 *
 *   A successful verdict may make state authoritative only if the exact state becoming
 *   authoritative has identity equal to verdict.subject. Rejection preserves the previously
 *   authoritative identity. Unestablishable equality fails closed.
 *
 * Written BEFORE the repair and run unrepaired first: K8 must FAIL here, or this file cannot
 * distinguish a repair from nothing. The disposition is asserted as a string literal, not
 * DISPOSITION.IDENTITY_DRIFT, so an unrepaired run cannot false-pass on undefined === undefined.
 *
 * ABA is the anti-over-refusal arm. A repair that refuses it has implemented immutability where
 * EQUALITY was required, and is rejected by this file as surely as K8 surviving.
 *
 * The probe (commit1.probe.mjs) stays the frozen before/after instrument; this file is the guard
 * that keeps the repaired behaviour from regressing silently.
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cid1 } from './cid1.mjs';
import { evaluate, VERDICT } from './evaluator.js';
import { applyAcceptance, DISPOSITION } from './acceptance.js';

let passed = 0, failed = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); c ? passed++ : failed++; };
const git = (ws, ...a) => execFileSync('git', ['-C', ws, ...a], { encoding: 'utf8', windowsHide: true }).trim();
const ORIGINAL = 'module.exports={probe:()=>"ORIGINAL"};\n';
const MUTATED = 'module.exports={probe:()=>"MUTATED"};\n';
const TASK = (id) => ({ id, requested: { script: 'true' }, protected: { script: 'true' } });

function candidate() {
  const d = mkdtempSync(join(tmpdir(), 'cb-'));
  writeFileSync(join(d, 'subject.js'), ORIGINAL, 'utf8');
  git(d, 'init', '-q'); git(d, 'config', 'core.autocrlf', 'false');
  git(d, 'config', 'user.email', 'p@p'); git(d, 'config', 'user.name', 'p');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'start');
  return { d, startRef: git(d, 'rev-parse', 'HEAD') };
}

console.log('COMMIT-1 regression - identity equality at the authoritative transition');
console.log('');

// ── K8  authorized(C0), live is C1 -> must NOT RETAIN ────────────────────────────────────────
{
  const { d, startRef } = candidate();
  const v = await evaluate(d, TASK('k8'));
  writeFileSync(join(d, 'subject.js'), MUTATED, 'utf8');
  const acc = await applyAcceptance(d, TASK('k8'), v, { startRef, captureDir: null, taskId: 'k8' });
  ok(acc.disposition !== DISPOSITION.RETAIN, `K8  drifted state is NOT retained (disposition=${acc.disposition})`);
  ok(acc.disposition === 'IDENTITY_DRIFT', 'K8  and the refusal names IDENTITY DRIFT, not RESTORE_FAILED or HELD');
  ok(acc.promotable === false && acc.countsAsCompletion !== true, 'K8  nothing becomes authoritative: promotable=false, not a completion');
  ok(cid1(d).id !== v.subject, 'K8  precondition really held: live identity != verdict.subject');
}

// ── ABA  mutate, restore to C0 bytes, commit -> MUST RETAIN (equality, not immutability) ──────
{
  const { d, startRef } = candidate();
  const v = await evaluate(d, TASK('aba'));
  writeFileSync(join(d, 'subject.js'), MUTATED, 'utf8');
  writeFileSync(join(d, 'subject.js'), ORIGINAL, 'utf8');
  ok(cid1(d).id === v.subject, 'ABA precondition: live identity == verdict.subject again');
  const acc = await applyAcceptance(d, TASK('aba'), v, { startRef, captureDir: null, taskId: 'aba' });
  ok(acc.disposition === DISPOSITION.RETAIN && acc.promotable === true,
    `ABA ANTI-OVER-REFUSAL: a state that wandered and came back IS retained (disposition=${acc.disposition})`);
}

// ── UNAVAILABLE  identity cannot be established at commit -> fail closed, never RETAIN ────────
{
  const { d, startRef } = candidate();
  const v = await evaluate(d, TASK('unavail'));
  rmSync(d, { recursive: true, force: true });                            // the workspace is gone at commit time
  const acc = await applyAcceptance(d, TASK('unavail'), v, { startRef, captureDir: null, taskId: 'unavail' });
  ok(acc.disposition !== DISPOSITION.RETAIN, `UNAVAILABLE  an unidentifiable state is never retained (disposition=${acc.disposition})`);
  ok(acc.promotable === false, 'UNAVAILABLE  and nothing is promoted');
}

// ── T6 preserved  refusal/error paths unchanged by the repair ─────────────────────────────────
{
  const { d, startRef } = candidate();
  const v = await evaluate(d, TASK('t6a'), { image: 'sha256:' + '0'.repeat(64) });
  const acc = await applyAcceptance(d, TASK('t6a'), v, { startRef, captureDir: null, taskId: 't6a' });
  ok(v.verdict === VERDICT.EVALUATION_ERROR && acc.disposition === DISPOSITION.HELD, `T6a EVALUATION_ERROR still HELD (${acc.disposition})`);
}
{
  const { d, startRef } = candidate();
  const task = { id: 't6b', requested: { script: 'false' }, protected: { script: 'true' } };
  const v = await evaluate(d, task);
  const acc = await applyAcceptance(d, task, v, { startRef, captureDir: null, taskId: 't6b' });
  ok(acc.disposition === DISPOSITION.PRESERVE_INCOMPLETE && acc.promotable === false, `T6b incomplete still PRESERVE_INCOMPLETE (${acc.disposition})`);
}

console.log('');
console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
