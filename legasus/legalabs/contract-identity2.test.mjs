// The open-end contract, frozen across the envelope repair.
//
// Revision 2 replaces CONSTRAIN with `legagate/envelope.mjs` and nothing else. Without a check, an
// "envelope repair" is exactly the kind of change that quietly carries a second change with it, and
// every cross-revision comparison afterwards would be measuring two things.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const ROOT = 'C:/Users/tatte/Projects/ai-coding-hub-indent/legasus/legalabs/';
const r1 = readFileSync(ROOT + 'run-openend.mjs', 'utf8');
const r2 = readFileSync(ROOT + 'run-openend2.mjs', 'utf8');

function region(src, from, to, file) {
  const i = src.indexOf(from);
  assert.ok(i >= 0, from + ' not found in ' + file);
  assert.equal(src.indexOf(from, i + 1), -1, from + ' appears more than once in ' + file);
  const j = src.indexOf(to, i);
  assert.ok(j > i, to + ' not found after ' + from + ' in ' + file);
  return src.slice(i, j);
}

const REGIONS = [
  ['the four shapes', 'const SHAPES = {', '// The one variable'],
  ['RENDER - the three open-end phrasings', 'const OPEN_END = {', 'const CELLS'],
  ['DECIDE - plan derivation', 'function plan(shapeKey, renderKey) {', 'function promptFor'],
  // The end anchor must exist IDENTICALLY in both files. Revision 1 has `function normalize(...)`
  // and revision 2 has `const normalize = ...`, so anchoring on that name compares different
  // boundaries and reports a difference the content does not have. Anchor on the last line of
  // the prompt instead, which is part of the contract and is byte-identical in both.
  ['RENDER - prompt assembly', 'function promptFor(p) {',
    'Do NOT repeat any fixed line. Do NOT write the whole function. Do NOT explain.'],
  ['assembly', 'const build = (code, p) =>', 'function runProgram'],
  ['program execution', 'function runProgram(program, inputs) {', 'function probesFor'],
  ['PROVE - the contract probes', 'function probesFor(p) {', 'function denseAgreement'],
  ['the dense-equivalence control', 'function denseAgreement(p, code) {', 'function control'],
  ['the controls', 'function control() {', 'if (process.argv.includes'],
];

for (const [name, from, to] of REGIONS) {
  test('FROZEN ACROSS THE REPAIR: ' + name, () => {
    assert.equal(region(r2, from, to, 'revision 2'), region(r1, from, to, 'revision 1'),
      name + ' changed, and only CONSTRAIN was supposed to');
  });
}

test('the DECLARED DIFF is present and is only CONSTRAIN', () => {
  assert.ok(r1.includes('function accept(text, p) {'), 'revision 1 defines its own acceptor');
  assert.ok(!r2.includes('function accept(text, p) {'), 'revision 2 must not define one');
  assert.ok(r2.includes("from '../legagate/envelope.mjs'"), 'revision 2 imports the envelope');
  assert.ok(!r1.includes('envelope.mjs'), 'revision 1 does not');
});

test('sampling protocol unchanged', () => {
  for (const s of [r1, r2]) {
    assert.ok(s.includes('const TEMPERATURE = 0.6;'));
    assert.ok(s.includes('num_predict: 160'));
    assert.ok(s.includes('const PARAM = '));
  }
});

test('NEGATIVE CONTROL: a mutated shape is detected', () => {
  const mutated = r2.replace('S_LOWER: {', 'S_LOWER_X: {');
  assert.notEqual(mutated, r2);
  assert.throws(() => {
    assert.equal(region(mutated, 'const SHAPES = {', '// The one variable', 'mutated'),
      region(r1, 'const SHAPES = {', '// The one variable', 'revision 1'));
  });
});
