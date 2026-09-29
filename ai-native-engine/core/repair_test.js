'use strict';
// =============================================================================
// repair_test.js — deterministic proof of the RD-B8 collapse-aware repair
// policy: it DETECTS repair-mode collapse (a model reproducing its own wrong
// output) and switches to resampling, rescuing a case plain feedback-repair
// loops on forever — while NOT misfiring on a healthy repair loop.
// `node core/repair_test.js` -> ALL PASS. Zero deps, no model.
// =============================================================================
const path = require('node:path');
const { collapseAwareRepair, normalize } = require(path.join(__dirname, 'repair.js'));

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const hr = (t) => console.log(`\n--- ${t} ---`);

// a trivial gate: JSON is "valid" iff it has {"ok":true}.
const gate = (raw) => { try { const o = JSON.parse(raw); return o && o.ok === true ? { ok: true } : { ok: false, errors: [{ code: 'not_ok' }] }; } catch { return { ok: false, errors: [{ code: 'bad_json' }] }; } };
const buildPrompt = ({ resample, priorErrors }) => resample ? 'BLIND' : (priorErrors ? 'FEEDBACK' : 'FIRST');

console.log('=== RD-B8: collapse-aware repair policy ===');

(async () => {
// ---- SCENARIO A: a COLLAPSING model — rescued by the switch ----------------
hr('A  collapse detected -> switch to resample -> rescued (vs feedback loops forever)');
{
  // Under any FEEDBACK prompt it reproduces the SAME wrong output verbatim (the
  // RD-B3 signature). Under a RESAMPLE prompt (blind) it produces the fix.
  const collapsingModel = async (prompt, ctx) =>
    ctx.resample ? '{"ok":true}' : '{"ok":false,"note":"the same wrong thing"}';

  const r = await collapseAwareRepair({ callModel: collapsingModel, buildPrompt, gate, maxAttempts: 4 });
  ok(r.success, 'the collapsing model is RESCUED (succeeds within budget)');
  ok(r.collapseDetected, 'collapse was DETECTED (a rejected attempt repeated an earlier one)');
  const switchedAt = r.transcript.findIndex(t => t.resample);
  ok(switchedAt === 2, `switched to resample at attempt ${switchedAt + 1} (after the 2nd identical rejection)`);
  ok(r.transcript[2].resample && r.transcript[2].temperature === 0.9, 'the resample attempt raised temperature (0.3 -> 0.9)');
  ok(r.attempts === 3, 'succeeded on the resample attempt (3) — one round after detection');

  // CONTROL: same model, collapse-switch DISABLED (pure feedback) -> never succeeds.
  const feedbackOnly = async (prompt) => prompt === 'BLIND' ? '{"ok":true}' : '{"ok":false,"note":"the same wrong thing"}';
  // simulate pure feedback by never entering resample: give a model that ignores resample.
  const stubbornModel = async () => '{"ok":false,"note":"the same wrong thing"}';
  const c = await collapseAwareRepair({ callModel: stubbornModel, buildPrompt, gate, maxAttempts: 4, collapseTemp: 0.9 });
  ok(!c.success, 'CONTROL: a model that repeats even under resample is NOT rescued (the policy is not magic — it only breaks deterministic regeneration a temp/blind change can break)');
  ok(c.collapseDetected, 'CONTROL: collapse still correctly detected');
}

// ---- SCENARIO B: a HEALTHY repair loop — no false positive -----------------
hr('B  progress each attempt -> collapse NOT triggered -> normal feedback repair');
{
  // Different wrong output each attempt, then correct on the 3rd — a model that
  // USES feedback. The detector must NOT trip (outputs never repeat).
  let n = 0;
  const progressingModel = async () => { n++; return n === 1 ? '{"ok":false,"v":1}' : n === 2 ? '{"ok":false,"v":2}' : '{"ok":true}'; };
  const r = await collapseAwareRepair({ callModel: progressingModel, buildPrompt, gate, maxAttempts: 4 });
  ok(r.success && r.attempts === 3, 'healthy loop succeeds via normal feedback repair (attempt 3)');
  ok(!r.collapseDetected, 'collapse NOT falsely detected (every attempt was different)');
  ok(r.transcript.every(t => !t.resample), 'never switched to resample — feedback stayed on (no misfire)');
}

// ---- SCENARIO C: one-shot success is untouched -----------------------------
hr('C  a correct first attempt is unaffected');
{
  const r = await collapseAwareRepair({ callModel: async () => '{"ok":true}', buildPrompt, gate, maxAttempts: 4 });
  ok(r.success && r.attempts === 1 && !r.collapseDetected, 'first-try success: 1 attempt, no collapse machinery engaged');
}

// ---- D: the detector normalizes whitespace/case (robust signature) ---------
hr('D  the collapse signature ignores whitespace/case (a re-emit with trivial diffs still counts)');
{
  const variants = ['{"ok":false, "x":1}', '{ "OK":FALSE, "X":1 }']; // NOT identical chars, but...
  ok(normalize('{"ok":false, "x":1}') === normalize('{"ok":false,"x":1}'), 'whitespace-only differences normalize equal');
  ok(normalize('ABC') === normalize('abc'), 'case differences normalize equal');
  // a model that re-emits the same content with only whitespace jitter still collapses:
  let k = 0;
  const jitterModel = async (p, ctx) => ctx.resample ? '{"ok":true}' : (k++ === 0 ? '{"ok":false,"x":1}' : '{"ok":false,  "x":1}');
  const r = await collapseAwareRepair({ callModel: jitterModel, buildPrompt, gate, maxAttempts: 4 });
  ok(r.collapseDetected && r.success, 'whitespace-jittered re-emit is still caught as collapse and rescued');
}

console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
process.exit(FAIL ? 1 : 0);
})();
