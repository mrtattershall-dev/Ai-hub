/**
 * recheckArtifacts.mjs - re-judge every stored NARROW artifact with the CORRECTED verifier, and
 * put the accepted one through every invocation path there is.
 *
 *   node server/recheckArtifacts.mjs <dir-with-seed*.json ...> [--out report.json]
 *
 * Two questions, both about trust in the earlier classifications:
 *
 *   1. RECHECK. The play's static server had a path-containment defect (a forward-slash
 *      directory 404'd every request) and reported an unservable entry page as failing steps.
 *      Every stored record was produced through a backslash path, so none should change - but
 *      "should" is not "checked". Each artifact is extracted from its record, written to a
 *      fresh directory, and re-judged; the new passing set is compared with the recorded one.
 *   2. PATHS. The accepted artifact is judged again through all three invocation paths that
 *      exist: playCheck directly, the automatic diagnostic (autodiag's play kind), and the
 *      independent evaluator with the task's requested spec. They must agree.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const OUT = (() => { const i = argv.indexOf('--out'); return i > -1 ? argv[i + 1] : null; })();
const DIRS = argv.filter((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--out');
if (!DIRS.length) { console.error('usage: recheckArtifacts.mjs <dir> [<dir>...] [--out f]'); process.exit(2); }

const { playCheck } = await import('./playCheck.js');
const { runDiagnostic } = await import('./autodiag.js');
const { evaluate } = await import('./evaluator.js');
const { farmTasks } = await import('./benchTasks.js');

const tasks = Object.fromEntries(farmTasks().map((t) => [t.id, t]));
const artifactOf = (rec) => {
  const text = String(rec.reply || '');
  const open = text.match(/^[ \t]*```[^\n]*\n/m);
  if (!open) return null;
  const rest = text.slice(open.index + open[0].length);
  const close = rest.match(/^[ \t]*```[ \t]*$/m);
  return close ? rest.slice(0, close.index) : null;
};
const setEq = (a, b) => JSON.stringify([...a].sort((x, y) => x - y)) === JSON.stringify([...b].sort((x, y) => x - y));

const report = { rechecked: [], paths: null, disagreements: [] };

console.log('=== 1. RECHECK every stored artifact with the corrected verifier ===');
for (const dir of DIRS) {
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^seed\d+\.json$/.test(f)).sort() : [];
  for (const f of files) {
    const rec = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const label = `${dir.split(/[\\/]/).pop()}/${f.replace('.json', '')} (${rec.protocol})`;
    const art = artifactOf(rec);
    if (!art) { console.log(`  ${label.padEnd(34)} no complete artifact in the record - nothing to recheck`); continue; }
    const task = tasks[rec.task];
    const ws = mkdtempSync(join(tmpdir(), 'recheck-'));
    try {
      writeFileSync(join(ws, task.diagnostic.spec.entry || 'index.html'), art, 'utf8');
      const r = await playCheck(ws, task.diagnostic.spec, { timeoutMs: 90_000 });
      const wasPassing = (rec.play && rec.play.passing) || [];
      const nowPassing = [...r.passing];
      const same = r.status === 'OK' && setEq(wasPassing, nowPassing);
      const row = { record: label, recordedPassing: wasPassing, recheckedPassing: nowPassing, recheckStatus: r.status, unchanged: same };
      report.rechecked.push(row);
      if (!same) report.disagreements.push(row);
      console.log(`  ${label.padEnd(34)} recorded [${wasPassing.join(',')}]  rechecked [${nowPassing.join(',')}]  ${same ? 'UNCHANGED' : 'DIFFERS'}`);
    } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
}

console.log('\n=== 2. the ACCEPTED artifact through every invocation path ===');
{
  const accepted = report.rechecked.length
    ? DIRS.flatMap((d) => (existsSync(d) ? readdirSync(d).filter((f) => /^seed\d+\.json$/.test(f)).map((f) => ({ d, f, rec: JSON.parse(readFileSync(join(d, f), 'utf8')) })) : []))
      .find((x) => x.rec.boundaries && x.rec.boundaries.accepted === true)
    : null;
  if (!accepted) { console.log('  no accepted artifact among these records'); }
  else {
    const rec = accepted.rec;
    const task = tasks[rec.task];
    const entry = task.diagnostic.spec.entry || 'index.html';
    const art = artifactOf(rec);
    const ws = mkdtempSync(join(tmpdir(), 'paths-'));
    try {
      writeFileSync(join(ws, entry), art, 'utf8');
      for (const args of [['init', '-q'], ['config', 'core.autocrlf', 'false'], ['add', '-A'], ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'c']]) execFileSync('git', ['-C', ws, ...args], { windowsHide: true });
      const direct = await playCheck(ws, task.diagnostic.spec, { timeoutMs: 90_000 });
      const diag = await runDiagnostic(ws, task.diagnostic, { timeoutSec: 90 });
      const evald = await evaluate(ws, task, { timeoutSec: 120 });
      const want = task.requested.play.steps;
      const p = {
        source: `${accepted.d.split(/[\\/]/).pop()}/${accepted.f}`, task: rec.task, requestedSteps: want,
        playCheckDirect: { status: direct.status, passing: [...direct.passing] },
        automaticDiagnostic: { status: diag.status, passed: diag.passed, attempted: diag.attempted, failing: (diag.failures || []).map((x) => x.n) },
        evaluator: { requested: evald.requested?.verdict ?? null, overall: evald.verdict },
      };
      p.agree = direct.status === 'OK' && setEq(direct.passing, want) && diag.status === 'OK' && diag.passed === want.length && evald.requested?.verdict === 'PASS';
      report.paths = p;
      console.log(`  playCheck direct       ${p.playCheckDirect.status}  passing [${p.playCheckDirect.passing.join(',')}]`);
      console.log(`  automatic diagnostic   ${p.automaticDiagnostic.status}  ${p.automaticDiagnostic.passed}/${p.automaticDiagnostic.attempted} pass`);
      console.log(`  independent evaluator  requested ${p.evaluator.requested}  overall ${p.evaluator.overall}`);
      console.log(`  -> all three paths agree on the requested steps [${want.join(',')}]: ${p.agree ? 'YES' : 'NO'}`);
    } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
}

console.log(`\n  recheck: ${report.rechecked.length} artifact(s) re-judged, ${report.disagreements.length} classification change(s)`);
if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8'); console.log(`  written: ${OUT}`); }
process.exit(report.disagreements.length || (report.paths && !report.paths.agree) ? 1 : 0);
