// SHARED LOAD SAMPLER — for any experiment whose result depends on timing or process count.
//
// Built for three sessions working one 8-CPU laptop, after all three independently measured contaminated
// timings and none knew about the others. Interface specified by the BIND-1 session; the two safety
// properties below are mine and are there because of what the instrument itself did during construction.
//
//     THE BROKEN INSTRUMENT MUST NOT RETURN THE PASSING VALUE.
//
// That rule is not abstract here. The obvious command,
//
//     tasklist /FI "IMAGENAME eq node.exe" /NH
//
// is correct from cmd.exe and from execFileSync. Run through Git Bash / MSYS it is REWRITTEN - the /FI
// switch becomes a path - and fails:
//
//     ERROR: Invalid argument/option - 'C:/Program Files/Git/FI'.
//
// Piped into `grep -c node.exe` that yields 0. Not an error: a ZERO. A sampler built that way would read
// 0 processes on a machine running 263, pass any ceiling, and certify every run as clean. Measured during
// construction, on the machine this is for.
//
// So: no shell, ever. execFileSync with an argv array, and every failure mode below is a REFUSAL rather
// than a number.
import { execFileSync } from 'node:child_process';

const WIN = process.platform === 'win32';

// Deliberately small. A sampler that is slow under load changes the thing it is measuring, and this one
// is called before every witness file.
const TIMEOUT_MS = 15000;

// ONE PARSE, TWO CONSUMERS. pids() and sample() read the same tasklist output through the same
// extractor. A count and a list derived by separate code is the "principle implemented in two places"
// defect waiting to happen — they would drift, and the drift would be silent.
const pidsFrom = (out) => out.split(/\r?\n/)
  .filter((l) => /(^|[\\/\s])node(\.exe)?\b/i.test(l))
  .map((l) => { const m = l.match(/\s(\d+)\s/); return m ? Number(m[1]) : null; })
  .filter((n) => Number.isFinite(n) && n > 0);

const countFrom = (out) => pidsFrom(out).length;

// RAW NODE PIDS, or NULL if the instrument could not measure. Never an empty array on failure: an empty
// list reads as "a quiet machine" exactly the way a zero count does, which is the defect this module
// exists to refuse. Built for holder identification — snapshot at start, snapshot at timeout, diff.
export function pids() {
  try {
    if (WIN) {
      const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq node.exe', '/NH'],
        { encoding: 'utf8', timeout: TIMEOUT_MS, windowsHide: true });
      if (/^ERROR:/m.test(out)) return null;
      const list = pidsFrom(out);
      // the caller is itself node, so an EMPTY list is instrument failure, not an empty machine
      return list.length ? list : null;
    }
    const out = execFileSync('pgrep', ['node'], { encoding: 'utf8', timeout: TIMEOUT_MS });
    const list = String(out).split(/\r?\n/).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    return list.length ? list : null;
  } catch (e) { return null; }
}

// WHO IS ALIVE NOW THAT WAS NOT ALIVE THEN. Returns null if EITHER side is unmeasured, because a diff
// against an unknown is unknown — not an empty diff, which would read as "nothing new appeared".
export function newSince(beforePids, afterPids = pids()) {
  if (!Array.isArray(beforePids) || !Array.isArray(afterPids)) return null;
  const was = new Set(beforePids);
  return afterPids.filter((p) => !was.has(p));
}

// CALIBRATION — the instrument that measures CONTENTION rather than a correlate of it.
//
// Process count is a proxy and a bad one: measured on this box, 108 processes gave an 81s test and 110
// gave 13s. Count cannot see eight CPU-bound processes saturating eight cores, and it disqualifies a
// hundred idle ones that cost nothing. A fixed workload timed against a frozen reference sees both.
//
// THREE THINGS THIS GETS WRONG IF BUILT CARELESSLY, all measured rather than reasoned:
//
//   IT IS ITSELF LOAD.  A 2e8-iteration workload is one core fully saturated for ~0.8s. Run before every
//                       unit, by several sessions, the instrument becomes a contender in what it
//                       measures - and two abort-on-breach runners can then abort each other
//                       indefinitely, each firing on the other's calibration. 1e7 costs ~35ms and
//                       resolves a 3x ratio just as well.
//   COLD JIT LIES HIGH  - BUT min-of-N ALREADY HANDLES IT, and the first version of this module did not
//                       realise that. A cold run can only ever be the MAX, so min-of-N with N>=2 is
//                       self-warming by construction and a separate warm-up burn is pure self-load: the
//                       exact defect this module criticises elsewhere, committed here. Caught by the
//                       BIND-1 session. Warm-up is now run ONLY for N<2, where min cannot save you.
//   SHORT IS NOISIER.   Measured: 1.2e7 spread 1.377 vs 2e8 spread 1.185. Shorter is NOT strictly
//                       better; it trades precision for self-load. min-of-N buys the precision back.
const CALIB_ITERS = 1e7;
const CALIB_RUNS = 5;

