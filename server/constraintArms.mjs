#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// constraintArms.mjs — the comparison: does spending a fixed prompt budget on EXTRACTED CONSTRAINTS
// beat spending it on ORDINARY NEARBY CODE?
//
// Held fixed across arms: the model, the seeds, the edit interface (the same FIM infill, the same
// scaffold, the same instruction, the same structural containment), the token budget, the temperature
// and every check. The guidance functions are IMPORTED from the frozen policy, not copied, so the
// only difference between arms is the content of one comment block above the slot.
//
//   --arm none        nothing is injected. This is TRANSFER-1's prompt, re-run here, so the two
//                     treatments have a control taken on the SAME harness rather than from history.
//   --arm nearby      the code immediately around the site, commented out. This is a COMPETING
//                     CONTEXT STRATEGY, not a placebo: pasting the surrounding code is what a person
//                     actually does, so whatever it induces - including copying a listener it
//                     contains - is a result about that strategy.
//   --arm constraints automatically extracted, task-relevant constraints, labelled FACT / STRATEGY /
//                     NOT ESTABLISHED, to the same token budget.
//
// The arms are matched in TOKENS, not characters. Commented prose and indented JavaScript do not
// tokenise at the same rate, so equal character counts hand one arm more of the model's real context
// than the other. The unit is the FULL PROMPT as measured by the server that will read it: the
// constraint block is grown until the whole prompt is TOKEN_BUDGET tokens above the no-context
// prompt, and then the nearby-code window is grown until its whole prompt is as close as it can get
// to the constraint arm's WITHOUT EXCEEDING IT. Every count is in the record.
//
// An arm that delivers no facts is an UNDELIVERED TREATMENT and is labelled as one. A constraint arm
// whose block came out empty is not weak evidence about constraint guidance; it is a cell where no
// constraint was presented, and counting it as guidance is how a table fills in with nothing.
//
// WHAT THIS CANNOT SHOW, whatever the numbers. In TRANSFER-1 the model was given the whole file, so
// it already had every declaration; any effect here is an effect of SURFACING a fact the model
// possessed, not of supplying a missing one. Both blocks also restate text already in the prefix, so
// the question the design can answer is which way of spending the same tokens produces more completed
// additions and fewer regressions - not whether either supplies information the model lacked.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const exec = promisify(execFile);
const sha = (t) => createHash('sha256').update(t).digest('hex');
const NL = String.fromCharCode(10);

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };

