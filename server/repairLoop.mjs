/**
 * repairLoop.mjs - can the system turn OBSERVED failures into working improvements, without a
 * human writing the fix?
 *
 *   node server/repairLoop.mjs --model-url <url> --model qwen2.5-coder:7b \
 *     --candidate legasus/screen/MODEL-CMP-1_armB_seed3.json \
 *     --task farm-plant --max-rounds 3 [--seed 1] [--out r.json]
 *
 * WHY. Arm B's 7B candidates all failed, and the analysis of why was MINE: I neutralised a null
 * dereference and rewired invented buttons by hand, and only then could I see the remaining
 * one-line defect. Those interventions explain the failures; they do not overturn them, and they
 * are not something the product can do for itself. This asks the question that matters instead:
 * given only what the GATE observed, does the model repair its own candidate?
 *
 * THE RULES, and they are the point of the experiment:
 *
 *   the candidate starts UNTOUCHED           the stored arm B output, byte for byte
 *   the model is given only MACHINE evidence the captured runtime error verbatim, the declared
 *                                            interface contract, and the failing step's own name
 *                                            and observed state as the play reported them
 *   NOTHING of my analysis is supplied       no rewiring, no corrected decrement, no hint that the
 *                                            buttons do not exist, no mention of keydown
 *   the model proposes the repair             FIND/REPLACE blocks, applied only on an exact unique
 *                                            match - no fuzzy matching, no partial splice
 *   the gate is UNCHANGED                     the same play, evaluator and acceptance policy, and
 *                                            the same protected spec against the same startRef
 *   every attempt is counted                  rounds, tokens, seconds and dollars, including the
 *                                            rounds that fail
 *
 * A round that produces no applicable edit is still a round and still counted.
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const exec = promisify(execFile);
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };

const MODEL_URL = opt('model-url', 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = opt('model', 'qwen2.5-coder:7b');
const TASK_ID = opt('task', 'farm-plant');
const CANDIDATE = opt('candidate', null);
const MAX_ROUNDS = parseInt(opt('max-rounds', '3'), 10);
const SEED = opt('seed', null);
const TEMPERATURE = parseFloat(opt('temperature', '0.2'));
const MAX_TOKENS = parseInt(opt('max-tokens', '1500'), 10);
const DEADLINE_MS = Math.max(10_000, parseFloat(opt('deadline-sec', '900')) * 1000);
const OUT = opt('out', null);
const MATCH = opt('match', 'exact');        // 'normalized' also accepts a FIND at the wrong indent
if (!['exact', 'normalized'].includes(MATCH)) { console.error(`unknown --match ${MATCH}`); process.exit(2); }
if (!CANDIDATE) { console.error('--candidate <record.json> is required: the UNTOUCHED candidate to repair'); process.exit(2); }

const { farmTasks } = await import('./benchTasks.js');
const { evaluate } = await import('./evaluator.js');
const { applyAcceptance } = await import('./acceptance.js');
const { playCheck } = await import('./playCheck.js');
const { judgeCandidate } = await import('./judgeCandidate.mjs');
const { parseEditBlocks, applyEditBlocks } = await import('./localEdit.mjs');

const task = farmTasks().find((t) => t.id === TASK_ID);
if (!task) { console.error(`unknown task ${TASK_ID}`); process.exit(2); }
const spec = task.diagnostic.spec;
const ENTRY = spec.entry || 'index.html';
const git = (ws, args) => exec('git', ['-C', ws, ...args], { windowsHide: true });
const sha = (t) => createHash('sha256').update(t).digest('hex');

const SYSTEM = [
  'You repair a file. You reply with one or more edit blocks and nothing else.',
  'Each edit block has exactly this shape:',
  '',
  '<<<<<<< FIND',
  'lines copied from the current file, character for character',
  '=======',
  'the lines that replace them',
  '>>>>>>> END',
  '',
  'The FIND lines must appear in the file exactly once, copied exactly.',
  'Change as little as possible. Do not return the whole file. Do not explain.',
].join('\n');

/**
 * The evidence message. EVERY sentence here is either the task's own contract or something the
 * gate measured in this run. Nothing describes the defect in my words.
 */