const burn = (iters) => { let x = 0; for (let i = 0; i < iters; i++) x = (x + i * 7) % 1000003; return x; };

let warmed = false;

// Returns milliseconds, or NULL if it could not measure. NEVER a fast number on failure.
export function calibrate({ iters = CALIB_ITERS, runs = CALIB_RUNS } = {}) {
  try {
    // N>=2 is self-warming: the cold run becomes the max and min discards it. Only a single-run
    // calibration needs the burn, and it pays for it in self-load.
    if (runs < 2 && !warmed) { burn(5e6); warmed = true; }
    let best = Infinity;
    for (let k = 0; k < runs; k++) {
      const t = process.hrtime.bigint();
      burn(iters);
      const ms = Number(process.hrtime.bigint() - t) / 1e6;
      if (ms < best) best = ms;
    }
    return Number.isFinite(best) ? best : null;
  } catch (e) { return null; }
}

// ONE SAMPLE. Never throws: a sampler that throws inside a harness gets wrapped in a try/catch that
// swallows it, and the run continues unmeasured. It returns its failure as data instead.
// Accepts sample(), sample('label'), or sample({ where, calib }).
//
// `calib: false` MATTERS MORE THAN IT LOOKS. A caller that supplies its own calibration and spreads this
// result over it pays for BOTH - measured on this box at 167ms per sample, ~155ms of it a CPU burn whose
// answer is then discarded. Called before every unit, by a runner that aborts on contention, on a laptop
// shared by three sessions, that is the instrument becoming the load all over again. Pass calib:false
// when you are bringing your own.
export function sample(opts = {}) {
  const o = (typeof opts === 'string') ? { where: opts } : (opts || {});
  const { where, calib: withCalib = true } = o;
  const at = new Date().toISOString();
  try {
    let nodeProcs;
    if (WIN) {
      // argv array, no shell - this is the whole point
      const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq node.exe', '/NH'],
        { encoding: 'utf8', timeout: TIMEOUT_MS, windowsHide: true });
      if (/^ERROR:/m.test(out)) {
        return { at, where, nodeProcs: null, cpuPct: null,
          error: 'tasklist: ' + out.trim().slice(0, 120) };
      }
      nodeProcs = countFrom(out);
    } else {
      const out = execFileSync('pgrep', ['-c', 'node'], { encoding: 'utf8', timeout: TIMEOUT_MS });
      nodeProcs = Number(String(out).trim());
      if (!Number.isFinite(nodeProcs)) {
        return { at, where, nodeProcs: null, cpuPct: null,
          error: 'pgrep returned unparseable output' };
      }
    }
    // cpuPct is NULL ON PURPOSE. Every cheap Windows instrument for it is wrong under load and every
    // correct one is slow. Reporting a bad number would be worse than reporting none, and an absent
    // field is honest in a way a plausible one is not.
    return { at, where, nodeProcs, cpuPct: null, calibMs: withCalib ? calibrate() : undefined };
  } catch (e) {
    // pgrep exits 1 when nothing matches - a real zero on a machine not running node
    if (!WIN && e && e.status === 1) return { at, where, nodeProcs: 0, cpuPct: null };
    return { at, where, nodeProcs: null, cpuPct: null,
      error: String((e && e.message) || e).slice(0, 160) };
  }
}

export const UNMEASURED = 'UNMEASURED';
export const SUSPECT_ZERO = 'SUSPECT_ZERO';

