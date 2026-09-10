/**
 * assemble_run6.mjs - compose run6 from what the 2026-09-09 evaluation actually measured.
 *
 *   node factory/assemble_run6.mjs            -> factory/trained_run6.jsonl
 *
 * THE MEASUREMENTS THIS IS BUILT ON
 * ---------------------------------
 * 32 held-out prompts, identical for every variant, scored by EXECUTION
 * (node ran it / Chromium rendered it / Godot parsed it):
 *
 *     axis         base    run4    run5
 *     code          7/9     3/9     5/9     <- fine-tuning made this WORSE than nothing
 *     phaser        1/6     0/6     4/6     <- the one clear win, +3
 *     godot         0/3     0/3     0/3     <- never worked, for anyone
 *     structured    4/4     2/4     4/4     <- the base was ALREADY perfect
 *     interpret     5/10   10/10    9/10    <- real win, +4
 *     total        17/32   15/32   22/32
 *
 * Only TWO axes justify the fine-tune. Everything else is neutral or negative.
 *
 * THE FOUR CHANGES, EACH TRACEABLE
 * --------------------------------
 * 1. CORRECTNESS CUT HARD. It was 4,117 rows (30% of run5) and it scores below the
 *    untouched base. 2,105 of those rows - 51% of the slice, 15% of the whole dataset -
 *    were ONE prompt: "Build 3 small, separated game systems ... Farm, Crop, Market",
 *    wrapped in casual rephrasings ("gimme a", "lil", "i need a"). 1,804 distinct answers
 *    to one task. That is task collapse, and it is the most likely cause of both the code
 *    regression and the halved output length (base 2,335 chars -> run5 1,180).
 *    A small diverse remainder stays as insurance against forgetting how to write code.
 *
 * 2. STRUCTURED CUT TO A TOKEN AMOUNT. The base scores 4/4 without any training. Those
 *    1,500 rows bought nothing; they existed to repair damage the interpret slice did in
 *    run4. With interpret cut further they are mostly unnecessary.
 *
 * 3. GODOT REPLACED, NOT EXPANDED. run5's 900 rows taught the SHAPE correctly - every
 *    generation had extends SceneTree, _init(), quit(), assert(). They failed on Python
 *    syntax bleeding in (`enum State:`, `for _, w in items:`). More of the same teaches
 *    what it already knows, so the new rows target the divergence points specifically.
 *
 * 4. HIS OWN GAMES, FINALLY. Measured coverage was DUST & HARVEST 6% (45 of 695
 *    functions), CURSEBOUND 15%, TURBO DRIFT 45%. Meanwhile 30% of the dataset was
 *    borrowed generic code that actively hurt. The games are also portable BY
 *    CONSTRUCTION - zero external asset references across all four - which is the exact
 *    property whose absence made the old Phaser slice score 0/12.
 *
 * Plus a slice that did not exist at all: EDIT-IN-PLACE, mined from the version history.
 * Every run5 row teaches "write X from scratch"; the agent's actual job is "here is a
 * working codebase, change it". There were 13,762 of the first and 0 of the second.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { dependsOnExternalResources } from './gate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const F = (p) => (existsSync(join(__dirname, p))
  ? readFileSync(join(__dirname, p), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
  : []);

const sysOf = (r) => (r.messages.find((m) => m.role === 'system') || {}).content || '';
const usrOf = (r) => (r.messages.find((m) => m.role === 'user') || {}).content || '';
const bodyOf = (r) => (r.messages.find((m) => m.role === 'assistant') || {}).content || '';
const keyOf = (r) => createHash('sha1').update(usrOf(r) + '|' + bodyOf(r)).digest('hex');

// Deterministic: same seed, same dataset, every run.
let seed = 60906;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function sample(arr, n) {
  if (arr.length <= n) return [...arr];
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

// ── budgets, with the reason each number is what it is ────────────────────────
// Budgets revised against MEASURED yields, 2026-09-09. The first pass assumed games
// could reach 2,500 and edits 600; harvesting produced 1,073 and 93. Rather than pad
// those slices with anything weaker, the shortfall goes to phaser - the one slice that
// is both proven (+3 over base) and has verified rows spare (3,799 available).
const BUDGET = {
  phaser:      { cap: 3600, why: 'the only large win (+3 over base). Every row already rendered in real Chromium. Absorbs the shortfall from games/edits.' },
  godot:       { cap: 1500, why: 'targets the Python-divergence points that made run5 fail 0/3, not the shape it already knows.' },
  interpret:   { cap: 1400, why: '+4 over base, but it over-generalises. Was 49% of run4, 25% of run5 — now ~15%.' },
  games:       { cap: 1200, why: 'your own proven code, portable by construction. Harvest ceiling is ~1,073 across 20 games; the rest is version duplication.' },
  correctness: { cap:  900, why: 'base BEATS the fine-tune here (7/9 vs 5/9). Diverse rows only; the 2,105-row template block is excluded.' },
  structured:  { cap:  350, why: 'base is already 4/4. Just enough to stop interpret regressing it again.' },
  edits:       { cap:  600, why: 'a capability with literally zero coverage. Yield is only ~93 — instruction backtranslation would unlock the rest.' },
};

// The single prompt that was 15% of run5. Excluded by exact match on its distinctive text.
const TEMPLATE_BLOCK = /build 3 small,\s*separated game systems/i;

// ── gather ────────────────────────────────────────────────────────────────────
const run5 = F('trained_run5.jsonl');            // run5's training set (historically misnamed)
const isPhaser  = (r) => sysOf(r).startsWith('You are an expert Phaser');
const isCorrect = (r) => sysOf(r).startsWith('You are a senior engineer');
const isInterp  = (r) => sysOf(r).startsWith('You correctly interpret');
const isStruct  = (r) => sysOf(r).startsWith('You produce structured');

const pools = {
  // Phaser: the execution-verified survivors plus the generated ones, same contract.
  phaser: [...F('dataset_v6_verified.jsonl').filter(isPhaser), ...F('dataset_phaser_modal.jsonl'), ...F('dataset_phaser_gen.jsonl')],
  // Your games. Produced by harvest_games.mjs - self-contained, node --check'd, portable.
  games: F('dataset_games.jsonl'),
  // New Godot, every row parsed by real headless Godot.
  godot: F('dataset_godot_syntax.jsonl'),
  interpret: run5.filter(isInterp),
  // Correctness MINUS the collapsed template block.
  correctness: run5.filter((r) => isCorrect(r) && !TEMPLATE_BLOCK.test(usrOf(r))),
  edits: F('dataset_edits.jsonl'),
  structured: run5.filter(isStruct),
};

// ── compose ───────────────────────────────────────────────────────────────────
const seen = new Set();
const out = [];
const report = [];

for (const [name, { cap, why }] of Object.entries(BUDGET)) {
  const pool = pools[name] || [];
  const picked = sample(pool, cap);
  let kept = 0, dupe = 0, unportable = 0;
  for (const r of picked) {
    const k = keyOf(r);
    if (seen.has(k)) { dupe++; continue; }
    // The portability gate applies to EVERYTHING. It is the rule the Phaser slice broke.
    if (!dependsOnExternalResources(bodyOf(r)).portable) { unportable++; continue; }
    seen.add(k);
    const { _meta, ...clean } = r;      // strip harvest bookkeeping before training
    out.push(clean);
    kept++;
  }
  report.push({ name, kept, cap, available: pool.length, dupe, unportable, why });
}

writeFileSync(join(__dirname, 'trained_run6.jsonl'), out.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');

// ── report ────────────────────────────────────────────────────────────────────
const pct = (n) => (out.length ? Math.round((100 * n) / out.length) : 0);
console.log(`\n=== run6 assembled -> factory/trained_run6.jsonl ===\n`);
console.log(`  slice        kept   %   available  budget   note`);
console.log(`  ${'─'.repeat(96)}`);
for (const r of report) {
  const short = r.available < r.cap ? `SHORT by ${r.cap - r.available}` : '';
  console.log(`  ${r.name.padEnd(12)}${String(r.kept).padStart(5)}${String(pct(r.kept)).padStart(4)}%${String(r.available).padStart(11)}${String(r.cap).padStart(8)}   ${short}`);
}
console.log(`  ${'─'.repeat(96)}`);
console.log(`  TOTAL        ${String(out.length).padStart(5)}\n`);

for (const r of report) console.log(`  ${r.name}: ${r.why}`);

const short = report.filter((r) => r.available < r.cap);
if (short.length) {
  console.log(`\n  NOT YET AT BUDGET — run these first:`);
  for (const r of short) {
    const cmd = {
      games: 'node factory/harvest_games.mjs --dir "%USERPROFILE%/Downloads" --pattern dust-harvest-v38',
      godot: 'node factory/gen_godot_syntax.mjs 1500 factory/dataset_godot_syntax.jsonl',
      edits: 'node factory/harvest_diffs.mjs --dir "%USERPROFILE%/Downloads" --pattern dust-harvest',
    }[r.name];
    console.log(`    ${r.name.padEnd(12)} have ${r.available}, want ${r.cap}${cmd ? `\n                 ${cmd}` : ''}`);
  }
}

// Must be zero. The Phaser slice scored 0/12 because nobody checked this.
let leaked = 0;
for (const r of out) if (!dependsOnExternalResources(bodyOf(r)).portable) leaked++;
console.log(`\n  rows depending on an external resource: ${leaked}${leaked === 0 ? '  (clean)' : '  <-- PROBLEM'}`);

const templateLeft = out.filter((r) => TEMPLATE_BLOCK.test(usrOf(r))).length;
console.log(`  rows from the collapsed 2,105-row template: ${templateLeft}${templateLeft === 0 ? '  (excluded as intended)' : '  <-- PROBLEM'}`);

const steps = Math.ceil((out.length * 1) / 8);
console.log(`\n  1 epoch at effective batch 8 = ${steps} steps`);
console.log(`  at 3.5 s/step on an H100 = ${(steps * 3.5 / 3600).toFixed(2)} hr  ~$${(steps * 3.5 / 3600 * 4.28).toFixed(2)}`);
console.log(`  (run5 was 13,762 rows / 1,721 steps / 1:46 / $7.64 — this is smaller AND targeted)\n`);