function evidenceMessage(file, d, play, lastRefusal) {
  const lines = [`This is ${ENTRY}. It does not work. Repair it.`, '', file, ''];
  if (lastRefusal) {
    lines.push('Your previous edit block was rejected by the tool that applies it, with this result:',
      '', `    ${lastRefusal}`, '',
      'The FIND text must appear in the file above as one unbroken run of lines, copied in the same',
      'order they appear there.', '');
  }
  if (d.failureClass === 'RUNTIME_EXCEPTION_AT_LOAD') {
    lines.push('When the page loads, it raises this error and stops running:', '',
      ...d.loadErrors.map((e) => '    ' + e), '',
      'Because the script stopped, this is also true:', '',
      `    the page must expose the interface it declares: ${spec.contract}`, '',
      'Repair the cause of that error. Keep everything that already works.');
  } else if (d.failureClass === 'SEAM_MISSING') {
    lines.push('The page loads without raising an error, but the interface it must expose is absent:',
      '', `    ${spec.contract}`, '', 'Repair that. Keep everything that already works.');
  } else {
    const failing = (play.cases || []).filter((c) => c.kind !== 'PASS');
    lines.push('The page loads and its state can be read. These checks were run and these failed:', '');
    for (const c of failing) lines.push(`    step ${c.n}: ${c.name}`, `        observed: ${String(c.text || '').slice(0, 400)}`);
    lines.push('', 'Repair the behaviour those checks describe. Keep everything that already passes.');
  }
  lines.push('', 'Reply with edit blocks only.');
  return lines.join('\n');
}

