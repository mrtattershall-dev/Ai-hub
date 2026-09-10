/**
 * flow.test.mjs - the tab-to-tab derivations, checked without a browser.
 *
 *   node client/src/lib/flow.test.mjs
 *
 * These are the functions that decide what a plan turns into and which code block gets
 * run, so they are worth pinning: a silent regression here does not throw, it just hands
 * the next tab the wrong text.
 */
import assert from 'node:assert/strict';
import {
  planToCodeBrief, codeToGame, hopsFor, planToChain, parseListItems, verdictToFix,
  chainBlockReason, historyToPlan, godotVerdictToFix,
  FLOW, MAX_CHAIN, MAX_FIX_ERRORS, MAX_FIX_CODE, MAX_GODOT_FIX_ERRORS,
} from './flow.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

const plan = (body) => ({ kind: 'strategy', response: body, streaming: false });

const ACTION_PLAN = `## Goal
Ship a playable Pong in the hub.

## Milestones
1. Paddle input
2. Ball physics
3. Score

## Risks & Mitigations
Do not use the farm schema; Pong types are registered at runtime.`;

// ---- planToCodeBrief --------------------------------------------------------------
test('carries goal, work and risks across under stable headings', () => {
  const out = planToCodeBrief(plan(ACTION_PLAN));
  assert.equal(out.task, 'generate');
  assert.equal(out.from, 'strategy');
  assert.match(out.input, /^Goal\nShip a playable Pong/);
  assert.match(out.input, /Build this\n1\. Paddle input/);
  assert.match(out.input, /Constraints to respect\nDo not use the farm schema/);
});

test('carries the plan verbatim, not summarised', () => {
  const out = planToCodeBrief(plan(ACTION_PLAN));
  for (const line of ['Paddle input', 'Ball physics', 'Score']) {
    assert.ok(out.input.includes(line), `dropped "${line}"`);
  }
});

test('matches section labels case-insensitively', () => {
  const out = planToCodeBrief(plan('## GOAL\ng\n\n## tasks\nt'));
  assert.match(out.input, /Goal\ng/);
  assert.match(out.input, /Build this\nt/);
});

test('Project Map labels (Overview / Key Components) map onto the same brief', () => {
  const out = planToCodeBrief(plan('## Overview\nA hub.\n\n## Key Components\nServer, client.'));
  assert.match(out.input, /Goal\nA hub\./);
  assert.match(out.input, /Build this\nServer, client\./);
});

test('unrecognised headings fall back to the whole plan rather than an empty brief', () => {
  const text = '## Wildcard\nsomething the canvas invented';
  const out = planToCodeBrief(plan(text));
  assert.equal(out.input, text);
});

test('unheaded prose passes through', () => {
  const out = planToCodeBrief(plan('just a paragraph'));
  assert.equal(out.input, 'just a paragraph');
});

test('empty or whitespace-only response yields no hop', () => {
  assert.equal(planToCodeBrief(plan('')), null);
  assert.equal(planToCodeBrief(plan('   \n  ')), null);
  assert.equal(planToCodeBrief({ kind: 'strategy' }), null);
  assert.equal(planToCodeBrief(undefined), null);
});

// ---- codeToGame -------------------------------------------------------------------
test('prefers a tagged js block over an earlier html one', () => {
  const text = '```html\n<div>x</div>\n```\n```js\nrun();\n```';
  assert.equal(codeToGame(text).code, 'run();');
});

test('prefers js over a LATER shell block (position must not decide)', () => {
  const text = '```js\nrun();\n```\nthen:\n```bash\nnpm i\n```';
  assert.equal(codeToGame(text).code, 'run();');
});

test('falls back to html, then to an untagged block', () => {
  assert.equal(codeToGame('```html\n<b>h</b>\n```').code, '<b>h</b>');
  assert.equal(codeToGame('```\nbare\n```').code, 'bare');
});

test('a reply with only a shell block is not runnable', () => {
  assert.equal(codeToGame('```bash\nnpm i\n```'), null);
});

test('no code block at all yields null', () => {
  assert.equal(codeToGame('no code here'), null);
  assert.equal(codeToGame(''), null);
  assert.equal(codeToGame(undefined), null);
});

// ---- hopsFor ----------------------------------------------------------------------
test('a strategy output offers the Code hop and the queue-chain hop', () => {
  const hops = hopsFor(plan(ACTION_PLAN));
  assert.deepEqual(hops.map(h => h.to), ['code', 'agent']);
  assert.equal(hops[0].label, 'Build this in Code');
  assert.match(hops[0].payload.input, /Ship a playable Pong/);
  assert.equal(hops[1].action, 'queueChain');
  assert.equal(hops[1].payload.goals.length, 3);
});

