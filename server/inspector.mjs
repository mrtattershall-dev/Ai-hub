/**
 * inspector.mjs - the second Watcher: Claude reads the hub's own code, and every bug it claims has to
 * survive the way Legasus executes a change before it is believed.
 *
 *   node server/inspector.mjs --files server/taskLedger.js,server/agentParse.js [--focus "what to look at"] [--max 3]
 *   node server/inspector.mjs --files server/agent.js --excerpt "server/agent.js:3198-3240,5540-5640"   large files: show ranges only
 *   node server/inspector.mjs --files ... --replay data/inspector/<id>[,...]   re-run the gates on saved findings, no model call
 *
 * THE CHANGE PROCESS, in order. Each gate is written to Enoch (watcher: 'inspector'), pass or fail.
 *
 *   0 SCOPE    The requester names the files. Authority is minted for exactly those, each pinned to the
 *              revision (sha256 of its bytes) the reviewer is about to read - BEFORE any model call. A fix
 *              touching any other file, or a file that moved since, is refused by governedEdit, not here.
 *   1 FREEZE   HEAD, the scoped files' revisions and the prompt's digest are recorded before the call.
 *   2 DIAGNOSE The reviewer reads the scoped code and the evidence (hub-fault verdicts in Enoch, fuzz
 *              violations) and returns findings, each with a test and a fix.
 *   3 RED      The test runs against the UNCHANGED code in the isolated worker. It must FAIL, and fail on an
 *              assertion: a test that dies on an import or a syntax error has not shown the bug, and a test
 *              that passes has not reproduced it. Either way the finding stops here, recorded.
 *   4 FIX      Every edit goes through governedEdit under the step-0 authority. The test file is the only
 *              other path granted, and its name is chosen here, not by the model.
 *   5 GREEN    The test passes on the fixed code.
 *   6 STRESS   Ten consecutive passes, and every existing test that names a touched file is run before and
 *              after the fix: anything that passed before and fails after is a regression and stops it.
 *   7 COMMIT   One commit on its own branch, watchers/<id>, off HEAD. Never the checked-out branch, never
 *              pushed. Merging is the owner's decision.
 *
 * A finding is a hypothesis until RED; a fix is a proposal until STRESS. Fixes are made against COMMITTED
 * code (HEAD), which is also what the reviewer is shown - uncommitted work in the tree is not inspected.
 *
 * Budget: shares the Watchers' cap (WATCHERS_BUDGET_USD) and ledger (server/enoch/enoch.jsonl).
 */
import Anthropic from '@anthropic-ai/sdk';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { record, spent, costUsd, priceOf, enochPath } from './watchers.js';
import { governedEdit, editAction } from '../legasus/runtime/epistemic-admission/governed-edit.mjs';
import { delegate } from '../legasus/legaknow/calculus.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(process.env.INSPECT_REPO || join(HERE, '..'));
const OUT = resolve(process.env.INSPECT_OUT || join(REPO, 'data', 'inspector'));
const IMAGE = process.env.INSPECT_IMAGE || 'legasus-worker:1';
const STRESS_RUNS = 10;
const MAX_TOKENS = 32000;
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const log = (s) => process.stdout.write(`${s}\n`);
const git = (cwd, args, opts = {}) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
// File bytes exactly as committed: a revision is the digest of the bytes, so nothing may be trimmed.
const blob = (path) => execFileSync('git', ['-C', REPO, 'show', `HEAD:${path}`], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });

