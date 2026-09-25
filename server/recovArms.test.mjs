/**
 * recovArms.test.mjs - the RECOV-1 arms through the REAL entry point, scripted backend, no GPU.
 *
 *   node server/recovArms.test.mjs
 *
 * Scripted replies: PLAN, a still-wrong edit, then the FIXED edit, then finish - so every arm
 * has a first edit that does not fix the file, followed by a repair. What is established:
 *   1. the OPENING report is the full report in all three arms (byte-identical text)
 *   2. INIT_ONLY  : after the wrong edit the diagnostic RAN and was RECORDED (delivered:false)
 *                   but no second message reached any request
 *      INIT_COUNTS: the after-edit message carries counts and zero case-detail lines
 *      INIT_FULL  : the after-edit message carries the failing case with its expected value
 *   3. the first-edit effect is MEASURED in every arm from run.diagnostics, including the
 *      silent one - the measured sequence is identical, only delivery differs
 *   4. isolation fields on the rows say so, and the fix was accepted in every arm
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const { freePorts } = await import('./testHarness.mjs');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const EXPERIMENT = 'SMOKE-RECOV';
const BUGGY = '                dp[i, j] = dp[i - 1, j] + 1';
const WRONG = '                dp[i, j] = dp[i - 1, j] + 2';
const FIXED = '                dp[i, j] = dp[i - 1, j - 1] + 1';
const PLAN = '1. WHAT IT DOES - lcs_length\n2. FILES - lcs_length.py\n3. BUILD ORDER - fix\n4. HOW TO VERIFY - the diagnostic runs automatically';
const edit = (find, replace) => `THOUGHT: Editing.\nACTION: edit_file\nPATH: lcs_length.py\nFIND:\n${find}\nREPLACE:\n${replace}`;
const FINISH = 'THOUGHT: Done.\nACTION: finish\nTEXT:\nfixed';

const dir = mkdtempSync(join(tmpdir(), 'recovarms-'));
const [fakePort] = await freePorts(1);
const replies = join(dir, 'replies.json');
writeFileSync(replies, JSON.stringify([PLAN, edit(BUGGY, WRONG), edit(WRONG, FIXED), FINISH]), 'utf8');
const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', replies], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

let out = '';
const runner = spawn(process.execPath, [join(HERE, 'autodiag1.mjs'), `http://127.0.0.1:${fakePort}`], {
  env: { ...process.env, AUTODIAG_EXPERIMENT: EXPERIMENT, AUTODIAG_ARMS: 'INIT_ONLY,INIT_COUNTS,INIT_FULL', AUTODIAG_REPS: '1', AUTODIAG_SEEDS: '303', AUTODIAG_TASK_IDS: 'ext-lcs_length', AUTODIAG_PER_TASK_SEC: '150', AUTODIAG_TOTAL_SEC: '900' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
runner.stdout.on('data', (d) => { out += d; }); runner.stderr.on('data', (d) => { out += d; });
const exitCode = await new Promise((resolve) => { const k = setTimeout(() => { try { runner.kill('SIGKILL'); } catch {} resolve('KILLED'); }, 9 * 60_000); runner.on('exit', (c) => { clearTimeout(k); resolve(c); }); });
try { fake.kill('SIGKILL'); } catch { /* best effort */ }

