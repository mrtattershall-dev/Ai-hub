/**
 * plannerFrame.test.mjs - the plan must fit the goal.
 *
 *   node server/plannerFrame.test.mjs
 *
 * One planner prompt served every goal and it assumed a game: "senior game/software
 * architect", SYSTEMS NEEDED (input, player, physics, inventory), a GAMEPLAY LOOP with a
 * win/lose condition, a crop state machine as the worked example, a "first-PLAYABLE
 * slice". Given "write a function add(a, b)", phi3 (3.8B) produced a game design document
 * with an Input System, spent 4.5 minutes on that one call and never wrote a file. A 14B
 * answered "SYSTEMS NEEDED — None" and got on with it.
 *
 * A capable model routes around a bad frame; a small one obeys it. This repo exists to
 * train small models, so the frame has to be right rather than survivable.
 */
import assert from 'node:assert/strict';

const { __modelCallTest } = await import('./agent.js');
const { isGameGoal, planTaskFor, plannerSystemFor } = __modelCallTest;

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

console.log('\nplanner frame\n');

const GAMES = [
  'Build a Phaser game where an orc walks with arrow keys and collects coins',
  'make a platformer with enemies and a score',
  'a Godot RPG with a tilemap',
  'add a win/lose condition to the puzzle',
];
const NOT_GAMES = [
  'write a function add(a, b)',
  'Create counter.js exporting add(a,b), then verify it runs',
  'parse this CSV and write a summary to stdout',
  'refactor the auth module and add tests',
  'document the API from the real code',
];

test('game goals are detected', () => {
  for (const g of GAMES) assert.ok(isGameGoal(g), `not detected as a game: ${g}`);
});

test('ordinary coding goals are NOT treated as games', () => {
  for (const g of NOT_GAMES) assert.ok(!isGameGoal(g), `wrongly treated as a game: ${g}`);
});

test('a non-game goal never sees GAMEPLAY LOOP or a win/lose condition', () => {
  const t = planTaskFor('write a function add(a, b)');
  assert.ok(!/GAMEPLAY LOOP/i.test(t), 'still asks for a gameplay loop');
  assert.ok(!/win\/lose/i.test(t), 'still asks for a win/lose condition');
  assert.ok(!/PLAYABLE/i.test(t), 'still asks for a playable slice');
  assert.ok(!/crop|inventory|player/i.test(t), 'still carries game vocabulary');
});

test('a non-game goal is told to keep the plan SHORT', () => {
  const t = planTaskFor('write a function add(a, b)');
  assert.match(t, /under 12 lines/i, 'no length ceiling - a small model will ramble');
  assert.match(t, /single small function or file/i, 'no escape hatch for a trivial goal');
});

test('a game goal still gets the game plan', () => {
  const t = planTaskFor('Build a Phaser game with an orc and coins');
  assert.match(t, /GAMEPLAY LOOP/i, 'games lost their gameplay loop');
  assert.match(t, /BUILD ORDER/i, 'games lost their build order');
});

test('the system frame matches the goal', () => {
  assert.match(plannerSystemFor('build a phaser game'), /game architect/i);
  assert.match(plannerSystemFor('write a function add(a, b)'), /software engineer/i);
  assert.ok(!/game/i.test(plannerSystemFor('write a function add(a, b)')),
    'a plain coding goal is still framed as a game');
});

test('both frames still forbid writing code in the plan', () => {
  for (const g of ['build a phaser game', 'write a function add(a,b)']) {
    assert.match(planTaskFor(g), /do NOT write code/i, `plan for "${g}" lost the no-code rule`);
    assert.match(plannerSystemFor(g), /do NOT write code/i, `system for "${g}" lost the no-code rule`);
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
