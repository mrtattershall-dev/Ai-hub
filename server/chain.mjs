#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// chain.mjs — AUDIT-2 stage 4. Drive one page through an ACCUMULATING chain, for either arm.
//
//   node server/chain.mjs --page <dir> --out <dir> --arm manager|direct [--model ...] [--model-url ...]
//
// THE MEASURE, per generation, is not "did the newest addition work":
//
//   P(the new requirement passes AND every prior requirement still passes)
//
// which is exactly what the emitted task's acceptance already answers, because generation N's
// PROTECTED set is every earlier generation's checks plus the original observed behaviour. An arm that
// adds the new thing while quietly disturbing generation 1 does not advance.
//
// THE CHAIN ADVANCES ONLY ON A RETAINED ARTIFACT. Generation N+1 starts from the page generation N
// actually produced and had accepted - not from a repaired version, not from the baseline. When a
// generation is not accepted the chain STOPS THERE and the remaining generations are recorded as
// NOT REACHED, which is a different fact from failing them.
//
// Both arms are driven by this same file, so the accumulation, the evaluator and the stopping rule are
// identical and only the repair method differs.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const PAGE = opt('page', null);
const OUTDIR = opt('out', null);
const ARM = opt('arm', 'manager');
const MODEL = opt('model', null);
const MODEL_URL = opt('model-url', null);
const GENERATIONS = parseInt(opt('generations', '3'), 10);
// The same wall-clock enforcement campaign.mjs uses, for the same reason: billing lags, time does not.
// The remaining budget becomes each child runner timeout, so the deadline lands MID-GENERATION rather
// than only at a generation boundary.
const MAX_GPU_SECONDS = parseInt(opt('max-gpu-seconds', '0'), 10);
const T_START = Date.now();
const elapsed = () => (Date.now() - T_START) / 1000;
if (!PAGE || !OUTDIR) { console.error('usage: node server/chain.mjs --page <dir> --out <dir> --arm manager|direct'); process.exit(2); }

const RUNNER = ARM === 'direct' ? 'server/directRun.mjs' : 'server/managerRun.mjs';
const sha = (t) => createHash('sha256').update(t).digest('hex').slice(0, 16);
const NL = String.fromCharCode(10);
const pageName = PAGE.split(/[\\/]/).filter(Boolean).pop();

mkdirSync(OUTDIR, { recursive: true });
// The chain works on its OWN copy, so a run never edits the page set and two arms never collide.
const work = join(OUTDIR, 'work');
mkdirSync(work, { recursive: true });
copyFileSync(join(PAGE, 'baseline-as-delivered.html'), join(work, 'baseline-as-delivered.html'));

const record = { at: new Date().toISOString(), page: pageName, arm: ARM, model: MODEL, generations: [] };

