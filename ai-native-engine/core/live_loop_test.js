'use strict';
// =============================================================================
// LIVE-MODEL LOOP — harness proof + measurement scaffold. Spine #10 quality Q.
//
// HONEST SCOPE: this proves the harness end-to-end (propose → validate → repair
// → commit) and that the feedback-vs-control METRIC is well-defined and computed
// — using a deterministic MOCK model. The mock ENCODES the hypothesis under test
// (a model corrects the specific localized errors it is shown). It therefore
// CANNOT prove real models benefit; it proves the apparatus that will. Swap in a
// real local model (USE_REAL_MODEL=1, see live_loop.js WIRING) to get the real
// number. `node core/live_loop_test.js`
// =============================================================================
const { Engine, TYPE } = require('./engine.js');
const { runProposalLoop } = require('./live_loop.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

function makeWorld() {
  const g = new Engine(32);
  const zone = g.spawn(TYPE.ZONE, { name: 'field' }).uuid;
  const c1 = g.spawn(TYPE.CROP, { name: 'Wheat', parent: zone, growth: 100, water: 0 }).uuid;
  return { g, zone, c1 };
}

// --- MOCK model: naive first guess = wrong field ('moisture') AND over-cap
// value (100). It corrects a mistake ONLY when the prompt shows that mistake's
// localized error. This is a *behavioral assumption* — exactly what a real model
// either honours or doesn't. Deterministic, no RNG.
function mockModel(c1) {
  return (prompt) => {
    // start from the prior attempt if the prompt shows it (grounded repair),
    // else the naive first guess: wrong field + over-cap value.
    let field = 'moisture', value = 100;
    const m = prompt.match(/previous attempt[^\n]*\n(\{.*\})/i); // priorRaw is one line; greedy to its last brace
    if (m) { try { const prev = JSON.parse(m[1]); field = prev.ops[0].field; value = prev.ops[0].value; } catch {} }
    if (/unknown_field/.test(prompt)) field = 'water';                          // fix the shown error
    if (/assert failed|engine_rejected|out_of_range/.test(prompt)) value = 80;  // fix the shown error
    return JSON.stringify({ actor: 'ai',
      ops: [{ op: 'setfield', target: c1, field, value }],
      asserts: [{ target: c1, field: 'water', cmp: '<=', value: 80 }] });
  };
}

// Optional real model (Ollama). Only used if USE_REAL_MODEL is set.
async function ollamaModel(prompt) {
  const r = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({ model: process.env.OLLAMA_MODEL || 'tinyllama', prompt, stream: false, options: { temperature: 0 } }),
  });
  const j = await r.json();
  const m = j.response.match(/\{[\s\S]*\}/); return m ? m[0] : j.response;
}

(async () => {
  const useReal = !!process.env.USE_REAL_MODEL;
  console.log(`=== live-model loop (${useReal ? 'REAL model via Ollama' : 'deterministic MOCK'}) ===\n`);

  const goal = 'Water the crop up to but not over 80.';

  // --- FEEDBACK arm: localized errors are appended to each re-prompt ----------
  {
    const { g, zone, c1 } = makeWorld();
    const call = useReal ? ollamaModel : mockModel(c1);
    const rec = await runProposalLoop(g, call, { goal, rootUuid: zone, maxAttempts: 5, feedback: true });
    console.log(`FEEDBACK arm: success=${rec.success} attempts=${rec.attempts}`);
    for (const t of rec.transcript) console.log(`  attempt ${t.attempt}: ${t.phase}${t.errors ? ' -> ' + t.errors.map(e=>e.code).join(',') : ''}`);
    if (!useReal) {
      ok(rec.success === true, 'FEEDBACK: the loop reached a committed proposal');
      ok(rec.attempts === 3, 'FEEDBACK: fixed field (attempt 1->2) then value (2->3) = 3 attempts');
      ok(g.w.crop_water[g.w.componentIndex[g.w.liveEntity(c1)]] === 80 && g.indexesConsistent(),
         'FEEDBACK: world shows water=80, indexes consistent (real commit through the full pipeline)');
    } else {
      ok(true, `REAL FEEDBACK: recorded success=${rec.success} attempts=${rec.attempts}`);
    }
  }

  // --- CONTROL arm: same model + budget, but NO errors fed back ---------------
  {
    const { g, zone, c1 } = makeWorld();
    const call = useReal ? ollamaModel : mockModel(c1);
    const rec = await runProposalLoop(g, call, { goal, rootUuid: zone, maxAttempts: 5, feedback: false });
    console.log(`\nCONTROL arm:  success=${rec.success} attempts=${rec.attempts}`);
    if (!useReal) {
      ok(rec.success === false, 'CONTROL: without feedback the mock repeats its error and never commits');
      ok(g.w.crop_water[g.w.componentIndex[g.w.liveEntity(c1)]] === 0, 'CONTROL: world unchanged (nothing ever passed validation)');
    } else {
      ok(true, `REAL CONTROL: recorded success=${rec.success} attempts=${rec.attempts}`);
    }
  }

  console.log('\n--- what this run establishes ---');
  if (!useReal) {
    console.log('  The harness drives propose->validate->repair->commit and computes the');
    console.log('  feedback-vs-control metric. The MOCK is rigged to honour feedback, so the');
    console.log('  gap here is by construction — it validates the apparatus, NOT real models.');
    console.log('  Run USE_REAL_MODEL=1 (Ollama up, tinyllama/other) for the real number.');
    ok(true, 'harness + metric proven; the quality question is now a one-command experiment for a real model');
  } else {
    console.log('  This IS the real measurement. Compare FEEDBACK vs CONTROL attempts/success above.');
  }

  console.log(`\n=============================================`);
  console.log(`${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed) — live-model loop`);
  console.log(`=============================================`);
  if (FAIL) process.exitCode = 1;
})();
