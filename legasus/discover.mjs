/**
 * discover.mjs - DISCOVER: which catalogued witnesses execute the region?
 *
 *   node legasus/discover.mjs <subject-file> <function-name> <out-dir>
 *
 * Every catalogued file is run ONCE, unmodified, from the repo root (its documented
 * invocation), under NODE_V8_COVERAGE. Child processes a witness spawns inherit the
 * variable and write their own coverage files into the same directory, so a witness that
 * reaches the subject through a spawned hub still counts - the union is taken and the
 * number of contributing processes is recorded.
 *
 * Per file: EXECUTED | NOT_EXECUTED | WITNESS_ERROR | UNOBSERVABLE, plus exit code and
 * duration, which BIND uses for its frozen granularity and budget rules.
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

/** Kill a child AND everything it spawned. Windows does not do this for us. */
function killTree(child) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* not a group leader */ } }
  try { child.kill(); } catch { /* already gone */ }
}
import { fileURLToPath } from 'node:url';
import { locateFunction, regionCountsFromFiles, fileUrl } from './coverage.mjs';
import { sample, verdict, CALIB_REFERENCE_MS, SOURCE as LOAD_SOURCE } from './loadSample.mjs';

// Frozen in BIND-1_PREREG.md before attempt 2 (and Amendment A1): the count is a SCREEN,
// the calibration workload is the MEASUREMENT. Any sample outside either limit makes the
// whole attempt UNOBSERVABLE (load), by rule, from the samples - never from the durations.
const LOAD_CEILING = 40;
// A2: the reference is a frozen constant (loadSample.mjs / PREREG A2), not a start baseline.
const CALIB_RATIO = 3.0;
const calibBaselineMs = CALIB_REFERENCE_MS;   // kept under this name so every record still carries it
const limits = () => ({ ceiling: LOAD_CEILING, calibReferenceMs: CALIB_REFERENCE_MS, calibRatio: CALIB_RATIO });
const loadSamples = [];
// A sample outside the limits ABORTS at once. Marking the attempt at the end would be enough
// for the verdict, but a leak that grows monotonically passes a start check and then
// contaminates every later duration - and every minute this runner keeps going under load,
// it is also the load in someone else's measurement. So the first breach ends the run,
// writes what was observed, labelled, and exits 3.
const takeSample = (where) => {
  const s = sample(where);
  loadSamples.push(s);
  const v = verdict([s], limits());   // THIS sample against the frozen limits; null never passes
  if (!v.ok) abortForLoad(where, v.why);
  return s;
};
function abortForLoad(where, why) {
  const load = verdict(loadSamples, limits());
  const attempt = { status: 'UNOBSERVABLE_LOAD', load, sampler: LOAD_SOURCE, calibBaselineMs,
    reason: `aborted at "${where}": ${why}; this DISCOVER is not a result and BIND must not run on it` };
  try { writeFileSync(join(outDir, 'discover.json'), JSON.stringify({ attempt, loadSamples, subject, fnName, region, budgetMs: BUDGET_MS, tally: {}, results: results || [] }, null, 2)); } catch { /* the exit code still says it */ }
  console.log(`load verdict: UNOBSERVABLE_LOAD - ${attempt.reason}`);
  process.exit(3);
}
let results = [];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [subjectArg, fnName, outArg] = process.argv.slice(2);
if (!subjectArg || !fnName || !outArg) {
  console.error('usage: node legasus/discover.mjs <subject-file> <function-name> <out-dir>');
  process.exit(2);
}
const subject = resolve(subjectArg);
const outDir = resolve(outArg);
mkdirSync(outDir, { recursive: true });
const BUDGET_MS = 180_000;

const src = readFileSync(subject, 'utf8');
const loc = locateFunction(src, fnName);
if (!loc) { console.error(`no function named ${fnName}`); process.exit(2); }
// For DISCOVER the "site" is the function body start: function-level execution is the question.
const region = { fnStart: loc.fnStart, fnEnd: loc.fnEnd, site: loc.bodyStart + 1 };

