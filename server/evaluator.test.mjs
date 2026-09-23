/**
 * evaluator.test.mjs - the INDEPENDENT EVALUATOR.
 *
 *   node server/evaluator.test.mjs
 *
 * The evaluator decides step 4's measure - verified useful behaviour retained. If it is wrong,
 * every PROTOCOL-1 number is wrong in a way no later analysis can detect, so it is exercised on
 * candidates whose correct verdict is known in advance.
 *
 * THE THREE OUTCOMES ARE TESTED AS THREE, especially EVALUATION_ERROR: scoring an apparatus
 * failure as FAIL would convert infrastructure flakiness into evidence about the model.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { evaluate, VERDICT } = await import('./evaluator.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);

/** The task's PREDEFINED requirement. Written here, by the experimenter, never by the model. */
const TASK = {
  id: 'add-halve-keep-double',
  requested: { script: 'node -e "const l=require(\'/candidate/lib.js\'); if (l.halve(10) !== 5) { console.log(\'halve wrong\'); process.exit(1); } console.log(\'halve ok\')"' },
  protected: { script: 'node -e "const l=require(\'/candidate/lib.js\'); if (l.double(4) !== 8) { console.log(\'double broken\'); process.exit(1); } console.log(\'double ok\')"' },
};

const dirs = [];
function candidate(libSrc) {
  const ws = mkdtempSync(join(tmpdir(), 'eval-'));
  dirs.push(ws);
  writeFileSync(join(ws, 'package.json'), '{"name":"fx","type":"commonjs"}\n', 'utf8');
  writeFileSync(join(ws, 'lib.js'), libSrc, 'utf8');
  const g = (...a) => execFileSync('git', ['-C', ws, ...a], { encoding: 'utf8' });
  g('init', '-q'); g('add', '-A'); g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'c');
  return ws;
}

const DOUBLE = 'function double(n){return n*2;}\n';
try {
  // ── 1. both satisfied -> PASS ──
  console.log('=== 1. requested and protected both satisfied ===');
  const good = candidate(DOUBLE + 'function halve(n){return n/2;}\nmodule.exports={double,halve};\n');
  const r1 = await evaluate(good, TASK);
  say(r1.verdict === VERDICT.PASS, `PASS (${r1.verdict})`);
  say(r1.requested.verdict === VERDICT.PASS && r1.protected.verdict === VERDICT.PASS, 'both parts reported SEPARATELY, both PASS');
  say(/^[0-9a-f]{40}$/.test(r1.candidateTree || ''), `the verdict names the exact candidate tree it judged (${String(r1.candidateTree).slice(0, 8)})`);

  // ── 2. the new behaviour is missing -> FAIL, and only the requested part fails ──
  console.log('\n=== 2. requested behaviour absent ===');
  const noHalve = candidate(DOUBLE + 'module.exports={double};\n');
  const r2 = await evaluate(noHalve, TASK);
  say(r2.verdict === VERDICT.FAIL, `FAIL (${r2.verdict})`);
  say(r2.requested.verdict === VERDICT.FAIL && r2.protected.verdict === VERDICT.PASS,
    'requested FAILS while protected still PASSES - the two are not summed');

  // ── 3. THE CASE THE SEPARATION EXISTS FOR: new feature added by breaking the old one ──
  console.log('\n=== 3. adds the new behaviour by BREAKING the protected one ===');
  const broke = candidate('function double(n){return n*3;}\nfunction halve(n){return n/2;}\nmodule.exports={double,halve};\n');
  const r3 = await evaluate(broke, TASK);
  say(r3.requested.verdict === VERDICT.PASS, 'the requested behaviour genuinely works');
  say(r3.protected.verdict === VERDICT.FAIL, 'and the protected behaviour is genuinely broken');
  say(r3.verdict === VERDICT.FAIL, 'overall FAIL - this is NOT a partial success');
  note('Summing these would have scored it as half-right. It is not half-right.');

  // ── 4. THE CANDIDATE CANNOT EDIT THE TEST ──
  console.log('\n=== 4. expected answers are outside the candidate\'s writable control ===');
  const sneaky = candidate(DOUBLE + 'module.exports={double};\n');
  // A candidate that tries to rewrite the check, or to write anywhere it should not.
  const tamper = {
    id: 'tamper',
    requested: { script: 'echo tampering; printf "exit 0" > /check/requested.sh 2>&1 || echo CHECK_READONLY; printf x > /candidate/pwned.txt 2>&1 || echo CANDIDATE_READONLY; exit 1' },
  };
  const r4 = await evaluate(sneaky, tamper);
  say(/CHECK_READONLY|Read-only|Permission denied/i.test(r4.requested.out || ''), 'the check directory is READ-ONLY to the check process');
  say(/CANDIDATE_READONLY|Read-only|Permission denied/i.test(r4.requested.out || ''), 'and the candidate is mounted READ-ONLY during evaluation');
  say(!existsSync(join(sneaky, 'pwned.txt')), 'nothing was written into the candidate workspace by the evaluation');
  say(r4.verdict === VERDICT.FAIL, 'and the tampering attempt still FAILS honestly');

  // ── 5. APPARATUS FAILURE IS NOT A CODING FAILURE ──
  console.log('\n=== 5. EVALUATION_ERROR, kept distinct from FAIL ===');
  const fine = candidate(DOUBLE + 'function halve(n){return n/2;}\nmodule.exports={double,halve};\n');
  // Force apparatus failure by INJECTING a nonexistent image. Setting the env var does not
  // work: WORKER_IMAGE binds at import, so that version of this probe was inert and reported
  // a real PASS - it was the TEST that was broken, not the evaluator.
  const r5 = await evaluate(fine, TASK, { image: 'sha256:' + '0'.repeat(64) });
  say(r5.verdict === VERDICT.EVALUATION_ERROR, `an unavailable worker yields EVALUATION_ERROR, NOT FAIL (${r5.verdict})`);
  say(r5.verdict !== VERDICT.FAIL, 'this candidate is CORRECT - scoring it FAIL would have been evidence about the model produced by a broken instrument');
  say(/could not be run/.test(r5.requested?.reason || ''), 'and the reason names an apparatus failure rather than a wrong answer');
  // ── 6. a candidate that cannot be identified is not judged ──
  console.log('\n=== 6. a verdict must name what it judged ===');
  const nogit = mkdtempSync(join(tmpdir(), 'nogit-')); dirs.push(nogit);
  writeFileSync(join(nogit, 'lib.js'), DOUBLE, 'utf8');
  const r6 = await evaluate(nogit, TASK);
  say(r6.verdict === VERDICT.EVALUATION_ERROR, 'an unidentifiable candidate is an EVALUATION_ERROR, not a FAIL');
  say(/could not be identified/.test(r6.reason || ''), 'and the reason says so');
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  independent evaluator: ${passed} passed, ${failed} failed -> ${failed ? 'THE INSTRUMENT IS NOT TRUSTWORTHY' : 'evaluator qualified'}`);
process.exit(failed ? 1 : 0);
