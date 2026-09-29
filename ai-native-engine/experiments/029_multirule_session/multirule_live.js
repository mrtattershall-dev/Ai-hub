'use strict';
// =============================================================================
// RD-B5: LIVE MULTI-RULE AUTHORING SESSION — the temporal-contract question,
// run against a real model. RD-B3/027 measured one model → one rule → one
// single-tick goal. This measures a model authoring the WHOLE FARMING LOOP —
// several interacting rules toward a GAME-LEVEL goal that no single tick can
// satisfy — and asks the pre-registered H1-vs-H2 question
// (decisions/RD-B5_multirule_session_spec.md):
//
//   H1  per-rule gate + RD-005 fold/defer + RD-B2 invariants already cover
//       composition; the temporal observable is harness SCORING only.
//   H2  composition fails in ways no single-rule gate sees (opposed-fold silent
//       no-op is the pre-registered candidate); the boundary needs a temporal /
//       multi-rule contract form, and fold arbitration between distinct rule
//       actors needs a signal.
//
// This driver COMPOSES the calibrated apparatus (multirule_session.js:
// runSession / checkFarmObservable / classifyOpGrowth) with the model loop
// (mirrors 027_behavior_live.js). The temporal observable is USED AS THE
// FEEDBACK SIGNAL — the H2 contract form earns its keep only if surfacing its
// failing clauses measurably rescues sessions the existing layers left silent.
//
//   MOCK (deterministic, part of the repeatable record):
//       node experiments/029_multirule_session/multirule_live.js --mock
//   REAL (local Ollama or OpenAI-compatible endpoint; Modal launcher =
//         modal_multirule.py):
//       OLLAMA_MODEL=qwen2.5-coder:7b node .../multirule_live.js
//       [SESSIONS=4] [MAX_ATTEMPTS=4] [TICKS=40] [LOOP_TEMP=0.7]
//       [FB_STYLE=echo|errors] [TICK_BUDGET=<n>]
//
// GPU SPEND IS A SEPARATE, EXPLICIT DECISION — this file runs deterministically
// under --mock with zero external calls; the live run is launched by the user.
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const APP = require(path.join(__dirname, 'multirule_session.js'));
const { runSession, checkFarmObservable, classifyOpGrowth,
        ORACLE_RULES, MISSING_LINK_RULES, OPPOSED_FOLD_RULES } = APP;

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const SESSIONS = num(process.env.SESSIONS, 4);       // sessions per arm
const MAX_ATTEMPTS = num(process.env.MAX_ATTEMPTS, 4);
const TICKS = num(process.env.TICKS, 40);            // the loop needs ~40 to show sustain
const TEMP = num(process.env.LOOP_TEMP ?? 0.7, 0.7);
const TICK_BUDGET = process.env.TICK_BUDGET ? num(process.env.TICK_BUDGET, null) : null;
// FB_STYLE per the RD-B3 repair-mode-collapse finding: 'echo' (prior attempt +
// signals) for dense models; 'errors' (signals only, no prior-attempt echo) for
// the Qwen3-MoE collapse case.
const FB_STYLE = process.env.FB_STYLE || 'echo';

// ---- the grammar the model sees (multi-rule envelope over 027's rule shape) --
// CONCISE on purpose (RD-018.1: verbosity backfires on smaller models). The one
// worked clamp example stays — the range proof is the novel demand.
const SESSION_GRAMMAR = [
  'You author a SET of behavior rules for a running farm. Emit ONE JSON object, nothing else:',
  '{"rules":[ <rule>, <rule>, ... ]}',
  'each <rule>:',
  '{"name":"<short>","match":{"type":"crop|zone","where":{"field":"<f>","cmp":"<|<=|==|>=|>|!=","value":<n>}},"every":<optional int>,"effects":[...]}',
  'effects (use what the loop needs):',
  '  {"set":"<field>","to":<expr>}   expr: number | {"field":"<f>"} | {"add":[e,e]} | {"sub":[e,e]} | {"min":[e,e]} | {"max":[e,e]}',
  '  {"delete":true}   |   {"spawn":{"type":"crop","props":{"name":"seed","water":20,"growth":0},"cap":1}}',
  'fields: water,growth are crop (0..255); tally is zone. A rule runs EVERY TICK on EVERY entity of match.type.',
  '"every":<n> runs the rule only every n-th tick (use it to plant periodically from the zone).',
  'A "set" must PROVABLY stay in range: clamp with min/max.',
  '  grow example, +5 clamped to 255: {"set":"growth","to":{"min":[{"add":[{"field":"growth"},5]},255]}}',
  'A "spawn" MUST declare an integer "cap" (max new entities per tick) — bounded growth is required.',
].join('\n');

