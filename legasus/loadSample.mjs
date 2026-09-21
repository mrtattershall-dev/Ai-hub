/**
 * loadSample.mjs - the machine's load, sampled DURING a run and stored WITH its result.
 *
 * Why (Session 75, 2026-09-20): contamination without a baseline is invisible and presents
 * as a true positive. A witness that takes 81s under load reads as a slow witness, and a
 * timing rule then classifies it by the machine's state while looking like a rule about the
 * witness. So every timing-sensitive run samples the load at start, before each unit, and
 * at end, and the verdict against PREREGISTERED limits is a function of those samples and
 * nothing else - never a judgement made after the number is seen.
 *
 * TWO INSTRUMENTS, because one is not enough (BIND-1_PREREG.md, Amendments A1 and A2):
 *   nodeProcs  a process COUNT. Screens; fails safe; measures nothing about contention -
 *              81.1s at 108 processes, 13.0s at 110, same test.
 *   calibMs    wall time of a fixed single-threaded workload. MEASURES contention: eight
 *              CPU-bound processes saturate eight cores under any count ceiling, and this
 *              is the only cheap instrument that sees it. (`typeperf` reads the right
 *              counter but took 2-8s per sample under load; a slow sampler changes the
 *              thing it measures.)
 *
 * Session 75's shared implementation (benchmarks/load-sampler.mjs) is used when present and
 * a stand-in of the same shape otherwise; every sample RECORDS WHICH ONE answered.
 *
 *   sample(where)          -> { at, where, nodeProcs, calibMs, source, error? }
 *   verdict(samples, lim)  -> { ok, worst, breachedAt, unmeasured, calib: {...}, why }
 *     lim = { ceiling, calibReferenceMs, calibRatio }
 */
import { spawnSync } from 'node:child_process';

let shared = null;
try {
  const m = await import('../benchmarks/load-sampler.mjs');
  if (typeof m.sample === 'function' && typeof m.verdict === 'function') shared = m;
} catch { /* not on this worktree yet - stand-in below */ }

/**
 * Cheap even under load: tasklist answers in well under a second when CIM takes minutes.
 *
 * Spawned DIRECTLY, never through a shell. Under Git Bash / MSYS the `/FI` switch is
 * rewritten into a path, the command errors, and a shell pipeline reads that as ZERO
 * processes - which passes every ceiling. The broken instrument returns the passing value.
 *
 *   A FAILED SAMPLE IS NOT A LOW SAMPLE - error, timeout or unparseable output gives null
 *   with the reason, never 0.
 *   A ZERO IS SUSPECT - this very process is node, so a correct count can never be 0.
 */
function countNodeProcesses() {
  try {
    if (process.platform === 'win32') {
      const r = spawnSync('tasklist', ['/FI', 'IMAGENAME eq node.exe', '/NH'], { encoding: 'utf8', timeout: 15_000, shell: false });
      if (r.error) return { n: null, error: `tasklist: ${r.error.message}` };
      if (r.status !== 0) return { n: null, error: `tasklist exit ${r.status}: ${(r.stderr || r.stdout || '').trim().slice(0, 120)}` };
      const n = (r.stdout || '').split('\n').filter((l) => /node\.exe/i.test(l)).length;
      return n === 0 ? { n: null, error: 'tasklist counted 0 node processes, but this sampler IS a node process - instrument failure' } : { n };
    }
    const r = spawnSync('pgrep', ['-c', 'node'], { encoding: 'utf8', timeout: 15_000, shell: false });
    if (r.error) return { n: null, error: `pgrep: ${r.error.message}` };
    const n = Number((r.stdout || '').trim());
    if (!Number.isFinite(n)) return { n: null, error: `pgrep output unparseable: ${(r.stdout || '').slice(0, 60)}` };
    return n === 0 ? { n: null, error: 'pgrep counted 0 node processes, but this sampler IS a node process - instrument failure' } : { n };
  } catch (e) {
    return { n: null, error: String((e && e.message) || e) };
  }
}