async function chat(messages) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEADLINE_MS);
  let text = '', doneReason = null, outTok = null, promptTok = null, aborted = false;
  try {
    const res = await fetch(`${MODEL_URL}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({
        model: MODEL, messages, stream: true,
        options: { temperature: TEMPERATURE, num_predict: MAX_TOKENS, ...(SEED !== null ? { seed: parseInt(SEED, 10) } : {}) },
      }),
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, ms: Date.now() - t0 };
    const dec = new TextDecoder();
    let buf = '';
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      const ls = buf.split('\n'); buf = ls.pop() || '';
      for (const l of ls) {
        if (!l.trim()) continue;
        let j; try { j = JSON.parse(l); } catch { continue; }
        const piece = j.message?.content ?? j.response ?? '';
        if (piece) text += piece;
        if (j.done) { doneReason = j.done_reason || 'done'; outTok = j.eval_count ?? null; promptTok = j.prompt_eval_count ?? null; }
      }
    }
  } catch (e) {
    aborted = ctrl.signal.aborted;
    if (!aborted) return { ok: false, reason: String(e.message || e).slice(0, 200), ms: Date.now() - t0 };
  } finally { clearTimeout(timer); }
  return { ok: true, text, ms: Date.now() - t0, doneReason: aborted ? 'harness_deadline' : doneReason, outTok, promptTok };
}

async function judge(ws, startRef) {
  const rec = { boundaries: {}, timing: {} };
  await judgeCandidate(ws, task, spec, startRef, rec, Date.now(), { playCheck, evaluate, applyAcceptance, join, readFileSync });
  return rec;
}

async function main() {
  const T0 = Date.now();
  const src = JSON.parse(readFileSync(CANDIDATE, 'utf8'));
  const startFile = src.candidate?.text;
  if (!startFile) { console.error(`${CANDIDATE} has no stored candidate text`); process.exit(2); }

  const ws = mkdtempSync(join(tmpdir(), 'repair-'));
  const out = {
    at: new Date().toISOString(), model: MODEL, modelUrl: MODEL_URL, task: TASK_ID,
    candidateSource: CANDIDATE, candidateSha: sha(startFile), seed: SEED === null ? null : parseInt(SEED, 10),
    maxRounds: MAX_ROUNDS, rounds: [], accepted: false, totals: {},
    matchMode: MATCH,
    assistance: {
      evidenceIsMachineCaptured: true,
      indentationToleranceByHarness: MATCH === 'normalized',
      humanAnalysisSupplied: false,          // no rewiring, no corrected decrement, no DOM hint
      editFormatGivenByHarness: true,
      fuzzyMatchingAllowed: false,
    },
  };
  try {
    // The starting point for the ACCEPTANCE policy stays what it has always been: the accepted
    // increment-1 page. A repair that abandons movement is still a regression.
    const baseline = readFileSync(join(dirname(CANDIDATE), 'NARROW-2_accepted_index.html'), 'utf8');
    writeFileSync(join(ws, ENTRY), baseline, 'utf8');
    await git(ws, ['init', '-q']); await git(ws, ['config', 'core.autocrlf', 'false']);
    await git(ws, ['add', '-A']);
    await git(ws, ['-c', 'user.email=r@r', '-c', 'user.name=r', 'commit', '-q', '-m', 'accepted-increment-1']);
    const startRef = (await git(ws, ['rev-parse', 'HEAD'])).stdout.trim();

    // Round 0: the untouched candidate, judged, to capture the evidence a repair must act on.
    let current = startFile;
    writeFileSync(join(ws, ENTRY), current, 'utf8');
    let judged = await judge(ws, startRef);
    out.rounds.push({
      round: 0, kind: 'the untouched candidate', fileSha: sha(current),
      play: judged.play.passing, failing: judged.play.failing, diagnosis: judged.diagnosis,
      disposition: judged.acceptance.disposition, accepted: judged.boundaries.accepted,
    });
    console.log(`round 0  the untouched candidate: play [${judged.play.passing.join(',')}]  ${judged.diagnosis.failureClass}  ${judged.acceptance.disposition}`);
    if (judged.diagnosis.loadErrors.length) console.log(`         captured error: ${judged.diagnosis.loadErrors[0]}`);

    let genMs = 0, tokens = 0, lastRefusal = null;
    for (let round = 1; round <= MAX_ROUNDS && !judged.boundaries.accepted; round++) {
      // Re-read the play with cases, for the behavioural evidence.
      const beforeRound = current;
      // The policy may have restored the workspace at the end of the last round; put the loop's
      // working copy back before reading the evidence from it.
      writeFileSync(join(ws, ENTRY), current, 'utf8');
      const play = await playCheck(ws, spec, { timeoutMs: 90_000 });
      const msg = evidenceMessage(current, judged.diagnosis, play, lastRefusal);
      const gen = await chat([{ role: 'system', content: SYSTEM }, { role: 'user', content: msg }]);
      genMs += gen.ms || 0; tokens += gen.outTok || 0;
      const row = {
        round, kind: 'repair attempt', generationMs: gen.ms, outputTokens: gen.outTok ?? null,
        promptTokens: gen.promptTok ?? null, termination: gen.ok ? gen.doneReason : `transport: ${gen.reason}`,
        evidenceGiven: msg.slice(msg.indexOf('It does not work.')).slice(0, 1200),
        rawReply: String(gen.text || '').slice(0, 8000),
      };
      if (!gen.ok) { row.outcome = 'GENERATION_FAILED'; out.rounds.push(row); console.log(`round ${round}  generation failed: ${gen.reason}`); break; }

      const parsed = parseEditBlocks(gen.text);
      row.blocks = parsed.blocks.length; row.incomplete = parsed.incomplete; row.outsideChars = parsed.outside.length;
      if (!parsed.blocks.length) { row.outcome = 'NO_EDIT_PRODUCED'; out.rounds.push(row); console.log(`round ${round}  no edit block produced`); continue; }
      const applied = applyEditBlocks(current, parsed.blocks, { match: MATCH });
      row.applyResults = applied.results;
      if (!applied.applicable) {
        row.outcome = 'EDIT_NOT_APPLICABLE';
        out.rounds.push(row);
        console.log(`round ${round}  edit not applicable: ${applied.results.map((r) => r.status).join('/')}`);
        // REPAIR-1: rounds 2 and 3 re-sent identical evidence and got identical replies, so the
        // budget was spent re-reading the same refusal. That the edit did not match is itself a
        // machine fact, so it is fed back - still nothing of my analysis.
        lastRefusal = applied.results.map((r) => r.status).join(', ');
        continue;
      }

      current = applied.text.endsWith('\n') ? applied.text : applied.text + '\n';
      writeFileSync(join(ws, ENTRY), current, 'utf8');
      await git(ws, ['add', '-A']);
      await git(ws, ['-c', 'user.email=r@r', '-c', 'user.name=r', 'commit', '-q', '-m', `repair-${round}`])
        .catch((e) => { if (!/nothing to commit/i.test(String(e.stdout || '') + String(e.stderr || ''))) throw e; });
      judged = await judge(ws, startRef);
      row.fileSha = sha(current);
      row.play = judged.play.passing; row.failing = judged.play.failing;
      row.diagnosis = judged.diagnosis; row.disposition = judged.acceptance.disposition;
      row.accepted = judged.boundaries.accepted;
      row.outcome = judged.boundaries.accepted ? 'ACCEPTED' : 'STILL_FAILING';
      row.matchedBy = applied.results.map((r) => r.matchedBy).filter(Boolean).join(',');
      lastRefusal = null;                     // the edit applied; the next round judges behaviour
      out.rounds.push(row);
      console.log(`round ${round}  ${row.blocks} block(s) applied -> play [${judged.play.passing.join(',')}]  ${judged.diagnosis.failureClass}  ${judged.acceptance.disposition}  ${judged.boundaries.passedProtected ? 'protected ok' : 'PROTECTED FAILED -> this round reverted'}`);

      // WHAT THE NEXT ROUND BUILDS ON. The acceptance policy restores the WORKSPACE to the
      // accepted increment-1 page whenever it rejects, which is right for the baseline and wrong
      // as a repair subject: continuing from it would throw the candidate away and make repair
      // impossible by construction. So the loop keeps its own working copy of the candidate
      // lineage, and applies one rule to it:
      //
      //   the round's text is kept only if the protected spec still passes,
      //   otherwise the round is REVERTED to the text from before it.
      //
      // Nothing is ever promoted without the policy's RETAIN, and the baseline on disk is never
      // overwritten, so this changes what the loop iterates on and not what may be accepted.
      row.protectedPassed = judged.boundaries.passedProtected;
      if (judged.boundaries.passedProtected) {
        row.workingCopy = 'kept';
      } else {
        row.workingCopy = 'reverted: the protected spec failed, so this round is not built on';
        current = beforeRound;
      }
    }
    out.accepted = !!judged.boundaries.accepted;
    out.finalPlay = judged.play.passing;
    out.finalDisposition = judged.acceptance.disposition;
    out.totals = {
      repairRounds: out.rounds.filter((r) => r.kind === 'repair attempt').length,
      generationSeconds: +(genMs / 1000).toFixed(1), outputTokens: tokens,
      wallClockSeconds: +((Date.now() - T0) / 1000).toFixed(1),
    };
    return out;
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
}

const DIRECT = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (DIRECT) {
  const out = await main();
  console.log(`\n  ACCEPTED: ${out.accepted ? 'YES' : 'no'}   final play [${(out.finalPlay || []).join(',')}]   ${out.finalDisposition}`);
  console.log(`  repair rounds ${out.totals.repairRounds}   generation ${out.totals.generationSeconds} s   ${out.totals.outputTokens} tokens   wall clock ${out.totals.wallClockSeconds} s`);
  if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8'); console.log(`  written: ${OUT}`); }
  process.exit(0);
}
