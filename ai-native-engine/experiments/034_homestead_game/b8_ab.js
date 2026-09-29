'use strict';
// =============================================================================
// FOLLOW-UP C (RD-B8 per-model A/B) — does the collapse-aware repair SWITCH
// measurably help a collapse-prone model, isolated from everything else?
// A single-rule authoring task (grammatically tricky enough to induce repair),
// N trials per repair MODE, success = the rule INSTALLS within maxAttempts:
//   control — blind retry, no feedback
//   echo    — fixed feedback (prior attempt + localized errors), NEVER switches
//   auto    — collapse-aware: on a repeated rejected output, resample + raise temp
// If auto > echo on the collapse model, the switch earns its keep.
//   [TRIALS=8] [MAX_ATTEMPTS=5] ; model via OPENAI_BASE/OPENROUTER_* ; B8_MOCK=1
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine, TYPE } = CORE('engine.js');
const { parseRule } = CORE('behavior.js');
const { buildRulePrompt, Editor } = CORE('editor.js');
const { collapseAwareRepair } = CORE('repair.js');
const H = require(path.join(__dirname, 'homestead.js'));

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const TRIALS = num(process.env.TRIALS, 8);
const MAX_ATTEMPTS = num(process.env.MAX_ATTEMPTS, 5);

// The target: the scoped-sum score rule — the RD-B7 grammar's hardest single
// construct (nested sum + of:children + where + clamp), the one the MoE most
// often malforms. Success = it PARSES/installs (gate ok), not that it wins a game.
const GOAL = 'set the field zone tally to ADD the SUM of growth over its OWN child crops that are ready (growth >= 100) — use "sum" with "of":"children", accumulate onto the current tally, and clamp with min to 4294967295';

async function trial(callModel, mode) {
  const g = new Engine(64);
  const zone = g.spawn(TYPE.ZONE, { name: 'field', tally: 0 }).uuid;
  g.spawn(TYPE.CROP, { name: 'c', parent: zone, water: 20, growth: 100 });
  const gate = (raw) => { const p = parseRule(g, raw); return p.ok ? { ok: true } : { ok: false, errors: p.errors }; };
  const build = ({ priorRaw, priorErrors, resample }) => buildRulePrompt(g,
    { goal: GOAL, rootUuid: zone, radius: 2, priorErrors: resample ? null : priorErrors, priorRaw: resample ? null : priorRaw });
  const opts = { callModel, buildPrompt: build, gate, maxAttempts: MAX_ATTEMPTS };
  if (mode === 'control') Object.assign(opts, { feedback: false, collapseSwitch: false });
  else if (mode === 'echo') Object.assign(opts, { feedback: true, collapseSwitch: false });
  else Object.assign(opts, { feedback: true, collapseSwitch: true });   // auto
  const r = await collapseAwareRepair(opts);
  return { ok: r.success, attempts: r.attempts, collapse: r.collapseDetected };
}

(async () => {
  const callModel = process.env.B8_MOCK ? mockCollapse() : tempAwareModel();
  if (!callModel) { console.error('no model: B8_MOCK=1 or OPENROUTER_API_KEY+OPENROUTER_MODEL / OPENAI_BASE'); process.exit(1); }
  const MODEL = process.env.OPENROUTER_MODEL || 'mock';
  console.log(`=== RD-B8 A/B: ${MODEL} authors the scoped-sum score rule, ${TRIALS} trials/mode ===\n`);
  const out = {};
  for (const mode of ['control', 'echo', 'auto']) {
    let ok = 0, att = [], collapse = 0;
    for (let i = 0; i < TRIALS; i++) { const r = await trial(callModel, mode); if (r.ok) { ok++; att.push(r.attempts); } if (r.collapse) collapse++; }
    out[mode] = { ok, rate: (ok / TRIALS).toFixed(2), meanAtt: att.length ? (att.reduce((a, b) => a + b, 0) / att.length).toFixed(1) : '-', collapse };
    console.log(`  ${mode.padEnd(8)} installs ${ok}/${TRIALS} (rate ${out[mode].rate})  meanAtt ${out[mode].meanAtt}  collapse-seen ${collapse}`);
  }
  console.log(`\n  A/B: auto ${out.auto.rate} vs echo ${out.echo.rate} vs control ${out.control.rate}` +
    ` -> switch ${(+out.auto.rate > +out.echo.rate) ? 'HELPS' : (+out.auto.rate === +out.echo.rate ? 'ties' : 'hurts')} vs fixed feedback`);
  console.log('RESULT_JSON ' + JSON.stringify({ model: MODEL, trials: TRIALS, modes: out }));
  process.exit(0);
})();

// temp-aware live model (honors ctx.temperature; RD-B8 raises it on collapse)
function tempAwareModel() {
  const OPENAI_BASE = process.env.OPENAI_BASE || 'https://openrouter.ai/api/v1';
  const KEY = process.env.OPENROUTER_API_KEY || (process.env.OPENAI_BASE ? 'EMPTY' : '');
  const MODEL = process.env.OPENROUTER_MODEL;
  if (!KEY && !process.env.OPENAI_BASE) return null;
  const extract = (t) => { t = (t || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/gi, ''); const i = t.indexOf('{'); return i < 0 ? t : t.slice(i, t.lastIndexOf('}') + 1 || undefined); };
  return async (prompt, ctx = {}) => {
    for (let a = 0, backoff = 2000; ; a++) {
      const r = await fetch(`${OPENAI_BASE}/chat/completions`, { method: 'POST',
        headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 600, temperature: ctx.temperature ?? 0.3 }) });
      if (r.ok) return extract((await r.json()).choices?.[0]?.message?.content ?? '');
      if ((r.status === 429 || r.status >= 500) && a < 4) { await new Promise(s => setTimeout(s, backoff)); backoff *= 2; continue; }
      throw new Error(`HTTP ${r.status}`);
    }
  };
}
// mock collapse model: emits a malformed rule under feedback (repeats it), the
// correct rule under resample. So control never fixes, echo collapses (repeats
// forever), auto detects+resamples+succeeds — the RD-B8 mechanism, deterministic.
function mockCollapse() {
  const good = JSON.stringify(H.oracleRulesHard().find(r => r.name === 'score'));
  // genuinely-rejected bad rule (bad_scope: of:"cousins"), repeated under feedback.
  const bad = '{"name":"score","match":{"type":"zone"},"effects":[{"set":"tally","to":{"min":[{"add":[{"field":"tally"},{"sum":{"field":"growth","type":"crop","of":"cousins"}}]},4294967295]}}]}';
  return async (prompt, ctx = {}) => ctx.resample ? good : bad;
}
