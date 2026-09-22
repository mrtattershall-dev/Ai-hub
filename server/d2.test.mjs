// d2.test.mjs - the controls Amendment 8 requires, on a purpose-built git fixture.
//
//   node server/d2.test.mjs
//
//   POSITIVE  a NON-TARGET dependency breaks a TARGET  -> violation, reported ON THE TARGET
//   NEGATIVE  only a scratch file breaks               -> no violation
//
// Built as a real repo rather than mocked, because the thing under test is exactly the
// interaction of git refs, module resolution and the closure walk. A mocked fixture would
// test a replica - the failure mode that already produced a false cascade result today.
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { evaluateD2 } = await import('./d2.js');

const WS = mkdtempSync(join(tmpdir(), 'd2ctl-'));
const git = (...a) => execFileSync('git', ['-C', WS, ...a], { encoding: 'utf8' }).trim();
const put = (f, s) => { mkdirSync(join(WS, '..'), { recursive: true }); writeFileSync(join(WS, f), s, 'utf8'); };
const commit = (m) => { git('add', '-A'); git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', m); return git('rev-parse', '--short', 'HEAD'); };

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

try {
  git('init', '-q');
  put('package.json', '{"name":"fx","type":"commonjs"}');
  // deliverable target, depends on a NON-TARGET helper
  put('helper.js', 'module.exports = { twice: (n) => n * 2 };\n');
  put('s3_matrix.js', "const h = require('./helper');\nmodule.exports = { go: () => h.twice(2) };\n");
  // a second deliverable with no dependency, as an untouched control
  put('s7_cache.js', 'module.exports = { ok: true };\n');
  // scratch, not a deliverable
  put('scratch_test.js', "const m = require('./s3_matrix');\nif (m.go() !== 4) throw new Error('bad');\n");
  const START = commit('start');

  const TARGETS = ['s3_matrix.js', 's7_cache.js'];   // campaign-owned, frozen; helper/scratch are NOT

  // ── POSITIVE: break the NON-TARGET helper so the TARGET stops loading ──
  put('helper.js', "module.exports = { twice: (n) => n * 2 };\nthrow new Error('helper blew up at load');\n");
  const CAND_POS = commit('break helper');
  const pos = await evaluateD2(WS, { startRef: START, candidateRef: CAND_POS, written: ['helper.js'], targets: TARGETS });
  console.log('\n=== POSITIVE CONTROL: non-target dependency breaks a target ===');
  console.log(`  violated=${pos.violated} newly=${JSON.stringify(pos.newly_unloadable)} root=${pos.causal_root} closure=${JSON.stringify(pos.closure)}`);
  say(pos.violated === true, 'a non-target break that reaches a deliverable DOES refuse');
  say(pos.newly_unloadable.includes('s3_matrix.js'), 'the violation is reported ON THE TARGET (s3_matrix.js)');
  say(!pos.newly_unloadable.includes('helper.js'), 'the non-target helper is NOT itself a protected violation');
  say(pos.causal_root === 'helper.js', `a scratch/non-target file may be causal_root when established (got ${pos.causal_root})`);
  say(!pos.newly_unloadable.includes('s7_cache.js'), 'the untouched deliverable is not dragged in');

  // ── NEGATIVE: break ONLY a scratch file ──
  git('reset', '-q', '--hard', START);
  put('scratch_test.js', "throw new Error('scratch blew up');\n");
  const CAND_NEG = commit('break scratch only');
  const neg = await evaluateD2(WS, { startRef: START, candidateRef: CAND_NEG, written: ['scratch_test.js'], targets: TARGETS });
  console.log('\n=== NEGATIVE CONTROL: only a scratch file breaks ===');
  console.log(`  violated=${neg.violated} newly=${JSON.stringify(neg.newly_unloadable)} closure=${JSON.stringify(neg.closure)}`);
  say(neg.violated === false, 'breaking a non-deliverable alone does NOT refuse promotion');
  say(neg.newly_unloadable.length === 0, 'no protected target is reported');

  // ── EDGE 2: a target that did not exist at run start has nothing to lose ──
  git('reset', '-q', '--hard', START);
  put('s9_new.js', "throw new Error('born broken');\n");
  const CAND_NEW = commit('create a broken deliverable');
  const born = await evaluateD2(WS, { startRef: START, candidateRef: CAND_NEW, written: ['s9_new.js'], targets: [...TARGETS, 's9_new.js'] });
  console.log('\n=== EDGE: deliverable created during the run, born unloadable ===');
  const obs = born.observations.find((o) => o.file === 's9_new.js');
  console.log(`  violated=${born.violated} start=${obs ? obs.start : '(not observed)'}`);
  say(born.violated === false, 'a target created during the run cannot be a d2 regression');
  say(!obs || obs.start === 'UNESTABLISHED', 'its start state is UNESTABLISHED, not manufactured as THROWS');

  // ── EDGE: pre-existing break is not blamed again ──
  git('reset', '-q', '--hard', START);
  put('s3_matrix.js', "throw new Error('already broken');\n");
  const PREBROKEN = commit('pre-broken start');
  put('s3_matrix.js', "throw new Error('still broken, differently');\n");
  const CAND_PRE = commit('still broken');
  const pre = await evaluateD2(WS, { startRef: PREBROKEN, candidateRef: CAND_PRE, written: ['s3_matrix.js'], targets: TARGETS });
  console.log('\n=== EDGE: START=THROWS + FINISH=THROWS ===');
  console.log(`  violated=${pre.violated}`);
  say(pre.violated === false, 'a target already broken at run start is NOT blamed again');
} finally {
  try { rmSync(WS, { recursive: true, force: true }); } catch {}
}

console.log(`\n  CONTROLS: ${passed} passed, ${failed} failed -> ${failed ? 'DO NOT BUILD FORWARD' : 'controls hold'}`);
process.exit(failed ? 1 : 0);