const GAME_GOAL = [
  'GOAL — make this farm a SELF-SUSTAINING LOOP over many ticks:',
  '  (1) watered crops (water > 0) GROW over time;',
  '  (2) growth is consumed — watered crops also lose 1 water per tick, and crops that hit water 0 stop growing (or wilt);',
  '  (3) fully-grown crops (growth >= 100) are HARVESTED (deleted);',
  '  (4) new crops are periodically PLANTED from the field zone so the field never empties.',
  'The loop must still be running late in the session: crops maturing, being harvested, and being replanted.',
].join('\n');

// ---- balanced-bracket JSON extraction (handles ```/<think>, obj or array) ----
function extractJson(text) {
  text = (text || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/gi, '');
  let start = -1, open = '{', close = '}';
  const oi = text.indexOf('{'), ai = text.indexOf('[');
  if (oi < 0 && ai < 0) return text;
  if (ai >= 0 && (oi < 0 || ai < oi)) { start = ai; open = '['; close = ']'; } else start = oi;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return text.slice(start);
}

// parse the model text into an array of rule objects (or a shape error).
function parseRuleSet(raw) {
  let doc;
  try { doc = JSON.parse(extractJson(raw)); }
  catch (e) { return { ok: false, shapeError: `not JSON: ${String(e.message).slice(0, 80)}` }; }
  let rules = null;
  if (doc && Array.isArray(doc.rules)) rules = doc.rules;            // the asked-for envelope
  else if (Array.isArray(doc)) rules = doc;                          // lenient: a bare array
  else if (doc && typeof doc === 'object' && doc.name && doc.effects) rules = [doc]; // lenient: a single bare rule
  if (!rules) return { ok: false, shapeError: 'expected {"rules":[ <rule>, ... ]} — a JSON object whose "rules" is an array' };
  if (!rules.length) return { ok: false, shapeError: 'the "rules" array is empty — author the loop\'s rules' };
  return { ok: true, rules };
}

// ---- the session scorecard (the RD-B5 spec's per-session columns) ------------
function scoreSession(trace, unsafe, installErrors) {
  const obs = checkFarmObservable(trace, unsafe);
  const growth = classifyOpGrowth(trace);
  const foldArbitrations = trace.reduce((n, t) => n + t.foldArbitrations, 0);
  const rejectedTx = trace.reduce((n, t) => n + t.rejected.length, 0);
  const budgetTrips = trace.reduce((n, t) => n + (t.budgetTrips ?? 0), 0);
  const reaps = trace.reduce((n, t) => n + t.reaps, 0);
  const spawns = trace.reduce((n, t) => n + t.spawns, 0);
  // WHICH gate codes rejected rules at install — so a run can DIAGNOSE a
  // recurring authoring friction (a repeated code across sessions is a grammar
  // gap, the RD-B4 shape) instead of only counting failures. (2026-07-15 run:
  // this was absent, so the Qwen3-MoE's recurring spawn-rule rejection could
  // not be attributed — added for the next run.)
  const rejectCodes = {};
  for (const ie of installErrors) for (const e of ie.errors) rejectCodes[e.code] = (rejectCodes[e.code] ?? 0) + 1;
  return { pass: obs.pass, clauses: obs.clauses, opGrowth: growth.label,
    foldArbitrations, rejectedTx, budgetTrips, reaps, spawns, unsafe,
    installFailures: installErrors.length, rejectCodes };
}

