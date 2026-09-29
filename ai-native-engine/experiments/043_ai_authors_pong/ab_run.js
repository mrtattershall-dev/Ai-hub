'use strict';
// =============================================================================
// RD-029 — can a live model author a NON-FARM game's behavior, and does RD-028
// (signed fields + mul) measurably help it? Same model, same goals, same
// gate+repair loop; the ONLY difference between arms is the schema:
//   arm A  unsigned ranges (pre-RD-028): velocity must be OFFSET-encoded
//   arm B  signed ranges + mul available (post-RD-028): say what you mean
// Goals are plain English with NO JSON and NO encoding hints — the point is
// whether the model can find its own way there.
//
// HOUSE RULE: every raw proposal + reject code from both arms is written to
// artifacts.json. A GPU run that cannot be replayed for free is a wasted run.
//
// Remote model ONLY (never local — pinned laptop rule):
//   MODEL_ENDPOINT=https://mr-tattershall--editor-llm.modal.run \
//   MODEL_NAME=Qwen/Qwen2.5-Coder-32B-Instruct MODEL_KEY=... node ab_run.js
// =============================================================================
const fs = require('node:fs');
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { runRuleLoop } = CORE('editor.js');
const { installRule } = CORE('behavior.js');

const ENDPOINT = process.env.MODEL_ENDPOINT, MODEL = process.env.MODEL_NAME, KEY = process.env.MODEL_KEY;
if (!ENDPOINT || !MODEL) { console.error('set MODEL_ENDPOINT + MODEL_NAME (remote only — never local)'); process.exit(2); }

async function callModel(prompt) {
  const r = await fetch(ENDPOINT, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}) },
    body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 700 }) });
  if (!r.ok) throw new Error(`endpoint ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const t = (await r.json()).choices?.[0]?.message?.content ?? '';
  const s = t.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/gi, '');
  const i = s.indexOf('{');
  return i < 0 ? s : s.slice(i, s.lastIndexOf('}') + 1 || undefined);
}

// ---- the two worlds (identical except for the encoding the schema forces) -----
function armA() {                                    // unsigned: offset encoding forced
  const g = new Engine(64);
  g.defineType({ name: 'paddle', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, 255], init: 0 }, y: { range: [0, 255], init: 128 },
    input_dir: { range: [0, 2], init: 0 }, score: { range: [0, 255], init: 0 } } });
  g.defineType({ name: 'ball', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, 255], init: 128 }, y: { range: [0, 255], init: 128 },
    vx: { range: [0, 255], init: 131 }, vy: { range: [0, 255], init: 128 } } });
  return g;
}
function armB() {                                    // signed + mul: say what you mean
  const g = new Engine(64);
  g.defineType({ name: 'paddle', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, 255], init: 0 }, y: { range: [0, 255], init: 128 },
    input_dir: { range: [-1, 1], init: 0 }, score: { range: [0, 255], init: 0 } } });
  g.defineType({ name: 'ball', spatial: { x: 'x', y: 'y' }, fields: {
    x: { range: [0, 255], init: 128 }, y: { range: [0, 255], init: 128 },
    vx: { range: [-8, 8], init: 3 }, vy: { range: [-8, 8], init: 0 } } });
  return g;
}
const seed = (g) => {
  const T = g.w.schema.TYPE;
  g.spawn(T.PADDLE, { name: 'left', x: 8, y: 128 });
  g.spawn(T.BALL, { name: 'ball', x: 128, y: 128 });
  return g.w.uuid[0];
};

// ---- goals: plain English. NO json, NO encoding hints, NO grammar coaching. ---
const GOALS = [
  { key: 'paddle_input',
    goal: "Move each paddle according to the player's held input: input_dir says which way the player is pushing. The paddle must never leave the field (y stays between 0 and 255)." },
  { key: 'ball_move',
    goal: 'Each tick, move the ball horizontally by its horizontal velocity vx. The ball must stay inside the field (x between 0 and 255).' },
  { key: 'wall_bounce',
    goal: 'When the ball reaches the top of the field (y is 0 or less), reverse its vertical velocity vy so it travels back down.' },
  { key: 'paddle_bounce',
    goal: 'When a paddle is within 14 units of the ball and the ball is travelling toward it, reverse the ball horizontal velocity vx so it bounces back.' },
  { key: 'scoring',
    goal: 'Give a paddle one point every tick that a ball is in the goal behind the other side (a ball with x of 2 or less). Score must never exceed 255.' },
];

(async () => {
  const artifacts = { model: MODEL, at: new Date().toISOString(), arms: {} };
  for (const [armName, build] of [['A_unsigned', armA], ['B_signed_mul', armB]]) {
    const results = [];
    console.log(`\n===== ARM ${armName} =====`);
    for (const G of GOALS) {
      const g = build(); const root = seed(g);
      let out;
      try { out = await runRuleLoop(g, callModel, { goal: G.goal, rootUuid: root, radius: 2, maxAttempts: 4 }); }
      catch (e) { out = { success: false, attempts: 0, transcript: [{ phase: 'error', raw: String(e.message) }] }; }
      const src = out.success ? g.ruleSources.get(out.name) : null;
      results.push({ key: G.key, goal: G.goal, success: out.success, attempts: out.attempts,
        rule: src ?? null, transcript: out.transcript });
      console.log(`  ${G.key.padEnd(15)} ${out.success ? `GATED OK in ${out.attempts} attempt(s)` : `REFUSED after ${out.attempts}`}`
        + (src ? `\n      ${JSON.stringify(src)}` : ''));
    }
    artifacts.arms[armName] = results;
  }
  fs.writeFileSync(path.join(__dirname, 'artifacts.json'), JSON.stringify(artifacts, null, 1));
  const tally = (a) => artifacts.arms[a].filter((r) => r.success).length;
  const att = (a) => artifacts.arms[a].reduce((s, r) => s + r.attempts, 0);
  console.log(`\n===== GATE-PASS TALLY (gated != correct — behavior is scored separately) =====`);
  console.log(`  A unsigned    : ${tally('A_unsigned')}/${GOALS.length} goals, ${att('A_unsigned')} total attempts`);
  console.log(`  B signed+mul  : ${tally('B_signed_mul')}/${GOALS.length} goals, ${att('B_signed_mul')} total attempts`);
  console.log(`artifacts -> experiments/043_ai_authors_pong/artifacts.json`);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
