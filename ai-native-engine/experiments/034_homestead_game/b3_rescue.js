'use strict';
// =============================================================================
// TRACK 3 (RD-B5 rescue, harder goal) + RD-B8 in-loop — does the temporal
// OBSERVABLE-as-feedback measurably rescue a capable model on a goal hard enough
// to be OFF ceiling? The score rule now requires the RD-B7 scoped SUM (the
// hardest single rule), so the dense model is not at 100% baseline.
//
//   ARMS (session-level rescue, up to ROUNDS rounds):
//     control  — on a lost session, re-author BLIND (no observable feedback)
//     feedback — on a lost session, re-author WITH the failing observable clauses
//   Per-rule authoring always runs through the RD-B8 collapse-aware repair loop
//   (degrades to normal feedback repair when no collapse occurs).
//
//   local dry-run (no model): B3_MOCK=1 node b3_rescue.js
//   Modal: driven by modal_rescue.py (served model; ARM + MODEL via env)
//   [SESSIONS=3] [ROUNDS=2] [ARM=control|feedback]
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Editor, buildRulePrompt } = CORE('editor.js');
const { parseRule, installRule } = CORE('behavior.js');
const { collapseAwareRepair } = CORE('repair.js');
const H = require(path.join(__dirname, 'homestead.js'));

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const SESSIONS = num(process.env.SESSIONS, 3);
const ROUNDS = num(process.env.ROUNDS, 2);
const ARM = process.env.ARM || 'feedback';
const FB_MODE = process.env.FB_MODE || 'full';   // full | names (follow-up B)

// the 5 authoring goals; score REQUIRES the scoped sum (the hard, off-ceiling one)
const HARD_GOALS = [
  { key: 'grow', text: 'each tick, every crop that still has water (water > 0) gains 5 growth; clamp so growth never exceeds 255' },
  { key: 'drain', text: 'each tick, every crop loses 1 water; clamp so water never goes below 0' },
  { key: 'reap', text: 'when a crop reaches 100 growth or more, harvest it by deleting it' },
  { key: 'score', text: 'each tick, ADD to the field zone tally the SUM of growth over the zone\'s OWN child crops that are ready (growth >= 100) — use "of":"children" and a "sum", accumulating a running total; clamp to the field max 4294967295' },
  { key: 'reseed', text: 'every 3rd tick the field zone plants one new crop with water 25 and growth 0; declare a spawn cap of 1 per tick' },
];

// author ONE rule via the RD-B8 collapse-aware loop; register on success.
async function authorRule(engine, zone, callModel, goalText, banner) {
  const gate = (raw) => { const p = parseRule(engine, raw); return p.ok ? { ok: true } : { ok: false, errors: p.errors }; };
  const build = ({ priorRaw, priorErrors, resample }) => buildRulePrompt(engine,
    { goal: banner + goalText, rootUuid: zone, radius: 2,
      priorErrors: resample ? null : priorErrors, priorRaw: resample ? null : priorRaw });
  const r = await collapseAwareRepair({ callModel, buildPrompt: build, gate, maxAttempts: 4 });
  if (!r.success) return { ok: false, collapse: r.collapseDetected, attempts: r.attempts };
  // gate passed (parse valid) — now actually REGISTER; installRule can still
  // reject (e.g. duplicate name). Report the REAL install outcome, not the parse.
  const ins = installRule(engine, r.transcript[r.transcript.length - 1].raw);
  return { ok: ins.ok, collapse: r.collapseDetected, attempts: r.attempts, installError: ins.ok ? null : ins.errors?.[0]?.code };
}

