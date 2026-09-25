/**
 * mechanismAudit.mjs - reconstruct WHAT HAPPENED in a campaign from its own durable records.
 *
 *   node server/mechanismAudit.mjs <campaign root> [--out <file.json>]
 *
 * Reads summary.jsonl, runs/<id>.json and runs/<id>.transcript.jsonl - nothing else - and
 * writes one JSON with a per-unit table and per-arm/replicate aggregates. It is the
 * instrument the AUTODIAG mechanism audit was first done with ad hoc, made repeatable:
 *
 *   labels vs bytes      does RETAIN/RESTORED/PRESERVE agree with the surviving tree?
 *   termination          WHY the run ended, classified from the run's own steps - and a
 *                        parse-rollback NOTE is not a termination (the earlier ad hoc
 *                        classifier counted "X.py does not parse" as a parse give-up)
 *   first action         the first tool the model reached for, and its first THOUGHT
 *   first-edit effect    (diagnostic arms) cases passing before vs after the first edit
 *   recovery             did any later diagnostic beat the best of the first two?
 *   delivery/isolation   diagnostic messages and case-detail lines actually SENT, per arm
 *   backend              call latencies, deadline aborts, errors, per arm and replicate
 *   hub rollback         the Hub's own end-of-run parse rollback, a layer before acceptance
 */
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const ROOT = argv[0];
const OUT = (() => { const i = argv.indexOf('--out'); return i > -1 ? argv[i + 1] : null; })();
if (!ROOT || !existsSync(join(ROOT, 'summary.jsonl'))) { console.error('usage: node server/mechanismAudit.mjs <campaign root with summary.jsonl> [--out file]'); process.exit(2); }