// ── arguments ──
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
const scope = (opt('files') || '').split(',').map((f) => f.trim().replace(/^\.\//, '')).filter(Boolean);
const focus = opt('focus') || '';
const maxFindings = Math.min(5, parseInt(opt('max') || '3', 10));
const replay = (opt('replay') || '').split(',').map((d) => d.trim()).filter(Boolean);
// --excerpt "server/agent.js:3198-3240,5540-5640;server/x.js:1-80" - for a file too large to send whole. The AUTHORITY
// still covers the whole file at its pinned revision; only what the reviewer is shown is narrowed.
const excerpts = Object.fromEntries((opt('excerpt') || '').split(';').map((e) => e.trim()).filter(Boolean).map((e) => {
  const at = e.lastIndexOf(':');
  return [e.slice(0, at), e.slice(at + 1).split(',').map((r) => r.split('-').map(Number))];
}));
if (!scope.length) { log('usage: node server/inspector.mjs --files server/a.js,server/b.js [--focus "..."] [--max 3] [--replay data/inspector/<id>,...]'); process.exit(2); }

// ── 0 SCOPE: read the files at HEAD; pin a grant to each one's revision ──
const head = git(REPO, ['rev-parse', 'HEAD']);
const sources = {};
for (const f of scope) {
  try { sources[f] = blob(f); }
  catch { log(`not in HEAD: ${f} (only committed code is inspected)`); process.exit(2); }
}
const shownOf = (f, s) => excerpts[f] ? excerpts[f].reduce((n, [a, b]) => n + String(s).split('\n').slice(a - 1, b).join('\n').length, 0) : s.length;
const total = Object.entries(sources).reduce((n, [f, s]) => n + shownOf(f, s), 0);
if (total > 400_000) { log(`scope shows ${total} bytes; narrow it or use --excerpt (limit 400k)`); process.exit(2); }
const revisions = Object.fromEntries(Object.entries(sources).map(([f, b]) => [f, sha256(b)]));
for (const f of scope) sources[f] = sources[f].toString('utf8');

// ── evidence: what has been seen going wrong, from typed records only ──
function evidence() {
  const out = [];
  if (existsSync(enochPath())) {
    for (const l of readFileSync(enochPath(), 'utf8').split('\n')) {
      try {
        const r = JSON.parse(l);
        if (r.watcher === 'postmortem' && r.verdict && ['hub', 'both'].includes(r.verdict.at_fault)) {
          out.push({ source: 'postmortem', run: r.runId, goal: r.goal, category: r.verdict.failure_category, why: r.verdict.why, hub_fix: r.verdict.hub_fix, evidence: r.verdict.evidence });
        }
      } catch { /* torn line */ }
    }
  }
  const fz = join(REPO, 'fuzz-out', 'results.jsonl');
  if (existsSync(fz)) {
    for (const l of readFileSync(fz, 'utf8').split('\n').slice(-2000)) {
      try { const r = JSON.parse(l); const v = (r.violations || []).filter((x) => !x.startsWith('ESM')); if (v.length) out.push({ source: 'fuzz', seed: r.seed, violations: v.slice(0, 5) }); } catch { /* torn */ }
    }
  }
  return out.slice(-60);
}
const ev = evidence();

const numbered = (s) => s.split('\n').map((l, i) => `${String(i + 1).padStart(5)}| ${l}`).join('\n');
const shown = (f) => {
  if (!excerpts[f]) return numbered(sources[f]);
  const lines = numbered(sources[f]).split('\n');
  return `[EXCERPTS ONLY - ${lines.length} lines in the file; "old" must still occur exactly once in the WHOLE file]\n`
    + excerpts[f].map(([a, b]) => `----- lines ${a}-${b} -----\n${lines.slice(a - 1, b).join('\n')}`).join('\n');
};
let harness = '';
try { harness = blob('server/testHarness.mjs').toString('utf8'); } catch { /* optional context */ }

const BRIEF = `You are a Watcher inspecting the source of Legasus, an AI coding hub (Node, ESM). Find real defects in the files in SCOPE and prove each one.

Every finding you report will be executed, in this order, by a harness that believes nothing you say:
1. Your test runs against the CURRENT code. It must FAIL with an assertion error. If it passes, or crashes on an import or syntax error, the finding is discarded.
2. Your fix is applied, as exact text replacements, through the hub's governed write boundary. Only files in SCOPE are writable; anything else is refused.
3. Your test must then PASS, ten times in a row, and existing tests touching those files must not regress.

So:
- Report only defects you can trigger with a deterministic test. No style issues, no speculation. Fewer real findings beat more weak ones; an empty list is a valid answer.
- test_code is a complete ESM Node script saved as server/<generated-name>.test.mjs, run with "node" from the repo root, no network. Import the code under test by relative path from server/ (e.g. "./taskLedger.js"). Use node:assert/strict and exit non-zero on failure (an uncaught assertion does this). Keep it fast (under 60 seconds) and self-contained; write temp files under os.tmpdir() only.
- Importing ./agent.js reads its env at load time: set AGENT_WORKSPACE, AGENT_RUNS_DIR, AGENT_META_DIR, AGENT_TRACES_DIR, RUN_INDEX, AGENT_QUEUE_FILE and HUB_DB to paths in a fresh temp dir BEFORE a dynamic import, or prefer testing a smaller module. testHarness.mjs (shown below) is the supported way to run an isolated hub if one is truly needed.
- edits: each "old" must be copied exactly from the file as shown (without the line-number gutter) and occur exactly once in it; "new" replaces it. Keep fixes minimal and match the surrounding code's style and comment density.
- line is the 1-based line where the defect is.`;

const FINDING = {
  type: 'object', additionalProperties: false,
  required: ['slug', 'title', 'file', 'line', 'severity', 'mechanism', 'trigger', 'evidence', 'confidence', 'test_code', 'fix_summary', 'edits'],
  properties: {
    slug: { type: 'string' }, title: { type: 'string' }, file: { type: 'string' }, line: { type: 'integer' },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
    mechanism: { type: 'string' }, trigger: { type: 'string' }, evidence: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    test_code: { type: 'string' }, fix_summary: { type: 'string' },
    edits: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['file', 'old', 'new'], properties: { file: { type: 'string' }, old: { type: 'string' }, new: { type: 'string' } } } },
  },
};
const SCHEMA = { type: 'object', additionalProperties: false, required: ['findings', 'notes'], properties: { findings: { type: 'array', items: FINDING }, notes: { type: 'string' } } };

