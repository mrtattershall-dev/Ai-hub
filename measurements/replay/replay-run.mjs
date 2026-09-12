// replay-run.mjs - replay recorded scenarios through a REAL hub with a mock model. Free, offline, deterministic.
//
//   node replay-run.mjs <scenarios.jsonl> [--id <id> | --tag <tag> | --all] [--hub <server/index.js>]
//        [--env KEY=VAL ...] [--out <results.jsonl>] [--keep]
//
// For each scenario: an isolated hub (its own port, workspace, queue, runs, traces - nothing live is touched) is
// started from --hub (default: this repo's server; pass a worktree's server/index.js to test a patch), the
// workspace is seeded with the files the goal started with, and a mock Ollama serves the recorded replies in
// order. When the recording runs out, the mock sends one `finish` and counts the replay as EXHAUSTED: the hub
// asked for more than the model originally said, which means the patched hub behaved differently.
//
// The mock cannot react - the next reply is whatever came next in the recording - so this is not a score. What it
// answers is "given exactly what the model said, what does the hub do?": the gate blocks, the status it records,
// what it tells the model, whether multi-action replies run. That is what a hub patch changes.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const file = argv[0];
const opt = (k) => { const i = argv.indexOf('--' + k); return i > 0 ? argv[i + 1] : undefined; };
const HUB = opt('hub') || join(HERE, '..', '..', 'server', 'index.js');
const extraEnv = {};
argv.forEach((a, i) => { if (a === '--env') { const [k, ...v] = argv[i + 1].split('='); extraEnv[k] = v.join('='); } });
const OUT = opt('out');
const KEEP = argv.includes('--keep');
let scen = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
if (opt('id')) scen = scen.filter((s) => s.id === opt('id') || s.id.endsWith(opt('id')));
else if (opt('tag')) scen = scen.filter((s) => s.tags.includes(opt('tag')));
else if (!argv.includes('--all')) { console.error('pick --id, --tag or --all'); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

const FINISH = 'THOUGHT: The recording has ended.\nACTION: finish\nSUMMARY: replay exhausted';
async function replay(s) {
  const dir = mkdtempSync(join(tmpdir(), 'replay-'));
  const ws = join(dir, 'workspace');
  for (const [p, c] of Object.entries(s.start)) { const f = join(ws, p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, c); }
  mkdirSync(ws, { recursive: true });
  let served = 0, exhausted = 0; const asked = [];
  const mockPort = await freePort(), hubPort = await freePort();
  const mock = createServer((req, res) => {
    if (req.url.startsWith('/api/health')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'replay', model: s.model, lora: null })); }
    let body = ''; req.on('data', (d) => { body += d; });
    req.on('end', () => {
      // Every NEW hub message since the model last spoke - not just the last one, which is always the task ledger.
      try { const b = JSON.parse(body); const msgs = b.messages || []; const la = msgs.map((m) => m.role).lastIndexOf('assistant'); asked.push(msgs.slice(la + 1).map((m) => String(m.content || '')).join('\n---\n').slice(0, 12000)); } catch { asked.push(''); }
      let text; if (served < s.replies.length) text = s.replies[served++]; else { exhausted++; text = FINISH; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: s.model, message: { role: 'assistant', content: text }, done: true }));
    });
  });
  await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
  writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: s.model } }, history: [], settings: {} }));
  const hub = spawn(process.execPath, [HUB], {
    env: { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
      AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
      AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_MAX_AUTO_STARTS: '400', AGENT_MAX_STEPS: '30', AGENT_MAX_MINUTES: '8',
      MODEL_FIRST_BYTE_S: '60', MODEL_STALL_S: '60', MODEL_TIMEOUT_S: '120', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const hubLog = []; hub.stdout.on('data', (d) => hubLog.push(String(d))); hub.stderr.on('data', (d) => hubLog.push(String(d)));
  const API = `http://127.0.0.1:${hubPort}/api`;
  const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
  let up = false; for (let i = 0; i < 240 && !up; i++) { try { await fetch(API + '/auth/hint'); up = true; } catch { await sleep(250); } }
  let run = null, error = null;
  const approvals = [];
  try {
    if (!up) throw new Error('hub never came up: ' + hubLog.join('').slice(-300));
    const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: s.goal }) });
    if (!st.runId) throw new Error('start failed: ' + JSON.stringify(st).slice(0, 200));
    const deadline = Date.now() + 8 * 60000;
    while (Date.now() < deadline) {
      run = await api('/agent/' + st.runId).catch(() => null);
      // Answer approvals the way the recording's harness did (trial35 / trialE): git_commit and git_undo approved,
      // everything else denied. Unanswered, a replay parks where the original run carried on - set E, Qwen3-Coder
      // goal 54 had a git_undo approved and the first replay of it stopped there at 22 of 31 replies.
      // --approvals none turns this off.
      if (run && run.status === 'awaiting_approval' && run.pending && (opt('approvals') || 'harness') === 'harness') {
        const ok = ['git_commit', 'git_undo'].includes(run.pending.tool);
        await api(`/agent/${st.runId}/approve`, { method: 'POST', body: JSON.stringify({ approve: ok }) }).catch(() => null);
        approvals.push(`${run.pending.tool}:${ok ? 'approved' : 'denied'}`);
        await sleep(1000);
        continue;
      }
      if (run && ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'].includes(run.status) && run.busy !== true) break;
      await sleep(1000);
    }
  } catch (e) { error = e.message; }
  hub.kill(); mock.close();
  await sleep(300);
  // What the run left for the NEXT goal: carried-over ledger tasks (e.g. the rollback's "Re-add ..." task).
  let carried = [];
  try { carried = readFileSync(join(ws, 'TASKS.md'), 'utf8').split('\n').filter((l) => /Re-add/.test(l)).map((l) => l.trim().slice(0, 300)); } catch { /* no ledger */ }
  if (!KEEP) rmSync(dir, { recursive: true, force: true });
  const steps = (run && run.steps) || [];
  const res = {
    rollbackNotes: steps.filter((x) => x.type === 'note' && /did not parse at the end of the run/.test(String(x.text || ''))).map((x) => String(x.text).slice(0, 400)),
    carriedTasks: carried,
    approvals,
    id: s.id, error, status: run && run.status, finishBlocks: run && (run.finishBlocks || 0), forcedFinish: run ? !!run.forcedFinish : null,
    served, recorded: s.replies.length, exhausted, modelCalls: run && run.modelCalls,
    original: { status: s.outcome.status, finishBlocks: s.outcome.finishBlocks },
    sameAsOriginal: !!run && run.status === s.outcome.status && (run.finishBlocks || 0) === s.outcome.finishBlocks,
    batchRuns: steps.filter((x) => /batch/i.test(String(x.text || ''))).length,
    discardNudges: asked.filter((a) => /were DISCARDED/.test(a)).length,
    gateBlocks: asked.filter((a) => /Do NOT finish yet/.test(a)).length,
    defLossWarnings: asked.filter((a) => /REMOVED \d+ definition/.test(a)).length,
    // h-fixes: the same damage is now REFUSED rather than narrated, and the refusal uses different words - so the
    // old defLossWarnings pattern reads 0 on that arm and would look like the problem vanished. Count both.
    destructiveRefused: asked.filter((a) => /would have REMOVED \d+ thing\(s\)/.test(a)).length,
    refusedNamed: [...new Set(asked.flatMap((a) => [...a.matchAll(/would have REMOVED \d+ thing\(s\) (\S+) already had: ([^.]+)\./g)].map((m) => `${m[1]}: ${m[2]}`)))],
    refusedNotes: steps.filter((x) => /refused: it would have removed/.test(String(x.text || ''))).length,
    // and the guard's new, honest stop: the TOOL refused identically, rather than 'the model repeated itself'.
    toolLoopStops: steps.filter((x) => /returned the identical answer/.test(String(x.text || ''))).length,
    defLossNamed: [...new Set(asked.flatMap((a) => [...a.matchAll(/had before: ([^.]+)\./g)].map((m) => m[1])))],
    // The set-E fixes (f-fixes): what each one told the model during the replay.
    noChangeEdits: asked.filter((a) => /NO CHANGE: your REPLACE/.test(a)).length,
    exportLossWarnings: asked.filter((a) => /REMOVED what \S+ exported:/.test(a)).length,
    exportLossNamed: [...new Set(asked.flatMap((a) => [...a.matchAll(/REMOVED what (\S+) exported: ([^.]+)\./g)].map((m) => `${m[1]}: ${m[2]}`)))],
    shadowHints: asked.filter((a) => /HIDES the method/.test(a)).length,
    ledgerHidden: asked.filter((a) => /left over from earlier goals about other work are not shown/.test(a)).length,
    staleShown: asked.filter((a) => /left over from earlier work — only do this if the goal needs it/.test(a)).length,
    verifyDetected: [...new Set(asked.flatMap((a) => [...a.matchAll(/PROJECT VERIFICATION \(detected: (\w+)\)/g)].map((m) => m[1])))],
    connRetries: steps.filter((x) => x.type === 'note' && /connection dropped/.test(String(x.text || ''))).length,
    lastSteps: steps.slice(-4).map((x) => `${x.type}${x.tool ? ':' + x.tool : ''} ${String(x.text || x.summary || '').slice(0, 80)}`),
    dir: KEEP ? dir : undefined,
  };
  return res;
}

for (const s of scen) {
  const r = await replay(s);
  console.log(`${r.id} | ${r.error ? 'ERROR ' + r.error : `status ${r.status} (was ${r.original.status}) | finishBlocks ${r.finishBlocks} (was ${r.original.finishBlocks}) | forcedFinish ${r.forcedFinish} | served ${r.served}/${r.recorded}${r.exhausted ? ' EXHAUSTED x' + r.exhausted : ''} | discard nudges ${r.discardNudges} | gate blocks ${r.gateBlocks} | no-change ${r.noChangeEdits} | shadow ${r.shadowHints} | ledger hidden ${r.ledgerHidden} | stale shown ${r.staleShown} | verify ${r.verifyDetected.join('/') || '-'} | conn retries ${r.connRetries} | refused ${r.destructiveRefused} | tool-loop stops ${r.toolLoopStops}`}`);
  if (OUT) appendFileSync(OUT, JSON.stringify(r) + '\n');
}