// ---- build the FEEDBACK signal (this IS H2's contract form as a teaching aid)
function buildFeedback(prior, sc, installErrors) {
  const lines = ['Your rule set did not produce a sustained farming loop.'];
  if (installErrors.length) {
    lines.push('These rules were REJECTED by the gate (not installed):');
    for (const ie of installErrors)
      for (const e of ie.errors) lines.push(`  - rule "${ie.rule}": ${e.code}${e.detail ? ' — ' + e.detail : ''}`);
  }
  // the temporal observable's failing clauses — the pre-registered H2 signal
  lines.push(`Goal check over ${TICKS} ticks (each clause is required):`);
  const cl = sc.clauses;
  lines.push(`  crops reached maturity (growth>=100): ${cl.matured ? 'yes' : 'NO'}`);
  lines.push(`  crops were harvested (>=2 deletes):    ${cl.reaped ? `yes (${sc.reaps})` : `NO (${sc.reaps} — nothing is being harvested)`}`);
  lines.push(`  crops were replanted (>=5 spawns):     ${cl.reseeded ? `yes (${sc.spawns})` : `NO (${sc.spawns} — the field is not being restocked)`}`);
  lines.push(`  loop still running at the end:          ${cl.sustained ? 'yes' : 'NO — it stalled or emptied out'}`);
  lines.push(`  no engine-safety violations:            ${cl.safe ? 'yes' : 'NO'}`);
  // composition signals — H2's silent-arbitration candidate, made visible
  if (sc.foldArbitrations > 0)
    lines.push(`Note: ${sc.foldArbitrations} silent fold-arbitration(s) — two rules wrote the SAME field the SAME tick and one was silently overridden (no rejection). If two rules push a field opposite ways, one is being erased every tick.`);
  if (sc.budgetTrips > 0)
    lines.push(`Note: ${sc.budgetTrips} per-tick op-budget rejection(s) — the rules emitted more ops/tick than the budget allows; some did not run.`);
  lines.push('Emit a corrected {"rules":[ ... ]} (JSON only).');
  const body = lines.join('\n');
  return FB_STYLE === 'errors' ? body : `Your previous attempt:\n${prior}\n\n${body}`;
}

// ---- one SESSION: author -> gate -> run -> observe -> (revise) ---------------
// The RULE SET persists/revises across attempts; each attempt evaluates the
// CURRENT full set in a fresh TICKS-tick run (clean temporal measurement, no
// cross-attempt world-state confound — pinned design choice, see header).
async function runOneSession(callModel, { feedback }) {
  let prior = null, fb = null, everUnsafe = 0, best = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let prompt = `${SESSION_GRAMMAR}\n\n${GAME_GOAL}`;
    if (feedback && fb) prompt += `\n\n${fb}`;
    const t0 = Date.now();
    const raw = await callModel(prompt);
    prior = raw;
    const tag = `${feedback ? 'F' : 'C'} a${attempt}`;
    console.log(`    [${tag}] ${((Date.now() - t0) / 1000).toFixed(0)}s`);

    const parsed = parseRuleSet(raw);
    if (!parsed.ok) {                                    // shape error: re-promptable
      console.error(`      [${tag}] SHAPE_ERROR ${parsed.shapeError} :: ${String(raw).replace(/\s+/g, ' ').slice(0, 200)}`);
      const echo = FB_STYLE === 'errors' ? '' : `Your previous attempt:\n${raw}\n\n`;
      fb = `${echo}Your output was not the required shape: ${parsed.shapeError}\nEmit ONE JSON object {"rules":[ <rule>, ... ]} and nothing else.`;
      continue;
    }
    const { trace, installErrors, unsafe } = runSession(
      { rules: parsed.rules, ticks: TICKS, tickOpsBudget: TICK_BUDGET });
    everUnsafe += unsafe;
    const sc = scoreSession(trace, unsafe, installErrors);
    best = sc;
    const codes = Object.keys(sc.rejectCodes).length ? ` rejCodes=${JSON.stringify(sc.rejectCodes)}` : '';
    console.log(`      [${tag}] rules=${parsed.rules.length} installed=${parsed.rules.length - installErrors.length}` +
      ` observable=${sc.pass ? 'PASS' : 'fail'} reaps=${sc.reaps} spawns=${sc.spawns}` +
      ` fold=${sc.foldArbitrations} rej=${sc.rejectedTx} budget=${sc.budgetTrips} ops=${sc.opGrowth} unsafe=${sc.unsafe}${codes}`);
    if (sc.pass) return { success: true, attempts: attempt, unsafe: everUnsafe, score: sc };
    fb = buildFeedback(prior, sc, installErrors);
  }
  return { success: false, attempts: MAX_ATTEMPTS, unsafe: everUnsafe, score: best };
}

