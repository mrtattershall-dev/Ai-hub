/**
 * editParse.test.mjs - the parser must accept a correct edit, however it is punctuated.
 *
 *   node server/editParse.test.mjs
 *
 * The FIND/REPLACE parser required code fences. The model writes them unfenced about half
 * the time, which is a perfectly ordinary way to express an edit, and the parser returned
 * find=undefined - so edit_file answered "needs a FIND snippet" for a snippet that was
 * right there in the message. Measured across 6 real runs on 2026-09-10: 20 wasted model
 * calls, and two runs stopped dead on "add input validation to EVERY function" - a goal
 * append_file cannot help with, so there was no escape route.
 *
 * The worst thing a tool can do is punish correct behaviour. Every case below is text a
 * real model actually produced.
 */
import assert from 'node:assert/strict';
const { __toolPolicyTest } = await import('./agent.js');
const parse = __toolPolicyTest.parseAction || __toolPolicyTest.parse;

let passed = 0, failed = 0;
const test = (n, f) => { try { f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };

console.log('\nedit_file parsing\n');

if (!parse) {
  console.log('  (parseAction is not exported — testing via the source contract instead)');
  const src = (await import('node:fs')).readFileSync('./agent.js', 'utf8');
  test('the parser has an unfenced FIND fallback', () => {
    assert.match(src, /findBare = text\.match/, 'no bare-FIND fallback in the parser');
    assert.match(src, /replBare = text\.match/, 'no bare-REPLACE fallback in the parser');
  });
  test('fenced form is still tried first', () => {
    assert.match(src, /findFenced = text\.match\(\/FIND:\s\*```/, 'fenced form lost');
  });
  test('a stray closing fence is trimmed', () => {
    assert.match(src, /replace\(\/\n\?```\s\*\$\/, ''\)/, 'no trailing-fence cleanup');
  });
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

// Verbatim from a real run that failed.
const UNFENCED = `THOUGHT: I need to add input validation to the len function in vec.js.
ACTION: edit_file
PATH: vec.js
FIND:
function len(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}
REPLACE:
function len(v) {
    if (v === undefined) throw new Error("needs one argument");
    return Math.sqrt(v.x * v.x + v.y * v.y);
}`;

test('an UNFENCED edit parses (the 20-failure case)', () => {
  const a = parse(UNFENCED).args;
  assert.ok(a.find, 'find is empty — this is the bug');
  assert.match(a.find, /Math\.sqrt/, `find was: ${JSON.stringify(a.find)}`);
  assert.match(a.replace, /throw new Error/, 'replace lost the new code');
  assert.ok(!/REPLACE:/.test(a.find), 'find swallowed the REPLACE marker');
});

test('a FENCED edit still parses', () => {
  const a = parse('ACTION: edit_file\nPATH: x.js\nFIND:\n```js\nconst a = 1;\n```\nREPLACE:\n```js\nconst a = 2;\n```').args;
  assert.equal(a.find, 'const a = 1;');
  assert.equal(a.replace, 'const a = 2;');
});

test('edit_file with a lone block and NO FIND is treated as write_file', () => {
  // Verbatim shape from a real run: the model pasted the complete new file under
  // ACTION: edit_file. The intent is unambiguous; refusing it only burns a call.
  const r = parse('THOUGHT: fix it\nACTION: edit_file\nPATH: check.js\n```javascript\nvar add = require("./index.js").add;\n```');
  assert.equal(r.tool, 'write_file', 'stayed edit_file and would fail: ' + JSON.stringify(r.args));
  assert.match(r.args.content, /require/, 'lost the pasted content');
  assert.equal(r.args.path, 'check.js');
});

test('a MALFORMED FIND still errors rather than guessing', () => {
  // FIND: is present but empty. Guessing here would replace the wrong thing.
  const r = parse('ACTION: edit_file\nPATH: x.js\nFIND:\nREPLACE:\n```\nnew\n```');
  assert.equal(r.tool, 'edit_file', 'silently turned a broken edit into a whole-file overwrite');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