test('an empty strategy output offers no hop, so no dead button renders', () => {
  assert.deepEqual(hopsFor(plan('')), []);
});

test('a plan with no work section still offers Code, and blocks the chain with a reason', () => {
  const hops = hopsFor(plan('## Goal\nShip it.\n\n## Risks\nprose, no bullets'));
  assert.deepEqual(hops.map(h => h.to), ['code', 'agent']);

  const chain = hops.find(h => h.to === 'agent');
  assert.equal(chain.payload, null);
  // The reason has to name the fix, not the rule it broke: this text is the entire
  // explanation the user gets for why unattended execution is unavailable.
  assert.match(chain.blocked, /the "## Tasks" section/);
  assert.match(chain.blocked, /Refine it/);
});

test('a work section written as prose blocks the chain and asks for bullets', () => {
  const chain = hopsFor(plan('## Goal\nShip it.\n\n## Tasks\nFirst the paddle, then the ball.'))
    .find(h => h.to === 'agent');
  assert.equal(chain.payload, null);
  assert.match(chain.blocked, /"Tasks" is written as prose/);
  assert.match(chain.blocked, /bulleted list/);
});

test('a chainable plan reports no block', () => {
  const chain = hopsFor(plan(ACTION_PLAN)).find(h => h.to === 'agent');
  assert.equal(chain.blocked, null);
  assert.equal(chain.payload.goals.length, 3);
  // null from the reason and goals from the derivation are two answers to one question;
  // if they ever disagree, a hop silently vanishes again.
  assert.equal(chainBlockReason(plan(ACTION_PLAN)), null);
});

test('an empty plan has no block reason, so an empty output block stays button-free', () => {
  assert.equal(chainBlockReason(plan('')), null);
});

test('kinds with no flow, and junk, yield no hops', () => {
  assert.deepEqual(hopsFor({ kind: 'code', response: 'x' }), []);
  assert.deepEqual(hopsFor({}), []);
  assert.deepEqual(hopsFor(null), []);
});

test('a throwing derivation drops its own hop and leaves the others alone', () => {
  const original = FLOW.strategy[0].derive;
  FLOW.strategy[0].derive = () => { throw new Error('boom'); };
  try {
    // 'x' has no work section, so the chain hop is blocked-with-a-reason rather than
    // absent. What matters here is that the throwing hop is gone and nothing propagated.
    assert.deepEqual(hopsFor(plan('x')).map(h => h.to), ['agent']);
  } finally {
    FLOW.strategy[0].derive = original;
  }
});

// ---- historyToPlan ----------------------------------------------------------------
test('a saved row becomes a plan the hops can act on again', () => {
  const revived = historyToPlan({
    tab: 'strategy', task: 'plan', provider: 'claude', response: ACTION_PLAN,
    prompt: 'build pong', tokens_used: 812, created_at: 1789000000,
  });
  assert.equal(revived.kind, 'strategy');
  assert.equal(revived.canvasId, 'plan');
  assert.equal(revived.label, 'Action Plan');
  assert.equal(revived.createdAt, 1789000000 * 1000);   // seconds in the DB, ms in the client
  assert.equal(revived.fromHistory, true);
  assert.deepEqual(hopsFor({ ...revived, streaming: false }).map(h => h.to), ['code', 'agent']);
});

test('a row with an unknown task still revives, under a neutral label', () => {
  const revived = historyToPlan({ task: 'not-a-canvas', response: ACTION_PLAN });
  assert.equal(revived.canvasId, null);
  assert.equal(revived.label, 'Saved plan');
});

test('an empty row revives to nothing', () => {
  assert.equal(historyToPlan({ response: '   ' }), null);
  assert.equal(historyToPlan(null), null);
});

// every FLOW hop must name a real destination, or sendHandoff parks a payload nobody claims
test('every declared hop targets a known view', () => {
  const VIEWS = ['code', 'agent', 'game', 'godot', 'assets', 'terminal', 'strategy', 'training', 'history', 'settings'];
  for (const [from, hops] of Object.entries(FLOW)) {
    for (const h of hops) assert.ok(VIEWS.includes(h.to), `${from} -> unknown view "${h.to}"`);
  }
});

// ---- parseListItems ---------------------------------------------------------------
test('one item per top-level bullet, whatever the marker', () => {
  assert.deepEqual(parseListItems('- a\n* b\n+ c\n1. d\n2) e'), ['a', 'b', 'c', 'd', 'e']);
});

