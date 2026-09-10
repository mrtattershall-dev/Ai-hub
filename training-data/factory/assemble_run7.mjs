/**
 * assemble_run7.mjs - the Phaser-only dataset, for a 32B run.
 *
 *   node factory/assemble_run7.mjs              # default cap of 4 rows per prompt
 *   node factory/assemble_run7.mjs --cap 3
 *   node factory/assemble_run7.mjs --cap 0      # no cap (reproduces run5's slice)
 *
 * WHY PHASER ONLY
 * ---------------
 * Measured 2026-09-09 against an untuned Qwen2.5-Coder-32B control, on the 18 prompts
 * every variant answered:
 *
 *     axis      base14B  run5   run6   coder32b
 *     code        7/9    5/9    3/9     8/9      <- fine-tuning HURT this, twice
 *     phaser      1/6    4/6    4/6     2/6      <- the 14B fine-tune beat a 2.3x larger model
 *     godot       0/3    0/3    1/3     2/3
 *
 * Phaser is the ONLY axis where the fine-tune beats scale, so it is the only axis with
 * evidence behind spending on it. Everything else in run5/run6 either did nothing
 * (structured: the 32B is already 10/10, there is nothing left to teach) or did harm
 * (correctness, 30% of run5, took code below the untouched base).
 *
 * WHAT THIS FIXES vs run5's PHASER SLICE
 * --------------------------------------
 * run5 used these same three sources, deduped by key and portability-gated. Two defects
 * survived that, and both matter more at 32B than at 14B because a bigger model memorises
 * more readily:
 *
 *   1. dataset_v6_verified.jsonl had 776 rows but only 388 distinct ANSWERS - exactly half
 *      the rows were the same body under a different prompt.
 *   2. dataset_phaser_modal.jsonl had 2,523 rows across only 284 prompts (8.9 per prompt,
 *      one of them 49 times). That is sampling, not coverage.
 *
 * So: exact-body dedup, then a cap on rows per prompt. The result is smaller, which is
 * also the point - a 32B pass is billed by the hour.
 *
 * EVAL CONTAMINATION IS CHECKED HERE, NOT ASSUMED
 * -----------------------------------------------
 * run5's assembler never checked its training rows against the held-out eval prompts, so
 * "the fine-tune wins at Phaser" rested on an unverified assumption. It happens to hold
 * (measured: 0 exact duplicates, highest word-overlap 0.18), but an assembler that cannot
 * fail is not a check. This one refuses to write a contaminated set.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';

const argv = process.argv.slice(2);
const flag = (name, d) => {
  const i = argv.indexOf('--' + name);
  return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d;
};
const CAP = Number(flag('cap', 4));
const OUT = flag('out', 'trained_run7.jsonl');

const F = (f) => (existsSync(f)
  ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  : []);
const sysOf = (r) => (r.messages.find((m) => m.role === 'system') || {}).content || '';
const userOf = (r) => (r.messages.find((m) => m.role === 'user') || {}).content || '';
const bodyOf = (r) => (r.messages.find((m) => m.role === 'assistant') || {}).content || '';
const isPhaser = (r) => sysOf(r).startsWith('You are an expert Phaser');

const SOURCES = ['dataset_v6_verified.jsonl', 'dataset_phaser_modal.jsonl', 'dataset_phaser_gen.jsonl'];

// -- collect -------------------------------------------------------------------
const raw = [];
const perSource = {};
for (const f of SOURCES) {
  const rows = F(f).filter(isPhaser);
  perSource[f] = rows.length;
  for (const r of rows) raw.push({ r, src: f });
}

// -- 1. exact-body dedup -------------------------------------------------------
// The same answer twice teaches nothing the first copy did not, and doubles its weight.
const seenBody = new Set();
let dupBodies = 0;
const deduped = [];
for (const x of raw) {
  const k = bodyOf(x.r).trim();
  if (!k) continue;
  if (seenBody.has(k)) { dupBodies++; continue; }
  seenBody.add(k);
  deduped.push(x);
}

// -- 2. cap rows per prompt ----------------------------------------------------
// Keeps coverage broad instead of letting a handful of prompts dominate. Rows are taken in
// source order, so the execution-verified older slice is preferred over generated ones.
const perPrompt = new Map();
let overCap = 0;
const capped = [];
for (const x of deduped) {
  const k = userOf(x.r).trim().toLowerCase();
  const n = perPrompt.get(k) || 0;
  if (CAP > 0 && n >= CAP) { overCap++; continue; }
  perPrompt.set(k, n + 1);
  capped.push(x);
}

// -- 3. portability gate -------------------------------------------------------
// A row that reaches for an external asset teaches the model to write code that cannot
// run. That is the defect which ruined the original 4,242-row Phaser slice (71% loaded
// assets, scored 0/12 in Chromium).
let notPortable = 0;
let gated = capped;
try {
  const gate = await import('./gate.mjs');
  gated = capped.filter((x) => {
    const ok = gate.dependsOnExternalResources(bodyOf(x.r)).portable;
    if (!ok) notPortable++;
    return ok;
  });
} catch {
  console.warn('  !! gate.mjs unavailable - portability NOT enforced');
}

// -- 4. eval contamination -----------------------------------------------------
const evalPrompts = existsSync('modal_evalset.py')
  ? readFileSync('modal_evalset.py', 'utf8').split('\n').filter((l) => l.includes('"ph_'))
    .map((l) => (l.match(/SYS_PHASER,\s*"(.+?)"\),?\s*$/) || [])[1]).filter(Boolean)
  : [];
const STOP = new Set(['write', 'complete', 'phaser', 'program', 'that', 'with', 'they', 'from', 'this', 'when', 'into', 'each']);
const bag = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
  .split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)));
const jac = (a, b) => {
  const i = [...a].filter((x) => b.has(x)).length;
  return i / (a.size + b.size - i || 1);
};

let worst = 0;
let worstPair = null;
let contaminated = 0;
const evalBags = evalPrompts.map(bag);
for (const x of gated) {
  const b = bag(userOf(x.r));
  for (let i = 0; i < evalBags.length; i++) {
    const s = jac(b, evalBags[i]);
    if (s > worst) { worst = s; worstPair = [evalPrompts[i], userOf(x.r)]; }
    if (s >= 0.75) contaminated++;
  }
}

const out = gated.map((x) => x.r);

// -- report --------------------------------------------------------------------
const uniqPrompts = new Set(out.map((r) => userOf(r).trim().toLowerCase())).size;
const chars = out.reduce((a, r) => a + bodyOf(r).length, 0);
console.log('\n=== run7 (Phaser only) ===\n');
for (const f of SOURCES) console.log(`  ${f.padEnd(30)} ${String(perSource[f]).padStart(5)} phaser rows read`);
console.log(`\n  ${String(raw.length).padStart(5)}  collected`);
console.log(`  -${String(dupBodies).padStart(4)}  identical answers dropped`);
console.log(`  -${String(overCap).padStart(4)}  over the ${CAP}-per-prompt cap`);
console.log(`  -${String(notPortable).padStart(4)}  depend on external assets`);
console.log(`  =${String(out.length).padStart(4)}  rows written`);
console.log(`\n  distinct prompts   ${uniqPrompts}`);
console.log(`  distinct answers   ${new Set(out.map((r) => bodyOf(r).trim())).size}`);
console.log(`  avg answer length  ${Math.round(chars / (out.length || 1))} chars`);
console.log(`  total content      ${(chars / 1e6).toFixed(2)}M chars (~${(chars / 3.6e6).toFixed(1)}M tokens)`);
console.log(`\n  eval overlap: highest ${worst.toFixed(2)}, ${contaminated} row(s) at/over 0.75`);
if (worstPair && worst >= 0.5) {
  console.log(`     eval : ${worstPair[0].slice(0, 90)}`);
  console.log(`     train: ${worstPair[1].slice(0, 90)}`);
}

if (contaminated > 0) {
  console.error(`\nREFUSING TO WRITE: ${contaminated} row(s) overlap a held-out eval prompt by >=0.75.`);
  console.error('Training on these would inflate the Phaser score this whole run exists to measure.');
  process.exit(1);
}
if (!out.length) {
  console.error('\nREFUSING TO WRITE: no rows survived.');
  process.exit(1);
}

writeFileSync(OUT, out.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
console.log(`\n  -> ${OUT}\n`);
console.log('  NOTE: this set is 100% one domain. Single-domain dominance has already caused');
console.log('  collateral damage in this project once (run4\'s interpret slice at 49% forced a');
console.log('  structured slice to be added to repair it). The 32B\'s best axis is code at');
console.log('  19/20, so the eval MUST be re-run on code as well as phaser to detect');
console.log('  forgetting - that is what the 20 code prompts in the evalset are for.\n');
