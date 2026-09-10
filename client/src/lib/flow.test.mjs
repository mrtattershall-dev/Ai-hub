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
import { planToCodeBrief, codeToGame, hopsFor, FLOW } from './flow.js';

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
test('a strategy output offers exactly the Code hop', () => {
  const hops = hopsFor(plan(ACTION_PLAN));
  assert.equal(hops.length, 1);
  assert.equal(hops[0].to, 'code');
  assert.equal(hops[0].label, 'Build this in Code');
  assert.match(hops[0].payload.input, /Ship a playable Pong/);
});

test('an empty strategy output offers no hop, so no dead button renders', () => {
  assert.deepEqual(hopsFor(plan('')), []);
});

test('kinds with no flow, and junk, yield no hops', () => {
  assert.deepEqual(hopsFor({ kind: 'code', response: 'x' }), []);
  assert.deepEqual(hopsFor({}), []);
  assert.deepEqual(hopsFor(null), []);
});

test('a throwing derivation is swallowed rather than blanking the output block', () => {
  const original = FLOW.strategy[0].derive;
  FLOW.strategy[0].derive = () => { throw new Error('boom'); };
  try { assert.deepEqual(hopsFor(plan('x')), []); }
  finally { FLOW.strategy[0].derive = original; }
});

// every FLOW hop must name a real destination, or sendHandoff parks a payload nobody claims
test('every declared hop targets a known view', () => {
  const VIEWS = ['code', 'agent', 'game', 'godot', 'assets', 'terminal', 'strategy', 'training', 'history', 'settings'];
  for (const [from, hops] of Object.entries(FLOW)) {
    for (const h of hops) assert.ok(VIEWS.includes(h.to), `${from} -> unknown view "${h.to}"`);
  }
});

console.log(`flow: ${passed} passed${process.exitCode ? ' (with failures above)' : ''}`);