const summary = readFileSync(join(ROOT, 'summary.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const rows = summary.filter((r) => r.kind === 'run');
const plan = (summary.find((r) => r.kind === 'plan') || {}).tasks || [];
const runs = {};
for (const f of readdirSync(join(ROOT, 'runs')).filter((x) => x.endsWith('.json'))) {
  try { const j = JSON.parse(readFileSync(join(ROOT, 'runs', f), 'utf8')); if (j.id) runs[j.id] = j; } catch { /* skip */ }
}
const transcript = (id) => {
  const p = join(ROOT, 'runs', `${id}.transcript.jsonl`);
  return existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
};

const ROLLBACK = /did not parse at the end of the run|does not parse and no version/;
const TERMINATION = [
  ['REPEAT_GUARD_RESPONSE', /same response \d+ times/],
  ['REPEAT_GUARD_TOOL', /identical answer \d+ times/],
  ['CALL_DEADLINE', /did not complete within the task budget/],
  ['BUDGET', /task budget (is )?exhausted|out of budget/i],
  ['GAVE_UP_UNPARSEABLE', /Gave up|could not be parsed as an action/i],
];
function classify(run) {
  if (!run) return 'NO_RUN_RECORD';
  const steps = (run.steps || []).filter((s) => s.type !== 'thought');
  if (run.status === 'done') return 'FINISH';
  for (let i = steps.length - 1; i >= 0; i--) {
    const t = String(steps[i].text || '');
    if (ROLLBACK.test(t)) continue;                 // a note about the workspace, not a termination
    for (const [k, re] of TERMINATION) if (re.test(t)) return k;
    if (/^Stopped:/.test(t)) return 'STOPPED_OTHER:' + t.slice(9, 50).trim();
    if (steps[i].type === 'error') return 'ERROR:' + t.slice(0, 50).trim();
  }
  return run.status === 'error' ? 'ERROR' : run.status === 'stopped' ? 'STOPPED_UNCLASSIFIED' : String(run.status).toUpperCase();
}

const units = rows.map((r) => {
  const run = runs[r.runId];
  const steps = run?.steps || [];
  const tools = steps.filter((s) => s.type === 'tool' || s.type === 'finish');
  const firstThought = steps.find((s) => s.type === 'thought');
  const diags = (run?.diagnostics || []).filter((d) => !d.skipped);
  const b = diags[0]?.passed, a1 = diags[1] ? (diags[1].passed ?? -1) : undefined;
  const firstEdit = a1 === undefined || b == null ? 'na' : a1 > b ? 'up' : a1 < b ? 'down' : 'flat';
  const later = diags.slice(2).map((d) => d.passed ?? -1);
  const recovered = firstEdit !== 'na' && firstEdit !== 'up' && later.length > 0 && Math.max(...later) > Math.max(a1, b);
  const tx = transcript(r.runId);
  let diagMsgsSent = 0, caseLinesSent = 0;
  for (const e of tx) {
    if (e.kind !== 'turn' || !Array.isArray(e.sent)) continue;
    for (const m of e.sent) {
      const c = String(m?.content || '');
      if (/^AUTOMATIC DIAGNOSTIC/.test(c)) { diagMsgsSent++; caseLinesSent += (c.match(/^ {2}(FAIL|ERROR) case \d+ /gm) || []).length; }
    }
  }
  const calls = Array.isArray(run?.calls) ? run.calls : [];
  const callStats = Array.isArray(run?.callStats) ? run.callStats : [];
  const ms = callStats.map((c) => c.ms ?? c.durationMs ?? c.elapsedMs).filter((x) => typeof x === 'number');
  const outcomes = calls.map((c) => c.outcome || c.state || '').filter(Boolean);
  const label = r.disposition;
  const treesEqual = r.candidateTree && r.survivingTree ? r.candidateTree === r.survivingTree : null;
  const labelAgrees = treesEqual === null ? null
    : label === 'RETAIN' || label === 'PRESERVE_INCOMPLETE' ? treesEqual
      : label === 'RESTORED' ? !treesEqual : null;
  return {
    idx: r.idx, task: r.task, arm: r.arm, rep: r.rep, runId: r.runId, state: r.state, disposition: label, accepted: !!r.accepted,
    position: r.position ?? null, seedSent: r.seedSent ?? null, isolationOk: r.isolationOk ?? null,
    termination: classify(run), hubParseRollback: steps.some((s) => ROLLBACK.test(String(s.text || ''))),
    firstAction: tools[0] ? (tools[0].tool || tools[0].type) : null,
    firstThought: firstThought ? String(firstThought.text || '').slice(0, 120) : null,
    modelCalls: r.modelCalls, elapsedSec: r.elapsedSec, editsOnTarget: r.editsOnTarget,
    diagnostics: diags.length, firstEdit, recovered, diagMsgsSent, caseLinesSent,
    deadlineAborts: outcomes.filter((o) => /DEADLINE/.test(o)).length,
    callErrors: outcomes.filter((o) => /ERROR/.test(o)).length,
    medianCallMs: ms.length ? ms.slice().sort((x, y) => x - y)[Math.floor(ms.length / 2)] : null,
    treesEqual, labelAgrees,
    casesBefore: r.baselineCasesPass, casesAfter: r.candidateCasesPass, casesTotal: r.casesTotal,
  };
});

const groups = {};
for (const u of units) {
  for (const key of [u.arm, `${u.arm}/r${u.rep}`]) {
    const g = (groups[key] ||= { n: 0, accepted: 0, dispositions: {}, termination: {}, firstAction: {}, firstEdit: {}, recovered: 0, deadlineAborts: 0, callErrors: 0, elapsedSec: 0, modelCalls: 0, medianCallMs: [], hubParseRollback: 0, isolationViolations: 0, labelDisagreements: 0, diagMsgsSent: 0, caseLinesSent: 0 });
    g.n++; g.accepted += u.accepted ? 1 : 0;
    g.dispositions[u.disposition] = (g.dispositions[u.disposition] || 0) + 1;
    g.termination[u.termination] = (g.termination[u.termination] || 0) + 1;
    g.firstAction[u.firstAction || '-'] = (g.firstAction[u.firstAction || '-'] || 0) + 1;
    g.firstEdit[u.firstEdit] = (g.firstEdit[u.firstEdit] || 0) + 1;
    g.recovered += u.recovered ? 1 : 0; g.deadlineAborts += u.deadlineAborts; g.callErrors += u.callErrors;
    g.elapsedSec += u.elapsedSec || 0; g.modelCalls += u.modelCalls || 0;
    if (u.medianCallMs != null) g.medianCallMs.push(u.medianCallMs);
    g.hubParseRollback += u.hubParseRollback ? 1 : 0;
    g.isolationViolations += u.isolationOk === false ? 1 : 0;
    g.labelDisagreements += u.labelAgrees === false ? 1 : 0;
    g.diagMsgsSent += u.diagMsgsSent; g.caseLinesSent += u.caseLinesSent;
  }
}
for (const g of Object.values(groups)) { const m = g.medianCallMs.sort((x, y) => x - y); g.medianCallMs = m.length ? m[Math.floor(m.length / 2)] : null; }

const audit = { root: ROOT, planned: plan.length, recorded: rows.length, units, groups,
  labelDisagreements: units.filter((u) => u.labelAgrees === false).map((u) => ({ task: u.task, disposition: u.disposition, treesEqual: u.treesEqual })) };
if (OUT) writeFileSync(OUT, JSON.stringify(audit, null, 2), 'utf8');

const pad = (s, n) => String(s).padEnd(n);
console.log(`campaign ${ROOT}: planned ${plan.length}, recorded ${rows.length}, label/bytes disagreements ${audit.labelDisagreements.length}`);
for (const [k, g] of Object.entries(groups).sort()) {
  console.log(`\n${pad(k, 18)} n=${g.n} accepted=${g.accepted} elapsed=${g.elapsedSec}s calls=${g.modelCalls} medianCallMs=${g.medianCallMs} deadlineAborts=${g.deadlineAborts} errors=${g.callErrors} hubRollback=${g.hubParseRollback} isolationViolations=${g.isolationViolations}`);
  console.log(`  dispositions ${JSON.stringify(g.dispositions)}`);
  console.log(`  termination  ${JSON.stringify(g.termination)}`);
  console.log(`  firstAction  ${JSON.stringify(g.firstAction)}`);
  console.log(`  firstEdit    ${JSON.stringify(g.firstEdit)} recovered=${g.recovered}  diagMsgsSent=${g.diagMsgsSent} caseLinesSent=${g.caseLinesSent}`);
}
if (OUT) console.log(`\nwritten: ${OUT}`);
