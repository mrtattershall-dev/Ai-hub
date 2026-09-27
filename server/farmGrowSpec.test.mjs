/**
 * farmGrowSpec.test.mjs - validate the FRESH task's checks before any policy sees it.
 *
 *   node server/farmGrowSpec.test.mjs
 *
 * farm-grow is the task ASSIST-2 will be judged on, and I am allowed to supply its requirement and its
 * checks. So those checks have to be shown to catch the ways a growth implementation can be wrong,
 * before anything tries to satisfy them:
 *
 *   a correct implementation                        6/6 pass
 *   the ASSIST-1 page, untouched (no t handling)    1,2,3 pass, and 6 passes VACUOUSLY (a page whose
 *                                                   t does nothing creates nothing); 4 and 5 fail
 *   grows with no cap                               step 5 fails
 *   advances the day only, never grows              step 4 fails
 *   grows but creates a tile as a side effect       step 6 fails
 *   grows but forgets the day                       step 4 fails
 *   breaks planting while adding growth             the PROTECTED set fails
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

const task = farmTasks().find((t) => t.id === 'farm-grow');
const START = readFileSync(join(HERE, '..', 'legasus', 'screen', 'ASSIST-1_accepted_index.html'), 'utf8');
const ANCHOR = "        document.addEventListener('keydown', (e) => {";
if (!START.includes(ANCHOR)) { console.error('the ASSIST-1 page does not have the handler this test extends'); process.exit(2); }

/** Add a second listener with the given body, leaving the existing one alone. */
const withT = (body) => START.replace(ANCHOR, [
  "        document.addEventListener('keydown', (e) => {",
  "            if (e.key === 't') {",
  body,
  '                try { draw(); } catch (err) { /* not under test */ }',
  '            }',
  '        });',
  ANCHOR,
].join('\n'));

const CORRECT = withT([
  '                day++;',
  '                for (const key of Object.keys(tiles)) {',
  '                    if (tiles[key].stage < 3) tiles[key].stage++;',
  '                }',
].join('\n'));

const NO_CAP = withT(['                day++;', '                for (const key of Object.keys(tiles)) tiles[key].stage++;'].join('\n'));
const DAY_ONLY = withT(['                day++;'].join('\n'));
const CREATES_TILE = withT([
  '                day++;',
  '                for (const key of Object.keys(tiles)) { if (tiles[key].stage < 3) tiles[key].stage++; }',
  "                tiles['9,9'] = { crop: 'weed', stage: 0 };",
].join('\n'));
const FORGETS_DAY = withT(['                for (const key of Object.keys(tiles)) { if (tiles[key].stage < 3) tiles[key].stage++; }'].join('\n'));
// Growth added correctly, planting broken on the way: the protected set must catch it.
const BREAKS_PLANTING = CORRECT.replace('if (!tiles[k] && inventory.seeds > 0) {', 'if (false) {');

async function judge(label, html, spec) {
  const ws = mkdtempSync(join(tmpdir(), 'grow-'));
  try {
    writeFileSync(join(ws, 'index.html'), html, 'utf8');
    const r = await playCheck(ws, spec, { timeoutMs: 90_000 });
    console.log(`        ${label.padEnd(36)} passing [${[...r.passing].join(',')}] failing [${[...r.failing].join(',')}]  errors ${(r.errors || []).length}`);
    return r;
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log('=== the task supplies a requirement and checks, not a site ===');
say(!!task.requirement && task.requirement.trigger.key === 't', 'the requirement names the trigger key and the effects');
say(!/addEventListener|plantSeed|advanceTime|line \d+/.test(task.goal), 'and the goal names no site, function or line');
say(task.protected.play.steps.join() === '1,2,3', 'planting and movement are the protected set');

console.log('\n=== the correct implementation, and the page it starts from ===');
{
  const c = await judge('a correct growth handler', CORRECT, task.diagnostic.spec);
  say([...c.passing].length === 6 && c.failing.size === 0, `a correct implementation passes all six (passing [${[...c.passing].join(',')}])`);
  const s = await judge('the ASSIST-1 page, untouched', START, task.diagnostic.spec);
  say([...s.passing].join() === '1,2,3,6' && [...s.failing].join() === '4,5', 'the starting page passes what it already did and fails the steps that require growth');
  // Recorded rather than hidden: step 6 says "t creates and removes nothing", which a page where t does
  // NOTHING satisfies. It is vacuously passable by inaction, exactly like the negative clause in the
  // plant spec, so it only carries weight beside steps 4 and 5 - and the requested set demands all six.
  say([...s.passing].includes(6), 'step 6 alone is passable by inaction, so it counts only beside steps 4 and 5');
}

console.log('\n=== one mutant per way growth can be wrong ===');
{
  const a = await judge('grows with no cap', NO_CAP, task.diagnostic.spec);
  say([...a.failing].includes(5), 'growing past stage 3 FAILS step 5');
  const b = await judge('advances the day only', DAY_ONLY, task.diagnostic.spec);
  say([...b.failing].includes(4), 'advancing the day without growing FAILS step 4');
  const c = await judge('grows but creates a tile', CREATES_TILE, task.diagnostic.spec);
  // This mutant is why step 4 carries the tile-set check: it rewrites the SAME key on every press, so a
  // count comparison at step 6 never moves and the mutant escaped. The set comparison at the FIRST
  // press catches it.
  say([...c.failing].includes(4), 'creating a tile as a side effect FAILS step 4, at the first press');
  const d = await judge('grows but forgets the day', FORGETS_DAY, task.diagnostic.spec);
  say([...d.failing].includes(4), 'growing without advancing the day FAILS step 4');
  const e = await judge('growth added, planting broken', BREAKS_PLANTING, task.protected.play.spec);
  say([...e.failing].includes(3), 'breaking planting while adding growth FAILS the PROTECTED set');
}

console.log(`\n  farm-grow spec: ${passed} passed, ${failed} failed -> ${failed ? 'THE FRESH TASK IS NOT VALIDATED' : 'every way growth can be wrong has a check that catches it, and the site is not supplied'}`);
process.exit(failed ? 1 : 0);
