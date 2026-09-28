// PLANNER WITNESSES, in both directions.
//
// A false NEGATIVE costs a fallback to whole-file generation. A false POSITIVE hands a surgical
// instrument to an operation that should never have been localized. So the "must NOT localize"
// cases carry as much weight as the "must localize" ones, and the planner is required to refuse
// whenever the target is ambiguous.
import { planOperation, editSurface } from './operation.mjs';
import { deriveContract } from './contract.mjs';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
let pass = 0;
let fail = 0;
const t = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '   ' + detail : '')); }
};

const mk = () => {
  const ws = mkdtempSync(join(tmpdir(), 'plan-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  return ws;
};
const plan = (goalIdx, files) => {
  const ws = mk();
  const c = deriveContract(GOALS[goalIdx]);
  for (const [f, src] of Object.entries(files || {})) writeFileSync(join(ws, f), src, 'utf8');
  return { p: planOperation(c, ws, GOALS[goalIdx]), c, ws };
};

const CACHE = 'class Cache {\n  constructor(c) { this.m = new Map(); }\n  set(k,v) { this.m.set(k,v); }\n'
  + '  get(k) { return this.m.get(k); }\n  has(k) { return this.m.has(k); }\n  size() { return this.m.size; }\n}\n'
  + 'module.exports = { Cache };\n';
const GRADES = 'class Gradebook:\n    def __init__(self):\n        self.s = {}\n\n    def add_student(self, n):\n        self.s[n] = {}\n';

console.log('  MUST LOCALIZE\n');
{
  const { p } = plan(26, { 's7_cache.js': CACHE });      // goal 27: Cache.keys
  t('add method to a known class -> add_method', p.op === 'add_method' && p.owner === 'Cache', JSON.stringify(p));
}
{
  const { p } = plan(27, { 's8_grades.py': GRADES });    // goal 28: module-level letter()
  t('add module-level function -> add_function', p.op === 'add_function' && p.fn === 'letter', JSON.stringify(p));
}

console.log('\n  MUST NOT LOCALIZE\n');
{
  const { p } = plan(23, { 's4_markdown.py': 'def to_html(text):\n    return text\n' }); // goal 24: emphasis
  t('behaviour change to an existing function -> fallback, NOT a localized edit',
    p.op === 'content_edit', JSON.stringify(p));
  console.log('       reason: ' + p.reason);
}
{
  const { p } = plan(34, { 's5_expr.js': 'function evaluate(e) { return 0; }\nmodule.exports = { evaluate };\n' });
  t('signature change (evaluate gains vars) -> fallback', p.op === 'content_edit', JSON.stringify(p));
}
{
  const { p } = plan(28, { 's9_board.html': '<!doctype html><html><body></body></html>' }); // goal 29: DOM
  t('markup goal -> fallback, never localized', p.op === 'content_edit', JSON.stringify(p));
}
{
  const { p } = plan(26, {});                            // target file absent entirely
  t('target file does not exist -> create_file', p.op === 'create_file', JSON.stringify(p));
}
{
  // Duplicate candidate owners: the planner must refuse rather than pick one.
  const { p } = plan(26, { 's7_cache.js': CACHE + '\nclass Cache {}\n' });
  t('duplicate owner declarations -> NOT add_method',
    p.op !== 'add_method', JSON.stringify(p));
  console.log('       reason: ' + p.reason);
}
{
  // Two owners with missing members - localization target is ambiguous.
  const both = 'class A {\n  x() {}\n}\nclass B {\n  y() {}\n}\nmodule.exports = { A, B };\n';
  const ws = mk();
  writeFileSync(join(ws, 's3_matrix.js'), both, 'utf8');
  const c = deriveContract(GOALS[32]);                   // goal 33: Matrix.transpose + static identity
  const p = planOperation(c, ws, GOALS[32]);
  t('owner absent from the artifact -> fallback, not a blind insertion',
    p.op !== 'add_method', JSON.stringify(p));
  console.log('       reason: ' + p.reason);
}
{
  // Member already present: adding it again is not an addition.
  const withKeys = CACHE.replace('  size() { return this.m.size; }', '  size() { return this.m.size; }\n  keys() { return []; }');
  const { p } = plan(26, { 's7_cache.js': withKeys });
  t('member already present -> not an add_method', p.op !== 'add_method', JSON.stringify(p));
  console.log('       reason: ' + p.reason);
}

console.log('\n  COMMENTS ARE NOT CODE\n');
{
  // ACCEPTANCE: the canonical seed documents held-out functions BY NAME in its header comments.
  // A bare presence test reads that documentation and concludes the function already exists, which
  // mis-routed four goals (42, 50, 52, 60) away from a localized insertion they are eligible for.
  const commented = '# Goal 42 (percentile) is HELD OUT and deliberately not implemented.\n'
    + 'def parse_line(line):\n    return {}\n';
  const { p } = plan(41, { 's2_logs.py': commented });
  t('a name mentioned only in a COMMENT still counts as absent -> add_function',
    p.op === 'add_function' && p.fn === 'percentile', JSON.stringify(p));
}
{
  // REJECTION: a name that is genuinely defined must NOT be treated as absent.
  const defined = 'def parse_line(line):\n    return {}\n\ndef percentile(entries, p):\n    return 0\n';
  const { p } = plan(41, { 's2_logs.py': defined });
  t('a name that is genuinely DEFINED is not re-added', p.op !== 'add_function', JSON.stringify(p));
  console.log('       reason: ' + p.reason);
}
{
  // REJECTION: a name appearing only inside a STRING is not a definition either.
  const stringy = 'def parse_line(line):\n    raise ValueError("percentile not supported")\n';
  const { p } = plan(41, { 's2_logs.py': stringy });
  t('a name appearing only in a STRING still counts as absent -> add_function',
    p.op === 'add_function', JSON.stringify(p));
}

console.log('\n  EDIT SURFACE\n');
{
  const before = CACHE;
  const after = CACHE.replace('  size() { return this.m.size; }', '  size() { return this.m.size; }\n  keys() { return []; }');
  const s = editSurface(before, after);
  t('a one-line insertion reports churn 1 and no whole-file rewrite',
    s.lines_added === 1 && s.lines_removed === 0 && s.rewrote_whole_file === false, JSON.stringify(s));
  console.log('       ' + JSON.stringify(s));
}
{
  const s = editSurface(CACHE, 'const x = 1;\nmodule.exports = { x };\n');
  t('a full rewrite is flagged as a whole-file rewrite', s.rewrote_whole_file === true, JSON.stringify(s));
  console.log('       ' + JSON.stringify(s));
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