// one rescue SESSION: author -> play -> adjudicate; on loss, retry with (feedback)
// the failing observable clauses in a banner, or (control) blind, up to ROUNDS.
async function runRescueSession(callModel) {
  let unsafeTotal = 0, banner = '', lastClauses = null, collapseSeen = false;
  for (let round = 1; round <= ROUNDS; round++) {
    const { engine, zone } = H.buildStartWorld();
    const ed = new Editor({ engine, callModel });        // editor holds the world we author into
    let installed = 0;
    for (const g of HARD_GOALS) {
      const a = await authorRule(ed.engine, zone, callModel, g.text, banner);
      if (a.ok) installed++;
      if (a.collapse) collapseSeen = true;
    }
    const { trace, unsafe } = H.playSession({ engine: ed.engine, zone, ticks: H.M_TICKS });
    unsafeTotal += unsafe;
    const v = H.checkHomesteadObservableHard(trace, unsafe);
    lastClauses = v.clauses;
    console.log(`      round ${round}: installed ${installed}/5, ${v.win ? 'WIN' : 'lose'} (tally ${trace.at(-1).tally}, clauses ${JSON.stringify(v.clauses)})`);
    if (v.win) return { win: true, rounds: round, unsafe: unsafeTotal, collapseSeen };
    // build next-round banner. FB_MODE (follow-up B): "full" re-states the
    // target; "names" gives ONLY the failing clause names — isolating the
    // observable's DETECTION value from goal RE-SPECIFICATION.
    const failing = Object.entries(v.clauses).filter(([, ok]) => !ok).map(([k]) => k);
    banner = ARM !== 'feedback' ? ''   // control: blind retry
      : FB_MODE === 'names'
        ? `NOTE: your previous rule-set LOST the game. Failing win conditions: ${failing.join(', ')}. Re-author the rules so every condition passes.\n`
        : `NOTE: your previous rule-set LOST the game. Failing win conditions: ${failing.join(', ')}. The farm must stay alive, keep >=3 crops late, harvest >=4 times, and accumulate tally >= 300 (sum of ready crops' growth). Re-author the rules to satisfy these.\n`;
  }
  return { win: false, rounds: ROUNDS, unsafe: unsafeTotal, collapseSeen, clauses: lastClauses };
}

// temp-aware model: honors ctx.temperature per call (RD-B8 raises it on collapse).
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
        body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }],
          max_tokens: 700, temperature: ctx.temperature ?? 0.3 }) });   // <- per-call temp
      if (r.ok) return extract((await r.json()).choices?.[0]?.message?.content ?? '');
      if ((r.status === 429 || r.status >= 500) && a < 4) { await new Promise(s => setTimeout(s, backoff)); backoff *= 2; continue; }
      throw new Error(`HTTP ${r.status}`);
    }
  };
}

(async () => {
  const callModel = process.env.B3_MOCK ? hardMock() : tempAwareModel();
  if (!callModel) { console.error('no model: B3_MOCK=1 or OPENROUTER_API_KEY+OPENROUTER_MODEL / OPENAI_BASE'); process.exit(1); }
  const MODEL = process.env.OLLAMA_MODEL || process.env.OPENROUTER_MODEL || 'mock';
  console.log(`=== TRACK 3 rescue: ${MODEL} arm=${ARM} fb_mode=${FB_MODE} sessions=${SESSIONS} rounds=${ROUNDS} (hard scoped-sum score) ===\n`);

  const results = [];
  for (let s = 1; s <= SESSIONS; s++) { console.log(`  session ${s}/${SESSIONS} [${ARM}]`); results.push(await runRescueSession(callModel)); }

  const wins = results.filter(r => r.win).length;
  const rescued = results.filter(r => r.win && r.rounds > 1).length;   // won only after a retry
  const unsafe = results.reduce((n, r) => n + r.unsafe, 0);
  const collapse = results.filter(r => r.collapseSeen).length;
  console.log(`\n=== SUMMARY (arm=${ARM}) ===`);
  console.log(`  wins: ${wins}/${SESSIONS}  (rescued-by-retry: ${rescued})  unsafe: ${unsafe}  sessions-with-collapse: ${collapse}`);
  console.log('RESULT_JSON ' + JSON.stringify({ model: MODEL, arm: ARM, fbMode: FB_MODE, sessions: SESSIONS, rounds: ROUNDS,
    wins, rescued, unsafe, collapse, perSession: results }));
  process.exit(unsafe === 0 ? 0 : 1);
})();

// deterministic mock: emits the HARD oracle rules (incl. scoped-sum score); to
// exercise rescue, it emits a losing (count-based, snapshot) score UNTIL the
// banner mentions "sum of ready", then the correct scoped-sum score.
function hardMock() {
  const oracle = {}; for (const r of H.oracleRulesHard()) oracle[r.name] = JSON.stringify(r);
  return async (prompt) => {
    // route on SPECIFIC goal phrases (the rescue banner also mentions "harvest",
    // "sum of ready crops" etc., so match phrases unique to each actual goal).
    const p = prompt.toLowerCase();
    const gotBanner = /previous rule-set lost/.test(p);
    if (/gains 5 growth/.test(p)) return oracle.grow;
    if (/loses 1 water/.test(p)) return oracle.drain;
    if (/reaches 100 growth or more/.test(p)) return oracle.reap;
    if (/plants one new crop/.test(p)) return oracle.reseed;
    if (/add to the field zone tally the sum/.test(p)) return gotBanner
      ? oracle.score                                   // correct scoped-sum after feedback
      : '{"name":"score","match":{"type":"zone"},"effects":[{"set":"tally","to":{"count":{"type":"crop","where":{"field":"growth","cmp":">=","value":100}}}}]}'; // snapshot count -> loses hard
    return '{}';
  };
}
