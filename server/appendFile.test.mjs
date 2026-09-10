/**
 * appendFile.test.mjs - the missing primitive, and the wiring it needs.
 *
 *   node server/appendFile.test.mjs
 *
 * Across 32 real runs, 81% of every wasted model call was `edit_file` refusing for want
 * of a FIND snippet, and write_file was REWRITING an existing path twice as often as it
 * created one. The cause was a gap in the vocabulary: "add this to that file" could only
 * be said as "rewrite the whole file" or "find an anchor and replace it with itself plus
 * the new code". Asked directly, the model named the same gap: "The tool doesn't support
 * appending or inserting."
 *
 * Adding the tool touches FIVE places - the tool, the system prompt, AUTO_TOOLS, MUTATING
 * and the PARSER - and the parser is the silent one: miss it and the tool reports
 * "needs CONTENT" for content the model did send. That cost four calls in its first live
 * run, so it is pinned here.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ws = mkdtempSync(join(tmpdir(), 'append-'));
process.env.AGENT_WORKSPACE = ws;
const { __toolPolicyTest, WORKSPACE } = await import('./agent.js');

let passed = 0, failed = 0;
const test = (n, f) => {
  try { f(); passed++; console.log(`  ok    ${n}`); }
  catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); }
};

// Read every agent*.js in THIS directory, not './agent.js'.
//
// Two bugs in one line. It resolved against the CWD, so this passed when run from server/
// and died with ENOENT from the repo root - which is how it is actually run in a batch, so
// the failure looked like the feature breaking rather than the test. And agent.js is being
// SPLIT: the system prompt already moved to agentPrompt.js and the action parser to
// agentParse.js. A check that greps agent.js alone searches a shrinking haystack and would
// report PASS once its subject moved out. agent_audit.mjs hit this first and globs
// agent*.js for the same reason; matching it here so the split cannot quietly blind this.
const HERE = dirname(fileURLToPath(import.meta.url));
const src = readdirSync(HERE)
  .filter((f) => /^agent.*\.js$/.test(f))
  .map((f) => readFileSync(join(HERE, f), 'utf8'))
  .join('\n');
console.log('\nappend_file\n');

test('the tool exists and is auto-approved with the other file writes', () => {
  assert.match(src, /append_file\(\{ path, content/, 'no append_file tool');
  assert.match(src, /AUTO_TOOLS = new Set\(\[[^\]]*'append_file'/, 'not in AUTO_TOOLS - it would ask a human every time');
});

test('it is documented in the system prompt', () => {
  assert.match(src, /append_file — ADD to the end of a file/, 'the model is never told it exists');
});

test('it checkpoints before running, like every other mutating tool', () => {
  assert.match(src, /MUTATING = new Set\(\[[^\]]*'append_file'/, 'no checkpoint - an append would not be undoable');
});

test('THE PARSER HANDS IT THE FENCED BLOCK (the one that was missed)', () => {
  assert.match(src, /tool === 'write_file' \|\| tool === 'append_file'/,
    'the parser drops append_file content, so the tool reports "needs CONTENT" for content that WAS sent');
});

test("the missing-FIND error points at it, since that is what it exists to prevent", () => {
  assert.match(src, /To ADD something to the end of the file, use append_file/,
    'edit_file still tells the model to find-and-replace-with-itself');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
