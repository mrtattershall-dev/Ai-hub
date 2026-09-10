/**
 * parserCorpus.test.mjs - run the parser against what models ACTUALLY said.
 *
 *   node server/parserCorpus.test.mjs
 *
 * WHY THE EXISTING SUITE MISSED THREE PARSER BUGS. Every other test here scripts the model,
 * and the script is written by the same person as the assertions - so the replies always
 * parse, always carry a PATH:, always finish. A green suite proved the parser handled the
 * inputs its author imagined.
 *
 * `server/testdata/model-corpus.jsonl` is 1,759 unique responses harvested from 396 real
 * runs across four model sizes: 106 distinct response SHAPES, 102 that pack several actions
 * into one reply, 349 with no THOUGHT line. Nobody designed these to be awkward; they are
 * simply what came back.
 *
 * This asserts INVARIANTS, not outputs. What a specific response should parse to is a
 * judgement call that would rot; what must NEVER happen does not:
 *
 *   - the parser must not throw on anything a model can emit
 *   - it must not name a tool that does not exist
 *   - it must not resolve a write to a path outside the workspace
 *   - a write tool must never be handed an undefined path
 *
 * It also CHARACTERISES the known multi-action loss, so if someone later makes the loop
 * execute batches, this test tells them how many recorded responses that changes.
 *
 * Free and offline. No GPU, no network, deterministic.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, 'testdata', 'model-corpus.jsonl');

// Import the parser only; agent.js is not needed and would touch a workspace at import.
const { parseAction } = await import('./agentParse.js');

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};

console.log('\nparser vs. the real-response corpus\n');

if (!existsSync(CORPUS)) {
  console.error(`  SKIP  corpus missing at ${CORPUS}`);
  console.error('        rebuild it from run archives before trusting a green result here');
  process.exit(0);
}
const rows = readFileSync(CORPUS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
console.log(`  corpus: ${rows.length} real responses\n`);

// Ask the REAL tool table, do not restate it.
//
// This started as a hand-written list and immediately failed on `see_screen` - a tool that
// has existed in agent.js since long before this test. The parser was right and my list was
// wrong, which is the whole failure mode this file exists to avoid: an assertion that
// encodes the author's belief rather than the system's behaviour. `hasTool` is the same
// lookup the run loop does (`tools[tool]`), so the two cannot drift.
process.env.AGENT_WORKSPACE = process.env.AGENT_WORKSPACE || mkdtempSync(join(tmpdir(), 'corpus-ws-'));
const { __toolPolicyTest } = await import('./agent.js');
const dispatchable = (name) => __toolPolicyTest.hasTool(name) || name === 'finish';
const WRITES = new Set(['write_file', 'append_file', 'edit_file']);

const parsed = [];
test('the parser never throws on a real response', () => {
  const boom = [];
  for (const r of rows) {
    try { parsed.push({ r, out: parseAction(r.text, 'prior.js') }); }
    catch (e) { boom.push(`${e.message} :: ${r.text.slice(0, 70).replace(/\s+/g, ' ')}`); }
  }
  assert.equal(boom.length, 0, `threw on ${boom.length} response(s):\n        ${boom.slice(0, 3).join('\n        ')}`);
});

test('every tool it names is one the loop can dispatch', () => {
  const unknown = new Map();
  for (const { out } of parsed) {
    if (!out || !out.tool) continue;
    if (!dispatchable(out.tool)) unknown.set(out.tool, (unknown.get(out.tool) || 0) + 1);
  }
  assert.equal(unknown.size, 0,
    `parser emitted tools the loop has no handler for: ${[...unknown.entries()].map(([t, n]) => `${t} x${n}`).join(', ')}`);
});

test('no write is ever resolved to a path outside the workspace', () => {
  const escapes = [];
  for (const { out } of parsed) {
    if (!out || !WRITES.has(out.tool)) continue;
    const p = String(out.args?.path ?? '');
    if (!p) continue;
    const norm = p.split('\\').join('/');
    if (isAbsolute(p) || /^[A-Za-z]:/.test(p) || norm.split('/').includes('..')) escapes.push(p);
  }
  assert.equal(escapes.length, 0, `paths escaping the workspace: ${[...new Set(escapes)].slice(0, 5).join(', ')}`);
});

test('a write tool is never handed an undefined path', () => {
  const nulls = parsed.filter(({ out }) => out && WRITES.has(out.tool) && !out.args?.path);
  assert.equal(nulls.length, 0,
    `${nulls.length} write(s) parsed with no destination - the tool would write nowhere or throw`);
});

test('write_file and append_file always carry their content', () => {
  const empty = parsed.filter(({ r, out }) =>
    out && (out.tool === 'write_file' || out.tool === 'append_file') && r.fenced && !out.args?.content);
  assert.equal(empty.length, 0,
    `${empty.length} response(s) had a fenced block that never reached the tool - this is the exact "needs CONTENT" bug append_file shipped with`);
});

// ── characterisation, not a pass/fail on behaviour ───────────────────────────
test('the multi-action loss is measured, so a future batch-executor knows its scope', () => {
  const multi = rows.filter((r) => r.actions.length > 1);
  const droppedFinish = multi.filter((r) => r.actions.indexOf('finish') > 0);
  console.log(`        ${multi.length} of ${rows.length} responses carry >1 action; ${droppedFinish.length} contain a finish that is not first`);
  // Not an assertion about desired behaviour - a tripwire. If this hits zero the corpus was
  // rebuilt from a model that stopped batching, and these numbers need re-deriving.
  assert.ok(multi.length > 0, 'corpus no longer contains multi-action responses - re-derive the finding before citing it');
});

test('a response with no THOUGHT is almost always a PLANNER turn, not a wasted call', () => {
  // Nearly reported "349 responses produced nothing" as a finding. 333 of them are plan
  // turns, which are SUPPOSED to be prose with no ACTION - the planner runs before the
  // build loop. Counting them as waste would have been badly wrong, so the real number is
  // asserted here to stop anyone (me included) citing the scary one.
  const noThought = parsed.filter(({ r }) => !r.hasThought);
  const isPlan = ({ r }) => /^(BUILD PLAN|PLAN:|1\.\s*WHAT IT DOES)/i.test(r.text.trim());
  const plans = noThought.filter(isPlan).length;
  const withAction = noThought.filter(({ r }) => r.actions.length).length;
  const wasted = noThought.filter((x) => !isPlan(x) && !x.r.actions.length).length;
  console.log(`        no-THOUGHT: ${noThought.length} total = ${plans} planner turns + ${withAction} with an action + ${wasted} genuinely wasted`);
  assert.ok(wasted <= noThought.length * 0.05,
    `${wasted} of ${noThought.length} no-THOUGHT responses were neither a plan nor an action - real waste, worth a look`);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
