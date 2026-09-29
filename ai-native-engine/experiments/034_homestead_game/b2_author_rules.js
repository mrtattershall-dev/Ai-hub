'use strict';
// =============================================================================
// B2 — author HOMESTEAD's 5-rule game-set THROUGH THE EDITOR's real gate +
// repair loop, with the win/lose goal as the authoring target. The FLAGGED
// composition-risk point: first time editor × multi-rule × real-goal authoring
// compose. Produces `homestead_authored.json` for B4.
// `node experiments/034_homestead_game/b2_author_rules.js` -> ALL PASS.
// =============================================================================
// REAL-LOCAL-MODEL ATTEMPT (b2_smoke.js), reported honestly, NOT swept:
//   * qwen2.5-coder:7b — capable enough (RD-018.1) but >7 min/call on this
//     laptop CPU (the "~20min/call" wall) — not viable for a 5-rule session.
//   * phi3 (3.8B) — 122s/call but too WEAK: emitted invalid rule IR (copied the
//     "<short>" grammar placeholder, "$self.growth", array-typed match). BOTH
//     attempts REJECTED at the gate, world unchanged (safety held under a
//     genuinely weak real model — the thesis, live).
// So a capable LIVE authoring of this game is capability+hardware-bound locally;
// it is the RD-B5 GPU follow-up. Here the authoring proposer is DETERMINISTIC
// and emits the *measured* failure classes (RD-B1/B2/B4: unclamped range,
// missing spawn cap) so the editor's REAL gate catches them and the REAL repair
// loop corrects them — the machinery + composition is tested for real; only the
// proposer's *capability* is stubbed (and separately measured above).
// =============================================================================
const path = require('node:path');
const fs = require('node:fs');
const { Editor } = require(path.join(__dirname, '..', '..', 'core', 'editor.js'));
const P = require(path.join(__dirname, '..', '..', 'core', 'persistence.js'));
const { playSession, HOMESTEAD_GOALS, nearMissProposer } = require(path.join(__dirname, 'homestead.js'));

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const WORLD = path.join(__dirname, 'homestead_world.json');
const AUTHORED = path.join(__dirname, 'homestead_authored.json');

(async () => {
  console.log('=== B2: author the HOMESTEAD rule-set through the editor (real gate + repair) ===\n');
  const ed = new Editor({ engine: P.load(JSON.parse(fs.readFileSync(WORLD, 'utf8'))), callModel: nearMissProposer() });

  // the authoring goals — the win/lose loop, one rule at a time (SPEC.md) ------
  let repairsSeen = 0, unsafeDuringAuthoring = 0;
  for (const g of HOMESTEAD_GOALS) {
    const r = await ed.command(`rule ${g}`);
    console.log(ed.render(r));
    ok(r.success, `authored: "${g}"`);
    if (r.attempts > 1) repairsSeen++;
    if (!ed.engine.indexesConsistent()) unsafeDuringAuthoring++;
  }

  // --- acceptance: all install or honestly quarantine, zero unsafe -----------
  const installed = ed.engine.ruleSources ? [...ed.engine.ruleSources.keys()] : [];
  const quarantined = (ed.engine.ruleQuarantine ?? []).length;
  ok(installed.length === 5 && quarantined === 0, `all 5 rules installed, 0 quarantined (${installed.join(', ')})`);
  ok(repairsSeen >= 3, `the REAL repair loop was exercised: ${repairsSeen}/5 rules needed a gate-corrected 2nd attempt`);
  ok(unsafeDuringAuthoring === 0, 'zero unsafe events during authoring');

  // --- the FLAGGED composition check: do the 5 incrementally-authored rules
  // RUN TOGETHER safely? (the surprise, if any, is here — editor × multi-rule.)
  const probe = new Editor({ engine: P.load(P.save(ed.engine)), callModel: nearMissProposer() });
  const zone = probe.engine.w.uuid[0];
  const { trace, unsafe } = playSession({ engine: probe.engine, zone, ticks: 8 });
  ok(unsafe === 0, `composition check: the 5 authored rules run together for 8 ticks with ZERO unsafe (pop ${trace.at(-1).population}, tally ${trace.at(-1).tally})`);

  // --- save the authored game for B4 -----------------------------------------
  fs.writeFileSync(AUTHORED, JSON.stringify(P.save(ed.engine)));
  ok(fs.existsSync(AUTHORED), `saved authored game -> ${path.basename(AUTHORED)} (world + 5 rules) for B4`);

  console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
  console.log('(real-local-model attempt reported in the header + b2_smoke.js; capable live authoring is the RD-B5 GPU follow-up.)');
  process.exit(FAIL ? 1 : 0);
})();