const content = [
  `SCOPE (the only writable files): ${scope.join(', ')}`,
  focus ? `FOCUS FROM THE OWNER: ${focus}` : '',
  `Report at most ${maxFindings} findings.`,
  `\nEVIDENCE (typed records of failures seen so far; may be empty or unrelated to SCOPE):\n${ev.length ? JSON.stringify(ev, null, 1) : '(none yet)'}`,
  ...scope.map((f) => `\n===== ${f} (revision ${revisions[f].slice(0, 12)}) =====\n${shown(f)}`),
  harness && !scope.includes('server/testHarness.mjs') ? `\n===== server/testHarness.mjs (context only, NOT writable) =====\n${harness}` : '',
].filter(Boolean).join('\n');

// ── 1 FREEZE ──
const sessionId = `${new Date().toISOString().slice(0, 10)}-${sha256(head + content).slice(0, 8)}`;
const base = { watcher: 'inspector', session: sessionId };
const db = JSON.parse(readFileSync(process.env.HUB_DB || join(REPO, 'server', 'hub.json'), 'utf8'));
const key = db.api_keys?.claude?.key_value;
const model = process.env.WATCHERS_MODEL || 'claude-sonnet-5-5';
record({ ...base, gate: 'freeze', head, scope, revisions, promptSha256: sha256(BRIEF + content), evidenceItems: ev.length, model });
// REPLAY: probe once, then replay without the model (PRECEDENT-3). A saved finding re-runs every gate from
// step 3 against the CURRENT HEAD and a freshly pinned scope; nothing it says is trusted more for having run before.
let answer, responded = model;
if (replay.length) {
  answer = { notes: 'replay', findings: replay.map((d) => JSON.parse(readFileSync(join(resolve(d), 'finding.json'), 'utf8'))) };
  record({ ...base, gate: 'replay', from: replay, findings: answer.findings.length });
  log(`replay: ${answer.findings.length} saved finding(s), no model call`);
} else {
  if (!key) { record({ ...base, gate: 'diagnose', skipped: 'no Claude key saved in the hub' }); log('no Claude key'); process.exit(1); }

  const cap = parseFloat(process.env.WATCHERS_BUDGET_USD || '10');
  const p = priceOf(model);
  const worst = (Math.ceil((BRIEF.length + content.length) / 3) * p.in * 1.25 + MAX_TOKENS * p.out) / 1e6;
  if (spent() + worst > cap) {
    record({ ...base, gate: 'diagnose', skipped: `budget: $${spent().toFixed(4)} of $${cap} spent, this inspection could cost up to $${worst.toFixed(4)}` });
    log('budget would be exceeded - not called'); process.exit(1);
  }

  // ── 2 DIAGNOSE ──
  log(`inspector ${sessionId}: ${scope.length} file(s), ${total} chars, ${ev.length} evidence items, worst case $${worst.toFixed(3)}`);
  const client = new Anthropic({ apiKey: key, ...(process.env.WATCHERS_BASE_URL ? { baseURL: process.env.WATCHERS_BASE_URL } : {}) });
  let msg;
  const t0 = Date.now();
  try {
    msg = await client.beta.messages.stream({
      model, max_tokens: MAX_TOKENS,
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      output_config: { effort: process.env.INSPECT_EFFORT || 'high', format: { type: 'json_schema', schema: SCHEMA } },
      system: [{ type: 'text', text: BRIEF }],
      messages: [{ role: 'user', content }],
    }).finalMessage();
  } catch (e) {
    const kind = e instanceof Anthropic.RateLimitError ? 'rate_limited' : e instanceof Anthropic.AuthenticationError ? 'bad_key'
      : e instanceof Anthropic.BadRequestError ? 'bad_request' : e instanceof Anthropic.APIError ? `api_${e.status}` : 'network';
    record({ ...base, gate: 'diagnose', model, error: `${kind}: ${String(e.message).slice(0, 300)}` });
    log(`diagnose failed: ${kind}`); process.exit(1);
  }
  responded = msg.model || model;
  const cost = +costUsd(responded, msg.usage).toFixed(6);
  const text = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  try { answer = JSON.parse(text); } catch { answer = null; }
  record({ ...base, gate: 'diagnose', model: responded, usage: msg.usage, costUsd: cost, ms: Date.now() - t0, stop: msg.stop_reason,
    findings: answer ? answer.findings.length : null, notes: answer?.notes, ...(answer ? {} : { error: `unparseable (${msg.stop_reason})`, raw: text.slice(0, 2000) }) });
  if (!answer) { log('unparseable answer'); process.exit(1); }
  log(`diagnose: ${answer.findings.length} finding(s), $${cost}. ${answer.notes ? 'notes: ' + answer.notes.slice(0, 200) : ''}`);
}

