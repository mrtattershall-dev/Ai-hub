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
import { execFileSync } from 'node:child_process';
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
// EVIDENCE MODE, explicit so the comparison is a comparison. 'basic' is exactly what REPAIR-1 and
// REPAIR-2 sent: the file, the error message, the contract. 'dom' adds the selector that came back
// null, the ids the document actually had at that moment, the ids it had once ready, the readyState,
// and the stack. All read off the page; none of it is anyone's opinion about the fix.
//
// WHAT THOSE FACTS SUPPORT. An absent id at readyState complete rules out "waiting for readiness
// will create it" IN THE STATE OBSERVED. It does not rule out a later dynamic insertion by another
// script, a timer or a callback. The evidence reports an observed state; it proves nothing about the
// page's future, and the message therefore states the observation rather than a conclusion.
const EVIDENCE = opt('evidence', 'basic');
if (!['basic', 'dom', 'diagnosis'].includes(EVIDENCE)) { console.error(`unknown --evidence ${EVIDENCE}`); process.exit(2); }
// A SECOND CHECK, APPLIED AFTERWARDS AND NEVER FED BACK. The loop is driven entirely by --task. If
// --post-check names another task, the file the loop ends with is judged against it once, at the
// end, and recorded separately. Nothing about it reaches the model, the evidence, the revert rule or
// the acceptance decision - otherwise a candidate that passes the old gate could be reported as a
// working repair while it still throws during movement, or the loop would quietly be chasing a
// stricter target than the one the comparison was frozen on.
const POST_CHECK = opt('post-check', null);
const BASELINE = opt('baseline', null) || join(dirname(CANDIDATE), 'NARROW-2_accepted_index.html');
// Build round 1's request exactly as the loop would, write it out, and call no model. This exists so
// that a past run's request can be reconstructed through the same code rather than described.
const DRY_RUN = opt('dry-run-request', null);
if (!CANDIDATE) { console.error('--candidate <record.json> is required: the UNTOUCHED candidate to repair'); process.exit(2); }

