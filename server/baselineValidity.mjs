/**
 * baselineValidity.mjs - does the ACCEPTED increment-1 page throw during the behaviour it was
 * accepted for?
 *
 *   node server/baselineValidity.mjs
 *
 * WHY. REPAIR-2's repaired page logged four `Cannot set properties of null (setting 'textContent')`
 * errors during movement. They are not the candidate's: the accepted page's own `draw()` ends with
 * `document.getElementById('day').textContent = ...` and no such element exists. If that error
 * happens while the page performs its REQUIRED behaviour, then the acceptance that retained this
 * page rested on a check that could not see it, and that is a test-coverage gap rather than a
 * property of the page's successors.
 *
 * This runs the untouched baseline through the play and reports, per step, which errors had been
 * raised by the time that step was evaluated.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const { playCheck } = await import('./playCheck.js');
const { farmTasks } = await import('./benchTasks.js');

const BASELINE = join(HERE, '..', 'legasus', 'screen', 'NARROW-2_accepted_index.html');
const html = readFileSync(BASELINE, 'utf8');

const farmPlant = farmTasks().find((t) => t.id === 'farm-plant');
const farmI1 = farmTasks().find((t) => t.id === 'farm-i1');

for (const [label, task] of [['farm-i1 (the spec it was ACCEPTED under)', farmI1], ['farm-plant (the current spec)', farmPlant]]) {
  const spec = task.diagnostic.spec;
  const ws = mkdtempSync(join(tmpdir(), 'baseline-'));
  try {
    writeFileSync(join(ws, spec.entry || 'index.html'), html, 'utf8');
    const r = await playCheck(ws, spec, { timeoutMs: 90_000 });
    console.log(`\n=== ${label} ===`);
    console.log(`  verdict: ${r.status}  passing [${[...r.passing].join(',')}]  failing [${[...r.failing].join(',')}]`);
    for (const c of r.cases || []) {
      const errs = /errors: (.*)$/.exec(c.text || '');
      console.log(`  step ${c.n} ${c.kind.padEnd(5)} ${c.name}`);
      if (errs) console.log(`         errors visible to this step: ${errs[1].slice(0, 160)}`);
    }
    console.log(`  ERRORS RAISED IN TOTAL during the run: ${(r.errors || []).length}`);
    for (const e of (r.errors || []).slice(0, 6)) console.log(`      ${e.slice(0, 120)}`);
    const anyDuringRequired = (r.errors || []).length > 0;
    const step1Passed = [...r.passing].includes(1);
    console.log(`  => the page throws during its own required behaviour: ${anyDuringRequired ? 'YES' : 'no'}`);
    console.log(`  => and the load-time error check (step 1) still passes:  ${step1Passed ? 'YES - the gate cannot see it' : 'no'}`);
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
}
