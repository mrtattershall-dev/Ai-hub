/**
 * makeVerifiedBaseline.mjs - build and VALIDATE a starting page through the full required
 * interaction sequence, so later work is not built on an unverified baseline again.
 *
 *   node server/makeVerifiedBaseline.mjs [--write]
 *
 * WHY. The page every increment-2 experiment started from was accepted by a check evaluated BEFORE any
 * key was pressed, and it raises five errors during the very movement it was accepted for. Four
 * experiments inherited that. A baseline has to be validated the way it will be used: through the whole
 * sequence, with errors counted throughout.
 *
 * WHAT IS CHANGED, and it is the minimum: the accepted page's `draw()` ends with
 * `document.getElementById('day').textContent = ...` and the document has no such element. One element
 * is added. No behaviour is written, and planting is deliberately NOT added - that is the task.
 *
 * WHAT IS THEN REQUIRED OF IT:
 *   1. movement passes (steps 1-3) with ZERO errors raised anywhere in the run
 *   2. the strict spec's "no error at any point" step passes
 *   3. planting still FAILS - a baseline that already planted would make the task vacuous
 *   4. it is byte-stable: writing it twice gives the same sha256
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const WRITE = process.argv.includes('--write');
const { playCheck } = await import('./playCheck.js');
const { farmTasks } = await import('./benchTasks.js');

const ACCEPTED = join(HERE, '..', 'legasus', 'screen', 'NARROW-2_accepted_index.html');
const OUT = join(HERE, '..', 'legasus', 'bench', 'farm', 'baseline-verified.html');
const src = readFileSync(ACCEPTED, 'utf8');

const NEEDLE = '<canvas id="gameCanvas" width="800" height="600"></canvas>';
if (!src.includes(NEEDLE)) { console.error('the accepted page does not have the canvas line this patch anchors on'); process.exit(2); }
const built = src.replace(NEEDLE, `${NEEDLE}\n    <div id="day"></div>`);

const sha = (t) => createHash('sha256').update(t).digest('hex');
console.log(`source   ${sha(src).slice(0, 16)}  ${src.length} chars`);
console.log(`built    ${sha(built).slice(0, 16)}  ${built.length} chars   (+1 element, no behaviour)`);
console.log(`built twice is identical: ${sha(src.replace(NEEDLE, `${NEEDLE}\n    <div id="day"></div>`)) === sha(built) ? 'YES' : 'NO'}`);

const v1 = farmTasks().find((t) => t.id === 'farm-plant');
const v2 = farmTasks().find((t) => t.id === 'farm-plant-v2');

async function judge(label, html, task) {
  const ws = mkdtempSync(join(tmpdir(), 'vb-'));
  try {
    writeFileSync(join(ws, 'index.html'), html, 'utf8');
    const r = await playCheck(ws, task.diagnostic.spec, { timeoutMs: 90_000 });
    console.log(`  ${label.padEnd(34)} passing [${[...r.passing].join(',')}] failing [${[...r.failing].join(',')}]  errors ${(r.errors || []).length}`);
    return r;
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log('\nthe page it replaces, through the same sequence:');
const oldV2 = await judge('accepted page, strict spec', src, v2);
console.log('\nthe candidate baseline:');
const newV1 = await judge('verified baseline, 6-step spec', built, v1);
const newV2 = await judge('verified baseline, strict spec', built, v2);

const checks = [
  ['movement passes', [1, 2, 3].every((n) => newV2.passing.has(n))],
  ['ZERO errors raised anywhere in the run', (newV2.errors || []).length === 0],
  ['the strict no-error step passes', newV2.passing.has(7)],
  ['planting still FAILS, so the task is not vacuous', newV2.failing.has(4) && newV2.failing.has(6)],
  ['the page it replaces raised errors', (oldV2.errors || []).length > 0],
];
console.log('');
let ok = true;
for (const [what, pass] of checks) { console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${what}`); if (!pass) ok = false; }

if (!ok) { console.log('\n  the candidate baseline is NOT verified; nothing written.'); process.exit(1); }
if (WRITE) {
  writeFileSync(OUT, built, 'utf8');
  console.log(`\n  written: ${OUT}`);
  console.log(`  sha256:  ${sha(built)}`);
} else {
  console.log('\n  verified. Re-run with --write to install it.');
}
console.log('  NOTE: verified means "passes these checks through the full sequence", not "correct".');
