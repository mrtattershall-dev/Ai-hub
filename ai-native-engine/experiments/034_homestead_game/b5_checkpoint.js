'use strict';
// =============================================================================
// B5 — THE PHASE-B SUCCESS CHECKPOINT. One integrated end-to-end run of the
// whole chain (world + rules authored THROUGH THE EDITOR, played, adjudicated),
// asserting each Phase-B success condition explicitly, then the milestone.
// `node experiments/034_homestead_game/b5_checkpoint.js` -> milestone verdict.
// =============================================================================
// The bar, stated in SPEC.md before any rule was authored:
//   "Does HOMESTEAD build — end to end, authored through the editor, on rules
//    validated before execution, with nothing corrupting — and does a real play
//    session WIN its pre-registered observable?"
// =============================================================================
const path = require('node:path');
const { Editor } = require(path.join(__dirname, '..', '..', 'core', 'editor.js'));
const P = require(path.join(__dirname, '..', '..', 'core', 'persistence.js'));
const { TYPE } = require(path.join(__dirname, '..', '..', 'core', 'engine.js'));
const H = require(path.join(__dirname, 'homestead.js'));

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };

(async () => {
  console.log('=== B5: HOMESTEAD — Phase-B success checkpoint (end to end) ===\n');
  const proposer = H.nearMissProposer();

  // (1) BUILD THROUGH THE EDITOR — world authored via spawn commands ----------
  const ed = new Editor({ callModel: proposer });
  await ed.command('spawn zone name=field tally=0');
  await ed.command('spawn crop name=c0 water=25 growth=70');
  await ed.command('spawn crop name=c1 water=25 growth=40');
  await ed.command('spawn crop name=c2 water=25 growth=0');
  const builtWorld = ed.engine.w.byType.get(TYPE.ZONE)?.size === 1 && ed.engine.w.byType.get(TYPE.CROP)?.size === 3;
  ok(builtWorld, 'BUILT THROUGH THE EDITOR: the starting world was authored via editor commands, not a fixture');

  // (2) RULES VALIDATED BEFORE EXECUTION — every rule through the gate, and
  //     near-misses REJECTED before they could run, then repaired -------------
  let gateRejectionsBeforeRun = 0, allInstalled = true;
  for (const g of H.HOMESTEAD_GOALS) {
    const r = await ed.command(`rule ${g}`);
    gateRejectionsBeforeRun += (r.transcript || []).filter(t => t.phase === 'rejected').length;
    if (!r.success) allInstalled = false;
  }
  const installed = [...ed.engine.ruleSources.keys()];
  ok(allInstalled && installed.length === 5, `RULES VALIDATED BEFORE EXECUTION: all 5 installed only after passing the gate (${installed.join(', ')})`);
  ok(gateRejectionsBeforeRun >= 3, `the boundary CAUGHT unsafe rules before they ran: ${gateRejectionsBeforeRun} gate rejections during authoring, each repaired`);

  // (3) NOTHING CORRUPTING — authoring + a full 40-tick play + save/reload +
  //     undo/redo, all with zero unsafe -------------------------------------
  const sink = {};
  const wrap = (eng) => { const o = eng.submit.bind(eng); eng.submit = (b) => { const r = o(b); let reaps = 0; b.forEach((tx, i) => { if (r.results[i]?.status === 'committed') for (const op of tx.ops) if (op.kind === 'delete') reaps++; }); sink.reaps = reaps; return r; }; };
  wrap(ed.engine);
  const trace = [];
  const zone = ed.engine.w.uuid[0];
  let unsafe = 0;
  for (let t = 0; t < H.M_TICKS; t++) {
    await ed.command('tick 1');
    // mid-run save/reload seam at tick 20 (RD-B6.1)
    if (ed.engine.tick === 20) {
      const f = path.join(require('node:os').tmpdir(), `b5_${process.pid}.json`);
      const before = JSON.stringify(P.save(ed.engine));
      await ed.command(`save ${f}`); await ed.command(`load ${f}`); wrap(ed.engine);
      if (JSON.stringify(P.save(ed.engine)) !== before) unsafe++;
      try { require('node:fs').unlinkSync(f); } catch {}
    }
    const z = ed.engine.w.liveEntity(zone);
    trace.push({ tick: ed.engine.tick, population: ed.engine.w.byType.get(TYPE.CROP)?.size ?? 0, reaps: sink.reaps ?? 0, tally: z >= 0 ? ed.engine._field(z, 'tally') : 0 });
    if (!ed.engine.indexesConsistent()) unsafe++;
  }
  // undo/redo round-trip at the end
  const u = await ed.command('undo'); const rdo = await ed.command('redo');
  ok(unsafe === 0 && ed.engine.indexesConsistent(), 'NOTHING CORRUPTING: zero unsafe across authoring + 40-tick play + save/reload seam');
  ok(u.ok && rdo.ok, 'undo/redo held over the play session (RD-020)');

  // (4) IT IS A GAME — wins the PRE-REGISTERED observable, and the bar is
  //     genuinely losable ----------------------------------------------------
  const verdict = H.checkHomesteadObservable(trace, unsafe);
  console.log(`\n  observable: ${JSON.stringify(verdict.clauses)}`);
  console.log(`  final: pop ${trace.at(-1).population}, score ${trace.at(-1).tally}, harvested ${trace.reduce((n, t) => n + t.reaps, 0)}`);
  ok(verdict.win, 'IT IS A GAME: the authored rules WIN the pre-registered win/lose observable');
  const loss = H.runGame(H.oracleRules().filter(r => r.name !== 'reseed'));
  ok(!loss.verdict.win, 'the bar is LOSABLE: a near-miss rule-set (no reseed) loses — not a bar everything passes');

  // ---- THE MILESTONE --------------------------------------------------------
  const milestone = PASS >= 7 && FAIL === 0;
  console.log(`\n${'='.repeat(64)}`);
  if (milestone) {
    console.log('🏆 PHASE-B MILESTONE MET.');
    console.log('   HOMESTEAD builds end to end: a world and a 5-rule game authored');
    console.log('   THROUGH THE EDITOR, on rules VALIDATED BEFORE EXECUTION, played 40');
    console.log('   ticks across a save/reload seam and undo/redo, with NOTHING');
    console.log('   corrupting — and it WINS its pre-registered win/lose observable.');
    console.log('   Everything past here (renderer, input, assets, tycoon/MMO framing,');
    console.log('   multiplayer) is explicitly OUT OF SCOPE for "success" — B6+ gravy.');
  } else {
    console.log('❌ PHASE-B MILESTONE NOT MET — see failures above.');
  }
  console.log('='.repeat(64));
  console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
  process.exit(milestone ? 0 : 1);
})();
