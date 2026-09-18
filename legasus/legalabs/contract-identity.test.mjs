// "SAME TASKS, SAME RENDERER, SAME AUTHORITY ENVELOPE, SAME VERIFIER, SAME SAMPLING PROTOCOL" is a
// promise until something checks it. This checks it.
//
// The scale experiment varies model capacity and nothing else. Its harness is a mechanical transform of
// `run-exclusion-1p5b.mjs`, the file that produced the window-10 measurement and is frozen. This test
// compares the two files region by region and fails if anything outside the DECLARED DIFF has moved.
//
// Without it, a contract drifts one convenient line at a time and every cross-model comparison
// afterwards is quietly measuring two things.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const NL = String.fromCharCode(10);
const FROZEN = 'C:/Users/tatte/Projects/ai-coding-hub-indent/legasus/legalabs/run-exclusion-1p5b.mjs';
const SCALE = 'C:/Users/tatte/Projects/ai-coding-hub-indent/legasus/legalabs/run-scale.mjs';

const frozen = readFileSync(FROZEN, 'utf8');
const scale = readFileSync(SCALE, 'utf8');

// A region is everything between two anchors, both of which must appear exactly once in each file.
function region(src, from, to, file) {
  const i = src.indexOf(from);
  assert.ok(i >= 0, from + ' not found in ' + file);
  assert.equal(src.indexOf(from, i + 1), -1, from + ' appears more than once in ' + file);
  const j = src.indexOf(to, i);
  assert.ok(j > i, to + ' not found after ' + from + ' in ' + file);
  return src.slice(i, j);
}

// THE CONTRACT. Each of these is a stage of the pipeline, and each must be byte-identical.
const REGIONS = [
  ['TASKS - the four programs and their preserved values', 'const TASKS = {', 'const RENDERINGS'],
  ['RENDER - the three model-facing renderings', 'const RENDERINGS = {', 'function sourceFor'],
  ['OBSERVE - the program template', 'function sourceFor(t) {', 'const PRESERVATION'],
  ['DECIDE - plan derivation', 'function plan(taskKey, renderKey) {', 'function promptFor'],
  ['RENDER - prompt assembly', 'function promptFor(p) {', 'function normalize'],
  ['the acceptance normalizer', 'function normalize(text) {', 'function accept'],
  ['CONSTRAIN - the authority envelope', 'function accept(text, p) {', 'export function conditionOf'],
  ['the guard extractor', 'export function conditionOf(text) {', '// THE PRIMARY MEASUREMENT'],
  ['the primary classifier', 'export function exclusionFamily(cond, preserved) {', 'function build'],
  ['assembly', 'function build(code, p) {', 'function evaluate'],
  ['PROVE - the verifier and its probes', 'function evaluate(program, p) {', 'const CELLS'],
  ['the cell list', 'const CELLS = [];', 'function control'],
  ['the controls', 'function control() {', 'if (process.argv.includes'],
];

for (const [name, from, to] of REGIONS) {
  test('FROZEN CONTRACT: ' + name, () => {
    assert.equal(region(scale, from, to, 'run-scale'), region(frozen, from, to, 'run-exclusion-1p5b'),
      name + ' differs between the frozen harness and the scale harness');
  });
}

test('sampling protocol is identical - temperature and token budget', () => {
  assert.ok(frozen.includes('const TEMPERATURE = 0.6;'));
  assert.ok(scale.includes('const TEMPERATURE = 0.6;'));
  assert.ok(frozen.includes('num_predict: 160'));
  assert.ok(scale.includes('num_predict: 160'));
});

test('the DECLARED DIFF is present, so this test is checking a real transform', () => {
  // If the scale harness were simply a copy, every region would match trivially and the test would
  // prove nothing about a harness that actually varies the model.
  assert.ok(frozen.includes("const MODEL = 'qwen2.5-coder:1.5b';"), 'frozen harness pins one model');
  assert.ok(scale.includes('const MODELS = '), 'scale harness parameterizes the model');
  assert.ok(scale.includes('generate(prompt, model)'), 'scale harness passes the model per call');
  assert.ok(!scale.includes("const MODEL = 'qwen2.5-coder:1.5b';"), 'scale harness must not pin one');
});

test('NEGATIVE CONTROL: a mutated contract is detected', () => {
  // A checker that passes everything is the failure this project keeps meeting. Prove it can fail.
  const mutated = scale.replace('return "small"', 'return "SMALL"');
  assert.notEqual(mutated, scale, 'the mutation must actually change the text');
  assert.throws(() => {
    assert.equal(region(mutated, 'const RENDERINGS = {', 'function sourceFor', 'mutated'),
      region(frozen, 'const RENDERINGS = {', 'function sourceFor', 'frozen'));
  }, 'a changed rendering must be caught');
});
