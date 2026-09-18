// The risk with a sufficiency guard is the usual one: a check that admits everything is worse than no
// check, because it looks like protection. So the tests run both directions, and the load-bearing one
// is the REPLAY — the guard must reject the exact W0 prompt that scored 0/20, and admit the exact W1
// prompt that scored 13/20. If it cannot separate those two it has learned nothing from the run that
// produced it.
import test from 'node:test';
import assert from 'node:assert';
import { promptSufficiency, identifiersIn } from './sufficiency.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

const FRAGMENT = L('if n < 10:', '    return "small"');

// The real W0 prompt, reproduced: marker, elision, delta. No source line, so no parameter name.
const W0 = L('Here is part of a Python function. Every line shown is FIXED: you may not change, repeat',
  'or remove any of it.',
  '',
  '    ...',
  '    # >>> YOUR LINES GO HERE <<<',
  '    ...',
  '',
  'A new behaviour is requested:',
  '    For other values below 10, return "small".',
  '',
  'Write ONLY the lines that take the place of the marker. Keep the same indentation.');

// The real W1 prompt: one statement either side, which is where `n` first becomes obtainable.
const W1 = L('Here is part of a Python function. Every line shown is FIXED: you may not change, repeat',
  'or remove any of it.',
  '',
  '    ...',
  '    if n == 0:',
  '        return "zero"',
  '    # >>> YOUR LINES GO HERE <<<',
  '    if n > 10000:',
  '        return "enormous"',
  '    ...',
  '',
  'A new behaviour is requested:',
  '    For other values below 10, return "small".',
  '',
  'Write ONLY the lines that take the place of the marker. Keep the same indentation.');

test('REPLAY: the W0 prompt that scored 0/20 is rejected, and the missing fact is named', () => {
  const r = promptSufficiency(W0, FRAGMENT);
  assert.equal(r.sufficient, false);
  assert.deepEqual(r.missing, ['n'],
    'the guard must name the parameter as the missing fact, not just say no');
});

test('REPLAY: the W1 prompt that scored 13/20 is admitted', () => {
  const r = promptSufficiency(W1, FRAGMENT);
  assert.equal(r.sufficient, true, 'missing: ' + JSON.stringify(r.missing));
});

test('a guard that admits everything would pass the W1 case and fail this one', () => {
  const r = promptSufficiency('nothing useful here at all', FRAGMENT);
  assert.equal(r.sufficient, false);
});

test('string contents are values, not facts the source must supply', () => {
  assert.deepEqual(identifiersIn('return "small"'), [],
    '"small" comes from the delta text; requiring it in the source would be nonsense');
});

test('python keywords and builtins need no source', () => {
  assert.deepEqual(identifiersIn('if len(items) > 0:'), ['items']);
});

test('a substring match must not count as the fact being present', () => {
  // "function" contains no standalone `n`; an unanchored search would wrongly call W0 sufficient.
  const r = promptSufficiency('Here is part of a Python function.', FRAGMENT);
  assert.equal(r.sufficient, false);
});
