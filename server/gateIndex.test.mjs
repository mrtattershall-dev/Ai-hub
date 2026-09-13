/**
 * gateIndex.test.mjs - pin the PRECOMPUTED WORKSPACE INDEX that every gate is handed.
 *
 *   node server/gateIndex.test.mjs
 *
 * WHY THIS EXISTS. A gate currently has to DISCOVER the workspace before it can decide anything:
 * list_dir, then outline_file, then read_file. Each of those is a full model call, and each call
 * prefills the whole prompt (measured on this machine: 4,848-6,992 tokens at 0.2-1.2 tok/s, while a
 * gate's own answer is 3-18 tokens). The last monolith run called outline_file SIX TIMES on a
 * three-line file and died on the loop guard with promptTok 4,810 -> 8,590. Handing the gate a
 * precomputed index removes the reason to hunt.
 *
 * Because this text is paid for on EVERY gate call, renderIndex() is budgeted in characters here, and
 * the budget is asserted in BOTH directions - under the cap, and still actually saying the filename,
 * the line count and the exports. A cap alone is passed by the empty string, which would be a checker
 * that cannot fail.
 *
 * RED-FIRST, and every assertion was watched failing against a deliberately naive stub before the real
 * module was written. The stub used defNames() instead of exportNames(), String#length instead of
 * Buffer.byteLength, no dotfile/package.json filtering, exports:[] for Python and no skipped[] - and
 * each of those mistakes is caught by a named test below:
 *   defNames-instead-of-exportNames  -> "no exports means NO exports, not the names it defines"
 *   length-instead-of-byteLength     -> "size is BYTES, not characters"
 *   no filtering                     -> "package.json and dotfiles are not workspace files"
 *   exports:[] for Python            -> "a Python file carries NO export info, which is not the same
 *                                        as an empty export list"
 *   no skipped[]                     -> "an unreadable entry is RECORDED, which proves the catch ran"
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gateIndex, renderIndex, actionsFor } from './gateIndex.mjs';

let passed = 0, failed = 0;
const test = (n, f) => {
  try { f(); passed++; console.log('  ok    ' + n); }
  catch (e) { failed++; console.error('  FAIL  ' + n + '\n        ' + String(e.message).split('\n').slice(0, 4).join('\n        ')); }
};

/** THE STATED BUDGET. renderIndex output for a 3-file workspace must fit in this many characters. */
const BUDGET_3_FILES = 200;
/** No single file line may exceed this, or one fat file blows the whole prompt. */
const BUDGET_PER_LINE = 80;

const ws = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'gateindex-'));
  for (const [name, body] of Object.entries(files)) {
    if (body === '<DIR>') mkdirSync(join(dir, name), { recursive: true });
    else writeFileSync(join(dir, name), body, 'utf8');
  }
  return dir;
};
const byName = (ix, name) => ix.files.find((f) => f.name === name);

console.log('\ngateIndex: what exists and where, precomputed so no gate has to hunt\n');

// ── the empty workspace ───────────────────────────────────────────────────────────────────
test('empty workspace has no files', () => {
  const ix = gateIndex(ws({}));
  assert.deepEqual(ix.files, [], 'an empty workspace must not invent entries');
});
test('empty workspace renders the explicit (none) case', () => {
  const out = renderIndex(gateIndex(ws({})));
  assert.match(out, /\(none\)/, 'a gate handed "" cannot tell an empty workspace from a broken index');
});

