// ══════════════════════════════════════════════════════════════════════════════════════════════════
// sharedRun.mjs — the half of a run that BOTH ARMS MUST EXECUTE IDENTICALLY.
//
// This module exists so that "both arms verify the same way" is a FACT rather than an assertion. If
// the direct runner and the governed runner each had their own copy, the sentence would be true on the
// day it was written and quietly false three commits later, and the comparison would not announce it.
//
//   observe the baseline -> derive the graph -> generate (through the weld) -> contain -> VERIFY
//
// Everything above is here. What is NOT here is the EFFECT: writing the accepted bytes, or refusing to.
// That is the only thing the two arms are allowed to do differently, and it is the treatment.
//
// THE WELD IS IN THE SHARED HALF ON PURPOSE. If only the governed arm resolved decoding through it, the
// weld would BE part of the treatment; here it is the instrument that makes the arms comparable, which
// is exactly the property SUPPRESSION-1 turned out not to have.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createHash } from 'node:crypto';
import { resolveDecoding, decodingRecord } from './lockedDecoding.mjs';

const NL = String.fromCharCode(10);
export const sha = (t) => createHash('sha256').update(t).digest('hex');
export const nowMs = () => Number(process.hrtime.bigint() / 1000000n);

const { observeBaseline } = await import('./behaviorModel.mjs');
const { derive, verify } = await import('./featureGraph.mjs');
const { playCheck } = await import('./playCheck.js');
const { topLevelFunctions, referencedElsewhere } = await import('./editPlanner.mjs');

/** Observe the delivered baseline and derive the expected graph. Once per task, before any candidate. */
export async function observeAndDerive(baseline, task) {
  const t0 = nowMs();
  const observation = await observeBaseline(baseline, task, { playCheck });
  const graph = derive(baseline, task, { topLevelFunctions, referencedElsewhere, observation });
  return { observation, graph, derivationMs: nowMs() - t0 };
}

/** The one prompt both arms send. Built from the task's own requirement, never hand-tuned per arm. */
export function buildPrompt(baseline, task) {
  const r = task.requirement;
  return [
    'Here is a web page.', '', baseline, '',
    `A user wants this change: Add a control ${r.trigger.selector}. Clicking it: ${(r.effects || []).join('; ')}. ${(r.invariants || []).join('. ')}.`,
    'Everything the page already does must keep working.', '',
    'Give the complete updated page.',
  ].join(NL);
}

/**
 * Generate. Decoding comes from the weld, and what the weld REFUSED travels with the result so a run
 * record can carry it rather than dropping it.
 */
export async function generate({ prompt, profile, model, endpoint = 'http://127.0.0.1:11434/api/generate' }) {
  const resolved = resolveDecoding(profile);
  const dec = decodingRecord(resolved);
  const t0 = nowMs();
  let r;
  try {
    r = await fetch(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, options: resolved.options }),
    });
  } catch (e) { return { ok: false, ms: nowMs() - t0, why: String(e.message || e), decoding: dec }; }
  if (!r.ok) return { ok: false, ms: nowMs() - t0, why: `HTTP ${r.status}`, decoding: dec };
  const j = await r.json();
  const text = String(j.response || '');
  return {
    ok: true, ms: nowMs() - t0, text, decoding: dec,
    // Hashes of the exact bytes sent and received. A receipt that names a model call without them
    // names an event rather than an artifact.
    requestSha: sha(JSON.stringify({ model, prompt, options: resolved.options })),
    responseSha: sha(text),
    promptTokens: j.prompt_eval_count ?? null,
    outputTokens: j.eval_count ?? null,
    doneReason: j.done_reason,
  };
}

/** The whole-page extractor, deliberately strict: a generous one would credit the model for my parser. */
export function extractWholePage(text, baseline) {
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

/**
 * VERIFY, AND NOTHING ELSE. This returns a verdict and writes nothing anywhere.
 *
 * Keeping the write out of here is what lets the governed arm use the verdict AS EVIDENCE that licenses
 * a narrowly scoped authority - verification first, authority second, effect last. A verify() that also
 * wrote would force the governed arm to commit before it had anything to justify committing with.
 */
export async function verifyCandidate({ candidate, task, spec, graph }) {
  const t0 = nowMs();
  const result = await verify(candidate, { task, spec, graph, deps: { playCheck } });
  return { ...result, verificationMs: nowMs() - t0 };
}
