// build-scenarios.mjs - turn a recorded sequential run into REPLAY SCENARIOS for the mock model.
//
//   node build-scenarios.mjs --ws <trial workspace (with .git)> --runs <runs dir> --label <model label> --set <set name>
//        --out <scenarios.jsonl> [--final <final workspace dir>] [--regress <regress.json>] [--grades <grades.json>]
//
// One scenario per goal:
//   start    the workspace files when the goal began (text files under 200 KB; .git, node_modules, __pycache__,
//            .screenshots skipped), rebuilt from the hub's own checkpoints (runstates.mjs)
//   replies  every assistant reply of that run, in order - what the mock model will serve
//   hubSaid  the hub's message after each reply (first 600 chars), to compare a replay against the original
//   outcome  status, finishBlocks, model calls, and the verdict: hidden checks + regression (sets C/D, from
//            regress.json) or a hand grade (sets A/B, from grades.json: { "<goal#>": "F: why" })
//   tags     multi-action / forced-finish / false-done / regressed / stopped / hand-F - what the scenario reproduces
// Replaying: replay-run.mjs. These are free, deterministic reproductions of real failures for testing hub patches.
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { runStates, exportTree } from './runstates.mjs';
import { createdMs } from './regress.mjs';

const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
const WS = arg('ws'), RUNS = arg('runs'), LABEL = arg('label'), SET = arg('set'), OUT = arg('out');
if (!WS || !RUNS || !LABEL || !SET || !OUT) { console.error('usage: see header'); process.exit(2); }
const regress = arg('regress') && existsSync(arg('regress')) ? JSON.parse(readFileSync(arg('regress'), 'utf8')) : null;
const grades = arg('grades') && existsSync(arg('grades')) ? JSON.parse(readFileSync(arg('grades'), 'utf8')) : {};

const SKIP_DIR = new Set(['.git', 'node_modules', '__pycache__', '.screenshots']);
function snapshot(dir) {
  const files = {};
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (SKIP_DIR.has(e.name)) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.isFile() || statSync(p).size > 200_000) continue;
      const buf = readFileSync(p);
      if (buf.includes(0)) continue;                       // binary
      files[relative(dir, p).replace(/\\/g, '/')] = buf.toString('utf8');
    }
  };
  walk(dir);
  return files;
}

const runs = readdirSync(RUNS).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(RUNS, f), 'utf8')))
  .sort((a, b) => createdMs(a) - createdMs(b));
const rs = runStates(WS, runs);
const finalSnap = arg('final') ? snapshot(arg('final')) : null;
const cache = new Map();
const lines = [];
let bytes = 0;
for (let j = 0; j < runs.length; j++) {
  const r = runs[j];
  const sha = rs.start(j);
  let start;
  if (sha === 'final') start = finalSnap || {};
  else if (cache.has(sha)) start = cache.get(sha);
  else { const base = mkdtempSync(join(tmpdir(), 'scen-')); const d = join(base, 'w'); exportTree(WS, sha, d); start = snapshot(d); rmSync(base, { recursive: true, force: true }); cache.set(sha, start); }
  const hist = r.history || [];
  const replies = [], hubSaid = [];
  hist.forEach((m, k) => {
    if (m.role !== 'assistant') return;
    replies.push(String(m.content || ''));
    const nx = hist[k + 1];
    hubSaid.push(nx && nx.role === 'user' ? String(nx.content || '').slice(0, 600) : '');
  });
  const multi = replies.filter((t) => (t.match(/^\s*ACTION:/gim) || []).length > 1).length;
  const rg = regress ? regress.find((x) => x.goal === j + 1) : null;
  const grade = grades[String(j + 1)] || null;
  const tags = [];
  if (multi) tags.push('multi-action');
  if (r.status === 'done' && (r.finishBlocks || 0) >= 3) tags.push('forced-finish');
  if (r.status === 'done' && ((rg && !rg.thenImpl) || (grade && /^F/.test(grade)))) tags.push('false-done');
  if (rg && rg.regressed) tags.push('regressed');
  if (r.status === 'stopped') tags.push('stopped');
  if (grade && /^F/.test(grade)) tags.push('hand-F');
  const row = {
    id: `${SET}-${LABEL}-g${String(j + 1).padStart(3, '0')}`, set: SET, model: LABEL, goalNo: j + 1, goal: r.goal,
    startFrom: sha === 'final' ? 'final' : sha.slice(0, 10), startHow: rs.how(j), start, replies, hubSaid,
    outcome: { status: r.status, finishBlocks: r.finishBlocks || 0, modelCalls: r.modelCalls, steps: (r.steps || []).length,
      verdict: rg ? { whenWritten: rg.thenImpl, atEnd: rg.endImpl, why: rg.why || rg.thenWhy || '' } : (grade ? { hand: grade } : null) },
    tags,
  };
  const line = JSON.stringify(row); bytes += line.length; lines.push(line);
}
writeFileSync(OUT, lines.join('\n') + '\n');
const count = (t) => lines.filter((l) => JSON.parse(l).tags.includes(t)).length;
console.log(`${OUT}: ${lines.length} scenarios, ${(bytes / 1e6).toFixed(2)} MB | multi-action ${count('multi-action')} | forced-finish ${count('forced-finish')} | false-done ${count('false-done')} | regressed ${count('regressed')} | stopped ${count('stopped')} | hand-F ${count('hand-F')}`);