/** The frozen catalog, by the globs in BIND-1.md. */
function catalog() {
  const pick = (dir, re) => existsSync(join(ROOT, dir))
    ? readdirSync(join(ROOT, dir)).filter((f) => re.test(f)).map((f) => join(dir, f)) : [];
  return [
    ...pick('server', /\.test\.mjs$/),
    ...pick('server', /^policy_test\.mjs$/),
    ...pick('server', /^selftest\.mjs$/),
    ...pick('client/src/lib', /\.test\.mjs$/),
    ...pick('training-data/factory', /\.test\.mjs$/),
  ].map((p) => p.replace(/\\/g, '/'));
}

function runOne(rel) {
  return new Promise((done) => {
    const covDir = join(outDir, 'cov', rel.replace(/[\\/]/g, '__'));
    rmSync(covDir, { recursive: true, force: true });
    mkdirSync(covDir, { recursive: true });
    const t0 = Date.now();
    let out = '';
    const child = spawn(process.execPath, [rel], {
      cwd: ROOT, env: { ...process.env, NODE_V8_COVERAGE: covDir }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killTree(child) }, BUDGET_MS);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const ms = Date.now() - t0;
      let files = [];
      try { files = readdirSync(covDir).filter((f) => f.endsWith('.json')).map((f) => join(covDir, f)); } catch { /* none */ }
      const c = regionCountsFromFiles(files, fileUrl(subject), region);
      let status;
      if (timedOut) status = 'UNOBSERVABLE';
      else if (!files.length || (c.unreadable === files.length)) status = 'UNOBSERVABLE';
      else if (c.fnCount > 0) status = 'EXECUTED';
      else if (code !== 0 && !/passed/i.test(out)) status = 'WITNESS_ERROR';
      else status = 'NOT_EXECUTED';
      done({
        file: rel, status, fnCount: c.fnCount, exitCode: code, signal, ms, timedOut,
        baselineValid: code === 0 && !timedOut,
        coverageFiles: files.length, subjectSeenInCoverage: c.scriptSeen,
        perCaseLines: (out.match(/^\s*(PASS|FAIL)\s+\S/gm) || []).length,
        tail: out.trim().split('\n').slice(-2).join(' | ').slice(0, 160),
      });
    });
  });
}

const files = catalog();
console.log(`DISCOVER ${subject} :: ${fnName}  over ${files.length} catalogued witness files`);
console.log(`load sampler: ${LOAD_SOURCE}; ceiling ${LOAD_CEILING} node processes; start=${takeSample('start').nodeProcs}`);
results = [];
for (const f of files) {
  // The sample is stored ON the result, so every duration carries the load it was taken under.
  const before = takeSample(`before ${f}`);
  const r = await runOne(f);
  r.nodeProcsBefore = before.nodeProcs;
  results.push(r);
  r.calibMsBefore = before.calibMs;
  console.log(`  ${r.status.padEnd(14)} ${String(r.ms).padStart(7)}ms  exit=${r.exitCode}  fn=${r.fnCount}  cases=${r.perCaseLines}  load=${before.nodeProcs}/${before.calibMs}ms  ${f}`);
}
takeSample('end');
const load = verdict(loadSamples, limits());
const attempt = load.ok
  ? { status: 'OBSERVED', load, sampler: LOAD_SOURCE, calibBaselineMs }
  : { status: 'UNOBSERVABLE_LOAD', load, sampler: LOAD_SOURCE, calibBaselineMs,
      reason: `${load.why}; this DISCOVER is not a result and BIND must not run on it` };
const tally = {};
for (const r of results) tally[r.status] = (tally[r.status] || 0) + 1;
writeFileSync(join(outDir, 'discover.json'), JSON.stringify({ attempt, loadSamples, subject, fnName, region, budgetMs: BUDGET_MS, tally, results }, null, 2));
console.log('tally:', JSON.stringify(tally));
console.log(`load verdict: ${attempt.status} (worst ${load.worst}, ceiling ${LOAD_CEILING}, ${loadSamples.length} samples)`);
console.log(`-> ${join(outDir, 'discover.json')}`);
if (attempt.status !== 'OBSERVED') process.exit(3);
