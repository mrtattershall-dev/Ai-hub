/**
 * farmPlantV2Spec.test.mjs - validate the VERSIONED corrected check, and record what it reveals
 * about the page that was already accepted.
 *
 *   node server/farmPlantV2Spec.test.mjs
 *
 * The accepted increment-1 page throws five times during the arrow-key movement it was accepted
 * FOR: draw() ends with `document.getElementById('day').textContent` and the element does not
 * exist. Step 1 cannot see it, because step 1 is evaluated before any key is pressed. farm-plant-v2
 * adds a final step asserting no error was raised at any point.
 *
 * What has to be true for that version to be worth having:
 *   1. the untouched baseline FAILS it, and fails it on the new step specifically;
 *   2. a correct planting handler alone STILL fails it, because the latent defect is not the
 *      handler's - so the new step is not secretly a planting check;
 *   3. supplying the missing element as well passes all seven, so the spec is satisfiable;
 *   4. the OLD spec is untouched, so earlier results stay interpretable.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const { playCheck } = await import('./playCheck.js');
const { farmTasks } = await import('./benchTasks.js');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const v1 = farmTasks().find((t) => t.id === 'farm-plant');
const v2 = farmTasks().find((t) => t.id === 'farm-plant-v2');
const BASE = readFileSync(join(HERE, '..', 'legasus', 'screen', 'NARROW-2_accepted_index.html'), 'utf8');

const HANDLER = [
  "        document.addEventListener('keydown', (e) => {",
  "            if (e.key !== 'p') return;",
  '            const k = `${player.x},${player.y}`;',
  '            if (!tiles[k] && inventory.seeds > 0) {',
  "                tiles[k] = { crop: 'wheat', stage: 0 };",
  '                inventory.seeds--;',
  '            }',
  '        });',
].join('\n');

const withHandler = BASE.replace("        document.addEventListener('p', plantSeed);", HANDLER);
const withElement = withHandler.replace(
  '<canvas id="gameCanvas" width="800" height="600"></canvas>',
  '<canvas id="gameCanvas" width="800" height="600"></canvas>\n    <div id="day"></div>',
);

async function judge(label, html, spec) {
  const ws = mkdtempSync(join(tmpdir(), 'v2spec-'));
  try {
    writeFileSync(join(ws, 'index.html'), html, 'utf8');
    const r = await playCheck(ws, spec, { timeoutMs: 90_000 });
    console.log(`        ${label.padEnd(42)} passing [${[...r.passing].join(',')}] failing [${[...r.failing].join(',')}]  errors ${(r.errors || []).length}`);
    return r;
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log('=== the versioned spec exists alongside the old one ===');
say(!!v2 && v2.requested.play.steps.length === 7, `farm-plant-v2 requests 7 steps (${v2?.requested?.play?.steps?.join(',')})`);
say(v1.requested.play.steps.length === 6, `farm-plant is UNCHANGED at 6 steps (${v1.requested.play.steps.join(',')})`);
say(v2.protected.play.steps.join() === '1,2,3', 'the protected set is still movement only');
say(/No page or console error may be raised/.test(v2.goal), 'and the request states the new requirement');

console.log('\n=== what it reveals about the accepted page ===');
{
  const b = await judge('untouched baseline, v2', BASE, v2.diagnostic.spec);
  say([...b.failing].includes(7), 'the ACCEPTED baseline fails the new step 7');
  say((b.errors || []).length > 0, `and it does raise errors during the run (${(b.errors || []).length})`);
  say([...b.passing].includes(1), 'while still passing step 1, which is what made the gap invisible');

  const h = await judge('+ a correct planting handler, v2', withHandler, v2.diagnostic.spec);
  say([...h.passing].includes(4) && [...h.failing].includes(7),
    'a correct handler passes planting and STILL fails step 7, so step 7 is not a planting check in disguise');

  const e = await judge('+ handler AND the missing #day element, v2', withElement, v2.diagnostic.spec);
  say([...e.passing].length === 7 && e.failing.size === 0, `supplying the element too passes all seven, so the spec is satisfiable (passing [${[...e.passing].join(',')}])`);
}

console.log('\n=== the old spec still says what it always said ===');
{
  const b1 = await judge('untouched baseline, v1', BASE, v1.diagnostic.spec);
  say([...b1.passing].join() === '1,2,3,5', `v1 still scores the baseline [${[...b1.passing].join(',')}], as it did before`);
}

console.log(`\n  farm-plant-v2 spec: ${passed} passed, ${failed} failed -> ${failed ? 'THE VERSIONED CHECK IS NOT ESTABLISHED' : 'the corrected check catches the latent defect, is satisfiable, and leaves the old spec alone'}`);
process.exit(failed ? 1 : 0);