// ── the export shapes, which are exportNames()' job and not this module's ──────────────────
test('module.exports = function add(...) is reported as exporting add', () => {
  const ix = gateIndex(ws({ 'add.js': 'module.exports = function add(a, b) {\n  return a + b;\n};\n' }));
  assert.deepEqual(byName(ix, 'add.js').exports, ['add']);
});
test('module.exports = { add } is reported as exporting add', () => {
  const ix = gateIndex(ws({ 'add.js': 'function add(a, b) { return a + b; }\nmodule.exports = { add };\n' }));
  assert.deepEqual(byName(ix, 'add.js').exports, ['add']);
});
test('no exports means NO exports, not the names it defines', () => {
  // THE DISCRIMINATOR between exportNames() and defNames(). This file DEFINES helper and Thing, and
  // exports neither. defNames() would answer ['Thing','helper'] here, so a module that reached for the
  // wrong function in defNames.js fails exactly this line. The distinction is the whole point: the
  // gate needs to know the file exists but is NOT WIRED UP, which is the level-1 failure mode (the
  // model wrote add.js and never added module.exports).
  const ix = gateIndex(ws({ 'lonely.js': 'function helper() { return 1; }\nclass Thing {}\n' }));
  assert.deepEqual(byName(ix, 'lonely.js').exports, [], 'defined is not exported');
});

// ── a Python file carries no export information at all ────────────────────────────────────
test('a Python file carries NO export info, which is not the same as an empty export list', () => {
  // exportNames() returns an empty Set for any non-JS path, so writing exports:[] for .py would be
  // reporting "this file exports nothing" - a claim about Python that this module cannot support and
  // that is indistinguishable from the lonely.js case above. The key must be ABSENT.
  const ix = gateIndex(ws({ 'calc.py': 'def add(a, b):\n    return a + b\n' }));
  const e = byName(ix, 'calc.py');
  assert.ok(e, 'the Python file itself must still be listed - the gate needs to know it exists');
  assert.equal('exports' in e, false, 'no export claim may be made about a .py file');
});

// ── sizes and line counts ─────────────────────────────────────────────────────────────────
test('size is BYTES, not characters', () => {
  // 'é' is one character and TWO bytes in UTF-8, so String#length and Buffer.byteLength disagree here
  // and the assertion can actually fail. A byte size that is really a character count misreports every
  // file a model writes with an accented word or an emoji in a comment.
  const body = 'const s = "café";\n'; // 18 chars, 19 bytes
  const ix = gateIndex(ws({ 'uni.js': body }));
  assert.equal(byName(ix, 'uni.js').bytes, Buffer.byteLength(body, 'utf8'));
  assert.notEqual(Buffer.byteLength(body, 'utf8'), body.length, 'fixture is broken if these agree');
});
test('line count is the number of lines, not the number of newlines', () => {
  // A 3-line file with a trailing newline has 3 lines. split('\n').length answers 4 here, so the
  // off-by-one that every line counter is prone to fails this line.
  const ix = gateIndex(ws({ 'three.js': 'a;\nb;\nc;\n' }));
  assert.equal(byName(ix, 'three.js').lines, 3);
});
test('a file with no trailing newline still counts its last line', () => {
  const ix = gateIndex(ws({ 'two.js': 'a;\nb;' }));
  assert.equal(byName(ix, 'two.js').lines, 2);
});
test('an empty file is 0 lines and 0 bytes', () => {
  const ix = gateIndex(ws({ 'empty.js': '' }));
  assert.equal(byName(ix, 'empty.js').lines, 0);
  assert.equal(byName(ix, 'empty.js').bytes, 0);
});

// ── what is NOT a workspace file ──────────────────────────────────────────────────────────
test('package.json and dotfiles are not workspace files', () => {
  const ix = gateIndex(ws({
    'add.js': 'module.exports = { add };\n',
    'package.json': '{ "type": "commonjs" }\n',
    '.env': 'SECRET=1\n',
    '.eslintrc.js': 'module.exports = {};\n',
  }));
  assert.deepEqual(ix.files.map((f) => f.name), ['add.js'],
    'a gate shown package.json or .env is being invited to edit the wrong thing');
});
test('files are sorted by name, so the same workspace always renders identically', () => {
  // fs order is not guaranteed. An index that changes order between calls changes the prompt, which
  // changes the model's answer for reasons that have nothing to do with the goal.
  //
  // THE FIXTURE IS MIXED CASE ON PURPOSE. The first version of this test used a.js/b.js/c.js and was
  // UNFALSIFIABLE on Windows: readdirSync already returns those alphabetically, so it passed against a
  // stub that never sorted at all. Probed on this machine, the two orders genuinely differ:
  //   readdirSync -> ["a.js","B.js","c.js","Z.js"]   (case-insensitive, NTFS index order)
  //   JS .sort()  -> ["B.js","Z.js","a.js","c.js"]   (char code, so uppercase first)
  // Asserting the .sort() order therefore fails unless the module really sorts.
  // No case-colliding pair (b.js AND B.js) - NTFS treats those as ONE file and silently drops one.
  const ix = gateIndex(ws({ 'c.js': 'x;\n', 'a.js': 'x;\n', 'B.js': 'x;\n', 'Z.js': 'x;\n' }));
  assert.deepEqual(ix.files.map((f) => f.name), ['B.js', 'Z.js', 'a.js', 'c.js']);
});