for (let g = 1; g <= GENERATIONS; g++) {
  console.log(`${NL}════ ${pageName} · ${ARM} · generation ${g} ════`);
  const startSha = sha(readFileSync(join(work, 'baseline-as-delivered.html'), 'utf8'));

  // ── emit generation g against the page AS IT NOW STANDS ──
  let emitLog = ''; let emitted = null;
  try {
    const r = await exec(process.execPath, ['server/chainEmit.mjs', '--dir', work, '--generation', String(g)],
      { cwd: process.cwd(), windowsHide: true, maxBuffer: 20e6 });
    emitLog = String(r.stdout || '');
  } catch (e) { emitLog = String(e.stdout || '') + String(e.stderr || ''); }
  if (existsSync(join(work, 'task.json'))) emitted = JSON.parse(readFileSync(join(work, 'task.json'), 'utf8'));
  if (!emitted || emitted.generation !== g) {
    console.log(`  NOT EMITTED at generation ${g}`);
    record.generations.push({ generation: g, status: 'NOT_EMITTED', startSha, emitLog: emitLog.slice(-600) });
    record.stoppedAt = g; record.stoppedBecause = 'the generation could not be emitted';
    break;
  }
  console.log(`  emitted: ${emitted.protectedCases} accumulated obligations, ${emitted.provenance.additionSteps.length} new checks`);

  // ── run the arm ──
  const outFile = join(OUTDIR, `g${g}.json`);
  const args = [RUNNER, '--dir', work, '--out', outFile];
  if (MODEL) args.push('--model', MODEL);
  if (MODEL_URL) args.push('--model-url', MODEL_URL);
  if (MAX_GPU_SECONDS && elapsed() >= MAX_GPU_SECONDS) {
    record.generations.push({ generation: g, status: 'NOT_RUN_WATCHDOG', startSha });
    record.stoppedAt = g; record.stoppedBecause = 'the wall-clock budget was spent';
    console.log(`  WATCHDOG: ${elapsed().toFixed(0)}s of ${MAX_GPU_SECONDS}s - not starting generation ${g}`);
    break;
  }
  const remainingMs = MAX_GPU_SECONDS ? Math.max(1000, (MAX_GPU_SECONDS - elapsed()) * 1000) : undefined;
  let exitCode = 0;
  try {
    const r = await exec(process.execPath, args, { cwd: process.cwd(), windowsHide: true, maxBuffer: 50e6, timeout: remainingMs, killSignal: 'SIGKILL' });
    process.stdout.write(String(r.stdout || '').split(NL).slice(-3).join(NL) + NL);
  } catch (e) { exitCode = e.code ?? 1; process.stdout.write(String(e.stdout || '').split(NL).slice(-3).join(NL) + NL); }

  const run = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : null;
  const corpusDir = outFile.replace(/\.json$/, '') + '.attempts';
  const corpus = existsSync(corpusDir) ? readdirSync(corpusDir).filter((f) => f.endsWith('.json')).length : 0;

  const gen = {
    generation: g, name: emitted.generationName, startSha, exitCode,
    status: run ? run.status : (corpus ? 'INTERRUPTED_NO_RECORD' : 'NO_RECORD'),
    accumulatedObligations: emitted.protectedCases,
    newChecks: emitted.provenance.additionSteps.length,
    accepted: run ? !!run.accepted : false,
    calls: run ? run.calls : null,
    attemptsRecorded: run ? run.attempts.length : null,
    attemptsInCorpus: corpus,
    mismatch: run ? run.totals.mismatch : null,
    regressionsProduced: run ? (run.totals.mismatch || {}).BROKE_WHAT_WORKED || 0 : null,
    restored: run ? run.attempts.filter((a) => (a.acceptance || {}).disposition === 'RESTORED').length : null,
    outputTokens: run ? run.attempts.reduce((s, a) => s + (a.outputTokens || 0), 0) : null,
    generationSeconds: run ? run.totals.generationSeconds : null,
    wallSeconds: run ? run.totals.wallClockSeconds : null,
  };

  if (!run || run.status !== 'COMPLETE') {
    gen.problem = 'the runner did not finish; this is an interrupted generation, not a failed one';
    record.generations.push(gen);
    record.stoppedAt = g; record.stoppedBecause = 'interrupted';
    break;
  }

  if (!run.accepted) {
    console.log(`  NOT ACCEPTED at generation ${g} - the chain stops here`);
    record.generations.push(gen);
    record.stoppedAt = g; record.stoppedBecause = `generation ${g} was not accepted`;
    break;
  }

  // ── advance the chain onto the artifact this generation actually produced ──
  const accepted = run.attempts.find((a) => a.outcome === 'ACCEPTED');
  const nextPage = ARM === 'direct'
    ? accepted.transformedCandidate.text
    : rebuildFromSlot(readFileSync(join(work, 'baseline-as-delivered.html'), 'utf8'), run, accepted);
  if (!nextPage) {
    gen.problem = 'accepted, but the produced artifact could not be recovered to continue the chain';
    record.generations.push(gen);
    record.stoppedAt = g; record.stoppedBecause = 'the accepted artifact could not be recovered';
    break;
  }
  writeFileSync(join(work, 'baseline-as-delivered.html'), nextPage.endsWith(NL) ? nextPage : nextPage + NL, 'utf8');
  writeFileSync(join(OUTDIR, `g${g}-produced.html`), nextPage, 'utf8');
  gen.producedSha = sha(nextPage);
  gen.producedChars = nextPage.length;
  console.log(`  ACCEPTED - the chain advances onto the produced page (${nextPage.length} chars)`);
  record.generations.push(gen);
}

/** Arm A returns a slot completion; the page it produced is the prefix + that text + the suffix. */
function rebuildFromSlot(current, run, accepted) {
  const round = run.rounds.find((r) => r.round === accepted.round);
  if (!round || !round.promptHead) return null;
  const head = round.promptHead;
  // The prompt head is the page text up to the slot, plus guidance lines that are NOT part of the page.
  // The produced page is the current file with the accepted text inserted after the planned site.
  const lines = current.split(NL);
  const at = round.insertAfterLine;
  if (typeof at !== 'number' || at < 0 || at >= lines.length) return null;
  return [...lines.slice(0, at + 1), accepted.transformedCandidate.text, ...lines.slice(at + 1)].join(NL);
}

record.wallClockSeconds = +elapsed().toFixed(1);
record.maxGpuSeconds = MAX_GPU_SECONDS || null;
record.reached = record.generations.filter((g) => g.accepted).length;
record.notReached = GENERATIONS - record.generations.length;
writeFileSync(join(OUTDIR, '_chain.json'), JSON.stringify(record, null, 2), 'utf8');
console.log(`${NL}${pageName} · ${ARM}: ${record.reached} of ${GENERATIONS} generations completed with every accumulated obligation intact` +
  (record.notReached ? `; ${record.notReached} NOT REACHED` : ''));
