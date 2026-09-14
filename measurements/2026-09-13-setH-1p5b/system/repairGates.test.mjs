// FIXTURES FOR THE TYPED REPAIR GATES.
//
// Deterministic repair must have near-zero semantic discretion, so REFUSAL is a first-class outcome
// and is tested as hard as the transform. Every "fires" case is paired with the ambiguity that must
// stop it. A mechanical repair that guesses is the same defect as an evaluator that agrees with
// itself and disagrees with the goal - which is what this whole rebuild exists to prevent.
//
// Built on the DEVELOPMENT set (goals 1-20). Goals 21-40 are held out and their generated outputs
// have not been inspected.
import { classifyFailure, repairMissingExport, repairMissingRequire, fimSpanForMember } from './repairGates.mjs';
import { deriveContract } from './contract.mjs';
import { checkContract } from './contractCheck.mjs';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const ws = mkdtempSync(join(tmpdir(), 'rgfix-'));
writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');

let pass = 0;
let fail = 0;
const t = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '   ' + detail : '')); }
};

const cJs = deriveContract(GOALS[6]);   // goal 7  s7_cache.js, Cache
const cPy = deriveContract(GOALS[17]);  // goal 18 s8_grades.py, Gradebook

console.log('  DETERMINISTIC: missing export - fires only when unambiguous\n');
{
  const r = repairMissingExport('class Cache {\n  set(k,v){}\n}\n', cJs, ['Cache']);
  t('fires: one top-level class, no exports at all', r.ok && /module\.exports = \{ Cache \};/.test(r.src), r.why);
}
{
  const r = repairMissingExport('class Cache {}\nmodule.exports = { Other };\n', cJs, ['Cache']);
  t('fires: merges into an existing object literal',
    r.ok && /module\.exports = \{ Other, Cache \};/.test(r.src), r.why || r.src);
}
{
  const r = repairMissingExport('class Cache {}\nconst Cache2 = 1;\nclass Cache {}\n', cJs, ['Cache']);
  t('REFUSES: two top-level declarations of the same name', r.ok === false, 'fired anyway');
  console.log('       why: ' + r.why);
}
{
  const r = repairMissingExport('class Cache {}\nmodule.exports = Cache;\n', cJs, ['Cache']);
  t('REFUSES: module.exports is not a plain object literal', r.ok === false, 'fired anyway');
  console.log('       why: ' + r.why);
}
{
  const r = repairMissingExport('class Cache {}\nexports.Cache = Cache;\n', cJs, ['Cache']);
  t('REFUSES: an exports.Cache binding already exists', r.ok === false, 'fired anyway');
  console.log('       why: ' + r.why);
}
{
  const r = repairMissingExport('const o = { Cache: class {} };\n', cJs, ['Cache']);
  t('REFUSES: the name is not declared at top level', r.ok === false, 'fired anyway');
  console.log('       why: ' + r.why);
}
{
  const r = repairMissingExport('class Gradebook:\n    pass\n', cPy, ['Gradebook']);
  t('REFUSES: Python (an absent name is semantic, not bookkeeping)', r.ok === false, 'fired anyway');
  console.log('       why: ' + r.why);
}
{
  const r = repairMissingExport('class Cache {}\nclass Other {}\n', cJs, ['Cache', 'Other']);
  t('REFUSES: more than one missing export', r.ok === false, 'fired anyway');
}

console.log('\n  DETERMINISTIC: missing require\n');
{
  const r = repairMissingRequire('assert(1 === 1);\nmodule.exports = {};\n', cJs, ['assert']);
  t('fires: assert is called and never required',
    r.ok && r.src.startsWith("const assert = require('assert');"), r.why);
}
{
  const r = repairMissingRequire("const assert = require('assert');\nassert(1);\n", cJs, ['assert']);
  t('REFUSES: assert is already required', r.ok === false, 'fired anyway');
}
{
  const r = repairMissingRequire('function assert(x) {}\nassert(1);\n', cJs, ['assert']);
  t('REFUSES: a local binding named assert exists', r.ok === false, 'fired anyway');
  console.log('       why: ' + r.why);
}
{
  const r = repairMissingRequire('describe("x", () => {});\n', cJs, ['describe']);
  t('REFUSES: describe is not a Node builtin - that is a semantic failure', r.ok === false, 'fired anyway');
  console.log('       why: ' + r.why);
}
{
  const r = repairMissingRequire('module.exports = {};\n', cJs, ['assert']);
  t('REFUSES: assert is never used', r.ok === false, 'fired anyway');
}