test('indented lines fold into the item above, not into new items', () => {
  const items = parseListItems('- Set up Phaser\n  * init game\n  * set size\n- Add paddles');
  assert.equal(items.length, 2);
  assert.equal(items[0], 'Set up Phaser\ninit game\nset size');
  assert.equal(items[1], 'Add paddles');
});

test('a tab counts as indentation, same as spaces', () => {
  assert.deepEqual(parseListItems('- top\n\tnested'), ['top\nnested']);
});

test('prose before the first bullet is dropped, not turned into an item', () => {
  assert.deepEqual(parseListItems('Here is the plan:\n- do it'), ['do it']);
});

test('a section with no bullets yields nothing', () => {
  assert.deepEqual(parseListItems('just a paragraph of prose'), []);
  assert.deepEqual(parseListItems(''), []);
  assert.deepEqual(parseListItems(undefined), []);
});

// ---- planToChain ------------------------------------------------------------------
test('each milestone becomes its own goal, carrying the plan for context', () => {
  const out = planToChain(plan(ACTION_PLAN));
  assert.equal(out.goals.length, 3);
  assert.match(out.goals[0], /^Paddle input/);
  for (const g of out.goals) assert.match(g, /Part of: Ship a playable Pong in the hub\./);
});

test('a goal stands alone: sub-points travel with it', () => {
  const out = planToChain(plan('## Goal\nG\n\n## Tasks\n- Big step\n  - detail one\n  - detail two'));
  assert.match(out.goals[0], /Big step\ndetail one\ndetail two/);
});

test('risks never become goals', () => {
  const out = planToChain(plan(ACTION_PLAN));
  for (const g of out.goals) assert.doesNotMatch(g, /farm schema/);
});

test('a long plan is capped and says how much it dropped', () => {
  const many = Array.from({ length: MAX_CHAIN + 5 }, (_, i) => `- step ${i}`).join('\n');
  const out = planToChain(plan(`## Goal\nG\n\n## Tasks\n${many}`));
  assert.equal(out.goals.length, MAX_CHAIN);
  assert.equal(out.dropped, 5);
});

test('no work section, no bullets, or no plan at all: no chain', () => {
  assert.equal(planToChain(plan('## Goal\nonly a goal')), null);
  assert.equal(planToChain(plan('## Tasks\nprose with no bullets')), null);
  assert.equal(planToChain(plan('')), null);
  assert.equal(planToChain(undefined), null);
});

test('a plan without a Goal section still chains, just without the context line', () => {
  const out = planToChain(plan('## Tasks\n- alpha\n- beta'));
  assert.deepEqual(out.goals, ['alpha', 'beta']);
});

// ---- verdictToFix -----------------------------------------------------------------
const FAIL = {
  ok: false,
  verdict: 'Nothing was drawn to the canvas.',
  checks: { engineLoaded: true, rendered: false, canvasWidth: 0, canvasHeight: 0 },
  errors: ['TypeError: x is not a function'],
};

test('a passing verdict offers no repair', () => {
  assert.equal(verdictToFix({ ok: true, verdict: 'clean' }, { code: 'x' }), null);
  assert.equal(verdictToFix(null), null);
});

test('the brief names the verdict, the failed check and the errors', () => {
  const out = verdictToFix(FAIL, { code: 'run()', engine: 'phaser' });
  assert.equal(out.task, 'debug');
  assert.equal(out.from, 'game');
  assert.match(out.input, /^This phaser code failed verification/);
  assert.match(out.input, /Nothing was drawn to the canvas\./);
  assert.match(out.input, /nothing rendered \(canvas 0x0\)/);
  assert.match(out.input, /- TypeError: x is not a function/);
});

test('a check that passed is not reported as a failure', () => {
  const out = verdictToFix(FAIL, { code: 'run()' });
  assert.doesNotMatch(out.input, /engine never loaded/);
});

test('the same error repeated every frame is reported once', () => {
  const spam = { ...FAIL, errors: Array.from({ length: 60 }, () => 'Boom') };
  const out = verdictToFix(spam, { code: 'run()' });
  assert.equal(out.input.match(/- Boom/g).length, 1);
  assert.doesNotMatch(out.input, /further distinct errors/);
});

test('more distinct errors than the cap are trimmed, and the trim is admitted', () => {
  const many = { ...FAIL, errors: Array.from({ length: MAX_FIX_ERRORS + 3 }, (_, i) => `err ${i}`) };
  const out = verdictToFix(many, { code: 'run()' });
  assert.equal(out.input.match(/^- err /gm).length, MAX_FIX_ERRORS);
  assert.match(out.input, /3 further distinct errors omitted/);
});

