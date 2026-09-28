#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// managerRun.mjs — TRANSFER-3's run: the FROZEN POLICY extends a page, with no human in the loop.
//
//   node server/managerRun.mjs --dir legasus/bench/set3/s3-04-colour --out <run.json>
//
// Everything the model is shown is produced by code:
//   site         autoGuide.chooseSite
//   scaffold     autoGuide.buildScaffold
//   instruction  autoGuide.buildInstruction, from the requirement's words
//   context      codeFacts compact rendering, ranked by call distance from the site
//   feedback     assembled from the GATE'S OWN OUTPUT - the failing step numbers, those steps' names as
//                written in the emitted spec, and any captured error text. No sentence of it is written
//                by a person at run time.
//   containment  localEdit.containToSlot
//   escalation   if every attempt at a site yields NO CODE, switch scaffold shape once, then stop
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
const { chooseSite, buildScaffold, buildInstruction } = await import('./autoGuide.mjs');
const { extractFacts, renderConstraints } = await import('./codeFacts.mjs');
const { cutRegion, containToSlot } = await import('./localEdit.mjs');
const { evaluate } = await import('./evaluator.js');
const { applyAcceptance } = await import('./acceptance.js');
const { playCheck } = await import('./playCheck.js');
const { judgeCandidate } = await import('./judgeCandidate.mjs');

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

let preferRule = null;
let shapeSwitched = false;
let feedback = '';

for (let round = 1; round <= MAX_ROUNDS && !out.accepted && out.calls < MAX_CALLS; round++) {
  const site = chooseSite(startFile, task.requirement, preferRule ? { preferRule } : {});
  if (site.declined) {
    out.rounds.push({ round, declined: site.declined, needed: site.needed });
    console.log(`round ${round}: the policy DECLINED - ${site.declined}: ${site.needed}`);
    break;
  }
  const scaffold = buildScaffold(startFile, task.requirement, site);
  const instruction = buildInstruction(task.requirement);
  const facts = extractFacts(startFile, site);
  const rendered = renderConstraints(facts, { budget: CONTEXT_BUDGET, style: CONTEXT_STYLE, includeStrategy: INCLUDE_STRATEGY });
  const indent = (scaffold.lines.find((l) => l.includes('// FILL IN')) || '            ').match(/^\s*/)[0];
  const context = rendered.text ? rendered.text.split(NL).map((l) => indent + l).join(NL) : '';

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
    contextDelivered: rendered.text, factsDelivered: rendered.factsDelivered, contextDropped: rendered.dropped,
    feedbackDelivered: feedback || null,
    promptHeadSha: sha(head), suffixSha: sha(cut.suffix),
    seeds: [],
  };
  console.log(`\nround ${round}: site ${site.rule} - ${site.why}`);
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
    const contained = containToSlot(middle, { maxLines: 20 });
    rec.containment = contained;
    if (!contained.ok) {
      rec.outcome = `REFUSED_${contained.reason}`;
      console.log(`  seed ${seed}: REFUSED - ${contained.reason}`);
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
      await judgeCandidate(ws, task, spec, startRef, rec, T0, { playCheck, evaluate, applyAcceptance, join, readFileSync });
      rec.candidateSha = sha(candidate);
      rec.outcome = rec.boundaries.accepted ? 'ACCEPTED' : 'REJECTED';
      console.log(`  seed ${seed}: play [${(rec.play?.passing || []).join(',')}] protected ${rec.acceptance?.survivingWorkspaceVerdict?.protected ?? '?'} ${rec.acceptance?.disposition ?? ''}${rec.boundaries.accepted ? '  <- ACCEPTED' : ''}`);
      console.log(`           wrote: ${contained.text.trim().split(NL).join(' | ').slice(0, 130)}`);
      out.attempts.push(rec); roundRec.seeds.push({ seed, outcome: rec.outcome, passing: rec.play?.passing, failing: rec.play?.failing });
      if (rec.boundaries.accepted) { out.accepted = true; out.acceptedSeed = seed; out.acceptedRound = round; out.acceptedCandidate = contained.text; break; }
      // The attempt that got furthest is the one the next round gets feedback from.
      if (!worst || (rec.play?.passing || []).length > (worst.play?.passing || []).length) worst = rec;
    } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
  }
  out.rounds.push(roundRec);
  if (out.accepted) break;

  if (!anyCode && !shapeSwitched) {
    preferRule = site.rule === 'R1' ? 'R2' : 'R1';
    shapeSwitched = true;
    out.escalation = { afterRound: round, reason: 'every attempt at this site yielded no code', switchingTo: preferRule };
    console.log(`  escalating: no code at this site, switching scaffold shape to ${preferRule}`);
    feedback = '';
    continue;
  }
  if (!anyCode && shapeSwitched) { out.stoppedBecause = 'no code at either scaffold shape'; console.log('  stopping: no code at either shape'); break; }
  feedback = worst ? buildFeedback(worst, indent) : '';
}

out.totals = {
  additionAttemptCalls: out.calls,
  accepted: out.attempts.filter((a) => a.outcome === 'ACCEPTED').length,
  refused: out.attempts.filter((a) => String(a.outcome).startsWith('REFUSED')).length,
  judged: out.attempts.filter((a) => a.outcome === 'ACCEPTED' || a.outcome === 'REJECTED').length,
  protectedFailures: out.attempts.filter((a) => a.acceptance && a.acceptance.survivingWorkspaceVerdict && a.acceptance.survivingWorkspaceVerdict.protected !== 'PASS').length,
  restored: out.attempts.filter((a) => a.acceptance?.disposition === 'RESTORED').length,
  generationSeconds: +(out.attempts.reduce((s, a) => s + (a.generationMs || 0), 0) / 1000).toFixed(1),
  wallClockSeconds: +((Date.now() - T0) / 1000).toFixed(1),
  interventionsByAPerson: 0,
  dollars: 0,
};
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
console.log(`\n${out.accepted ? 'ACCEPTED' : 'NO SUCCESS WITHIN THE DECLARED BUDGET'} - ${out.calls} of ${MAX_CALLS} calls, ${out.totals.judged} judged, ${out.totals.refused} refused, ${out.totals.protectedFailures} protected failures, 0 interventions`);
