'use strict';
// =============================================================================
// RD-B3 (part 2): LIVE-MODEL BEHAVIOR AUTHORING — the RD-018.1 measurement,
// one level up. A real model is asked to AUTHOR A BEHAVIOR (a rule) into a
// RUNNING simulation through the RD-B1/B2 gate. Two arms:
//   CONTROL : blind retry, same prompt each attempt
//   FEEDBACK: re-prompt carries the prior attempt + the wire's localized
//             errors (or "installed but the goal check failed")
// Success = the rule INSTALLS and the sim then OBSERVABLY does the thing
// (machine-checkable predicate after N ticks — the RD-014 contract discipline
// applied to behavior). Safety is measured on every attempt: a rejected or
// wrong proposal must corrupt nothing (indexes consistent, no stray values).
//
//   MOCK (deterministic, part of the repeatable record):
//       node experiments/027_behavior_live/behavior_live.js --mock
//   REAL (stochastic; local Ollama or OpenAI-compatible endpoint):
//       OLLAMA_MODEL=qwen2.5-coder:7b node experiments/027_behavior_live/behavior_live.js
//       [TRIALS=1] [MAX_ATTEMPTS=3] [LOOP_TEMP=0.7] [TICKS=6]
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine, TYPE } = CORE('engine.js');
const { installRule } = CORE('behavior.js');

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const TRIALS = num(process.env.TRIALS, 1);
const MAX_ATTEMPTS = num(process.env.MAX_ATTEMPTS, 3);
const TICKS = num(process.env.TICKS, 6);
const TEMP = num(process.env.LOOP_TEMP ?? 0.7, 0.7);
// Optional focused probe used when a grammar extension fixes one measured
// failure mode (e.g. ONLY_GOAL=score for RD-B4). The default remains the full
// comparable four-goal battery.
const ONLY_GOAL = process.env.ONLY_GOAL || '';
// FB_STYLE: how the FEEDBACK arm re-prompts.
//   'echo'   (default, RD-018.1 style): prior attempt + localized errors
//   'errors': localized errors ONLY — no prior-attempt echo. Motivated by the
//   measured Qwen3 ECHO TRAP: shown its own prior attempt, it repeats it
//   VERBATIM (same bracket typo 3 attempts running) instead of editing it.
const FB_STYLE = process.env.FB_STYLE || 'echo';

// The grammar the model sees. CONCISE on purpose — RD-018.1 measured that
// verbosity backfires on small models (75% -> 20%). One worked clamp example
// because the range proof is the novel demand.
const RULE_GRAMMAR = [
  'You author ONE behavior rule for a running game world. Emit ONE JSON object, nothing else:',
  '{"name":"<short>","match":{"type":"crop|enemy|zone","uuid":"<optional uuid>","where":{"field":"<f>","cmp":"<|<=|==|>=|>|!=","value":<n>}},"effects":[...]}',
  'effects (use what the goal needs):',
  '  {"set":"<field>","to":<expr>}    expr: number | {"field":"<f>"} | {"add":[e,e]} | {"sub":[e,e]} | {"min":[e,e]} | {"max":[e,e]}',
  '                                        | {"count":{"type":"<t>","where":{...}}}',
  '  {"delete":true}  |  {"reparent":{"to":"<uuid>"}}  |  {"spawn":{"type":"<t>","props":{},"cap":1}}',
  'fields: water,growth are crop (0..255); hp is enemy (0..65535); tally is zone (0..4294967295).',
  'A "set" must PROVABLY stay in range: clamp with min/max.',
  'Example, growth+5 clamped to 255: {"set":"growth","to":{"min":[{"add":[{"field":"growth"},5]},255]}}',
  'The rule runs EVERY TICK on EVERY entity of the matched type. Use match.uuid to target one exact entity; it may be combined with "where". "where" fields must belong to that type.',
].join('\n');

