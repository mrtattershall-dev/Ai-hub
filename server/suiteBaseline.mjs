/**
 * suiteBaseline.mjs - run every server/*.test.mjs once, sequentially, and record the result
 * per file. This exists because Phase 1's C4 requires the hub suite to pass IDENTICALLY with
 * the LegaCore consumer on and off, and "identically" needs a recorded BEFORE.
 *
 *   node server/suiteBaseline.mjs [--out FILE] [--timeout MS] [--only SUBSTR]
 *
 * SEQUENTIAL ON PURPOSE. COORD records a full sweep reporting `queueLock` FAILING when
 * queueLock was fine - it had lost a coin toss against another test for a port. Running these
 * in parallel manufactures failures that are properties of the harness, not the code.
 *
 * The exit STATUS of each child is the verdict - never the presence of output, and never a
 * "passed" string in stdout. That distinction has cost this project a day: the Set G
 * regression rig parsed a checker's output file without checking spawnSync status and
 * committed an empty result that looked like a completed run.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const OUT = arg('--out', join(HERE, 'suite-baseline.json'));
const TIMEOUT = parseInt(arg('--timeout', '600000'), 10);
const ONLY = arg('--only', '');

const files = readdirSync(HERE)
  .filter((f) => f.endsWith('.test.mjs'))
  .filter((f) => !ONLY || f.includes(ONLY))
  .sort();

console.log(`suiteBaseline: ${files.length} test files, sequential, ${TIMEOUT / 1000}s cap each`);
console.log(`node ${process.version}  cwd ${HERE}`);

const rows = [];
const t0 = Date.now();

for (const [i, f] of files.entries()) {
  const started = Date.now();
  const r = spawnSync(process.execPath, [join(HERE, f)], {
    cwd: HERE, encoding: 'utf8', timeout: TIMEOUT, windowsHide: true,
    // Each test sets its own isolation env (AGENT_WORKSPACE, AGENT_QUEUE_FILE, HUB_DB...).
    // Passing the parent env through unchanged is what they expect.
    env: process.env,
  });
  const secs = Math.round((Date.now() - started) / 1000);
  // status === 0 is the ONLY pass. A timeout gives status null + signal, and an ENOENT-style
  // spawn failure gives r.error - both are failures, and both are named as such.
  const ok = !r.error && r.status === 0;
  const why = r.error ? `spawn: ${r.error.message}`
    : r.signal ? `killed by ${r.signal} (timeout at ${TIMEOUT / 1000}s?)`
    : r.status !== 0 ? `exit ${r.status}`
    : '';
  // The last non-empty stdout line is usually the test's own summary ("reset guard: 6 passed").
  const tail = String(r.stdout || '').trim().split('\n').filter(Boolean).pop() || '';
  rows.push({ file: f, ok, status: r.status, signal: r.signal || null, secs, why, tail: tail.slice(0, 160) });
  console.log(`${String(i + 1).padStart(3)}/${files.length}  ${ok ? 'PASS' : 'FAIL'}  ${String(secs).padStart(4)}s  ${f.padEnd(34)}${ok ? tail.slice(0, 70) : why}`);
}

const passed = rows.filter((r) => r.ok).length;
const rec = {
  takenAt: new Date().toISOString(),
  node: process.version,
  files: files.length,
  passed,
  failed: files.length - passed,
  totalSecs: Math.round((Date.now() - t0) / 1000),
  rows,
};
writeFileSync(OUT, JSON.stringify(rec, null, 2));

console.log(`\n${passed}/${files.length} passed in ${rec.totalSecs}s -> ${OUT}`);
if (passed !== files.length) {
  console.log('FAILING:');
  for (const r of rows.filter((x) => !x.ok)) console.log(`  ${r.file}  ${r.why}`);
}
// A baseline is a RECORD, not a gate: a pre-existing failure is part of the baseline and must
// not stop it being written. Exit 0 unless the baseline itself could not be produced.
process.exit(0);