// ── the isolated worker: same image and boundary as the hub's command worker, no network ──
const roMounts = ['node_modules', 'server/node_modules', 'client/node_modules']
  .filter((d) => existsSync(join(REPO, d))).flatMap((d) => ['-v', `${join(REPO, d)}:/work/${d}:ro`]);
function inWorker(wt, file, timeoutSec = 300) {
  const r = spawnSync('docker', ['run', '--rm', '--network', 'none', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--user', '1000:1000', '--memory', '2g', '--pids-limit', '512', '-e', 'HOME=/tmp',
    '-v', `${wt}:/work`, ...roMounts, '-w', '/work', IMAGE, 'timeout', String(timeoutSec), 'node', file],
  { encoding: 'utf8', maxBuffer: 16 << 20, timeout: (timeoutSec + 60) * 1000 });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`.slice(-4000) };
}
// A failure that is about the test, not the code under test. Seen in the output, it disqualifies RED.
const BROKEN_TEST = /SyntaxError|ERR_MODULE_NOT_FOUND|Cannot find module|ReferenceError: \w+ is not defined|ERR_IMPORT/;
const ASSERTED = /AssertionError|ERR_ASSERTION|Assertion failed|expected/i;

// Which existing tests guard the code a fix touches. Naming the file is not enough for a large module: agent.js is
// named by most tests, and the first six alphabetically were mostly unrelated to the stop route they were meant to
// guard. So tests that name the file are ranked by how many identifiers from the edited text they use, top 12.
const relatedTests = (touched, edits = []) => {
  const names = touched.map((f) => basename(f).replace(/\.(m?js)$/, ''));
  const idents = [...new Set(edits.flatMap((e) => `${e.old}\n${e.new}`.match(/[A-Za-z_$][\w$]{4,}/g) || []))]
    .filter((w) => !/^(const|return|function|await|async|catch|export|import|throw|typeof|while|break|continue|undefined|false|true|null)$/.test(w));
  return readdirSync(join(REPO, 'server')).filter((f) => f.endsWith('.test.mjs') && !f.startsWith('inspector-'))
    .map((f) => { try { const s = blob(`server/${f}`).toString('utf8'); return names.some((n) => s.includes(`${n}.js`) || s.includes(`${n}.mjs`)) ? [f, idents.filter((w) => s.includes(w)).length] : null; } catch { return null; } })
    .filter(Boolean).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 12).map(([f]) => f);
};

// ── 3..7 per finding ──
mkdirSync(OUT, { recursive: true });
for (const f of answer.findings.slice(0, maxFindings)) {
  const slug = String(f.slug || f.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'finding';
  const id = `${sessionId}-${slug}`;
  const testRel = `server/inspector-${slug}.test.mjs`;
  const fb = { ...base, finding: id, title: f.title, file: f.file, line: f.line, severity: f.severity, confidence: f.confidence };
  const keep = join(OUT, id);
  mkdirSync(keep, { recursive: true });
  writeFileSync(join(keep, 'finding.json'), JSON.stringify(f, null, 2));
  const wt = mkdtempSync(join(tmpdir(), 'inspector-wt-'));
  const branch = `watchers/${id}`;
  let committed = false;
  const stop = (gate, why, extra = {}) => { record({ ...fb, gate, passed: false, why, ...extra }); log(`  ${id}: STOPPED at ${gate} - ${why}`); };
  try {
    git(REPO, ['worktree', 'add', '-q', '-b', branch, wt, head]);
    // The pinned revision is the digest of the bytes the reviewer read, so a worktree whose file differs refuses.
    const grants = [...scope, testRel].map((target) => delegate({
      from: 'OWNER', grant: ['edit:fixture'], to: 'controller',
      context: { repository: 'legasus-product', implementation: target, ...(revisions[target] ? { revision: revisions[target] } : {}) },
    }));
    const write = (target, contents) => {
      const authority = grants.find((a) => a.context.implementation === target) || grants[0];
      return governedEdit({ authority, action: editAction({ target, contents }), root: wt });
    };

    // 3 RED
    const t = write(testRel, f.test_code);
    if (!t.effected) { stop('red', `test file refused: ${t.outcome}`); continue; }
    const red = inWorker(wt, testRel, 120);
    writeFileSync(join(keep, 'red.txt'), red.out);
    if (red.code === 0) { stop('red', 'not reproduced: the test PASSES on the unchanged code', { out: red.out.slice(-600) }); continue; }
    if (BROKEN_TEST.test(red.out) || !ASSERTED.test(red.out)) { stop('red', 'the test fails for its own reasons, not on an assertion about the code', { exit: red.code, out: red.out.slice(-800) }); continue; }
    record({ ...fb, gate: 'red', passed: true, exit: red.code });

    // Regression baseline, before any fix.
    const touched = [...new Set(f.edits.map((e) => e.file))];
    const related = relatedTests(touched, f.edits);
    const before = Object.fromEntries(related.map((r) => [r, inWorker(wt, `server/${r}`).code === 0]));

    // 4 FIX - every edit through the boundary. Out-of-scope or stale targets are ITS refusal, recorded as such.
    const working = {};
    let refused = null;
    for (const e of f.edits) {
      const target = e.file.replace(/^\.\//, '');
      const cur = working[target] ?? (existsSync(join(wt, target)) ? readFileSync(join(wt, target), 'utf8') : '');
      const n = cur.split(e.old).length - 1;
      if (n !== 1) { refused = `edit to ${target}: "old" occurs ${n} times, must be exactly once`; break; }
      working[target] = cur.replace(e.old, () => e.new);
    }
    if (!refused) {
      for (const [target, contents] of Object.entries(working)) {
        const r = write(target, contents);
        if (!r.effected) { refused = `${target}: ${r.outcome} (${r.disposition}) - ${r.why}`; break; }
      }
    }
    if (refused) { stop('fix', refused); continue; }
    record({ ...fb, gate: 'fix', passed: true, files: Object.keys(working) });

    // 5 GREEN
    const green = inWorker(wt, testRel, 120);
    writeFileSync(join(keep, 'green.txt'), green.out);
    if (green.code !== 0) { stop('green', 'the test still fails after the fix', { exit: green.code, out: green.out.slice(-600) }); continue; }
    record({ ...fb, gate: 'green', passed: true });

    // 6 STRESS - perfect over ten, then no regression.
    let passes = 0;
    for (; passes < STRESS_RUNS; passes++) { if (inWorker(wt, testRel, 120).code !== 0) break; }
    if (passes < STRESS_RUNS) { stop('stress', `flaky: ${passes} consecutive passes, then a failure (bar: ${STRESS_RUNS}/${STRESS_RUNS})`); continue; }
    const after = Object.fromEntries(related.map((r) => [r, inWorker(wt, `server/${r}`).code === 0]));
    const regressed = related.filter((r) => before[r] && !after[r]);
    if (regressed.length) { stop('stress', `regression in ${regressed.join(', ')}`, { before, after }); continue; }
    record({ ...fb, gate: 'stress', passed: true, consecutive: passes, related: { before, after } });

    // 7 COMMIT - its own branch, off HEAD, never pushed.
    const msgFile = join(keep, 'commit-msg.txt');
    writeFileSync(msgFile, [
      `inspector: ${f.title}`, '',
      `${f.file}:${f.line} [${f.severity}, confidence ${f.confidence}]`, '',
      `Mechanism: ${f.mechanism}`, `Trigger: ${f.trigger}`, `Evidence: ${f.evidence}`, `Fix: ${f.fix_summary}`, '',
      `Gates: RED (fails on ${head.slice(0, 8)}, asserted) -> FIX via governedEdit, revision-pinned scope [${scope.join(', ')}]`,
      `-> GREEN -> STRESS ${passes}/${STRESS_RUNS} consecutive; related tests ${related.length ? related.map((r) => `${r} ${before[r] ? 'pass' : 'fail'}->${after[r] ? 'pass' : 'fail'}`).join(', ') : 'none found'}`,
      `Diagnosis: ${responded}, session ${sessionId}. Record: server/enoch/enoch.jsonl`, '',
      `Watcher: inspector (${responded})`,
    ].join('\n') + '\n');
    git(wt, ['add', '--', testRel, ...Object.keys(working)]);
    // Its own identity, not the owner's: a commit a Watcher made should say so in its author line.
    git(wt, ['-c', 'user.name=Legasus Inspector', '-c', 'user.email=inspector@legasus.local', 'commit', '-q', '-F', msgFile]);
    const sha = git(wt, ['rev-parse', 'HEAD']);
    committed = true;
    record({ ...fb, gate: 'commit', passed: true, branch, sha });
    log(`  ${id}: COMMITTED ${branch} @ ${sha.slice(0, 8)} (stress ${passes}/${STRESS_RUNS})`);
  } catch (e) {
    stop('harness', `inspector error: ${String(e.message).slice(0, 300)}`);
  } finally {
    try { git(REPO, ['worktree', 'remove', '--force', wt]); } catch { rmSync(wt, { recursive: true, force: true }); }
    if (!committed) { try { git(REPO, ['branch', '-D', branch]); } catch { /* never created */ } }
  }
}