test('errors arriving as objects are unwrapped, not stringified as [object Object]', () => {
  const out = verdictToFix({ ...FAIL, errors: [{ message: 'real message' }] }, { code: 'x' });
  assert.match(out.input, /- real message/);
  assert.doesNotMatch(out.input, /\[object Object\]/);
});

test('missing assets are named, with the canonical rule attached', () => {
  const out = verdictToFix({ ...FAIL, assetsMissing: ['hero.png', 'jump.wav'] }, { code: 'x' });
  assert.match(out.input, /hero\.png, jump\.wav/);
  assert.match(out.input, /canonical asset names only/);
});

test('the failing code travels with the brief, asking for a whole file back', () => {
  const out = verdictToFix(FAIL, { code: 'const a = 1;' });
  assert.match(out.input, /Return the corrected file in full, not a diff/);
  assert.match(out.input, /```js\nconst a = 1;\n```/);
});

test('an oversized file is truncated and says so, rather than being sent whole', () => {
  const out = verdictToFix(FAIL, { code: 'z'.repeat(MAX_FIX_CODE + 500) });
  assert.match(out.input, /truncated/);
  assert.ok(out.input.length < MAX_FIX_CODE + 2000, 'the cap must actually bound the brief');
});

test('no code still produces a usable brief rather than nothing', () => {
  const out = verdictToFix(FAIL, {});
  assert.ok(out.input.length > 0);
  assert.doesNotMatch(out.input, /```/);
});


// ---- Godot verdict -> repair brief --------------------------------------------------
// Moved here with the function itself: one home for tab-to-tab handoffs, and the tests
// belong beside the code they pin. The Godot brief differs from the Chromium one in the
// thing that matters most - Godot errors carry an ADDRESS (res://File.gd:LINE), so the
// brief can name the line instead of quoting a message and hoping the model finds it.

const GD_FAIL = {
  ok: false,
  verdict: 'Parsed, but errored while running.',
  stages: [{ stage: 'parse', ok: true }, { stage: 'run', ok: false }],
  errors: [{ message: "Invalid access to property 'foo'", file: 'res://Player.gd', line: 7 }],
};
const GD_FILES = [{ path: 'res://Player.gd', content: 'extends Node2D' }];

test('a passing Godot verdict produces no repair brief', () => {
  assert.equal(godotVerdictToFix({ ok: true, verdict: 'fine' }, []), null);
  assert.equal(godotVerdictToFix(null, []), null);
});

test('the Godot brief leads with the address of the error', () => {
  const fix = godotVerdictToFix(GD_FAIL, GD_FILES);
  assert.equal(fix.task, 'debug');
  assert.equal(fix.from, 'godot');
  assert.ok(fix.input.includes('res://Player.gd:7'), 'names the line');
  assert.ok(fix.input.includes('Failed stage(s): run'));
  assert.ok(fix.input.includes('```gdscript res://Player.gd'), 'the project that failed travels with it');
});

test('the same Godot error repeating every frame is sent once', () => {
  const same = { message: 'nope', file: 'res://A.gd', line: 3 };
  const fix = godotVerdictToFix({ ok: false, errors: Array(60).fill(same) }, []);
  assert.equal((fix.input.match(/res:\/\/A\.gd:3/g) || []).length, 1);
});

test('missing Godot resources are named, with the rule that explains them', () => {
  const fix = godotVerdictToFix(
    { ok: false, verdict: 'missing', errors: [], assetsMissing: [{ path: 'res://art/hero.png' }] }, []);
  assert.ok(fix.input.includes('res://art/hero.png'));
  assert.match(fix.input, /Do not invent art paths/);
});

test('"ran but did nothing" asks for behaviour, not for a bug fix', () => {
  // Telling a model to fix the error when there was no error sends it hunting for one.
  const fix = godotVerdictToFix({
    ok: false,
    verdict: 'nothing observable happened',
    stages: [{ stage: 'run', ok: true }, { stage: 'activity', ok: false }],
    errors: [],
  }, []);
  assert.match(fix.input, /did nothing observable/);
  assert.doesNotMatch(fix.input, /Errors:/);
});

test('the two repair briefs stay distinguishable', () => {
  // Both land in the Code tab, and `from` is how a reader (or a later hop) tells which
  // verifier spoke. Collapsing them would make a Godot failure look like a Chromium one.
  assert.equal(godotVerdictToFix(GD_FAIL, GD_FILES).from, 'godot');
  assert.ok(MAX_GODOT_FIX_ERRORS > 0);
});

console.log(`flow: ${passed} passed${process.exitCode ? ' (with failures above)' : ''}`);
