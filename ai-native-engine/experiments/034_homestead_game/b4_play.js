'use strict';
// =============================================================================
// B4 — a REAL play session of HOMESTEAD, human-observable, driven through the
// editor. Not a unit test asserting numbers: watch it happen (per-tick trace),
// save MID-RUN, reload, continue, undo a tick, redo it — and confirm it READS
// as a game, then hand the trace to B5's pinned observable.
// `node experiments/034_homestead_game/b4_play.js` -> plays + prints WIN/LOSE.
// =============================================================================
const path = require('node:path');
const fs = require('node:fs');
const { Editor } = require(path.join(__dirname, '..', '..', 'core', 'editor.js'));
const P = require(path.join(__dirname, '..', '..', 'core', 'persistence.js'));
const { TYPE } = require(path.join(__dirname, '..', '..', 'core', 'engine.js'));
const { checkHomesteadObservable, M_TICKS } = require(path.join(__dirname, 'homestead.js'));

const AUTHORED = path.join(__dirname, 'homestead_authored.json');
const SAVE_MID = path.join(__dirname, 'homestead_savegame.json');

// wrap submit to observe reaps/spawns per tick (re-applied after any reload).
function observe(engine, sink) {
  const orig = engine.submit.bind(engine);
  engine.submit = (b) => {
    const r = orig(b); let reaps = 0, spawns = 0;
    b.forEach((tx, i) => { if (r.results[i]?.status === 'committed') for (const op of tx.ops) { if (op.kind === 'delete') reaps++; if (op.kind === 'createChild') spawns++; } });
    sink.reaps = reaps; sink.spawns = spawns; return r;
  };
}
const popOf = (ed) => ed.engine.w.byType.get(TYPE.CROP)?.size ?? 0;
const tallyOf = (ed) => { const z = ed.engine.w.liveEntity(ed.engine.w.uuid[0]); return z >= 0 ? ed.engine._field(z, 'tally') : 0; };
const bar = (n) => '█'.repeat(Math.min(n, 20));
const line = (t, pop, tally, ev) => `  t${String(t).padStart(2)}  pop ${String(pop).padStart(2)} ${bar(pop).padEnd(10)} score ${String(tally).padStart(2)}   ${ev}`;

(async () => {
  console.log('=== B4: HOMESTEAD — a real play session (watch it run) ===\n');
  const ed = new Editor({ engine: P.load(JSON.parse(fs.readFileSync(AUTHORED, 'utf8'))), callModel: null });
  const sink = {};
  observe(ed.engine, sink);
  console.log(`loaded authored game: ${[...ed.engine.ruleSources.keys()].join(', ')}\n`);
  console.log(`  start: pop ${popOf(ed)}, score ${tallyOf(ed)}, tick ${ed.engine.tick}\n`);

  const trace = [];
  const record = (ev = '') => {
    const pop = popOf(ed), tally = tallyOf(ed);
    const row = { tick: ed.engine.tick, population: pop, reaps: sink.reaps ?? 0, spawns: sink.spawns ?? 0, tally };
    trace.push(row);
    const events = [ev, row.reaps ? `🌾 harvested ${row.reaps}` : '', row.spawns ? `🌱 planted ${row.spawns}` : ''].filter(Boolean).join('  ');
    console.log(line(row.tick, pop, tally, events));
  };

  // --- FIRST HALF: play to the mid-point -------------------------------------
  const MID = 20;
  for (let t = 0; t < MID; t++) { await ed.command('tick 1'); record(); }

  // --- SAVE MID-RUN, RELOAD, CONTINUE (RD-B6.1 seam, human-visible) ----------
  console.log('\n  --- 💾 save mid-run, reload, continue (the session survives the seam) ---');
  await ed.command(`save ${SAVE_MID}`);
  const sigBefore = JSON.stringify(P.save(ed.engine));
  await ed.command(`load ${SAVE_MID}`);
  observe(ed.engine, sink);                          // re-wrap the reloaded engine
  const sigAfter = JSON.stringify(P.save(ed.engine));
  console.log(`  reloaded at tick ${ed.engine.tick}: byte-identical=${sigBefore === sigAfter}, rules=${[...ed.engine.ruleSources.keys()].join('/')}\n`);

  // --- UNDO / REDO a tick, human-visible -------------------------------------
  await ed.command('tick 1'); record();
  const popAfter = popOf(ed), tallyAfter = tallyOf(ed);
  const u = await ed.command('undo');
  console.log(`  ↶ undo -> tick ${ed.engine.tick}, pop ${popOf(ed)}, score ${tallyOf(ed)} (reversed the tick)`);
  const rd = await ed.command('redo');
  console.log(`  ↷ redo -> tick ${ed.engine.tick}, pop ${popOf(ed)}, score ${tallyOf(ed)} (replayed it)`);
  const undoRedoClean = popOf(ed) === popAfter && tallyOf(ed) === tallyAfter;

  // --- SECOND HALF: play to the end ------------------------------------------
  console.log('');
  for (let t = ed.engine.tick; t < M_TICKS; t++) { await ed.command('tick 1'); record(); }

  // --- THE VERDICT (B5's pinned observable) ----------------------------------
  let unsafe = 0;
  if (!ed.engine.indexesConsistent()) unsafe++;
  const verdict = checkHomesteadObservable(trace, unsafe);
  const totalReaps = trace.reduce((n, t) => n + t.reaps, 0), totalSpawns = trace.reduce((n, t) => n + t.spawns, 0);

  console.log(`\n=== play summary ===`);
  console.log(`  ticks ${M_TICKS} | final pop ${trace.at(-1).population} | score ${trace.at(-1).tally} | harvested ${totalReaps} | planted ${totalSpawns} | unsafe ${unsafe}`);
  console.log(`  save/reload seam byte-identical: ${sigBefore === sigAfter} | undo/redo clean: ${undoRedoClean}`);
  console.log(`  observable clauses: ${JSON.stringify(verdict.clauses)}`);
  console.log(`\n  ${verdict.win ? '🏆 WIN — the farm survived, thrived, and scored' : '💀 LOSE'} (pinned bar, SPEC.md)`);

  try { fs.unlinkSync(SAVE_MID); } catch {}
  // B4 is a play session, not an assertion suite — but it must not corrupt and
  // must survive its own seams; fail loudly if it did.
  const clean = unsafe === 0 && sigBefore === sigAfter && undoRedoClean;
  console.log(`\n${clean ? 'PLAY SESSION CLEAN' : 'PLAY SESSION PROBLEM'} — save-reload + undo/redo + safety all held: ${clean}`);
  process.exit(clean ? 0 : 1);
})();
