/**
 * exec_validate.mjs — STAGE-2 validator: does the code actually RUN, not just parse?
 *
 *   node exec_validate.mjs factory/dataset_vb_sampled.jsonl
 *
 * The static gate (verify_gate / gate.mjs) proves self-containment (no undefined refs).
 * This goes further: it `node`-executes each module (with a 5s timeout that also catches
 * infinite loops) and reports whether it runs clean, throws at runtime, or hangs.
 *
 * Browser code (document/canvas/requestAnimationFrame) can't run under node, so it's
 * classified separately (would need a headless DOM to validate — the next stage up).
 * Pure-logic modules (the systems rows, which carry a console.log demo) DO run here, so
 * this gives the real execution-pass rate for them. Optional: --keep writes only the
 * runtime-clean rows to <input>.execpass.jsonl.
 */
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const IN = process.argv[2];
const KEEP = process.argv.includes('--keep');
if (!IN) { console.error('usage: node exec_validate.mjs <dataset.jsonl> [--keep]'); process.exit(1); }

const TMP = join('factory', '_exec_tmp');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const DOM = /\b(document|window\.|requestAnimationFrame|getContext|addEventListener|localStorage|HTMLCanvas|new Image|new Audio|AudioContext)\b/;
const rows = readFileSync(IN, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));

let clean = 0, threw = 0, hung = 0, noCode = 0;
const errTally = new Map();
const passRows = [];        // runtime-verified clean (node ran without throwing)
const browserRows = [];     // canvas/DOM — can't validate in node yet (pending DOM stage)

for (const r of rows) {
  const m = r.messages[2].content.match(/```\w*\n([\s\S]*?)```/);
  if (!m) { noCode++; continue; }
  const code = m[1];
  if (DOM.test(code)) { browserRows.push(r); continue; }  // needs a headless DOM, not node
  const f = join(TMP, 'e_' + createHash('sha1').update(code).digest('hex').slice(0, 12) + '.js');
  writeFileSync(f, code, 'utf8');
  try {
    execFileSync('node', [f], { timeout: 5000, stdio: 'pipe' });
    clean++; passRows.push(r);
  } catch (e) {
    if (e.signal === 'SIGTERM' || e.code === 'ETIMEDOUT') { hung++; continue; }   // infinite loop
    const err = (e.stderr ? e.stderr.toString() : '') || String(e);
    const type = (err.match(/\b(\w*Error)\b/) || [, 'Error'])[1];
    errTally.set(type, (errTally.get(type) || 0) + 1);
    threw++;
  }
}
rmSync(TMP, { recursive: true, force: true });

const nodeRan = clean + threw + hung;
const pct = (n, d) => d ? `${(100 * n / d).toFixed(1)}%` : '0%';
console.log(`\n=== stage-2 execution validation: ${IN} (${rows.length} rows) ===`);
console.log(`  browser code (not node-runnable): ${browserRows.length}`);
console.log(`  node-runnable modules:            ${nodeRan}`);
console.log(`    ├─ ran CLEAN:        ${clean}  (${pct(clean, nodeRan)} of node-runnable)`);
console.log(`    ├─ threw at runtime: ${threw}  (${pct(threw, nodeRan)})`);
console.log(`    └─ hung / infinite:  ${hung}  (${pct(hung, nodeRan)})`);
if (noCode) console.log(`  no code block: ${noCode}`);
const top = [...errTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
if (top.length) {
  console.log(`\n  runtime errors the static gate missed:`);
  for (const [t, n] of top) console.log(`    ${String(n).padStart(4)}  ${t}`);
}
if (KEEP) {
  // Keep runtime-clean + browser (not proven broken, just not node-verifiable yet).
  // Drop proven-broken: threw + hung. This is the standard exec-filter for the pipeline.
  const kept = [...passRows, ...browserRows];
  const out = IN.replace(/\.jsonl$/, '') + '.execpass.jsonl';
  writeFileSync(out, kept.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
  console.log(`\n  --keep: ${kept.length} rows -> ${out}`);
  console.log(`    (${clean} runtime-clean + ${browserRows.length} browser/pending-DOM; dropped ${threw + hung} proven-broken)`);
}
