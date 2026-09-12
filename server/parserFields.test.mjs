/**
 * parserFields.test.mjs - a field is an instruction to the hub; a fenced block is the model's content.
 *
 *   node server/parserFields.test.mjs
 *
 * Audited 2026-09-11, every case below reproduced against the real parser first:
 *   - REMOVE: written inside a code body set args.remove - so a file that merely DOCUMENTED the convention handed
 *     itself permission to delete definitions, defeating the destructive-write refusal outright;
 *   - "I will replace LINES: 10-14 of inventory.js" in a THOUGHT turned a whole-file rewrite into "delete lines
 *     10-14" and threw the fenced code away, reporting OK: edited;
 *   - OCCURRENCE: appearing in replacement text redirected the edit to a different match.
 *
 * Two rules fix all of it: fields are read from OUTSIDE fenced blocks, and LINES/OCCURRENCE/REMOVE must appear as
 * fields - at the start of a line - not as phrases in prose.
 *
 * Deliberately NOT changed, and pinned here as controls: ACTION is still matched anywhere in the reply, because some
 * models fence their entire action block and restricting it would stop those replies being understood at all. The
 * cost of ignoring a fenced LINES:/REMOVE: is a refusal or a plain rewrite - never a deletion - which is the right
 * way round for a field whose only power is to destroy.
 */
import assert from 'node:assert/strict';
import { parseAction } from './agentParse.js';

