'use strict';
// =============================================================================
// LIVE-MODEL LOOP (spine #10's unmeasured quality question) — the propose →
// validate → REPAIR loop that a real local model runs through the protocol.
// =============================================================================
// RD-014 proved the goal-derived contract is load-bearing for MACHINE-checkable
// goals, and RD-018 built the structured-IR wire that turns a model's output
// into either a safe batch or a LOCALIZED, re-promptable error list. Both left
// ONE thing explicitly unmeasured, because it needs a real model:
//
//     Does handing a model its own localized validator errors actually make its
//     next proposal better — or does it flail the same either way?
//
// This module is the harness for that experiment. It is model-agnostic: you pass
// a `callModel(prompt) -> string` function. Wire it to your local model (Ollama,
// llama.cpp, a subprocess — see WIRING at the bottom) and run live_loop_test.js
// with USE_REAL_MODEL. Here we ship a deterministic MOCK model so the harness
// itself is proven end-to-end without a GPU. Zero deps.
//
// The measured comparison the harness supports: FEEDBACK arm (append the
// localized errors to the re-prompt) vs CONTROL arm (retry with the same prompt,
// no errors) — same model, same budget, count attempts-to-success. That delta
// is the answer. The mock only proves the harness + the metric; the real number
// is yours to produce.
// =============================================================================
const { TYPE_NAME } = require('./engine.js');
const IR = require('./protocol.js');

// The instruction block a model sees: the grammar it must emit. Kept legible
// (RD-007 discipline, in the emit direction) — small, explicit, example-led.
// MEASURED (live_loop_real, llama-3.2-1b): this concise form scored FEEDBACK 75%
// (0% control). A longer, more-explicit rewrite — spelling out every choice as
// prose with per-op examples — dropped it to 20%. For a 1B, verbosity DILUTES;
// keep the grammar short. (The one known wart: the "A|B|C" placeholder is
// sometimes copied literally on the hard createChild goal — see the findings
// record. Fixing that without bloating the prompt is an open prompt-design card.)
const IR_GRAMMAR = [
  'You edit a game world by emitting ONE JSON object and nothing else:',
  '{"actor":"ai","ops":[ ...ops... ],"asserts":[ ...optional... ]}',
  'op kinds:',
  '  {"op":"setfield","target":"<uuid>","field":"water|growth|hp|tally|name","value":<number|string>}',
  '  {"op":"delete","target":"<uuid>"}',
  '  {"op":"reparent","target":"<uuid>","parent":"<uuid>"}',
  '  {"op":"createChild","childType":"crop|fish|enemy|zone","parent":"<uuid>","props":{...}}',
  'field ranges: water,growth 0..255 ; hp 0..65535 ; tally 0..4294967295 ; name is text.',
  'water/growth are crop fields; hp is enemy; tally is zone. Use only uuids present in the WORLD.',
  'asserts state your intended postcondition, e.g. {"target":"<uuid>","field":"water","cmp":"<=","value":80}.',
].join('\n');

// Build the prompt: the retrieved world slice (RD-007), the grammar, the goal,
// and — in the FEEDBACK arm — the exact localized errors from the last attempt.
function buildPrompt(engine, { goal, rootUuid, radius = 1, priorErrors = null, priorRaw = null }) {
  let p = `WORLD (columnar slice):\n${engine.contextSlice(rootUuid, radius)}\n${IR_GRAMMAR}\n\nGOAL: ${goal}\n`;
  if (priorErrors && priorErrors.length) {
    // Ground the repair: show the model its OWN prior attempt AND the localized
    // errors, so a stateless re-prompt can correct incrementally without losing
    // the parts it already got right.
    if (priorRaw) p += `\nYour previous attempt (rejected):\n${priorRaw}\n`;
    p += `\nIt was REJECTED. Fix exactly these and resend the FULL corrected JSON:\n`;
    for (const e of priorErrors) p += `  - op[${e.opIndex}] ${e.code}: ${e.detail}\n`;
  }
  p += `\nRespond with ONLY the JSON object.`;
  return p;
}

// One propose→validate→repair run. `feedback` toggles the arm. Returns a record:
// { success, attempts, committed, transcript:[{prompt,raw,phase,errors|result}] }.
async function runProposalLoop(engine, callModel, opts) {
  const { goal, rootUuid, radius = 1, maxAttempts = 4, feedback = true } = opts;
  const transcript = [];
  let priorErrors = null, priorRaw = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const prompt = buildPrompt(engine, { goal, rootUuid, radius,
      priorErrors: feedback ? priorErrors : null, priorRaw: feedback ? priorRaw : null });
    const raw = await callModel(prompt, attempt);
    if (feedback) priorRaw = raw;
    const parsed = IR.parseProposal(engine, raw);
    if (!parsed.ok) {
      transcript.push({ attempt, phase: 'protocol', errors: parsed.errors, raw });
      priorErrors = parsed.errors;
      continue;
    }
    const result = engine.submit(parsed.batch);
    const rejected = result.results.filter(r => r.status === 'rejected');
    if (rejected.length === 0) {
      transcript.push({ attempt, phase: 'committed', result, raw });
      return { success: true, attempts: attempt, committed: result.committed, transcript };
    }
    // engine-level rejection (claim/validate/contract) — surface as pseudo-errors
    priorErrors = rejected.flatMap((r, i) => r.reasons.map(reason => ({ opIndex: i, code: 'engine_rejected', detail: reason })));
    transcript.push({ attempt, phase: 'engine_rejected', errors: priorErrors, raw });
  }
  return { success: false, attempts: maxAttempts, committed: 0, transcript };
}

module.exports = { runProposalLoop, buildPrompt, IR_GRAMMAR };

// =============================================================================
// WIRING A REAL LOCAL MODEL (do this on your machine; then run live_loop_test.js
// with USE_REAL_MODEL=1). The harness only needs an async (prompt)->string.
//
//   // Ollama (HTTP, no deps — Node 18+ has global fetch):
//   async function callModel(prompt) {
//     const r = await fetch('http://localhost:11434/api/generate', {
//       method: 'POST',
//       body: JSON.stringify({ model: 'tinyllama', prompt, stream: false,
//                              options: { temperature: 0 } }),
//     });
//     const j = await r.json();
//     // extract the first {...} JSON object from the completion:
//     const m = j.response.match(/\{[\s\S]*\}/); return m ? m[0] : j.response;
//   }
//
//   // llama.cpp server is the same shape at /completion; a CLI subprocess works
//   // too (spawn, write prompt to stdin, read stdout, slice the JSON object).
//
// Run BOTH arms (feedback:true and feedback:false) over the same goals with the
// same seed/temperature=0, and compare attempts-to-success. That delta is the
// RD-014/RD-018 answer.
// =============================================================================