// ── the unreadable entry, which must never throw ──────────────────────────────────────────
test('an unreadable entry is RECORDED, which proves the catch ran', () => {
  // A DIRECTORY named halfwritten.js is the portable unreadable-file fixture on this machine:
  // readFileSync throws EISDIR on it, deterministically, on Windows and Linux alike. (chmod 000 does
  // nothing on Windows; icacls could not be driven from this shell; a dangling symlink is EPERM here.)
  //
  // ASSERTING skipped[] RATHER THAN JUST "it did not throw" IS THE POINT. A module that pre-filtered
  // directories out by dirent would never reach readFileSync, so a no-throw assertion would report
  // green while the guard under test never ran - the fixture would be blocked by a different guard.
  // Naming the entry in skipped[] proves the read was attempted and the failure was caught.
  const dir = ws({ 'good.js': 'module.exports = { ok };\n', 'halfwritten.js': '<DIR>' });
  let ix;
  assert.doesNotThrow(() => { ix = gateIndex(dir); }, 'gateIndex must never throw on a bad entry');
  assert.deepEqual(ix.files.map((f) => f.name), ['good.js'], 'it still returns what it can');
  assert.ok(ix.skipped.includes('halfwritten.js'), 'the unreadable entry must be recorded, not silently dropped');
});
test('a missing workspace directory is an empty index, not a crash', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gateindex-gone-'));
  rmSync(dir, { recursive: true, force: true });
  let ix;
  assert.doesNotThrow(() => { ix = gateIndex(dir); });
  assert.deepEqual(ix.files, []);
});

