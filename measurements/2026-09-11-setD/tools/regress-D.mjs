// regress-D.mjs <label> [goalsFile] [checker] : did each goal's step work WHEN WRITTEN, and does it still work at the END?
//
// The hub commits the whole workspace BEFORE each mutating tool ("before <tool>: <thought>"), so the end state of
// goal i is the tree of the first checkpoint that belongs to a LATER goal. A checkpoint's owner is found by
// matching its thought text to the thoughts recorded in the run files (unique 40-char prefixes only); a checkpoint
// with no usable thought falls back to timing (the last goal that had started by then; git times are whole
// seconds, so this is used only when the text cannot decide). The last goal, and any goal with no later
// checkpoint, uses the final workspace. Each state is exported with git archive and scored with the same hidden
// checks; only goal i's own step is read from it. REGRESSED = implementation correct when written, not at the end.
//
// Stricter than the pre-registered "trial35 per-goal work check at that time", which cannot run the hidden
// asserts; both are reported (trial35's flag is the ON DISK column of <label>-setC.log).
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const D = join(HERE, '..');
const [label, goalsArg, checkerArg] = process.argv.slice(2);
if (!label) { console.error('usage: regress-D.mjs <label> [goalsFile] [checker]'); process.exit(2); }
const SET = process.env.SET_TAG || 'setD';
const log = readFileSync(join(D, `${label}-${SET}.log`), 'utf8');
const ws = (log.match(/^workspace (.+)$/m) || [])[1].trim();
const trial = dirname(ws);
const goals = JSON.parse(readFileSync(goalsArg || join(D, 'goals-D.json'), 'utf8'));
const CHECKER = checkerArg || join(HERE, 'checks-D.mjs');
const onDisk = {};
for (const m of log.matchAll(/^\s+(\d+)\s+(\S+)\s.*?(\S+)\s*$/gm)) onDisk[Number(m[1])] = `${m[2]} ${m[3]}`;

// runs in goal order
const runs = readdirSync(join(trial, 'runs')).map((f) => JSON.parse(readFileSync(join(trial, 'runs', f), 'utf8')))
  .map((r) => ({ goal: String(r.goal || ''), status: r.status, start: Date.parse(r.createdAt) || Number(r.createdAt), steps: r.steps || [] }))
  .sort((a, b) => a.start - b.start);
for (const [i, r] of runs.entries()) if (r.goal.trim() !== goals[i].trim()) { console.error(`run ${i + 1} is not goal ${i + 1}: ${r.goal.slice(0, 60)}`); process.exit(1); }

// thought prefix -> run index (unique prefixes only)
const P = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 40);
const owner = new Map(), clash = new Set();
runs.forEach((r, i) => { for (const s of r.steps) { const p = P(s.thought); if (p.length < 20) continue; if (owner.has(p) && owner.get(p) !== i) clash.add(p); else owner.set(p, i); } });
const commits = execFileSync('git', ['-C', ws, 'log', '--reverse', '--format=%H %ct %s'], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean).map((l) => {
    const [h, t, ...rest] = l.split(' '); const subj = rest.join(' '); const tt = Number(t) * 1000;
    const p = P(subj.slice(subj.indexOf(': ') + 2));
    let who = (p.length >= 20 && owner.has(p) && !clash.has(p)) ? owner.get(p) : -1, how = 'text';
    if (who < 0) { how = 'time'; who = -1; runs.forEach((r, i) => { if (r.start <= tt + 999) who = i; }); }
    return { h, t: tt, who, how, subj };
  });

function checksAt(dir) {
  const out = join(dir, '..', 'res.json');
  spawnSync(process.execPath, [CHECKER, dir, '--out', out], { encoding: 'utf8', timeout: 900000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  return JSON.parse(readFileSync(out, 'utf8')).results;
}
const finalRes = JSON.parse(readFileSync(process.env.FINAL_CHECKS || join(D, label + '-checks.json'), 'utf8')).results;
const cache = new Map();   // commit -> results
const rows = [];
let byTime = 0;
for (let i = 0; i < runs.length; i++) {
  const c = commits.find((x) => x.who > i);
  let res;
  if (!c) res = finalRes;
  else if (cache.has(c.h)) res = cache.get(c.h);
  else {
    if (c.how === 'time') byTime++;
    const base = mkdtempSync(join(tmpdir(), 'regC-')); const dir = join(base, 'ws');
    execFileSync('bash', ['-c', `mkdir -p "${dir.replace(/\\/g, '/')}" && git -C "${ws.replace(/\\/g, '/')}" archive ${c.h} | tar -x -C "${dir.replace(/\\/g, '/')}"`]);
    res = checksAt(dir); cache.set(c.h, res); rmSync(base, { recursive: true, force: true });
  }
  const then = res[i], end = finalRes[i];
  rows.push({ goal: i + 1, file: end.file, status: runs[i].status, thenImpl: then.impl, thenAsIs: then.asIs, endImpl: end.impl, endAsIs: end.asIs,
    regressed: then.impl && !end.impl, state: c ? c.h.slice(0, 7) + (c.how === 'time' ? '~' : '') : 'final', why: end.why, thenWhy: then.why });
}
const tag = (a, im) => (a ? 'P ' : (im ? 'CT' : 'F '));
for (const r of rows) console.log(`${String(r.goal).padStart(3)} ${r.file.padEnd(15)} ${String(r.status).padEnd(8)} then ${tag(r.thenAsIs, r.thenImpl)} end ${tag(r.endAsIs, r.endImpl)}${r.regressed ? '  <- REGRESSED' : ''}  [${r.state}] trial35: ${onDisk[r.goal] || '?'}  ${r.endImpl ? '' : r.why.slice(0, 80)}`);
const n = rows.length, sum = (k) => rows.filter((r) => r[k]).length;
console.log(`\n${label}: ${n} goals run | worked when written ${sum('thenImpl')} | works at the end ${sum('endImpl')} (as asked ${sum('endAsIs')}) | REGRESSED ${sum('regressed')} | end-states located by timing (~): ${byTime}`);
if (process.env.REGRESS_OUT) (await import('node:fs')).writeFileSync(process.env.REGRESS_OUT, JSON.stringify(rows, null, 2));
