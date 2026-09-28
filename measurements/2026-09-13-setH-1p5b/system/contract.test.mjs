// SENSITIVITY AND SPECIFICITY WITNESSES FOR THE TYPED CONTRACT.
//
// The two obligations, and each catches a defect the other structurally cannot:
//     known-good artifact  -> the checker MUST accept   (specificity; catches over-constraint)
//     known-bad  artifact  -> the checker MUST reject   (sensitivity; catches unfailable branches)
//
// Tonight produced one of each. `[].every()` over an empty list and `return {ok:true}` for an
// unhandled file type passed EVERY known-good fixture, because they pass everything - only a
// known-bad witness exposes them. The s9-card id/class mistake rejected every known-bad fixture
// correctly, for the wrong reason - only a known-good witness exposes that.
//
// The known-good fixtures below are hand-written to represent what the GOAL actually asked for, not
// what the old derivation believed. Goal 17 is the important one: `delete(key)` as a method is
// perfectly legal, and the old contract demanded it at module level, which made the model emit
// `function delete(key)` - a SyntaxError on a reserved word.
import { deriveContract } from './contract.mjs';
import { checkContract } from './contractCheck.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const ws = mkdtempSync(join(tmpdir(), 'cfix-'));
writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');

let pass = 0;
let fail = 0;
const t = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '   ' + detail : '')); }
};

// goal index (0-based), file, source, expected accept/reject, expected rejection kind
const CASES = [
  // ---- GOAL 17: Add delete(key) and clear() to the EXISTING Cache. THE CONTAMINATED CASE.
  [16, 'good: delete/clear as METHODS on Cache', true, null,
    'class Cache {\n  constructor(c) { this.c = c; this.m = new Map(); }\n'
    + '  set(k, v) { this.m.set(k, v); }\n  get(k) { return this.m.get(k); }\n'
    + '  has(k) { return this.m.has(k); }\n  size() { return this.m.size; }\n'
    + '  delete(k) { return this.m.delete(k); }\n  clear() { this.m.clear(); }\n}\n'
    + 'module.exports = { Cache };\n'],
  [16, 'bad: Cache exported but delete MISSING', false, 'missing_member',
    'class Cache {\n  clear() {}\n}\nmodule.exports = { Cache };\n'],
  [16, 'bad: delete/clear as MODULE functions, not methods', false, 'missing_member',
    'class Cache {}\nfunction clear() {}\nmodule.exports = { Cache, clear, del: 1 };\n'],
  [16, 'bad: methods present but Cache NOT exported', false, 'missing_export',
    'class Cache {\n  delete(k) { return true; }\n  clear() {}\n}\nmodule.exports = {};\n'],

  // ---- GOAL 13: Add add(other) and sub(other) to the EXISTING Matrix. `add` was eaten by a stopword.
  [12, 'good: add/sub as methods on Matrix', true, null,
    'class Matrix {\n  constructor(r) { this.r = r; }\n  add(o) { return new Matrix(this.r); }\n'
    + '  sub(o) { return new Matrix(this.r); }\n}\nmodule.exports = Matrix;\n'],
  [12, 'bad: only sub, add missing', false, 'missing_member',
    'class Matrix {\n  sub(o) { return this; }\n}\nmodule.exports = Matrix;\n'],

  // ---- GOAL 20: module-level export. The OTHER branch of the discriminator must still work.
  [19, 'good: availability exported at module level', true, null,
    'function availability(lib, isbn) { return "1/2"; }\nmodule.exports = { availability };\n'],
  [19, 'bad: availability defined but not exported', false, 'missing_export',
    'function availability(lib, isbn) { return "1/2"; }\nmodule.exports = {};\n'],
  [19, 'bad: file does not load at all', false, 'load_error',
    'function availability( { return "1/2"; }\n'],
];

console.log('  JS fixtures\n');
for (const [gi, name, shouldPass, wantKind, src] of CASES) {
  const c = deriveContract(GOALS[gi]);
  writeFileSync(join(ws, c.lead), src, 'utf8');
  const r = checkContract(ws, c.lead, c);
  const kinds = r.reasons.map((x) => x.kind);
  if (shouldPass) t(name, r.ok === true, 'rejected: ' + r.msg);
  else t(name, r.ok === false && kinds.includes(wantKind),
    'ok=' + r.ok + ' kinds=' + JSON.stringify(kinds) + ' want ' + wantKind);
}

// ---- PYTHON: goal 16 (Graph.bfs) and goal 18 (Gradebook.percent) were both mis-scored.
const PY = [
  [15, 'good: bfs as a METHOD on Graph', true, null,
    'class Graph:\n    def __init__(self):\n        self.g = {}\n'
    + '    def add_node(self, n):\n        self.g.setdefault(n, [])\n'
    + '    def add_edge(self, a, b, weight=1):\n        self.g.setdefault(a, []).append(b)\n'
    + '    def nodes(self):\n        return sorted(self.g)\n'
    + '    def neighbors(self, n):\n        return sorted(self.g[n])\n'
    + '    def bfs(self, start):\n        return [start]\n'],
  [15, 'bad: Graph present, bfs MISSING', false, 'missing_member',
    'class Graph:\n    def nodes(self):\n        return []\n'],
  [15, 'bad: bfs as a MODULE function, not a method', false, 'missing_member',
    'class Graph:\n    def nodes(self):\n        return []\n\ndef bfs(start):\n    return [start]\n'],
  [17, 'good: percent as a method on Gradebook', true, null,
    'class Gradebook:\n    def percent(self, s):\n        return 80.0\n'],
  [17, 'bad: percent on the WRONG class', false, 'missing_member',
    'class Gradebook:\n    pass\n\nclass Other:\n    def percent(self, s):\n        return 80.0\n'],
];

