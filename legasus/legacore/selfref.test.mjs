// WITNESSES for SELF-REFERENTIAL BINDINGS — written before the implementation.
//
// GATE 7 found `total = total * SCALE` recorded as providing `total` with the READ of `total` dropped
// entirely. A self-referential binding reads its target BEFORE it writes it, so the prior binding is a
// genuine requirement. On j02 it changed nothing, because `total` is a local resolving to enclosing
// scope which narrows nothing - but at module level `X = X + 1` requires the previous `X` and that
// ordering constraint would be silently lost.
//
// The NEGATIVES matter as much: a binding that does NOT read its target must not acquire a phantom
// requirement on itself, or every assignment in the system would order against its own name.
import { operationFacts } from './opfacts2.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

const cases = [
  { name: 'POSITIVE  x = x + 1 requires x before it provides it',
    code: 'TOTAL = TOTAL + 1', provides: ['TOTAL'], immediate: ['TOTAL'] },
  { name: 'POSITIVE  augmented form reads the target too',
    code: 'TOTAL = TOTAL * SCALE', provides: ['TOTAL'], immediate: ['TOTAL', 'SCALE'] },
  { name: 'POSITIVE  a call on the target reads it',
    code: 'ITEMS = sorted(ITEMS)', provides: ['ITEMS'], immediate: ['ITEMS'] },

  { name: 'NEGATIVE  a plain binding acquires NO requirement on itself',
    code: 'TOTAL = 1', provides: ['TOTAL'], immediate: [] },
  { name: 'NEGATIVE  a binding from another name requires only that name',
    code: 'TOTAL = OTHER + 1', provides: ['TOTAL'], immediate: ['OTHER'] },
  { name: 'NEGATIVE  the target name inside a STRING is not a read',
    code: 'LABEL = "LABEL here"', provides: ['LABEL'], immediate: [] },
  { name: 'NEGATIVE  a def does not read its own name',
    code: L('def helper():', '    return helper'), provides: ['helper'], immediate: [] },
];

const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
let fail = 0;
for (const c of cases) {
  const f = operationFacts(c.code);
  const ok = same(f.provides, c.provides) && same(f.requires_immediate, c.immediate);
  if (!ok) fail++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + c.name);
  if (!ok) console.log('        expected provides ' + JSON.stringify(c.provides) + ' immediate '
    + JSON.stringify(c.immediate) + '   got ' + JSON.stringify(f.provides) + ' '
    + JSON.stringify(f.requires_immediate));
}
const pos = cases.filter((c) => c.immediate.includes(c.provides[0])).length;
console.log('');
console.log('  ' + (fail ? fail + ' WITNESS FAILURE(S)' : 'all ' + cases.length + ' witnesses pass'));
console.log('  Non-vacuity: ' + pos + ' cases must require their own target and ' + (cases.length - pos)
  + ' must not.');
console.log('  A rule that always added the target would give every assignment a phantom requirement');
console.log('  on its own name, ordering each one against itself.');
if (fail) process.exitCode = 1;