const root = dirname((out.match(/summary: (.+summary\.jsonl)/) || [])[1] || '');
const rows = existsSync(join(root, 'summary.jsonl')) ? readFileSync(join(root, 'summary.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.kind === 'run') : [];
const byArm = Object.fromEntries(rows.map((r) => [r.arm, r]));
const run = (r) => JSON.parse(readFileSync(join(root, 'runs', `${r.runId}.json`), 'utf8'));
const msgs = (r) => readFileSync(join(root, 'runs', `${r.runId}.transcript.jsonl`), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })
  .filter((e) => e && e.kind === 'turn' && Array.isArray(e.sent)).flatMap((e) => e.sent).map((m) => String(m?.content || '')).filter((c) => /^AUTOMATIC DIAGNOSTIC/.test(c));

try {
  say(exitCode === 0 && rows.length === 3, `campaign ran: exit ${exitCode}, ${rows.length} rows`);
  const o = byArm.INIT_ONLY, c = byArm.INIT_COUNTS, f = byArm.INIT_FULL;
  const mo = msgs(o), mc = msgs(c), mf = msgs(f);

  console.log('=== 1. the opening report is the same full report in every arm ===');
  say(mo[0] && mo[0] === mc[0] && mc[0] === mf[0], 'opening message byte-identical across the three arms');
  say(/FAIL case \d+ /.test(mo[0] || '') && /EXPECTED/.test(mo[0] || ''), 'and it is the FULL report (cases with expected values)');

  console.log('=== 2. what follows the wrong edit differs by arm ===');
  const dO = run(o).diagnostics.filter((d) => !d.skipped);
  say(mo.length === 1 && o.diagnosticMessagesSeen === 1, `INIT_ONLY: exactly one diagnostic message reached a request (${mo.length})`);
  say(dO.length >= 3 && dO.slice(1).every((d) => d.delivered === false) && dO[0].delivered === true, `INIT_ONLY: after-edit diagnostics RAN and were recorded delivered:false (${dO.length} recorded, ${o.diagnosticsMeasuredSilently} silent)`);
  say(mc.length >= 2 && /RESULT: \d+ cases attempted/.test(mc[1]) && !/case \d+ /.test(mc[1]), 'INIT_COUNTS: the after-edit message carries counts and no case');
  say(c.afterEditCaseLinesSeen === 0 && c.caseDetailLinesSeen > 0, `INIT_COUNTS: case lines only in the opening message (${c.caseDetailLinesSeen} opening, ${c.afterEditCaseLinesSeen} after)`);
  say(mf.length >= 2 && /FAIL case \d+ /.test(mf[1]) && /EXPECTED/.test(mf[1]), 'INIT_FULL: the after-edit message lists the failing case with its expected value');
  say(f.afterEditCaseLinesSeen > 0, `INIT_FULL: after-edit case lines ${f.afterEditCaseLinesSeen}`);

  console.log('=== 3. the first-edit effect is MEASURED identically in every arm, delivered or not ===');
  // The scripted edits are the same in every arm, so the measured sequence of passing counts
  // (seed -> after edit 1 -> after edit 2) must be the same in every arm - including INIT_ONLY,
  // where nothing after the opening report was delivered. (The scripted "wrong" edit happens to
  // raise the count 1->2; what matters here is that the measurement exists and agrees.)
  const seqs = {};
  for (const [name, r] of [['INIT_ONLY', o], ['INIT_COUNTS', c], ['INIT_FULL', f]]) {
    const d = run(r).diagnostics.filter((x) => !x.skipped);
    seqs[name] = d.map((x) => x.passed ?? 'noimport').join('>');
    say(d.length >= 3 && d.every((x) => typeof x.passed === 'number'), `${name}: ${d.length} measured diagnostics, passing counts ${seqs[name]}`);
  }
  say(seqs.INIT_ONLY === seqs.INIT_COUNTS && seqs.INIT_COUNTS === seqs.INIT_FULL, 'the measured sequence is identical across the three arms');
  const last = run(o).diagnostics.filter((x) => !x.skipped).map((x) => x.passed);
  say(last[last.length - 1] === 9 && last[0] === 1, `INIT_ONLY's silent measurements track the file: ${last[0]} on the seed, ${last[last.length - 1]} after the fix`);

  console.log('=== 4. rows ===');
  say(rows.every((r) => r.isolationOk === true), 'isolationOk true on every row');
  say(rows.every((r) => r.accepted && r.disposition === 'RETAIN'), 'the scripted fix was accepted in every arm');
  say(/isolation: held in every recorded unit/.test(out), 'the console states isolation held');
} finally {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}
console.log(`\n  recovArms: ${passed} passed, ${failed} failed`);
if (failed) console.log(out.slice(-2500));
process.exit(failed ? 1 : 0);
