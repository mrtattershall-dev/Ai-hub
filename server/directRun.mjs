#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// directRun.mjs — AUDIT-2 stage 3, ARM B. The same model, asked directly, with no manager.
//
//   node server/directRun.mjs --dir <page dir> --out <run.json> [--model ...] [--model-url ...]
//
// THIS IS A CONTROL, AND IT IS MEANT TO BE A GOOD ONE. A comparison against a straw man measures
// nothing, so arm B gets everything arm A gets except the thing under test:
//
//   SAME   model, decoding, call budget, rounds and seeds
//   SAME   starting file and machine-emitted requirement, rendered in the same English
//   SAME   gate feedback after a failed attempt - the failing step numbers, those steps' names as
//          written in the emitted spec, and any captured error text
//   SAME   evaluator: retainPath.judgeAndDecide and shouldRetain, the identical acceptance path,
//          with the identical protected set and the identical restore behaviour
//
//   NOT    a planner-chosen edit site
//   NOT    extracted facts, renderer guidance, or any proposal
//   NOT    a scaffolded slot
//
// IT DOES GET THE SAME CLASS OF EXECUTION SAFETY, which is not the thing under test: an OUTPUT
// CONTRACT stating the shape its answer must take (arm A's slot-language contract, at whole-page
// scale), CONTAINMENT refusing a page whose inline script does not parse (arm A refuses a slot
// completion that does not parse), and the identical restoration path. Withholding those would
// make the control lose to missing safety rather than to the absence of a manager.
//
// WHAT ARM B IS ALLOWED TO DO THAT ARM A IS NOT: answer in whatever shape it likes. It returns a whole
// page. It is never refused for the SHAPE of its answer - only for what the answer does - because a
// control burdened with a protocol only the manager can satisfy would be losing to the protocol rather
// than to the absence of a manager.
//
// A RECORDED RISK, not a defect to be fixed mid-experiment: handed its own page and asked to extend it,
// a 1.5B returned the file unchanged 5 times out of 5. If arm B echoes, that IS arm B's result - but it
// is reported as the mechanism, because "the manager won" and "the control could not use its
// interface" are different findings.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
// The SAME parser arm A's containment uses. Arm B must not be allowed to splice a page whose
// script is broken while arm A is protected from exactly that - a control that loses to missing
// execution safety is not losing to the absence of a manager.
import { Script } from 'node:vm';
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
// Arm A's 400 is a budget for a SLOT. A whole page needs room for the whole page, and starving the
// control of tokens would make it lose to a limit rather than to the absence of a manager.
const MAX_TOKENS = parseInt(opt('max-tokens', '3000'), 10);
const MAX_CALLS = parseInt(opt('max-calls', '12'), 10);
const MAX_ROUNDS = parseInt(opt('max-rounds', '4'), 10);
const SEEDS_PER_ROUND = String(opt('seeds', '1,2,3')).split(',').map((x) => parseInt(x, 10));
const CORPUS = opt('corpus', OUT ? OUT.replace(/\.json$/, '') + '.attempts' : null);

if (!DIR) { console.error('usage: node server/directRun.mjs --dir <page dir> [--out run.json]'); process.exit(2); }

const T0 = Date.now();
const { evaluate } = await import('./evaluator.js');
const { applyAcceptance } = await import('./acceptance.js');
const { playCheck } = await import('./playCheck.js');
const { judgeCandidate } = await import('./judgeCandidate.mjs');
const { judgeAndDecide, shouldRetain } = await import('./retainPath.mjs');
const { classifyAttempt, preserveAttempt } = await import('./attemptRecord.mjs');

const task = JSON.parse(readFileSync(join(DIR, 'task.json'), 'utf8'));
const spec = task.diagnostic.spec;
const ENTRY = spec.entry || 'index.html';
const startFile = readFileSync(join(DIR, NAME), 'utf8');
const stepName = (n) => (spec.steps.find((s) => s.n === n) || {}).name || `step ${n}`;

const out = {
  status: 'INTERRUPTED',
  at: new Date().toISOString(), experiment: 'AUDIT-2', arm: 'B_DIRECT', task: task.id, model: MODEL,
  page: join(DIR, NAME), baselineSha: sha(startFile),
  budget: { maxCalls: MAX_CALLS, maxRounds: MAX_ROUNDS, seedsPerRound: SEEDS_PER_ROUND, maxTokens: MAX_TOKENS },
  interventionsByAPerson: 0,
  rounds: [], attempts: [], accepted: false, calls: 0,
};

