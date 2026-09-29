#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// timedRun.mjs — TIMING-1 harness. Collects the DIRECT BASELINE first; the governed arm comes later.
//
//   node server/timedRun.mjs --arm direct --pages s01,s02,s03
//
// $0: local ollama, the same qwen2.5-coder:1.5b digest MODEL-DOSSIER-1 recorded. No paid backend.
//
// ══ THE DESIGN CONSTRAINT THAT SHAPES THIS WHOLE FILE ════════════════════════════════════════════
// If the control arm skipped verification, "Legasus tax" would mostly measure THAT THE CONTROL SKIPS
// VERIFICATION. So the shared half lives here, in one implementation, called identically by both arms:
//
//     observe the baseline -> derive the graph -> generate -> contain -> VERIFY -> decide -> record
//                                                                        ^^^^^^^^^^^^^^^^
//                                                             the same code for both arms, always
//
// BOTH ARMS ALSO RESOLVE DECODING THROUGH THE SAME WELD. That is deliberate: if the weld were only in
// the treatment, it would BE part of the treatment. It is the instrument that makes the two arms
// comparable - which is exactly the property SUPPRESSION-1 turned out not to have, where the arms ran
// at 3000/3000/400 tokens under a definition claiming "same token budget".
//
//     THE ONLY INTENDED DIFFERENCE IS THE GOVERNED PREPARE / LEASE / EFFECT / RECEIPT PATH.
//
// Generation uses the whole-page interface - the one arm of SUPPRESSION-1 that actually produced
// accepted work with this model (12/12). A timing baseline over an interface that always refuses would
// exercise almost nothing and measure almost nothing.
//
// THE RECORD IS VALIDATED BEFORE IT IS WRITTEN. An invalid record is not saved, because the contract
// is only worth freezing if it can refuse something.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { blankRecord, validateTimingRecord } from './timingContract.mjs';
import { resolveDecoding, decodingRecord } from './lockedDecoding.mjs';

const NL = String.fromCharCode(10);
const { observeBaseline } = await import('./behaviorModel.mjs');
const { derive, verify } = await import('./featureGraph.mjs');
const { playCheck } = await import('./playCheck.js');
const { topLevelFunctions, referencedElsewhere } = await import('./editPlanner.mjs');

const opt = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const ARM = opt('arm', 'direct');
const PROFILE = opt('profile', 'whole-file-v1');
const MODEL = opt('model', 'qwen2.5-coder:1.5b');
const PAGES = opt('pages', 's01,s02,s03').split(',').map((s) => s.trim()).filter(Boolean);
const OUT = opt('out', 'legasus/records/timing');
const RUN_ID = opt('run-id', `timing-${ARM}-${Date.now()}`);
if (ARM !== 'direct') { console.error(`arm ${ARM} is not implemented yet - the direct baseline is collected first, by design`); process.exit(2); }

const sha = (t) => createHash('sha256').update(t).digest('hex');
const now = () => Number(process.hrtime.bigint() / 1000000n);

// ══ GENERATION ════════════════════════════════════════════════════════════════════════════════════
async function generate(prompt, options) {
  const t0 = now();
  let r;
  try {
    r = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, stream: false, options }),
    });
  } catch (e) { return { ok: false, ms: now() - t0, why: String(e.message || e) }; }
  if (!r.ok) return { ok: false, ms: now() - t0, why: `HTTP ${r.status}` };
  const j = await r.json();
  return {
    ok: true, ms: now() - t0, text: String(j.response || ''),
    promptTokens: j.prompt_eval_count ?? null, outputTokens: j.eval_count ?? null, doneReason: j.done_reason,
  };
}

