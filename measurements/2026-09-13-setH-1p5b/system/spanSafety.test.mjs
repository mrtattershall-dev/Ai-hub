// FIXTURES FOR SPAN SAFETY, in both directions.
//
// The dangerous error is a FALSE POSITIVE localization: a span that looks clean and cuts the wrong
// code. A false negative only costs a fallback. So the refusal cases carry as much weight as the
// acceptance cases, and the preservation audit is tested against edits that deliberately damage
// things outside the authorized span.
import { validateSpanShape, insertionOnly, survivingSymbols, auditLocalizedEdit } from './spanSafety.mjs';
import { spanAddMethod, spanAddFunction } from './fimspan.mjs';

let pass = 0;
let fail = 0;
const t = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '   ' + detail : '')); }
};

const JS = [
  'class Cache {',
  '  constructor(c) { this.m = new Map(); }',
  '  set(k, v) { this.m.set(k, v); }',
  '  get(k) { return this.m.get(k); }',
  '}',
  '',
  'module.exports = { Cache };',
  '',
].join('\n');

const PY = [
  'class Graph:',
  '    def __init__(self):',
  '        self.g = {}',
  '',
  '    def nodes(self):',
  '        return sorted(self.g)',
  '',
].join('\n');

console.log('  SPAN VALIDITY - checked before generation, from source alone\n');
t('accepts a unique owner with the member absent',
  validateSpanShape(JS, { op: 'add_method', owner: 'Cache', member: 'keys', lang: 'js' }).ok);
t('REFUSES when the owner is absent',
  validateSpanShape(JS, { op: 'add_method', owner: 'Nope', member: 'keys', lang: 'js' }).ok === false);
t('REFUSES when the owner is declared twice (ambiguous)',
  validateSpanShape(JS + '\nclass Cache {}\n', { op: 'add_method', owner: 'Cache', member: 'keys', lang: 'js' }).ok === false);
t('REFUSES add_method when the member already exists',
  validateSpanShape(JS, { op: 'add_method', owner: 'Cache', member: 'get', lang: 'js' }).ok === false);
t('REFUSES add_function when the name already exists',
  validateSpanShape(JS, { op: 'add_function', fn: 'Cache', lang: 'js' }).ok === false);
t('REFUSES replace_method when the member is absent',
  validateSpanShape(JS, { op: 'replace_method', owner: 'Cache', member: 'nope', lang: 'js' }).ok === false);
{
  const r = validateSpanShape(JS, { op: 'add_method', owner: 'Cache', member: 'get', lang: 'js' });
  console.log('       why: ' + r.problems.join('; '));
}

console.log('\n  PRESERVATION - insertion must delete nothing\n');
{
  const s = spanAddMethod(JS, 'js', 'Cache', 'keys');
  const after = s.prefix + 'k) { return [...this.m.keys()]; }' + s.suffix;
  const ins = insertionOnly(JS, after);
  t('a real add_method is insertion-only', ins.ok && ins.deletedBytes === 0,
    'deleted ' + ins.deletedBytes);
  console.log('       inserted ' + ins.insertedBytes + ' bytes, deleted ' + ins.deletedBytes);
}
{
  // The exact bug that motivated this module: the old body left behind AND the new one added.
  const duplicated = JS.replace('  get(k) { return this.m.get(k); }',
    '  get(k) { return this.m.get(k); }\n  get(k) { return this.m.get(k); }');
  const ins = insertionOnly(JS, duplicated);
  t('duplication is still insertion-only (so insertionOnly alone is NOT sufficient)', ins.ok === true);
  const surv = survivingSymbols(JS, duplicated, 'js');
  t('...and survivingSymbols does not flag it either', surv.ok === true);
  console.log('       -> this is why the contract check must also run: structure alone cannot see it');
}
{
  const mangled = JS.replace('  set(k, v) { this.m.set(k, v); }', '');
  const ins = insertionOnly(JS, mangled);
  t('DETECTS deletion of an unrelated method', ins.ok === false && ins.deletedBytes > 0,
    'deleted ' + ins.deletedBytes);
  const surv = survivingSymbols(JS, mangled, 'js');
  t('DETECTS the lost symbol by name', surv.ok === false && surv.lostMem.includes('set'),
    JSON.stringify(surv));
}

console.log('\n  FULL AUDIT - an edit that damages outside the span must be rejected\n');
{
  const s = spanAddMethod(JS, 'js', 'Cache', 'keys');
  const span = { prefixOriginal: JS.slice(0, JS.indexOf('\n}')), suffixOriginal: '\n' };
  const good = s.prefix + 'k) { return []; }' + s.suffix;
  const a = auditLocalizedEdit({ before: JS, after: good, span, op: 'add_method', lang: 'js' });
  t('a clean insertion passes the audit', a.ok === true, JSON.stringify(a.problems));
  console.log('       metrics: ' + JSON.stringify(a.metrics));
}
{
  const s = spanAddMethod(JS, 'js', 'Cache', 'keys');
  const span = { prefixOriginal: JS.slice(0, JS.indexOf('\n}')), suffixOriginal: '\n' };
  // Model returns the method AND silently drops module.exports - the classic integration failure.
  const bad = (s.prefix + 'k) { return []; }' + s.suffix).replace('module.exports = { Cache };', '');
  const a = auditLocalizedEdit({ before: JS, after: bad, span, op: 'add_method', lang: 'js' });
  t('REJECTS an edit that drops module.exports', a.ok === false, JSON.stringify(a.problems));
  console.log('       problems: ' + a.problems.join('; '));
}
{
  const s = spanAddFunction(PY, 'py', 'letter');
  const after = s.prefix + 'p):\n    return "A"' + s.suffix;
  const span = { prefixOriginal: PY.replace(/\s*$/, ''), suffixOriginal: '' };
  const a = auditLocalizedEdit({ before: PY, after, span, op: 'add_function', lang: 'py' });
  t('python add_function passes the audit', a.ok === true, JSON.stringify(a.problems));
  t('...and the pre-existing class survives', after.includes('class Graph:') && after.includes('def nodes(self):'));
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
