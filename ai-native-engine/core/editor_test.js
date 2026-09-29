'use strict';
// =============================================================================
// editor_test.js — deterministic proof of the AI-native editor surface AND the
// thesis it exists to make visible: a rejected AI proposal changes NOTHING
// (validate before execute; a partial edit is corruption, never applied).
// `node core/editor_test.js` -> ALL PASS. Zero deps, no GPU (mock model).
// =============================================================================
const path = require('node:path');
const { Editor, mockModel } = require(path.join(__dirname, 'editor.js'));
const P = require(path.join(__dirname, 'persistence.js'));
const { TYPE } = require(path.join(__dirname, 'engine.js'));

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const hr = (t) => console.log(`\n--- ${t} ---`);

const waterOf = (ed, uuid) => { const w = ed.engine.w, e = w.liveEntity(uuid); return e < 0 ? null : w.crop_water[w.componentIndex[e]]; };
const growthOf = (ed, uuid) => { const w = ed.engine.w, e = w.liveEntity(uuid); return e < 0 ? null : w.crop_growth[w.componentIndex[e]]; };
const sig = (ed) => JSON.stringify(P.save(ed.engine));

(async () => {
  console.log('=== AI-native editor: surface + validate-before-execute thesis ===');

  // ---- setup: direct authoring (the human's own hands) ----------------------
  hr('S  bootstrap: spawn a zone + crop, focus, show');
  const ed = new Editor({ callModel: mockModel() });
  const zone = (await ed.command('spawn zone name=field')).uuid;
  const crop = (await ed.command('spawn crop name=c1 water=20 growth=0')).uuid;
  ok(zone && crop, `spawned zone ${zone} + crop ${crop}`);
  const shown = await ed.command('show');
  ok(shown.slice.includes(crop) && shown.slice.includes('c1'), 'show renders the columnar slice with the crop');

  // ---- AI-directed data edit that PASSES the gate ---------------------------
  hr('E1 edit accepted: "water the crop to 80" commits in one attempt');
  const e1 = await ed.command('edit set the crop water to 80');
  ok(e1.success && e1.attempts === 1 && e1.committed === 1, 'edit committed in 1 attempt');
  ok(waterOf(ed, crop) === 80, 'the world reflects it: water === 80');
  ok(e1.transcript[0].phase === 'committed', 'transcript records the gate ACCEPT');

  // ---- AI-directed data edit that the GATE CATCHES, then the AI repairs -----
  hr('E2 edit rejected-then-repaired: "water to 999" caught at the boundary');
  const e2 = await ed.command('edit set the crop water to 999');
  ok(e2.transcript[0].phase === 'protocol', 'attempt 1 REJECTED at the protocol boundary (before the engine, RD-018 split)');
  ok(/outside \[0,255\]/.test(JSON.stringify(e2.transcript[0].errors)), '   ...with the localized reason (out of range)');
  ok(e2.success && e2.attempts === 2 && waterOf(ed, crop) === 255, 'attempt 2 repaired to 255 and committed');

  // ---- THE THESIS, strongest form: a PERMANENTLY-rejected edit changes nothing
  hr('T  validate-before-execute: an un-repairable proposal leaves the world BYTE-IDENTICAL');
  // a model that always proposes an out-of-range value, ignoring feedback.
  const brokenModel = async () => `{"actor":"ai","ops":[{"op":"setfield","target":"${crop}","field":"water","value":9999}]}`;
  const edB = new Editor({ engine: ed.engine, callModel: brokenModel });
  const before = sig(edB);
  const rB = await edB.command('edit set the crop water to 9999');
  ok(!rB.success && rB.attempts === ed.maxAttempts, `all ${ed.maxAttempts} attempts rejected (model never fixes it)`);
  ok(rB.unchangedOnReject === true && sig(edB) === before,
    'the world is BYTE-IDENTICAL to before the proposal — nothing partial ever committed');

  // ---- RD-035 audit fixes: the thesis must hold for ENGINE-LAYER rejections too,
  // and an unknown field must be REJECTED (localized), never thrown at commit ------
  hr('T2 engine-layer rejection: world-state identical though the tick clock advances (RD-035)');
  {
    const { worldSig } = require(path.join(__dirname, 'editor.js'));
    const beforeSig = worldSig(ed.engine);                         // world state, tick excluded
    const beforeRaw = JSON.stringify(P.save(ed.engine));          // raw, tick included
    // 'wobble' is owned by no type — pre-fix this fell through validation and THREW at
    // commit (_writeField 'unknown writable field'), reachable over the wire.
    const r = ed.engine.submit([{ actor: 'net', ops: [{ kind: 'setfield', target: crop, field: 'wobble', value: 3 }] }]);
    ok(r.results[0].status === 'rejected' && /unknown field/.test(r.results[0].reasons.join()),
      'fix #2: an unknown-field setfield is REJECTED with a localized reason — no commit-time throw');
    ok(worldSig(ed.engine) === beforeSig,
      'fix #1: worldSig (world state) is byte-identical after an ENGINE-layer rejection');
    ok(JSON.stringify(P.save(ed.engine)) !== beforeRaw,
      '   ...while the raw save DID change — by the tick clock alone (why the naive yardstick false-negatived "CHECK")');
  }

  // ---- AI-directed BEHAVIOR rule: same boundary, one layer up ---------------
  hr('R  rule rejected-then-repaired: unclamped growth caught by the RANGE PROOF');
  const r1 = await ed.command('rule watered crops gain 5 growth each tick');
  ok(r1.transcript[0].phase === 'rejected' && /range_unprovable|could reach/.test(JSON.stringify(r1.transcript[0].errors)),
    'attempt 1 rule REJECTED by the range proof (unclamped growth+5 could reach 260)');
  ok(r1.success && r1.name === 'grow', 'attempt 2 clamped rule INSTALLED');
  ok((await ed.command('rules')).names.includes('grow'), 'rules lists the installed rule');

  // ---- the authored rule RUNS under simulation ------------------------------
  hr('K  tick: the AI-authored rule drives the sim, safely');
  const g0 = growthOf(ed, crop);
  const t = await ed.command('tick 4');
  ok(t.safe && t.changed, 'ticked 4, indexes consistent, world changed');
  ok(growthOf(ed, crop) === Math.min(g0 + 5 * 4, 255), `growth advanced +5/tick (from ${g0} to ${growthOf(ed, crop)})`);

  // ---- undo / redo ----------------------------------------------------------
  hr('U  undo/redo: one tick is one reversible step (RD-020)');
  const gBefore = growthOf(ed, crop);
  const u = await ed.command('undo');
  ok(u.ok && growthOf(ed, crop) < gBefore, 'undo reversed the last tick');
  const rd = await ed.command('redo');
  ok(rd.ok && growthOf(ed, crop) === gBefore, 'redo replayed it');

  // ---- persistence round-trip (rules included, RD-B6) -----------------------
  hr('P  save/load: the world + its rules survive a round-trip, byte-stable');
  const f = path.join(require('node:os').tmpdir(), `editor_test_${process.pid}.json`);
  await ed.command(`save ${f}`);
  const savedSig = sig(ed);
  const l = await ed.command(`load ${f}`);
  ok(l.ok && l.rules === 1, 'loaded with the rule preserved');
  ok(sig(ed) === savedSig, 'reloaded world is byte-identical to the saved one');
  ok((await ed.command('rules')).names.includes('grow'), 'the AI-authored rule is still installed after reload');
  try { require('node:fs').unlinkSync(f); } catch {}

  // ---- uninstall + graceful errors ------------------------------------------
  hr('X  uninstall + error surfaces (no throws on bad input)');
  ok((await ed.command('uninstall grow')).ok, 'uninstall removes the rule');
  ok(!(await ed.command('uninstall nope')).ok, 'uninstalling an absent rule fails gracefully (no throw)');
  ok((await ed.command('spawn banana')).ok === false, 'spawning an unknown type fails gracefully');
  ok((await ed.command('frobnicate')).kind === 'unknown', 'an unknown command is reported, not thrown');

  console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL ? 1 : 0);
})();
