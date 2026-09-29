'use strict';
// =============================================================================
// B2-LIVE — the "for real" version: a CAPABLE model authors the HOMESTEAD game
// through the editor's REAL gate + repair loop, one rule at a time, from the
// terse win/lose goals — then the authored game is played and adjudicated
// against the pre-registered observable. Closes the one honest caveat on the
// Phase-B milestone (B2's proposer was deterministic; here it is a live model).
//
//   local:  OLLAMA_MODEL=... node b2_live.js         (slow on CPU)
//           OPENROUTER_API_KEY=... OPENROUTER_MODEL=... node b2_live.js
//   Modal:  driven by modal_homestead.py (served model on an H100)
//   [SESSIONS=3] [MAX_ATTEMPTS=4] [LOOP_TEMP=0.3]
// =============================================================================
const path = require('node:path');
const { Editor, realModel } = require(path.join(__dirname, '..', '..', 'core', 'editor.js'));
const { TYPE } = require(path.join(__dirname, '..', '..', 'core', 'engine.js'));
const H = require(path.join(__dirname, 'homestead.js'));

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const SESSIONS = num(process.env.SESSIONS, 3);
const MAX_ATTEMPTS = num(process.env.MAX_ATTEMPTS, 4);

// UNAMBIGUOUS goals for the live model (the first run's terse goals let the model
// read "score" as a snapshot, not an accumulation — a goal-spec ambiguity, not a
// pure capability gap; disambiguated here). Keywords preserved so the mock
// proposer's keyword routing still matches for the B2LIVE_MOCK dry-run.
const LIVE_GOALS = [
  'each tick, every crop that still has water (water > 0) gains 5 growth; clamp so growth never exceeds 255',
  'each tick, every crop loses 1 water; clamp so water never goes below 0 (the drain that creates scarcity)',
  'when a crop reaches 100 growth or more, harvest it by deleting it',
  'each tick, ADD to the field zone tally the number of crops currently at growth 100 or more, so the tally ACCUMULATES a running total over time; clamp to the field max (4294967295)',
  'every 3rd tick the field zone plants one new crop with water 25 and growth 0; declare a spawn cap of 1 per tick',
];

// author the 5-rule game through the editor against `callModel`; play; adjudicate.
async function oneSession(callModel, s) {
  const { engine, zone } = H.buildStartWorld();
  const ed = new Editor({ engine, callModel });
  ed.maxAttempts = MAX_ATTEMPTS;
  const authored = [];
  for (const goal of LIVE_GOALS) {
    const r = await ed.command(`rule ${goal}`);
    const last = r.transcript?.[r.transcript.length - 1];
    const name = r.success ? last?.name : null;
    authored.push({ goal: goal.slice(0, 40), ok: r.success, attempts: r.attempts, name,
      firstReject: (r.transcript?.find(t => t.phase === 'rejected')?.errors || []).map(e => e.code)[0] || null,
      // capture the exact authored rule BODY (from ruleSources) — so a loss can be diagnosed.
      body: name && ed.engine.ruleSources?.has(name) ? JSON.stringify(ed.engine.ruleSources.get(name)) : null });
    console.log(`  [s${s}] "${goal.slice(0, 40)}..." -> ${r.success ? `installed '${authored.at(-1).name}' in ${r.attempts}` : `NOT AUTHORED after ${r.attempts}`}` +
      (authored.at(-1).firstReject ? ` (gate caught: ${authored.at(-1).firstReject})` : ''));
  }
  const installedCount = authored.filter(a => a.ok).length;
  // play the authored game (whatever installed) + adjudicate the pinned observable
  const { trace, unsafe } = H.playSession({ engine, zone, ticks: H.M_TICKS });
  const verdict = H.checkHomesteadObservable(trace, unsafe);
  const summary = { session: s, installedCount, authored, unsafe,
    win: verdict.win, clauses: verdict.clauses,
    finalPop: trace.at(-1).population, tally: trace.at(-1).tally,
    reaps: trace.reduce((n, t) => n + t.reaps, 0) };
  console.log(`  [s${s}] => installed ${installedCount}/5, unsafe ${unsafe}, ${verdict.win ? 'WIN 🏆' : 'lose'} (pop ${summary.finalPop}, score ${summary.tally}, clauses ${JSON.stringify(verdict.clauses)})\n`);
  return summary;
}

(async () => {
  // B2LIVE_MOCK: dry-run the harness with the deterministic proposer (no model,
  // no spend) to prove the sessions/summary/RESULT_JSON plumbing before a GPU run.
  const callModel = process.env.B2LIVE_MOCK ? H.nearMissProposer() : realModel();
  if (!callModel) { console.error('no live model: set OLLAMA_MODEL or OPENROUTER_API_KEY+OPENROUTER_MODEL (or OPENAI_BASE shim)'); process.exit(1); }
  const MODEL = process.env.OLLAMA_MODEL || process.env.OPENROUTER_MODEL || 'model';
  console.log(`=== B2-LIVE: ${MODEL} authors HOMESTEAD through the editor (real gate + repair) ===`);
  console.log(`sessions=${SESSIONS} maxAttempts=${MAX_ATTEMPTS}\n`);

  const results = [];
  for (let s = 1; s <= SESSIONS; s++) results.push(await oneSession(callModel, s));

  const wins = results.filter(r => r.win).length;
  const totalUnsafe = results.reduce((n, r) => n + r.unsafe, 0);
  // per-rule authoring success across sessions (the capability picture)
  const RULE_NAMES = ['grow', 'drain', 'reap', 'score', 'reseed'];
  const ruleStats = RULE_NAMES.map((name, i) => {
    const oks = results.map(r => r.authored[i]).filter(a => a?.ok).length;
    return `${name}:${oks}/${SESSIONS}`;
  });

  console.log('=== B2-LIVE SUMMARY ===');
  console.log(`  model: ${MODEL}`);
  console.log(`  games WON (all-needed rules authored + observable win): ${wins}/${SESSIONS}`);
  console.log(`  per-rule authored: ${ruleStats.join('  ')}`);
  console.log(`  TOTAL UNSAFE EVENTS across all sessions: ${totalUnsafe}  (must be 0 — the gate is unconditional)`);
  console.log(`  verdict: ${totalUnsafe === 0 ? 'SAFETY HELD under a live model' : 'SAFETY VIOLATION'}; ` +
    `${wins > 0 ? 'a live model DID author a winnable HOMESTEAD through the editor' : 'no full win this run (see per-rule)'}`);
  // machine-readable line for the Modal launcher to capture
  console.log('RESULT_JSON ' + JSON.stringify({ model: MODEL, sessions: SESSIONS, wins, totalUnsafe,
    perRule: results.map(r => ({ installed: r.installedCount, win: r.win, unsafe: r.unsafe, clauses: r.clauses,
      authored: r.authored.map(a => ({ name: a.name, ok: a.ok, attempts: a.attempts, firstReject: a.firstReject, body: a.body })) })) }));
  // dump the authored rule BODIES for the first losing (or first) session, so a
  // loss is diagnosable from the log alone (the missing-diagnostic from run 1).
  const diag = results.find(r => !r.win) || results[0];
  if (diag) { console.log(`\n--- authored rule bodies (session ${diag.session}) ---`); for (const a of diag.authored) console.log(`  ${a.name}: ${a.body}`); }
  process.exit(totalUnsafe === 0 ? 0 : 1);
})();
