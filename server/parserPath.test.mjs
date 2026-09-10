/**
 * parserPath.test.mjs - where does a write GO when the model does not say?
 *
 *   node server/parserPath.test.mjs
 *
 * Found by probing the real parser rather than reading it, after the 14B destroyed a working
 * q1_math.js at goal 6 of a 35-goal run. Three defects, all in how a missing PATH: is
 * resolved, all silent - the write reports OK and lands somewhere nobody asked for:
 *
 *   1. the first filename mentioned ANYWHERE in the text was used, INCLUDING inside the
 *      THOUGHT. "q1_math.js already works, so now I will extend q2_str.js" wrote to
 *      q1_math.js and overwrote it.
 *   2. `langFile[fenceLang] || lastPath` put a generic per-language default AHEAD of the
 *      file the model was demonstrably just editing - a js fence with lastPath=q3_list.js
 *      went to `script.js`.
 *   3. 'index.html' was the final fallback for ANY fence language, so a stray block could
 *      land on a working game page.
 *
 * LATENT, not active: 0 of 1,759 recorded real model responses omitted PATH on a write - a
 * larger model always sends it. A small one does not, which is the likely mechanism behind
 * the 14B's loss. Pinned because "only small models hit it" is exactly the class of bug this
 * project keeps shipping.
 */
import assert from 'node:assert/strict';
import { parseAction } from './agentParse.js';

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${e.message}`); }
};
const fence = (lang, body) => '```' + lang + '\n' + body + '\n```';

console.log('\nparser: where a write lands\n');

test('an explicit PATH always wins', () => {
  const r = parseAction(`THOUGHT: x\nACTION: write_file\nPATH: q7_check.js\n${fence('javascript', 'const a=1;')}`, 'other.js');
  assert.equal(r.args.path, 'q7_check.js');
});

test('lastPath BEATS the per-language default', () => {
  // The bug: this returned 'script.js', ignoring the file being edited.
  const r = parseAction(`THOUGHT: fixing it.\nACTION: write_file\n${fence('javascript', 'const a=1;')}`, 'q3_list.js');
  assert.equal(r.args.path, 'q3_list.js', 'a generic default outranked the file actually being edited');
});

test('a filename in the THOUGHT never overwrites a DIFFERENT working file', () => {
  // The exact shape that destroyed q1_math.js: two files named, neither is the target.
  const text = `THOUGHT: q1_math.js already works, so now I will extend q2_str.js.\nACTION: write_file\n${fence('javascript', 'function slug(s){return s;}')}`;
  const r = parseAction(text, undefined);
  assert.notEqual(r?.args?.path, 'q1_math.js',
    'wrote to the file the THOUGHT said was already working — this is how a good file gets destroyed');
});

test('ONE unambiguous filename may still be used as a guess', () => {
  const text = `THOUGHT: extending it.\nACTION: write_file\n${fence('javascript', 'const a=1;')}\nthis updates q2_str.js`;
  const r = parseAction(text, undefined);
  assert.equal(r.args.path, 'q2_str.js', 'a single named file is evidence and should not be thrown away');
});

test('TWO different filenames must not be resolved by coin flip', () => {
  // "first" and "last" are each wrong half the time, depending on phrasing.
  const a = parseAction(`THOUGHT: update q2_str.js using helpers from q1_math.js.\nACTION: write_file\n${fence('javascript', 'x')}`, undefined);
  assert.ok(a?.args?.path !== 'q1_math.js' && a?.args?.path !== 'q2_str.js',
    'picked one of two candidate files with no basis');
});

test('a non-html fenced block does not fall back to index.html', () => {
  const r = parseAction(`ACTION: write_file\n${fence('javascript', 'const a=1;')}`, undefined);
  assert.notEqual(r?.args?.path, 'index.html', 'a js block landed on the entry point');
});

test('the forgiving no-ACTION fallback still salvages a lone block', () => {
  // Deliberately preserved: small models paste a fixed file with no ACTION header, and
  // salvaging that is worth more than the stray file it occasionally creates.
  const r = parseAction(`Here is the fix:\n${fence('javascript', 'const a=1;')}`, 'q9_slow.js');
  assert.equal(r?.tool, 'write_file');
  assert.equal(r.args.path, 'q9_slow.js', 'salvage should target the file being worked on');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
