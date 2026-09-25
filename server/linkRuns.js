/**
 * linkRuns.js - JOIN SUMMARY ROWS TO RUN RECORDS MECHANICALLY, OR REFUSE.
 *
 * WHY THIS EXISTS. The trace analysis first joined a run record to a summary row by TASK NAME.
 * With two replicates per task that is not a key: both replicates matched the first row, and
 * every replicate-2 row was reported with replicate 1's outcome. That defect changed a
 * substantive conclusion - it turned "1 success in 5 confirmed-runner runs" into "2 of 6" and
 * invented a run that saw four failure reports and made no edits. Correcting the prose is not
 * enough; the join itself has to be incapable of that.
 *
 * THE KEY IS THE RUN ID.
 *
 *   preferred   the summary row carries `runId`, written by the campaign runner. A direct,
 *               one-to-one join. Everything written from 2026-09-25 onward has it.
 *   fallback    for records written BEFORE runId was recorded, the run is identified by
 *               INTERVAL CONTAINMENT: the batch journal brackets each unit between its
 *               task_start and task_end, and exactly one run record may have been created in
 *               that window for that task. This is mechanical, not a name match.
 *
 * EVERY JOIN IS ASSERTED. A row with no match, a row with more than one candidate, or a run
 * record claimed by two rows is an ERROR that this module reports - never a silent pick. A
 * caller that gets `ok: false` must not report per-run conclusions.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Read every run record once: { id, createdAt, goal, task, isTreatment, path, json }. */
export function loadRunRecords(root, { treatmentMarker = /run_tests\.py/ } = {}) {
  const dir = join(root, 'runs');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    let j;
    try { j = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    const m = (j.goal || '').match(/The file ([a-z_]+)\.py/);
    if (!m) continue;
    out.push({
      id: j.id || f.replace('.json', ''),
      createdAt: j.createdAt || 0,
      task: `ext-${m[1]}`,
      isTreatment: treatmentMarker.test(j.goal || ''),
      path: join(dir, f),
      json: j,
    });
  }
  return out;
}

/** Every unit's [start, end] window, from the batch journals. */
function journalWindows(root) {
  const windows = [];
  for (const f of readdirSync(root).filter((x) => /^journal-.*\.jsonl$/.test(x))) {
    const m = f.match(/^journal-(.+)-r(\d+)\.jsonl$/);
    if (!m) continue;
    const arm = m[1], rep = +m[2];
    let open = null;
    for (const line of readFileSync(join(root, f), 'utf8').split('\n').filter(Boolean)) {
      let e;
      try { e = JSON.parse(line); } catch { continue; }
      if (e.event === 'task_start') open = { arm, rep, task: e.task, attemptId: e.attemptId, start: Date.parse(e.at) };
      else if (e.event === 'task_end' && open && open.task === e.task) {
        windows.push({ ...open, end: Date.parse(e.at) });
        open = null;
      }
    }
    if (open) windows.push({ ...open, end: Infinity });   // a unit that never ended
  }
  return windows;
}

/**
 * Join summary rows to run records.
 * Returns { ok, links: Map<rowKey, record>, errors: [...], method }.
 */
export function linkRuns(root, rows, { treatmentMarker } = {}) {
  const records = loadRunRecords(root, { treatmentMarker });
  const errors = [];
  const links = new Map();
  const claimed = new Map();               // record id -> row key, to catch double-claims
  const keyOf = (r) => r.task;             // rows already carry task@ARMrN, which IS unique

  // ── preferred: a runId on the row ──
  if (rows.length && rows.every((r) => r.runId)) {
    const byId = new Map(records.map((r) => [r.id, r]));
    for (const row of rows) {
      const rec = byId.get(row.runId);
      if (!rec) { errors.push(`${keyOf(row)}: runId ${row.runId} has no run record`); continue; }
      if (claimed.has(rec.id)) { errors.push(`${keyOf(row)}: run ${rec.id} already claimed by ${claimed.get(rec.id)}`); continue; }
      claimed.set(rec.id, keyOf(row));
      links.set(keyOf(row), rec);
    }
    return { ok: errors.length === 0, links, errors, method: 'runId (direct)' };
  }

  // ── fallback: interval containment from the batch journals ──
  const windows = journalWindows(root);
  for (const row of rows) {
    const bare = row.task.replace(/@.*/, '');
    const w = windows.filter((x) => x.task === bare && x.arm === row.arm && x.rep === row.rep);
    if (w.length !== 1) { errors.push(`${keyOf(row)}: ${w.length} journal windows (need exactly 1)`); continue; }
    const { start, end } = w[0];
    const cand = records.filter((r) => r.task === bare
      && r.createdAt >= start && r.createdAt <= end
      && r.isTreatment === (row.arm === 'TEST_PACKAGE'));
    if (cand.length === 0) { errors.push(`${keyOf(row)}: no run record created inside its journal window`); continue; }
    if (cand.length > 1) { errors.push(`${keyOf(row)}: ${cand.length} run records inside its window - ambiguous, refusing`); continue; }
    const rec = cand[0];
    if (claimed.has(rec.id)) { errors.push(`${keyOf(row)}: run ${rec.id} already claimed by ${claimed.get(rec.id)}`); continue; }
    claimed.set(rec.id, keyOf(row));
    links.set(keyOf(row), rec);
  }
  // every treatment/control record that no row claimed is also an error worth surfacing
  for (const rec of records) {
    if (!claimed.has(rec.id)) errors.push(`run ${rec.id} (${rec.task}${rec.isTreatment ? ' TEST_PACKAGE' : ' CONTROL'}) matched no summary row`);
  }
  return { ok: errors.length === 0, links, errors, method: 'journal interval containment' };
}