async function runArm(callModel, feedback) {
  let succ = 0, att = [], unsafe = 0, fold = 0, rej = 0, budget = 0, growth = {};
  for (let s = 0; s < SESSIONS; s++) {
    console.log(`  ${feedback ? 'FEEDBACK' : 'CONTROL '} session ${s + 1}/${SESSIONS}`);
    const r = await runOneSession(callModel, { feedback });
    if (r.success) { succ++; att.push(r.attempts); }
    unsafe += r.unsafe;
    if (r.score) { fold += r.score.foldArbitrations; rej += r.score.rejectedTx; budget += r.score.budgetTrips;
      growth[r.score.opGrowth] = (growth[r.score.opGrowth] ?? 0) + 1; }
  }
  const mean = att.length ? (att.reduce((a, b) => a + b, 0) / att.length).toFixed(1) : '-';
  console.log(`  => ${feedback ? 'FEEDBACK' : 'CONTROL '} ${succ}/${SESSIONS}  meanAtt ${mean}  unsafe ${unsafe}  foldArb ${fold}  rejTx ${rej}  budgetTrips ${budget}  opGrowth ${JSON.stringify(growth)}`);
  return { succ, mean, unsafe, fold, rej, budget, growth };
}

// ---- MOCK model: proves the apparatus deterministically ---------------------
// The pre-registered near-miss is MISSING-LINK: the loop MINUS the reseed rule.
// It installs cleanly (every rule gate-valid) and is SAFE, but the field is
// never restocked -> the temporal observable fails on `reseeded`+`sustained`
// with ZERO rejections. That is exactly the H1-defense shape: goal missed, but
// a SIGNAL exists (an observable clause), and it lives ONLY in the temporal
// contract, not in any single-rule gate. FEEDBACK surfaces the clause -> the
// mock adds reseed -> the loop sustains. CONTROL never sees it -> repeats the
// near-miss. Expected: control 0/N, feedback N/N at exactly 2 attempts, 0 unsafe.
function mockModel() {
  const asStr = (rules) => JSON.stringify({ rules });
  return async (prompt) => {
    const sawFeedback = /did not produce a sustained/.test(prompt);
    // near-miss until the model is told the loop doesn't sustain; then complete it.
    return sawFeedback ? asStr(ORACLE_RULES) : asStr(MISSING_LINK_RULES);
  };
}

