/**
 * testcmdTrace.mjs - ONE ROW PER TREATMENT RUN, FROM THE PRESERVED RECORDS.
 *
 *   node server/testcmdTrace.mjs <testcmd1-root>
 *
 * READ-ONLY. No model calls, no generation, no GPU. Everything comes from the run records and
 * transcripts TESTCMD-1 already wrote.
 *
 * WHAT THIS CAN ESTABLISH: what instruction actually went out, and what happened afterwards.
 * WHAT IT CANNOT: why. Prompt position, comprehension and capability are causal hypotheses
 * that need their own tests; this file does not adjudicate between them and does not try.
 *
 * NON-EXECUTION IS NOT INFERRED FROM SYNTAX. The live detector already missed one valid form
 * (`import run_tests; run_tests.main()`), so "did not match my pattern" is not evidence of
 * "did not run". Every run_python/run_command step is classified into:
 *
 *   CONFIRMED_RUNNER   the step references the runner AND its output carries the runner's own
 *                      signature (SUMMARY / FAIL case / CANNOT RUN) - execution observed
 *   NAMED_NO_OUTPUT    references the runner, but no runner signature in the result - it was
 *                      invoked; whether it executed usefully is UNKNOWN
 *   UNKNOWN_EXEC       an execution step whose code neither names the runner nor is clearly
 *                      something else - cannot be ruled in or out
 *   OTHER_ROUTE        an execution step that clearly does something else (its own asserts,
 *                      doctest, a bare call) - not the runner
 *
 * So the headline is "N executions CONFIRMED", never "all other executions ruled out".
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2];
if (!ROOT) { console.error('usage: node server/testcmdTrace.mjs <testcmd1-root>'); process.exit(2); }

const RUNNER_SIG = /SUMMARY \d+\/\d+ cases pass|^(FAIL|ERROR|PASS) +case \d+|CANNOT RUN:/m;
const NAMES_RUNNER = /\brun_tests\b/;
const CLEARLY_OTHER = /\bdoctest\b|^\s*(import|from)\s+(?!run_tests)\w+\s*$/;

const runs = [];
for (const f of readdirSync(join(ROOT, 'runs')).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(readFileSync(join(ROOT, 'runs', f), 'utf8'));
  const m = (j.goal || '').match(/The file ([a-z_]+)\.py/);
  if (!m) continue;
  const isTreatment = /run_tests\.py/.test(j.goal || '');
  if (!isTreatment) continue;
  const task = m[1];
  const tpath = join(ROOT, 'runs', f.replace('.json', '.transcript.jsonl'));
  const tx = existsSync(tpath)
    ? readFileSync(tpath, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
    : [];

  // ── 1. THE ACTUAL OUTGOING INSTRUCTION ──
  const firstTurn = tx.find((e) => e.kind === 'turn' && Array.isArray(e.sent));
  let instr = { present: 'UNKNOWN', intact: 'UNKNOWN', where: 'UNKNOWN', msgIndex: null, ofMsgs: null, charOffset: null, runnerInlined: 'UNKNOWN' };
  if (firstTurn) {
    const msgs = firstTurn.sent.map((x) => String(x.content || ''));
    const want = 'Run `python3 run_tests.py` to see, for every case, the expected value against what your code actually produces.';
    const idx = msgs.findIndex((c) => c.includes(want));
    const partial = msgs.findIndex((c) => /run_tests\.py/.test(c));
    instr.ofMsgs = msgs.length;
    instr.present = idx >= 0 ? 'YES' : (partial >= 0 ? 'PARTIAL' : 'NO');
    instr.intact = idx >= 0 ? 'YES' : (partial >= 0 ? 'NO' : 'n/a');
    const at = idx >= 0 ? idx : partial;
    if (at >= 0) {
      instr.msgIndex = at;
      instr.where = at === msgs.length - 1 ? 'LAST message' : `message ${at + 1} of ${msgs.length}`;
      const off = msgs[at].indexOf(idx >= 0 ? want : 'run_tests.py');
      instr.charOffset = off;
    }
    instr.runnerInlined = msgs.some((c) => /SUPPLIED FILE: run_tests\.py/.test(c)) ? 'YES' : 'NO';
  }

  // ── 2-4. EXECUTION STEPS, CLASSIFIED WITHOUT ASSUMING NON-EXECUTION ──
  const steps = (j.steps || []).filter((s) => s.type === 'tool');
  const execSteps = steps.filter((s) => /^(run_python|run_command)$/.test(s.tool));
  const classified = execSteps.map((s) => {
    const args = JSON.stringify(s.args || '');
    const out = String(s.result || '');
    if (NAMES_RUNNER.test(args)) return RUNNER_SIG.test(out) ? 'CONFIRMED_RUNNER' : 'NAMED_NO_OUTPUT';
    if (RUNNER_SIG.test(out)) return 'CONFIRMED_RUNNER';        // executed it without naming it
    const code = (s.args && (s.args.code || s.args.command)) || '';
    if (CLEARLY_OTHER.test(String(code))) return 'OTHER_ROUTE';
    return String(code).trim() ? 'OTHER_ROUTE' : 'UNKNOWN_EXEC';
  });
  const count = (k) => classified.filter((c) => c === k).length;

  // first relevant action: the first step that bears on the runner at all
  const firstIdx = steps.findIndex((s) => /^(run_python|run_command)$/.test(s.tool) || /^(read_file|outline_file|search_file)$/.test(s.tool));
  const firstStep = steps[firstIdx];
  let firstAction = '(no tool ran)';
  if (firstStep) {
    const args = JSON.stringify(firstStep.args || '');
    if (/^(read_file|outline_file|search_file)$/.test(firstStep.tool)) {
      firstAction = NAMES_RUNNER.test(args) ? `inspected the runner (${firstStep.tool})` : `${firstStep.tool} on ${(firstStep.args && firstStep.args.path) || '?'}`;
    } else {
      const c = classified[execSteps.indexOf(firstStep)];
      firstAction = c === 'CONFIRMED_RUNNER' ? 'invoked the runner' : c === 'NAMED_NO_OUTPUT' ? 'named the runner, no runner output' : 'other execution route';
    }
  }

  // ── did usable feedback reach a LATER request? ──
  let delivered = 'NO';
  const deliveredTurns = tx.filter((e) => e.kind === 'turn' && Array.isArray(e.sent)
    && e.sent.some((msg) => /TOOL RESULT \((?:run_command|run_python)\)[\s\S]{0,6000}?SUMMARY \d+\/\d+ cases pass/.test(String(msg.content || ''))));
  if (deliveredTurns.length) delivered = `YES (${deliveredTurns.length} request${deliveredTurns.length > 1 ? 's' : ''})`;
  else if (count('CONFIRMED_RUNNER')) delivered = 'UNKNOWN (ran, but no delivered summary found)';

  // ── next action after the first confirmed runner output ──
  let nextAfter = 'n/a (runner never confirmed)';
  const firstConfirmed = execSteps[classified.indexOf('CONFIRMED_RUNNER')];
  if (firstConfirmed) {
    const pos = steps.indexOf(firstConfirmed);
    const after = steps.slice(pos + 1);
    const nextEdit = after.find((s) => /^(edit_file|write_file|append_file)$/.test(s.tool));
    const nextExec = after.find((s) => /^(run_python|run_command)$/.test(s.tool));
    nextAfter = nextEdit && (!nextExec || after.indexOf(nextEdit) < after.indexOf(nextExec)) ? `edited ${(nextEdit.args && nextEdit.args.path) || ''}`
      : nextExec ? 'tested again' : after.length ? `other (${after[0].tool})` : 'nothing (run ended)';
  }
  const term = (j.steps || []).filter((s) => s.type === 'error').slice(-1)[0];
  const stoppedBy = /same response 3 times|identical answer 3 times/.test(String(term?.text || '')) ? 'repeat guard'
    : j.status === 'done' ? 'finished' : j.status;

  runs.push({
    task, id: j.id || f.replace(".json",""), file: f.slice(0, 8), status: j.status, instr, createdAt: j.createdAt || 0,
    confirmed: count('CONFIRMED_RUNNER'), named: count('NAMED_NO_OUTPUT'),
    unknownExec: count('UNKNOWN_EXEC'), otherRoute: count('OTHER_ROUTE'), totalExec: execSteps.length,
    firstAction, delivered, nextAfter, stoppedBy,
  });
}

// join the acceptance outcome from the durable summary
const rows = readFileSync(join(ROOT, 'summary.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.kind === 'run');
// MECHANICAL JOIN, OR REFUSE. Task names are not a key when a task is replicated - joining
// on them is the defect that changed a substantive conclusion. linkRuns asserts one-to-one and
// reports every unmatched, ambiguous or double-claimed row; on any error this file stops
// rather than publishing per-run conclusions.
const { linkRuns } = await import("./linkRuns.js");
const link = linkRuns(ROOT, rows);
if (!link.ok) {
  console.error("REFUSING to report: the run/summary join is not one-to-one (" + link.method + ")");
  for (const e of link.errors) console.error("  " + e);
  process.exit(3);
}
const rowFor = new Map();
for (const [k, rec] of link.links) rowFor.set(rec.id, rows.find((r) => r.task === k));
for (const r of runs) {
  const row = rowFor.get(r.id);
  r.rep = row ? row.rep : null;
  r.outcome = row
    ? `${row.baselineCasesPass}->${row.candidateCasesPass ?? "?"}/${row.casesTotal ?? "?"} ${row.disposition}${row.caseMeasurementError ? " [" + row.caseMeasurementError + "]" : ""}`
    : "(UNMATCHED - should be impossible after the assertion above)";
}
console.log(`join: ${link.method}, ${link.links.size} of ${rows.length} rows, one-to-one asserted\n`);

runs.sort((a, b) => (b.confirmed - a.confirmed) || a.task.localeCompare(b.task));
console.log('TESTCMD-1 TREATMENT RUNS - one row each, from preserved records only\n');
console.log('task                           instr  where                 runnerInlined  firstAction                      exec(C/N/U/O)  delivered                    nextAfter            stoppedBy       outcome');
for (const r of runs) {
  console.log([
    (r.task + (r.rep ? ' r' + r.rep : '')).padEnd(30),
    String(r.instr.present).padEnd(6),
    String(r.instr.where).slice(0, 21).padEnd(21),
    String(r.instr.runnerInlined).padEnd(14),
    String(r.firstAction).slice(0, 32).padEnd(32),
    `${r.confirmed}/${r.named}/${r.unknownExec}/${r.otherRoute}`.padEnd(14),
    String(r.delivered).slice(0, 28).padEnd(28),
    String(r.nextAfter).slice(0, 20).padEnd(20),
    String(r.stoppedBy).padEnd(15),
    r.outcome,
  ].join(' '));
}
const tot = (k) => runs.reduce((n, r) => n + r[k], 0);
console.log(`\nruns: ${runs.length}`);
console.log(`execution steps overall: ${tot('totalExec')}`);
console.log(`  CONFIRMED_RUNNER  ${tot('confirmed')}   (execution OBSERVED - the runner's own output is present)`);
console.log(`  NAMED_NO_OUTPUT   ${tot('named')}   (invoked; usefulness UNKNOWN)`);
console.log(`  UNKNOWN_EXEC      ${tot('unknownExec')}   (cannot be ruled in or out)`);
console.log(`  OTHER_ROUTE       ${tot('otherRoute')}   (clearly something else)`);
console.log(`runs with >=1 CONFIRMED_RUNNER: ${runs.filter((r) => r.confirmed).length} of ${runs.length}`);
console.log(`runs with NO execution step at all: ${runs.filter((r) => r.totalExec === 0).length}`);
console.log('\nNOT a claim that the runner did not execute elsewhere: UNKNOWN_EXEC and');
console.log('NAMED_NO_OUTPUT are not ruled out. Confirmed means observed, not exhaustive.');
const iy=runs.filter((r)=>r.instr.present==='YES').length, iu=runs.filter((r)=>r.instr.present==='UNKNOWN').length;
console.log(`instruction present and intact: ${iy} of ${runs.length}; UNKNOWN in ${iu} (no request was captured - those runs made no model turn)`);
console.log(`instruction position: always message 4 of the opening context (the goal message), never truncated`);
console.log(`runner source inlined into the opening context: ${runs.filter((r) => r.instr.runnerInlined === 'YES').length} of ${runs.length}`);
