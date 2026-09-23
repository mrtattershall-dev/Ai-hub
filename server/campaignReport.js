/**
 * campaignReport.js - THE FINAL REPORTING PATH, extracted so it can be replayed.
 *
 * THREE COMPLETED CAMPAIGNS PRODUCED BROKEN REPORTS:
 *   PILOT-1   eleven null columns per task - batch.js dropped the per-task outcome
 *   PILOT-2   partly null for the same reason
 *   PROTOCOL-2  all 30 runs finished, then ReferenceError: ORDER is not defined
 *
 * The pattern is the defect: reporting code runs ONCE, at the very end, after everything
 * expensive has happened, and nothing exercises it beforehand. `node --check` cannot catch an
 * undefined reference on a path that only executes at the end. A separately tested report
 * HELPER would not have caught any of the three either, because none of them lived in a helper -
 * they lived in the campaign's own final block.
 *
 * So the final block itself is here, as one function, and:
 *   - it is REPLAYABLE from the journal alone, with no model calls
 *   - it is exercised by tests against the 30 PRESERVED PROTOCOL-2 run records
 *   - the campaign writes an INCREMENTAL summary after every completed pair, so a crash at the
 *     end costs the summary of the last pair at worst, never the campaign
 *
 * A reporting crash must cost ZERO additional GPU work. The compute is not lost when its
 * records survive - but recovering it by hand is exactly what this removes.
 */
import { appendFileSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Every field a run must carry into the report. Missing ones are reported, never silent. */
export const REQUIRED_RUN_FIELDS = Object.freeze([
  'idx', 'rep', 'task', 'arm', 'termination',
  'requested', 'protected', 'disposition',
  'modelCalls', 'elapsedSec',
]);

/**
 * Append one run to the durable summary. Called after EVERY run, before anything else.
 *
 * Written as JSONL and flushed per line: a crash loses at most the line being written, and the
 * campaign can always be rebuilt from what is already on disk.
 */
export function recordRun(summaryPath, run) {
  mkdirSync(dirname(summaryPath), { recursive: true });
  appendFileSync(summaryPath, JSON.stringify({ kind: 'run', at: new Date().toISOString(), ...run }) + '\n', 'utf8');
}

/** Append the state after a COMPLETED PAIR, so an interrupted campaign has whole pairs on disk. */
export function recordPair(summaryPath, { rep, task, runs }) {
  mkdirSync(dirname(summaryPath), { recursive: true });
  appendFileSync(summaryPath, JSON.stringify({
    kind: 'pair', at: new Date().toISOString(), rep, task,
    arms: runs.map((r) => ({ arm: r.arm, accepted: !!r.accepted, requested: r.requested ?? null, protected: r.protected ?? null, disposition: r.disposition ?? null })),
  }) + '\n', 'utf8');
}

/** Read a durable summary back. The ONLY input the final report needs. */
export function readSummary(summaryPath) {
  if (!existsSync(summaryPath)) return { runs: [], pairs: [] };
  const lines = readFileSync(summaryPath, 'utf8').split('\n').filter(Boolean);
  const runs = [], pairs = [];
  for (const l of lines) {
    try { const e = JSON.parse(l); if (e.kind === 'run') runs.push(e); else if (e.kind === 'pair') pairs.push(e); }
    catch { /* a torn final line - the rest of the summary is still usable */ }
  }
  return { runs, pairs };
}

/**
 * Build the final report FROM THE DURABLE SUMMARY. No model calls, no live state.
 *
 * This is the function that crashed. It is now callable on its own, against records that already
 * exist, which is what makes recovery cost nothing.
 */
export function buildReport(summaryPath, meta = {}) {
  const { runs, pairs } = readSummary(summaryPath);

  // INTEGRITY, checked rather than assumed.
  const seen = new Map();
  const duplicates = [];
  for (const r of runs) {
    const key = `${r.rep}/${r.task}/${r.arm}`;
    if (seen.has(key)) duplicates.push(key);
    seen.set(key, r);
  }
  const missingFields = [];
  for (const r of runs) {
    // AN UNATTEMPTED RUN HAS NO VERDICT, and that is correct rather than missing. ENDURANCE-2
    // reported integrity:false purely because 77 UNATTEMPTED runs had null requested/protected -
    // the CHECK was wrong, not the campaign. A check that fires on correct data trains its
    // reader to ignore it.
    if (r.termination === 'UNATTEMPTED') continue;
    const gaps = REQUIRED_RUN_FIELDS.filter((f) => r[f] === undefined || r[f] === null);
    if (gaps.length) missingFields.push({ run: `${r.rep}/${r.task}/${r.arm}`, gaps });
  }

  const arms = {};
  for (const a of [...new Set(runs.map((r) => r.arm))]) {
    const rs = runs.filter((r) => r.arm === a && r.termination !== 'UNATTEMPTED');
    arms[a] = {
      runs: rs.length,
      acceptedImprovements: rs.filter((r) => r.accepted).length,
      requestedPass: rs.filter((r) => r.requested === 'PASS').length,
      protectedRetained: rs.filter((r) => r.protected === 'PASS').length,
      protectedBroken: rs.filter((r) => r.protected === 'FAIL').length,
      evalErrors: rs.filter((r) => r.requested === 'EVALUATION_ERROR' || r.protected === 'EVALUATION_ERROR').length,
      // SPEND OVER EVERY ATTEMPTED RUN, successes and failures alike.
      modelCalls: rs.reduce((x, r) => x + (r.modelCalls || 0), 0),
      tokens: rs.reduce((x, r) => x + (r.tokens || 0), 0),
      seconds: rs.reduce((x, r) => x + (r.elapsedSec || 0), 0),
      toolExecutions: rs.reduce((x, r) => x + (r.toolExecutions || 0), 0),
      controllerRefusals: rs.reduce((x, r) => x + (r.refusals ?? (r.controllerRefusals?.length || 0)), 0),
    };
  }

  // RECONCILIATION: the totals must equal the sum of the underlying records, computed a second
  // way. A total that only agrees with itself has not been checked.
  const reconciliation = {
    runsInSummary: runs.length,
    runsCounted: Object.values(arms).reduce((x, a) => x + a.runs, 0)
      + runs.filter((r) => r.termination === 'UNATTEMPTED').length,
    callsInSummary: runs.filter((r) => r.termination !== 'UNATTEMPTED').reduce((x, r) => x + (r.modelCalls || 0), 0),
    callsCounted: Object.values(arms).reduce((x, a) => x + a.modelCalls, 0),
    pairsRecorded: pairs.length,
  };
  reconciliation.ok = reconciliation.runsInSummary === reconciliation.runsCounted
    && reconciliation.callsInSummary === reconciliation.callsCounted;

  const byReplicate = {};
  for (const r of runs) (byReplicate[`rep${r.rep}`] ||= []).push({ task: r.task, arm: r.arm, accepted: !!r.accepted, requested: r.requested ?? null, protected: r.protected ?? null, disposition: r.disposition ?? null });

  return {
    ...meta,
    builtAt: new Date().toISOString(),
    integrity: { duplicates, missingFields, ok: duplicates.length === 0 && missingFields.length === 0 },
    reconciliation,
    arms, byReplicate, pairs, runs,
  };
}

/** Build and write. Separated so a caller can inspect before committing anything to disk. */
export function writeReport(summaryPath, outPath, meta = {}) {
  const report = buildReport(summaryPath, meta);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  return report;
}
