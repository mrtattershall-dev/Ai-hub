'use strict';
// =============================================================================
// LIVE-MODEL LOOP — REAL measurement. Spine #10 / RD-014 / RD-018 quality Q:
//   Does handing a weak model its own LOCALIZED validator errors make its next
//   proposal better than blind retry?
//
// Stochastic + network (NOT part of the deterministic test suite). Reads the
// model key ONLY from env — never hardcoded, never written to a file.
//   OPENROUTER_API_KEY=...  [OPENROUTER_MODEL=meta-llama/llama-3.2-1b-instruct]
//   [TRIALS=3] [MAX_ATTEMPTS=5] [TEMP=0.7]  node core/live_loop_real.js
//
// Two arms, same model / goals / budget / temperature; the ONLY difference is
// whether the re-prompt includes the localized errors (feedback) or not
// (control). We count success rate and mean attempts-to-success. That delta is
// the answer.
// =============================================================================
const { Engine, TYPE } = require('./engine.js');
const { runProposalLoop } = require('./live_loop.js');

// Backend: local Ollama (OLLAMA_MODEL set) OR OpenRouter (OPENROUTER_API_KEY).
// Local Ollama is free, uncapped, and needs no tunnel — the harness runs on the
// same machine as the server.
const OLLAMA_MODEL = process.env.OLLAMA_MODEL;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
// OpenAI-compatible base: OpenRouter by default, but override to point at any
// OpenAI-compatible server (e.g. a local vLLM at http://localhost:8000/v1).
const OPENAI_BASE = process.env.OPENAI_BASE || 'https://openrouter.ai/api/v1';
const KEY = process.env.OPENROUTER_API_KEY || (process.env.OPENAI_BASE ? 'EMPTY' : '');
if (!OLLAMA_MODEL && !KEY) { console.error('set OLLAMA_MODEL (local), OPENAI_BASE (vLLM), or OPENROUTER_API_KEY'); process.exit(1); }
const MODEL = OLLAMA_MODEL || process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-1b-instruct';
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const TRIALS = num(process.env.TRIALS, 3);
const MAX_ATTEMPTS = num(process.env.MAX_ATTEMPTS, 5);
const TEMP = num(process.env.LOOP_TEMP ?? process.env.TEMP, 0.7); // LOOP_TEMP: %TEMP% is reserved on Windows

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Robust JSON extraction: strip <think> and ```fences```, then return the first
// BALANCED {...} object (string-aware). Beats a greedy regex, which grabs the
// wrong closing brace when a model omits the outer one. Unbalanced -> returned
// as-is so it surfaces as a real not_json error, not a silent mangle.
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

async function ollama(prompt) {
  const r = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: TEMP, num_predict: 512 } }),
  });
  if (!r.ok) throw new Error(`Ollama HTTP ${r.status}: ${(await r.text()).slice(0,200)}`);
  const j = await r.json();
  // strip any <think>...</think> a reasoning model emits, then pull the JSON.
  return extractJson((j.response || '').replace(/<think>[\s\S]*?<\/think>/g, ''));
}
const callModel = OLLAMA_MODEL ? ollama : openrouter;
async function openrouter(prompt) {
  // retry transient 429/5xx with exponential backoff so rate-limits don't
  // silently corrupt the measurement as failed trials. A persistent 429 (daily
  // free cap) still throws after the retries — surfaced, not counted as a model miss.
  for (let attempt = 0, backoff = 2000; ; attempt++) {
    const r = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 800, temperature: TEMP }),
    });
    if (r.ok) {
      const j = await r.json();
      return extractJson(j.choices?.[0]?.message?.content ?? '');
    }
    const body = (await r.text()).slice(0, 200);
    if ((r.status === 429 || r.status >= 500) && attempt < 4) { await sleep(backoff); backoff *= 2; continue; }
    throw new Error(`HTTP ${r.status}: ${body}`);
  }
}

