/**
 * planTasks.test.mjs - a plan is mostly description; only part of it is work.
 *
 *   node server/planTasks.test.mjs
 *
 * fromPlan() turned EVERY bullet in a BUILD PLAN into a ledger task. A game plan has five
 * sections (systems, gameplay loop, state, missing, build order), so a perfectly sensible
 * plan seeded 29 TASKS - measured on a live run 2026-09-10, where "Input system (arrow key
 * handling)" became something the agent had to mark complete. With a 30-step budget and a
 * finish gate that wants the ledger closed, the run was near-unfinishable before a line of
 * code was written.
 *
 * Two bugs: harvesting from every section, and a heading-skip regex written for
 * "1. SYSTEMS NEEDED" that a real model defeats by writing "1. **SYSTEMS NEEDED**".
 */
import assert from 'node:assert/strict';
const { fromPlan } = await import('./taskLedger.js');

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

// Shaped exactly like what the live run produced.
const GAME_PLAN = [
  '1. **SYSTEMS NEEDED**',
  '- Input system (arrow key handling)',
  '- Player movement system',
  '- Physics system (for collision detection)',
  '- Collectible system (item spawning and pickup)',
  '2. **GAMEPLAY LOOP**',
  '- Player moves with arrow keys',
  '- Player collides with collectibles',
  '- Win condition: collect all items',
  '3. **STATE / DATA**',
  '- player: position, velocity',
  '- collectibles: array of positions, collected flag',
  '4. **MISSING / REQUIRED**',
  '- sprite assets for player and collectible',
  '- game dimensions',
  '5. **BUILD ORDER**',
  '- Create index.html with the Phaser boot config',
  '- Load the player and collectible sprites from the asset library',
  '- Add arrow-key movement',
  '- Add collision and pickup',
  '- Test it in the browser',
];

console.log('\nplan -> tasks\n');

test('a five-section game plan yields the BUILD ORDER steps, not all 20 bullets', () => {
  const tasks = fromPlan(GAME_PLAN.join('\n'));
  console.log(`        ${tasks.length} task(s): ${tasks.slice(0, 3).join(' | ')}`);
  assert.ok(tasks.length <= 8, `${tasks.length} tasks - the whole plan is being harvested again`);
  assert.ok(tasks.length >= 3, `only ${tasks.length} tasks - the BUILD ORDER section was missed`);
  assert.match(tasks[0], /index\.html|Phaser/i, `first task is not the first build step: ${tasks[0]}`);
});

test('section headings never become tasks, even in markdown bold', () => {
  const tasks = fromPlan(GAME_PLAN.join('\n'));
  for (const t of tasks) {
    assert.ok(!/SYSTEMS NEEDED|GAMEPLAY LOOP|BUILD ORDER|STATE \/ DATA/i.test(t),
      `a section heading became a task: ${t}`);
  }
});

test('architecture notes do not become tasks', () => {
  const tasks = fromPlan(GAME_PLAN.join('\n')).join(' | ');
  assert.ok(!/Input system \(arrow key/i.test(tasks), 'a systems description became a task');
  assert.ok(!/player: position, velocity/i.test(tasks), 'a state note became a task');
});

test('a plan with NO build-order heading still yields its bullets', () => {
  const tasks = fromPlan('1. WHAT IT DOES\n- adds two numbers\n2. FILES\n- maths.js exporting add()');
  assert.ok(tasks.length >= 1, 'a plan without BUILD ORDER produced nothing');
  assert.ok(tasks.length <= 12, 'no cap applied');
});

test('the short non-game plan shape works', () => {
  const tasks = fromPlan([
    '1. WHAT IT DOES', '- exports add(a,b)',
    '2. FILES', '- counter.js',
    '3. BUILD ORDER', '- write counter.js with add()', '- run node counter.js to verify',
    '4. HOW TO VERIFY', '- node counter.js exits 0',
  ].join('\n'));
  console.log(`        non-game plan -> ${tasks.length} task(s): ${tasks.join(' | ')}`);
  assert.equal(tasks.length, 2, `expected the 2 BUILD ORDER steps, got ${tasks.length}`);
});

test('empty and junk input do not throw', () => {
  assert.deepEqual(fromPlan(''), []);
  assert.deepEqual(fromPlan(null), []);
  assert.ok(Array.isArray(fromPlan('no bullets here at all')));
});

// Shaped exactly like the 2026-10-21 Claude plan: BUILD ORDER grouped under bold labels, with
// italic "Result"/"Stretch goals" notes, and 13 real steps.
const GROUPED_PLAN = [
  '**5. BUILD ORDER**',
  '- **First playable slice (MVP):**',
  '  1. Grid render plus a player moving on the grid.',
  '  2. Action key that tills, plants and waters the targeted tile.',
  '  3. "Sleep" key that advances the day.',
  '  4. Harvesting that adds coins directly.',
  '  5. HUD showing day and coins.',
  '  - *Result:* the core loop is playable.',
  '- **Then add, in order:**',
  '  6. Tool selection plus inventory.',
  '  7. Shop: sell produce and buy seeds.',
  '  8. Energy system.',
  '  9. Dry days leading to dead crops.',
  '  10. Win/lose condition, day 30 limit and end screen.',
  '  11. Save/load to localStorage.',
  '  12. Polish: title screen, help panel, sounds.',
  '  13. Balancing pass plus unit tests on the crop/day logic.',
  '  - *Stretch goals:* weather, seasons.',
];

test('group labels and italic notes are not tasks', () => {
  const tasks = fromPlan(GROUPED_PLAN.join('\n')).join(' | ');
  assert.doesNotMatch(tasks, /First playable slice|Then add|Result:|Stretch goals/);
});

test('every real build step survives - none pushed off the end by labels', () => {
  const tasks = fromPlan(GROUPED_PLAN.join('\n'));
  assert.equal(tasks.length, 13);
  assert.match(tasks.at(-1), /^Balancing pass/);
});

test('a plain "Label: work" bullet is still a task', () => {
  assert.ok(fromPlan(GROUPED_PLAN.join('\n')).some((t) => t.startsWith('Shop: sell produce')));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
