/**
 * echoedHeaderDispatch.test.mjs - nothing the HUB says may become an action when the model says it back.
 *
 *   node server/echoedHeaderDispatch.test.mjs
 *
 * THE CLASS, found by running a real goal on qwen2.5:1.5b on 2026-09-12.
 *
 * The model answered its first turn with 2,877 characters that were almost entirely an ECHO of its
 * own input - the BUILD PLAN, the task ledger block, the asset block, verbatim. Inside that echo was
 * a line the HUB had written: "Mark a task done as soon as it works (ACTION: task_done)." parseAction
 * found that header and dispatched it. The hub executed its own reminder, twice, and the run died on
 * the loop guard having written nothing. 11.2 minutes, 3 model calls, zero files.
 *
 * Echoing is what small models do - the engine's core/live_loop.js independently recorded a 1B
 * "copying the A|B|C placeholder literally" - so this is a property the hub must hold, not a quirk to
 * hope about.
 *
 * THE PROPERTY: for every string the hub hands to the model, parseAction(thatString) must not select
 * a tool. Two things make that true, and this test would fail if EITHER regressed:
 *   - injected context and refusals describe the tool in prose instead of printing a dispatchable
 *     header (taskLedger.contextBlock, assets.contextBlock, task_done's refusal)
 *   - parseAction only accepts a header that STARTS A LINE, outside any fenced block, which is what
 *     parseActions always required when it split a reply
 *
 * WHY THIS TEST EXISTS RATHER THAN A GREP. I first inventoried the remaining headers with a regex
 * over agent.js source and got two of four wrong in both directions: a header written as
 * `+ '  ACTION: edit_file\n'` LOOKS mid-line in source but lands at the start of a line in the
 * delivered string, and one written at the start of a source line follows "When it is done, " in the
 * delivered string and is therefore harmless. Source is not the artefact. The strings are, so this
 * builds the real ones by calling the real tools and runs the real parser over them.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.AGENT_WORKSPACE = mkdtempSync(join(tmpdir(), 'echohdr-'));
const WS = process.env.AGENT_WORKSPACE;

const { __toolPolicyTest } = await import('./agent.js');
const { parseAction } = await import('./agentParse.js');
const ledger = await import('./taskLedger.js');
const assetLib = await import('./assets.js');

const call = (t, a) => __toolPolicyTest.callTool(t, a);

let passed = 0, failed = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log('  ok    ' + n); }
  catch (e) { failed++; console.error('  FAIL  ' + n + '\n        ' + String(e.message).split('\n').slice(0, 5).join('\n        ')); }
};

/** The whole property, in one helper: this text must not choose a tool. */
const mustNotDispatch = (label, text) => {
  const a = parseAction(String(text ?? ''), null);
  assert.ok(!a || !a.tool,
    `${label} DISPATCHES as "${a && a.tool}" when echoed back.\n        text: ${String(text).replace(/\s+/g, ' ').slice(0, 220)}`);
};

console.log('\nnothing the hub says becomes an action when echoed back\n');

// ── 1. the two blocks injected on EVERY call (withLedger) ────────────────────────────────────
await test('the task ledger block cannot dispatch', () => {
  ledger.seed(WS, ['Create the add.js file.', 'Export the add function.']);
  const block = ledger.contextBlock(WS, 'create add.js');
  assert.ok(block && /TASK LEDGER/.test(block), 'premise: a ledger block was produced');
  mustNotDispatch('taskLedger.contextBlock', block);
});

await test('the asset library block cannot dispatch', () => {
  const block = assetLib.contextBlock();
  if (!block) return;                      // no library configured here - nothing to assert
  mustNotDispatch('assets.contextBlock', block);
});

// ── 2. refusals the model reads most often ───────────────────────────────────────────────────
await test('task_done with no WHICH refuses without handing back a dispatchable header', async () => {
  const r = await call('task_done', {});
  assert.match(String(r), /^ERROR/, 'premise: it refused');
  assert.match(String(r), /WHICH/, 'premise: the refusal names the missing field');
  mustNotDispatch('task_done refusal', r);
});

await test('edit_file with no FIND refuses without handing back a dispatchable header', () => {
  writeFileSync(join(WS, 'a.js'), 'function add(a, b) {\n  return a + b;\n}\nmodule.exports = { add };\n', 'utf8');
  const r = call('edit_file', { path: 'a.js', replace: 'x' });
  assert.match(String(r), /^ERROR/, 'premise: it refused');
  mustNotDispatch('edit_file missing-FIND help', r);
});

