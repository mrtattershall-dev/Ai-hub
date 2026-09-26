/**
 * farmPlantSpec.test.mjs - validate the ONE-NAMED-HANDLER play before any model sees it.
 *
 *   node server/farmPlantSpec.test.mjs
 *
 * A spec that cannot fail is not a check. farm-plant states a positive clause (on an empty tile
 * with seeds, create a crop and spend exactly one seed) and a negative one (in every other case
 * change nothing), so BOTH have to be shown failing. Each mutant below violates exactly one clause
 * and must be caught by the step that owns it:
 *
 *   positive control        a correct handler                      -> 6/6 pass
 *   the accepted page       p is bound as if it were an event name -> 1,2,3 pass, and 5 passes
 *                           VACUOUSLY (a page where p does nothing satisfies "p again changes
 *                           nothing"); 4 and 6 fail, and neither is vacuous
 *   mutant NO_SPEND         plants but never spends a seed         -> step 4 fails
 *   mutant OVERWRITE        replants on an occupied tile           -> step 5 fails
 *   mutant IGNORES_SEEDS    plants with no seeds left              -> step 6 fails
 *   mutant BREAKS_MOVEMENT  plants correctly, kills the arrow keys -> steps 2,3 fail (the
 *                                                                     protected set, separately)
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

const task = farmTasks().find((t) => t.id === 'farm-plant');
const spec = task.diagnostic.spec;
const START = readFileSync(join(HERE, '..', 'legasus', 'screen', 'NARROW-2_accepted_index.html'), 'utf8');
const WIRING = "        document.addEventListener('p', plantSeed);";

/** Replace the broken `p` wiring with a handler built from the given body. */
const withHandler = (body) => START.replace(WIRING, [
  "        document.addEventListener('keydown', (e) => {",
  "            if (e.key !== 'p') return;",
  '            const k = `${player.x},${player.y}`;',
  body,
  '            try { draw(); } catch (err) { /* draw() throws on a missing element; not under test */ }',
  '        });',
].join('\n'));

const CORRECT = withHandler([
  '            if (!tiles[k] && inventory.seeds > 0) {',
  "                tiles[k] = { crop: 'wheat', stage: 0 };",
  '                inventory.seeds--;',
  '            }',
].join('\n'));

const NO_SPEND = withHandler([
  '            if (!tiles[k] && inventory.seeds > 0) {',
  "                tiles[k] = { crop: 'wheat', stage: 0 };",
  '            }',
].join('\n'));

const OVERWRITE = withHandler([
  '            if (inventory.seeds > 0) {',
  "                tiles[k] = { crop: 'wheat', stage: 0 };",
  '                inventory.seeds--;',
  '            }',
].join('\n'));

const IGNORES_SEEDS = withHandler([
  '            if (!tiles[k]) {',
  "                tiles[k] = { crop: 'wheat', stage: 0 };",
  '                inventory.seeds--;',
  '            }',
].join('\n'));

// Correct planting, but the arrow keys stop moving the player: the protected set must catch it.
const BREAKS_MOVEMENT = CORRECT.replace("        document.addEventListener('keydown', movePlayer);", '');

async function judge(label, html) {
  const ws = mkdtempSync(join(tmpdir(), 'plant-'));
  try {
    writeFileSync(join(ws, 'index.html'), html, 'utf8');
    const r = await playCheck(ws, spec, { timeoutMs: 90_000 });
    console.log(`        ${label.padEnd(16)} ${r.status} passing [${[...r.passing].join(',')}] failing [${[...r.failing].join(',')}]`);
    return r;
  } finally { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } }
}

const eq = (a, b) => JSON.stringify([...a].sort((x, y) => x - y)) === JSON.stringify(b);

console.log('=== the task itself ===');
say(task.requested.play.steps.join() === '1,2,3,4,5,6', `requested = steps 1-6 (${task.requested.play.steps.join(',')})`);
say(task.protected.play.steps.join() === '1,2,3', `protected = movement only, checked separately (${task.protected.play.steps.join(',')})`);
say(!/t advances time by one tick; h harvests/i.test(task.goal), "the request does NOT re-list the other keys as things to build (it only forbids them)");
say(/change nothing at all/.test(task.goal), 'the request states the negative clause explicitly');

console.log('\n=== the positive control and the starting page ===');
{
  const r = await judge('CORRECT', CORRECT);
  say(r.status === 'OK' && eq(r.passing, [1, 2, 3, 4, 5, 6]), 'a correct handler passes all six steps');
  const s = await judge('accepted page', START);
  say(s.status === 'OK' && eq(s.passing, [1, 2, 3, 5]), 'the accepted increment-1 page passes movement, fails the positive planting clause (4) and the seed-exhaustion clause (6)');
  // WORTH STATING, because it is the same trap as a perfect protected score: step 5 ("p again
  // changes nothing") is VACUOUSLY satisfied by a page where p does nothing at all, which is why
  // the starting page passes it. Steps 4 and 6 are not vacuous - both require seeds to have been
  // spent - so the negative clause only carries weight alongside them, and the requested set
  // demands all six.
  say([...s.passing].includes(5) && [...s.failing].includes(4), 'step 5 alone is passable by inaction - it counts only together with steps 4 and 6');
}

console.log('\n=== one mutant per clause ===');
{
  const a = await judge('NO_SPEND', NO_SPEND);
  say(a.status === 'OK' && [...a.failing].includes(4), 'planting without spending a seed FAILS step 4');
  const b = await judge('OVERWRITE', OVERWRITE);
  say(b.status === 'OK' && [...b.failing].includes(5), 'replanting on an occupied tile FAILS step 5');
  const c = await judge('IGNORES_SEEDS', IGNORES_SEEDS);
  say(c.status === 'OK' && [...c.failing].includes(6), 'planting with no seeds left FAILS step 6');
  const d = await judge('BREAKS_MOVEMENT', BREAKS_MOVEMENT);
  say(d.status === 'OK' && ([...d.failing].includes(2) || [...d.failing].includes(3)), 'correct planting that kills the arrow keys FAILS the protected movement steps');
  say([...d.passing].includes(4), 'and that same mutant still passes the planting step, so the two are measured apart');
}

console.log(`\n  farm-plant spec: ${passed} passed, ${failed} failed -> ${failed ? 'THE SPEC IS NOT VALIDATED' : 'every clause has a mutant that breaks it, and movement is checked apart from planting'}`);
process.exit(failed ? 1 : 0);
