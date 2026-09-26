/**
 * narrowArtifact.mjs - THE NARROW ARTIFACT PROTOCOL: one increment, one request, one fenced
 * file, extracted by this harness rather than by the model invoking a tool.
 *
 *   node server/narrowArtifact.mjs --model-url http://127.0.0.1:11434 --model qwen2.5-coder:1.5b \
 *     --task farm-i1 [--seed 1] [--deadline-sec 600] [--max-tokens 6000] [--out result.json]
 *
 * WHY IT EXISTS. M1-LIVE-1 asked the local 1.5B for a whole game: it generated for 836 s and
 * never reached a usable completion. M1-LIVE-2 asked for one increment through the agent loop:
 * it echoed two lines of the guidance and never crossed into a file write. Both are consistent
 * with too much responsibility at one generation boundary, and neither proves the model cannot
 * implement increment 1. This harness removes every responsibility except producing the file:
 *
 *   the model must emit EXACTLY ONE fenced code block and nothing else
 *   the harness extracts it deterministically (first fence; a closing fence must be present)
 *   the harness writes it to the increment's entry file
 *   the UNCHANGED play, evaluator and acceptance policy then judge it
 *
 * WHAT IS HELD IDENTICAL to the earlier cells: the model, the task and its increments, the
 * play spec, the protected spec, the evaluator, the acceptance policy, the machine. The ONLY
 * change is the generation contract and who extracts the artifact.
 *
 * WHAT IS MEASURED - the boundary the failure sits at, not merely pass/fail:
 *
 *   B1 artifactProduced     a fenced block is present in the reply
 *   B2 artifactComplete     its closing fence arrived (so the reply was not cut off), and the
 *                           model stopped naturally (done_reason) rather than hitting the token
 *                           ceiling or this harness's deadline
 *   B3 contractClean        nothing but whitespace outside the fence (the protocol's own rule)
 *   B4 reachedExecution     the page loaded in the browser and the play produced verdicts
 *   B5 passedDiagnostic     every requested step passed
 *   B6 passedProtected      the protected spec passed (or none was specified)
 *   B7 accepted             the acceptance policy said RETAIN
 *
 * Plus, per boundary: elapsed ms and tokens. STRICT is the default (B3 gates use of the
 * artifact, as the protocol says); `acceptedIfLenient` records what would have happened had
 * prose outside the fence been tolerated, so one run answers both readings.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const flag = (n) => argv.includes('--' + n);

const MODEL_URL = opt('model-url', 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = opt('model', 'qwen2.5-coder:1.5b');
const TASK_ID = opt('task', 'farm-i1');
const SEED = opt('seed', null);
const DEADLINE_MS = Math.max(10_000, parseFloat(opt('deadline-sec', '600')) * 1000);
const MAX_TOKENS = parseInt(opt('max-tokens', '6000'), 10);
const TEMPERATURE = parseFloat(opt('temperature', '0.2'));
const OUT = opt('out', null);
const KEEP = flag('keep');
const WS_IN = opt('workspace', null);       // an existing workspace (a later increment's seed)

const { farmTasks } = await import('./benchTasks.js');
const { evaluate } = await import('./evaluator.js');
const { applyAcceptance, DISPOSITION } = await import('./acceptance.js');
const { playCheck } = await import('./playCheck.js');

const task = farmTasks().find((t) => t.id === TASK_ID);
if (!task) { console.error(`unknown task ${TASK_ID}; have ${farmTasks().map((t) => t.id).join(', ')}`); process.exit(2); }
const spec = task.diagnostic.spec;
const ENTRY = spec.entry || 'index.html';

// ── THE CONTRACT. The only thing the model is responsible for. ────────────────────────────
const SYSTEM = [
  'You output exactly one fenced code block and nothing else.',
  'No explanation, no plan, no commentary, no second block - the block alone.',
  'The block contains the COMPLETE file, from its first character to its last.',
].join('\n');

function userMessage(currentFile) {
  const lines = [
    task.goal.split('\n')[0],
    '',
    `The file is ${ENTRY}. Return the complete ${ENTRY} in one fenced block.`,
    '',
    'It must expose its state for testing exactly as described:',
    spec.contract,
  ];
  if (currentFile) {
    lines.push('', `This is the current ${ENTRY}. Return the complete new version, not a patch:`, '```html', currentFile, '```');
  }
  if (PROTOCOL === 'v2') {
    lines.push('',
      'The test harness reads your state through one seam. Include it verbatim, as the last',
      'statement of your script, with YOUR state object in place of STATE:',
      '',
      '    window.game = { state: () => JSON.parse(JSON.stringify(STATE)) };',
      '',
      'STATE must be the object holding player (with x and y), tiles, inventory (with seeds and',
      'crops) and day. Without that line nothing about the page can be observed.');
  }
  lines.push('', `Reply with one fenced block containing ${ENTRY}. Nothing before it, nothing after it.`);
  return lines.join('\n');
}

/** Stream the reply, measuring the boundaries as they happen. */
async function generate(messages) {
  const t0 = Date.now();
  const body = {
    model: MODEL, messages, stream: true,
    options: { temperature: TEMPERATURE, num_predict: MAX_TOKENS, ...(SEED !== null ? { seed: parseInt(SEED, 10) } : {}) },
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEADLINE_MS);
  let text = '', firstTokenMs = null, doneReason = null, outTok = null, promptTok = null, aborted = false;
  try {
    const res = await fetch(`${MODEL_URL}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, text, ms: Date.now() - t0 };
    const dec = new TextDecoder();
    let buf = '';
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let j; try { j = JSON.parse(line); } catch { continue; }
        const piece = j.message?.content ?? j.response ?? '';
        if (piece) { if (firstTokenMs === null) firstTokenMs = Date.now() - t0; text += piece; }
        if (j.done) { doneReason = j.done_reason || 'done'; outTok = j.eval_count ?? null; promptTok = j.prompt_eval_count ?? null; }
      }
    }
  } catch (e) {
    aborted = ctrl.signal.aborted;
    if (!aborted) return { ok: false, reason: String(e.message || e).slice(0, 200), text, ms: Date.now() - t0, firstTokenMs };
  } finally { clearTimeout(timer); }
  return { ok: true, text, ms: Date.now() - t0, firstTokenMs, doneReason: aborted ? 'harness_deadline' : doneReason, outTok, promptTok, aborted };
}

/**
 * DETERMINISTIC EXTRACTION. The first fence opens the artifact; the next fence at line start
 * closes it. No closing fence means the reply was cut off mid-artifact - reported, never
 * silently written. Returns the artifact, whatever sat outside it, and how many fences there were.
 */
export function extractArtifact(reply) {
  const text = String(reply ?? '');
  const open = text.match(/^[ \t]*```[^\n]*\n/m);
  if (!open) return { produced: false, complete: false, artifact: null, outside: text.trim(), fences: 0 };
  const start = open.index + open[0].length;
  const rest = text.slice(start);
  const close = rest.match(/^[ \t]*```[ \t]*$/m);
  const fences = (text.match(/^[ \t]*```/gm) || []).length;
  if (!close) return { produced: true, complete: false, artifact: rest, outside: text.slice(0, open.index).trim(), fences };
  const artifact = rest.slice(0, close.index);
  const outside = (text.slice(0, open.index) + text.slice(start + close.index + close[0].length)).trim();
  return { produced: true, complete: true, artifact, outside, fences };
}

