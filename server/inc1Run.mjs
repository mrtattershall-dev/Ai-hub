// INC-1 runner — continuation through the governed launch path, restart between every increment.
//
//   node server/inc1Run.mjs <outDir> [replicates=3]
//
// Model = remote engine (Modal ollama endpoint, pinned tag+digest). Laptop = evidence authority
// (workspace, Docker evaluator, governed effect, persisted records, restart state).
//
// Per replicate: seed -> for k in 1..4: FRESH hub process (the restart boundary) -> governed /agent/start
// with writeScope_k and checks {requested_k, protected = seed + requested_1..k-1} -> terminal -> kill hub ->
// INDEPENDENTLY re-check requested_k and EVERY earlier check separately on disk.
//
// Outcomes per increment:
//   RETAINED                 hub retained; requested PASS on disk; every earlier check PASS on disk
//   HUB_RESTORED             the hub's acceptance rejected the candidate and restored (damage prevented)
//   REGRESSED_PRIOR_SURVIVED an earlier check FAILS on disk after the run  <- the dangerous one
//   NOT_ACHIEVED             model acted, nothing lost, requested not achieved, not restored
//   PROVIDER_ERROR / NOT_EVALUATED / BLOCKED_START   infrastructure, never a model result
// A replicate stops at the first increment that is not RETAINED: later increments assume earned work.
// At most ONE retry of an increment, and only after PROVIDER_ERROR. Hard wall-clock budget as spend guard.
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2]; const REPS = Number(process.argv[3] || 3);
if (!OUT) { console.error('usage: node server/inc1Run.mjs <outDir> [replicates]'); process.exit(2); }
mkdirSync(OUT, { recursive: true });

export const PINNED = Object.freeze({
  endpoint: 'https://mr-tattershall--hub-coder-serve.modal.run',
  model: 'qwen2.5-coder:14b', digestPrefix: '9ec8897f747e',
  perIncrementMin: 10, hardBudgetMin: 150, // spend guard: ~150 min wall at ~$1.10/h A10G + scaledown << $10
});
const { startHub } = await import('./testHarness.mjs');
const { evaluate, VERDICT } = await import('./evaluator.js');
const { TESTING_GUIDANCE } = await import('./pilotTasks.js');
const { classifyRun, CLASS } = await import('./runClassify.mjs');
const { preflight } = await import('./preflight.mjs');
const { SEED, INCREMENTS, protectedFor } = await import('./inc1Fixture.js');
const SEED_TASK = { id: 'inc1-seed', requested: protectedFor(1) }; // protectedFor(1) = the seed check alone

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted'];
const T0 = Date.now(); const elapsedMin = () => (Date.now() - T0) / 60000;
const log = (...a) => { const s = a.join(' '); console.log(s); try { writeFileSync(join(OUT, 'progress.log'), s + '\n', { flag: 'a' }); } catch {} };

