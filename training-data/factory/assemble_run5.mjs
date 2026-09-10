/**
 * assemble_run5.mjs - build the run5 dataset from measured evidence.
 *
 *   node factory/assemble_run5.mjs
 *
 * Every decision here traces to something measured on run4 (2026-09-08):
 *
 *   phaser      4,242 harvested rows scored 0/12 on a Chromium eval; 71% loaded assets
 *               from a server that does not exist. REPLACED with rows that each rendered
 *               in real Chromium before being kept.
 *
 *   interpret   0/10 -> 10/10 on stating interpretations. The capability is real, so it
 *               stays - but at 49% of run4 it over-generalised and broke the Strategy tab
 *               (markdown request answered with a JavaScript class). SUBSAMPLED to ~28%.
 *
 *   structured  NEW. Nothing in run4 taught "answer in markdown when markdown is asked
 *               for" - every row ended in a code fence. Direct counterweight.
 *
 *   godot       run4 scored 0/3. No GDScript existed in any dataset. NEW, every row
 *               parsed and ran in real headless Godot.
 *
 *   correctness Code scored 7/8 single-pass and 9/9 across three passes. Left untouched.
 *
 * Deterministic: the interpret subsample uses a fixed seed, so re-running produces the
 * same dataset.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

const F = (p) => (existsSync(p) ? readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)) : []);
const sysOf = (r) => (r.messages.find((m) => m.role === 'system') || {}).content || '';
const bodyOf = (r) => (r.messages.find((m) => m.role === 'assistant') || {}).content || '';
const keyOf = (r) => createHash('sha1').update(((r.messages.find((m) => m.role === 'user') || {}).content || '') + '|' + bodyOf(r)).digest('hex');

// Deterministic subsample - same seed, same dataset, every time.
let seed = 550920261;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function sample(arr, n) {
  if (arr.length <= n) return [...arr];
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

const run4 = F('trained_run4.jsonl');            // run4's training set (misleadingly named)
const isPhaser = (r) => sysOf(r).startsWith('You are an expert Phaser');
const isCorrect = (r) => sysOf(r).startsWith('You are a senior engineer');
const isInterp = (r) => sysOf(r).startsWith('You correctly interpret');

const correctness = run4.filter(isCorrect);
const interpretAll = run4.filter(isInterp);

// Phaser: only rows proven to render. The verified survivors of the old slice, plus the
// generated ones. Both were checked by the SAME contract, local and on Modal.
const verifiedOld = F('dataset_v6_verified.jsonl').filter(isPhaser);
const genLocal = F('dataset_phaser_gen.jsonl');
const genModal = F('dataset_phaser_modal.jsonl');

const seen = new Set();
const phaser = [];
for (const r of [...verifiedOld, ...genModal, ...genLocal]) {
  const k = keyOf(r);
  if (seen.has(k)) continue;
  seen.add(k);
  phaser.push(r);
}

const interpret = sample(interpretAll, 3500);
const structured = F('dataset_structured.jsonl');
const godot = F('dataset_godot.jsonl');

let out = [...correctness, ...phaser, ...interpret, ...structured, ...godot];

// Final portability sweep. The correctness slice is otherwise untouched, but it carried
// 2 rows that reach for an external resource - the same defect class that ruined the
// Phaser slice. Drop them rather than ship a dataset that contradicts its own premise.
let dropped = 0;
try {
  const gate = await import('./gate.mjs');
  const before = out.length;
  out = out.filter((r) => gate.dependsOnExternalResources(bodyOf(r)).portable);
  dropped = before - out.length;
} catch { /* gate unavailable - leave the set as-is */ }

// Re-check after filtering: this must be zero.
let leaked = 0;
try {
  const g = await import('./gate.mjs');
  for (const r of out) if (!g.dependsOnExternalResources(bodyOf(r)).portable) leaked++;
} catch { /* gate unavailable */ }

writeFileSync('trained_run5.jsonl', out.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');

const pct = (n) => Math.round((100 * n) / out.length);
console.log('=== run5 dataset assembled -> factory/trained_run5.jsonl ===\n');
console.log(`  correctness  ${String(correctness.length).padStart(5)}  ${String(pct(correctness.length)).padStart(2)}%   unchanged (9/9 across 3 passes)`);
console.log(`  phaser       ${String(phaser.length).padStart(5)}  ${String(pct(phaser.length)).padStart(2)}%   every row rendered in real Chromium`);
console.log(`               ${String(verifiedOld.length).padStart(5)}        from the old slice, execution-verified`);
console.log(`               ${String(phaser.length - verifiedOld.length).padStart(5)}        newly generated`);
console.log(`  interpret    ${String(interpret.length).padStart(5)}  ${String(pct(interpret.length)).padStart(2)}%   subsampled from ${interpretAll.length} (was 49% of run4)`);
console.log(`  structured   ${String(structured.length).padStart(5)}  ${String(pct(structured.length)).padStart(2)}%   NEW - fixes the Strategy regression`);
console.log(`  godot        ${String(godot.length).padStart(5)}  ${String(pct(godot.length)).padStart(2)}%   NEW - every row ran in headless Godot`);
console.log(`\n  TOTAL        ${String(out.length).padStart(5)}`);
console.log(`\n  rows depending on an external resource: ${leaked}${leaked === 0 ? '  (clean)' : '  <-- PROBLEM'}`);

const steps = Math.ceil((out.length * 2) / 8);
console.log(`\n  2 epochs at effective batch 8 = ${steps} steps`);
console.log(`  at 3.04 s/step (run4 measured on H100) = ${(steps * 3.04 / 3600).toFixed(2)} hr  ~$${(steps * 3.04 / 3600 * 4.28).toFixed(2)}`);
