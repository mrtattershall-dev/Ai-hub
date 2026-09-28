/**
 * outlineMap.test.mjs - what outline_file shows a model about a CLASS.
 *
 *   node server/outlineMap.test.mjs
 *
 * THE DEFECT, traced 2026-09-12 from one run end to end (set J, coder14b 8e7cf9aa, goal 11):
 * the model's FIRST move was outline_file on a 26-line s1_library.js, and the hub answered
 *
 *     [s1_library.js - 26 lines, 1 declarations]
 *     1: class Library {
 *
 * Four methods, none shown. buildOutline's six patterns all anchor on function/class/const/def, and a bare class
 * method - "  addBook(isbn, title, copies = 1) {" - matches none of them. The model then invented addBook's body,
 * and the duplicate guard correctly refused it; its next three FINDs quoted a body that was never in the file. The
 * run landed ZERO writes, yet finished "Verified (node): ... ran and exited cleanly". Checker: impl false,
 * "threw: l.checkout is not a function".
 *
 * The system prompt tells the model to use this tool "Before EDITING, to find exactly which function you need to
 * change and where it starts, so your FIND snippet matches one place". Archive-wide, 224 of 651 outline_file calls
 * on a JS file returned a class name and nothing else - 34% of all JS orientation calls, on files up to 75 lines.
 *
 * defNames.js ALREADY gets this right (it returns Library, addBook, copies, titles for this exact file). The shape
 * was solved in one module and not used in the other.
 *
 * Each case runs the SHIPPED buildOutline against an explicit copy of the SUPERSEDED rule and asserts they
 * DISAGREE. Written that way on purpose: a case phrased as "precondition: the shipped rule is broken" stops being
 * able to fail the moment the fix lands, which is how a green suite starts proving nothing.
 */
import assert from 'node:assert/strict';

const { __outlineTest } = await import('./agent.js');
const { buildOutline } = __outlineTest;

let passed = 0, failed = 0;
const test = (n, f) => {
  try { f(); passed++; console.log('  ok    ' + n); }
  catch (e) { failed++; console.error('  FAIL  ' + n + '\n        ' + String(e.message).split('\n').slice(0, 5).join('\n        ')); }
};

/** The SIX patterns as they shipped before this fix. Kept verbatim so every case below is a real disagreement. */
const OLD_PATS = [
  /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/,
  /^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|\{|\[)/,
  /^\s*([A-Za-z_$][\w$]*)\s*[:=]\s*(?:async\s*)?function/,
  /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/,
  /^\s*class\s+([A-Za-z_]\w*)\s*[:(]/,
];
const oldOutline = (lines) => {
  const out = [];
  for (let i = 0; i < lines.length; i++) for (const re of OLD_PATS) if (re.test(lines[i])) { out.push((i + 1) + ': ' + lines[i].trim()); break; }
  return out;
};

/** s1_library.js EXACTLY as it stood when run 8e7cf9aa outlined it. */
const LIBRARY = [
  'class Library {',
  '  constructor() {',
  '    this.books = {};',
  '  }',
  '',
  '  addBook(isbn, title, copies = 1) {',
  "    if (typeof copies !== 'number' || copies <= 0) {",
  "      throw new Error('Copies must be a positive integer');",
  '    }',
  '    if (!this.books[isbn]) {',
  '      this.books[isbn] = { title, copies };',
  '    } else {',
  '      this.books[isbn].copies += copies;',
  '    }',
  '  }',
  '',
  '  copies(isbn) {',
  '    return this.books[isbn] ? this.books[isbn].copies : 0;',
  '  }',
  '',
  '  titles() {',
  '    return Object.values(this.books).map(book => book.title).sort();',
  '  }',
  '}',
  '',
  'module.exports = Library;',
];

const names = (rows) => rows.map((r) => r.replace(/^\d+: /, ''));

console.log('\nwhat outline_file shows a model about a class (shipped rule vs the rule it replaced)\n');

test('THE BUG: the real s1_library.js - the old rule finds ONLY the class', () => {
  const before = oldOutline(LIBRARY);
  assert.equal(before.length, 1, 'the superseded rule must find exactly one declaration here');
  assert.match(before[0], /^1: class Library \{/, 'and that one is the class line the run actually saw');
  const now = buildOutline(LIBRARY);
  assert.ok(now.length > before.length,
    'the shipped rule must find more than the class alone - got ' + now.length + ': ' + JSON.stringify(names(now)));
});

test('every method the model needed is listed, with its real line number', () => {
  const rows = buildOutline(LIBRARY);
  const joined = rows.join('\n');
  assert.match(joined, /^6: addBook\(isbn, title, copies = 1\) \{$/m,
    'addBook must be listed at line 6 - this is the body the model invented three times');
  assert.match(joined, /^17: copies\(isbn\) \{$/m, 'copies at line 17');
  assert.match(joined, /^21: titles\(\) \{$/m, 'titles at line 21');
  assert.match(joined, /^1: class Library \{$/m, 'the class itself must still be listed');
});

test('control flow is NOT a declaration', () => {
  const rows = buildOutline([
    'class K {',
    '  go(n) {',
    '    if (n > 0) {',
    '    for (const x of n) {',
    '    while (n) {',
    '    } catch (e) {',
    '  }',
    '}',
  ]).join('\n');
  for (const kw of ['if', 'for', 'while', 'catch']) {
    assert.doesNotMatch(rows, new RegExp('^\d+: ' + kw + '\b', 'm'), kw + ' must never be reported as a declaration');
  }
  assert.match(rows, /^2: go\(n\) \{$/m, 'the real method still is one');
});

test('a test callback is a CALL, not a definition', () => {
  const rows = buildOutline([
    "describe('Library', function() {",
    "  it('adds a book', function () {",
    '    assert.ok(true);',
    '  });',
    '});',
  ]).join('\n');
  assert.doesNotMatch(rows, /^\d+: it\(/m, "it('...', function () { is a call - defNames.js narrowed for exactly this");
  assert.doesNotMatch(rows, /^\d+: describe\(/m, 'describe(...) likewise');
});

test('python is untouched by the change', () => {
  const py = ['class Graph:', '    def __init__(self):', '        self.n = 0', '    def nodes(self):', '        return self.n'];
  assert.deepEqual(names(buildOutline(py)), names(oldOutline(py)),
    'the python patterns must behave exactly as before - this fix is about JS class methods');
});

test('a plain function file is unchanged (the read_file redirect shares this map)', () => {
  const fn = ['function alpha(a) {', '  return a;', '}', '', 'const beta = (b) => b * 2;', '', 'module.exports = { alpha, beta };'];
  assert.deepEqual(names(buildOutline(fn)), names(oldOutline(fn)),
    'files the old rule already handled must produce an identical map');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