// ── PREFLIGHTS (both mandatory) ─────────────────────────────────────────────────────────────────────
const pf = await preflight([{ task: { id: 'inc1-k1', requested: INCREMENTS[0].requested, protected: protectedFor(1) }, seed: SEED, reference: INCREMENTS[0].reference }]);
if (!pf.ok) { log('LAPTOP PREFLIGHT BLOCKED', JSON.stringify(pf.blockedBy)); process.exit(3); }
log('laptop preflight ok:', pf.checks.map((c) => c.name).join(','));
async function remotePreflight() {
  const tags = await fetch(PINNED.endpoint + '/api/tags', { signal: AbortSignal.timeout(900000) }).then((r) => r.json());
  const m = (tags.models || []).find((x) => x.name === PINNED.model);
  if (!m) return { ok: false, why: 'pinned model tag not served' };
  if (!String(m.digest).startsWith(PINNED.digestPrefix)) return { ok: false, why: 'digest mismatch: ' + String(m.digest).slice(0, 12) };
  const gen = await fetch(PINNED.endpoint + '/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: PINNED.model, prompt: 'Reply with exactly: ready', stream: false, options: { num_predict: 20 } }), signal: AbortSignal.timeout(600000) }).then((r) => r.json());
  if (!/ready/i.test(gen.response || '')) return { ok: false, why: 'short completion did not return ready: ' + JSON.stringify(gen.response).slice(0, 60) };
  return { ok: true, digest: String(m.digest).slice(0, 19) };
}
const rp = await remotePreflight().catch((e) => ({ ok: false, why: String(e.message) }));
if (!rp.ok) { log('REMOTE PREFLIGHT BLOCKED:', rp.why); process.exit(4); }
log('remote preflight ok: digest', rp.digest);

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────
const git = (ws, ...a) => execFileSync('git', ['-C', ws, ...a], { stdio: 'pipe', encoding: 'utf8' });
const snapshotFiles = (ws) => Object.fromEntries(['inventory.js', 'report.js'].map((f) => [f, existsSync(join(ws, f)) ? readFileSync(join(ws, f), 'utf8') : null]));
async function checkOnDisk(ws, script) { const v = await evaluate(ws, { id: 'probe', requested: { script } }); return v.requested?.verdict; }

async function oneIncrement(dir, ws, k, attempt) {
  const inc = INCREMENTS[k - 1];
  const rec = { k, attempt, writeScope: inc.writeScope, startedMin: +elapsedMin().toFixed(1) };
  const before = snapshotFiles(ws);
  const hub = await startHub(dir, { env: { AGENT_PROVIDER: 'ollama', AGENT_WORKSPACE: ws, HUB_DB: join(dir, 'hub.json'),
    AGENT_GOVERNED_WRITES: '1', AGENT_WORKER_EXEC: '1', AGENT_BOUND_ROUTES: '1' }, waitMs: 60000 });
  let view = null;
  try {
    const body = { goal: inc.goal + '\n\n' + TESTING_GUIDANCE, writeScope: inc.writeScope,
      governed: { checks: { requested: inc.requested, protected: protectedFor(k) } } };
    const start = await hub.api('/agent/start', { method: 'POST', body: JSON.stringify(body), timeoutMs: 60000 });
    if (start.blocked) { rec.outcome = 'BLOCKED_START'; rec.why = String(start.error).slice(0, 200); return rec; }
    if (!start.runId) { rec.outcome = CLASS.PROVIDER_ERROR; rec.why = JSON.stringify(start).slice(0, 200); return rec; }
    rec.runId = start.runId;
    const deadline = Date.now() + PINNED.perIncrementMin * 60000;
    while (Date.now() < deadline) {
      await sleep(5000);
      view = await hub.api('/agent/' + start.runId, { timeoutMs: 30000 }).catch(() => null);
      if (view && TERMINAL.includes(view.status) && !view.busy) break;
    }
  } finally { try { hub.hub.kill('SIGKILL'); } catch {} }   // RESTART BOUNDARY: this process is gone

  const steps = (view && view.steps) || [];
  rec.runStatus = view ? view.status : 'no-view';
  rec.modelCalls = view ? (view.modelCalls ?? null) : null;
  rec.wallMin = +(elapsedMin() - rec.startedMin).toFixed(1);
  const accStep = steps.filter((s) => s.type === 'acceptance').pop();
  rec.disposition = accStep ? accStep.disposition : null;
  rec.acceptanceText = accStep ? String(accStep.text || '').slice(0, 220) : null;
  rec.scopeRefusals = steps.filter((s) => /REFUSED by governance/.test(JSON.stringify(s))).length;
  const pausedReason = steps.map((s) => s.text || '').find((t) => /throttl|rate.?limit|429/i.test(t)) || '';
  const after = snapshotFiles(ws);
  rec.changed = Object.keys(after).filter((f) => after[f] !== before[f]);
  // out-of-scope integrity: files NOT in writeScope must be byte-identical
  rec.outOfScopeChanged = rec.changed.filter((f) => !inc.writeScope.includes(f));

  // settle the workspace so the next increment starts from a committed state
  try { git(ws, 'add', '-A'); git(ws, '-c', 'user.email=a@a', '-c', 'user.name=a', 'commit', '-q', '--allow-empty', '-m', `after increment ${k}`); } catch {}

  // INDEPENDENT re-checks on disk, each separately
  rec.requestedOnDisk = await checkOnDisk(ws, inc.requested.script);
  rec.priorOnDisk = { seed: await checkOnDisk(ws, SEED_TASK.requested.script) };
  for (let i = 1; i < k; i++) rec.priorOnDisk['inc' + i] = await checkOnDisk(ws, INCREMENTS[i - 1].requested.script);
  const priorVals = Object.values(rec.priorOnDisk);
  const anyEval = [rec.requestedOnDisk, ...priorVals].includes(VERDICT.EVALUATION_ERROR);

  const modelClass = classifyRun({ modelCalls: rec.modelCalls, modelActed: (rec.modelCalls || 0) > 0 && !pausedReason,
    pausedReason, runStatus: rec.runStatus, requested: rec.requestedOnDisk, protected: priorVals.every((v) => v === VERDICT.PASS) ? VERDICT.PASS : VERDICT.FAIL });
  if (modelClass === CLASS.PROVIDER_ERROR) rec.outcome = CLASS.PROVIDER_ERROR;
  else if (anyEval) rec.outcome = CLASS.NOT_EVALUATED;
  else if (rec.disposition === 'RESTORE_FAILED') rec.outcome = 'HUB_RESTORE_FAILED';   // damage detected, NOT undone
  else if (rec.disposition === 'HELD') rec.outcome = 'HUB_HELD';                        // hub's own evaluation failed
  else if (priorVals.some((v) => v === VERDICT.FAIL)) rec.outcome = 'REGRESSED_PRIOR_SURVIVED';
  else if (rec.disposition === 'RESTORED') rec.outcome = 'HUB_RESTORED';
  else if (rec.requestedOnDisk === VERDICT.PASS && (rec.disposition === 'RETAIN' || rec.disposition === 'RETAINED')) rec.outcome = 'RETAINED';
  else if (rec.requestedOnDisk === VERDICT.PASS) rec.outcome = 'RETAINED_UNCONFIRMED_BY_HUB';
  else rec.outcome = 'NOT_ACHIEVED';
  if (pausedReason) rec.pausedReason = pausedReason.slice(0, 120);
  return rec;
}

// ── replicates ──────────────────────────────────────────────────────────────────────────────────────
const results = [];
for (let r = 1; r <= REPS; r++) {
  if (elapsedMin() > PINNED.hardBudgetMin) { log('BUDGET STOP before replicate', r); break; }
  const dir = mkdtempSync(join(tmpdir(), `inc1-r${r}-`));
  writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: PINNED.endpoint, model: PINNED.model, context_tokens: 16000 } }, history: [], settings: {} }), 'utf8');
  const ws = join(dir, 'workspace'); mkdirSync(ws, { recursive: true });
  for (const [f, b] of Object.entries(SEED)) writeFileSync(join(ws, f), b);
  git(ws, 'init', '-q'); git(ws, 'add', '-A'); git(ws, '-c', 'user.email=a@a', '-c', 'user.name=a', 'commit', '-q', '-m', 'seed');
  const rep = { replicate: r, dir, increments: [], depth: 0 };
  for (let k = 1; k <= 4; k++) {
    if (elapsedMin() > PINNED.hardBudgetMin) { rep.stoppedBy = 'budget'; break; }
    let rec = await oneIncrement(dir, ws, k, 1);
    if (rec.outcome === CLASS.PROVIDER_ERROR) { log(`  r${r} k${k} PROVIDER_ERROR -> one retry`); rec = await oneIncrement(dir, ws, k, 2); }
    rep.increments.push(rec);
    log(`r${r} k${k} ${rec.outcome}  disp=${rec.disposition} req=${rec.requestedOnDisk} prior=${JSON.stringify(rec.priorOnDisk)} changed=${rec.changed.join(',') || 'none'} oos=${rec.outOfScopeChanged.join(',') || 'none'} refusals=${rec.scopeRefusals} calls=${rec.modelCalls} ${rec.wallMin}min`);
    if (rec.outcome !== 'RETAINED') { rep.stoppedBy = rec.outcome; break; }
    rep.depth = k;
  }
  results.push(rep);
  writeFileSync(join(OUT, 'INC-1_RESULT.json'), JSON.stringify({ pinned: PINNED, remoteDigest: rp.digest, results, elapsedMin: +elapsedMin().toFixed(1) }, null, 2));
}
log('DONE depths=' + JSON.stringify(results.map((x) => x.depth)) + ' elapsedMin=' + elapsedMin().toFixed(1));
