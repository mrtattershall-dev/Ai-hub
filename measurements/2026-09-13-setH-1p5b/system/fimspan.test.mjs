// FIXTURES FOR THE FIM SPANS.
//
// A mis-cut span silently deletes working code, so the load-bearing property is not "does the hole
// go in the right place" but PRESERVATION: everything outside the hole must survive byte for byte.
// Each case therefore asserts that prefix + suffix reconstructs the original apart from the opening
// the model is asked to fill, and that the assembled file still loads and keeps its prior members.
import { spanAddMethod, spanAddFunction, spanReplaceMethod } from './fimspan.mjs';
import { deriveContract } from './contract.mjs';
import { checkContract } from './contractCheck.mjs';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const ws = mkdtempSync(join(tmpdir(), 'span-'));
writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');

let pass = 0;
let fail = 0;
const t = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '   ' + detail : '')); }
};

const JS_CACHE = [
  'class Cache {',
  '  constructor(capacity) { this.capacity = capacity; this.m = new Map(); }',
  '  set(key, value) { this.m.set(key, value); }',
  '  get(key) { return this.m.get(key); }',
  '  has(key) { return this.m.has(key); }',
  '  size() { return this.m.size; }',
  '}',
  '',
  'module.exports = { Cache };',
  '',
].join('\n');

const PY_GRAPH = [
  'class Graph:',
  '    def __init__(self):',
  '        self.g = {}',
  '',
  '    def add_node(self, n):',
  '        self.g.setdefault(n, [])',
  '',
  '    def nodes(self):',
  '        return sorted(self.g)',
  '',
].join('\n');

console.log('  PRESERVATION - nothing outside the hole may be lost\n');
{
  const s = spanAddMethod(JS_CACHE, 'js', 'Cache', 'keys');
  t('js add_method: locates the class', s.ok, s.why);
  // Everything in the original must still be present across prefix+suffix.
  const joined = s.prefix + s.suffix;
  const lost = JS_CACHE.split('\n').filter((l) => l.trim() && !joined.includes(l.trim()));
  t('js add_method: every original line survives', lost.length === 0, 'lost: ' + JSON.stringify(lost));
  t('js add_method: the hole is inside the class body, before the closing brace',
    s.ok && /keys\($/.test(s.prefix) && s.suffix.trim().startsWith('}'), JSON.stringify(s.suffix.slice(0, 20)));
}
{
  const s = spanAddMethod(PY_GRAPH, 'py', 'Graph', 'has_cycle');
  t('py add_method: locates the class', s.ok, s.why);
  const joined = s.prefix + s.suffix;
  const lost = PY_GRAPH.split('\n').filter((l) => l.trim() && !joined.includes(l.trim()));
  t('py add_method: every original line survives', lost.length === 0, 'lost: ' + JSON.stringify(lost));
  t('py add_method: the hole opens a def at class indentation',
    s.ok && s.prefix.endsWith('    def has_cycle(self'), JSON.stringify(s.prefix.slice(-26)));
}

console.log('\n  ASSEMBLY - a filled span must load and keep prior members\n');
{
  const c = deriveContract(GOALS[26]); // goal 27: Cache.keys
  const s = spanAddMethod(JS_CACHE, 'js', 'Cache', 'keys');
  const filled = s.prefix + ') { return [...this.m.keys()]; }' + s.suffix;
  writeFileSync(join(ws, c.lead), filled, 'utf8');
  const r = checkContract(ws, c.lead, c);
  t('js: assembled file satisfies the goal-27 contract', r.ok === true, r.msg);
  const src = readFileSync(join(ws, c.lead), 'utf8');
  t('js: the four prior methods are still present',
    ['set(', 'get(', 'has(', 'size('].every((m) => src.includes(m)));
}
{
  const c = deriveContract(GOALS[35]); // goal 36: Graph.has_cycle
  const s = spanAddMethod(PY_GRAPH, 'py', 'Graph', 'has_cycle');
  const filled = s.prefix + '):\n        return False' + s.suffix;
  writeFileSync(join(ws, c.lead), filled, 'utf8');
  const r = checkContract(ws, c.lead, c);
  t('py: assembled file satisfies the goal-36 contract', r.ok === true, r.msg);
}

console.log('\n  ADD_FUNCTION - module-level insertion goes BEFORE the export\n');
{
  const s = spanAddFunction(JS_CACHE, 'js', 'describeCache');
  t('js add_function: inserts before module.exports', s.ok && s.where === 'before module.exports', s.where);
  const joined = s.prefix + s.suffix;
  t('js add_function: module.exports survives', joined.includes('module.exports = { Cache };'));
  t('js add_function: the class survives', joined.includes('class Cache {'));
}
{
  const s = spanAddFunction(PY_GRAPH, 'py', 'letter');
  t('py add_function: appends at module level with no indent',
    s.ok && /\ndef letter\($/.test(s.prefix), JSON.stringify(s.prefix.slice(-18)));
  t('py add_function: the class survives', (s.prefix + s.suffix).includes('class Graph:'));
}

console.log('\n  REPLACE_METHOD - the cut must not swallow neighbours\n');
{
  const s = spanReplaceMethod(JS_CACHE, 'js', 'Cache', 'get');
  t('js replace: locates the member', s.ok, s.why);
  const joined = s.prefix + s.suffix;
  t('js replace: the REPLACED body is gone', !joined.includes('return this.m.get(key);'));
  t('js replace: the NEIGHBOURING methods survive',
    joined.includes('set(key, value)') && joined.includes('has(key)') && joined.includes('size()'),
    JSON.stringify(joined));
  const filled = s.prefix + 'key) { return this.m.get(key); }' + s.suffix;
  const c = deriveContract(GOALS[6]);
  writeFileSync(join(ws, c.lead), filled, 'utf8');
  t('js replace: refilled file still satisfies the goal-7 contract', checkContract(ws, c.lead, c).ok === true,
    checkContract(ws, c.lead, c).msg);
}
{
  const s = spanReplaceMethod(PY_GRAPH, 'py', 'Graph', 'add_node');
  t('py replace: locates the member', s.ok, s.why);
  const joined = s.prefix + s.suffix;
  t('py replace: the following method survives', joined.includes('def nodes(self):'));
  t('py replace: the replaced body is gone', !joined.includes('self.g.setdefault(n, [])'));
}

console.log('\n  REFUSAL - an unlocalizable operation must not be guessed\n');
{
  t('refuses a missing class', spanAddMethod(JS_CACHE, 'js', 'Nope', 'x').ok === false);
  t('refuses a missing member for replacement', spanReplaceMethod(JS_CACHE, 'js', 'Cache', 'nope').ok === false);
  t('refuses an empty python class body', spanAddMethod('class Empty:\n', 'py', 'Empty', 'x').ok === false);
  t('refuses unbalanced braces', spanAddMethod('class Broken {\n  a() {\n', 'js', 'Broken', 'x').ok === false);
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed   ws=' + ws);
process.exit(fail ? 1 : 0);