console.log('\n  Python fixtures\n');
for (const [gi, name, shouldPass, wantKind, src] of PY) {
  const c = deriveContract(GOALS[gi]);
  writeFileSync(join(ws, c.lead), src, 'utf8');
  const r = checkContract(ws, c.lead, c);
  const kinds = r.reasons.map((x) => x.kind);
  if (shouldPass) t(name, r.ok === true, 'rejected: ' + r.msg);
  else t(name, r.ok === false && kinds.includes(wantKind),
    'ok=' + r.ok + ' kinds=' + JSON.stringify(kinds) + ' want ' + wantKind);
}

// ---- THE REGRESSION THAT STARTED THIS: the real artifact the OLD checker rejected must now pass.
console.log('\n  Regression: artifacts the OLD flat-wants checker wrongly rejected\n');
{
  const c = deriveContract(GOALS[10]); // goal 11, Library.checkout/available
  writeFileSync(join(ws, c.lead),
    'class Library {\n  constructor() { this.books = {}; this.loans = {}; }\n'
    + '  addBook(isbn, title, copies = 1) { this.books[isbn] = { title, copies }; }\n'
    + '  copies(isbn) { return this.books[isbn] ? this.books[isbn].copies : 0; }\n'
    + '  titles() { return Object.values(this.books).map((b) => b.title).sort(); }\n'
    + '  checkout(isbn, member) { this.loans[isbn] = (this.loans[isbn] || 0) + 1; }\n'
    + '  available(isbn) { return this.copies(isbn) - (this.loans[isbn] || 0); }\n}\n'
    + 'module.exports = { Library };\n', 'utf8');
  const r = checkContract(ws, c.lead, c);
  t('goal 11 correct artifact ACCEPTED (old checker said "checkout is not defined")', r.ok === true, r.msg);
}

// ---- STATIC METHODS. Goal 33 says "transpose() and a STATIC identity(n)". Recording the kind
// without enforcing it would readmit the false-pass class this rewrite exists to stop.
console.log('\n  Static-method enforcement (goal 33)\n');
{
  const c = deriveContract(GOALS[32]);
  const good = 'class Matrix {\n  constructor(r) { this.r = r; }\n  transpose() { return this; }\n'
    + '  static identity(n) { return new Matrix([]); }\n}\nmodule.exports = Matrix;\n';
  writeFileSync(join(ws, c.lead), good, 'utf8');
  t('static identity ACCEPTED when declared static', checkContract(ws, c.lead, c).ok === true,
    checkContract(ws, c.lead, c).msg);

  const bad = 'class Matrix {\n  constructor(r) { this.r = r; }\n  transpose() { return this; }\n'
    + '  identity(n) { return new Matrix([]); }\n}\nmodule.exports = Matrix;\n';
  writeFileSync(join(ws, c.lead), bad, 'utf8');
  const rb = checkContract(ws, c.lead, c);
  t('instance identity REJECTED when the goal says static',
    rb.ok === false && rb.reasons.some((x) => x.kind === 'missing_member'), 'msg=' + rb.msg);
  console.log('       reason: ' + rb.msg.slice(0, 100));
}

// ---- WEB goals must have NO module exports. Goal 29's "the EXISTING s9 board" previously derived
// a phantom export named `s9` from a target that is neither a class nor a filename.
console.log('\n  Web goals derive no module exports (goal 29)\n');
{
  const c = deriveContract(GOALS[28]);
  t('goal 29 derives zero moduleExports', c.moduleExports.length === 0, JSON.stringify(c.moduleExports));
  t('goal 29 derives the three count ids',
    ['s9-count-todo', 's9-count-doing', 's9-count-done'].every((i) => c.domIds.includes(i)),
    JSON.stringify(c.domIds));
  writeFileSync(join(ws, c.lead),
    '<!doctype html><html><body><div id="s9-count-todo">0</div><div id="s9-count-doing">0</div>'
    + '<div id="s9-count-done">0</div></body></html>', 'utf8');
  t('a page with all three ids PASSES', checkContract(ws, c.lead, c).ok === true);
  writeFileSync(join(ws, c.lead), '<!doctype html><html><body><div id="s9-count-todo">0</div></body></html>', 'utf8');
  const r2 = checkContract(ws, c.lead, c);
  t('a page missing two ids FAILS', r2.ok === false && r2.reasons.some((x) => x.kind === 'missing_id'), r2.msg);
}

// ---- COLON-SECTION members. Goals 31/35/38 name their API after the colon, not in the head.
console.log('\n  Colon-section derivation (goals 31, 35, 38)\n');
{
  const c31 = deriveContract(GOALS[30]);
  t('goal 31 finds placeHold and holds',
    ['placeHold', 'holds'].every((n) => c31.members.some((m) => m.name === n)), JSON.stringify(c31.members));
  const c35 = deriveContract(GOALS[34]);
  t('goal 35 finds evaluate as a module export', c35.moduleExports.includes('evaluate'), JSON.stringify(c35.moduleExports));
  const c38 = deriveContract(GOALS[37]);
  t('goal 38 finds add_assignment and set_weight',
    ['add_assignment', 'set_weight'].every((n) => c38.members.some((m) => m.name === n)), JSON.stringify(c38.members));
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed (final)');
process.exit(fail ? 1 : 0);
