// WITNESSES for operation facts and execution phase.
//
// These are NOT g05/g06 cases. They are witnesses for the semantic rule itself, written before the
// revised deriver runs against any family, so that "phase" is established as a claim about Python
// rather than as whatever made two tasks pass.
//
// The MUST DISTINGUISH pairs are the load-bearing ones: the same symbol, the same textual shape, and
// a different execution phase. A rule that cannot separate those will either manufacture dependencies
// from deferred mentions or miss real definition-time ones.
import { operationFacts } from './opfacts.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

const cases = [
  // ---- MUST CONSTRAIN: the requirement is loaded when the operation itself executes
  { name: 'IMMEDIATE  module-level call binds a name and consumes one',
    code: 'x = helper()',
    provides: ['x'], immediate: ['helper'], deferred: [] },

  { name: 'IMMEDIATE  bare statement provides NOTHING and still requires two symbols',
    code: 'DEFAULTS.update(_timeouts())',
    provides: [], immediate: ['DEFAULTS', '_timeouts'], deferred: [] },

  { name: 'IMMEDIATE  a default argument is evaluated when the def executes',
    code: L('def f(x=helper()):', '    return x'),
    provides: ['f'], immediate: ['helper'], deferred: [] },

  { name: 'IMMEDIATE  a decorator runs at definition time',
    code: L('@register(helper)', 'def f():', '    return 1'),
    provides: ['f'], immediate: ['register', 'helper'], deferred: [] },

  { name: 'IMMEDIATE  a base class is evaluated on definition',
    code: L('class A(Base):', '    pass'),
    provides: ['A'], immediate: ['Base'], deferred: [] },

  // ---- MUST NOT CONSTRAIN: resolved only when the enclosing function runs
  { name: 'DEFERRED   a function body reference imposes no import-time ordering',
    code: L('def f():', '    return helper()'),
    provides: ['f'], immediate: [], deferred: ['helper'] },

  // ---- MUST DISTINGUISH: same symbol, same shape, different phase
  { name: 'DISTINGUISH  a class BODY executes on definition',
    code: L('class A:', '    x = helper()'),
    provides: ['A'], immediate: ['helper'], deferred: [] },

  { name: 'DISTINGUISH  a METHOD body inside that class does not',
    code: L('class A:', '    def f(self):', '        return helper()'),
    provides: ['A'], immediate: [], deferred: ['helper'] },

  // ---- the shape that actually failed on g05 op2, stated as a rule rather than as that task
  { name: 'IMMEDIATE  a provider-less merge statement orders after BOTH its requirements',
    code: 'CONFIG.update(extra_defaults())',
    provides: [], immediate: ['CONFIG', 'extra_defaults'], deferred: [] },

  // ---- non-vacuity: string contents and attribute suffixes are not symbols
  { name: 'CLEAN      string contents and attributes are not requirements',
    code: 'label = obj.helper + "helper"',
    provides: ['label'], immediate: ['obj'], deferred: [] },
];

const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

let fail = 0;
for (const c of cases) {
  const f = operationFacts(c.code);
  const ok = same(f.provides, c.provides)
    && same(f.requires_immediate, c.immediate)
    && same(f.requires_deferred, c.deferred);
  if (!ok) fail++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + c.name);
  if (!ok) {
    console.log('        expected provides ' + JSON.stringify(c.provides)
      + ' immediate ' + JSON.stringify(c.immediate) + ' deferred ' + JSON.stringify(c.deferred));
    console.log('        got      provides ' + JSON.stringify(f.provides)
      + ' immediate ' + JSON.stringify(f.requires_immediate) + ' deferred ' + JSON.stringify(f.requires_deferred));
  }
}

const imm = cases.filter((c) => c.immediate.length).length;
const def = cases.filter((c) => c.deferred.length).length;
console.log('');
console.log('  ' + (fail ? fail + ' WITNESS FAILURE(S)' : 'all ' + cases.length + ' witnesses pass'));
console.log('  Non-vacuity: ' + imm + ' cases must yield an IMMEDIATE requirement and ' + def
  + ' must yield a DEFERRED one.');
console.log('  An extractor that called everything immediate would manufacture dependencies and fail');
console.log('  the deferred cases; one that called everything deferred would miss every real ordering.');
if (fail) process.exitCode = 1;
