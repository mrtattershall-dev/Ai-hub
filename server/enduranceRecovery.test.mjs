/**
 * enduranceRecovery.test.mjs - KILL A CAMPAIGN, THEN RECOVER IT. Zero model calls.
 *
 *   node server/enduranceRecovery.test.mjs
 *
 * ENDURANCE-2 passed criterion 4 WITH a known weakness present, not because it was absent:
 * endurance.mjs wrote its report input only after the batch returned, so a crash at minute 110
 * would have left the report with nothing to build from. That is now fixed - and a fix nobody
 * has interrupted is a claim, not a property.
 *
 * So this kills a running scripted campaign mid-flight and exercises the DOCUMENTED recovery
 * path (`node server/rebuildReport.mjs <summary>`) on what survived.
 *
 * WHAT MUST HOLD AFTER THE KILL:
 *   1. the completed tasks are already on disk - not reconstructed afterwards
 *   2. the documented command rebuilds a report from them, with NO generation
 *   3. completed / interrupted / unattempted are accounted AUTOMATICALLY, by status
 *   4. status-specific required fields are checked - an unattempted run owes no verdict, and an
 *      integrity check that fires on correct data teaches its reader to ignore it
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { recordRun, readSummary, buildReport, requiredFieldsFor, REQUIRED_FIELDS_BY_STATUS } =
  await import('./campaignReport.js');
const { runBatch } = await import('./batch.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LIB = 'function double(n){return n*2;}\nmodule.exports={double};\n';
const PKG = '{"name":"fx","type":"commonjs"}\n';
const check = { script: 'node -e "const l=require(\'/candidate/lib.js\'); process.exit(l.double(4)===8?0:1)"' };

const dirs = [];
try {
  // ── 1. INCREMENTAL PERSISTENCE: records land AS THEY FINISH ──
  console.log('=== 1. report input is persisted as each task finishes ===');
  const root = mkdtempSync(join(tmpdir(), 'rec-')); dirs.push(root);
  const summary = join(root, 'summary.jsonl');
  const seen = [];

  const tasks = [1, 2, 3, 4].map((i) => ({
    id: `t${i}`, seed: { 'lib.js': LIB, 'package.json': PKG },
    edits: {}, requested: check, protected: check,
  }));

  await runBatch(tasks, {
    journalPath: join(root, 'j.jsonl'), workspacesDir: join(root, 'ws'), auditDir: join(root, 'audit'),
    perTaskSec: 30, totalSec: 300,
    // the hook under test
    onTaskEnd: (r) => {
      recordRun(summary, { idx: seen.length + 1, rep: 1, task: r.task, arm: 'SINGLE', termination: r.termination || r.state, requested: r.verdict?.requested?.verdict ?? null, protected: r.verdict?.protected?.verdict ?? null, disposition: r.acceptance?.disposition ?? r.state, accepted: !!r.acceptance?.countsAsCompletion, reason: r.reason ?? null, modelCalls: 0, elapsedSec: 0 });
      seen.push({ task: r.task, onDisk: readSummary(summary).runs.length });
    },
    runTask: async () => ({ status: 'COMPLETED', ok: true, exit: 0, timedOut: false, elapsedSec: 0, modelCalls: 0 }),
  });

  say(seen.length === 4, `the hook fired for every task (${seen.length}/4)`);
  say(seen.every((s, i) => s.onDisk === i + 1),
    `each record was ON DISK before the next task ran (${seen.map((s) => s.onDisk).join(',')})`);
  note('The old code wrote all of this AFTER the batch returned - a crash lost the lot.');

  // ── 2. KILL A CAMPAIGN MID-FLIGHT ──
  console.log('\n=== 2. kill a running campaign, then recover what survived ===');
  const root2 = mkdtempSync(join(tmpdir(), 'kill-')); dirs.push(root2);
  const summary2 = join(root2, 'summary.jsonl');
  const script = join(root2, 'camp.mjs');
  writeFileSync(script, `
import { runBatch } from ${JSON.stringify('file:///' + join(HERE, 'batch.js').replace(/\\\\/g, '/'))};
import { recordRun } from ${JSON.stringify('file:///' + join(HERE, 'campaignReport.js').replace(/\\\\/g, '/'))};
const SUMMARY = ${JSON.stringify(summary2.replace(/\\\\/g, '/'))};
const LIB = ${JSON.stringify(LIB)}, PKG = ${JSON.stringify(PKG)};
const check = ${JSON.stringify(check)};
const tasks = Array.from({ length: 12 }, (_, i) => ({ id: 'k' + (i + 1), seed: { 'lib.js': LIB, 'package.json': PKG }, requested: check, protected: check }));
let n = 0;
await runBatch(tasks, {
  journalPath: ${JSON.stringify(join(root2, 'j.jsonl').replace(/\\\\/g, '/'))},
  workspacesDir: ${JSON.stringify(join(root2, 'ws').replace(/\\\\/g, '/'))},
  auditDir: ${JSON.stringify(join(root2, 'audit').replace(/\\\\/g, '/'))},
  perTaskSec: 30, totalSec: 600,
  onTaskEnd: (r) => { recordRun(SUMMARY, { idx: ++n, rep: 1, task: r.task, arm: 'SINGLE', termination: r.termination || r.state, requested: r.verdict?.requested?.verdict ?? null, protected: r.verdict?.protected?.verdict ?? null, disposition: r.acceptance?.disposition ?? r.state, accepted: !!r.acceptance?.countsAsCompletion, reason: r.reason ?? null, modelCalls: 0, elapsedSec: 0 }); console.log('DONE ' + r.task); },
  runTask: async () => ({ status: 'COMPLETED', ok: true, exit: 0, timedOut: false, elapsedSec: 0, modelCalls: 0 }),
});
console.log('CAMPAIGN FINISHED');
`, 'utf8');

  const child = spawn(process.execPath, [script], { stdio: ['ignore', 'pipe', 'pipe'] });
  let done = 0;
  child.stdout.on('data', (d) => { done += (String(d).match(/DONE /g) || []).length; });
  // let some tasks complete, then kill it dead
  for (let i = 0; i < 120 && done < 4; i++) await sleep(500);
  const completedBeforeKill = done;
  child.kill('SIGKILL');
  await sleep(1000);

  say(completedBeforeKill >= 3, `the campaign completed ${completedBeforeKill} tasks before being killed`);
  const survived = readSummary(summary2).runs;
  say(survived.length === completedBeforeKill,
    `ALL ${completedBeforeKill} completed tasks survived the kill, already on disk (${survived.length})`);
  say(!existsSync(join(root2, 'report.json')), 'and no final report was ever written - the campaign died first');

  // ── 3. THE DOCUMENTED RECOVERY COMMAND ──
  console.log('\n=== 3. the documented recovery path, with no generation ===');
  const out = execFileSync(process.execPath, [join(HERE, 'rebuildReport.mjs'), summary2, join(root2, 'recovered.json')], { encoding: 'utf8', timeout: 60_000 });
  say(existsSync(join(root2, 'recovered.json')), 'rebuildReport.mjs produced a report from the survivors');
  const rec = JSON.parse(readFileSync(join(root2, 'recovered.json'), 'utf8'));
  say(rec.runs.length === completedBeforeKill, `it accounts for every survivor (${rec.runs.length}/${completedBeforeKill})`);
  say(rec.reconciliation.ok, 'and its totals reconcile');
  say(/integrity ok: true/.test(out), 'the command reports integrity ok');
  note('No model, no workspace, no live process. The summary file is the only input.');

  // ── 4. STATUS-SPECIFIC FIELDS ──
  console.log('\n=== 4. each status is held to its own standard ===');
  say(requiredFieldsFor({ termination: 'UNATTEMPTED' }).includes('requested') === false,
    'an UNATTEMPTED run owes no verdict');
  say(requiredFieldsFor({ termination: 'UNATTEMPTED' }).includes('reason'),
    'but it DOES owe a reason - skipping the check entirely would lose that');
  say(requiredFieldsFor({ termination: 'ENDED' }).includes('requested'),
    'a completed run owes its verdict');
  say(requiredFieldsFor({ termination: 'INTERRUPTED' }).includes('requested') === false,
    'an INTERRUPTED run owes no verdict either - it was never established');

  // the ENDURANCE-2 false alarm must not recur, and a REAL gap must still be caught
  const d4 = mkdtempSync(join(tmpdir(), 'st-')); dirs.push(d4);
  const s4 = join(d4, 's.jsonl');
  recordRun(s4, { idx: 1, rep: 1, task: 'u1', arm: 'SINGLE', termination: 'UNATTEMPTED', reason: 'budget exhausted' });
  const clean = buildReport(s4);
  say(clean.integrity.ok, 'a correctly-recorded UNATTEMPTED run does NOT trip the integrity check');
  recordRun(s4, { idx: 2, rep: 1, task: 'u2', arm: 'SINGLE', termination: 'UNATTEMPTED' });   // no reason
  const dirty = buildReport(s4);
  say(!dirty.integrity.ok, 'POSITIVE CONTROL: an UNATTEMPTED run with no reason IS caught');

  // ── 5. AUTOMATIC STATUS ACCOUNTING ──
  console.log('\n=== 5. completed / interrupted / unattempted, counted automatically ===');
  const d5 = mkdtempSync(join(tmpdir(), 'acc-')); dirs.push(d5);
  const s5 = join(d5, 's.jsonl');
  recordRun(s5, { idx: 1, rep: 1, task: 'a', arm: 'SINGLE', termination: 'ENDED', requested: 'PASS', protected: 'PASS', disposition: 'RETAIN', modelCalls: 3, elapsedSec: 10 });
  recordRun(s5, { idx: 2, rep: 1, task: 'b', arm: 'SINGLE', termination: 'INTERRUPTED', reason: 'killed' });
  recordRun(s5, { idx: 3, rep: 1, task: 'c', arm: 'SINGLE', termination: 'UNATTEMPTED', reason: 'budget' });
  const acc = buildReport(s5);
  say(acc.byStatus.COMPLETED === 1 && acc.byStatus.INTERRUPTED === 1 && acc.byStatus.UNATTEMPTED === 1,
    `all three statuses counted automatically (${JSON.stringify(acc.byStatus)})`);
  say(acc.byStatus.total === 3, 'and the total matches');
  note('No manual reconstruction: the report states this itself.');

  // ── 6. REPLAY ENDURANCE-2's OWN RECORDS THROUGH THE REPAIRED PATH ──
  console.log('\n=== 6. ENDURANCE-2 replayed through the repaired path ===');
  const e2 = join(process.cwd(), 'legasus', 'screen', 'ENDURANCE-2_summary.jsonl');
  if (existsSync(e2)) {
    const rep = buildReport(e2, { experiment: 'ENDURANCE-2-replay' });
    say(rep.runs.length === 208, `all 208 attempts replay (${rep.runs.length})`);
    // THE ORIGINAL FALSE ALARM IS GONE, and what remains is a REAL omission.
    //
    // ENDURANCE-2 flagged 77 runs for missing requested/protected, which an UNATTEMPTED run
    // correctly does not have. Those are no longer flagged. The same 77 are still flagged for
    // missing `reason` - and that is CORRECT: the old row builder never recorded one, so the
    // historical data genuinely cannot say why those runs were skipped. The check now reports
    // a real gap instead of a phantom one.
    const gapKinds = [...new Set(rep.integrity.missingFields.flatMap((m) => m.gaps))];
    say(!gapKinds.includes('requested') && !gapKinds.includes('protected'),
      'the requested/protected false alarm is GONE (' + (gapKinds.join(',') || 'no gaps') + ')');
    say(gapKinds.length === 1 && gapKinds[0] === 'reason',
      `what remains is a REAL omission: the old writer never recorded WHY a run was skipped (${rep.integrity.missingFields.length} runs)`);
    say(rep.reconciliation.ok, 'reconciliation holds');
    say(rep.byStatus.UNATTEMPTED === 77 && rep.byStatus.COMPLETED === 131,
      `status accounting matches the run (${JSON.stringify(rep.byStatus)})`);
    const probes = rep.runs.filter((r) => r.arm === 'FAULT_PROBE');
    const attempted = probes.filter((r) => r.termination !== 'UNATTEMPTED');
    const restored = attempted.filter((r) => r.disposition === 'RESTORED');
    say(probes.length === 8 && attempted.length === 5 && restored.length === 5,
      `probe accounting keeps BOTH facts: ${attempted.length}/${probes.length} attempted, ${restored.length}/${attempted.length} restored`);
  } else {
    say(false, `ENDURANCE-2 summary not found at ${e2}`);
  }
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  endurance recovery: ${passed} passed, ${failed} failed -> ${failed ? 'RECOVERY IS NOT DEMONSTRATED' : 'a killed campaign recovers with no generation'}`);
process.exit(failed ? 1 : 0);
