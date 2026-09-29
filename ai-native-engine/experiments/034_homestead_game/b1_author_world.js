'use strict';
// =============================================================================
// B1 — author HOMESTEAD's starting world THROUGH THE EDITOR (not a fixture).
// Acceptance: the world exists, passes validation, and survives save/load.
// Produces `homestead_world.json` for B2 to author rules into.
// `node experiments/034_homestead_game/b1_author_world.js` -> ALL PASS.
// =============================================================================
const path = require('node:path');
const fs = require('node:fs');
const { Editor, mockModel } = require(path.join(__dirname, '..', '..', 'core', 'editor.js'));
const P = require(path.join(__dirname, '..', '..', 'core', 'persistence.js'));
const { TYPE } = require(path.join(__dirname, '..', '..', 'core', 'engine.js'));
const { buildStartWorld } = require(path.join(__dirname, 'homestead.js'));

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const WORLD_FILE = path.join(__dirname, 'homestead_world.json');

(async () => {
  console.log('=== B1: author the HOMESTEAD starting world through the editor ===\n');
  const ed = new Editor({ callModel: mockModel() });

  // --- author the world via the editor's own command surface (SPEC.md) -------
  const script = [
    'spawn zone name=field tally=0',
    'spawn crop name=c0 water=25 growth=70',
    'spawn crop name=c1 water=25 growth=40',
    'spawn crop name=c2 water=25 growth=0',
  ];
  for (const line of script) { const r = await ed.command(line); console.log(`> ${line}\n  ${ed.render(r)}`); ok(r.ok, `command ok: ${line}`); }

  // --- acceptance 1: the world exists, matches SPEC, validates ----------------
  const show = await ed.command('show');
  const crops = ['c0', 'c1', 'c2'].every(n => show.slice.includes(n));
  ok(show.slice.includes('field') && crops, 'the world exists: field zone + 3 named crops present');
  ok(ed.engine.indexesConsistent(), 'the world passes validation (indexes consistent)');
  ok((ed.engine.w.byType.get(TYPE.CROP)?.size ?? 0) === 3, 'exactly 3 live crops (byType index)');

  // --- acceptance 2: it is the EXACT SPEC world (authored, not approximated) ---
  // byte-compare against the ground-truth builder — proves the editor authored
  // precisely SPEC.md's starting world, not something close.
  const canonical = JSON.stringify(P.save(buildStartWorld().engine));
  ok(JSON.stringify(P.save(ed.engine)) === canonical,
    'editor-authored world is BYTE-IDENTICAL to the SPEC ground-truth start world');

  // --- prove the AI EDIT path is live on this real world (not just spawn) ------
  // (on a clone, so the canonical world saved below is unperturbed.)
  const clone = new Editor({ engine: P.load(P.save(ed.engine)), callModel: mockModel() });
  const e = await clone.command('edit set the crop water to 30');
  ok(e.success && e.transcript.some(t => t.phase === 'committed'),
    'the AI edit loop is live on the real world (a gated setfield commits)');
  ok(clone.engine.indexesConsistent(), '...and the world stays valid after an AI edit');

  // --- acceptance 3: survives save/load --------------------------------------
  await ed.command(`save ${WORLD_FILE}`);
  const beforeSig = JSON.stringify(P.save(ed.engine));
  const ed2 = new Editor({ callModel: mockModel() });
  const l = await ed2.command(`load ${WORLD_FILE}`);
  ok(l.ok, `save/load round-trip: loaded ${path.basename(WORLD_FILE)}`);
  ok(JSON.stringify(P.save(ed2.engine)) === beforeSig, 'reloaded world is byte-identical (survives save/load)');
  ok(ed2.engine.indexesConsistent(), 'reloaded world validates');

  console.log(`\nsaved starting world -> ${path.basename(WORLD_FILE)} (for B2)`);
  console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL ? 1 : 0);
})();
