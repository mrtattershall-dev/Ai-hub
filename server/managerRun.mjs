#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// managerRun.mjs — TRANSFER-3's run: the FROZEN POLICY extends a page, with no human in the loop.
//
//   node server/managerRun.mjs --dir legasus/bench/set3/s3-04-colour --out <run.json>
//
// Everything the model is shown is produced by code:
//   site         editPlanner.plan - the MOVE and the site, chosen from the request and the structure
//   scaffold     editPlanner.planToScaffold, shaped to the chosen move
//   instruction  autoGuide.buildInstruction, from the requirement's words
//   context      editPlanner.planToGuidance (the proposal scope) + codeFacts, ranked by call distance
//   feedback     assembled from the GATE'S OWN OUTPUT - the failing step numbers, those steps' names as
//                written in the emitted spec, and any captured error text. No sentence of it is written
//                by a person at run time.
//   containment  localEdit.containToSlot
//   stopping     if every attempt at the planned site yields NO CODE, stop and report it
//
// If a person has to touch anything, that is an INTERVENTION and the result becomes "the policy plus N
// rescues". This program has no way to accept one, which is the point: it either does it or it does not.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
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
const DIR = opt('dir', null);
const NAME = opt('name', 'baseline-as-delivered.html');
const OUT = opt('out', null);
const MODEL = opt('model', 'qwen2.5-coder:1.5b');
const MODEL_URL = opt('model-url', 'http://127.0.0.1:11434').replace(/\/$/, '');
const TEMPERATURE = parseFloat(opt('temperature', '0.2'));
const MAX_TOKENS = parseInt(opt('max-tokens', '400'), 10);

// Declared in TRANSFER-3 before the run: the context rendering that ASSISTED-1 used.
const CONTEXT_BUDGET = parseInt(opt('context-budget', '240'), 10);
const CONTEXT_STYLE = 'compact';
const INCLUDE_STRATEGY = true;

// The frozen budget.
const MAX_CALLS = parseInt(opt('max-calls', '12'), 10);
const MAX_ROUNDS = parseInt(opt('max-rounds', '4'), 10);
const SEEDS_PER_ROUND = String(opt('seeds', '1,2,3')).split(',').map((x) => parseInt(x, 10));

if (!DIR) { console.error('usage: node server/managerRun.mjs --dir <page dir> [--out run.json]'); process.exit(2); }

const T0 = Date.now();
// WHERE REJECTED ATTEMPTS GO. Retention decides what replaces the program; this decides what survives
// to be studied. The two are separate, and only the first can authorize anything.
const CORPUS = opt('corpus', OUT ? OUT.replace(/\.json$/, '') + '.attempts' : null);
const { buildInstruction } = await import('./autoGuide.mjs');
const { extractFacts, renderConstraints } = await import('./codeFacts.mjs');
const { cutRegion, containToSlot } = await import('./localEdit.mjs');
const { evaluate } = await import('./evaluator.js');
const { applyAcceptance } = await import('./acceptance.js');
const { playCheck } = await import('./playCheck.js');
const { judgeCandidate } = await import('./judgeCandidate.mjs');
const { judgeAndDecide, shouldRetain } = await import('./retainPath.mjs');
const { plan: makePlan, planToScaffold, planToGuidance, MOVE } = await import('./editPlanner.mjs');
const { selectObservation } = await import('./observationSelect.mjs');
const { classifyAttempt, preserveAttempt } = await import('./attemptRecord.mjs');

const task = JSON.parse(readFileSync(join(DIR, 'task.json'), 'utf8'));
const spec = task.diagnostic.spec;
const ENTRY = spec.entry || 'index.html';
const startFile = readFileSync(join(DIR, NAME), 'utf8');
const stepName = (n) => (spec.steps.find((s) => s.n === n) || {}).name || `step ${n}`;

const out = {
  at: new Date().toISOString(), experiment: 'TRANSFER-3', task: task.id, model: MODEL,
  page: join(DIR, NAME), baselineSha: sha(startFile),
  budget: { maxCalls: MAX_CALLS, maxRounds: MAX_ROUNDS, seedsPerRound: SEEDS_PER_ROUND },
  contextConfig: { style: CONTEXT_STYLE, budget: CONTEXT_BUDGET, includeStrategy: INCLUDE_STRATEGY },
  interventionsByAPerson: 0,
  rounds: [], attempts: [], accepted: false, calls: 0,
};