// ---- machine-checkable behavior goals (fresh world per attempt) -------------
function goals() {
  return [
    { name: 'grow', build: () => {
        const g = new Engine(64);
        const zone = g.spawn(TYPE.ZONE, { name: 'field' }).uuid;
        const wet = g.spawn(TYPE.CROP, { name: 'wet', parent: zone, water: 30, growth: 0 }).uuid;
        g.spawn(TYPE.CROP, { name: 'dry', parent: zone, water: 0, growth: 0 });
        return { g, zone, goal: 'Watered crops (water > 0) must GROW over time: each tick their growth increases by 5.',
          check: () => g._field(g.w.liveEntity(wet), 'growth') >= 5 * (TICKS - 1) };
      } },
    { name: 'flee', build: () => {
        const g = new Engine(64);
        const zone = g.spawn(TYPE.ZONE, { name: 'field' }).uuid;
        const safe = g.spawn(TYPE.ZONE, { name: 'safehouse' }).uuid;
        const weak = g.spawn(TYPE.ENEMY, { name: 'weak', parent: zone, hp: 10 }).uuid;
        const strong = g.spawn(TYPE.ENEMY, { name: 'strong', parent: zone, hp: 90 }).uuid;
        return { g, zone, goal: `Enemies with hp below 20 must FLEE: move (reparent) them to the safehouse zone, uuid ${safe}.`,
          check: () => { const we = g.w.liveEntity(weak), se = g.w.liveEntity(strong);
            return g.w.uuid[g.w.parent[we]] === safe && g.w.uuid[g.w.parent[se]] !== safe; } };
      } },
    { name: 'score', build: () => {
        const g = new Engine(64);
        const zone = g.spawn(TYPE.ZONE, { name: 'field', tally: 0 }).uuid;
        [120, 80, 150].forEach((gr, i) => g.spawn(TYPE.CROP, { name: `c${i}`, parent: zone, growth: gr }));
        return { g, zone, goal: `The field zone (uuid ${zone}) must keep SCORE: set its tally to the number of harvest-ready crops (growth >= 100), recounted every tick. Target that exact zone with match.uuid.`,
          check: () => g._field(g.w.liveEntity(zone), 'tally') === 2 };
      } },
    { name: 'wilt', build: () => {
        const g = new Engine(64);
        const zone = g.spawn(TYPE.ZONE, { name: 'field' }).uuid;
        const dry = g.spawn(TYPE.CROP, { name: 'dry', parent: zone, water: 0, growth: 50 }).uuid;
        const wet = g.spawn(TYPE.CROP, { name: 'wet', parent: zone, water: 30, growth: 50 }).uuid;
        return { g, zone, goal: 'Unwatered crops (water == 0) must WILT: each tick their growth drops by 2 (never below 0).',
          check: () => { const d = g._field(g.w.liveEntity(dry), 'growth');
            return d < 50 && d >= 0 && g._field(g.w.liveEntity(wet), 'growth') === 50; } };
      } },
  ];
}

const fmtErrs = (errs) => errs.map(e => `- ${e.code} at ${e.where ?? '?'}${e.detail ? ': ' + e.detail : ''}`).join('\n');

