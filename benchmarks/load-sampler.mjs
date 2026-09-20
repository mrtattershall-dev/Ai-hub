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

const countFrom = (out) => out.split(/\r?\n/).filter((l) => /(^|[\\/\s])node(\.exe)?\b/i.test(l)).length;

// ONE SAMPLE. Never throws: a sampler that throws inside a harness gets wrapped in a try/catch that
// swallows it, and the run continues unmeasured. It returns its failure as data instead.
export function sample() {
  const at = new Date().toISOString();
  try {
    let nodeProcs;
    if (WIN) {
      // argv array, no shell - this is the whole point
      const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq node.exe', '/NH'],
        { encoding: 'utf8', timeout: TIMEOUT_MS, windowsHide: true });
      if (/^ERROR:/m.test(out)) {
        return { at, nodeProcs: null, cpuPct: null, error: 'tasklist: ' + out.trim().slice(0, 120) };
      }
      nodeProcs = countFrom(out);
    } else {
      const out = execFileSync('pgrep', ['-c', 'node'], { encoding: 'utf8', timeout: TIMEOUT_MS });
      nodeProcs = Number(String(out).trim());
      if (!Number.isFinite(nodeProcs)) {
        return { at, nodeProcs: null, cpuPct: null, error: 'pgrep returned unparseable output' };
      }
    }
    // cpuPct is NULL ON PURPOSE. Every cheap Windows instrument for it is wrong under load and every
    // correct one is slow. Reporting a bad number would be worse than reporting none, and an absent
    // field is honest in a way a plausible one is not.
    return { at, nodeProcs, cpuPct: null };
  } catch (e) {
    // pgrep exits 1 when nothing matches - a real zero on a machine not running node
    if (!WIN && e && e.status === 1) return { at, nodeProcs: 0, cpuPct: null };
    return { at, nodeProcs: null, cpuPct: null,
      error: String((e && e.message) || e).slice(0, 160) };
  }
}

export const UNMEASURED = 'UNMEASURED';
export const SUSPECT_ZERO = 'SUSPECT_ZERO';

// THE VERDICT IS A PURE FUNCTION OF FROZEN INPUTS. Nothing here reads the clock, the machine, or the
// result the samples were taken around - so "was the machine too busy?" cannot be decided after seeing
// the number it would disqualify. Freeze the ceiling before the run and let it fire against you.
export function verdict(samples, ceiling) {
  const list = Array.isArray(samples) ? samples : [];
  const breachedAt = [];
  const unmeasured = [];
  let worst = 0;

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
    if (n > ceiling) breachedAt.push({ at: s && s.at, nodeProcs: n });
  }

  const noSamples = list.length === 0;
  return {
    ok: !noSamples && breachedAt.length === 0 && unmeasured.length === 0,
    worst,
    breachedAt,
    unmeasured,
    ceiling,
    samples: list.length,
    why: noSamples
      ? 'NOT OK: no samples were taken. An unmeasured run is UNOBSERVABLE, not clean.'
      : unmeasured.length
        ? 'NOT OK: ' + unmeasured.length + ' sample(s) did not measure (' + unmeasured[0].reason
          + '). An instrument that could not measure is not evidence of a quiet machine.'
        : breachedAt.length
          ? 'NOT OK: ' + breachedAt.length + ' sample(s) exceeded the frozen ceiling of ' + ceiling
            + ', worst ' + worst + '. This attempt is UNOBSERVABLE (load) - preserve and label it;'
            + ' it says nothing about the subject.'
          : 'OK: ' + list.length + ' sample(s), worst ' + worst + ', ceiling ' + ceiling,
  };
}
