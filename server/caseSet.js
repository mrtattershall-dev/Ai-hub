/**
 * caseSet.js - WHICH graded cases a candidate passes, case by case, measured outside its reach.
 *
 * A net "case delta" hides the thing that matters most: a candidate can gain four cases and
 * lose one, and the loss may be a protected case. So this returns the SETS - which case
 * numbers pass, which fail - and the caller reports newly-passing and newly-failing
 * separately. Counts are per task and are never pooled across tasks: the 15 tasks have
 * between 5 and 12 cases each, so a pooled total weights the wide tasks and reads as
 * progress that a per-task view would not support.
 *
 * MEASURED OUTSIDE THE CANDIDATE'S REACH, on the same principle as the evaluator: the
 * candidate's tree is copied to a scratch directory and the runner and case file are
 * OVERWRITTEN with pristine copies before anything executes. A candidate that edited its own
 * run_tests.py or task_cases.jsonl (the tampering case taskTests.test.mjs exercises) changes
 * nothing here. The scratch copy is what runs in the worker; the candidate is never executed
 * from its own directory by this module.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WORKER_IMAGE } from './worker.js';
import { RUN_TESTS_PY } from './taskTests.js';

const exec = promisify(execFile);

/**
 * Run the pristine case runner against a candidate directory inside the worker.
 * Returns { passing: Set<number>, failing: Set<number>, total, error }.
 */
export async function caseSet(candidateDir, moduleName, casesJsonl, { image = WORKER_IMAGE, timeoutSec = 90, dockerCmd = 'docker' } = {}) {
  // EVAL-1 hung for two hours here: Docker stopped returning from containers and this call had
  // no host-side timeout, so the campaign's post-processing waited forever - outside every
  // per-unit wall. The container's own `timeout` cannot help when docker itself does not
  // return. Now: a bounded exec, a NAMED container, and a forced removal on timeout.
  const name = `caseset-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const scratch = mkdtempSync(join(tmpdir(), 'caseset-'));
  try {
    cpSync(candidateDir, scratch, { recursive: true, filter: (src) => !src.includes('.git') });
    // PRISTINE, always - written after the copy so a tampered workspace copy is overwritten.
    writeFileSync(join(scratch, 'run_tests.py'), RUN_TESTS_PY(moduleName, 'task_cases.jsonl', 100000), 'utf8');   // uncapped: every case listed, so the sets are exact
    writeFileSync(join(scratch, 'task_cases.jsonl'), casesJsonl, 'utf8');
    const args = ['run', '--rm', '--name', name, '--network', 'none', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges', '--user', '1000:1000',
      '-v', `${scratch}:/work`, '-w', '/work', image,
      'sh', '-c', `timeout ${timeoutSec} python3 run_tests.py`];
    let out = '';
    try {
      // dockerCmd may be a string or [cmd, ...prefixArgs] (a test double is a node script).
      const [dCmd, ...dPre] = Array.isArray(dockerCmd) ? dockerCmd : [dockerCmd];
      const r = await exec(dCmd, [...dPre, ...args], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true, timeout: (timeoutSec + 30) * 1000 });
      out = String(r.stdout) + String(r.stderr);
    } catch (e) {
      if (e && e.killed) {
        // The host-side bound fired: docker did not return. Say so, and do not leave the
        // container behind (bounded too - a wedged daemon must not wedge the caller).
        try { const [c2, ...p2] = Array.isArray(dockerCmd) ? dockerCmd : [dockerCmd]; await exec(c2, [...p2, 'rm', '-f', name], { timeout: 30_000, windowsHide: true }); } catch { /* best effort */ }
        return { passing: new Set(), failing: new Set(), total: null, error: `case measurement timed out after ${timeoutSec + 30}s (docker did not return)`, timedOut: true };
      }
      out = String(e.stdout || '') + String(e.stderr || '');
      if (/CANNOT RUN/.test(out)) {
        // The candidate does not import. Every case is failing, and saying so is the point:
        // an unparseable candidate is not "zero progress", it is a specific, nameable state.
        return { passing: new Set(), failing: new Set(), total: null, error: 'candidate does not import' };
      }
    }
    const passing = new Set(), failing = new Set();
    for (const line of out.split('\n')) {
      const m = line.match(/^(PASS|FAIL|ERROR) +case (\d+)/);
      if (!m) continue;
      (m[1] === 'PASS' ? passing : failing).add(+m[2]);
    }
    const sum = out.match(/SUMMARY (\d+)\/(\d+) cases pass/);
    const total = sum ? +sum[2] : null;
    // The runner is uncapped here, so every case IS listed. If the lines and the summary ever
    // disagree the measurement is wrong and must say so rather than report a plausible set.
    const exact = !!sum && passing.size === +sum[1] && passing.size + failing.size === total;
    return { passing, failing, total, error: exact ? null : 'case lines did not reconcile with the summary', exact };
  } finally {
    try { rmSync(scratch, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

/** Newly passing / newly failing, as sorted case numbers. Never pooled across tasks. */
export function caseDiff(before, after) {
  const newlyPassing = [...(after.passing || [])].filter((c) => before.failing?.has(c)).sort((a, b) => a - b);
  const newlyFailing = [...(after.failing || [])].filter((c) => before.passing?.has(c)).sort((a, b) => a - b);
  return { newlyPassing, newlyFailing };
}