// ---- one trial: propose -> gate -> run -> observe -> (repair) ---------------
async function runBehaviorTrial(callModel, spec, { feedback }) {
  let prior = null, priorErrs = null, unsafe = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const fx = spec.build();                       // fresh world every attempt
    const slice = fx.g.contextSlice(fx.zone, 1);
    const { goal, check } = fx;
    let prompt = `WORLD (tick ${fx.g.tick}):\n${slice}\n${RULE_GRAMMAR}\n\nGOAL: ${goal}`;
    if (feedback && priorErrs) prompt += FB_STYLE === 'errors'
      ? `\n\nYour previous attempt was rejected:\n${fmtErrs(priorErrs)}\nEmit a corrected rule (ONE JSON object only).`
      : `\n\nYour previous attempt:\n${prior}\nIt was rejected:\n${fmtErrs(priorErrs)}\nEmit a corrected rule (ONE JSON object only).`;
    const t0 = Date.now();
    const raw = await callModel(prompt);
    const tag = `${spec.name} ${feedback ? 'F' : 'C'} a${attempt}`;
    console.log(`    [${tag}] ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    prior = raw;
    const res = installRule(fx.g, raw);
    if (!res.ok) { priorErrs = res.errors;                      // gated BEFORE running
      console.error(`      [${tag}] REJECTED ${res.errors.map(e => e.code).join(',')} :: ${String(raw).replace(/\s+/g, ' ').slice(0, 260)}`);
      continue; }
    for (let t = 0; t < TICKS; t++) fx.g.stepTick();
    if (!fx.g.indexesConsistent()) unsafe++;                   // must never happen
    if (check()) return { success: true, attempts: attempt, unsafe };
    console.error(`      [${tag}] INSTALLED_BUT_MISSED :: ${String(raw).replace(/\s+/g, ' ').slice(0, 260)}`);
    priorErrs = [{ code: 'goal_not_met', where: 'behavior',
      detail: `the rule installed and ran ${TICKS} ticks but the goal was not observed. Goal: ${goal}` }];
  }
  return { success: false, attempts: MAX_ATTEMPTS, unsafe };
}

async function runArm(callModel, feedback) {
  const rows = [];
  const selected = goals().filter(s => !ONLY_GOAL || s.name === ONLY_GOAL);
  if (!selected.length) throw new Error(`unknown ONLY_GOAL '${ONLY_GOAL}'`);
  for (const spec of selected) {
    let succ = 0, att = [], unsafe = 0;
    for (let t = 0; t < TRIALS; t++) {
      const r = await runBehaviorTrial(callModel, spec, { feedback });
      if (r.success) { succ++; att.push(r.attempts); }
      unsafe += r.unsafe;
    }
    rows.push({ name: spec.name, succ, unsafe, mean: att.length ? (att.reduce((a, b) => a + b) / att.length).toFixed(1) : '-' });
    console.log(`  ${feedback ? 'FEEDBACK' : 'CONTROL '} ${rows.at(-1).name.padEnd(6)} ${succ}/${TRIALS}  meanAtt ${rows.at(-1).mean}`);
  }
  return rows;
}

// ---- MOCK model: proves the apparatus deterministically ---------------------
// First proposal per goal is a REALISTIC near-miss (the RD-B1-measured failure
// class: correct intent, unclamped/unproven range or wrong shape). On seeing
// the localized error in the prompt, it emits the corrected rule. CONTROL
// never sees the error -> repeats the near-miss. Expected: control 0/4,
// feedback 4/4 at exactly 2 attempts, zero unsafe events.
function mockModel() {
  const wrong = {
    grow:  '{"name":"grow","match":{"type":"crop","where":{"field":"water","cmp":">","value":0}},"effects":[{"set":"growth","to":{"add":[{"field":"growth"},5]}}]}', // unclamped
    flee:  '{"name":"flee","match":{"type":"enemy","where":{"field":"hp","cmp":"<","value":20}},"effects":[{"set":"hp","to":{"add":[{"field":"hp"},{"field":"hp"}]}}]}', // wrong effect + unclamped
    score: '{"name":"score","match":{"type":"crop"},"effects":[{"set":"tally","to":1}]}',   // tally on crop: not owned
    wilt:  '{"name":"wilt","match":{"type":"crop","where":{"field":"water","cmp":"==","value":0}},"effects":[{"set":"growth","to":{"sub":[{"field":"growth"},2]}}]}', // could go negative
  };
  const right = {
    grow:  '{"name":"grow","match":{"type":"crop","where":{"field":"water","cmp":">","value":0}},"effects":[{"set":"growth","to":{"min":[{"add":[{"field":"growth"},5]},255]}}]}',
    flee:  null, // corrected below: needs the safehouse uuid from the goal text
    score: null, // corrected below: the live card requires exact field-zone scope
    wilt:  '{"name":"wilt","match":{"type":"crop","where":{"field":"water","cmp":"==","value":0}},"effects":[{"set":"growth","to":{"max":[{"sub":[{"field":"growth"},2]},0]}}]}',
  };
  return async (prompt) => {
    const goal = /GROW over time/.test(prompt) ? 'grow' : /FLEE/.test(prompt) ? 'flee' : /SCORE/.test(prompt) ? 'score' : 'wilt';
    const sawError = /rejected:/.test(prompt);
    if (!sawError) return wrong[goal];
    if (goal === 'flee') {
      const safe = prompt.match(/safehouse zone, uuid (\w+)/)[1];
      return `{"name":"flee","match":{"type":"enemy","where":{"field":"hp","cmp":"<","value":20}},"effects":[{"reparent":{"to":"${safe}"}}]}`;
    }
    if (goal === 'score') {
      const zone = prompt.match(/field zone \(uuid (\w+)\)/)[1];
      return `{"name":"score","match":{"type":"zone","uuid":"${zone}"},"effects":[{"set":"tally","to":{"count":{"type":"crop","where":{"field":"growth","cmp":">=","value":100}}}}]}`;
    }
    return right[goal];
  };
}

// ---- REAL backends (mirrors core/live_loop_real.js conventions) -------------
function extractJson(text) {
  text = (text || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/gi, '');
  const start = text.indexOf('{');
  if (start < 0) return text;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return text.slice(start);
}
function realModel() {
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL;
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
  const OPENAI_BASE = process.env.OPENAI_BASE || 'https://openrouter.ai/api/v1';
  const KEY = process.env.OPENROUTER_API_KEY || (process.env.OPENAI_BASE ? 'EMPTY' : '');
  if (!OLLAMA_MODEL && !KEY) { console.error('set OLLAMA_MODEL (local) or OPENROUTER_API_KEY — or use --mock'); process.exit(1); }
  const MODEL = OLLAMA_MODEL || process.env.OPENROUTER_MODEL;
  console.log(`model=${MODEL}  trials/goal=${TRIALS}  maxAttempts=${MAX_ATTEMPTS}  ticks=${TICKS}  temp=${TEMP}`);
  if (OLLAMA_MODEL) return async (prompt) => {
    // stream:true is LOAD-BEARING on a slow CPU box: with stream:false Ollama
    // holds the HTTP HEADERS until generation completes, and undici's hard
    // 300s headers-timeout kills any >5min generation (bit this run:
    // UND_ERR_HEADERS_TIMEOUT). Streaming sends headers immediately and each
    // token chunk keeps the body timeout fed.
    const r = await fetch(`${OLLAMA_URL}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, stream: true, options: { temperature: TEMP, num_predict: 512 } }) });
    if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
    let out = '', buf = '';
    const dec = new TextDecoder();
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line) continue;
        try { out += JSON.parse(line).response || ''; } catch {}
      }
    }
    return extractJson(out);
  };
  return async (prompt) => {
    for (let a = 0, backoff = 2000; ; a++) {
      const r = await fetch(`${OPENAI_BASE}/chat/completions`, { method: 'POST',
        headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 800, temperature: TEMP }) });
      if (r.ok) return extractJson((await r.json()).choices?.[0]?.message?.content ?? '');
      if ((r.status === 429 || r.status >= 500) && a < 4) { await new Promise(s => setTimeout(s, backoff)); backoff *= 2; continue; }
      throw new Error(`HTTP ${r.status}`);
    }
  };
}