/** FEEDBACK, assembled from the gate's output. Nothing here is authored at run time. */
function buildFeedback(rec, indent) {
  const lines = [];
  for (const n of (rec.play?.failing || [])) lines.push(`${indent}// CHECK ${n} FAILED: ${stepName(n)}`);
  for (const e of (rec.play?.errors || []).slice(0, 2)) lines.push(`${indent}// ${String(e).slice(0, 150)}`);
  if (rec.outcome && String(rec.outcome).startsWith('REFUSED')) {
    lines.push(`${indent}// THE LAST ANSWER WAS REFUSED: ${rec.containment?.reason} - ${String(rec.containment?.detail || '').slice(0, 100)}`);
  }
  return lines.join(NL);
}

async function infill(prefix, suffix, seed) {
  const t0 = Date.now();
  const res = await fetch(`${MODEL_URL}/api/generate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: prefix, suffix, stream: false, options: { temperature: TEMPERATURE, num_predict: MAX_TOKENS, seed } }),
  });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, ms: Date.now() - t0 };
  const j = await res.json();
  return { ok: true, text: String(j.response || ''), ms: Date.now() - t0, outTok: j.eval_count ?? null, promptTok: j.prompt_eval_count ?? null, doneReason: j.done_reason };
}

// ── OBSERVE, ONCE, before any round. The observation informs the plan; the plan decides the site.
const obsWs = mkdtempSync(join(tmpdir(), 'mgr-obs-'));
let observation;
try {
  writeFileSync(join(obsWs, ENTRY), startFile, 'utf8');
  observation = await selectObservation(obsWs, { entry: ENTRY });
} finally { if (existsSync(obsWs)) { try { rmSync(obsWs, { recursive: true, force: true }); } catch { /* best effort */ } } }
out.observation = observation && observation.ok ? {
  outcome: observation.outcome,
  selectedAdapters: observation.selected.map((x) => x.adapterId),
  executedActions: observation.interactionsUsed,
  coverageLimits: observation.coverageLimits,
  unresolved: observation.unresolved,
} : { error: observation && observation.reason };
console.log(`observation: ${out.observation.outcome || 'UNAVAILABLE'} - ${(out.observation.selectedAdapters || []).join(', ') || 'no adapter selected'}`);

let feedback = '';

for (let round = 1; round <= MAX_ROUNDS && !out.accepted && out.calls < MAX_CALLS; round++) {
  // ── THE PLANNER DECIDES THE SITE AND THE GUIDANCE. Not autoGuide.chooseSite, which knew only two
  // keyboard moves and had nowhere to put a change about a button.
  const factsForPlan = (() => { try { return extractFacts(startFile, { rule: 'R2', insertAfterLine: 0 }); } catch { return null; } })();
  const proposal = makePlan({ file: startFile, requirement: task.requirement, observation: observation || {}, facts: factsForPlan });
  if (proposal.declined) {
    out.rounds.push({ round, declined: proposal.move, needed: proposal.needed, proposal });
    console.log(`round ${round}: the PLANNER DECLINED - ${proposal.needed}`);
    break;
  }
  const site = { rule: proposal.move, why: proposal.site.why, insertAfterLine: proposal.site.insertAfterLine };
  const sc = planToScaffold(proposal, task.requirement);
  const scaffold = { lines: sc.lines, why: sc.why };
  const instruction = buildInstruction(task.requirement);
  const facts = extractFacts(startFile, site);
  const rendered = renderConstraints(facts, { budget: CONTEXT_BUDGET, style: CONTEXT_STYLE, includeStrategy: INCLUDE_STRATEGY });
  const indent = (scaffold.lines.find((l) => l.includes('// FILL IN')) || '            ').match(/^\s*/)[0];
  // The guidance shown to the model comes from the PROPOSAL, so what it sees is what the planner decided.
  const planGuidance = planToGuidance(proposal).map((l) => indent + l).join(NL);
  const context = [planGuidance, rendered.text ? rendered.text.split(NL).map((l) => indent + l).join(NL) : ''].filter(Boolean).join(NL);

  const lines = startFile.split(NL);
  const scaffolded = [...lines.slice(0, site.insertAfterLine + 1), ...scaffold.lines, ...lines.slice(site.insertAfterLine + 1)].join(NL);
  const FILL = scaffold.lines.find((l) => l.includes('// FILL IN'));
  const cut = cutRegion(scaffolded, FILL, FILL);
  if (!cut.ok) { out.rounds.push({ round, error: cut.reason }); break; }

  const block = [context, feedback].filter(Boolean).join(NL);
  const head = cut.prefix + (block ? block + NL : '') + instruction + NL;

  const roundRec = {
    round, rule: site.rule, why: site.why, insertAfterLine: site.insertAfterLine,
    scaffold: scaffold.lines.join(NL), instruction,
    contextDelivered: context, factsDelivered: rendered.factsDelivered, contextDropped: rendered.dropped,
    feedbackDelivered: feedback || null,
    proposal: { move: proposal.move, site: proposal.site, scope: proposal.scope, evidence: proposal.evidence, uncertainty: proposal.uncertainty },
    promptHead: head, promptHeadSha: sha(head), suffixSha: sha(cut.suffix),
    seeds: [],
  };
  console.log(`\nround ${round}: move ${site.rule} - ${site.why} (after line ${site.insertAfterLine})`);
  console.log(`  facts delivered ${rendered.factsDelivered}${feedback ? `, feedback ${feedback.split(NL).length} lines` : ', no feedback yet'}`);

  let anyCode = false;
  let worst = null;
  for (const seed of SEEDS_PER_ROUND) {
    if (out.calls >= MAX_CALLS) { console.log('  call budget exhausted'); break; }
    const gen = await infill(head, cut.suffix, seed);
    out.calls++;
    if (!gen.ok) { roundRec.seeds.push({ seed, error: gen.reason }); continue; }
    const middle = gen.text;
    const rec = {
      round, seed, generationMs: gen.ms, outputTokens: gen.outTok, promptTokens: gen.promptTok, doneReason: gen.doneReason,
      rawCompletion: { text: middle.slice(0, 6000), chars: middle.length, lines: middle.split(NL).length },
      boundaries: {}, timing: {},
    };
    // Whether a new listener is inside the slot depends on the MOVE. In a handler body it escapes; when
    // the plan is to create a control and wire it, or to attach a listener, registering one is the edit.
    const wiring = [MOVE.CREATE_CONTROL, MOVE.NEW_LISTENER, MOVE.ATTACH_TO_CONTROL].includes(proposal.move);
    const contained = containToSlot(middle, { maxLines: 20, allowListener: wiring });
    rec.containment = contained;
    if (!contained.ok) {
      rec.outcome = `REFUSED_${contained.reason}`;
      console.log(`  seed ${seed}: REFUSED - ${contained.reason}`);
      rec.classification = classifyAttempt(task, rec);
      if (CORPUS) rec.preserved = preserveAttempt(CORPUS, rec, { candidate: null, rawFull: middle, prompt: head, suffix: cut.suffix, proposal: roundRec.proposal, classification: rec.classification });
      out.attempts.push(rec); roundRec.seeds.push({ seed, outcome: rec.outcome });
      worst = worst || rec;
      continue;
    }
    anyCode = true;
    rec.transformedCandidate = { text: contained.text, chars: contained.text.length, lines: contained.text.split(NL).length };
    rec.extraction = { truncatedAtLine: contained.truncatedAtLine, droppedLines: contained.droppedLines, how: contained.how };
    const candidate = cut.prefix + (block ? block + NL : '') + instruction + NL + contained.text + cut.suffix;
    const ws = mkdtempSync(join(tmpdir(), 'mgr-'));
    try {
      writeFileSync(join(ws, ENTRY), startFile, 'utf8');
      await git(ws, ['init', '-q']); await git(ws, ['config', 'core.autocrlf', 'false']);
      await git(ws, ['add', '-A']);
      await git(ws, ['-c', 'user.email=m@m', '-c', 'user.name=m', 'commit', '-q', '-m', 'start']);
      const startRef = (await git(ws, ['rev-parse', 'HEAD'])).stdout.trim();
      writeFileSync(join(ws, ENTRY), candidate.endsWith(NL) ? candidate : candidate + NL, 'utf8');
      await git(ws, ['add', '-A']);
      await git(ws, ['-c', 'user.email=m@m', '-c', 'user.name=m', 'commit', '-q', '-m', 'candidate']).catch((e) => {
        if (!/nothing to commit/i.test(String(e.stdout || '') + String(e.stderr || ''))) throw e;
      });
      // THE RETAIN PATH, and the only one. `judgeAndDecide` runs the functional gate, gathers the visual
      // and render evidence the task calls for, and returns the GATE-2 decision; `shouldRetain` is the
      // only question asked before a candidate is kept. Reading `rec.boundaries.accepted` here - which is
      // what this runner used to do - would restore the defect where the decision rule existed but
      // governed nothing.
      const decision = await judgeAndDecide({
        ws, task, spec, startRef, rec, T0,
        deps: { judgeCandidate, playCheck, evaluate, applyAcceptance },
      });
      rec.candidateSha = sha(candidate);
      const vis = rec.visual ? `${rec.visual.verdict}${rec.visual.evaluated ? '' : ' (not evaluated)'}` : 'none';
      console.log(`  seed ${seed}: play [${(rec.play?.passing || []).join(',')}] protected ${rec.acceptance?.survivingWorkspaceVerdict?.protected ?? '?'} ${rec.acceptance?.disposition ?? ''}`);
      console.log(`           functional ${decision.summary.functional}  visual ${decision.summary.visual}  render ${decision.summary.render}`);
      if (!decision.accepted && decision.functionallyAccepted) console.log(`           BLOCKED: ${decision.reasons.join('; ')}`);
      for (const a of decision.advisories) console.log(`           advisory: ${a}`);
      console.log(`           wrote: ${contained.text.trim().split(NL).join(' | ').slice(0, 130)}${decision.accepted ? '   <- ACCEPTED' : ''}`);
      // PRESERVED WHATEVER THE VERDICT. A rejected candidate that created and wired a control, and then
      // failed to clear the field, is a question worth keeping; deleting it answers the question by
      // destroying it. Nothing preserved here feeds back into this run or any later one.
      rec.classification = classifyAttempt(task, rec);
      if (CORPUS) rec.preserved = preserveAttempt(CORPUS, rec, { candidate, rawFull: middle, prompt: head, suffix: cut.suffix, proposal: roundRec.proposal, classification: rec.classification });
      if (rec.classification.mismatch === 'PARTIAL_EFFECT') console.log(`           PARTIAL: ${rec.classification.why}`);
      out.attempts.push(rec);
      roundRec.seeds.push({ seed, outcome: rec.outcome, mismatch: rec.classification.mismatch, passing: rec.play?.passing, failing: rec.play?.failing, visual: rec.visual?.verdict ?? null, decision: decision.summary });
      if (shouldRetain(decision)) { out.accepted = true; out.acceptedSeed = seed; out.acceptedRound = round; out.acceptedCandidate = contained.text; break; }
      // The attempt that got furthest is the one the next round gets feedback from.
      if (!worst || (rec.play?.passing || []).length > (worst.play?.passing || []).length) worst = rec;
    } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
  }
  out.rounds.push(roundRec);
  if (out.accepted) break;

  // The old escalation switched between the two keyboard scaffold shapes. The planner chooses a move
  // from the request and the structure, so there is no second shape to fall back to: if a site yields no
  // code, that is reported rather than papered over by trying the other keyboard move.
  if (!anyCode) {
    out.stoppedBecause = `no code was produced at the planned site (${site.rule})`;
    console.log(`  stopping: no code produced at the planned site`);
    break;
  }
  feedback = worst ? buildFeedback(worst, indent) : '';
}

out.totals = {
  additionAttemptCalls: out.calls,
  accepted: out.attempts.filter((a) => a.outcome === 'ACCEPTED').length,
  // A candidate that passed the functional gate and was stopped by a required visual contract is its own
  // outcome. Folding it into "rejected" would hide the thing GATE-2 exists to do.
  blockedByVisualContract: out.attempts.filter((a) => a.outcome === 'BLOCKED_BY_VISUAL_CONTRACT').length,
  visualNotEvaluated: out.attempts.filter((a) => a.decision && a.decision.visualStatus === 'NOT_EVALUATED').length,
  refused: out.attempts.filter((a) => String(a.outcome).startsWith('REFUSED')).length,
  judged: out.attempts.filter((a) => a.outcome === 'ACCEPTED' || a.outcome === 'REJECTED').length,
  protectedFailures: out.attempts.filter((a) => a.acceptance && a.acceptance.survivingWorkspaceVerdict && a.acceptance.survivingWorkspaceVerdict.protected !== 'PASS').length,
  restored: out.attempts.filter((a) => a.acceptance?.disposition === 'RESTORED').length,
  // What the attempts showed, which is not the same question as what was authorized to survive.
  mismatch: out.attempts.reduce((m, a) => { const k = (a.classification && a.classification.mismatch) || 'UNRECORDED'; m[k] = (m[k] || 0) + 1; return m; }, {}),
  partialEffects: out.attempts.filter((a) => a.classification && a.classification.mismatch === 'PARTIAL_EFFECT').length,
  corpus: CORPUS,
  generationSeconds: +(out.attempts.reduce((s, a) => s + (a.generationMs || 0), 0) / 1000).toFixed(1),
  wallClockSeconds: +((Date.now() - T0) / 1000).toFixed(1),
  interventionsByAPerson: 0,
  dollars: 0,
};
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
console.log(`\n${out.accepted ? 'ACCEPTED' : 'NO SUCCESS WITHIN THE DECLARED BUDGET'} - ${out.calls} of ${MAX_CALLS} calls, ${out.totals.judged} judged, ${out.totals.refused} refused, ${out.totals.blockedByVisualContract} blocked by a visual contract, ${out.totals.visualNotEvaluated} with visual NOT EVALUATED, ${out.totals.protectedFailures} protected failures, 0 interventions`);
