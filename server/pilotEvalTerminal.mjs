/**
 * pilotEvalTerminal.mjs - evaluate the PILOT-1 terminal candidates.
 *
 *   node server/pilotEvalTerminal.mjs <auditPartialDir>
 *
 * WHY THIS IS NOT AN ARBITRARY SNAPSHOT. PILOT-1 skipped evaluation for every timed-out task on
 * the grounds that an unfinished workspace is a mid-edit state. That was wrong. Once execution
 * is CONFIRMED STOPPED, the preserved workspace is not an arbitrary intermediate - it is exactly
 * what survived the allotted budget, which is the thing the budget was meant to measure.
 *
 * It also closes a real gap: a model can write working code and then fail to call task_done.
 * Skipping evaluation would score that as no completion when the behaviour was delivered.
 *
 * TERMINATION AND BEHAVIOUR ARE SEPARATE AXES, and stay separate here:
 *     termination         TIMEOUT
 *     requested behaviour PASS | FAIL | EVALUATION_ERROR
 *     protected behaviour assessed independently
 * A timeout does not imply a behavioural failure, and a behavioural pass does not erase the
 * timeout.
 */
import { readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const { PILOT_TASKS } = await import('./pilotTasks.js');
const { evaluate, VERDICT } = await import('./evaluator.js');

const DIR = process.argv[2];
if (!DIR || !existsSync(DIR)) { console.error('usage: node server/pilotEvalTerminal.mjs <auditPartialDir>'); process.exit(2); }

const git = (ws, ...a) => { try { return execFileSync('git', ['-C', ws, ...a], { encoding: 'utf8' }).trim(); } catch { return null; } };

const rows = [];
for (const task of PILOT_TASKS) {
  const ws = join(DIR, `${task.id}-partial`);
  if (!existsSync(ws)) { rows.push({ task: task.id, termination: 'TIMEOUT', requested: 'MISSING', protected: 'MISSING', note: 'no preserved candidate' }); continue; }

  // The preserved copy carries the run's uncommitted work. Commit it so the candidate has an
  // IDENTITY - a verdict that cannot name what it judged is not a verdict.
  git(ws, 'add', '-A');
  git(ws, '-c', 'user.email=p@p', '-c', 'user.name=p', 'commit', '-q', '-m', 'terminal candidate as it survived the budget');
  const tree = git(ws, 'rev-parse', 'HEAD^{tree}');

  const r = await evaluate(ws, task);
  rows.push({
    task: task.id,
    termination: 'TIMEOUT',                       // unchanged by whatever the behaviour turns out to be
    requested: r.requested?.verdict ?? 'n/a',
    protected: r.protected?.verdict ?? 'n/a',
    overall: r.verdict,
    terminalTree: tree,
    detail: String(r.requested?.out || r.requested?.reason || '').replace(/\s+/g, ' ').trim().slice(0, 90),
  });
}

console.log('=== PILOT-1 terminal candidates, evaluated ===');
console.log('(termination is TIMEOUT for all five - that is a separate axis and does not change below)\n');
for (const r of rows) {
  console.log(`${r.task}`);
  console.log(`  requested=${r.requested}  protected=${r.protected}  overall=${r.overall || '-'}`);
  console.log(`  terminal tree=${String(r.terminalTree).slice(0, 12)}`);
  if (r.detail) console.log(`  ${r.detail}`);
}
const verified = rows.filter((r) => r.overall === VERDICT.PASS).length;
const evalErrors = rows.filter((r) => r.overall === VERDICT.EVALUATION_ERROR).length;
console.log(`\nVERIFIED COMPLETIONS AMONG TERMINAL CANDIDATES: ${verified}/${rows.length}` +
  (evalErrors ? `  (evaluation errors: ${evalErrors} - not code failures)` : ''));