// ---- REAL backends (mirror 027_behavior_live.js conventions) ----------------
function realModel() {
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL;
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
  const OPENAI_BASE = process.env.OPENAI_BASE || 'https://openrouter.ai/api/v1';
  const KEY = process.env.OPENROUTER_API_KEY || (process.env.OPENAI_BASE ? 'EMPTY' : '');
  if (!OLLAMA_MODEL && !KEY) { console.error('set OLLAMA_MODEL (local) or OPENROUTER_API_KEY — or use --mock'); process.exit(1); }
  const MODEL = OLLAMA_MODEL || process.env.OPENROUTER_MODEL;
  console.log(`model=${MODEL}  sessions/arm=${SESSIONS}  maxAttempts=${MAX_ATTEMPTS}  ticks=${TICKS}  temp=${TEMP}  fb=${FB_STYLE}  tickBudget=${TICK_BUDGET ?? 'off'}`);
  if (OLLAMA_MODEL) return async (prompt) => {
    // stream:true is LOAD-BEARING on CPU (027's UND_ERR_HEADERS_TIMEOUT lesson).
    const r = await fetch(`${OLLAMA_URL}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, stream: true, options: { temperature: TEMP, num_predict: 900 } }) });
    if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
    let out = '', buf = ''; const dec = new TextDecoder();
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (line) { try { out += JSON.parse(line).response || ''; } catch {} }
      }
    }
    return extractJson(out);
  };
  return async (prompt) => {
    for (let a = 0, backoff = 2000; ; a++) {
      const r = await fetch(`${OPENAI_BASE}/chat/completions`, { method: 'POST',
        headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 1200, temperature: TEMP }) });
      if (r.ok) return extractJson((await r.json()).choices?.[0]?.message?.content ?? '');
      if ((r.status === 429 || r.status >= 500) && a < 4) { await new Promise(s => setTimeout(s, backoff)); backoff *= 2; continue; }
      throw new Error(`HTTP ${r.status}`);
    }
  };
}

(async () => {
  const mock = process.argv.includes('--mock');
  console.log(`=== RD-B5: live multi-rule authoring session (${mock ? 'MOCK — deterministic apparatus proof' : 'REAL model'}) ===\n`);
  const callModel = mock ? mockModel() : realModel();

  const control = await runArm(callModel, false);
  const feedback = await runArm(callModel, true);
  console.log(`\nTOTAL: CONTROL ${control.succ}/${SESSIONS}  FEEDBACK ${feedback.succ}/${SESSIONS}` +
    `  unsafe ${control.unsafe + feedback.unsafe} (must be 0)`);

  if (mock) {
    let PASS = 0, FAIL = 0;
    const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
    console.log('\n--- deterministic apparatus assertions ---');
    ok(control.succ === 0, `mock CONTROL 0/${SESSIONS} (near-miss repeats without the temporal signal)`);
    ok(feedback.succ === SESSIONS, `mock FEEDBACK ${SESSIONS}/${SESSIONS} (observable clause rescues the loop)`);
    ok(feedback.mean === '2.0', `mock FEEDBACK fixes in exactly 2 attempts (mean ${feedback.mean})`);
    ok(control.unsafe + feedback.unsafe === 0, 'zero unsafe events across every attempt (the gate is unconditional)');

    // the near-miss carries a SIGNAL only the temporal observable emits (H1
    // defense shape) — assert the feedback string names the failing clause and
    // that the near-miss itself was safe with zero rejections.
    const nm = scoreSession(...(() => { const r = runSession({ rules: MISSING_LINK_RULES, ticks: TICKS });
      return [r.trace, r.unsafe, r.installErrors]; })());
    // The near-miss's individual rules all WORK (matured + reaped pass, safe
    // holds, every rule installed) — it is the COMPOSITION that fails: with no
    // reseed the field empties and the loop can't sustain. That failure surfaces
    // ONLY in the temporal observable (reseeded + sustained). The one rejection
    // present is the INCIDENTAL delete-vs-write coupling at the harvest tick
    // (finding #2), which says nothing about the missing reseed — so no
    // per-rule gate signal points at the actual problem. This is the H1-vs-H2
    // crux reproduced through the live path.
    ok(!nm.pass && nm.unsafe === 0 && nm.installFailures === 0
        && nm.clauses.matured && !nm.clauses.reseeded && !nm.clauses.sustained,
      'near-miss (missing reseed): every rule installs + a crop matures (rules work), safe holds, but the loop fails to SUSTAIN — visible only in the temporal observable, not any per-rule gate');
    const fbStr = buildFeedback('<prior>', nm, []);
    ok(/replanted \(>=5 spawns\):\s+NO/.test(fbStr), 'feedback surfaces the exact failing clause (replanted: NO) — the H2 contract form used as the teaching signal');

    // H2's silent-arbitration candidate is CARRIED to the model: run the
    // opposed-fold pair (both gate-valid) and assert the feedback names the
    // silent fold-arbitration with zero rejections/deferrals.
    const of = scoreSession(...(() => { const r = runSession({ rules: OPPOSED_FOLD_RULES, ticks: 12 });
      return [r.trace, r.unsafe, r.installErrors]; })());
    const ofFb = buildFeedback('<prior>', of, []);
    ok(of.foldArbitrations > 0 && of.rejectedTx === 0,
      `opposed-fold: ${of.foldArbitrations} silent fold-arbitrations, 0 rejections (the pre-registered H1 wound reproduced through the live path)`);
    ok(/silent fold-arbitration/.test(ofFb),
      'feedback SURFACES the silent fold-arbitration — testing whether making H2\'s signal visible can rescue a model authoring opposed rules');

    console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
    process.exit(FAIL ? 1 : 0);
  }
})();