// ── renderIndex: terse, and still informative ─────────────────────────────────────────────
test(`renderIndex for a 3-file workspace stays under ${BUDGET_3_FILES} characters`, () => {
  const out = renderIndex(gateIndex(ws({
    'add.js': 'module.exports = function add(a, b) {\n  return a + b;\n};\n',
    'main.js': 'const { add } = require("./add");\nconsole.log(add(2, 3));\n',
    'notes.md': 'plan\n',
  })));
  assert.ok(out.length < BUDGET_3_FILES, `renderIndex cost ${out.length} chars, budget ${BUDGET_3_FILES}`);
  // The number itself is the point of the module, so it is REPORTED, not just bounded. A budget that
  // passes silently tells nobody what the prompt actually costs.
  console.log(`        measured: ${out.length} chars for 3 files (budget ${BUDGET_3_FILES}), rendered as:`);
  for (const l of out.split('\n')) console.log('          | ' + l);
});
test('renderIndex still says the filename, the line count and the exports', () => {
  // THE OTHER DIRECTION OF THE BUDGET. '' and '(none)' both fit the cap trivially, so without this the
  // budget test would be passed by a module that renders nothing at all.
  const out = renderIndex(gateIndex(ws({ 'add.js': 'module.exports = function add(a, b) {\n  return a + b;\n};\n' })));
  assert.match(out, /add\.js/, 'the gate cannot name a file it was not shown');
  assert.match(out, /3 lines/, 'the line count is how a gate knows the file is a stub');
  assert.match(out, /exports: add/, 'the export name is why the index replaces outline_file');
});
test('renderIndex marks a JS file that exports NOTHING', () => {
  // This is the level-1 failure the index is meant to make visible: add.js exists, looks done, and has
  // no module.exports. Rendering it identically to a wired-up file hides the one fact that matters.
  const out = renderIndex(gateIndex(ws({ 'add.js': 'function add(a, b) { return a + b; }\n' })));
  assert.match(out, /exports: none/);
});
test('renderIndex makes no export claim about a Python file', () => {
  const out = renderIndex(gateIndex(ws({ 'calc.py': 'def add(a, b):\n    return a + b\n' })));
  assert.match(out, /calc\.py/);
  assert.equal(/exports/.test(out), false, 'no export claim may be rendered for .py');
});
test('renderIndex keeps every single line inside the per-line budget', () => {
  // ONE FILE HERE EXPORTS TWENTY NAMES, and that is what makes this test able to fail. The first
  // version gave every file a single short export, so no line could have approached the cap however
  // verbose the renderer was - it passed against the naive stub for no reason at all. A barrel file
  // with twenty exports is ordinary, and pasting all twenty into the prompt is exactly the token cost
  // this module exists to avoid, so the renderer has to cap the list.
  const many = {};
  for (let i = 0; i < 12; i++) many[`f${i}.js`] = `module.exports = { fn${i} };\n`;
  const wide = Array.from({ length: 20 }, (_, i) => `wideName${i}`);
  many['wide.js'] = `module.exports = { ${wide.join(', ')} };\n`;
  const out = renderIndex(gateIndex(ws(many)));
  for (const line of out.split('\n')) {
    assert.ok(line.length <= BUDGET_PER_LINE, `line of ${line.length} chars exceeds ${BUDGET_PER_LINE}: ${line}`);
  }
  // AND THE TRUNCATION MUST SAY SO. Silently showing 3 of 20 exports tells the gate the other 17 do
  // not exist, which is a lie the gate would act on.
  const wideLine = out.split('\n').find((l) => l.startsWith('wide.js'));
  assert.match(wideLine, /more/, 'a capped export list must admit it was capped');
});
test('renderIndex opts.max caps how many files are rendered', () => {
  const many = {};
  for (let i = 0; i < 9; i++) many[`f${i}.js`] = 'x;\n';
  const out = renderIndex(gateIndex(ws(many)), { max: 3 });
  assert.equal(out.split('\n').filter((l) => /^f\d\.js/.test(l)).length, 3);
  assert.match(out, /6 more/, 'a truncated index must say it is truncated, or the gate trusts a lie');
});

// ── actionsFor: each gate sees ONLY its own options ───────────────────────────────────────
test('every gate offers at least one and at most four actions', () => {
  // The measured claim behind the whole module: finish scored 0/10 as one option among four, and 10/10
  // asked alone. A list that grows back into a menu is the regression to catch.
  for (const g of ['route', 'path', 'body', 'repair', 'finish']) {
    const a = actionsFor(g);
    assert.ok(Array.isArray(a), `${g} must return an array`);
    assert.ok(a.length >= 1 && a.length <= 4, `${g} offers ${a.length} actions`);
  }
});
test('route offers write_file, which is the only action its parser accepts today', () => {
  assert.ok(actionsFor('route').includes('write_file'));
});
test('finish is a two-way yes/no, not a menu', () => {
  assert.equal(actionsFor('finish').length, 2, 'finish measured 0/10 the moment it was one option among four');
});
test('an unknown gate offers nothing rather than guessing', () => {
  assert.deepEqual(actionsFor('nope'), []);
  assert.deepEqual(actionsFor(undefined), []);
});
test('actionsFor hands back a copy, so a caller cannot mutate the table', () => {
  // A gate prompt builder that push()es onto this array would silently widen every later gate's menu.
  const a = actionsFor('route');
  a.push('rm -rf');
  assert.equal(actionsFor('route').includes('rm -rf'), false);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
