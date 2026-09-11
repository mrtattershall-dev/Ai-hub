// preflight-approval.mjs - prove the patched trial35 survives a parked approval, offline, before any GPU spend.
//
// A mock model replays the base 14B's REAL recorded replies for set D goal 9 (the run that asked for
// `open r9_app.html` and parked), then answers `finish` to everything. trial35 runs two goals against it.
// Pass = the `open` is DENIED and goal 2 STARTS (before the patch, every goal after the park failed to start).
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const runsDir = process.argv[2];
const parked = readdirSync(runsDir).map((f) => JSON.parse(readFileSync(join(runsDir, f), 'utf8'))).find((r) => r.status === 'awaiting_approval');
if (!parked) { console.error('no parked run in ' + runsDir); process.exit(2); }
const recorded = (parked.history || []).filter((m) => m.role === 'assistant').map((m) => String(m.content));
const FINISH = 'THOUGHT: Finishing.\nACTION: finish\nSUMMARY: ok';
let served = 0;
const mock = createServer((req, res) => {
  if (req.url.startsWith('/api/health')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'replay-14b', lora: null })); }
  let b = ''; req.on('data', (d) => { b += d; });
  req.on('end', () => { const text = served < recorded.length ? recorded[served] : FINISH; served++; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'replay-14b', message: { role: 'assistant', content: text }, done: true })); });
});
await new Promise((r) => mock.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${mock.address().port}`;
const dir = mkdtempSync(join(tmpdir(), 'preflight-'));
const goals = join(dir, 'goals.json');
writeFileSync(goals, JSON.stringify([parked.goal, 'Write R9_NOTE.md containing the word hello.']));
// ASYNC spawn: the mock model lives in THIS process, and spawnSync would block it from ever answering.
const r = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(HERE, 'trial35.mjs')], { env: { ...process.env, GOALS_FILE: goals, MODEL_BASE: url, MODEL_NAME: 'replay-14b', LABEL: 'preflight' } });
  let stdout = '', stderr = '';
  p.stdout.on('data', (d) => { stdout += d; }); p.stderr.on('data', (d) => { stderr += d; });
  const t = setTimeout(() => p.kill(), 600000);
  p.on('close', () => { clearTimeout(t); resolve({ stdout, stderr }); });
});
mock.close();
const out = (r.stdout || '') + (r.stderr || '');
const denied = /approval denied: run_command/.test(out);
const secondStarted = !/^\s+2\s+START FAILED/m.test(out) && /^\s+2\s+\S+/m.test(out);
console.log(out.split('\n').filter((l) => /approval|^\s+[12]\s|approvals|goals run|START FAILED/.test(l)).join('\n'));
console.log(`\npreflight: open denied ${denied} | goal 2 started ${secondStarted} | recorded replies served ${Math.min(served, recorded.length)}/${recorded.length}`);
process.exit(denied && secondStarted ? 0 : 1);
