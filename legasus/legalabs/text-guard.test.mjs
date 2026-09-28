// A guard that flags nothing is a reminder; a guard that flags everything is noise. Both directions.
//
// The load-bearing witness is the REPLAY: the exact text occurrence nine left behind must be caught,
// and the text that replaced it must be admitted.
import test from 'node:test';
import assert from 'node:assert';
import { scanText } from './text-guard.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);
const kinds = (src) => scanText(src, 't').map((h) => h.kind);

test('REPLAY: the damage occurrence nine actually left is caught', () => {
  const damaged = L('and the diagnostic says why: it survives EXACTLY when the model wrote a self-defending guard',
    '() - 145 OK / 2 FAIL against 0 OK / 86 FAIL for plain guards, p = 1.7e-62. So part');
  assert.ok(kinds(damaged).includes('empty-parens'), JSON.stringify(scanText(damaged, 't')));
});

test('REPLAY: the repaired text is admitted', () => {
  const fixed = L('and the diagnostic says why: it survives **exactly when the model wrote a self-defending',
    'guard** — `n < 10 and n != 3` rather than plain `n < 10`.');
  assert.deepEqual(kinds(fixed), []);
});

test('CATCHES a half-consumed inline span', () => {
  assert.ok(kinds('the guard `n < 10 and the rest of the sentence').includes('unbalanced-backticks'));
});

// THE ADMIT CASES THAT THE FIRST VERSION FAILED, taken verbatim from the real corpus rather than
// invented. Version one checked backtick balance PER LINE and flagged 25 things, all of them false
// positives, because this project's prose wraps inline spans across lines constantly.
test('ADMITS a real line-wrapped inline span, from LEGASUS.md', () => {
  const real = L('Authorization ran at 1.00 for 87 consecutive outputs and then began leaking - `if n > 0: return',
    '"small"` destroys a preserved behaviour while being perfectly well-formed, in-vocabulary and correctly',
    'shaped.');
  assert.deepEqual(kinds(real), []);
});

test('ADMITS a real line-wrapped span from a measurement README', () => {
  const real = L('has two halves: a *perfect* fragment must verify, and the ladder-1 inversion `if n > 10: return',
    '"small"` - written as a one-liner, so it exercises the new tolerance - must be **accepted and still',
    'fail**.');
  assert.deepEqual(kinds(real), []);
});

test('ADMITS the hazard ledger QUOTING the shell noise it documents', () => {
  const real = 'diagnostic was a shell line reading "10: No such file or directory" - noise, unless you know.';
  assert.deepEqual(kinds(real), []);
});

test('ADMITS shell noise inside an inline code span', () => {
  assert.deepEqual(kinds('the shell printed `command not found` and the file was written anyway'), []);
});

test('CATCHES captured shell noise that is neither quoted nor in a span', () => {
  for (const noise of ['bash: line 1: CONSTRAIN: command not found',
    'something /usr/bin/bash: No such file or directory here']) {
    assert.ok(kinds(noise).includes('shell-noise'), noise);
  }
});

test('CATCHES a raw control character', () => {
  assert.ok(kinds('a line with a ' + String.fromCharCode(1) + ' in it').includes('control-character'));
});

test('CATCHES an empty inline code span', () => {
  assert.ok(kinds('the model wrote `` instead of the guard').includes('empty-code-span'));
});

test('ADMITS ordinary prose with balanced spans, fences and tables', () => {
  const doc = L('# A document',
    '',
    'Some prose with `inline code` and **bold** and a footnote.',
    '',
    '| Stage | Status |',
    '|---|---|',
    '| `OBSERVE` | load-bearing |',
    '',
    '```js',
    'const re = /a`b/;          // a lone backtick INSIDE a fence must not be flagged',
    'if (x()) return;           // and empty parens in code must not be flagged',
    '```',
    '',
    '    an indented code block with a lone ` backtick and f() calls',
    '',
    'Closing prose.');
  assert.deepEqual(kinds(doc), []);
});

test('ADMITS a function call written in prose with arguments', () => {
  assert.deepEqual(kinds('we call `classify(5)` and it returns small'), []);
});

test('NEGATIVE CONTROL: a guard that flags nothing would pass every catch case', () => {
  const blind = () => [];
  const catchCases = ['a ' + String.fromCharCode(1) + ' b', 'x `unbalanced', 'command not found', 'an () here'];
  for (const c of catchCases) {
    assert.equal(blind(c).length, 0);
    assert.ok(scanText(c, 't').length > 0, 'the real guard must catch: ' + JSON.stringify(c));
  }
});

test('NEGATIVE CONTROL: a guard that flags everything would fail the admit cases', () => {
  const paranoid = (s) => [{ kind: 'x' }];
  const admitCases = ['plain prose', 'prose with `a span`', 'we call `f(1)` here'];
  for (const c of admitCases) {
    assert.ok(paranoid(c).length > 0);
    assert.deepEqual(kinds(c), [], 'the real guard must admit: ' + JSON.stringify(c));
  }
});