/** The requirement in the SAME English arm A's instruction uses, from the same emitted task. */
function requirementInWords(r) {
  const t = r.trigger || {};
  const lead = t.kind === 'click' ? `when ${t.selector} is clicked`
    : t.kind === 'submit' ? `when ${t.selector} is submitted`
      : t.kind === 'type' ? `when text is typed into ${t.selector}`
        : `when the ${t.key} key is pressed`;
  let line = `${lead}: ${(r.effects || []).join('; ')}.`;
  const hard = (r.invariants || []).filter((i) => !/keeps working/i.test(i));
  if (hard.length) line += ` Ensure ${hard.join(', and ')}.`;
  return line;
}

/** Feedback from the GATE'S OWN OUTPUT, assembled exactly as arm A assembles it. */
function buildFeedback(rec) {
  const lines = [];
  for (const n of (rec.play?.failing || [])) lines.push(`- check ${n} FAILED: ${stepName(n)}`);
  for (const e of (rec.play?.errors || []).slice(0, 2)) lines.push(`- ${String(e).slice(0, 150)}`);
  return lines.join(NL);
}

function buildPrompt(feedback) {
  const parts = [
    'Here is a complete, working web page.',
    '',
    startFile,
    '',
    'Change it so that ' + requirementInWords(task.requirement),
    'Everything the page already does must keep working.',
  ];
  if (feedback) parts.push('', 'The last attempt was tested and failed:', feedback);
  // THE OUTPUT CONTRACT - arm B's analogue of arm A's slot-language contract. Arm A is told what
  // language its slot takes; arm B is told what shape its whole answer takes. Withholding this
  // would make the control lose to an unstated interface, which is the defect AUDIT-1 found in
  // arm A and fixed there.
  parts.push('',
    'Reply with the COMPLETE updated page: a single HTML document from <!DOCTYPE html> to </html>.',
    'No markdown fence, no explanation, no partial snippet, and no placeholder comments.',
    'Keep all existing markup and script, and create any new element with JavaScript DOM calls or markup as you prefer.');
  return parts.join(NL);
}

/**
 * Take the page out of the reply. A direct loop would do exactly this much and no more: strip a
 * markdown fence if there is one, and take from the first doctype or <html> to the last </html>.
 * Anything beyond that would be the harness writing the answer.
 */
function extractPage(text) {
  let t = String(text || '');
  const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1];
  const start = t.search(/<!DOCTYPE html|<html\b/i);
  const end = t.toLowerCase().lastIndexOf('</html>');
  if (start === -1 || end === -1 || end < start) return { ok: false, reason: 'NO_COMPLETE_PAGE', detail: 'the reply does not contain a complete page from a doctype or <html> to </html>' };
  const page = t.slice(start, end + '</html>'.length);
  if (page.trim() === startFile.trim()) return { ok: false, reason: 'ECHOED_THE_INPUT', detail: 'the reply is the page it was given, unchanged' };
  // CONTAINMENT, arm B's equivalent. Arm A refuses a slot completion that does not parse as
  // JavaScript; arm B refuses a page whose inline script does not parse. Same protection, same
  // place in the pipeline - before anything is written - and it COMPILES, never runs.
  const bodies = [...page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  for (const body of bodies) {
    if (!body.trim()) continue;
    try { new Script(body); } catch (e) {
      return { ok: false, reason: 'SCRIPT_DOES_NOT_PARSE', detail: `an inline script in the returned page does not parse: ${String(e.message).slice(0, 120)}` };
    }
  }
  return { ok: true, text: page, scriptsChecked: bodies.length };
}

