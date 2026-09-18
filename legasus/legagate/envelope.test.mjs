// THE CONTROL LEGAGATE NEVER HAD.
//
// `PROVE` has had an anti-oracle control since window 10: two legal realizations must both pass, so a
// verifier cannot score reference-form similarity and call it semantic correctness. `CONSTRAIN` had no
// equivalent, and the consequence was measured rather than imagined - the 14B prefers `elif`, the
// envelope accepted only `if`, and one shape read as a catastrophic model failure (6/60 against 48/60,
// p = 2.7e-15) that was entirely the apparatus.
//
// So this file is two lists and a negative control:
//
//   ADMITS    every fragment here is a LEGAL realization and must be authorized
//   REFUSES   every fragment here is outside the authorized KIND and must be refused
//   CANNOT-BE-VACUOUS  an envelope that admits everything fails the refuse list, and one that refuses
//                      everything fails the admit list. Both directions are required.
import test from 'node:test';
import assert from 'node:assert';
import { authorize, normalizeFragment, guardConditionOf } from './envelope.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);
const FIXED = new Set(['def classify(n):', 'if n > 5:', 'return "big"', 'return "other"']);

// Each of these is a correct fragment for "when n < 10, return small", differing only in surface.
const ADMITS = {
  'plain if': L('if n < 10:', '    return "small"'),
  'elif after a returning branch': L('elif n < 10:', '    return "small"'),
  'one-line if': 'if n < 10: return "small"',
  'one-line elif': 'elif n < 10: return "small"',
  'fenced': L('```python', 'if n < 10:', '    return "small"', '```'),
  'fenced elif': L('```python', 'elif n < 10:', '    return "small"', '```'),
  'with a leading comment line': L('# add the new case', 'if n < 10:', '    return "small"'),
  'compound condition': L('if n < 10 and n != 3:', '    return "small"'),
  'unusual spacing': L('if    n<10  :', '        return "small"'),
  'blank lines around it': L('', 'if n < 10:', '', '    return "small"', ''),
};

const REFUSES = {
  'a whole function': L('def classify(n):', '    if n < 10:', '        return "small"'),
  'repeats a fixed line': L('if n > 5:', '    return "big"'),
  'prose': 'I would add a guard for values below ten.',
  'empty': '',
  'a return with no guard': 'return "small"',
  'a guard with no return': 'if n < 10:',
};

for (const [name, frag] of Object.entries(ADMITS)) {
  test('ADMITS: ' + name, () => {
    const r = authorize(frag, FIXED);
    assert.ok(r.ok, name + ' was refused: ' + r.reason);
    // Whitespace-tolerant on purpose: the envelope normalizes surface, so an assertion that demanded
    // one particular spacing would be the same style opinion this module exists to remove.
    assert.match(r.code.replace(/\s+/g, ' '), /if n ?< ?10/,
      'the guard must survive: ' + JSON.stringify(r.code));
    assert.match(r.code, /return "small"/);
  });
}

for (const [name, frag] of Object.entries(REFUSES)) {
  test('REFUSES: ' + name, () => {
    assert.equal(authorize(frag, FIXED).ok, false, name + ' was authorized');
  });
}

test('an elif is re-emitted as an if, so the assembly does not depend on the branch above returning', () => {
  const r = authorize(L('elif n < 10:', '    return "small"'), FIXED);
  assert.ok(r.ok);
  assert.equal(r.keyword, 'elif', 'the original keyword is recorded, because it is a realization fact');
  assert.ok(r.code.trim().startsWith('if '), 'assembled as if: ' + JSON.stringify(r.code));
});

test('if and elif produce IDENTICAL authorized code - the difference is surface only', () => {
  const a = authorize(L('if n < 10:', '    return "small"'), FIXED);
  const b = authorize(L('elif n < 10:', '    return "small"'), FIXED);
  assert.equal(a.code, b.code);
});

test('NEGATIVE CONTROL: an envelope that admits everything fails the refuse list', () => {
  const permissive = () => ({ ok: true, code: 'anything' });
  const survivors = Object.keys(REFUSES).filter((k) => permissive(REFUSES[k], FIXED).ok);
  assert.equal(survivors.length, Object.keys(REFUSES).length,
    'the refuse list must be able to catch a permissive envelope, or it proves nothing');
});

test('NEGATIVE CONTROL: an envelope that refuses everything fails the admit list', () => {
  const paranoid = () => ({ ok: false, reason: 'no' });
  const admitted = Object.keys(ADMITS).filter((k) => paranoid(ADMITS[k], FIXED).ok);
  assert.equal(admitted.length, 0);
  assert.ok(Object.keys(ADMITS).length >= 8,
    'the admit list must be broad enough that a narrow envelope fails it');
});

test('the three functions now share one opinion about elif', () => {
  const frag = 'elif n < 10: return "small"';
  assert.deepEqual(normalizeFragment(frag), ['elif n < 10:', '    return "small"']);
  assert.equal(guardConditionOf(frag), 'n < 10');
  assert.equal(authorize(frag, FIXED).ok, true);
});

test('scope is still enforced: a second guard is not authorized as part of the fragment', () => {
  const r = authorize(L('if n < 10:', '    return "small"', 'if n < 0:', '    return "tiny"'), FIXED);
  assert.ok(r.ok, 'the first guard and return are taken');
  assert.ok(!r.code.includes('tiny'), 'the second behaviour must not enter the authorized code');
});