// A battery of machine-checkable goals. Each builds a fresh world and states a
// goal the grammar can satisfy; success = the engine commits a proposal.
function goals() {
  return [
    { name: 'setfield-range', build: () => { const g = new Engine(32); const z = g.spawn(TYPE.ZONE,{name:'field'}).uuid; const c = g.spawn(TYPE.CROP,{name:'Wheat',parent:z,growth:100,water:0}).uuid; return { g, root:z, goal:`Set the "water" of the crop (uuid ${c}) to a value of at most 80.` }; } },
    { name: 'delete',         build: () => { const g = new Engine(32); const z = g.spawn(TYPE.ZONE,{name:'field'}).uuid; const c = g.spawn(TYPE.CROP,{name:'Weed',parent:z}).uuid; return { g, root:z, goal:`Delete the crop with uuid ${c}.` }; } },
    { name: 'createChild',    build: () => { const g = new Engine(32); const z = g.spawn(TYPE.ZONE,{name:'field'}).uuid; return { g, root:z, goal:`Create a new crop as a child of the zone (uuid ${z}), named "Sprout".` }; } },
    { name: 'setfield-growth',build: () => { const g = new Engine(32); const z = g.spawn(TYPE.ZONE,{name:'field'}).uuid; const c = g.spawn(TYPE.CROP,{name:'Corn',parent:z,growth:10,water:0}).uuid; return { g, root:z, goal:`Set the "growth" of crop ${c} to 100.` }; } },
  ];
}

async function arm(feedback) {
  const perGoal = [];
  for (const spec of goals()) {
    let successes = 0, attemptsOnSuccess = [];
    for (let t = 0; t < TRIALS; t++) {
      const { g, root, goal } = spec.build();
      let rec;
      try { rec = await runProposalLoop(g, callModel, { goal, rootUuid: root, maxAttempts: MAX_ATTEMPTS, feedback }); }
      catch (e) { console.error(`  ! ${spec.name} trial ${t}: ${e.message}`); continue; }
      if (rec.success) { successes++; attemptsOnSuccess.push(rec.attempts); }
    }
    const mean = attemptsOnSuccess.length ? (attemptsOnSuccess.reduce((a,b)=>a+b,0)/attemptsOnSuccess.length).toFixed(1) : '-';
    perGoal.push({ name: spec.name, successes, trials: TRIALS, meanAttempts: mean });
  }
  return perGoal;
}

(async () => {
  console.log(`=== live-model loop REAL measurement ===`);
  console.log(`model=${MODEL}  trials/goal=${TRIALS}  maxAttempts=${MAX_ATTEMPTS}  temp=${TEMP}\n`);

  console.log('running CONTROL arm (no error feedback)...');
  const control = await arm(false);
  console.log('running FEEDBACK arm (localized errors re-prompted)...\n');
  const feedback = await arm(true);

  const totals = { c: {s:0,n:0}, f: {s:0,n:0} };
  console.log('goal               | CONTROL succ  meanAtt | FEEDBACK succ  meanAtt');
  console.log('-------------------|-----------------------|-----------------------');
  for (let i = 0; i < control.length; i++) {
    const c = control[i], f = feedback[i];
    totals.c.s += c.successes; totals.c.n += c.trials; totals.f.s += f.successes; totals.f.n += f.trials;
    console.log(`${c.name.padEnd(18)} | ${String(c.successes+'/'+c.trials).padEnd(6)} ${String(c.meanAttempts).padEnd(13)} | ${String(f.successes+'/'+f.trials).padEnd(6)} ${f.meanAttempts}`);
  }
  console.log('-------------------|-----------------------|-----------------------');
  const cr = (totals.c.s/totals.c.n*100).toFixed(0), fr = (totals.f.s/totals.f.n*100).toFixed(0);
  console.log(`TOTAL success rate | CONTROL ${cr}%  (${totals.c.s}/${totals.c.n})   | FEEDBACK ${fr}%  (${totals.f.s}/${totals.f.n})`);
  console.log(`\nREADING: FEEDBACK - CONTROL = ${fr - cr} points. If markedly positive, localized`);
  console.log(`validator errors measurably help this weak model; if ~0, the model ignores them.`);
})();