(async () => {
  const mock = process.argv.includes('--mock');
  console.log(`=== RD-B3: live behavior authoring (${mock ? 'MOCK — deterministic apparatus proof' : 'REAL model'}) ===\n`);
  const callModel = mock ? mockModel() : realModel();

  const control = await runArm(callModel, false);
  const feedback = await runArm(callModel, true);
  const sum = (rows, k) => rows.reduce((a, r) => a + r[k], 0);
  const n = control.length * TRIALS;
  console.log(`\nTOTAL: CONTROL ${sum(control, 'succ')}/${n}   FEEDBACK ${sum(feedback, 'succ')}/${n}   unsafe events: ${sum(control, 'unsafe') + sum(feedback, 'unsafe')} (must be 0)`);

  if (mock) { // deterministic assertions — the apparatus is part of the record
    const okAll = sum(control, 'succ') === 0 && sum(feedback, 'succ') === n &&
      feedback.every(r => r.mean === '2.0') && sum(control, 'unsafe') + sum(feedback, 'unsafe') === 0;
    const label = `control 0/${n}, feedback ${n}/${n}`;
    console.log(okAll ? `\nALL PASS — mock: ${label} @ exactly 2 attempts, zero unsafe`
                      : '\nFAILURES — mock apparatus expectations not met');
    process.exit(okAll ? 0 : 1);
  }
})();