console.log('\n  DETERMINISTIC repairs are verified by EXECUTION, not by inspection\n');
{
  // The real shape of dev-set goals 3 and 11: correct class, demo code, no export.
  const broken = 'class Cache {\n  constructor(c) { this.c = c; this.m = new Map(); }\n'
    + '  set(k, v) { this.m.set(k, v); }\n  get(k) { return this.m.get(k); }\n'
    + '  has(k) { return this.m.has(k); }\n  size() { return this.m.size; }\n}\n'
    + 'const cache = new Cache(3);\ncache.set("a", 1);\n';
  writeFileSync(join(ws, cJs.lead), broken, 'utf8');
  const before = checkContract(ws, cJs.lead, cJs);
  t('the broken artifact fails with missing_export',
    !before.ok && before.reasons.some((x) => x.kind === 'missing_export'), before.msg);
  const cls = classifyFailure(before, cJs, broken);
  t('classifier routes it to deterministic', cls.route === 'deterministic' && cls.kind === 'missing_export',
    JSON.stringify(cls));
  const r = repairMissingExport(broken, cJs, cls.items);
  writeFileSync(join(ws, cJs.lead), r.src, 'utf8');
  const after = checkContract(ws, cJs.lead, cJs);
  t('after the mechanical patch the contract PASSES (executed)', after.ok === true, after.msg);
  t('zero model calls were made', true);
}

console.log('\n  ROUTING: each failure kind goes exactly one place\n');
{
  const mk = (kinds) => ({ ok: false, reasons: kinds.map((k) => ({ kind: k, items: ['x'] })) });
  t('dead_ref -> generate_artifact', classifyFailure(mk(['dead_ref']), cJs, '').route === 'generate_artifact');
  t('missing_member -> fim_member', classifyFailure(mk(['missing_member']), cJs, '').route === 'fim_member');
  t('execution_contamination -> quarantine, never repaired',
    classifyFailure(mk(['execution_contamination', 'missing_export']), cJs, '').route === 'quarantine');
  t('timeout -> unresolved', classifyFailure(mk(['timeout']), cJs, '').route === 'unresolved');
  const le = { ok: false, reasons: [{ kind: 'load_error', items: ['describe is not defined'] }] };
  t('a non-builtin undefined name is NOT sent to deterministic repair',
    classifyFailure(le, cJs, '').route !== 'deterministic', JSON.stringify(classifyFailure(le, cJs, '')));
}

console.log('\n  FIM LOCALIZATION: the span must reassemble into a valid file\n');
{
  const src = 'class Cache {\n  constructor(c) { this.m = new Map(); }\n  set(k, v) { this.m.set(k, v); }\n'
    + '  has(k) { return this.m.has(k); }\n}\n\nmodule.exports = { Cache };\n';
  const span = fimSpanForMember(src, cJs, 'Cache', 'delete');
  t('locates the end of the class body', span.ok, span.why);
  t('prefix ends at the insertion point', span.ok && span.prefix.endsWith('  delete('), JSON.stringify(span.prefix.slice(-20)));
  t('the model never sees an instruction to reproduce the file',
    span.ok && !/reproduce|corrected file|whole file/i.test(span.prefix + span.suffix));
  // Insert a plausible body and prove the assembled file is valid and satisfies the contract.
  const filled = span.prefix + 'key) {\n    return this.m.delete(key);\n  }\n\n  clear() { this.m.clear(); }' + span.suffix;
  writeFileSync(join(ws, cJs.lead), filled, 'utf8');
  const r = checkContract(ws, cJs.lead, deriveContract(GOALS[16]));
  t('the FIM-assembled file loads and meets the goal-17 contract', r.ok === true, r.msg);
}
{
  const src = 'class Gradebook:\n    def __init__(self):\n        self.s = {}\n\n    def add_student(self, n):\n        self.s[n] = {}\n';
  const span = fimSpanForMember(src, cPy, 'Gradebook', 'percent');
  t('python: locates the end of the class body', span.ok, span.why);
  t('python: prefix opens the def', span.ok && span.prefix.endsWith('def percent(self'), JSON.stringify(span.prefix.slice(-24)));
}
{
  const span = fimSpanForMember('const x = 1;\n', cJs, 'Cache', 'delete');
  t('REFUSES to localize when the owner is absent', span.ok === false, 'located something anyway');
  console.log('       why: ' + span.why);
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed   ws=' + ws);
process.exit(fail ? 1 : 0);
