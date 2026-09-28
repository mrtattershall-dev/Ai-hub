#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// assistedAttempt.mjs — ONE attempt of ASSISTED-1, with the assistance supplied explicitly.
//
//   node server/assistedAttempt.mjs --task traffic-red --baseline <page> --anchor-line N \
//     --scaffold-file <f> --instruction "..." [--context-file <f>] [--seed 1] --note "why"
//
// This is deliberately NOT autoGuide. ASSISTED-1 asks what assistance produces one verified success, so
// the assistance is mine and every piece of it is named on the command line and written to an
// append-only ledger. A reader can subtract my contribution and see what the model actually supplied.
//
// THE BOUNDARY, enforced as far as a program can enforce it: `--scaffold-file` and `--context-file` are
// recorded verbatim, and the ledger stores the full prompt, so a later reader can check whether I
// handed over the target implementation. The definition forbids that; this makes breaking it visible
// rather than impossible.
//
// Every attempt appends: the assistance, the raw completion, the transformed candidate, the gate's
// verdict, the protected verdict, the disposition, tokens and time. Nothing is overwritten.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, appendFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const git = (ws, args) => exec('git', ['-C', ws, ...args], { windowsHide: true });
const sha = (t) => createHash('sha256').update(t).digest('hex');
const NL = String.fromCharCode(10);

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };

const TASK_ID = opt('task', 'traffic-red');
const BASELINE = opt('baseline', null);
const ANCHOR = parseInt(opt('anchor-line', '-1'), 10);      // 0-based line AFTER which the slot goes
const SCAFFOLD_FILE = opt('scaffold-file', null);
const CONTEXT_FILE = opt('context-file', null);
const INSTRUCTION = opt('instruction', null);
const SEED = parseInt(opt('seed', '1'), 10);
const NOTE = opt('note', '');
const LEDGER = opt('ledger', 'legasus/screen/ASSISTED-1_LEDGER.jsonl');
const MODEL = opt('model', 'qwen2.5-coder:1.5b');
const MODEL_URL = opt('model-url', 'http://127.0.0.1:11434').replace(/\/$/, '');
const MAX_TOKENS = parseInt(opt('max-tokens', '400'), 10);
const TEMPERATURE = parseFloat(opt('temperature', '0.2'));

if (!BASELINE || ANCHOR < 0 || !SCAFFOLD_FILE || !INSTRUCTION) {
  console.error('required: --baseline --anchor-line --scaffold-file --instruction');
  process.exit(2);
}

const T0 = Date.now();
const { farmTasks, panelTasks, trafficTasks } = await import('./benchTasks.js');
const { evaluate } = await import('./evaluator.js');
const { applyAcceptance } = await import('./acceptance.js');
const { playCheck } = await import('./playCheck.js');
const { judgeCandidate } = await import('./judgeCandidate.mjs');
const { cutRegion, containToSlot } = await import('./localEdit.mjs');

const all = [...farmTasks(), ...(typeof panelTasks === 'function' ? panelTasks() : []), ...(typeof trafficTasks === 'function' ? trafficTasks() : [])];
const task = all.find((t) => t.id === TASK_ID);
if (!task) { console.error(`unknown task ${TASK_ID}; have ${all.map((t) => t.id).join(', ')}`); process.exit(2); }
const spec = task.diagnostic.spec;
const ENTRY = spec.entry || 'index.html';

const startFile = readFileSync(BASELINE, 'utf8');
const scaffold = readFileSync(SCAFFOLD_FILE, 'utf8').replace(/\n$/, '');
const context = CONTEXT_FILE ? readFileSync(CONTEXT_FILE, 'utf8').replace(/\n$/, '') : '';

// Insert the scaffold after the anchor, then cut its FILL IN line back out as the hole.
const lines = startFile.split(NL);
const scaffolded = [...lines.slice(0, ANCHOR + 1), ...scaffold.split(NL), ...lines.slice(ANCHOR + 1)].join(NL);
const FILL = scaffold.split(NL).find((l) => l.includes('// FILL IN'));
if (!FILL) { console.error('the scaffold must contain a // FILL IN line'); process.exit(2); }
const cut = cutRegion(scaffolded, FILL, FILL);
if (!cut.ok) { console.error(`the slot could not be cut: ${cut.reason}`); process.exit(3); }

const head = cut.prefix + (context ? context + NL : '') + INSTRUCTION + NL;

