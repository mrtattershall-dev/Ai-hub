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
import { blankRecord, validateTimingRecord } from './timingContract.mjs';

const NL = String.fromCharCode(10);
// THE SHARED HALF IS IMPORTED, NOT COPIED. This file used to hold its own generate/extract/verify.
// Two copies make 'both arms verify identically' true on the day it is written and quietly false
// three commits later, with nothing to announce it.
import { observeAndDerive, buildPrompt, generate, extractWholePage, verifyCandidate, sha, nowMs } from './sharedRun.mjs';

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

const now = nowMs;

// ══ THE SHARED HALF — identical for both arms, and that is the point ══════════════════════════════
async function verifyAndDecide({ candidate, task, spec, graph, workspace, entry, baseline }) {
  const result = await verifyCandidate({ candidate, task, spec, graph });
  const verificationMs = result.verificationMs;

  // A VERIFIER THAT COULD NOT RUN IS NOT A REJECTION. Without this the run would write the
  // baseline back and record RESTORED - blaming the model for a missing browser.
  if (result.ran === false) {
    return { verificationMs, effectMs: 0, restorationMs: null, terminal: 'NOT_EVALUATED', result };
  }
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


  const workspace = mkdtempSync(join(tmpdir(), 'timed-'));
  try {
    writeFileSync(join(workspace, entry), baseline, 'utf8');

    // SHARED: observe the baseline and derive the graph. Timed on its own, because it happens once per
    // task before any candidate exists and folding it into verification would inflate it.
    const { graph, derivationMs } = await observeAndDerive(baseline, task);

    // The prompt AND the weld both come from the shared half, so the two arms cannot drift apart in
    // what they ask or what they ask it under.
    const gen = await generate({ prompt: buildPrompt(baseline, task), profile: PROFILE, model: MODEL });

    const rec = blankRecord({
      arm: ARM, runId: RUN_ID, at: new Date().toISOString(), task: task.id, page: pageName,
      baselineSha: sha(baseline), model: MODEL,
      decodingProfile: gen.decoding.profile,
      decoding: { temperature: gen.decoding.temperature, num_predict: gen.decoding.num_predict, seed: gen.decoding.seed },
      decodingOverridesRefused: gen.decoding.overridesRefused,
    });
    rec.clocks.derivationMs = derivationMs;
    rec.counts.nodesCovered = 0;
    rec.counts.nodesMissing = graph.nodes.length;
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