const { farmTasks } = await import('./benchTasks.js');
const { evaluate } = await import('./evaluator.js');
const { applyAcceptance } = await import('./acceptance.js');
const { playCheck } = await import('./playCheck.js');
const { judgeCandidate } = await import('./judgeCandidate.mjs');
const { parseEditBlocks, applyEditBlocks } = await import('./localEdit.mjs');
const { diagnose, collectEvidence } = await import('./diagnose.mjs');

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
function evidenceMessage(file, d, play, lastRefusal, diagnosisPlan) {
  const lines = [`This is ${ENTRY}. It does not work. Repair it.`, '', file, ''];
  // DIAGNOSIS MODE. If a structured plan is available it replaces the hand-rolled evidence entirely.
  // If it is NOT available - the engine declined - the run stops rather than quietly falling back to
  // the raw error, because a silent fallback would make the comparison meaningless.
  if (diagnosisPlan) {
    lines.push(renderDiagnosis(diagnosisPlan), '', 'Reply with edit blocks only.');
    if (lastRefusal) {
      lines.push('', 'Your previous edit block was rejected by the tool that applies it:', '', `    ${lastRefusal}`, '',
        'The FIND text must appear in the file above as one unbroken run of lines, in the same order.');
    }
    return lines.join('\n');
  }
  if (lastRefusal) {
    lines.push('Your previous edit block was rejected by the tool that applies it, with this result:',
      '', `    ${lastRefusal}`, '',
      'The FIND text must appear in the file above as one unbroken run of lines, copied in the same',
      'order they appear there.', '');
  }
  if (d.failureClass === 'RUNTIME_EXCEPTION_AT_LOAD') {
    lines.push('When the page loads, it raises this error and stops running:', '',
      ...d.loadErrors.map((e) => '    ' + e), '');
    if (EVIDENCE === 'dom' && d.dom) {
      if ((d.stacks || []).length) lines.push('Where it was raised:', '', ...d.stacks.slice(0, 1).map((t) => '    ' + String(t).split('\n').join('\n    ')), '');
      const look = (d.dom.nullLookups || []);
      if (look.length) lines.push(`These element lookups returned nothing: ${look.map((x) => JSON.stringify(x)).join(', ')}`, '');
      if (d.dom.idsAtFirstFailure) lines.push(`The ids the document contained at that moment: ${JSON.stringify(d.dom.idsAtFirstFailure)}`, '');
      if (d.dom.idsAfterReady) lines.push(`The ids the document contains once it has finished loading (readyState ${d.dom.readyState || 'unknown'}): ${JSON.stringify(d.dom.idsAfterReady)}`, '');
    }
    lines.push('Because the script stopped, this is also true:', '',
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

/**
 * Render a structured diagnosis for the model. The four sections stay apart, and the hypothesis is
 * handed over WITH its unresolved questions: a repair prompt that presents a hypothesis as a finding
 * would be worse than the raw error, because it would remove the model's chance to disagree with it.
 * Nothing here is my reading of the defect - every line is either a measured fact, a catalogue
 * sentence, or an obligation taken from the task's own checks.
 */
function renderDiagnosis(plan) {
  const L = [];
  L.push('These are the facts the run measured:', '');
  for (const f of plan.observedFacts) L.push('    ' + f);
  L.push('', 'One explanation survives the observations taken. IT IS A HYPOTHESIS, not an established cause:', '',
    `    ${plan.hypothesis.says}`, '');
  if (plan.hypothesis.eliminated && plan.hypothesis.eliminated.length) {
    L.push('Explanations the observations contradicted:', '');
    for (const e of plan.hypothesis.eliminated) L.push(`    ${e.id}`);
    L.push('');
  }
  if (plan.hypothesis.unresolved && plan.hypothesis.unresolved.length) {
    L.push('What that hypothesis does NOT settle - decide for yourself whether it holds:', '');
    for (const u of plan.hypothesis.unresolved) L.push('    ' + u);
    L.push('');
  }
  if (plan.proposedScope && plan.proposedScope.line) {
    L.push(`The failing operation was observed at line ${plan.proposedScope.line}. ${plan.proposedScope.status}`,
      `    ${plan.proposedScope.preference}`, '');
  }
  L.push('Whatever you change must satisfy all of these:', '');
  for (const o of plan.obligations) L.push('    ' + o);
  L.push('', 'Repair it. Keep everything that already works.');
  return L.join('\n');
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

/** A minimal line diff, enough to show exactly which lines an applied edit replaced. */
function lineDiff(before, after) {
  const a = String(before).split('\n'), b = String(after).split('\n');
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const removed = a.slice(head, a.length - tail), added = b.slice(head, b.length - tail);
  const out = [`@@ line ${head + 1}: -${removed.length} +${added.length} @@`];
  for (const l of removed) out.push('- ' + l);
  for (const l of added) out.push('+ ' + l);
  return out.join('\n');
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
    evidenceMode: EVIDENCE,
    loopTask: TASK_ID,
    postCheckTask: POST_CHECK,
    originalCandidate: { sha256: null, chars: null },     // filled once the candidate is read
    assistance: {
      evidenceIsMachineCaptured: true,
      indentationToleranceByHarness: MATCH === 'normalized',
      domFactsSupplied: EVIDENCE === 'dom' || EVIDENCE === 'diagnosis',
      structuredDiagnosisSupplied: EVIDENCE === 'diagnosis',
      hypothesisHandedOverWithItsUncertainty: EVIDENCE === 'diagnosis',
      acceptanceGateRemainsAuthoritative: true,
      humanAnalysisSupplied: false,          // no rewiring, no corrected decrement, no DOM hint
      editFormatGivenByHarness: true,
      fuzzyMatchingAllowed: false,
    },
  };
  try {
    // The starting point for the ACCEPTANCE policy stays what it has always been: the accepted
    // increment-1 page. A repair that abandons movement is still a regression.
    out.originalCandidate = { sha256: sha(startFile), chars: startFile.length, text: startFile.slice(0, 20000) };
    // The verified starting point for the ACCEPTANCE policy. Inferring it from the candidate's own
    // directory broke the moment a candidate lived anywhere else, so it is an explicit option with
    // that inference as the default.
    const baseline = readFileSync(BASELINE, 'utf8');
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

    // ── dry run: build round 1's request and stop ──
    if (DRY_RUN) {
      // Round 0's acceptance RESTORED the workspace to the baseline, so the candidate has to be put
      // back before any observation - exactly as a real round does. Without this the dry run read the
      // baseline and produced a diagnosis-mode request identical to the basic one, which would have
      // made this audit wrong in the same way the thing it audits was wrong.
      writeFileSync(join(ws, ENTRY), current, 'utf8');
      let plan = null;
      if (EVIDENCE === 'diagnosis') {
        const ev = await collectEvidence({ workspace: ws, task, deps: { playCheck, writeFileSync, readFileSync, mkdtempSync, rmSync, join, tmpdir, execFileSync } });
        const dg = diagnose(ev);
        plan = dg.plan;
      }
      const play = await playCheck(ws, spec, { timeoutMs: 90_000 });
      const msg = evidenceMessage(current, judged.diagnosis, play, null, plan);
      mkdirSync(dirname(DRY_RUN), { recursive: true });
      writeFileSync(DRY_RUN, JSON.stringify({
        candidate: CANDIDATE, evidenceMode: EVIDENCE, matchMode: MATCH,
        planPresent: !!plan, hypothesis: plan?.hypothesis?.id ?? null,
        system: SYSTEM, user: msg, sha256: sha(SYSTEM + '\u0000' + msg),
        userChars: msg.length,
      }, null, 2), 'utf8');
      console.log(`dry run: request written to ${DRY_RUN} (${msg.length} chars, plan ${plan ? plan.hypothesis.id : 'none'})`);
      return out;
    }

    let genMs = 0, tokens = 0, lastRefusal = null;
    // NO NEW INFORMATION. REPAIR-1 spent two thirds of its budget re-sending the same evidence over
    // the same file and getting the same refused patch. A repeated (file, evidence) pair cannot
    // produce anything new, and neither can a repeated reply, so either ends the loop.
    const seenAsk = new Set(), seenReply = new Set();
    for (let round = 1; round <= MAX_ROUNDS && !judged.boundaries.accepted; round++) {
      // Re-read the play with cases, for the behavioural evidence.
      const beforeRound = current;
      // The policy may have restored the workspace at the end of the last round; put the loop's
      // working copy back before reading the evidence from it.
      writeFileSync(join(ws, ENTRY), current, 'utf8');
      const play = await playCheck(ws, spec, { timeoutMs: 90_000 });
      // THE DIAGNOSIS, RECOMPUTED FROM THIS ROUND'S OBSERVATIONS.
      let plan = null, diagInfo = null;
      if (EVIDENCE === 'diagnosis') {
        const ev = await collectEvidence({ workspace: ws, task, deps: { playCheck, writeFileSync, readFileSync, mkdtempSync, rmSync, join, tmpdir, execFileSync } });
        const dg = diagnose(ev);
        diagInfo = { source: 'diagnose.mjs', primarySignature: dg.primarySignature ?? null, considered: dg.considered.map((c) => c.id), surviving: dg.surviving, declined: dg.declined ?? null, plan: dg.plan ?? null };
        if (!dg.plan) {
          // THE INTENDED DECLINE. No plan means the engine could not separate the explanations or
          // lacked an observation. The loop stops and says so; it does not fall back to the raw error,
          // because a silent fallback would turn a refusal into an unremarked change of condition.
          out.rounds.push({
            round, kind: 'repair attempt', engineDiagnosis: diagInfo,
            outcome: 'DIAGNOSIS_DECLINED',
            reason: `the diagnosis engine declined: ${dg.declined?.reason} - ${dg.declined?.needed}`,
          });
          console.log(`round ${round}  STOPPED: diagnosis declined (${dg.declined?.reason})`);
          out.declinedByDiagnosis = { round, ...dg.declined };
          break;
        }
        plan = dg.plan;
      }
      const msg = evidenceMessage(current, judged.diagnosis, play, lastRefusal, plan);
      const askKey = sha(current) + '|' + sha(msg);
      if (seenAsk.has(askKey)) {
        out.rounds.push({ round, kind: 'stopped', outcome: 'NO_NEW_INFORMATION', reason: 'this exact file and this exact evidence were already sent; a repeat cannot produce anything new' });
        console.log(`round ${round}  STOPPED: same file, same evidence as an earlier round - no new information`);
        break;
      }
      seenAsk.add(askKey);
      const gen = await chat([{ role: 'system', content: SYSTEM }, { role: 'user', content: msg }]);
      genMs += gen.ms || 0; tokens += gen.outTok || 0;
      const row = {
        round, kind: 'repair attempt', engineDiagnosis: diagInfo,
        generationMs: gen.ms, outputTokens: gen.outTok ?? null,
        promptTokens: gen.promptTok ?? null, termination: gen.ok ? gen.doneReason : `transport: ${gen.reason}`,
        // THE EVIDENCE, WITH THE FILE ELIDED. This was a 1200-character window that began at the
        // file, so everything added after the file - the whole diagnosis - fell outside it, and the
        // record appeared to show a prompt that carried no diagnosis at all. The file is replaced by
        // a marker instead, so what the harness ADDED is recorded verbatim.
        evidenceGiven: msg.split(current).join(`<<< the file, ${current.length} chars, elided >>>`).slice(0, 6000),
        promptChars: msg.length,
        // THE REQUEST ITSELF. DOM-EVIDENCE-1 could only argue from a prompt-token delta about what
        // reached the model, because nothing stored the request. The system and user messages are now
        // saved whole, with a sha256, so the question is answerable from the record.
        request: { system: SYSTEM, user: msg, sha256: sha(SYSTEM + '\u0000' + msg) },
        rawReply: String(gen.text || '').slice(0, 8000),
      };
      if (!gen.ok) { row.outcome = 'GENERATION_FAILED'; out.rounds.push(row); console.log(`round ${round}  generation failed: ${gen.reason}`); break; }

      const replyKey = sha(String(gen.text || ''));
      if (seenReply.has(replyKey)) {
        row.outcome = 'NO_NEW_INFORMATION';
        row.reason = 'the model returned a reply byte-identical to an earlier round';
        out.rounds.push(row);
        console.log(`round ${round}  STOPPED: reply identical to an earlier round - no new information`);
        break;
      }
      seenReply.add(replyKey);
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

      // RETAIN BOTH SIDES. The record keeps the text before the round and a line-level diff of what
      // the applied blocks actually did, so a reader never has to trust the harness's summary of an
      // edit.
      row.before = { sha256: sha(beforeRound), chars: beforeRound.length };
      row.appliedDiff = lineDiff(beforeRound, applied.text).slice(0, 8000);
      row.matchRule = MATCH === 'normalized'
        ? 'a FIND matches only if its non-blank lines, each trimmed, appear as one contiguous run in the file and appear exactly ONCE; the FILE\'s lines are then replaced and the replacement re-indented to the file. No similarity scoring, no nearest match, no guessing which region was intended.'
        : 'a FIND matches only as an exact substring beginning at the start of a line, and only if it appears exactly ONCE. No similarity scoring, no nearest match, no guessing which region was intended.';
      current = applied.text.endsWith('\n') ? applied.text : applied.text + '\n';
      writeFileSync(join(ws, ENTRY), current, 'utf8');
      await git(ws, ['add', '-A']);
      await git(ws, ['-c', 'user.email=r@r', '-c', 'user.name=r', 'commit', '-q', '-m', `repair-${round}`])
        .catch((e) => { if (!/nothing to commit/i.test(String(e.stdout || '') + String(e.stderr || ''))) throw e; });
      judged = await judge(ws, startRef);
      row.fileSha = sha(current);
      row.play = judged.play.passing; row.failing = judged.play.failing;
      // NOT `row.diagnosis`: that name already holds the diagnosis ENGINE's plan for this round, and
      // assigning the gate's failure classification over it destroyed the engine's record on every
      // round whose edit applied. Two different things, two names.
      row.gateClassification = judged.diagnosis;
      row.disposition = judged.acceptance.disposition;
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

    // ── the post-hoc second check, on the file the loop ended with ──
    if (POST_CHECK) {
      const other = farmTasks().find((t) => t.id === POST_CHECK);
      if (!other) { out.postCheck = { task: POST_CHECK, error: 'unknown task' }; }
      else {
        writeFileSync(join(ws, ENTRY), current, 'utf8');
        const play2 = await playCheck(ws, other.diagnostic.spec, { timeoutMs: 90_000 });
        const v2 = await evaluate(ws, other, { timeoutSec: 120 });
        out.postCheck = {
          task: POST_CHECK,
          appliedAfterTheLoop: true,
          fedBackToTheModel: false,
          influencedAcceptance: false,
          passing: [...(play2.passing || [])], failing: [...(play2.failing || [])],
          errorsRaised: (play2.errors || []).length,
          requested: v2.requested?.verdict ?? null, protected: v2.protected?.verdict ?? null,
          note: 'measured after the loop finished, on the file it ended with. It decided nothing.',
        };
        console.log(`  post-check ${POST_CHECK}: passing [${out.postCheck.passing.join(',')}] failing [${out.postCheck.failing.join(',')}]  errors ${out.postCheck.errorsRaised}  requested ${out.postCheck.requested}`);
      }
    }
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