// THE VERDICT IS A PURE FUNCTION OF FROZEN INPUTS. Nothing here reads the clock, the machine, or the
// result the samples were taken around - so "was the machine too busy?" cannot be decided after seeing
// the number it would disqualify. Freeze the ceiling before the run and let it fire against you.
export const CALIB_SLOW = 'CALIB_SLOW';

// Accepts the frozen BIND-1 shape { ceiling, calibReferenceMs, calibRatio }, or a bare number for the
// count-only callers that predate calibration.
export function verdict(samples, lim) {
  const L = (typeof lim === 'number' || lim === undefined) ? { ceiling: lim } : (lim || {});
  const { ceiling, calibReferenceMs, calibRatio } = L;
  const checkCalib = Number.isFinite(calibReferenceMs) && Number.isFinite(calibRatio);
  const capMs = checkCalib ? calibReferenceMs * calibRatio : null;

  const list = Array.isArray(samples) ? samples : [];
  const breachedAt = [];
  const unmeasured = [];
  let worst = 0;
  let worstMs = 0;
  const overRatio = [];

  for (const s of list) {
    const n = s && s.nodeProcs;
    if (n === null || n === undefined || !Number.isFinite(n)) {
      // AN INSTRUMENT THAT COULD NOT MEASURE IS NOT A QUIET MACHINE.
      unmeasured.push({ at: s && s.at, reason: (s && s.error) || UNMEASURED });
      continue;
    }
    if (n > worst) worst = n;
    // A CORRECT COUNT CAN NEVER BE 0 HERE: the caller is itself a node process. Zero means the
    // instrument failed in a way that looks like success - the exact failure this module exists to
    // refuse - so it is never evidence of quiet.
    if (n === 0) { unmeasured.push({ at: s && s.at, reason: SUSPECT_ZERO }); continue; }
    if (Number.isFinite(ceiling) && n > ceiling) breachedAt.push({ at: s && s.at, nodeProcs: n });

    if (checkCalib) {
      const ms = s.calibMs;
      // A CALIBRATION THAT DID NOT RUN IS UNMEASURED, NEVER FAST. Same refusal as the count.
      if (ms === null || ms === undefined || !Number.isFinite(ms)) {
        unmeasured.push({ at: s && s.at, reason: UNMEASURED + ' (calibration)' });
        continue;
      }
      if (ms > worstMs) worstMs = ms;
      if (ms > capMs) overRatio.push({ at: s && s.at, calibMs: ms, ratio: +(ms / calibReferenceMs).toFixed(2) });
    }
  }

  const noSamples = list.length === 0;
  const ok = !noSamples && breachedAt.length === 0 && unmeasured.length === 0 && overRatio.length === 0;
  return {
    ok,
    worst,
    breachedAt,
    unmeasured,
    calib: checkCalib ? { worstMs, overRatio, referenceMs: calibReferenceMs, ratio: calibRatio,
      capMs } : null,
    ceiling,
    samples: list.length,
    why: noSamples
      ? 'NOT OK: no samples were taken. An unmeasured run is UNOBSERVABLE, not clean.'
      : unmeasured.length
        ? 'NOT OK: ' + unmeasured.length + ' sample(s) did not measure (' + unmeasured[0].reason
          + '). An instrument that could not measure is not evidence of a quiet machine.'
        : overRatio.length
          ? 'NOT OK: ' + overRatio.length + ' sample(s) over ' + calibRatio + 'x the frozen reference of '
            + calibReferenceMs + 'ms (cap ' + capMs + 'ms, worst ' + worstMs.toFixed(1) + 'ms).'
            + ' CONTENTION measured directly, not inferred from process count. UNOBSERVABLE (load).'
          : breachedAt.length
            ? 'NOT OK: ' + breachedAt.length + ' sample(s) exceeded the frozen ceiling of ' + ceiling
              + ', worst ' + worst + '. This attempt is UNOBSERVABLE (load) - preserve and label it;'
              + ' it says nothing about the subject.'
            : 'OK: ' + list.length + ' sample(s), worst count ' + worst
              + (checkCalib ? ', worst calibration ' + worstMs.toFixed(1) + 'ms against a '
                + capMs + 'ms cap' : ', ceiling ' + ceiling),
  };
}