async function infill(prefix, suffix, seed) {
  const t0 = Date.now();
  const res = await fetch(`${MODEL_URL}/api/generate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: prefix, suffix, stream: false, options: { temperature: TEMPERATURE, num_predict: MAX_TOKENS, seed } }),
  });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, ms: Date.now() - t0 };
  const j = await res.json();
  return {
    ok: true, text: String(j.response || ''), ms: Date.now() - t0,
    outTok: j.eval_count ?? null, promptTok: j.prompt_eval_count ?? null, doneReason: j.done_reason,
  };
}

const gen = await infill(head, cut.suffix, SEED);
if (!gen.ok) { console.error(`generation failed: ${gen.reason}`); process.exit(4); }
const middle = gen.text;

const rec = {
  at: new Date().toISOString(), experiment: 'ASSISTED-1', task: TASK_ID, note: NOTE,
  baseline: BASELINE, baselineSha: sha(startFile), seed: SEED, model: MODEL,
  assistance: {
    anchorLine: ANCHOR,
    anchorText: (lines[ANCHOR] || '').trim(),
    scaffoldSuppliedByMe: scaffold,
    contextSuppliedByMe: context || null,
    instructionSuppliedByMe: INSTRUCTION,
  },
  request: { promptHead: head, promptHeadSha: sha(head), suffixSha: sha(cut.suffix), promptTokens: gen.promptTok },
  generationMs: gen.ms, outputTokens: gen.outTok, doneReason: gen.doneReason,
  rawCompletion: { text: middle.slice(0, 6000), chars: middle.length, lines: middle.split(NL).length },
  boundaries: {}, timing: {},
};

const contained = containToSlot(middle, { maxLines: 20 });
rec.containment = contained;

if (!contained.ok) {
  rec.outcome = `REFUSED_${contained.reason}`;
  rec.transformedCandidate = null;
  console.log(`REFUSED - ${contained.reason}: ${contained.detail || ''}`);
} else {
  rec.transformedCandidate = { text: contained.text, chars: contained.text.length, lines: contained.text.split(NL).length };
  rec.extraction = { truncatedAtLine: contained.truncatedAtLine, droppedLines: contained.droppedLines, how: contained.how };
  const candidate = cut.prefix + (context ? context + NL : '') + INSTRUCTION + NL + contained.text + cut.suffix;
  const ws = mkdtempSync(join(tmpdir(), 'assisted-'));
  try {
    writeFileSync(join(ws, ENTRY), startFile, 'utf8');
    await git(ws, ['init', '-q']); await git(ws, ['config', 'core.autocrlf', 'false']);
    await git(ws, ['add', '-A']);
    await git(ws, ['-c', 'user.email=a@a', '-c', 'user.name=a', 'commit', '-q', '-m', 'start']);
    const startRef = (await git(ws, ['rev-parse', 'HEAD'])).stdout.trim();
    writeFileSync(join(ws, ENTRY), candidate.endsWith(NL) ? candidate : candidate + NL, 'utf8');
    await git(ws, ['add', '-A']);
    await git(ws, ['-c', 'user.email=a@a', '-c', 'user.name=a', 'commit', '-q', '-m', 'candidate']).catch((e) => {
      if (!/nothing to commit/i.test(String(e.stdout || '') + String(e.stderr || ''))) throw e;
    });
    await judgeCandidate(ws, task, spec, startRef, rec, T0, { playCheck, evaluate, applyAcceptance, join, readFileSync });
    rec.candidateSha = sha(candidate);
    rec.outcome = rec.boundaries.accepted ? 'ACCEPTED' : 'REJECTED';
    console.log(`play passing [${(rec.play?.passing || []).join(',')}] failing [${(rec.play?.failing || []).join(',')}]`);
    // The protected verdict lives on the acceptance record, not on a `protectedVerdict` field; the
    // first version printed `?` for a set that had in fact PASSED.
    console.log(`protected ${rec.acceptance?.survivingWorkspaceVerdict?.protected ?? (rec.boundaries.passedProtected ? 'PASS' : '?')}  requested ${rec.acceptance?.survivingWorkspaceVerdict?.requested ?? '?'}  ${rec.diagnosis?.failureClass ?? ''}  ${rec.acceptance?.disposition ?? ''}`);
    for (const e of (rec.play?.errors || []).slice(0, 4)) console.log(`  [JS ERROR] ${String(e.text || e).slice(0, 140)}`);
    console.log(rec.boundaries.accepted ? 'ACCEPTED' : 'REJECTED');
  } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
}

rec.wallClockSeconds = +((Date.now() - T0) / 1000).toFixed(1);
appendFileSync(LEDGER, JSON.stringify(rec) + NL, 'utf8');
console.log(`\nwhat the model wrote (raw, ${middle.split(NL).length} lines):`);
console.log(middle.split(NL).slice(0, 12).map((l) => '  | ' + l).join(NL));
if (contained.ok) {
  console.log(`\nwhat was kept (${contained.text.split(NL).length} lines):`);
  console.log(contained.text.split(NL).map((l) => '  > ' + l).join(NL));
}
console.log(`\nappended to ${LEDGER}  (${rec.wallClockSeconds}s, ${rec.outputTokens} output tokens)`);