const git = (ws, args) => exec('git', ['-C', ws, ...args], { windowsHide: true });

async function main() {
  const T0 = Date.now();
  const ws = mkdtempSync(join(tmpdir(), `narrow-${TASK_ID}-`));
  const rec = {
    at: new Date().toISOString(), task: TASK_ID, model: MODEL, modelUrl: MODEL_URL, seed: SEED === null ? null : parseInt(SEED, 10),
    protocol: `narrow-artifact-${PROTOCOL}`, strict: true, deadlineSec: DEADLINE_MS / 1000, maxTokens: MAX_TOKENS,
    requestedSteps: task.requested.play.steps, protectedSteps: task.protected?.play?.steps ?? null,
    boundaries: {}, timing: {}, tokens: {}, workspace: ws,
  };
  try {
    // The seed: an empty workspace for increment 1, or a given one for a later increment.
    mkdirSync(ws, { recursive: true });
    let currentFile = null;
    if (WS_IN && existsSync(join(WS_IN, ENTRY))) { currentFile = readFileSync(join(WS_IN, ENTRY), 'utf8'); writeFileSync(join(ws, ENTRY), currentFile, 'utf8'); }
    for (const [f, body] of Object.entries(task.seed || {})) writeFileSync(join(ws, f), body, 'utf8');
    await git(ws, ['init', '-q']); await git(ws, ['config', 'core.autocrlf', 'false']);
    await git(ws, ['add', '-A']).catch(() => {});
    await git(ws, ['-c', 'user.email=b@b', '-c', 'user.name=b', 'commit', '-q', '--allow-empty', '-m', 'seed']);
    const startRef = (await git(ws, ['rev-parse', 'HEAD'])).stdout.trim();

    // ── generate ──
    const gen = await generate([{ role: 'system', content: SYSTEM }, { role: 'user', content: userMessage(currentFile) }]);
    rec.timing.generateMs = gen.ms;
    rec.timing.firstTokenMs = gen.firstTokenMs ?? null;
    rec.tokens = { output: gen.outTok ?? null, prompt: gen.promptTok ?? null, replyChars: (gen.text || '').length };
    rec.terminationReason = gen.ok ? gen.doneReason : `transport: ${gen.reason}`;
    rec.naturalStop = gen.doneReason === 'stop';
    rec.reply = String(gen.text || '').slice(0, 20000);
    if (!gen.ok) { rec.boundaries = { artifactProduced: false, note: `generation failed: ${gen.reason}` }; return rec; }

    // ── B1..B3 extraction and the contract ──
    const ex = extractArtifact(gen.text);
    rec.boundaries.artifactProduced = ex.produced;
    rec.boundaries.artifactComplete = ex.complete && gen.doneReason === 'stop';
    rec.boundaries.contractClean = ex.produced && ex.outside.length === 0 && ex.fences === 2;
    rec.extraction = { fences: ex.fences, artifactChars: ex.artifact ? ex.artifact.length : 0, outsideChars: ex.outside.length, outsideSample: ex.outside.slice(0, 300) };
    if (!ex.produced || !ex.complete) return rec;                    // nothing usable to write

    // ── write it (the harness, not the model) ──
    writeFileSync(join(ws, ENTRY), ex.artifact.endsWith('\n') ? ex.artifact : ex.artifact + '\n', 'utf8');
    await git(ws, ['add', '-A']);
    await git(ws, ['-c', 'user.email=b@b', '-c', 'user.name=b', 'commit', '-q', '-m', 'candidate']);
    rec.timing.writtenMs = Date.now() - T0;

    // ── B4..B6: the UNCHANGED play, evaluator and acceptance ──
    const play = await playCheck(ws, spec, { timeoutMs: 90_000 });
    rec.boundaries.reachedExecution = play.status === 'OK';
    rec.play = { status: play.status, reason: play.reason ?? null, passing: [...(play.passing || [])], failing: [...(play.failing || [])], total: play.total ?? null, log: String(play.log || '').slice(0, 4000) };
    rec.timing.playMs = Date.now() - T0;

    const verdict = await evaluate(ws, task, { timeoutSec: 120 });
    rec.boundaries.passedDiagnostic = verdict.requested?.verdict === 'PASS';
    rec.boundaries.passedProtected = !task.protected || verdict.protected?.verdict === 'PASS';
    rec.verdict = { overall: verdict.verdict, requested: verdict.requested?.verdict ?? null, protected: verdict.protected?.verdict ?? null, requestedFailing: verdict.requested?.failing ?? null };

    const acc = await applyAcceptance(ws, task, verdict, { startRef, captureDir: join(ws, '.rejected'), taskId: task.id });
    rec.boundaries.accepted = acc.disposition === DISPOSITION.RETAIN;
    rec.acceptance = { disposition: acc.disposition, countsAsCompletion: acc.countsAsCompletion, promotable: acc.promotable };
    rec.timing.acceptanceMs = Date.now() - T0;
    // Strict is what the protocol says; lenient is recorded so one run answers both readings.
    rec.boundaries.acceptedIfLenient = rec.boundaries.accepted;
    rec.boundaries.acceptedStrict = rec.boundaries.accepted && rec.boundaries.contractClean;
    if (rec.boundaries.accepted) rec.acceptedFile = readFileSync(join(ws, ENTRY), 'utf8');
    return rec;
  } finally {
    if (!KEEP) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
}

const rec = await main();
if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(rec, null, 2), 'utf8'); }
const b = rec.boundaries || {};
const mark = (v) => (v === true ? 'YES' : v === false ? 'no ' : ' - ');
console.log(`${rec.task} ${rec.model} seed=${rec.seed ?? '-'}  termination=${rec.terminationReason} natural=${rec.naturalStop ? 'yes' : 'no'}`);
console.log(`  B1 artifact produced   ${mark(b.artifactProduced)}   B2 complete ${mark(b.artifactComplete)}   B3 contract clean ${mark(b.contractClean)}`);
console.log(`  B4 reached execution   ${mark(b.reachedExecution)}   B5 diagnostic ${mark(b.passedDiagnostic)}   B6 protected ${mark(b.passedProtected)}   B7 accepted ${mark(b.accepted)}`);
console.log(`  chars=${rec.tokens.replyChars} outTok=${rec.tokens.output ?? '-'} promptTok=${rec.tokens.prompt ?? '-'} firstToken=${rec.timing.firstTokenMs ?? '-'}ms gen=${rec.timing.generateMs}ms`);
if (rec.play) console.log(`  play: ${rec.play.status} passing [${rec.play.passing.join(',')}] failing [${rec.play.failing.join(',')}]`);
if (rec.acceptance) console.log(`  acceptance: ${rec.acceptance.disposition}`);
if (OUT) console.log(`  written: ${OUT}`);