const MODEL_URL = opt('model-url', 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = opt('model', 'qwen2.5-coder:1.5b');
const TASK_ID = opt('task', 'panel-alloff');
const BASELINE = opt('baseline', null);
const ARMS = String(opt('arms', 'none,nearby,constraints')).split(',');
const SEEDS = String(opt('seeds', '1,2,3,4,5')).split(',').map((x) => parseInt(x, 10));
const TOKEN_BUDGET = parseInt(opt('token-budget', '160'), 10);
const STYLE = opt('style', 'compact');
const STRATEGY = opt('strategy', 'yes') !== 'no';
const MAX_TOKENS = parseInt(opt('max-tokens', '800'), 10);
const TEMPERATURE = parseFloat(opt('temperature', '0.2'));
const DEADLINE_MS = Math.max(10_000, parseFloat(opt('deadline-sec', '900')) * 1000);
const OUT = opt('out', null);

const git = (ws, args) => exec('git', ['-C', ws, ...args], { windowsHide: true });

/** Comment out a block of code so it can sit in the slot without changing what the page does. */
const commentOut = (text) => text.split(NL).map((l) => '// ' + l).join(NL);

async function main() {
  const T0 = Date.now();
  const { chooseSite, buildScaffold, buildInstruction } = await import('./autoGuide.mjs');
  const { extractFacts, renderConstraints, renderNearbyCode } = await import('./codeFacts.mjs');
  const { countTokens, countTokensStable, growToTokens } = await import('./tokenBudget.mjs');
  const { farmTasks, panelTasks } = await import('./benchTasks.js');
  const { evaluate } = await import('./evaluator.js');
  const { applyAcceptance } = await import('./acceptance.js');
  const { playCheck } = await import('./playCheck.js');
  const { judgeCandidate } = await import('./judgeCandidate.mjs');
  const { cutRegion, containToSlot } = await import('./localEdit.mjs');

  const all = [...farmTasks(), ...(typeof panelTasks === 'function' ? panelTasks() : [])];
  const task = all.find((t) => t.id === TASK_ID);
  if (!task) { console.error(`unknown task ${TASK_ID}; have ${all.map((t) => t.id).join(', ')}`); process.exit(2); }
  if (!task.requirement) { console.error(`${TASK_ID} has no structured requirement`); process.exit(2); }
  const spec = task.diagnostic.spec;
  const ENTRY = spec.entry || 'index.html';
  if (!BASELINE) { console.error('--baseline <path to the page> is required'); process.exit(2); }
  const startFile = readFileSync(BASELINE, 'utf8');

  // ── the site: chosen ONCE, by the frozen rules, and shared by every arm ──
  const site = chooseSite(startFile, task.requirement, {});
  if (site.declined) { console.error(`the policy declined the site: ${site.declined} - ${site.needed}`); process.exit(3); }
  const scaffold = buildScaffold(startFile, task.requirement, site);
  const instruction = buildInstruction(task.requirement);

  const lines0 = startFile.split(NL);
  const scaffolded0 = [...lines0.slice(0, site.insertAfterLine + 1), ...scaffold.lines, ...lines0.slice(site.insertAfterLine + 1)].join(NL);
  const FILL0 = scaffold.lines.find((l) => l.includes('// FILL IN'));
  const cut0 = cutRegion(scaffolded0, FILL0, FILL0);
  if (!cut0.ok) { console.error(`the slot could not be cut: ${cut0.reason}`); process.exit(3); }
  const fullPrompt = (b) => cut0.prefix + (b ? b + NL : '') + instruction + NL;

  // ── the arms, matched in TOKENS on the prompt the model will actually read ──
  const facts = extractFacts(startFile, site);
  // THE ORACLE MEASURES THE REQUEST THE RUN WILL MAKE. It is given the same prefix AND the same
  // suffix as generation, because the infill template and the prompt-only template disagree by a
  // measured 24 tokens for identical content. Its own time is accumulated separately below and never
  // added to generation timing; it also warms the cache, which is why the first generation of a run
  // is not a clean latency sample.
  const oracle = { modelUrl: MODEL_URL, model: MODEL, suffix: cut0.suffix };
  const baseline = await countTokens(fullPrompt(''), oracle);
  if (!baseline.ok) { console.error(`the token oracle is unavailable: ${baseline.reason}`); process.exit(4); }
  const target = baseline.tokens + TOKEN_BUDGET;

  const grownC = await growToTokens(
    (size) => fullPrompt(renderConstraints(facts, { budget: size, style: STYLE, includeStrategy: STRATEGY }).text),
    target, { from: 60, to: 4000, step: 30, ...oracle });
  if (!grownC.ok) { console.error(`the constraint arm could not be sized: ${grownC.reason}`); process.exit(4); }
  const constraints = renderConstraints(facts, { budget: grownC.size, style: STYLE, includeStrategy: STRATEGY });

  const grownN = await growToTokens(
    (size) => fullPrompt(commentOut(renderNearbyCode(startFile, site, { budget: size }).text)),
    grownC.tokens, { from: 40, to: 6000, step: 30, ...oracle });
  if (!grownN.ok) { console.error(`the nearby arm could not be sized: ${grownN.reason}`); process.exit(4); }
  const nearbyRaw = renderNearbyCode(startFile, site, { budget: grownN.size });
  const nearby = { text: commentOut(nearbyRaw.text), chars: commentOut(nearbyRaw.text).length, lines: nearbyRaw.lines, windowLines: nearbyRaw.windowLines };

  const block = { none: '', nearby: nearby.text, constraints: constraints.text };
  const promptTokens = { none: baseline.tokens, constraints: grownC.tokens, nearby: grownN.tokens };
  const blockTokens = {
    none: 0,
    constraints: grownC.tokens - baseline.tokens,
    nearby: grownN.tokens - baseline.tokens,
  };
  // Re-measured once at the end, so a number that will not reproduce cannot pass as a measurement.
  const recheck = await countTokensStable([fullPrompt(block.constraints), fullPrompt(block.nearby)], oracle);
  const unstable = recheck.filter((r) => !r.stable);
  const oracleCost = {
    totalMs: (baseline.oracleMs || 0) + (grownC.oracleMs || 0) + (grownN.oracleMs || 0) + recheck.reduce((n, r) => n + (r.oracleMs || 0), 0),
    calls: 1 + (grownC.calls || 0) + (grownN.calls || 0) + recheck.length * 2,
    note: 'measured separately from generation, and these calls warm the cache the first generation then reads',
    everyReadingUsedTheInfillTemplate: recheck.every((r) => r.withSuffix) && baseline.withSuffix === true,
  };

  const out = {
    at: new Date().toISOString(), experiment: 'constraint arms', task: TASK_ID, model: MODEL,
    seeds: SEEDS, tokenBudget: TOKEN_BUDGET, style: STYLE, includeStrategy: STRATEGY,
    baseline: BASELINE, startSha: sha(startFile),
    interventionsByAPerson: 0,
    heldFixed: ['model', 'seeds', 'edit interface (FIM)', 'scaffold', 'instruction', 'containment', 'max tokens', 'temperature', 'every check'],
    site: { rule: site.rule, why: site.why, insertAfterLine: site.insertAfterLine },
    scaffold: scaffold.lines.join(NL), instruction,
    armSizes: {
      matchedOn: 'tokens of the full prompt, measured by the serving model',
      promptTokens, blockTokens,
      tokenDifference: Math.abs(blockTokens.constraints - blockTokens.nearby),
      tokenReadingsStable: unstable.length === 0,
      unstableReadings: unstable,
      // Stable is not correct. This records that the readings ALSO came from the template the run uses.
      measuredOnTheInfillTemplate: oracleCost.everyReadingUsedTheInfillTemplate,
      oracleCost,
      constraints: {
        chars: constraints.text.length, lines: constraints.lines, complete: constraints.complete,
        dropped: constraints.dropped, delivered: constraints.delivered, factsDelivered: constraints.factsDelivered,
        sizeSearch: grownC.tried,
      },
      nearby: { chars: nearby.chars, lines: nearby.lines, windowLines: nearby.windowLines, sizeSearch: grownN.tried },
    },
    // A treatment that presented nothing is not evidence about the treatment.
    undeliveredTreatments: [
      ...(constraints.factsDelivered === 0 ? ['constraints: 0 facts delivered'] : []),
      ...(nearby.chars === 0 ? ['nearby: an empty window'] : []),
    ],
    // THE RENDERED REQUESTS THEMSELVES. Equal token counts do not make two prompt arrangements
    // equivalent, so the record keeps the exact text of each arm's block and of the full prompt head
    // that was sent, for every arm. A reader can reconstruct what the model saw.
    armText: { nearby: nearby.text, constraints: constraints.text },
    renderedRequests: Object.fromEntries(['none', 'nearby', 'constraints'].map((a) => [a, {
      block: block[a],
      promptHead: fullPrompt(block[a]),
      promptHeadSha: sha(fullPrompt(block[a])),
      suffix: cut0.suffix,
      suffixSha: sha(cut0.suffix),
    }])),
    facts: { constraints: facts.constraints, redraws: facts.redraws, uncertainty: facts.uncertainty, structure: facts.structure },
    arms: {},
  };
  console.log(`site ${site.rule}: ${site.why}`);
  console.log(`token budget ${TOKEN_BUDGET} over a ${baseline.tokens}-token no-context prompt`);
  console.log(`  constraints  ${blockTokens.constraints} block tokens, ${constraints.factsDelivered} facts delivered, ${constraints.text.length} chars`);
  console.log(`  nearby       ${blockTokens.nearby} block tokens, ${nearby.lines} lines, ${nearby.chars} chars`);
  console.log(`  token difference ${out.armSizes.tokenDifference}${unstable.length ? '  (WARNING: a reading did not reproduce)' : ''}`);
  console.log(`  oracle: ${oracleCost.calls} counting calls, ${oracleCost.totalMs}ms, infill template ${oracleCost.everyReadingUsedTheInfillTemplate ? 'confirmed' : 'NOT CONFIRMED'} - not counted as generation time`);
  if (out.undeliveredTreatments.length) console.log(`  UNDELIVERED: ${out.undeliveredTreatments.join('; ')}`);

  const cut = cut0;

  for (const arm of ARMS) {
    if (!(arm in block)) { console.error(`unknown arm ${arm}`); process.exit(2); }
    const injected = block[arm] ? block[arm] + NL : '';
    const promptHead = cut.prefix + injected + instruction + NL;
    const rows = [];
    console.log(`\n── arm ${arm} (${injected.length} injected chars) ──`);
    for (const seed of SEEDS) {
      const ws = mkdtempSync(join(tmpdir(), `arms-${arm}-`));
      try {
        writeFileSync(join(ws, ENTRY), startFile, 'utf8');
        await git(ws, ['init', '-q']); await git(ws, ['config', 'core.autocrlf', 'false']);
        await git(ws, ['add', '-A']);
        await git(ws, ['-c', 'user.email=g@g', '-c', 'user.name=g', 'commit', '-q', '-m', 'start']);
        const startRef = (await git(ws, ['rev-parse', 'HEAD'])).stdout.trim();

        const gen = await infill(promptHead, cut.suffix, seed);
        const middle = String(gen.text || '');
        const rec = {
          arm, seed, generationMs: gen.ms, outputTokens: gen.outTok ?? null, doneReason: gen.doneReason,
          promptSha: sha(promptHead + '\u0001' + cut.suffix), injectedChars: injected.length,
          rawCompletion: { text: middle.slice(0, 6000), chars: middle.length, lines: middle.split(NL).length },
          boundaries: {}, timing: {},
        };
        const contained = containToSlot(middle, { maxLines: 20 });
        rec.containment = contained;
        if (!contained.ok) {
          rec.outcome = `REFUSED_${contained.reason}`;
          rows.push(rec);
          console.log(`  seed ${seed}: REFUSED - ${contained.reason}`);
          continue;
        }
        rec.extractedCandidate = { text: contained.text.slice(0, 4000), chars: contained.text.length, lines: contained.text.split(NL).length };
        rec.extraction = { truncatedAtLine: contained.truncatedAtLine, droppedLines: contained.droppedLines, how: contained.how };
        const candidate = cut.prefix + injected + instruction + NL + contained.text + cut.suffix;
        writeFileSync(join(ws, ENTRY), candidate.endsWith(NL) ? candidate : candidate + NL, 'utf8');
        await git(ws, ['add', '-A']);
        await git(ws, ['-c', 'user.email=g@g', '-c', 'user.name=g', 'commit', '-q', '-m', 'candidate']).catch((e) => {
          if (!/nothing to commit/i.test(String(e.stdout || '') + String(e.stderr || ''))) throw e;
        });
        await judgeCandidate(ws, task, spec, startRef, rec, T0, { playCheck, evaluate, applyAcceptance, join, readFileSync });
        rec.candidateSha = sha(candidate);
        rec.outcome = rec.boundaries.accepted ? 'ACCEPTED' : 'REJECTED';
        rows.push(rec);
        console.log(`  seed ${seed}: play [${rec.play.passing.join(',')}] ${rec.diagnosis?.failureClass ?? ''} ${rec.acceptance.disposition}${rec.boundaries.accepted ? '  <- ACCEPTED' : ''}`);
      } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
    }

    // ── what is counted, and counted over ALL starting candidates including refusals ──
    const errs = (r) => (r.play?.errors || []).map((e) => String(e.text || e));
    out.arms[arm] = {
      injectedChars: injected.length,
      blockTokens: blockTokens[arm],
      promptTokens: promptTokens[arm],
      factsDelivered: arm === 'constraints' ? constraints.factsDelivered : null,
      undelivered: arm === 'constraints' ? constraints.factsDelivered === 0 : (arm === 'nearby' ? nearby.chars === 0 : false),
      startingCandidates: SEEDS.length,
      refused: rows.filter((r) => String(r.outcome).startsWith('REFUSED')).length,
      reachedTheGate: rows.filter((r) => !String(r.outcome).startsWith('REFUSED')).length,
      accepted: rows.filter((r) => r.outcome === 'ACCEPTED').length,
      // A regression is a candidate the PROTECTED set failed on - distinct from one that throws only
      // on its own new action. TRANSFER-1 conflated those under "zero regressions"; they are separate
      // columns here for that reason.
      protectedFailed: rows.filter((r) => r.protectedVerdict && r.protectedVerdict.verdict !== 'PASS').length,
      restored: rows.filter((r) => r.acceptance?.disposition === 'RESTORED').length,
      threwOnItsOwnAction: rows.filter((r) => errs(r).length > 0).length,
      constAssignmentErrors: rows.filter((r) => errs(r).some((e) => /Assignment to constant variable/.test(e))).length,
      mutatedInPlace: rows.filter((r) => /\.(fill|splice|push|pop|shift|unshift|sort|reverse|copyWithin)\s*\(|\[[^\]]*\]\s*=/.test(r.extractedCandidate?.text || '')).length,
      reassignedTheBinding: rows.filter((r) => /^\s*[A-Za-z_$][\w$]*\s*=\s*[^=]/m.test(r.extractedCandidate?.text || '')).length,
      generationSeconds: +(rows.reduce((s, r) => s + (r.generationMs || 0), 0) / 1000).toFixed(1),
      outputTokens: rows.reduce((s, r) => s + (r.outputTokens || 0), 0),
      stepsPassing: rows.map((r) => (r.play ? r.play.passing.length : null)),
      rows,
    };
    const a = out.arms[arm];
    console.log(`  ${arm}: accepted ${a.accepted}/${a.startingCandidates}  refused ${a.refused}  protected-failed ${a.protectedFailed}  threw ${a.threwOnItsOwnAction}  const-errors ${a.constAssignmentErrors}  in-place ${a.mutatedInPlace}`);
  }

  out.totals = {
    wallClockSeconds: +((Date.now() - T0) / 1000).toFixed(1),
    oracleSeconds: +(oracleCost.totalMs / 1000).toFixed(1),
    generationSeconds: +(Object.values(out.arms).reduce((n, a) => n + (a.generationSeconds || 0), 0)).toFixed(1),
    timingNote: 'wall clock includes the token-counting calls and verification; generationSeconds is the model calls only',
    dollars: 0,
    modelCalls: ARMS.length * SEEDS.length,
    interventionsByAPerson: 0,
  };
  if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\nwall clock ${out.totals.wallClockSeconds}s, ${out.totals.modelCalls} model calls, $0`);
  for (const arm of ARMS) {
    const a = out.arms[arm];
    console.log(`  ${arm.padEnd(12)} ${String(a.blockTokens).padStart(4)} tok   accepted ${a.accepted}/${a.startingCandidates}   protected-failed ${a.protectedFailed}   restored ${a.restored}   const-errors ${a.constAssignmentErrors}/${a.reachedTheGate}   steps ${a.stepsPassing.join(',')}${a.undelivered ? '   <- UNDELIVERED TREATMENT' : ''}`);
  }
  return out;

  async function infill(prefix, suffix, seed) {
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), DEADLINE_MS);
    let text = '', outTok = null, doneReason = null, aborted = false;
    try {
      const res = await fetch(`${MODEL_URL}/api/generate`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ model: MODEL, prompt: prefix, suffix, stream: true, options: { temperature: TEMPERATURE, num_predict: MAX_TOKENS, seed } }),
      });
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, ms: Date.now() - t0 };
      const dec = new TextDecoder();
      let buf = '';
      for await (const chunk of res.body) {
        buf += dec.decode(chunk, { stream: true });
        const ls = buf.split(NL); buf = ls.pop() || '';
        for (const l of ls) {
          if (!l.trim()) continue;
          let j; try { j = JSON.parse(l); } catch { continue; }
          if (j.response) text += j.response;
          if (j.done) { outTok = j.eval_count ?? null; doneReason = j.done_reason || 'done'; }
        }
      }
    } catch (e) { aborted = ctrl.signal.aborted; if (!aborted) return { ok: false, reason: String(e.message || e), ms: Date.now() - t0 }; } finally { clearTimeout(timer); }
    return { ok: true, text, ms: Date.now() - t0, outTok, doneReason: aborted ? 'harness_deadline' : doneReason };
  }
}

const DIRECT = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (DIRECT) main().catch((e) => { console.error(e); process.exit(1); });
export { commentOut };
