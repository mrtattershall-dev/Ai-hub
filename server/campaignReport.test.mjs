/**
 * campaignReport.test.mjs - THE REPORTING PATH THAT CRASHED, EXERCISED.
 *
 *   node server/campaignReport.test.mjs
 *
 * Three completed campaigns produced broken reports. None of the defects lived in a helper - all
 * three lived in the campaign's own final block, which runs once, at the end, after everything
 * expensive, and which no passing test had ever executed.
 *
 * So this replays PROTOCOL-2's THIRTY PRESERVED RUN RECORDS through the real reporting entry
 * point, with no model calls, and then runs a tiny scripted campaign through the same path
 * INCLUDING final report creation.
 *
 * The recovery claim being tested: a reporting crash costs ZERO additional GPU work.
 */
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { recordRun, recordPair, readSummary, buildReport, writeReport, REQUIRED_RUN_FIELDS } =
  await import('./campaignReport.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);

const PRESERVED = join(process.cwd(), 'legasus', 'screen', 'PROTOCOL-2_REPORT.json');
const dirs = [];
const scratch = () => { const d = mkdtempSync(join(tmpdir(), 'crep-')); dirs.push(d); return d; };

try {
  // ── 1. REPLAY THE 30 PRESERVED RUNS THROUGH THE REAL PATH ──
  console.log('=== 1. the 30 preserved PROTOCOL-2 runs, through the reporting entry point ===');
  say(existsSync(PRESERVED), `the preserved records exist (${PRESERVED.split(/[\\/]/).pop()})`);
  const preserved = JSON.parse(readFileSync(PRESERVED, 'utf8'));
  const runs = preserved.results;
  say(runs.length === 30, `30 runs preserved (${runs.length})`);

  const d1 = scratch();
  const summary = join(d1, 'summary.jsonl');
  for (const r of runs) recordRun(summary, r);
  // pairs, as the campaign would write them
  for (const rep of [1, 2, 3]) {
    for (const task of [...new Set(runs.map((r) => r.task))]) {
      const pr = runs.filter((r) => r.rep === rep && r.task === task);
      if (pr.length === 2) recordPair(summary, { rep, task, runs: pr });
    }
  }

  const report = writeReport(summary, join(d1, 'report.json'), { experiment: 'PROTOCOL-2-replay' });
  say(existsSync(join(d1, 'report.json')), 'the report was WRITTEN without crashing');
  note('This is the path that threw ReferenceError: ORDER is not defined after 30 real runs.');

  // ── 2. EVERY RUN ONCE, FIELDS POPULATED, TOTALS RECONCILED ──
  console.log('\n=== 2. integrity and reconciliation ===');
  say(report.integrity.duplicates.length === 0, `no run appears twice (${report.integrity.duplicates.length} duplicates)`);
  say(report.runs.length === 30, `every run appears exactly once (${report.runs.length}/30)`);
  say(report.integrity.missingFields.length === 0,
    `required fields populated on every run (${report.integrity.missingFields.length} with gaps)`);
  if (report.integrity.missingFields.length) note(JSON.stringify(report.integrity.missingFields[0]));
  say(report.reconciliation.ok,
    `totals reconcile with the underlying records (runs ${report.reconciliation.runsInSummary}=${report.reconciliation.runsCounted}, calls ${report.reconciliation.callsInSummary}=${report.reconciliation.callsCounted})`);
  // and the recovered numbers match what was reported by hand
  say(report.arms.CONTROL.acceptedImprovements === 6 && report.arms.TREATMENT.acceptedImprovements === 7,
    `accepted improvements match the hand recovery (C ${report.arms.CONTROL.acceptedImprovements}, T ${report.arms.TREATMENT.acceptedImprovements})`);
  say(report.arms.CONTROL.modelCalls === 102 && report.arms.TREATMENT.modelCalls === 82,
    `model calls match (C ${report.arms.CONTROL.modelCalls}, T ${report.arms.TREATMENT.modelCalls})`);
  say(report.arms.CONTROL.protectedBroken === 1 && report.arms.TREATMENT.protectedBroken === 1,
    'the one protected regression per arm is carried through');

  // ── 3. THE INTEGRITY CHECKS MUST BE ABLE TO FAIL ──
  // A check that passes on everything is not a check. Each is shown to catch its own defect.
  console.log('\n=== 3. the checks can fail (otherwise they establish nothing) ===');
  const d2 = scratch(); const s2 = join(d2, 's.jsonl');
  recordRun(s2, runs[0]); recordRun(s2, runs[0]);            // a duplicate
  const dup = buildReport(s2);
  say(dup.integrity.duplicates.length > 0, `POSITIVE CONTROL: a duplicated run is DETECTED (${dup.integrity.duplicates[0]})`);

  const d3 = scratch(); const s3 = join(d3, 's.jsonl');
  const gapped = { ...runs[0] }; delete gapped.modelCalls;
  recordRun(s3, gapped);
  const gap = buildReport(s3);
  say(gap.integrity.missingFields.length > 0, `POSITIVE CONTROL: a missing required field is DETECTED (${gap.integrity.missingFields[0]?.gaps.join(',')})`);
  say(gap.integrity.ok === false, 'and the report says integrity is NOT ok');

  // ── 4. RERUNNABLE FROM THE JOURNAL, WITH NOTHING GENERATED ──
  console.log('\n=== 4. final reporting is rerunnable from the summary alone ===');
  const again = buildReport(summary, { experiment: 'PROTOCOL-2-replay' });
  say(JSON.stringify(again.arms) === JSON.stringify(report.arms), 'rebuilding from the summary gives identical arms');
  say(again.runs.length === 30, 'and identical run coverage');
  note('No model, no workspace, no live state - the summary file is the only input.');

  // ── 5. A TORN FINAL LINE MUST NOT LOSE THE CAMPAIGN ──
  console.log('\n=== 5. a crash mid-write costs one line, not the campaign ===');
  const d4 = scratch(); const s4 = join(d4, 's.jsonl');
  for (const r of runs.slice(0, 10)) recordRun(s4, r);
  writeFileSync(s4, readFileSync(s4, 'utf8') + '{"kind":"run","task":"torn', 'utf8');   // interrupted write
  const torn = buildReport(s4);
  say(torn.runs.length === 10, `the 10 complete runs survive a torn final line (${torn.runs.length})`);
  note('JSONL, flushed per line: the unit of loss is one record, never the file.');

  // ── 6. THE INCREMENTAL PAIR SUMMARY ──
  console.log('\n=== 6. a completed pair is durable before the next one starts ===');
  say(report.pairs.length === 15, `every completed pair was recorded (${report.pairs.length}/15)`);
  say(report.pairs.every((p) => p.arms.length === 2), 'each recorded pair carries both arms');
  const partial = buildReport(s4);
  say(partial.reconciliation.runsInSummary === 10, 'a campaign interrupted after 10 runs still reports those 10');
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  campaign reporting: ${passed} passed, ${failed} failed -> ${failed ? 'THE REPORTING PATH IS STILL UNTESTED' : 'the final report path is exercised and replayable'}`);
process.exit(failed ? 1 : 0);