/** The whole-page extractor, kept deliberately strict: a generous one would credit the model for my parser. */
function extractWholePage(text, baseline) {
  let t = String(text || '');
  const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1];
  const start = t.search(/<!DOCTYPE html|<html\b/i);
  const end = t.toLowerCase().lastIndexOf('</html>');
  if (start === -1 || end === -1 || end < start) return { ok: false, reason: 'NO_EXTRACTABLE_CHANGE' };
  const page = t.slice(start, end + '</html>'.length);
  if (page.trim() === baseline.trim()) return { ok: false, reason: 'ECHOED_THE_INPUT' };
  return { ok: true, page };
}

// ══ THE SHARED HALF — identical for both arms, and that is the point ══════════════════════════════
async function verifyAndDecide({ candidate, task, spec, graph, workspace, entry, baseline }) {
  const tV = now();
  const result = await verify(candidate, { task, spec, graph, deps: { playCheck } });
  const verificationMs = now() - tV;

  const complete = result.complete;
  let terminal, restorationMs = null;
  const tE = now();
  if (complete) {
    writeFileSync(join(workspace, entry), candidate, 'utf8');
    terminal = 'RETAINED';
  } else {
    writeFileSync(join(workspace, entry), baseline, 'utf8');
    restorationMs = now() - tE;
    // Restoration is only real if the bytes came back. Asserting it, not assuming it.
    const back = readFileSync(join(workspace, entry), 'utf8');
    terminal = back === baseline ? 'RESTORED' : 'NOT_EVALUATED';
  }
  const effectMs = now() - tE;
  return { verificationMs, effectMs, restorationMs, terminal, result };
}

// ══ ONE RUN ═══════════════════════════════════════════════════════════════════════════════════════
async function runOne(pageDir, pageName) {
  const tRun = now();
  const notes = [];
  const baseline = readFileSync(join(pageDir, 'baseline-as-delivered.html'), 'utf8');
  const task = JSON.parse(readFileSync(join(pageDir, 'task.json'), 'utf8'));
  const spec = task.diagnostic.spec;
  const entry = spec.entry || 'index.html';

  // THE WELD. Both arms, always. `ignored` is carried into the record rather than dropped.
  const resolved = resolveDecoding(PROFILE);
  const dec = decodingRecord(resolved);

  const rec = blankRecord({
    arm: ARM, runId: RUN_ID, at: new Date().toISOString(), task: task.id, page: pageName,
    baselineSha: sha(baseline), model: MODEL,
    decodingProfile: dec.profile,
    decoding: { temperature: dec.temperature, num_predict: dec.num_predict, seed: dec.seed },
    decodingOverridesRefused: dec.overridesRefused,
  });

  const workspace = mkdtempSync(join(tmpdir(), 'timed-'));
  try {
    writeFileSync(join(workspace, entry), baseline, 'utf8');

    // SHARED: observe the baseline and derive the graph. Timed on its own, because it happens once per
    // task before any candidate exists and folding it into verification would inflate it.
    const tD = now();
    const observation = await observeBaseline(baseline, task, { playCheck });
    const graph = derive(baseline, task, { topLevelFunctions, referencedElsewhere, observation });
    rec.clocks.derivationMs = now() - tD;
    rec.counts.nodesCovered = 0;
    rec.counts.nodesMissing = graph.nodes.length;

    const r = task.requirement;
    const prompt = [
      'Here is a web page.', '', baseline, '',
      `A user wants this change: Add a control ${r.trigger.selector}. Clicking it: ${(r.effects || []).join('; ')}. ${(r.invariants || []).join('. ')}.`,
      'Everything the page already does must keep working.', '',
      'Give the complete updated page.',
    ].join(NL);

    const gen = await generate(prompt, resolved.options);
    rec.clocks.generationMs = gen.ms;
    rec.counts.calls = 1;
    if (!gen.ok) {
      rec.terminal = 'NOT_EVALUATED'; rec.outcome = 'GENERATION_FAILED';
      notes.push(gen.why);
      rec.clocks.endToEndMs = now() - tRun; rec.notes = notes;
      return rec;
    }
    rec.counts.promptTokens = gen.promptTokens;
    rec.counts.outputTokens = gen.outputTokens;
    if (gen.doneReason === 'length') notes.push('OUTPUT_CAP_EXHAUSTED: done_reason=length');

    const tC = now();
    const ex = extractWholePage(gen.text, baseline);
    rec.clocks.containmentMs = now() - tC;
    if (!ex.ok) {
      rec.terminal = 'REFUSED'; rec.outcome = ex.reason;
      rec.counts.acceptedChanges = 0;
      rec.clocks.verificationMs = 0; rec.clocks.effectMs = 0;
      rec.clocks.endToEndMs = now() - tRun; rec.notes = notes;
      return rec;
    }
    rec.candidateSha = sha(ex.page);

    const d = await verifyAndDecide({ candidate: ex.page, task, spec, graph, workspace, entry, baseline });
    rec.clocks.verificationMs = d.verificationMs;
    rec.clocks.effectMs = d.effectMs;
    rec.clocks.restorationMs = d.restorationMs;
    rec.terminal = d.terminal;
    rec.outcome = d.result.complete ? 'ACCEPTED' : `MISSING_${d.result.missing.join('_')}`;
    rec.counts.acceptedChanges = d.result.complete ? 1 : 0;
    rec.counts.nodesCovered = d.result.covered.length;
    rec.counts.nodesMissing = d.result.missing.length;
    rec.clocks.endToEndMs = now() - tRun;
    rec.notes = notes;
    return rec;
  } finally { if (existsSync(workspace)) { try { rmSync(workspace, { recursive: true, force: true }); } catch { /* best effort */ } } }
}

