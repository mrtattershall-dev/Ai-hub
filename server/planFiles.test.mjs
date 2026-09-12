/**
 * planFiles.test.mjs - the plan's FILES list, and which ledger tasks belong to THIS run.
 *
 *   node server/planFiles.test.mjs
 *
 * Both halves come from one false "done" in the 14B data run (2026-09-10, goal 9): the plan
 * listed S_QUEUE.md under FILES; the model never wrote it, closed a task left over from goal 1,
 * and task_done told it "ALL 3 TASKS FOR THIS GOAL ARE COMPLETE" - three tasks EARLIER goals
 * had finished, because adopt() only marked unfinished leftovers as carried. It finished.
 *
 * The plans below are the 14B's real plans from that run, verbatim.
 */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ws = mkdtempSync(join(tmpdir(), 'planfiles-'));
process.env.AGENT_WORKSPACE = ws;
process.env.AGENT_TRACES_DIR = join(ws, '..', `planfiles-traces-${Date.now()}`);
const ledger = await import('./taskLedger.js');
const { __toolPolicyTest: T } = await import('./agent.js');

let passed = 0, failed = 0;
const test = async (n, f) => {
  try { await f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); }
};

const REASONING_PLAN = "1. **WHAT IT DOES**: Determine if `pop()` in `s4_queue.js` is stable when two items have equal priority and, if not, make it stable by adding an assertion.\n\n2. **FILES**:\n   - `S_QUEUE.md`: Document the reasoning about the stability of `pop()` in `s4_queue.js`.\n   - `s4_queue.js`: Add an assertion to ensure `pop()` is stable.\n\n3. **BUILD ORDER**:\n   - Outline `s4_queue.js` to understand its structure.\n   - Read the relevant part of `s4_queue.js` to identify the `pop()` function.\n   - Document the reasoning in `S_QUEUE.md`.\n   - Add an assertion to `s4_queue.js` to ensure stability.\n   - Run `s4_queue.js` with `node` to verify the assertion.\n\n4. **HOW TO VERIFY**: Run `node s4_queue.js` and check for any assertion errors. If no errors, `pop()` is stable.";
const WEB_PLAN = "1. WHAT IT DOES — Create an HTML file with a button and a counter that increments on click using a separate JavaScript file.\n2. FILES — \n   - `s5_index.html` — HTML file with a button and a counter.\n   - `s5_app.js` — JavaScript file to handle the button click and counter increment.\n3. BUILD ORDER — \n   - Create `s5_app.js` with the logic to increment the counter on button click.\n   - Create `s5_index.html` and include the `s5_app.js` at the end of the body.\n4. HOW TO VERIFY — Open `s5_index.html` in a browser, click the button, and verify the counter increments.";
const GAME_PLAN = "1. **SYSTEMS NEEDED**\n   - Input System: Handles keyboard input for arrow keys.\n   - Player System: Manages the player-controlled square.\n\n2. **GAMEPLAY LOOP**\n   - The player uses arrow keys to move a square around the canvas.\n\n4. **MISSING / REQUIRED**\n   - UI: Canvas element in `s13_game.html`.\n\n5. **BUILD ORDER**\n   - **Step 1**: Create `s13_game.html` with a canvas element.\n   - **Step 2**: Create `s13_game.js` and set up the basic structure.";

console.log('\nfilesFromPlan - real 14B plans\n');

await test('the reasoning plan (**FILES**:) yields S_QUEUE.md and s4_queue.js', () => {
  assert.deepEqual(ledger.filesFromPlan(REASONING_PLAN), ['S_QUEUE.md', 's4_queue.js']);
});
await test('the web plan (FILES —) yields both files', () => {
  assert.deepEqual(ledger.filesFromPlan(WEB_PLAN), ['s5_index.html', 's5_app.js']);
});
await test('a game plan with no FILES section yields nothing (the gate stays out of the way)', () => {
  assert.deepEqual(ledger.filesFromPlan(GAME_PLAN), []);
});
await test('files on the heading line itself are found', () => {
  assert.deepEqual(ledger.filesFromPlan('1. WHAT IT DOES - x\n2. FILES — `a.js`, `b.py`\n3. BUILD ORDER - go'), ['a.js', 'b.py']);
});
await test('bare names are the fallback when nothing is backticked', () => {
  assert.deepEqual(ledger.filesFromPlan('2. FILES:\n - notes.md - the notes\n - calc.js (the maths)\n3. BUILD ORDER:\n - write'), ['notes.md', 'calc.js']);
});
await test('anything that could point outside the workspace is dropped', () => {
  const plan = '2. FILES:\n - `../x.js`\n - `/etc/y.js`\n - `C:/z.js`\n - `http://h/w.js`\n - `sub/ok.js`\n3. BUILD ORDER:';
  assert.deepEqual(ledger.filesFromPlan(plan), ['sub/ok.js']);
});
await test('empty and junk input do not throw', () => {
  for (const x of ['', null, undefined, 42, 'FILES', '2. FILES:\n\n\n']) assert.ok(Array.isArray(ledger.filesFromPlan(x)));
});

console.log('\nwhich ledger tasks are THIS run\'s\n');

await test('adopt() marks EVERY prior task carried - done ones too - and still counts only open ones as `carried`', () => {
  ledger.seed(ws, ['write the stack', 'test the stack', 'add clear()']);
  ledger.mark(ws, '1', 'done');
  ledger.mark(ws, '2', 'done');
  const r = ledger.adopt(ws, 'run-2');
  assert.deepEqual(r, { carried: 1, prior: 3 });
  assert.ok(ledger.read(ws).every((t) => t.carried), 'a prior task was left looking like this run\'s own');
  const p = ledger.progress(ws);
  assert.equal(p.own, 0);
  assert.equal(p.remainingOwn, 0);
  assert.equal(p.carried, 1);
});

await test('adopt() twice is a no-op the second time', () => {
  assert.deepEqual(ledger.adopt(ws, 'run-2'), { carried: 0, prior: 0 });
});

// A leftover is now addressed BY TITLE, not by position. Set G (2026-09-11) measured why: 43 of 44 real task_done
// calls sent a bare number that landed on goal 1's carried task while the model worked on an unrelated goal, and each
// was told "OK". taskLedger.mark() therefore refuses a NUMBER that resolves to a carried task and names it instead;
// naming it in full still works, which is what these two cases do. What they assert is unchanged.
await test('closing a LEFT-OVER task does not announce this goal complete (goal 9)', async () => {
  const r = String(await T.callTool('task_done', { which: 'add clear()' }));
  assert.match(r, /LEFT OVER from earlier work/, r.slice(0, 200));
  assert.doesNotMatch(r, /TASKS FOR THIS GOAL ARE COMPLETE/, 'the false "all done" is back: ' + r.slice(0, 200));
  assert.match(r, /no tasks of its own/, 'it should send the model to check the deliverables itself');
});

await test('the carried marker survives a later rewrite of the ledger', () => {
  ledger.mark(ws, 'write the stack', 'todo');
  ledger.mark(ws, 'write the stack', 'done');
  assert.ok(ledger.read(ws).every((t) => t.carried));
});

await test('a task THIS run adds is its own, and closing it reports the goal complete', async () => {
  ledger.add(ws, ['document the queue']);
  assert.equal(ledger.progress(ws).own, 1);
  const r = String(await T.callTool('task_done', { which: 'document the queue' }));
  assert.match(r, /ALL 1 TASKS FOR THIS GOAL ARE COMPLETE/, r.slice(0, 200));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