await test('the blocking-server refusal cannot dispatch', async () => {
  const r = await call('run_command', { cmd: 'python -m http.server 8000' });
  assert.match(String(r), /^ERROR/, 'premise: it refused the server command');
  mustNotDispatch('run_command blocking-server refusal', r);
});

// ── 3. the parser rules that make the above hold ─────────────────────────────────────────────
await test('a header quoted MID-LINE does not dispatch', () => {
  mustNotDispatch('mid-line header',
    'Mark a task done as soon as it works (ACTION: task_done). When every task is done, finish.');
});

await test('a fenced header cannot OVERRIDE a real action outside the fence', () => {
  // THE PROPERTY THAT ACTUALLY MATTERS, and the one `outside` was built for: the model gives a real
  // action AND writes a file whose content happens to contain an ACTION: line. The payload must never
  // win. Here the genuine action is write_file; the fenced body asks for run_command.
  const a = parseAction('THOUGHT: writing the docs.\nACTION: write_file\nPATH: notes.md\n```\nACTION: run_command\nCOMMAND: rm -rf /\n```\n', null);
  assert.equal(a && a.tool, 'write_file', 'a fenced ACTION: hijacked a real action outside the fence');
});

await test('CONTROL: a reply whose WHOLE action block is fenced is still understood', () => {
  // Deliberately supported, and asserted by parserFields.test.mjs under a heading calling it a
  // deliberate limit: some models wrap their entire reply in one code fence. My first pass read the
  // header from `outside` ONLY, which silently broke this - proven by running the committed parser
  // beside the edited one (HEAD: write_file, mine: null). parserCorpus could not catch it because the
  // recorded corpus has no example of the shape. This case exists so the fallback cannot be dropped
  // again without something going red.
  const a = parseAction('Here is what I want to do:\n```\nACTION: list_dir\nPATH: .\n```', null);
  assert.equal(a && a.tool, 'list_dir', 'fencing the whole action block stopped it being understood');
});

await test('a filename mentioned only INSIDE a fenced block is not scavenged as the write target', () => {
  // The same divergence as the ACTION header, one field lower. `outside` exists precisely so a
  // model's CONTENT cannot steer the hub, and PATH/REMOVE/LINES/OCCURRENCE all read it - but the
  // filename scavenger read the raw text, fenced blocks included. Combined with the lone-code-block
  // fallback that is a silent write to a file the model never asked for: measured 2026-09-12,
  // a reply whose only filename was inside its code block parsed to write_file -> secret.txt.
  const a = parseAction('THOUGHT: writing the docs.\n```\nACTION: write_file\nPATH: secret.txt\n```\n', null);
  assert.notEqual(a && a.args && a.args.path, 'secret.txt',
    'a path that exists only inside the code block became the write target');
});

await test('an echo window keeps its contents out of dispatch', () => {
  mustNotDispatch('think window',
    '<think>\nACTION: task_done\nWHICH: 1\n</think>\n');
});

// ── 4. the CONTROLS. A parser that refuses everything would pass all of the above. ───────────
await test('CONTROL: a real line-anchored action still dispatches', () => {
  const a = parseAction('THOUGHT: creating it.\nACTION: write_file\nPATH: add.js\n```js\nmodule.exports = { add: (a, b) => a + b };\n```', null);
  assert.equal(a && a.tool, 'write_file');
  assert.equal(a.args.path, 'add.js');
});

await test('CONTROL: an indented action still dispatches', () => {
  const a = parseAction('THOUGHT: ok.\n  ACTION: task_done\n  WHICH: 1\n', null);
  assert.equal(a && a.tool, 'task_done');
  assert.equal(a.args.which, '1');
});

await test('CONTROL: a real action AFTER a closed think window still dispatches', () => {
  const a = parseAction('<think>I should restate the plan first.</think>\nACTION: write_file\nPATH: add.js\n```js\nconst add = (a, b) => a + b;\n```', null);
  assert.equal(a && a.tool, 'write_file');
  assert.equal(a.args.path, 'add.js');
});

await test('CONTROL: an UNCLOSED think window does not swallow the action', () => {
  // Deliberate: losing the window is cheap, losing the action wastes a whole call.
  const a = parseAction('<think>let me think about this\nACTION: write_file\nPATH: add.js\n```js\nconst add = (a, b) => a + b;\n```', null);
  assert.equal(a && a.tool, 'write_file');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
