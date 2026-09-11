// regress-multi.mjs - regressions for a sequence recorded in SEVERAL runs (a resumed sequence), honest about
// what cannot be known.
//
//   node regress-multi.mjs --goals <goals.json> --checker <checks-X.mjs> --final <final checks.json> [--out rows.json]
//        --seg <trialDir>=<firstGoal>-<lastGoal> [--seg ...]
//
// Each segment is one trial folder (runs/ + workspace/.git) holding goals firstGoal..lastGoal in order. A goal's
// "then" state is the start of the NEXT goal in the same segment (runstates.mjs). It is UNKNOWN when:
//   - the goal or the next goal has no run file (the hub deleted run files past AGENT_MAX_RUNS), or
//   - no run at or after the next goal in that segment made a checkpoint (checkpointing had died: an unaddable file
//     or a stale index.lock - set D), because then the repo no longer holds the tree.
// The last goal of the LAST segment ends in the final workspace (--final). Everything else unknown stays unknown:
// guessing it would turn dead checkpoints into false regressions.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runStates, exportTree } from './runstates.mjs';
import { createdMs } from './regress.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const goals = JSON.parse(readFileSync(opt('goals'), 'utf8'));
const CHECKER = opt('checker');
const finalRes = JSON.parse(readFileSync(opt('final'), 'utf8')).results;
const segs = argv.map((a, i) => (a === '--seg' ? argv[i + 1] : null)).filter(Boolean).map((s) => {
  const eq = s.lastIndexOf('='); const [a, b] = s.slice(eq + 1).split('-').map(Number);
  return { dir: s.slice(0, eq), first: a, last: b };
});
const lastGoal = Math.max(...segs.map((s) => s.last));
const byGoal = (res, g) => res.find((r) => r.goal === g);
const rows = new Map();   // goal -> row
const cache = new Map();

for (const seg of segs) {
  const ws = join(seg.dir, 'workspace');
  const all = readdirSync(join(seg.dir, 'runs')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(seg.dir, 'runs', f), 'utf8')))
    .sort((a, b) => createdMs(a) - createdMs(b));
  // map each run to its goal number by text, inside this segment's range
  const goalOf = (r) => { for (let g = seg.first; g <= seg.last; g++) if (goals[g - 1].trim() === String(r.goal || '').trim()) return g; return null; };
  const runs = all.filter((r) => goalOf(r) !== null);
  const rs = runStates(ws, runs);
  const idx = new Map(runs.map((r, k) => [goalOf(r), k]));
  const cpAfter = (k) => rs.info.slice(k).some((x) => x.cps.length > 0);   // checkpointing still alive at/after run k
  for (let g = seg.first; g <= seg.last; g++) {
    const end = byGoal(finalRes, g);
    let then = null, why = '';
    if (seg.last === lastGoal && g === lastGoal) then = end;                   // the final workspace itself
    else if (!idx.has(g)) why = 'no run file (deleted past AGENT_MAX_RUNS)';
    else if (!idx.has(g + 1)) why = g === seg.last ? 'last goal of a resumed segment' : 'next goal has no run file';
    else if (!cpAfter(idx.get(g + 1))) why = 'checkpointing had died - the repo no longer holds this state';
    else {
      const sha = rs.start(idx.get(g + 1));
      if (sha === 'final') why = 'no later state in this segment';
      else {
        if (!cache.has(sha)) {
          const base = mkdtempSync(join(tmpdir(), 'rmulti-')); const dir = join(base, 'ws'); exportTree(ws, sha, dir);
          const o = join(base, 'res.json');
          spawnSync(process.execPath, [CHECKER, dir, '--out', o], { encoding: 'utf8', timeout: 900000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
          cache.set(sha, existsSync(o) ? JSON.parse(readFileSync(o, 'utf8')).results : []);
          rmSync(base, { recursive: true, force: true });
        }
        then = byGoal(cache.get(sha), g) || null;
        if (!then) why = 'checker gave no result';
      }
    }
    rows.set(g, { goal: g, file: end ? end.file : '', status: idx.has(g) ? runs[idx.get(g)].status : null,
      thenImpl: then ? then.impl : null, endImpl: end ? end.impl : false, endAsIs: end ? end.asIs : false,
      regressed: !!(then && then.impl && end && !end.impl), unknown: !then, why: then ? '' : why, endWhy: end ? end.why : '' });
  }
}
const out = [...rows.values()].sort((a, b) => a.goal - b.goal);
for (const r of out) console.log(`${String(r.goal).padStart(3)} ${String(r.file).padEnd(15)} ${String(r.status).padEnd(18)} then ${r.unknown ? '?  ' : (r.thenImpl ? 'P  ' : 'F  ')} end ${r.endImpl ? 'P' : 'F'}${r.regressed ? '  <- REGRESSED' : ''}  ${r.unknown ? '(' + r.why + ')' : ''}`);
const known = out.filter((r) => !r.unknown);
console.log(`\n${out.length} goals | end state known for ${known.length} | worked when written ${known.filter((r) => r.thenImpl).length} of those | REGRESSED ${out.filter((r) => r.regressed).length} | works at the end ${out.filter((r) => r.endImpl).length}`);
if (opt('out')) writeFileSync(opt('out'), JSON.stringify(out, null, 2));
