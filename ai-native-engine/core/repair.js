'use strict';
// =============================================================================
// RD-B8 — COLLAPSE-AWARE REPAIR POLICY. The per-model repair knob the RD-B3
// finding demanded, made automatic and detectable rather than pre-configured.
// =============================================================================
// RD-B3 measured REPAIR-MODE COLLAPSE: under corrective re-prompting some models
// (Qwen3-Coder-30B-A3B) regenerate their dominant WRONG completion near-
// deterministically — same bracket typo every attempt — so feedback-repair does
// WORSE than blind resampling. RD-B3's conclusion: repair-vs-resample is a
// per-model knob (FB_STYLE), and "enable it per model from a small probe."
//
// This closes the loop: instead of choosing FB_STYLE up front, DETECT collapse
// AT RUN TIME and switch. The signature is unambiguous and cheap: a rejected
// attempt whose (whitespace/case-normalized) text EQUALS an earlier rejected
// attempt — the model reproduced its own wrong output verbatim, exactly RD-B3's
// observed failure. On detection, abandon corrective feedback and RESAMPLE:
// re-prompt WITHOUT the prior attempt or its errors, at a RAISED temperature, to
// break the deterministic regeneration (the "blind resample beat feedback"
// result, applied automatically). A healthy repair loop that makes progress
// (different output each attempt) never trips it — proven by a negative control.
//
// PURE POLICY: no engine/model coupling. You pass:
//   callModel(prompt, {attempt, temperature, resample}) -> raw string
//   buildPrompt({attempt, priorRaw, priorErrors, resample}) -> prompt string
//   gate(raw) -> {ok:true} | {ok:false, errors:[...]}      (parse+validate)
// Returns { success, attempts, transcript, collapseDetected }.
// Zero deps.
// =============================================================================

const normalize = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase();

async function collapseAwareRepair({
  callModel, buildPrompt, gate,
  maxAttempts = 4, baseTemp = 0.3, collapseTemp = 0.9, feedback = true,
  collapseSwitch = true,   // false => pure fixed-feedback (the "echo" A/B arm)
}) {
  const transcript = [];
  const seenRejected = new Set();     // normalized text of rejected attempts
  let priorRaw = null, priorErrors = null, collapsed = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // once collapsed, RESAMPLE: drop the prior-attempt+errors, raise temperature.
    const resample = collapsed;
    const useFeedback = feedback && !resample;
    const temperature = resample ? collapseTemp : baseTemp;
    const prompt = buildPrompt({
      attempt, resample,
      priorRaw: useFeedback ? priorRaw : null,
      priorErrors: useFeedback ? priorErrors : null,
    });
    const raw = await callModel(prompt, { attempt, temperature, resample });
    const res = gate(raw);
    if (res.ok) {
      transcript.push({ attempt, phase: 'accepted', raw, resample, temperature });
      return { success: true, attempts: attempt, transcript, collapseDetected: collapsed };
    }
    // rejected — check the collapse signature BEFORE recording this attempt.
    const norm = normalize(raw);
    const isRepeat = seenRejected.has(norm);
    if (isRepeat && !collapsed && collapseSwitch) collapsed = true;   // latch (unless the switch is off — the echo A/B arm)
    seenRejected.add(norm);
    transcript.push({ attempt, phase: 'rejected', raw, resample, temperature,
      errors: res.errors, repeatOfEarlier: isRepeat, triggeredCollapse: isRepeat && collapsed && !resample });
    priorRaw = raw; priorErrors = res.errors;
  }
  return { success: false, attempts: maxAttempts, transcript, collapseDetected: collapsed };
}

module.exports = { collapseAwareRepair, normalize };