const F = '`'.repeat(3);
let passed = 0, failed = 0;
const test = (n, f) => { try { f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\nfields come from the header, not from the file being written\n');

const body = (...lines) => [F, ...lines, F].join('\n');

// ── REMOVE: the confirmation token for a destructive write ──
test('REMOVE: inside the fenced body does NOT authorise a deletion', () => {
  const a = parseAction(['THOUGHT: documenting the format.', 'ACTION: write_file', 'PATH: FORMAT.md',
    body('# How to delete on purpose', '', 'Add a line like this one:', 'REMOVE: total, subtotal')].join('\n'));
  assert.equal(a.tool, 'write_file');
  assert.equal(a.args.remove, undefined, 'a documented convention became permission to delete');
});
test('REMOVE: as an ordinary code comment does NOT authorise a deletion', () => {
  const a = parseAction(['THOUGHT: rewriting.', 'ACTION: write_file', 'PATH: cart.js',
    body('// REMOVE: total, subtotal when the legacy cart goes away', 'function subtotal(x) { return x; }')].join('\n'));
  assert.equal(a.args.remove, undefined);
});
test('REMOVE: in prose does NOT authorise a deletion', () => {
  const a = parseAction(['THOUGHT: I will REMOVE: total from the cart now.', 'ACTION: write_file', 'PATH: cart.js',
    body('function subtotal(x) { return x; }')].join('\n'));
  assert.equal(a.args.remove, undefined);
});
test('control: REMOVE: as a real field still authorises the deletion', () => {
  const a = parseAction(['THOUGHT: deliberate.', 'ACTION: write_file', 'PATH: cart.js', 'REMOVE: total',
    body('function subtotal(x) { return x; }')].join('\n'));
  assert.equal(a.args.remove, 'total');
});
test('control: REMOVE: as a real field works on an edit too', () => {
  const a = parseAction(['THOUGHT: deliberate.', 'ACTION: edit_file', 'PATH: cart.js', 'REMOVE: total', 'LINES: 2-3',
    'REPLACE:', body('// gone')].join('\n'));
  assert.equal(a.args.remove, 'total');
  assert.deepEqual(a.args.lines, [2, 3]);
});

// ── LINES: addressing, versus the same words in a sentence ──
test('LINES: in the THOUGHT does not turn a rewrite into a deletion', () => {
  const a = parseAction(['THOUGHT: I will replace LINES: 10-14 of inventory.js with the corrected loop.',
    'ACTION: edit_file', 'PATH: inventory.js',
    body('function total(items) {', '  return items.reduce((a, b) => a + b.price, 0);', '}', 'module.exports = { total };')].join('\n'));
  assert.equal(a.args.lines, undefined, 'prose supplied a line range');
  assert.ok(String(a.args.content ?? a.args.replace ?? '').includes('module.exports = { total };'),
    'the code the model sent was thrown away: ' + JSON.stringify(a.args).slice(0, 200));
});
// The case above cannot tell the two rules apart: with no FIND: and no LINES: FIELD, the whole-file-rewrite
// conversion fires before the line-range is ever read, so it passes even with the anchoring removed. THIS is the
// shape that isolates it - the same words in prose, but with a real FIND/REPLACE pair, so the conversion is not
// available and the range would be taken from the sentence. Unanchored, it parses as lines:[10,14] and turns a
// surgical two-line edit into a fourteen-line deletion. Found by a mutant escaping, which is what mutants are for.
test('LINES: in prose does not hijack an edit that has a real FIND and REPLACE', () => {
  const a = parseAction(['THOUGHT: I will replace LINES: 10-14 of inventory.js.', 'ACTION: edit_file', 'PATH: inventory.js',
    'FIND:', body('const total = 0;'), 'REPLACE:', body('const total = sum(items);')].join('\n'));
  assert.equal(a.args.lines, undefined, 'prose supplied a line range to a FIND/REPLACE edit');
  assert.equal(a.args.find, 'const total = 0;');
  assert.equal(a.args.replace, 'const total = sum(items);');
});
// Likewise: a REMOVE: at the START of a line inside the fenced body is the only fixture that distinguishes "fields
// come from outside the fences" from "fields must be line-anchored". A comment-prefixed one is caught by anchoring
// alone, so it cannot pin the `outside` rule.
test('a line-start REMOVE: inside the fenced body does not authorise a deletion', () => {
  const a = parseAction(['THOUGHT: writing the doc.', 'ACTION: write_file', 'PATH: NOTES.md',
    body('Delete on purpose like this:', 'REMOVE: total, subtotal', 'and the tool obeys.')].join('\n'));
  assert.equal(a.tool, 'write_file');
  assert.equal(a.args.remove, undefined, 'content supplied the deletion permission');
});
test('a line-start REMOVE: inside an edit body does not authorise a deletion either', () => {
  const a = parseAction(['THOUGHT: trimming.', 'ACTION: edit_file', 'PATH: cart.js', 'FIND:', body('const a = 1;'),
    'REPLACE:', body('REMOVE: total, subtotal')].join('\n'));
  assert.equal(a.args.remove, undefined, 'replacement text supplied the deletion permission');
});
// Both of these pair a line-start field inside the fenced body with a real FIND/REPLACE, so neither the anchoring
// rule nor the rewrite conversion can carry them: they fail if and only if fields are read from inside the fences.
test('a line-start OCCURRENCE: inside the body does not redirect the edit', () => {
  const a = parseAction(['THOUGHT: fixing.', 'ACTION: edit_file', 'PATH: log.js', 'FIND:', body('const a = 1;'),
    'REPLACE:', body('OCCURRENCE: 3', 'const a = 2;')].join('\n'));
  assert.equal(a.args.occurrence, undefined, 'replacement content chose which match to edit');
});
test('a line-start LINES: inside the body does not address the edit', () => {
  const a = parseAction(['THOUGHT: fixing.', 'ACTION: edit_file', 'PATH: log.js', 'FIND:', body('const a = 1;'),
    'REPLACE:', body('LINES: 10-14', 'const a = 2;')].join('\n'));
  assert.equal(a.args.lines, undefined, 'replacement content supplied a line range');
});
test('control: LINES: as a real field still addresses by line', () => {
  const a = parseAction(['THOUGHT: fixing one line.', 'ACTION: edit_file', 'PATH: inventory.js', 'LINES: 10-14',
    'REPLACE:', body('const fixed = 1;')].join('\n'));
  assert.deepEqual(a.args.lines, [10, 14]);
  assert.equal(a.args.replace, 'const fixed = 1;');
});
test('control: an indented LINES: field is still a field', () => {
  const a = parseAction(['THOUGHT: fixing.', 'ACTION: edit_file', 'PATH: a.js', '  LINES: 3-4', 'REPLACE:', body('x')].join('\n'));
  assert.deepEqual(a.args.lines, [3, 4]);
});

// ── OCCURRENCE: which match to edit ──
test('OCCURRENCE: inside the replacement text does not redirect the edit', () => {
  const a = parseAction(['THOUGHT: fixing the message.', 'ACTION: edit_file', 'PATH: log.js', 'FIND:', body('old();'),
    'REPLACE:', body('warn("OCCURRENCE: 3 matches found");')].join('\n'));
  assert.equal(a.args.occurrence, undefined, 'replacement text chose the match');
});
test('control: OCCURRENCE: as a real field still picks the match', () => {
  const a = parseAction(['THOUGHT: the third one.', 'ACTION: edit_file', 'PATH: log.js', 'OCCURRENCE: 3', 'FIND:',
    body('old();'), 'REPLACE:', body('fresh();')].join('\n'));
  assert.equal(a.args.occurrence, 3);
});

// ── the deliberate limits ──
test('control: a reply whose whole action block is fenced is still understood', () => {
  const a = parseAction(['Here is what I want to do:', F, 'ACTION: list_dir', 'PATH: .', F].join('\n'));
  assert.equal(a.tool, 'list_dir', 'fencing the action block stopped the reply being understood at all');
});
test('control: an ordinary edit with FIND and REPLACE is untouched by all of this', () => {
  const a = parseAction(['THOUGHT: small fix.', 'ACTION: edit_file', 'PATH: a.js', 'FIND:', body('return 1;'),
    'REPLACE:', body('return 2;')].join('\n'));
  assert.equal(a.args.find, 'return 1;');
  assert.equal(a.args.replace, 'return 2;');
  assert.equal(a.args.lines, undefined);
  assert.equal(a.args.remove, undefined);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
