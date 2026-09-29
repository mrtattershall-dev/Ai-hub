'use strict';
// =============================================================================
// RD-036 bar 2 — the LIVE 32B authors a platformer rule through the REAL gate.
// A fourth genre, and this time the model has never seen it. We hand it the
// platformer world with 4 of 5 rules installed and ask, in plain English, for
// GRAVITY. Success = the model's JSON passes the RD-B6 gate (validate-before-
// execute), installs, and the world then actually FALLS. Also validates today's
// RD-035 change: writeSmells on the model-authored rule (the propose pipeline).
//
// House rule (STATE.md): capture the FULL transcript — every raw draft + reject
// code — to results.jsonl, not just the verdict.
//   MODEL is the deployed 32B endpoint (engine-editor-llm). Cold start ~1 min.
//   node experiments/046_platformer/live_author_gravity.js
// =============================================================================
const path = require('node:path');
const fs = require('node:fs');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { installRule, writeSmells } = CORE('behavior.js');
const { runRuleLoop } = CORE('editor.js');
const R = require(path.join(__dirname, 'platformer_rules.js'));

const ENDPOINT = process.env.MODEL_ENDPOINT || 'https://mr-tattershall--editor-llm.modal.run';
const KEY = process.env.MODEL_KEY || 'engine-editor-2026';
const MODEL = process.env.MODEL_NAME || 'Qwen/Qwen2.5-Coder-32B-Instruct';

// same extraction m1_server.makeCallModel uses: strip <think>/fences, take the JSON.
async function callModel(prompt) {
  const r = await fetch(ENDPOINT, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 600 }) });
  if (!r.ok) throw new Error(`endpoint ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const t = (await r.json()).choices?.[0]?.message?.content ?? '';
  const s = t.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/gi, '');
  const i = s.indexOf('{');
  return i < 0 ? s : s.slice(i, s.lastIndexOf('}') + 1 || undefined);
}

(async () => {
  // build the world with EVERYTHING EXCEPT gravity — the model must supply it.
  const { g, T } = R.buildWorld();
  for (const rule of R.RULE_SET) if (rule.name !== 'gravity') {
    const res = installRule(g, rule);
    if (!res.ok) throw new Error(`fixture rule ${rule.name}: ${JSON.stringify(res.errors)}`);
  }
  g.spawn(T.player, { name: 'hero', x: 128, y: 40 });
  g.spawn(T.platform, { name: 'ground', x: 128, y: 200 });

  const goal = 'Make the player fall. While the player is NOT on the ground (on_ground is 0), '
    + 'its downward speed vy should increase by 1 each tick, up to a maximum of 8.';

  console.log(`=== RD-036 bar 2: live 32B authors GRAVITY into the platformer ===`);
  console.log(`endpoint: ${ENDPOINT}\ngoal: ${goal}\n`);
  const t0 = Date.now();
  const r = await runRuleLoop(g, callModel, { goal, rootUuid: null, maxAttempts: 4 });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);

  // house rule: persist the full transcript
  fs.writeFileSync(path.join(__dirname, 'results.jsonl'),
    JSON.stringify({ at: new Date().toISOString(), goal, success: r.success, attempts: r.attempts, transcript: r.transcript }) + '\n');

  console.log(`\n--- result after ${r.attempts} attempt(s), ${secs}s ---`);
  for (const a of r.transcript) {
    console.log(`  attempt ${a.attempt}: ${a.phase}${a.name ? ` '${a.name}'` : ''}`);
    if (a.phase === 'rejected') console.log(`     reject: ${(a.errors || []).map((e) => `[${e.where}] ${e.code}`).join(', ')}`);
    console.log(`     raw: ${String(a.raw).replace(/\s+/g, ' ').slice(0, 220)}`);
  }

  let PASS = 0, FAIL = 0;
  const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
  console.log('');
  ok(r.success, `the live 32B authored a rule that PASSED the gate (validate-before-execute) in ${r.attempts} attempt(s)`);
  if (r.success) {
    const src = g.ruleSources.get(r.name);
    const warns = writeSmells(g, src);
    console.log(`  authored rule '${r.name}': ${JSON.stringify(src.match)} -> ${JSON.stringify(src.effects)}`);
    console.log(`  RD-035 advisory on the model's rule: ${warns.length ? warns.map((w) => w.code).join(',') : 'none'}`);
    // does the world now actually FALL? drop the hero, tick, watch y increase.
    const v0 = g._systemView(); const hero = v0.allOfType('player').find((u) => v0.nameOf(u) === 'hero');
    const y0 = v0.field(hero, 'y');
    let unsafe = 0;
    for (let t = 0; t < 10; t++) { g.stepTick(); if (!g.indexesConsistent()) unsafe++; }
    const y1 = g._systemView().field(hero, 'y');
    ok(y1 > y0, `the world now FALLS under the model's gravity (y ${y0} → ${y1} over 10 ticks)`);
    ok(unsafe === 0, `zero unsafe events while the model-authored rule ran (${unsafe})`);
  } else {
    console.log('  (the gate refused every draft — world untouched; transcript saved for diagnosis)');
  }
  console.log(`\n${FAIL ? 'INCOMPLETE' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed. Full transcript -> results.jsonl`);
  process.exit(FAIL ? 1 : 0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
