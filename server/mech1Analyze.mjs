/**
 * mech1Analyze.mjs - the pre-registered analysis of a multi-arm campaign, from summary.jsonl.
 *
 *   node server/mech1Analyze.mjs <campaign root> [--arms A,B,C] [--out file.json]
 *
 * Pairs units by (task, replicate) and reports, for every ordered pair of arms (X vs Y):
 *   discordant counts X-only / Y-only, both, neither, incomplete (a unit not COMPLETED)
 *   an exact two-sided sign test on the discordant pairs - DESCRIPTIVE, no threshold
 *   the same per replicate (seed), and a TASK-LEVEL view: tasks where X wins under both
 *   replicates, one, none - because 15 tasks x 2 seeds are not 30 independent tasks
 * plus per-arm, per-replicate secondary measures (first action, first-edit effect, termination,
 * regressions, elapsed, calls, deadline aborts) and repairs by order position.
 */
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const ROOT = argv[0];
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 ? argv[i + 1] : d; };
const OUT = opt('out', null);
if (!ROOT || !existsSync(join(ROOT, 'summary.jsonl'))) { console.error('usage: node server/mech1Analyze.mjs <root> [--arms A,B,C] [--out f]'); process.exit(2); }

const rows = readFileSync(join(ROOT, 'summary.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.kind === 'run');
const ARMS = (opt('arms', '') || [...new Set(rows.map((r) => r.arm))].join(',')).split(',').filter(Boolean);
const runs = {};
if (existsSync(join(ROOT, 'runs'))) for (const f of readdirSync(join(ROOT, 'runs')).filter((x) => x.endsWith('.json'))) { try { const j = JSON.parse(readFileSync(join(ROOT, 'runs', f), 'utf8')); if (j.id) runs[j.id] = j; } catch { /* skip */ } }

const base = (t) => t.split('@')[0];
const reps = [...new Set(rows.map((r) => r.rep))].filter((x) => x >= 1).sort();
const tasks = [...new Set(rows.map((r) => base(r.task)))].sort();
const cell = {};
for (const r of rows) cell[`${base(r.task)}|${r.rep}|${r.arm}`] = r;
// A unit RAN if it has a run record and was not UNATTEMPTED. Its state is COMPLETED only when
// accepted (batch.js semantics), so state alone would drop every failed-but-executed unit.
const ok = (r) => r && r.runId && r.state !== 'UNATTEMPTED' && r.termination !== 'UNATTEMPTED';
const won = (r) => ok(r) && r.accepted === true;

// exact two-sided sign test on n discordant pairs with k in favour of X
function signTest(k, n) {
  if (n === 0) return null;
  const C = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
  const p = (i) => C(n, i) / 2 ** n;
  const lo = Math.min(k, n - k);
  let tail = 0; for (let i = 0; i <= lo; i++) tail += p(i);
  return Math.min(1, 2 * tail);
}

function contrast(X, Y, repFilter = null) {
  const c = { X, Y, xOnly: 0, yOnly: 0, both: 0, neither: 0, incomplete: [], pairs: 0 };
  for (const t of tasks) for (const rep of reps) {
    if (repFilter !== null && rep !== repFilter) continue;
    const x = cell[`${t}|${rep}|${X}`], y = cell[`${t}|${rep}|${Y}`];
    if (!ok(x) || !ok(y)) { c.incomplete.push(`${t}/r${rep}`); continue; }
    c.pairs++;
    if (won(x) && won(y)) c.both++; else if (won(x)) c.xOnly++; else if (won(y)) c.yOnly++; else c.neither++;
  }
  c.discordant = c.xOnly + c.yOnly;
  c.signTestP = signTest(c.xOnly, c.discordant);
  return c;
}
function taskLevel(X, Y) {
  const out = { X, Y, xWinsBothReps: [], xWinsOneRep: [], yWinsBothReps: [], yWinsOneRep: [], mixed: [], neither: [], incomplete: [] };
  for (const t of tasks) {
    let xw = 0, yw = 0, inc = false;
    for (const rep of reps) {
      const x = cell[`${t}|${rep}|${X}`], y = cell[`${t}|${rep}|${Y}`];
      if (!ok(x) || !ok(y)) { inc = true; continue; }
      if (won(x) && !won(y)) xw++; else if (won(y) && !won(x)) yw++;
    }
    if (inc) out.incomplete.push(t);
    else if (xw === reps.length) out.xWinsBothReps.push(t);
    else if (yw === reps.length) out.yWinsBothReps.push(t);
    else if (xw && yw) out.mixed.push(t);
    else if (xw) out.xWinsOneRep.push(t);
    else if (yw) out.yWinsOneRep.push(t);
    else out.neither.push(t);
  }
  return out;
}

const contrasts = [];
for (let i = 0; i < ARMS.length; i++) for (let j = 0; j < ARMS.length; j++) if (i !== j && i > j) {
  const X = ARMS[i], Y = ARMS[j];
  contrasts.push({ pooled: contrast(X, Y), perRep: Object.fromEntries(reps.map((r) => [`r${r}`, contrast(X, Y, r)])), taskLevel: taskLevel(X, Y) });
}

function secondary(arm, rep = null) {
  const g = rows.filter((r) => r.arm === arm && (rep === null || r.rep === rep));
  const done = g.filter(ok);
  const firstAction = {}, firstEdit = {}, termination = {}, byPosition = {};
  for (const r of done) {
    const run = runs[r.runId];
    const tools = (run?.steps || []).filter((s) => s.type === 'tool' || s.type === 'finish');
    const fa = tools[0] ? (tools[0].tool || tools[0].type) : '-';
    firstAction[fa] = (firstAction[fa] || 0) + 1;
    const d = (run?.diagnostics || []).filter((x) => !x.skipped);
    const b = d[0]?.passed, a = d[1] ? (d[1].passed ?? -1) : undefined;
    const fe = a === undefined || b == null ? 'na' : a > b ? 'up' : a < b ? 'down' : 'flat';
    firstEdit[fe] = (firstEdit[fe] || 0) + 1;
    const last = (run?.steps || []).slice().reverse().find((s) => s.type !== 'thought' && !/does not parse and no version|did not parse at the end/.test(String(s.text || '')));
    const t = String(last?.text || last?.type || '');
    const k = run?.status === 'done' ? 'FINISH' : /same response/.test(t) ? 'REPEAT_RESPONSE' : /identical answer/.test(t) ? 'REPEAT_TOOL' : /task budget/.test(t) ? 'CALL_DEADLINE' : run?.status === 'error' ? 'ERROR' : 'OTHER';
    termination[k] = (termination[k] || 0) + 1;
    const pos = r.position ?? '?';
    byPosition[pos] = byPosition[pos] || { n: 0, repairs: 0 }; byPosition[pos].n++; byPosition[pos].repairs += won(r) ? 1 : 0;
  }
  return {
    planned: g.length, completed: done.length, repairs: done.filter(won).length,
    dispositions: done.reduce((a, r) => (a[r.disposition] = (a[r.disposition] || 0) + 1, a), {}),
    regressionsProduced: done.filter((r) => r.protected === 'FAIL').length,
    regressionsSurviving: done.filter((r) => r.disposition === 'RESTORE_FAILED').length,
    runsThatEdited: done.filter((r) => r.editsOnTarget > 0).length,
    elapsedSec: done.reduce((a, r) => a + (r.elapsedSec || 0), 0),
    modelCalls: done.reduce((a, r) => a + (r.modelCalls || 0), 0),
    // COST PER RETAINED REPAIR - fewer calls alone can mean giving up earlier.
    secondsPerRetainedRepair: done.filter(won).length ? Math.round(done.reduce((a, r) => a + (r.elapsedSec || 0), 0) / done.filter(won).length) : null,
    // RECOVERY AFTER AN UNPRODUCTIVE FIRST EDIT (descriptive subgroup: arms produce different
    // first edits, so denominators differ). Measured from run.diagnostics, delivered or silent.
    badFirstEdit: done.filter((r) => { const d = (runs[r.runId]?.diagnostics || []).filter((x) => !x.skipped); return d.length >= 2 && d[0].passed != null && (d[1].passed ?? -1) <= d[0].passed; }).length,
    recoveredAfterBadFirstEdit: done.filter((r) => { const d = (runs[r.runId]?.diagnostics || []).filter((x) => !x.skipped); if (d.length < 3 || d[0].passed == null) return false; const a = d[1].passed ?? -1; if (a > d[0].passed) return false; return Math.max(...d.slice(2).map((x) => x.passed ?? -1)) > Math.max(a, d[0].passed); }).length,
    recoveredAndRetained: done.filter((r) => { const d = (runs[r.runId]?.diagnostics || []).filter((x) => !x.skipped); if (d.length < 3 || d[0].passed == null) return false; const a = d[1].passed ?? -1; if (a > d[0].passed) return false; return won(r) && Math.max(...d.slice(2).map((x) => x.passed ?? -1)) > Math.max(a, d[0].passed); }).length,
    diagnosticsMeasuredSilently: done.reduce((a, r) => a + (r.diagnosticsMeasuredSilently || 0), 0),
    hardWall: done.filter((r) => r.hitHardWall).length,
    isolationViolations: done.filter((r) => r.isolationOk === false).length,
    diagnosticsDelivered: done.reduce((a, r) => a + (r.diagnosticsDelivered || 0), 0),
    firstAction, firstEdit, termination, byPosition,
    seedSent: [...new Set(done.map((r) => r.seedSent ?? null))],
  };
}
const arms = Object.fromEntries(ARMS.map((a) => [a, { pooled: secondary(a), perRep: Object.fromEntries(reps.map((r) => [`r${r}`, secondary(a, r)])) }]));

const result = { root: ROOT, arms: ARMS, replicates: reps, tasks: tasks.length, unitsPlanned: rows.length, unitsCompleted: rows.filter(ok).length, contrasts, secondary: arms };
if (OUT) writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8');

console.log(`MECH analysis of ${ROOT}: arms ${ARMS.join(',')}; ${tasks.length} tasks x ${reps.length} replicate(s); units ${result.unitsCompleted}/${result.unitsPlanned} completed`);
for (const a of ARMS) {
  const s = arms[a];
  console.log(`\n${a}: repairs ${s.pooled.repairs}/${s.pooled.completed}` + reps.map((r) => `  r${r} ${s.perRep[`r${r}`].repairs}/${s.perRep[`r${r}`].completed}`).join('')
    + `  regressions ${s.pooled.regressionsProduced} (surviving ${s.pooled.regressionsSurviving})  edited ${s.pooled.runsThatEdited}  elapsed ${s.pooled.elapsedSec}s  calls ${s.pooled.modelCalls}  seeds ${JSON.stringify(s.pooled.seedSent)}`);
  console.log(`   s/retained-repair ${s.pooled.secondsPerRetainedRepair}  badFirstEdit ${s.pooled.badFirstEdit}  recovered ${s.pooled.recoveredAfterBadFirstEdit} (retained ${s.pooled.recoveredAndRetained})  silentDiagnostics ${s.pooled.diagnosticsMeasuredSilently}`);
  console.log(`   firstAction ${JSON.stringify(s.pooled.firstAction)}  firstEdit ${JSON.stringify(s.pooled.firstEdit)}`);
  console.log(`   termination ${JSON.stringify(s.pooled.termination)}  byPosition ${JSON.stringify(s.pooled.byPosition)}`);
}
for (const c of contrasts) {
  const p = c.pooled;
  console.log(`\n${p.X} vs ${p.Y}: pairs ${p.pairs}  ${p.X}-only ${p.xOnly}  ${p.Y}-only ${p.yOnly}  both ${p.both}  neither ${p.neither}  incomplete ${p.incomplete.length}  sign-test p=${p.signTestP === null ? 'n/a' : p.signTestP.toFixed(3)} (descriptive)`);
  for (const r of reps) { const q = c.perRep[`r${r}`]; console.log(`   r${r}: ${q.X}-only ${q.xOnly}  ${q.Y}-only ${q.yOnly}  both ${q.both}  neither ${q.neither}  incomplete ${q.incomplete.length}`); }
  const t = c.taskLevel;
  console.log(`   task-level: ${p.X} wins under BOTH reps ${t.xWinsBothReps.length} [${t.xWinsBothReps.join(',')}]  one rep ${t.xWinsOneRep.length} [${t.xWinsOneRep.join(',')}]  ${p.Y} wins both ${t.yWinsBothReps.length}  one ${t.yWinsOneRep.length}  mixed ${t.mixed.length}  neither ${t.neither.length}  incomplete ${t.incomplete.length}`);
  if (p.incomplete.length) console.log(`   incomplete pairs: ${p.incomplete.join(', ')}`);
}
if (OUT) console.log(`\nwritten: ${OUT}`);