/**
 * The frozen calibration workload (Amendment A2). Deterministic; the result is returned so it
 * cannot be optimised away. One sample is the MINIMUM of CALIB_RUNS back-to-back runs: the
 * question is how fast this core can go right now, and an interruption only ever slows a run.
 * Short on purpose - 2e8 iterations before every witness was itself synchronised load.
 *
 * CALIB_REFERENCE_MS is a CONSTANT captured once on a machine both instruments called quiet
 * (min of 20 runs 34.97ms, node count 11, 2026-09-20 18:58:43Z; provenance in
 * BIND-1_PREREG.md A2). Machine-specific by construction: anywhere else it is RELATIVE-ONLY.
 */
export const CALIB_ITERATIONS = 1e7;
export const CALIB_RUNS = 5;
export const CALIB_REFERENCE_MS = 35;
export function calibrate() {
  const runs = [];
  let x = 0;
  for (let k = 0; k < CALIB_RUNS; k++) {
    const t = process.hrtime.bigint();
    x = 0;
    for (let i = 0; i < CALIB_ITERATIONS; i++) x = (x + i * 7) % 1000003;
    runs.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  return { calibMs: Math.round(Math.min(...runs) * 10) / 10, calibRunsMs: runs.map((r) => Math.round(r * 10) / 10), calibResult: x };
}

export function sample(where = '') {
  const calib = calibrate();
  // Exactly ONE calibration per sample: the shared sampler calibrates by default, so ask it
  // for the count only (calib:false) and layer this module's calibration over it. Spreading
  // its default output paid the burn twice (75 measured 342ms vs 175ms per sample, 49d64da).
  if (shared) return { ...shared.sample({ where, calib: false }), where, ...calib, source: 'benchmarks/load-sampler.mjs (count) + stand-in calibration' };
  const c = countNodeProcesses();
  return { at: new Date().toISOString(), where, nodeProcs: c.n, ...calib, ...(c.error ? { error: c.error } : {}), source: 'legasus/loadSample.mjs (stand-in)' };
}

/**
 * Pure function of its arguments. A sample that could not measure is NOT ok; null never
 * compares as "under the ceiling". Calibration limits are optional so the count screen can
 * be used alone by callers that have no baseline yet.
 */
export function verdict(samples, lim) {
  const limits = typeof lim === 'number' ? { ceiling: lim } : (lim || {});
  const { ceiling, calibReferenceMs = null, calibRatio = null } = limits;
  const measured = samples.filter((s) => Number.isFinite(s.nodeProcs));
  // "unmeasured", not "failed": it makes the attempt UNOBSERVABLE, and is not a result.
  const unmeasured = samples.filter((s) => !Number.isFinite(s.nodeProcs));
  const worst = measured.length ? Math.max(...measured.map((s) => s.nodeProcs)) : null;
  const breachedAt = Number.isFinite(ceiling) ? measured.filter((s) => s.nodeProcs > ceiling) : [];

  const withCalib = samples.filter((s) => Number.isFinite(s.calibMs));
  const calibWorst = withCalib.length ? Math.max(...withCalib.map((s) => s.calibMs)) : null;
  // A2: one constant, one ratio; the first sample is held to it like every other.
  const calibLimitMs = Number.isFinite(calibReferenceMs) && Number.isFinite(calibRatio) ? calibRatio * calibReferenceMs : null;
  const overRatio = Number.isFinite(calibLimitMs) ? withCalib.filter((s) => s.calibMs > calibLimitMs) : [];

  const why = [];
  if (unmeasured.length) why.push(`${unmeasured.length} sample(s) unmeasured (instrument gave no number)`);
  if (breachedAt.length) why.push(`${breachedAt.length} sample(s) over the count ceiling ${ceiling} (worst ${worst})`);
  if (overRatio.length) why.push(`${overRatio.length} calibration sample(s) over ${calibRatio}x the frozen reference ${calibReferenceMs}ms = ${calibLimitMs}ms (worst ${calibWorst}ms)`);

  return {
    ok: !unmeasured.length && !breachedAt.length && !overRatio.length,
    ceiling, worst, breachedAt, unmeasured,
    calib: { referenceMs: calibReferenceMs, ratio: calibRatio, limitMs: calibLimitMs, worstMs: calibWorst, overRatio },
    why: why.join('; ') || 'within every preregistered limit',
  };
}

export const SOURCE = shared ? 'benchmarks/load-sampler.mjs (count) + stand-in calibration' : 'legasus/loadSample.mjs (stand-in)';