// ══ THE RUN ═══════════════════════════════════════════════════════════════════════════════════════
mkdirSync(OUT, { recursive: true });
console.log(`TIMING-1  arm=${ARM}  profile=${PROFILE}  model=${MODEL}  pages=${PAGES.join(',')}`);
console.log(`${NL}page   terminal          gen(ms)  verify(ms)  derive(ms)  e2e(ms)   outTok  nodes`);

const written = [];
for (const p of PAGES) {
  const dir = join('legasus/bench/suppression1', p);
  if (!existsSync(join(dir, 'task.json'))) { console.log(`  ${p}: no task, skipped`); continue; }
  const rec = await runOne(dir, p);
  const v = validateTimingRecord(rec);
  if (!v.ok) {
    // The contract is only worth freezing if it can refuse something.
    console.error(`  ${p}: RECORD REJECTED BY THE CONTRACT, not written -> ${v.problems.join('; ')}`);
    continue;
  }
  const f = join(OUT, `${RUN_ID}-${p}.json`);
  writeFileSync(f, JSON.stringify(rec, null, 2), 'utf8');
  written.push(rec);
  const c = rec.clocks;
  console.log(`  ${p}   ${String(rec.terminal).padEnd(16)} ${String(c.generationMs).padStart(7)} `
    + `${String(c.verificationMs).padStart(11)} ${String(c.derivationMs).padStart(11)} ${String(c.endToEndMs).padStart(8)}  `
    + `${String(rec.counts.outputTokens).padStart(6)}  ${rec.counts.nodesCovered}/${rec.counts.nodesCovered + rec.counts.nodesMissing}`);
}

const sum = (k) => written.reduce((a, r) => a + (r.clocks[k] || 0), 0);
const med = (k) => { const v = written.map((r) => r.clocks[k] || 0).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 0; };
console.log(`${NL}  ${written.length} record(s) written to ${OUT}/`);
if (written.length) {
  console.log(`  medians: generation ${med('generationMs')}ms  verification ${med('verificationMs')}ms  derivation ${med('derivationMs')}ms  end-to-end ${med('endToEndMs')}ms`);
  const gv = sum('generationMs') + sum('verificationMs');
  console.log(`  generation is ${Math.round((100 * sum('generationMs')) / gv)}% of generation+verification`
    + ` - the share that governance could never change, and the reason both arms must verify identically`);
  console.log(`  accepted ${written.filter((r) => r.terminal === 'RETAINED').length}/${written.length}`);
}