async function generate(prompt, seed) {
  const t0 = Date.now();
  const res = await fetch(`${MODEL_URL}/api/generate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: TEMPERATURE, num_predict: MAX_TOKENS, seed } }),
  });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, ms: Date.now() - t0 };
  const j = await res.json();
  return { ok: true, text: String(j.response || ''), ms: Date.now() - t0, outTok: j.eval_count ?? null, promptTok: j.prompt_eval_count ?? null, doneReason: j.done_reason };
}

let feedback = '';
for (let round = 1; round <= MAX_ROUNDS && !out.accepted && out.calls < MAX_CALLS; round++) {
  const prompt = buildPrompt(feedback);
  const roundRec = { round, promptSha: sha(prompt), promptChars: prompt.length, feedbackDelivered: feedback || null, seeds: [] };
  console.log(`${NL}round ${round}: whole-page request, ${prompt.length} chars${feedback ? `, feedback ${feedback.split(NL).length} lines` : ', no feedback yet'}`);

  let worst = null;
  for (const seed of SEEDS_PER_ROUND) {
    if (out.calls >= MAX_CALLS) { console.log('  call budget exhausted'); break; }
    const gen = await generate(prompt, seed);
    out.calls++;
    if (!gen.ok) { roundRec.seeds.push({ seed, error: gen.reason }); continue; }
    const rec = {
      round, seed, generationMs: gen.ms, outputTokens: gen.outTok, promptTokens: gen.promptTok, doneReason: gen.doneReason,
      rawCompletion: { text: gen.text.slice(0, 6000), chars: gen.text.length, lines: gen.text.split(NL).length },
      boundaries: {}, timing: {},
    };
    const page = extractPage(gen.text);
    rec.extraction = page;
    if (!page.ok) {
      rec.outcome = `REFUSED_${page.reason}`;
      rec.classification = classifyAttempt(task, rec);
      if (CORPUS) rec.preserved = preserveAttempt(CORPUS, rec, { candidate: null, rawFull: gen.text, prompt, suffix: '', proposal: null, classification: rec.classification });
      console.log(`  seed ${seed}: ${rec.outcome} - ${page.detail}`);
      out.attempts.push(rec);
      if (OUT) { try { writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8'); } catch { /* the corpus still holds it */ } }
      roundRec.seeds.push({ seed, outcome: rec.outcome });
      continue;
    }
    rec.transformedCandidate = { text: page.text, chars: page.text.length, lines: page.text.split(NL).length };
    const candidate = page.text;
    const ws = mkdtempSync(join(tmpdir(), 'armb-'));
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
      // THE SAME RETAIN PATH ARM A USES. Not a copy of it, not a simplified version: the same two
      // functions, so the two arms differ in how a candidate is PRODUCED and in nothing about how it
      // is judged.
      const decision = await judgeAndDecide({
        ws, task, spec, startRef, rec, T0,
        deps: { judgeCandidate, playCheck, evaluate, applyAcceptance },
      });
      rec.candidateSha = sha(candidate);
      rec.classification = classifyAttempt(task, rec);
      if (CORPUS) rec.preserved = preserveAttempt(CORPUS, rec, { candidate, rawFull: gen.text, prompt, suffix: '', proposal: null, classification: rec.classification });
      console.log(`  seed ${seed}: play [${(rec.play?.passing || []).join(',')}] protected ${rec.acceptance?.survivingWorkspaceVerdict?.protected ?? '?'} ${rec.acceptance?.disposition ?? ''} ${rec.classification.mismatch}${decision.accepted ? '   <- ACCEPTED' : ''}`);
      out.attempts.push(rec);
      if (OUT) { try { writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8'); } catch { /* the corpus still holds it */ } }
      roundRec.seeds.push({ seed, outcome: rec.outcome, mismatch: rec.classification.mismatch, passing: rec.play?.passing, failing: rec.play?.failing });
      if (shouldRetain(decision)) { out.accepted = true; out.acceptedSeed = seed; out.acceptedRound = round; break; }
      if (!worst || (rec.play?.passing || []).length > (worst.play?.passing || []).length) worst = rec;
    } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
  }
  out.rounds.push(roundRec);
  if (out.accepted) break;
  feedback = worst ? buildFeedback(worst) : '';
}

out.status = 'COMPLETE';
out.reconciliation = {
  maxCallsAllowed: MAX_CALLS, callsMade: out.calls,
  attemptsRecorded: out.attempts.length,
  attemptsPreserved: out.attempts.filter((a) => typeof a.preserved === 'string').length,
  endedBecause: out.accepted ? 'accepted' : (out.calls >= MAX_CALLS ? 'call budget exhausted' : 'rounds exhausted'),
};
out.totals = {
  additionAttemptCalls: out.calls,
  accepted: out.attempts.filter((a) => a.outcome === 'ACCEPTED').length,
  refused: out.attempts.filter((a) => String(a.outcome).startsWith('REFUSED')).length,
  echoed: out.attempts.filter((a) => a.outcome === 'REFUSED_ECHOED_THE_INPUT').length,
  noCompletePage: out.attempts.filter((a) => a.outcome === 'REFUSED_NO_COMPLETE_PAGE').length,
  scriptDoesNotParse: out.attempts.filter((a) => a.outcome === 'REFUSED_SCRIPT_DOES_NOT_PARSE').length,
  judged: out.attempts.filter((a) => a.outcome === 'ACCEPTED' || a.outcome === 'REJECTED').length,
  mismatch: out.attempts.reduce((m, a) => { const k = (a.classification && a.classification.mismatch) || 'UNRECORDED'; m[k] = (m[k] || 0) + 1; return m; }, {}),
  restored: out.attempts.filter((a) => a.acceptance?.disposition === 'RESTORED').length,
  generationSeconds: +(out.attempts.reduce((s, a) => s + (a.generationMs || 0), 0) / 1000).toFixed(1),
  wallClockSeconds: +((Date.now() - T0) / 1000).toFixed(1),
  interventionsByAPerson: 0,
  corpus: CORPUS,
};
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
console.log(`${NL}${out.accepted ? 'ACCEPTED' : 'NO SUCCESS WITHIN THE DECLARED BUDGET'} - ${out.calls} of ${MAX_CALLS} calls, ${out.totals.judged} judged, ${out.totals.refused} refused (${out.totals.echoed} echoed, ${out.totals.noCompletePage} no complete page), 0 interventions`);
