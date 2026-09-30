// preflight.mjs — MANDATORY before any run stream. Fail-closed.
//
// This morning acceptance read EVALUATION_ERROR for hours because the Docker engine was down; the runs
// that touched it produced result-shaped non-results. A run stream must refuse to start until the things
// a verdict depends on are proven present. Every check is deterministic and $0 — no model is called.
//
// Checks, in order (a later one is not reached if an earlier one blocks):
//   1. docker    — the engine answers
//   2. image     — the pinned worker image is present locally (offline runs cannot pull)
//   3. worker    — that image actually runs node
//   4. fixtures  — each named fixture is a real verifier: seed FAILS requested + PASSES protected,
//                  and a reference fix PASSES both. A check that cannot do both is not a verifier.
//   5. classifier— runClassify's fail control holds: a throttled run does NOT score as a model outcome
//
// A run stream calls preflight() and starts ONLY on { ok: true }. `assertPreflight()` throws otherwise.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { WORKER_IMAGE } from './worker.js';
import { evaluate, VERDICT } from './evaluator.js';
import { classifyRun, CLASS } from './runClassify.mjs';
const exec = promisify(execFile);

async function dockerUp() {
  try { const { stdout } = await exec('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 30000, windowsHide: true }); return { ok: true, detail: stdout.trim() }; }
  catch (e) { return { ok: false, detail: 'docker engine not reachable: ' + String(e.stderr || e.message).slice(0, 160) }; }
}
async function imagePresent() {
  try { const { stdout } = await exec('docker', ['image', 'inspect', WORKER_IMAGE, '--format', '{{.Id}}'], { timeout: 30000, windowsHide: true }); return { ok: true, detail: stdout.trim().slice(0, 24) }; }
  catch { return { ok: false, detail: `pinned worker image ${WORKER_IMAGE.slice(0, 20)} not present locally (offline runs cannot pull it)` }; }
}
async function workerRuns() {
  try { const { stdout } = await exec('docker', ['run', '--rm', '--network', 'none', WORKER_IMAGE, 'node', '-e', 'process.stdout.write(process.version)'], { timeout: 60000, windowsHide: true }); return { ok: /^v\d/.test(stdout.trim()), detail: 'node ' + stdout.trim() }; }
  catch (e) { return { ok: false, detail: 'worker image did not run node: ' + String(e.message).slice(0, 120) }; }
}

const dirs = [];
function ws(files) {
  const d = mkdtempSync(join(tmpdir(), 'preflight-')); dirs.push(d);
  for (const [f, b] of Object.entries(files)) { mkdirSync(dirname(join(d, f)), { recursive: true }); writeFileSync(join(d, f), b); }
  const g = (...a) => execFileSyncQuiet('git', ['-C', d, ...a]);
  g('init', '-q'); g('add', '-A'); g('-c', 'user.email=a@a', '-c', 'user.name=a', 'commit', '-q', '-m', 'x');
  return d;
}
import { execFileSync } from 'node:child_process';
function execFileSyncQuiet(c, a) { return execFileSync(c, a, { stdio: 'pipe' }); }

async function fixturesValid(fixtures) {
  const bad = [];
  for (const fx of fixtures) {
    const seed = ws(fx.seed);
    const ref = ws({ ...fx.seed, ...fx.reference });
    const s = await evaluate(seed, fx.task);
    const r = await evaluate(ref, fx.task);
    const okSeed = s.requested?.verdict === VERDICT.FAIL && s.protected?.verdict === VERDICT.PASS;
    const okRef = r.requested?.verdict === VERDICT.PASS && r.protected?.verdict === VERDICT.PASS;
    if (!okSeed || !okRef) bad.push(`${fx.task.id}: seed(${s.requested?.verdict}/${s.protected?.verdict}) ref(${r.requested?.verdict}/${r.protected?.verdict})`);
  }
  for (const d of dirs.splice(0)) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `${fixtures.length} fixture(s) fail-on-seed / pass-on-ref` };
}
function classifierSound() {
  // the fail control: a throttled run whose verdicts look like a model outcome must NOT be scored
  const throttled = classifyRun({ modelCalls: 0, pausedReason: 'openrouter is throttling this key', requested: 'FAIL', protected: 'PASS' });
  const acted = classifyRun({ modelActed: true, requested: 'FAIL', protected: 'PASS' });
  const ok = throttled === CLASS.PROVIDER_ERROR && acted === CLASS.RESTORED_OR_FAILED;
  return { ok, detail: ok ? 'PROVIDER_ERROR precedence holds; non-vacuity holds' : `broken: throttled=${throttled} acted=${acted}` };
}

/** @param fixtures [{ task, seed, reference }]  reference = files that make requested pass */
export async function preflight(fixtures = []) {
  const checks = [];
  const push = (name, r) => { checks.push({ name, ...r }); return r.ok; };
  if (!push('docker', await dockerUp())) return done(checks);
  if (!push('image', await imagePresent())) return done(checks);
  if (!push('worker', await workerRuns())) return done(checks);
  push('classifier', classifierSound());
  if (fixtures.length) push('fixtures', await fixturesValid(fixtures));
  return done(checks);
}
function done(checks) {
  const ok = checks.every((c) => c.ok);
  return { ok, checks, blockedBy: ok ? null : checks.filter((c) => !c.ok).map((c) => c.name) };
}
export async function assertPreflight(fixtures = []) {
  const r = await preflight(fixtures);
  if (!r.ok) throw new Error('PREFLIGHT BLOCKED (' + r.blockedBy.join(', ') + '): ' + r.checks.filter((c) => !c.ok).map((c) => c.name + ' — ' + c.detail).join(' | '));
  return r;
}
