/**
 * preload.mjs - the only thing Legasus injects into a witness process.
 *
 *   node --import ./legasus/preload.mjs <witness-file>
 *
 * Two jobs, both controlled by environment so the witness file is never modified:
 *
 *   LEGASUS_SUBJECT   absolute path of the subject module as the witness imports it
 *   LEGASUS_MUTANT    absolute path of a mutant to serve INSTEAD of the subject (optional)
 *   LEGASUS_TRACE     path to write per-case coverage records to (optional)
 *   LEGASUS_REGION    JSON { fnStart, fnEnd, site } - byte offsets in the file actually
 *                     served (the mutant's, when a mutant is served)
 *
 * The import redirect is a loader hook: any resolution that lands on LEGASUS_SUBJECT is
 * answered with LEGASUS_MUTANT. Witnesses keep importing './approvalPolicy.js' and get the
 * mutant without knowing it.
 *
 * The trace hooks console.log. A witness that prints one `PASS|FAIL <id>` line per case
 * gets, at each such line, a precise-coverage snapshot since the previous one. V8's
 * takePreciseCoverage RESETS its counters, so each snapshot is that case's execution.
 * Inspector calls resolve synchronously on the main thread (verified 2026-09-20), so the
 * snapshot is taken before the witness moves on to the next case.
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { appendFileSync } from 'node:fs';
import inspector from 'node:inspector';
import { regionCounts as sharedRegionCounts } from './coverage.mjs';

const SUBJECT = process.env.LEGASUS_SUBJECT;
const MUTANT = process.env.LEGASUS_MUTANT;
const TRACE = process.env.LEGASUS_TRACE;
const REGION = process.env.LEGASUS_REGION ? JSON.parse(process.env.LEGASUS_REGION) : null;

if (SUBJECT && MUTANT) {
  register(new URL('./redirect-hooks.mjs', import.meta.url), {
    data: { from: pathToFileURL(SUBJECT).href, to: pathToFileURL(MUTANT).href },
  });
}

if (TRACE && REGION) {
  const served = pathToFileURL(MUTANT || SUBJECT).href;
  const session = new inspector.Session();
  session.connect();
  session.post('Profiler.enable');
  session.post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });

  // PHASE: written before the witness runs anything. A trace with this record and no cases
  // means the process died between arming and the first case; a trace WITHOUT it means the
  // process died before the tracer was even armed. Neither is an observation of the region,
  // and without the marker the two are indistinguishable from each other and from a subject
  // that ran and caused nothing (LegaScreen's TRANSFER-1 defect, replicated here).
  try { appendFileSync(TRACE, JSON.stringify({ phase: 'ARMED', served }) + '\n'); } catch { /* the outcome lines still stand */ }

  const CASE_LINE = /^\s*(PASS|FAIL)\s+(.+?)\s*$/;
  let ordinal = 0;

  const regionCounts = (result) => {
    const script = result.find((s) => s.url === served);
    if (!script) return { fnCount: null, siteCount: null, scriptSeen: false };
    return { ...sharedRegionCounts(script.functions, REGION), scriptSeen: true };
  };

  const origLog = console.log;
  console.log = (...args) => {
    origLog(...args);
    const line = args.length === 1 && typeof args[0] === 'string' ? args[0] : args.map(String).join(' ');
    const m = line.match(CASE_LINE);
    if (!m) return;
    session.post('Profiler.takePreciseCoverage', (err, res) => {
      const rec = {
        ordinal: ordinal++,
        outcome: m[1],
        id: m[2],
        ...(err ? { coverageError: String(err) } : regionCounts(res.result)),
      };
      try { appendFileSync(TRACE, JSON.stringify(rec) + '\n'); } catch { /* the outcome line still stands */ }
    });
  };
}
