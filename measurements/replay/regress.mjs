// regress.mjs - did each goal's step work WHEN WRITTEN, and does it still work at the END? (shared by sets C and D)
//
// End state of goal i = start state of goal i + 1, located from the run files' own checkpoint steps
// (runstates.mjs - no timing, no guessing). Each state is exported and scored with the set's hidden checks;
// only goal i's own step is read from it. REGRESSED = implementation correct when written, not at the end.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { runStates, exportTree } from './runstates.mjs';

// createdAt is epoch ms (a number) in run files; accept an ISO string too.
export const createdMs = (r) => (typeof r.createdAt === 'number' ? r.createdAt : (Date.parse(r.createdAt) || Number(r.createdAt) || 0));

export async function main({ D, set, goalsFile, checker, label, finalChecks, out }) {
  const log = readFileSync(join(D, `${label}-${set}.log`), 'utf8');
  const ws = (log.match(/^workspace (.+)$/m) || [])[1].trim();
  const trial = dirname(ws);
  const goals = JSON.parse(readFileSync(goalsFile, 'utf8'));
  const onDisk = {};
  for (const m of log.matchAll(/^\s+(\d+)\s+(\S+)\s.*?(\S+)\s*$/gm)) onDisk[Number(m[1])] = `${m[2]} ${m[3]}`;
  const runs = readdirSync(join(trial, 'runs')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(trial, 'runs', f), 'utf8')))
    .sort((a, b) => createdMs(a) - createdMs(b));
  for (const [i, r] of runs.entries()) if (String(r.goal || '').trim() !== goals[i].trim()) throw new Error(`run ${i + 1} is not goal ${i + 1}`);
  const rs = runStates(ws, runs);
  const finalRes = JSON.parse(readFileSync(finalChecks || join(D, label + '-checks.json'), 'utf8')).results;
  const byGoal = (res, g) => res.find((r) => r.goal === g);
  const cache = new Map(); const rows = [];
  for (let i = 0; i < runs.length; i++) {
    const sha = rs.end(i);
    let res;
    if (sha === 'final') res = finalRes;
    else if (cache.has(sha)) res = cache.get(sha);
    else {
      const base = mkdtempSync(join(tmpdir(), 'regr-')); const dir = join(base, 'ws');
      exportTree(ws, sha, dir);
      const o = join(base, 'res.json');
      spawnSync(process.execPath, [checker, dir, '--out', o], { encoding: 'utf8', timeout: 900000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
      res = JSON.parse(readFileSync(o, 'utf8')).results; cache.set(sha, res); rmSync(base, { recursive: true, force: true });
    }
    const then = byGoal(res, i + 1), end = byGoal(finalRes, i + 1);
    rows.push({ goal: i + 1, file: end.file, status: runs[i].status, finishBlocks: runs[i].finishBlocks || 0,
      thenImpl: then.impl, thenAsIs: then.asIs, endImpl: end.impl, endAsIs: end.asIs, regressed: then.impl && !end.impl,
      state: sha === 'final' ? 'final' : sha.slice(0, 7), how: sha === 'final' ? 'final workspace' : rs.how(i + 1), why: end.why, thenWhy: then.why });
  }
  const tag = (a, im) => (a ? 'P ' : (im ? 'CT' : 'F '));
  for (const r of rows) console.log(`${String(r.goal).padStart(3)} ${r.file.padEnd(15)} ${String(r.status).padEnd(8)} then ${tag(r.thenAsIs, r.thenImpl)} end ${tag(r.endAsIs, r.endImpl)}${r.regressed ? '  <- REGRESSED' : ''}  [${r.state}] trial35: ${onDisk[r.goal] || '?'}  ${r.endImpl ? '' : String(r.why).slice(0, 80)}`);
  const n = rows.length, sum = (k) => rows.filter((r) => r[k]).length;
  console.log(`\n${label}: ${n} goals run | worked when written ${sum('thenImpl')} | works at the end ${sum('endImpl')} (as asked ${sum('endAsIs')}) | REGRESSED ${sum('regressed')}`);
  if (out) writeFileSync(out, JSON.stringify(rows, null, 2));
  return rows;
}
